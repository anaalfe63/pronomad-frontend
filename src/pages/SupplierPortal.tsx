import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, Plane, Map as MapIcon, Plus, Pencil, Search, X, Trash2, 
  Bus, MapPin, CreditCard, Tag, ShieldAlert, RefreshCw, UploadCloud, Star,
  CloudOff, CloudUpload
} from 'lucide-react';
// 🟢 Swapped Auth Engine
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

// OFFLINE SYNC TYPE
interface SyncAction {
    id: number;
    table: string;
    action: 'UPDATE' | 'INSERT' | 'DELETE';
    recordId?: string | number;
    payload?: any;
}

const SupplierPortal = () => {
  const { user } = useTenant();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 🟢 OFFLINE SYNC STATE
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<SyncAction[]>(() => {
     const saved = localStorage.getItem('pronomad_sup_sync_queue');
     return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
     localStorage.setItem('pronomad_sup_sync_queue', JSON.stringify(pendingSyncs));
  }, [pendingSyncs]);

  // Expanded Data Structure
  const emptySupplier = {
    id: '', name: '', type: 'Hotel', contact: '', emergencyContact: '', taxId: '', 
    status: 'Active Contract', expiryDate: '', address: '', serviceRegions: '',
    paymentTerms: 'Prepaid', bankDetails: '', bankVerified: false, 
    cancellationPolicy: '', notes: '', rating: 5,
    pricingType: 'Per Passenger', unitPrice: '', currency: 'GHS'
  };
  const [currentSupplier, setCurrentSupplier] = useState(emptySupplier);

  // --- BACKGROUND SYNC WORKER ---
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
              console.error("Sync failed for task", task.id, e);
              break; 
          }
      }
      
      setPendingSyncs(remaining);
      setIsSyncing(false);
      if (remaining.length === 0) fetchSuppliers(); // Refresh when sync clears!
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


  // --- 1. FETCH FROM CLOUD ---
  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      if (!user?.subscriberId) return;

      const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('subscriber_id', user.subscriberId);
      
      if (!error && data) {
        const mapped = data.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            contact: s.contact_info?.email || '',
            emergencyContact: s.contact_info?.phone || '',
            address: s.contact_info?.address || '',
            serviceRegions: s.contact_info?.serviceRegions || '',
            taxId: s.financial_terms?.taxId || '',
            status: s.financial_terms?.status || 'Active Contract',
            expiryDate: s.financial_terms?.expiryDate || '',
            paymentTerms: s.financial_terms?.paymentTerms || 'Prepaid',
            bankDetails: s.financial_terms?.bankDetails || '',
            bankVerified: s.financial_terms?.bankVerified || false,
            cancellationPolicy: s.financial_terms?.cancellationPolicy || '',
            notes: s.financial_terms?.notes || '',
            rating: s.financial_terms?.rating || 5,
            pricingType: s.financial_terms?.pricingType || 'Per Passenger',
            unitPrice: s.financial_terms?.unitPrice || 0,
            currency: s.financial_terms?.currency || 'GHS',
        }));
        setSuppliers(mapped);
      }
    } catch (e) {
      console.error("Fetch Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.subscriberId) fetchSuppliers();
  }, [user]);

  // --- 2. SAVE (CREATE / UPDATE) WITH OFFLINE SUPPORT ---
  const handleSaveSupplier = async () => {
    if (!currentSupplier.name || !currentSupplier.unitPrice) return alert("Name and Unit Price are required.");
    
    // Mapped JSONB payload
    const payload = {
        subscriber_id: user?.subscriberId,
        name: currentSupplier.name,
        type: currentSupplier.type,
        contact_info: {
            email: currentSupplier.contact,
            phone: currentSupplier.emergencyContact,
            address: currentSupplier.address,
            serviceRegions: currentSupplier.serviceRegions
        },
        financial_terms: {
            taxId: currentSupplier.taxId,
            status: currentSupplier.status,
            expiryDate: currentSupplier.expiryDate,
            paymentTerms: currentSupplier.paymentTerms,
            bankDetails: currentSupplier.bankDetails,
            bankVerified: currentSupplier.bankVerified,
            cancellationPolicy: currentSupplier.cancellationPolicy,
            notes: currentSupplier.notes,
            rating: currentSupplier.rating,
            pricingType: currentSupplier.pricingType,
            unitPrice: Number(currentSupplier.unitPrice),
            currency: currentSupplier.currency
        }
    };

    // Optimistic UI Update
    setIsModalOpen(false);
    if (isEditing) {
        setSuppliers(prev => prev.map(s => s.id === currentSupplier.id ? { ...currentSupplier } : s));
    } else {
        setSuppliers(prev => [...prev, { ...currentSupplier, id: `temp-${Date.now()}` }]);
    }

    try {
        if (!navigator.onLine) throw new Error("Offline");

        let error;
        if (isEditing) {
            const res = await supabase.from('suppliers').update(payload).eq('id', currentSupplier.id);
            error = res.error;
        } else {
            const res = await supabase.from('suppliers').insert([payload]);
            error = res.error;
        }

        if (error) throw error;
        setCurrentSupplier(emptySupplier);
        fetchSuppliers(); // Pull real ID if inserted
        
    } catch (e) {
        // Queue for offline sync
        setPendingSyncs(prev => [...prev, {
            id: Date.now(),
            table: 'suppliers',
            action: isEditing ? 'UPDATE' : 'INSERT',
            recordId: currentSupplier.id,
            payload: payload
        }]);
        setCurrentSupplier(emptySupplier);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (window.confirm("Are you sure you want to remove this supplier?")) {
      
      // Optimistic UI
      setSuppliers(prev => prev.filter(sup => sup.id !== id));

      try {
          if (!navigator.onLine) throw new Error("Offline");
          const { error } = await supabase.from('suppliers').delete().eq('id', id);
          if (error) throw error;
      } catch (e) {
          setPendingSyncs(prev => [...prev, {
              id: Date.now(),
              table: 'suppliers',
              action: 'DELETE',
              recordId: id
          }]);
      }
    }
  };

  // --- UI HELPERS ---
  const getIcon = (type: string) => {
    if (type === 'Hotel' || type === 'Lodge') return <Building2 size={20} className="text-blue-500" />;
    if (type === 'Flight') return <Plane size={20} className="text-teal-500" />;
    if (type === 'Bus' || type === 'Transport') return <Bus size={20} className="text-orange-500" />;
    return <MapIcon size={20} className="text-green-500" />;
  };

  const handleAddNew = () => {
    setCurrentSupplier(emptySupplier);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = (supplier: any) => {
    setCurrentSupplier(supplier);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const filteredSuppliers = suppliers.filter(sup => 
    sup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sup.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animate-fade-in pb-20 relative">
      {/* HEADER WITH OFFLINE STATUS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold text-teal-900 tracking-tight">Supplier Directory</h1>
            
            {/* 🟢 THE SYNC INDICATOR */}
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
          <p className="text-teal-600/80 font-medium mt-1">Manage B2B contracts, compliance data, and automated pricing.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search partners..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <button onClick={fetchSuppliers} className="bg-white border border-slate-200 text-slate-500 p-2 rounded-xl hover:text-teal-600 transition-colors">
             <RefreshCw size={20} className={loading ? "animate-spin text-teal-600" : ""}/>
          </button>
          <button onClick={handleAddNew} className="bg-teal-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-teal-500/30 flex items-center justify-center gap-2 hover:bg-teal-500 transition-all shrink-0">
            <Plus size={18}/> New Partner
          </button>
        </div>
      </div>

      {/* SUPPLIER TABLE */}
      <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/60 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 text-xs uppercase tracking-widest">
              <th className="p-6 font-bold">Partner Profile</th>
              <th className="p-6 font-bold">Category</th>
              <th className="p-6 font-bold">Primary Contact</th>
              <th className="p-6 font-bold">Pricing Model</th>
              <th className="p-6 font-bold">Contract / Exp.</th>
              <th className="p-6 font-bold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && suppliers.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">Loading Cloud Database...</td></tr>
            ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">No suppliers found.</td></tr>
            ) : filteredSuppliers.map((sup) => (
              <tr key={sup.id} className="hover:bg-white/50 transition-colors group">
                <td className="p-6 font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">{getIcon(sup.type)}</div>
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2">
                        {sup.name}
                        {sup.rating >= 4.5 && <Star size={12} className="text-yellow-400 fill-yellow-400"/>}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">TIN: {sup.taxId || 'N/A'}</span>
                  </div>
                </td>
                <td className="p-6 text-sm font-medium text-slate-600">{sup.type}</td>
                <td className="p-6">
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-700 font-medium">{sup.contact || 'No Email'}</span>
                    <span className="text-[10px] text-slate-400 uppercase mt-0.5">24/7: {sup.emergencyContact || 'None'}</span>
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-teal-700">{sup.currency} {Number(sup.unitPrice).toLocaleString()}</span>
                    <span className="text-[10px] font-bold uppercase text-slate-400">{sup.pricingType}</span>
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex flex-col items-start gap-1">
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full ${sup.status === 'Active Contract' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{sup.status}</span>
                    <span className="text-[10px] text-slate-500 font-bold">{sup.expiryDate ? `Exp: ${sup.expiryDate}` : 'No Expiry Set'}</span>
                  </div>
                </td>
                <td className="p-6 text-center flex items-center justify-center gap-2 mt-2">
                  <button onClick={() => handleEdit(sup)} className="text-teal-600 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 p-2 rounded-lg transition-colors"><Pencil size={18} /></button>
                  <button onClick={() => handleDelete(sup.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADD / EDIT PARTNER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-800">{isEditing ? 'Edit Partner Profile' : 'Add New Partner'}</h2>
                <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mt-1">Supplier Database</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-red-500 border border-slate-200"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              
              {/* SECTION 1: CORE DETAILS */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
                    <Building2 size={16} className="text-teal-600"/> Core Details & Compliance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Partner Name</label>
                      <input type="text" value={currentSupplier.name} onChange={e => setCurrentSupplier({...currentSupplier, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500 font-bold"/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Category</label>
                    <select value={currentSupplier.type} onChange={e => setCurrentSupplier({...currentSupplier, type: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500">
                      <option>Hotel</option><option>Flight</option><option>Bus</option><option>Excursion</option><option>Lodge</option><option>Catering</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Contract Status</label>
                    <select value={currentSupplier.status} onChange={e => setCurrentSupplier({...currentSupplier, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500">
                      <option>Active Contract</option><option>Pending Renewal</option><option>Suspended</option>
                    </select>
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Contract Expiry Date</label>
                      <input type="date" value={currentSupplier.expiryDate} onChange={e => setCurrentSupplier({...currentSupplier, expiryDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500"/>
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Tax ID / Reg. No.</label>
                      <input type="text" value={currentSupplier.taxId} onChange={e => setCurrentSupplier({...currentSupplier, taxId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500" placeholder="TIN..."/>
                  </div>
                </div>
                
                {/* File Upload Placeholder */}
                <div className="mt-4 border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 hover:border-teal-400 hover:text-teal-600 transition-colors cursor-pointer bg-slate-50">
                    <UploadCloud size={24} className="mb-2"/>
                    <span className="text-xs font-bold uppercase">Upload Contract / Tax Certificate</span>
                </div>
              </div>

              {/* SECTION 2: PRICING */}
              <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
                <h3 className="text-sm font-bold text-teal-900 border-b border-teal-100 pb-2 mb-4 flex items-center gap-2">
                    <Tag size={16} className="text-teal-600"/> Contracted Pricing Engine
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-teal-700 uppercase ml-1 mb-1 block">Currency</label>
                    <select value={currentSupplier.currency} onChange={e => setCurrentSupplier({...currentSupplier, currency: e.target.value})} className="w-full bg-white border border-teal-200 p-3 rounded-xl outline-none focus:border-teal-500 font-bold text-teal-900">
                      <option>GHS</option><option>USD</option><option>EUR</option><option>GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-700 uppercase ml-1 mb-1 block">Base Unit Price</label>
                    <input type="number" value={currentSupplier.unitPrice} onChange={e => setCurrentSupplier({...currentSupplier, unitPrice: e.target.value})} placeholder="0.00" className="w-full bg-white border border-teal-200 p-3 rounded-xl outline-none focus:border-teal-500 font-black text-lg text-teal-900"/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-700 uppercase ml-1 mb-1 block">Applied Model</label>
                    <select value={currentSupplier.pricingType} onChange={e => setCurrentSupplier({...currentSupplier, pricingType: e.target.value})} className="w-full bg-white border border-teal-200 p-3 rounded-xl outline-none focus:border-teal-500 text-teal-900 font-bold">
                      <option>Per Passenger</option><option>Per Trip (Flat Rate)</option><option>Per Night/Room</option><option>Per Activity/Ticket</option><option>Custom/Variable</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: CONTACT & LOCATION */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
                    <MapPin size={16} className="text-teal-600"/> Contact & Location
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Primary Email</label>
                      <input type="email" value={currentSupplier.contact} onChange={e => setCurrentSupplier({...currentSupplier, contact: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500" placeholder="manager@partner.com"/>
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-orange-400 uppercase ml-1 mb-1 block">24/7 Ops Phone</label>
                      <input type="tel" value={currentSupplier.emergencyContact} onChange={e => setCurrentSupplier({...currentSupplier, emergencyContact: e.target.value})} className="w-full bg-orange-50 border border-orange-100 p-3 rounded-xl outline-none focus:border-orange-300 text-orange-800" placeholder="Emergency dispatch..."/>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Physical Address</label>
                        <input type="text" value={currentSupplier.address} onChange={e => setCurrentSupplier({...currentSupplier, address: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Service Regions</label>
                        <input type="text" value={currentSupplier.serviceRegions} onChange={e => setCurrentSupplier({...currentSupplier, serviceRegions: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500" placeholder="Accra, Kumasi..." />
                    </div>
                </div>
              </div>

              {/* SECTION 4: FINANCIAL TERMS */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-teal-600"/> Financial Terms & Policies
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Payment Terms</label>
                    <select value={currentSupplier.paymentTerms} onChange={e => setCurrentSupplier({...currentSupplier, paymentTerms: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500">
                      <option>Prepaid (Before Trip)</option><option>On Arrival (Cash)</option><option>Net-15 (Post Trip)</option><option>Net-30 (Post Trip)</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 flex items-center justify-between">
                          <span>Bank / MoMo Details</span>
                          <span className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={currentSupplier.bankVerified} onChange={(e) => setCurrentSupplier({...currentSupplier, bankVerified: e.target.checked})} />
                              <span className="text-teal-600 text-[9px]">VERIFIED?</span>
                          </span>
                      </label>
                      <input type="text" value={currentSupplier.bankDetails} onChange={e => setCurrentSupplier({...currentSupplier, bankDetails: e.target.value})} className={`w-full border p-3 rounded-xl outline-none focus:border-teal-500 ${currentSupplier.bankVerified ? 'border-green-200 bg-green-50' : 'bg-slate-50 border-slate-200'}`} placeholder="Bank Name & Account No."/>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block flex items-center gap-1"><ShieldAlert size={12}/> Cancellation Policy</label>
                      <input type="text" value={currentSupplier.cancellationPolicy} onChange={(e) => setCurrentSupplier({...currentSupplier, cancellationPolicy: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500" placeholder="e.g. 48hr Notice required"/>
                  </div>
                  <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1 block">Performance Rating (1-5)</label>
                      <input 
                          type="number" 
                          min="1" 
                          max="5" 
                          value={currentSupplier.rating} 
                          onChange={(e) => setCurrentSupplier({ ...currentSupplier, rating: Number(e.target.value) })} 
                          className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-teal-500"
                      />
                  </div>
                </div>
              </div>

            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
              <button onClick={handleSaveSupplier} className="w-full py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white">
                {isEditing ? <><Pencil size={20}/> Update Partner Profile</> : <><Plus size={20}/> Save Partner to Directory</>}
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPortal;