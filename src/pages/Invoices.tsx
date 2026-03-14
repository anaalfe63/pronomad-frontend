import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Search, CheckCircle, AlertCircle, X, Printer, PlusCircle, Trash2, Building2, CreditCard, Link as LinkIcon, RefreshCw, Zap, CloudOff, CloudUpload } from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

// --- TYPES & INTERFACES ---
interface InvoiceItem { desc: string; qty: number; price: number; }
interface Invoice {
  id: string; client: string; email: string; address: string; project: string;
  tripId: string; issueDate: string; dueDate: string; currency: string;
  items: InvoiceItem[]; taxRate: number; discount: number; subtotal: number;
  total: number; amountPaid: number; status: string;
}
type NewInvoiceState = Omit<Invoice, 'id' | 'subtotal' | 'total' | 'amountPaid' | 'status'>;
interface Trip { id: string; title: string; startDate: string; adultPrice: number; childPrice: number; }
interface SyncAction { id: number; table: string; action: 'UPDATE' | 'INSERT' | 'DELETE'; recordId?: string | number; payload?: any; }

const Invoices: React.FC = () => {
  const { user } = useTenant();
  const MY_SUBSCRIBER_ID = user?.subscriberId || "";
  
  // 🌟 DYNAMIC TENANT SETTINGS
  const BASE_CURRENCY = user?.currency || 'GHS';
  const DEFAULT_TAX = user?.taxRate || 0;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tripsDb, setTripsDb] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentInput, setPaymentInput] = useState<string>('');

  const defaultItem: InvoiceItem = { desc: '', qty: 1, price: 0 };
  const [newInvoice, setNewInvoice] = useState<NewInvoiceState>({
    client: '', email: '', address: '', project: '', tripId: '', issueDate: new Date().toISOString().split('T')[0],
    dueDate: '', currency: BASE_CURRENCY, items: [{...defaultItem}], taxRate: DEFAULT_TAX, discount: 0
  });

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<SyncAction[]>(() => {
     const saved = localStorage.getItem('pronomad_invoice_sync');
     return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
     localStorage.setItem('pronomad_invoice_sync', JSON.stringify(pendingSyncs));
  }, [pendingSyncs]);

  const processSyncQueue = useCallback(async () => {
      if (!navigator.onLine || pendingSyncs.length === 0 || isSyncing) return;
      setIsSyncing(true);
      const remaining = [...pendingSyncs];

      for (const task of pendingSyncs) {
          try {
              if (task.action === 'INSERT') {
                  const { error } = await supabase.from(task.table).insert([task.payload]);
                  if (error) throw error;
              } else if (task.action === 'UPDATE') {
                  const { error } = await supabase.from(task.table).update(task.payload).eq('id', task.recordId);
                  if (error) throw error;
              } else if (task.action === 'DELETE') {
                  const { error } = await supabase.from(task.table).delete().eq('id', task.recordId);
                  if (error) throw error;
              }
              remaining.shift();
          } catch (e) {
              console.error("Invoice Sync failed:", task.id, e);
              break; 
          }
      }
      setPendingSyncs(remaining);
      setIsSyncing(false);
      if (remaining.length === 0) fetchData(); 
  }, [pendingSyncs, isSyncing]);

  useEffect(() => {
      const handleOnline = () => { setIsOnline(true); processSyncQueue(); };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      const syncInterval = setInterval(processSyncQueue, 30000);
      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
          clearInterval(syncInterval);
      };
  }, [processSyncQueue]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (!MY_SUBSCRIBER_ID) return;
      
      const [tripsRes, invRes] = await Promise.all([
          supabase.from('trips').select('*').eq('subscriber_id', MY_SUBSCRIBER_ID),
          supabase.from('invoices').select('*').eq('subscriber_id', MY_SUBSCRIBER_ID).order('created_at', { ascending: false })
      ]);

      if (tripsRes.data) {
          setTripsDb(tripsRes.data.map((t:any) => {
              const fin = t.financials || {};
              return { id: t.id, title: t.title, startDate: t.start_date, adultPrice: Number(fin.adultPrice) || 0, childPrice: Number(fin.childPrice) || 0 };
          }));
      }

      if (invRes.data) {
        const today = new Date().toISOString().split('T')[0];
        const formattedInvoices: Invoice[] = invRes.data.map((inv: any) => {
          let status = inv.status;
          if (status !== 'Paid' && status !== 'Cancelled' && inv.due_date < today) status = 'Overdue';
          return {
            id: inv.id, client: inv.client_name, email: inv.email || '', address: inv.address || '',
            project: inv.project_name || '', tripId: inv.trip_id || '', issueDate: inv.issue_date,
            dueDate: inv.due_date, currency: inv.currency || BASE_CURRENCY, 
            items: typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []), 
            taxRate: Number(inv.tax_rate), discount: Number(inv.discount), subtotal: Number(inv.subtotal), 
            total: Number(inv.total), amountPaid: Number(inv.amount_paid), status
          };
        });
        setInvoices(formattedInvoices);
      }
    } catch (error) { console.error("Database connection error:", error); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => { if (MY_SUBSCRIBER_ID) fetchData(); }, [MY_SUBSCRIBER_ID]);

  const handleAutoFillFromTrip = (tripId: string) => {
      const trip = tripsDb.find(t => String(t.id) === String(tripId));
      if (!trip) return;
      const autoItems: InvoiceItem[] = [{ desc: `${trip.title} - Adult Package`, qty: 1, price: trip.adultPrice }];
      setNewInvoice({ ...newInvoice, tripId, project: `${trip.title} (Departs: ${trip.startDate})`, items: autoItems });
  };

  const handleAddItem = () => setNewInvoice({ ...newInvoice, items: [...newInvoice.items, { ...defaultItem }] });
  const handleUpdateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updatedItems = [...newInvoice.items];
    if (field === 'desc') { updatedItems[index][field] = value as string; } 
    else { updatedItems[index][field] = Number(value); }
    setNewInvoice({ ...newInvoice, items: updatedItems });
  };
  const handleRemoveItem = (index: number) => { setNewInvoice({ ...newInvoice, items: newInvoice.items.filter((_, i) => i !== index) }); };

  const calculateTotals = (invoice: NewInvoiceState) => {
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const taxAmount = subtotal * (invoice.taxRate / 100);
    const total = subtotal + taxAmount - Number(invoice.discount);
    return { subtotal, total };
  };

  const handleSaveInvoice = async () => {
    if (!newInvoice.client || !newInvoice.dueDate || newInvoice.items.length === 0) {
      return alert("Client Name, Due Date, and at least 1 Line Item are required.");
    }
    
    setIsSaving(true);
    const { subtotal, total } = calculateTotals(newInvoice);
    const tempId = `INV-${Math.floor(Math.random() * 90000) + 10000}`;
    
    const payload = {
        id: tempId,
        subscriber_id: MY_SUBSCRIBER_ID,
        client_name: newInvoice.client,
        email: newInvoice.email,
        address: newInvoice.address,
        project_name: newInvoice.project,
        trip_id: newInvoice.tripId || null,
        issue_date: newInvoice.issueDate,
        due_date: newInvoice.dueDate,
        currency: newInvoice.currency,
        items: newInvoice.items,
        tax_rate: newInvoice.taxRate,
        discount: newInvoice.discount,
        subtotal: subtotal,
        total: total,
        amount_paid: 0,
        status: 'Sent'
    };

    const optimisticInvoice: Invoice = { id: tempId, ...newInvoice, subtotal, total, amountPaid: 0, status: 'Sent' };
    setInvoices([optimisticInvoice, ...invoices]);
    setIsCreateModalOpen(false);
    setNewInvoice({ client: '', email: '', address: '', project: '', tripId: '', issueDate: new Date().toISOString().split('T')[0], dueDate: '', currency: BASE_CURRENCY, items: [{...defaultItem}], taxRate: DEFAULT_TAX, discount: 0 });

    try {
      if (!navigator.onLine) throw new Error("Offline");
      const { error } = await supabase.from('invoices').insert([payload]);
      if (error) throw error;
      fetchData(); 
    } catch (error) { 
      setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'invoices', action: 'INSERT', payload: payload }]);
    } finally { setIsSaving(false); }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    if (!paymentInput || Number(paymentInput) <= 0) return alert("Enter a valid payment amount.");
    
    const payment = Number(paymentInput);
    let newStatus = 'Partially Paid';
    let updatedTotalPaid = (selectedInvoice.amountPaid || 0) + payment;

    if (updatedTotalPaid >= selectedInvoice.total - 0.5) newStatus = 'Paid';

    const payload = { amount_paid: updatedTotalPaid, status: newStatus };

    setInvoices(prev => prev.map(inv => inv.id === selectedInvoice.id ? { ...inv, amountPaid: updatedTotalPaid, status: newStatus } : inv));
    setSelectedInvoice({ ...selectedInvoice, amountPaid: updatedTotalPaid, status: newStatus });
    setPaymentInput('');

    try {
      if (!navigator.onLine) throw new Error("Offline");
      const { error } = await supabase.from('invoices').update(payload).eq('id', selectedInvoice.id);
      if (error) throw error;
    } catch (error) { 
      setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'invoices', action: 'UPDATE', recordId: selectedInvoice.id, payload: payload }]);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
      if(!window.confirm("Are you sure you want to permanently delete this invoice?")) return;
      setInvoices(prev => prev.filter(inv => inv.id !== id));
      setIsViewModalOpen(false);
      try {
          if (!navigator.onLine) throw new Error("Offline");
          await supabase.from('invoices').delete().eq('id', id);
      } catch (e) { 
          setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'invoices', action: 'DELETE', recordId: id }]);
      }
  };

  const totalOutstanding = invoices.reduce((sum, i) => sum + (i.total - (i.amountPaid || 0)), 0);
  const totalOverdue = invoices.filter(i => i.status === 'Overdue').reduce((sum, i) => sum + (i.total - (i.amountPaid || 0)), 0);
  const filteredInvoices = invoices.filter(inv => (inv.client || '').toLowerCase().includes(searchQuery.toLowerCase()) || (inv.id || '').toLowerCase().includes(searchQuery.toLowerCase()));

  const handlePrint = () => { window.print(); };

  return (
    <div className="animate-fade-in pb-20 relative">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold text-teal-900 tracking-tight" style={{ color: user?.themeColor }}>Corporate Invoicing</h1>
            {pendingSyncs.length > 0 ? (
                 <div className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest cursor-pointer" onClick={processSyncQueue}>
                    {isSyncing ? <RefreshCw size={14} className="animate-spin"/> : <CloudOff size={14}/>}
                    {pendingSyncs.length} Pending
                 </div>
            ) : (
                 <div className="flex items-center gap-1 text-slate-300" title="Cloud Synced">
                    <CloudUpload size={20}/>
                 </div>
            )}
          </div>
          <p className="text-slate-500 font-medium">Manage B2B billing, generate professional PDFs, and track partial payments.</p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95" style={{ backgroundColor: user?.themeColor || '#0d9488' }}>
          <Plus size={18}/> Draft New Invoice
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-xl border border-white/60 relative overflow-hidden">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Receivables (Due)</p>
          <h2 className="text-3xl font-black text-slate-800"><span className="text-lg text-slate-400 mr-1">{BASE_CURRENCY}</span>{totalOutstanding.toLocaleString()}</h2>
        </div>
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-xl border border-white/60 relative overflow-hidden">
          <p className="text-sm font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertCircle size={16}/> Overdue Receivables</p>
          <h2 className="text-3xl font-black text-red-600"><span className="text-lg text-red-300 mr-1">{BASE_CURRENCY}</span>{totalOverdue.toLocaleString()}</h2>
        </div>
      </div>

      {/* INVOICE TABLE */}
      <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/60 p-8">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl w-full max-w-sm mb-6 focus-within:border-teal-500 transition-colors">
          <Search size={18} className="text-slate-400 ml-2" />
          <input type="text" placeholder="Search by Client or Invoice ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent outline-none text-sm font-bold text-slate-700" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 text-[10px] uppercase tracking-widest">
                <th className="p-6 font-bold rounded-tl-xl">Invoice #</th>
                <th className="p-6 font-bold">Client / Project</th>
                <th className="p-6 font-bold">Timeline</th>
                <th className="p-6 font-bold text-right">Total Billed</th>
                <th className="p-6 font-bold text-right">Balance Due</th>
                <th className="p-6 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && invoices.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-teal-600 font-bold animate-pulse"><RefreshCw className="inline animate-spin mr-2"/> Syncing with Database...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold">No invoices found.</td></tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const balance = inv.total - (inv.amountPaid || 0);
                  return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => { setSelectedInvoice(inv); setPaymentInput(''); setIsViewModalOpen(true); }}>
                    <td className="p-6 font-mono text-sm font-bold flex items-center gap-2 mt-2" style={{ color: user?.themeColor || '#0d9488' }}>
                      <FileText size={16} /> {String(inv.id).slice(0, 8)}
                    </td>
                    <td className="p-6">
                      <p className="font-black text-slate-800 text-base flex items-center gap-2"><Building2 size={14} className="text-slate-400"/> {inv.client}</p>
                      <p className="text-xs font-bold text-slate-500 mt-1">{inv.project || 'General Billing'}</p>
                    </td>
                    <td className="p-6 text-sm">
                      <p className="text-slate-500 font-bold">Issued: {inv.issueDate}</p>
                      <p className={`font-black mt-1 ${inv.status === 'Overdue' ? 'text-red-500' : 'text-slate-700'}`}>Due: {inv.dueDate}</p>
                    </td>
                    <td className="p-6 font-black text-slate-400 text-right text-base line-through opacity-70">
                      <span className="text-[10px] mr-1">{inv.currency}</span>{inv.total?.toLocaleString()}
                    </td>
                    <td className="p-6 font-black text-slate-800 text-right text-lg">
                      <span className="text-[10px] text-slate-400 mr-1">{inv.currency}</span>{Math.max(0, balance).toLocaleString()}
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 w-max 
                        ${inv.status === 'Paid' ? 'bg-green-100 text-green-700' : 
                          inv.status === 'Partially Paid' ? 'bg-orange-100 text-orange-700' : 
                          inv.status === 'Overdue' ? 'bg-red-100 text-red-700 border border-red-200' : 
                          inv.status === 'Draft' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                        {inv.status === 'Paid' && <CheckCircle size={12}/>}
                        {inv.status === 'Overdue' && <AlertCircle size={12}/>}
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE INVOICE WIZARD */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Draft New Invoice</h2>
                <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: user?.themeColor || '#0d9488' }}>B2B Invoice Generator</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-red-500 border border-slate-200"><X size={20} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 bg-slate-50/50">
              
              {/* SMART AUTO-FILL ENGINE */}
              <div className="bg-slate-100 border-2 border-slate-200 p-5 rounded-2xl relative overflow-hidden">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2"><Zap size={14} className="text-amber-500 fill-amber-500"/> AI Trip Linking (Auto-Fill)</label>
                <select 
                  onChange={e => handleAutoFillFromTrip(e.target.value)} 
                  className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none font-bold text-slate-800 cursor-pointer shadow-sm transition-all"
                >
                  <option value="">Select an Operations Trip to instantly generate Line Items...</option>
                  {tripsDb.map(trip => (
                    <option key={trip.id} value={trip.id}>{trip.title} (Base: {BASE_CURRENCY}{trip.adultPrice})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Client / Company Name *</label>
                  <input type="text" value={newInvoice.client} onChange={e => setNewInvoice({...newInvoice, client: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none font-bold text-slate-800 focus:border-slate-500 transition-colors" placeholder="e.g. Acme Corp"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Project / Description</label>
                  <input type="text" value={newInvoice.project} onChange={e => setNewInvoice({...newInvoice, project: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none text-slate-800 font-bold focus:border-slate-500 transition-colors" placeholder="e.g. Annual Corporate Retreat"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Client Email (Optional)</label>
                  <input type="email" value={newInvoice.email} onChange={e => setNewInvoice({...newInvoice, email: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none text-slate-800 focus:border-slate-500 transition-colors" placeholder="billing@acmecorp.com"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Billing Address (Optional)</label>
                  <input type="text" value={newInvoice.address} onChange={e => setNewInvoice({...newInvoice, address: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none text-slate-800 focus:border-slate-500 transition-colors" placeholder="123 Business Street..."/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Issue Date</label>
                  <input type="date" value={newInvoice.issueDate} onChange={e => setNewInvoice({...newInvoice, issueDate: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none font-bold text-slate-700"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-red-400 uppercase ml-2 block mb-1">Payment Due Date *</label>
                  <input type="date" value={newInvoice.dueDate} onChange={e => setNewInvoice({...newInvoice, dueDate: e.target.value})} className="w-full bg-white border-2 border-red-100 focus:border-red-400 p-4 rounded-xl outline-none font-bold text-red-700 transition-colors"/>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Invoice Line Items</h3>
                  <select value={newInvoice.currency} onChange={e => setNewInvoice({...newInvoice, currency: e.target.value})} className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold outline-none cursor-pointer">
                    <option value={BASE_CURRENCY}>{BASE_CURRENCY}</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                {newInvoice.items.map((item, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-3 mb-3 items-start md:items-center animate-in fade-in">
                    <div className="flex-1 w-full">
                      <input type="text" placeholder="Service Description..." value={item.desc} onChange={e => handleUpdateItem(index, 'desc', e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold text-slate-800 focus:border-slate-400"/>
                    </div>
                    <div className="w-full md:w-24">
                      <input type="number" placeholder="Qty" value={item.qty} onChange={e => handleUpdateItem(index, 'qty', e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold text-center focus:border-slate-400"/>
                    </div>
                    <div className="w-full md:w-32 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{newInvoice.currency}</span>
                      <input type="number" placeholder="Price" value={item.price} onChange={e => handleUpdateItem(index, 'price', e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl outline-none text-sm font-bold text-right focus:border-slate-400"/>
                    </div>
                    <div className="w-full md:w-32 text-right font-black text-slate-800 pt-3 md:pt-0">
                      {newInvoice.currency} {(item.qty * item.price).toLocaleString()}
                    </div>
                    {index > 0 ? (
                      <button onClick={() => handleRemoveItem(index)} className="text-slate-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                    ) : <div className="w-9"></div>}
                  </div>
                ))}
                
                <button onClick={handleAddItem} className="mt-4 text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-colors px-4 py-2 rounded-lg" style={{ color: user?.themeColor || '#0d9488', backgroundColor: `${user?.themeColor || '#0d9488'}20` }}><PlusCircle size={14}/> Add another item</button>
              </div>

              <div className="flex flex-col items-end gap-3 w-full md:w-1/2 ml-auto bg-slate-100 p-6 rounded-2xl">
                <div className="flex justify-between w-full items-center">
                  <span className="text-slate-500 font-bold text-sm uppercase">Tax / VAT (%):</span>
                  <input type="number" value={newInvoice.taxRate} onChange={e => setNewInvoice({...newInvoice, taxRate: Number(e.target.value)})} className="w-20 bg-white border border-slate-200 p-2 rounded-lg text-right font-bold outline-none text-sm"/>
                </div>
                <div className="flex justify-between w-full items-center border-b border-slate-200 pb-4">
                  <span className="text-slate-500 font-bold text-sm uppercase">Discount ({newInvoice.currency}):</span>
                  <input type="number" value={newInvoice.discount} onChange={e => setNewInvoice({...newInvoice, discount: Number(e.target.value)})} className="w-24 bg-white border border-slate-200 p-2 rounded-lg text-right font-bold outline-none text-sm text-orange-600"/>
                </div>
                <div className="flex justify-between w-full items-center mt-2">
                  <span className="text-lg font-black text-slate-800 uppercase tracking-widest">Grand Total:</span>
                  <span className="text-3xl font-black" style={{ color: user?.themeColor || '#0d9488' }}>{newInvoice.currency} {calculateTotals(newInvoice).total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white shrink-0">
              <button onClick={handleSaveInvoice} disabled={isSaving} className="w-full py-5 rounded-2xl font-black shadow-xl bg-slate-900 hover:bg-slate-800 text-white flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-70">
                {isSaving ? <RefreshCw size={20} className="animate-spin"/> : <CheckCircle size={20}/>} 
                {isSaving ? 'Saving to Cloud...' : 'Finalize & Generate Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INVOICE PREVIEW & RECORD PAYMENT */}
      {isViewModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm no-print" onClick={() => setIsViewModalOpen(false)}></div>
          
          <div className="bg-transparent w-full max-w-6xl h-[95vh] z-10 flex flex-col md:flex-row gap-6 rounded-xl overflow-hidden relative animate-in zoom-in-95 duration-200">
            
            {/* LEFT SIDE: The Printable A4 Document */}
            <div id="printable-invoice" className="bg-white flex-1 overflow-y-auto rounded-2xl shadow-2xl p-8 md:p-14 relative">
              
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8 mb-8">
                <div>
                  {/* 🌟 DYNAMIC LOGO INJECTION */}
                  {user?.companyLogo ? (
                      <img src={user.companyLogo} alt="Company Logo" className="h-16 object-contain mb-4" />
                  ) : (
                      <h2 className="text-4xl font-black text-slate-900 tracking-tighter">INVOICE</h2>
                  )}
                  <p className="text-slate-400 font-mono font-bold tracking-widest">INV-{String(selectedInvoice.id).slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  {/* 🌟 DYNAMIC COMPANY DETAILS */}
                  <h3 className="text-xl font-black" style={{ color: user?.themeColor || '#0d9488' }}>{user?.companyName || 'Travel Agency'}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      {user?.address || 'Head Office'}<br/>
                      {user?.supportEmail || ''} 
                  </p>
                </div>
              </div>

              <div className="flex justify-between mb-12">
                <div>
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">Billed To:</p>
                  <p className="text-xl font-black text-slate-800">{selectedInvoice.client}</p>
                  <p className="text-sm text-slate-600 font-bold mt-1">{selectedInvoice.project}</p>
                  <p className="text-sm text-slate-500 font-medium">{selectedInvoice.address}</p>
                  <p className="text-sm text-slate-500 font-medium">{selectedInvoice.email}</p>
                </div>
                <div className="text-right">
                  <div className="mb-4">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Date Issued:</p>
                    <p className="text-sm font-bold text-slate-800">{selectedInvoice.issueDate}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-black text-red-400 tracking-widest">Payment Due:</p>
                    <p className="text-sm font-black text-red-600">{selectedInvoice.dueDate}</p>
                  </div>
                </div>
              </div>

              <div className="absolute top-[25%] right-16 opacity-5 rotate-12 pointer-events-none">
                <span className={`text-8xl font-black uppercase tracking-widest ${selectedInvoice.status === 'Paid' ? 'text-green-600' : selectedInvoice.status === 'Overdue' ? 'text-red-600' : 'text-slate-800'}`}>
                  {selectedInvoice.status}
                </span>
              </div>

              <table className="w-full mb-8">
                <thead>
                  <tr className="border-y-2 border-slate-200">
                    <th className="py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                    <th className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
                    <th className="py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Price</th>
                    <th className="py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoice.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-5 text-sm font-bold text-slate-800 pr-4">{item.desc}</td>
                      <td className="py-5 text-sm text-slate-600 font-bold text-center">{item.qty}</td>
                      <td className="py-5 text-sm text-slate-600 font-bold text-right">{item.price.toLocaleString()}</td>
                      <td className="py-5 text-sm font-black text-slate-800 text-right">{selectedInvoice.currency} {(item.qty * item.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-full md:w-1/2 space-y-3">
                  <div className="flex justify-between text-sm text-slate-500 font-bold">
                    <span>Subtotal</span>
                    <span>{selectedInvoice.currency} {selectedInvoice.subtotal?.toLocaleString()}</span>
                  </div>
                  {selectedInvoice.taxRate > 0 && (
                    <div className="flex justify-between text-sm text-slate-500 font-bold">
                      <span>Tax / VAT ({selectedInvoice.taxRate}%)</span>
                      <span>{selectedInvoice.currency} {((selectedInvoice.subtotal * selectedInvoice.taxRate) / 100).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between text-sm text-orange-600 font-bold">
                      <span>Discount</span>
                      <span>- {selectedInvoice.currency} {selectedInvoice.discount?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t-2 border-slate-800 pt-3 mt-3">
                    <span className="text-sm font-black text-slate-800 uppercase tracking-widest">Total Billed</span>
                    <span className="text-xl font-black text-slate-800">{selectedInvoice.currency} {selectedInvoice.total?.toLocaleString()}</span>
                  </div>
                  
                  {(selectedInvoice.amountPaid > 0) && (
                    <div className="flex justify-between items-center pt-2 text-green-600">
                      <span className="text-xs font-bold uppercase tracking-widest">Payments Applied</span>
                      <span className="text-lg font-black">- {selectedInvoice.currency} {selectedInvoice.amountPaid?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t-2 border-slate-200 pt-4 mt-4 bg-slate-50 p-4 rounded-xl">
                    <span className="text-sm font-black text-slate-800 uppercase tracking-widest">Balance Due</span>
                    <span className="text-3xl font-black" style={{ color: user?.themeColor || '#0d9488' }}>{selectedInvoice.currency} {Math.max(0, selectedInvoice.total - (selectedInvoice.amountPaid || 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="mt-20 pt-8 border-t border-slate-100 text-xs text-slate-500 text-center font-medium leading-relaxed">
                <p className="font-black text-slate-800 mb-2 uppercase tracking-widest text-[10px]">Payment Instructions</p>
                <p>Please make all cheques payable to <strong>{user?.companyName || 'Us'}</strong>.</p>
                <p className="mt-2">Thank you for your business!</p>
              </div>
            </div>

            {/* RIGHT SIDE: Action Panel (HIDDEN DURING PRINTING) */}
            <div className="w-full md:w-96 bg-slate-900 text-white rounded-2xl p-8 flex flex-col no-print overflow-y-auto border border-slate-800 shadow-2xl">
              <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                <h3 className="font-black uppercase tracking-widest text-xs text-slate-400">Invoice Actions</h3>
                <button onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
              </div>

              <button onClick={handlePrint} className="w-full bg-white text-slate-900 hover:bg-slate-100 py-4 rounded-xl font-black flex justify-center items-center gap-2 transition-all mb-8 shadow-lg">
                <Printer size={18}/> Print / Save PDF
              </button>

              {/* Partial Payment Interface */}
              {selectedInvoice.status !== 'Paid' && (
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-inner">
                  <h4 className="font-black mb-4 flex items-center gap-2 uppercase tracking-widest text-xs" style={{ color: user?.themeColor || '#4fd1c5' }}><CreditCard size={16}/> Log Payment</h4>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Amount Received ({selectedInvoice.currency})</label>
                  <input 
                    type="number" 
                    value={paymentInput} 
                    onChange={e => setPaymentInput(e.target.value)} 
                    placeholder={(selectedInvoice.total - (selectedInvoice.amountPaid || 0)).toString()} 
                    className="w-full bg-slate-900 border-2 border-slate-700 focus:border-slate-500 p-4 rounded-xl outline-none font-black text-3xl text-white mb-4 transition-colors text-center"
                  />
                  <button onClick={handleRecordPayment} className="w-full text-white py-4 rounded-xl font-black text-sm transition-all shadow-lg" style={{ backgroundColor: user?.themeColor || '#0d9488' }}>
                    Apply to Ledger
                  </button>
                </div>
              )}

              {selectedInvoice.status === 'Paid' && (
                <div className="mt-4 bg-green-500/10 border border-green-500/30 p-6 rounded-2xl text-center">
                  <CheckCircle size={32} className="text-green-400 mx-auto mb-3"/>
                  <p className="font-black text-green-400 uppercase tracking-widest">Invoice Cleared</p>
                </div>
              )}

              {/* Administrative Danger Zone */}
              <div className="mt-auto pt-8 border-t border-slate-800">
                  <button onClick={() => handleDeleteInvoice(selectedInvoice.id)} className="w-full py-3 text-xs font-bold text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors flex items-center justify-center gap-2">
                      <Trash2 size={14}/> Delete Official Record
                  </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Invoices;