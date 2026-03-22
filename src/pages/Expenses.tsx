import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, CheckCircle, XCircle, Clock, Plus, DollarSign, 
  TrendingDown, Building2, MapPin, X, FileText, Paperclip, 
  RefreshCcw, AlertCircle, MessageSquare, Wifi, WifiOff, CloudOff, CloudUpload } from 'lucide-react';
// 🟢 Swapped Auth Engine
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
// 🌟 1. IMPORT THE AUDIT LOGGER
import { logAudit } from '../lib/auditLogger';

// --- TYPES & INTERFACES ---

interface Expense {
  id: string | number;
  title: string;
  category: string;
  amount: number | string;
  currency: string;
  paidBy: string;
  paymentMethod?: string;
  receiptRef: string;
  tripId?: string | number;
  supplierName?: string;
  notes?: string;
  status: string;
  submitter?: string;
  financeNote?: string;
  description?: string; 
}

interface NewExpenseState {
  title: string;
  category: string;
  amount: string;
  currency: string;
  paidBy: string;
  paymentMethod: string;
  receiptRef: string;
  tripId: string;
  supplierName: string;
  notes: string;
}

interface Trip {
  id: string | number;
  title: string;
  [key: string]: any;
}

interface Supplier {
  id: string | number;
  name: string;
  [key: string]: any;
}

// 🟢 THE OFFLINE ACTION INTERFACE
interface SyncAction {
  id: number;
  table: string;
  action: 'UPDATE' | 'INSERT' | 'DELETE';
  recordId?: string | number;
  payload?: any;
}

const Expenses: React.FC = () => {
  const { user } = useTenant();
  
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [tripsDb, setTripsDb] = useState<Trip[]>([]);
  const [suppliersDb, setSuppliersDb] = useState<Supplier[]>([]);

  // Submit Expense Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [newExpense, setNewExpense] = useState<NewExpenseState>({
    title: '', category: 'Operational', amount: '', currency: 'GHS', 
    paidBy: 'Company Account', paymentMethod: 'MoMo', receiptRef: '',
    tripId: '', supplierName: '', notes: ''
  });

  // Finance Action Desk State
  const [isActionModalOpen, setIsActionModalOpen] = useState<boolean>(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [rejectionNote, setRejectionNote] = useState<string>('');

  // 🟢 OFFLINE SYNC STATE ENGINE
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<SyncAction[]>(() => {
     const saved = localStorage.getItem('pronomad_expense_sync');
     return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
     localStorage.setItem('pronomad_expense_sync', JSON.stringify(pendingSyncs));
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
              }
              remaining.shift();
          } catch (e) {
              console.error("Expense Sync failed:", task.id, e);
              break; 
          }
      }
      
      setPendingSyncs(remaining);
      setIsSyncing(false);
      if (remaining.length === 0) fetchExpenses(); 
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

  // --- 1. FETCH FROM SUPABASE ---
  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      if (!user?.subscriberId) return;

      const [expRes, tripsRes, supRes] = await Promise.all([
          supabase.from('expenses').select('*').eq('subscriber_id', user.subscriberId).order('created_at', { ascending: false }),
          supabase.from('trips').select('*').eq('subscriber_id', user.subscriberId),
          supabase.from('suppliers').select('*').eq('subscriber_id', user.subscriberId)
      ]);

      if (tripsRes.data) setTripsDb(tripsRes.data);
      if (supRes.data) setSuppliersDb(supRes.data);

      if (expRes.data) {
        const formattedExpenses: Expense[] = expRes.data.map((exp: any) => ({
          ...exp,
          title: exp.description, 
          currency: exp.currency || 'GHS',
          paidBy: exp.paid_by || 'Company Account',
          receiptRef: exp.receipt_ref || `REF-${String(exp.id).split('-')[0]?.toUpperCase() || 'NA'}`
        }));
        setExpenses(formattedExpenses);
      }
    } catch (error) {
      console.error("Database connection error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.subscriberId) fetchExpenses();
  }, [user?.subscriberId]);

  // --- 2. OFFLINE-FIRST SAVE ---
  const handleSubmitExpense = async () => {
    if (!newExpense.title || !newExpense.amount) return alert("Title and Amount are required.");

    const payload = {
      subscriber_id: user?.subscriberId,
      submitter: user?.fullName || 'Staff Member',
      category: newExpense.category,
      description: newExpense.title, 
      amount: Number(newExpense.amount),
      currency: newExpense.currency,
      paid_by: newExpense.paidBy,
      payment_method: newExpense.paymentMethod,
      receipt_ref: newExpense.receiptRef,
      trip_id: newExpense.tripId || null,
      supplier_name: newExpense.supplierName,
      notes: newExpense.notes,
      status: 'Pending'
    };

    // Optimistic UI Update
    const optimisticExpense: Expense = {
      id: `EXP-OFFLINE-${Date.now()}`,
      ...payload,
      title: payload.description,
      paidBy: payload.paid_by,
      receiptRef: payload.receipt_ref || 'Pending Sync'
    };
    
    setExpenses([optimisticExpense, ...expenses]);
    setIsSubmitModalOpen(false);
    setNewExpense({ title: '', category: 'Operational', amount: '', currency: 'GHS', paidBy: 'Company Account', paymentMethod: 'MoMo', receiptRef: '', tripId: '', supplierName: '', notes: '' });

    try {
        if (!navigator.onLine) throw new Error("Offline");
        const { error } = await supabase.from('expenses').insert([payload]);
        if (error) throw error;
        
        // 🚨 2. AUDIT LOG: EXPENSE SUBMITTED
        if (user?.subscriberId) {
            await logAudit(
                user.subscriberId, 
                user.fullName || user.username || 'System', 
                user.role, 
                'Submitted Expense Claim', 
                `Requested ${payload.currency} ${payload.amount.toLocaleString()} for "${payload.description}". Paid via: ${payload.paid_by}.`
            );
        }

        fetchExpenses(); 
    } catch (error) {
        setPendingSyncs(prev => [...prev, {
            id: Date.now(),
            table: 'expenses',
            action: 'INSERT',
            payload: payload
        }]);
    }
  };

  // --- 3. FINANCE REVIEW DESK ---
  const openActionDesk = (exp: Expense) => {
    setSelectedExpense(exp);
    setRejectionNote('');
    setIsActionModalOpen(true);
  };

  const processExpense = async (actionStatus: string) => {
    if (!selectedExpense) return;
    if (actionStatus === 'Rejected' && !rejectionNote) return alert("Please provide a reason for rejection.");

    const payload = { 
        status: actionStatus,
        finance_note: actionStatus === 'Rejected' ? rejectionNote : null
    };

    // Optimistic Update
    setExpenses(prev => prev.map(e => e.id === selectedExpense.id ? { ...e, status: actionStatus, financeNote: payload.finance_note || undefined } : e));
    setIsActionModalOpen(false);

    try {
      if (!navigator.onLine) throw new Error("Offline");
      const { error } = await supabase.from('expenses').update(payload).eq('id', selectedExpense.id);
      if (error) throw error;

      // 🚨 3. AUDIT LOG: FINANCE DECISION
      if (user?.subscriberId) {
          await logAudit(
              user.subscriberId, 
              user.fullName || user.username || 'System', 
              user.role, 
              `${actionStatus} Expense Claim`, 
              `Marked expense ID ${String(selectedExpense.id).slice(0,8)} as ${actionStatus}. Amount: ${selectedExpense.currency} ${Number(selectedExpense.amount).toLocaleString()}. Note: ${payload.finance_note || 'None'}`
          );
      }

    } catch (error) {
      setPendingSyncs(prev => [...prev, {
          id: Date.now(),
          table: 'expenses',
          action: 'UPDATE',
          recordId: selectedExpense.id,
          payload: payload
      }]);
    }
  };

  const filteredExpenses = expenses.filter(exp => activeTab === 'all' ? true : exp.status.toLowerCase() === activeTab);
  const pendingCount = expenses.filter(e => e.status === 'Pending').length;
  
  const reimbursementLiability = expenses
    .filter(e => e.status === 'Pending' && e.paidBy === 'Employee (Out of pocket)')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  // 🌟 FALLBACK COLOR FOR UI
  const APP_COLOR = '#0d9488'; // Teal

  return (
    <div className="animate-fade-in pb-20 relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-extrabold text-teal-900 tracking-tight">Accounts Payable</h1>
          {/* 🟢 THE SYNC INDICATOR */}
          {pendingSyncs.length > 0 ? (
               <div className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest cursor-pointer" onClick={processSyncQueue}>
                  {isSyncing ? <RefreshCcw size={14} className="animate-spin"/> : <CloudOff size={14}/>}
                  {pendingSyncs.length} Pending
               </div>
          ) : (
               <div className="flex items-center gap-1 text-slate-300" title="Cloud Synced">
                  <CloudUpload size={20}/>
               </div>
          )}
        </div>
        <button onClick={() => setIsSubmitModalOpen(true)} className="text-white px-5 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all shrink-0 active:scale-95" style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}>
          <Plus size={18}/> Submit Request
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-lg border border-white/60 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Awaiting Review</p>
            <p className="text-2xl font-black text-slate-800">{pendingCount} <span className="text-sm font-bold text-slate-400">Requests</span></p>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-lg border border-white/60 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <RefreshCcw size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pending Reimbursements</p>
            <p className="text-2xl font-black text-slate-800"><span className="text-base text-slate-400 mr-1">GHS</span>{reimbursementLiability.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-4 mb-6 border-b border-slate-200 pb-4 overflow-x-auto">
        {['pending', 'approved', 'rejected', 'all'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`font-bold pb-2 border-b-2 transition-all capitalize whitespace-nowrap ${activeTab === tab ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-teal-500'}`} style={activeTab === tab ? { borderColor: APP_COLOR, color: APP_COLOR } : {}}>
            {tab} Expenses
          </button>
        ))}
      </div>

      {/* EXPENSE TABLE */}
      <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/60 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 text-xs uppercase tracking-widest">
              <th className="p-6 font-bold">Request Details</th>
              <th className="p-6 font-bold">Payer / Receipt</th>
              <th className="p-6 font-bold">Trip / Link</th>
              <th className="p-6 font-bold text-right">Amount</th>
              <th className="p-6 font-bold">Status</th>
              <th className="p-6 font-bold text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && expenses.length === 0 ? (
               <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold">Syncing from Database...</td></tr>
            ) : filteredExpenses.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold">No expenses found.</td></tr>
            ) : (
              filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50 transition-colors group">
                  
                  {/* Core Details */}
                  <td className="p-6">
                    <p className="font-black text-slate-800 text-base">{exp.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] uppercase font-black rounded">{exp.category}</span>
                      <span className="text-xs text-slate-400 font-medium">By {exp.submitter}</span>
                    </div>
                  </td>

                  {/* Payment Source & Receipt */}
                  <td className="p-6">
                    {exp.paidBy === 'Employee (Out of pocket)' ? (
                      <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-md flex items-center gap-1 w-max mb-1"><RefreshCcw size={12}/> Needs Reimbursement</span>
                    ) : (
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mb-1"><Building2 size={12}/> Paid via Company</span>
                    )}
                    {exp.receiptRef ? (
                      <p className="text-xs text-teal-600 font-bold flex items-center gap-1" style={{ color: APP_COLOR }}><Paperclip size={12}/> {exp.receiptRef}</p>
                    ) : (
                      <p className="text-[10px] text-red-400 font-bold flex items-center gap-1 uppercase"><AlertCircle size={10}/> No Receipt</p>
                    )}
                  </td>
                  
                  {/* Links */}
                  <td className="p-6">
                    {exp.tripId ? <p className="text-sm font-bold text-teal-700 flex items-center gap-1 truncate max-w-[150px]"><MapPin size={14} className="shrink-0"/> {tripsDb.find(t => String(t.id) === String(exp.tripId))?.title}</p> : <p className="text-xs font-bold text-slate-400 uppercase">General</p>}
                    {exp.supplierName && <p className="text-xs text-slate-500 mt-1 truncate max-w-[150px]">To: {exp.supplierName}</p>}
                  </td>
                  
                  {/* Amount */}
                  <td className="p-6 font-black text-slate-800 text-right text-lg">
                    <span className="text-xs text-slate-400 mr-1">{exp.currency}</span>{Number(exp.amount).toLocaleString()}
                  </td>
                  
                  {/* Status & Notes */}
                  <td className="p-6">
                    <span className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full w-max flex items-center gap-1
                      ${exp.status === 'Pending' ? 'bg-orange-100 text-orange-700' : exp.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {exp.status === 'Pending' && <Clock size={12}/>}
                      {exp.status === 'Approved' && <CheckCircle size={12}/>}
                      {exp.status === 'Rejected' && <XCircle size={12}/>}
                      {exp.status}
                    </span>
                    {exp.financeNote && exp.status === 'Rejected' && (
                      <p className="text-[10px] text-red-600 font-bold mt-2 flex items-center gap-1 truncate max-w-[150px]" title={exp.financeNote}><MessageSquare size={10}/> {exp.financeNote}</p>
                    )}
                  </td>
                  
                  {/* Actions */}
                  <td className="p-6 text-center">
                    {exp.status === 'Pending' && (user?.role === 'CEO' || user?.role === 'owner' || user?.role === 'Finance' || user?.role === 'PROADMIN') ? (
                      <button onClick={() => openActionDesk(exp)} className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl transition-all shadow-md">Review</button>
                    ) : (
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Locked</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: SUBMIT NEW EXPENSE */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSubmitModalOpen(false)}></div>
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-800">Submit Expense Report</h2>
                <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: APP_COLOR }}>Proof of Purchase</p>
              </div>
              <button onClick={() => setIsSubmitModalOpen(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-red-500 border border-slate-200"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4">What was purchased?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <input type="text" value={newExpense.title} onChange={e => setNewExpense({...newExpense, title: e.target.value})} placeholder="e.g. Emergency Bus Repair, Toll Fees..." className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold outline-none focus:ring-2" style={{ '--tw-ring-color': APP_COLOR } as any}/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Category</label>
                    <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none font-bold text-slate-600 focus:ring-2" style={{ '--tw-ring-color': APP_COLOR } as any}>
                      <option>Operational / Field</option><option>Transport / Fuel</option><option>Accommodation</option><option>Meals / Guest Recovery</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Receipt / Invoice Ref No.</label>
                    <input type="text" value={newExpense.receiptRef} onChange={e => setNewExpense({...newExpense, receiptRef: e.target.value})} placeholder="INV-2044" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2" style={{ '--tw-ring-color': APP_COLOR } as any}/>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                <h3 className="text-sm font-bold text-orange-900 border-b border-orange-200/50 pb-2 mb-4">Financial Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-orange-600 uppercase ml-2 block mb-1">Currency</label>
                    <select value={newExpense.currency} onChange={e => setNewExpense({...newExpense, currency: e.target.value})} className="w-full bg-white border border-orange-200 p-3 rounded-xl outline-none font-black text-slate-800 focus:ring-2 ring-orange-500/20">
                      <option>GHS</option><option>USD</option><option>EUR</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-orange-600 uppercase ml-2 block mb-1">Total Amount</label>
                    <input type="number" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} placeholder="0.00" className="w-full bg-white border border-orange-200 p-3 rounded-xl outline-none font-black text-xl text-slate-800 focus:ring-2 ring-orange-500/20"/>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-[10px] font-bold text-orange-600 uppercase ml-2 block mb-1">Who paid for this?</label>
                    <select value={newExpense.paidBy} onChange={e => setNewExpense({...newExpense, paidBy: e.target.value})} className="w-full bg-white border border-orange-200 p-3 rounded-xl outline-none font-bold text-slate-700 focus:ring-2 ring-orange-500/20">
                      <option>Company Account</option>
                      <option>Employee (Out of pocket)</option>
                    </select>
                    {newExpense.paidBy === 'Employee (Out of pocket)' && <p className="text-[10px] text-blue-600 mt-1 font-bold italic ml-2">This will trigger a reimbursement claim.</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-orange-600 uppercase ml-2 block mb-1">Payment Method Used</label>
                    <select value={newExpense.paymentMethod} onChange={e => setNewExpense({...newExpense, paymentMethod: e.target.value})} className="w-full bg-white border border-orange-200 p-3 rounded-xl outline-none text-sm font-medium focus:ring-2 ring-orange-500/20">
                      <option>MoMo</option><option>Cash / Petty Cash</option><option>Corporate Card</option><option>Bank Transfer</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
              <button onClick={handleSubmitExpense} className="w-full py-4 rounded-2xl font-bold shadow-lg text-white flex justify-center items-center gap-2 transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}>
                <FileText size={18}/> Send to Finance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FINANCE ACTION DESK */}
      {isActionModalOpen && selectedExpense && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsActionModalOpen(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl z-10 overflow-hidden flex flex-col">
            
            <div className="bg-slate-900 text-white p-6 shrink-0 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <h2 className="text-xl font-black">Finance Review Desk</h2>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Expense ID: {String(selectedExpense.id).slice(0,8)}</p>
                </div>
                <button onClick={() => setIsActionModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
              </div>
            </div>

            <div className="p-6 space-y-4 bg-slate-50">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Requested By</p>
                <p className="font-bold text-slate-800">{selectedExpense.submitter}</p>
                
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 mt-4">Description</p>
                <p className="font-bold text-slate-800">{selectedExpense.title}</p>
                
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase">{selectedExpense.paidBy}</span>
                  <span className="text-2xl font-black text-slate-800">{selectedExpense.currency} {Number(selectedExpense.amount).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Dispute / Rejection Reason (Required for Reject)</label>
                <input type="text" value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} placeholder="e.g. Missing receipt, amount too high..." className="w-full bg-white border border-slate-200 focus:border-red-400 p-3 rounded-xl outline-none text-sm font-medium transition-colors"/>
              </div>

            </div>

            <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
              <button onClick={() => processExpense('Approved')} className="w-full py-4 rounded-2xl font-bold shadow-lg bg-green-500 hover:bg-green-600 text-white flex justify-center items-center gap-2 active:scale-95 transition-all">
                <CheckCircle size={18}/> Approve & Add to Ledger
              </button>
              <button onClick={() => processExpense('Rejected')} className="w-full py-3 rounded-2xl font-bold bg-red-50 text-red-600 hover:bg-red-100 flex justify-center items-center gap-2 transition-colors">
                <XCircle size={18}/> Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Expenses;