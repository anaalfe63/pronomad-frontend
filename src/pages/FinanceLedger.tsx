import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
// 🌟 1. IMPORT THE AUDIT LOGGER
import { logAudit } from '../lib/auditLogger';
import { 
  Wallet, TrendingUp, TrendingDown, CreditCard, Download, Activity, 
  AlertCircle, Plus, X, Receipt, Building2, RefreshCw, Pencil, Trash2, 
  Filter, Calendar, ChevronDown, CloudOff, CloudUpload, FileSpreadsheet
} from 'lucide-react';

// --- TYPES & INTERFACES ---

interface Trip {
  id: string | number;
  title: string;
  start_date: string;
  [key: string]: any;
}

interface Supplier {
  id: string | number;
  name: string;
  type: string;
  [key: string]: any;
}

interface Transaction {
  id: string | number;
  source?: string;
  supplier?: string;
  supplierType?: string;
  date: string;
  name?: string;
  trip: string;
  tripId?: string | number;
  category?: string;
  amount: number;       // Amount actually paid/spent
  totalAmount?: number; // Total cost of the package/invoice
  balance?: number;     // How much is left to pay
  status: string;
  raw: any;
}

interface FinanceSummary {
  totalCollected: number;
  totalExpenses: number;
  outstandingBalance: number;
  netProfit: number;
}

interface ExpenseFormState {
  tripId: string;
  supplierId: string;
  supplierName: string;
  category: string;
  amount: string | number;
  status: string;
  notes: string;
}

interface SyncAction {
  id: number;
  table: string;
  action: 'UPDATE' | 'INSERT' | 'DELETE';
  recordId?: string | number;
  payload?: any;
}

const FinanceLedger: React.FC = () => {
  const { user, settings } = useTenant() as any;
  const isCEO = user?.role === 'CEO' || user?.role === 'owner' || user?.role === 'PROADMIN';
  
  // 🌟 DYNAMIC TENANT SETTINGS
  const APP_COLOR = settings?.theme_color || user?.themeColor || '#10b981'; 
  const BASE_CURRENCY = settings?.currency || user?.currency || 'GHS';
  
  const [activeTab, setActiveTab] = useState<'revenue' | 'expenses'>('revenue');
  const [loading, setLoading] = useState<boolean>(true);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [filterTrip, setFilterTrip] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // --- REAL DATABASE STATE ---
  const [tripsDb, setTripsDb] = useState<Trip[]>([]);
  const [suppliersDb, setSuppliersDb] = useState<Supplier[]>([]);
  
  // --- LEDGER DATA ---
  const [revenueLog, setRevenueLog] = useState<Transaction[]>([]);
  const [expenseLog, setExpenseLog] = useState<Transaction[]>([]);

  // --- EDITING STATE ---
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // --- FINANCIAL SUMMARY ---
  const [finances, setFinances] = useState<FinanceSummary>({
    totalCollected: 0, 
    totalExpenses: 0,
    outstandingBalance: 0,
    netProfit: 0
  });

  // --- FORM STATE ---
  const [newExpense, setNewExpense] = useState<ExpenseFormState>({
    tripId: '', supplierId: '', supplierName: '', category: 'Transport', amount: '', status: 'Unpaid', notes: ''
  });

  // 🟢 OFFLINE SYNC STATE ENGINE
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<SyncAction[]>(() => {
     const saved = localStorage.getItem('pronomad_finance_sync');
     return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
     localStorage.setItem('pronomad_finance_sync', JSON.stringify(pendingSyncs));
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
              console.error("Finance Sync failed:", task.id, e);
              break; 
          }
      }
      
      setPendingSyncs(remaining);
      setIsSyncing(false);
      if (remaining.length === 0) fetchFinancials(); 
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


  // ==================================================================================
  // 1. DATA AGGREGATION ENGINE
  // ==================================================================================
  const fetchFinancials = async () => {
    if (!user?.subscriberId) return;
    setLoading(true);
    try {
      const [tripsRes, supRes, invRes, expRes, bookRes] = await Promise.all([
        supabase.from('trips').select('*').eq('subscriber_id', user.subscriberId),
        supabase.from('suppliers').select('*').eq('subscriber_id', user.subscriberId),
        supabase.from('invoices').select('*').eq('subscriber_id', user.subscriberId),
        supabase.from('expenses').select('*').eq('subscriber_id', user.subscriberId),
        // We pull ALL bookings to see pending revenue, not just those > 0
        supabase.from('bookings').select('*').eq('subscriber_id', user.subscriberId)
      ]);

      const tripsData = tripsRes.data || [];
      const supData = supRes.data || [];
      const invData = invRes.data || [];
      const expData = expRes.data || [];
      const bookingsData = bookRes.data || [];

      setTripsDb(tripsData);
      setSuppliersDb(supData);

      let allRevenue: Transaction[] = [];
      let totalOutstanding = 0;

      // Map Invoices
      invData.forEach((inv: any) => {
        const totalAmount = Number(inv.total_amount || inv.amount || 0);
        const amountPaid = Number(inv.amount_paid || inv.amount || 0);
        const balance = Math.max(0, totalAmount - amountPaid);
        totalOutstanding += balance;
        
        let calculatedStatus = balance === 0 ? 'Full' : (amountPaid > 0 ? 'Partial' : 'Pending');

        allRevenue.push({
          id: inv.id,
          source: 'Invoice',
          date: new Date(inv.created_at).toLocaleDateString(),
          name: inv.client_name || 'Corporate Client',
          trip: inv.project_name || 'General',
          tripId: 'N/A',
          totalAmount: totalAmount,
          amount: amountPaid,
          balance: balance,
          status: calculatedStatus,
          raw: inv
        });
      });

      // Map Bookings
      bookingsData.forEach((booking: any) => {
         const linkedTrip = tripsData.find(t => t.id === booking.trip_id);
         const totalCost = Number(booking.total_cost || 0);
         const amountPaid = Number(booking.amount_paid || 0);
         const balance = Math.max(0, totalCost - amountPaid);
         totalOutstanding += balance;

         // 🌟 STRICT MATH-BASED STATUS RESOLUTION
         let calculatedStatus = 'Pending';
         if (amountPaid >= totalCost && totalCost > 0) calculatedStatus = 'Full';
         else if (amountPaid > 0) calculatedStatus = 'Partial';

         allRevenue.push({
            id: `BK-${booking.id}`, 
            source: 'Booking',
            date: new Date(booking.created_at).toLocaleDateString(), 
            name: booking.customer_name || booking.lead_name,
            trip: linkedTrip ? linkedTrip.title : 'Unknown Trip',
            tripId: booking.trip_id,
            totalAmount: totalCost,
            amount: amountPaid,
            balance: balance,
            status: calculatedStatus,
            raw: booking
         });
      });
      
      // Sort newest first
      allRevenue.sort((a, b) => new Date(b.raw.created_at).getTime() - new Date(a.raw.created_at).getTime());
      setRevenueLog(allRevenue);

      // Map Expenses
      const mappedExpenses: Transaction[] = expData.map((exp: any) => {
        const linkedSup = supData.find((s: Supplier) => s.name === exp.submitter);
        return {
            id: exp.id,
            date: new Date(exp.date || exp.created_at).toLocaleDateString(),
            supplier: exp.submitter,
            supplierType: linkedSup?.type || 'General',
            category: exp.category,
            amount: Number(exp.amount),
            status: exp.status,
            trip: exp.description, 
            raw: exp
        };
      });
      
      mappedExpenses.sort((a, b) => new Date(b.raw.created_at || b.raw.date).getTime() - new Date(a.raw.created_at || a.raw.date).getTime());
      setExpenseLog(mappedExpenses);

      const totalRev = allRevenue.reduce((sum, item) => sum + item.amount, 0);
      const totalExp = mappedExpenses.reduce((sum, item) => sum + item.amount, 0);
      
      setFinances({
        totalCollected: totalRev,
        totalExpenses: totalExp,
        outstandingBalance: totalOutstanding, 
        netProfit: totalRev - totalExp
      });

    } catch (e) {
      console.error("Finance Sync Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.subscriberId) fetchFinancials();
  }, [user]);

  // ==================================================================================
  // 2. ACTIONS WITH OFFLINE SUPPORT
  // ==================================================================================

  const handleSaveExpense = async () => {
    if (!newExpense.supplierName || !newExpense.amount) return alert("Please select Supplier and Amount");

    const payload = {
        subscriber_id: user?.subscriberId,
        submitter: newExpense.supplierName,
        category: newExpense.category,
        description: newExpense.tripId ? `${tripsDb.find(t=>t.id == newExpense.tripId)?.title} - ${newExpense.notes}` : newExpense.notes,
        amount: Number(newExpense.amount),
        status: newExpense.status === 'Paid' ? 'Paid' : 'Pending',
        date: new Date().toISOString()
    };

    const optimisticExp: Transaction = {
        id: editingTx ? editingTx.id : `temp-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        supplier: payload.submitter,
        supplierType: 'General',
        category: payload.category,
        amount: payload.amount,
        status: payload.status,
        trip: payload.description,
        raw: payload
    };

    if (editingTx) {
        setExpenseLog(prev => prev.map(e => e.id === editingTx.id ? optimisticExp : e));
    } else {
        setExpenseLog(prev => [optimisticExp, ...prev]);
    }
    
    setFinances(prev => ({
        ...prev,
        totalExpenses: prev.totalExpenses + (editingTx ? (payload.amount - editingTx.amount) : payload.amount),
        netProfit: prev.netProfit - (editingTx ? (payload.amount - editingTx.amount) : payload.amount)
    }));

    setIsExpenseModalOpen(false);
    setEditingTx(null);
    setNewExpense({ tripId: '', supplierId: '', supplierName: '', category: 'Transport', amount: '', status: 'Unpaid', notes: '' });

    try {
        if (!navigator.onLine) throw new Error("Offline");

        let error;
        if (editingTx) {
            const res = await supabase.from('expenses').update(payload).eq('id', editingTx.id);
            error = res.error;
            
            // 🚨 AUDIT LOG: EXPENSE UPDATED
            if (user?.subscriberId) {
                await logAudit(user.subscriberId, user.fullName || user.username || 'System', user.role, 'Updated Expense', `Updated payment to ${payload.submitter} for ${BASE_CURRENCY} ${payload.amount.toLocaleString()}.`);
            }
        } else {
            const res = await supabase.from('expenses').insert([payload]);
            error = res.error;
            
            // 🚨 AUDIT LOG: EXPENSE RECORDED
            if (user?.subscriberId) {
                await logAudit(user.subscriberId, user.fullName || user.username || 'System', user.role, 'Logged Expense', `Recorded outbound payment to ${payload.submitter} for ${BASE_CURRENCY} ${payload.amount.toLocaleString()}.`);
            }
        }

        if (error) throw error;
        fetchFinancials(); 
    } catch (e) { 
        setPendingSyncs(prev => [...prev, {
            id: Date.now(),
            table: 'expenses',
            action: editingTx ? 'UPDATE' : 'INSERT',
            recordId: editingTx ? editingTx.id : undefined,
            payload: payload
        }]);
    }
  };

  const handleDelete = async (id: string | number, type: 'expense' | 'invoice') => {
      if(!isCEO) return alert("Only Administrators can delete financial records.");
      if(!window.confirm("Delete this record permanently?")) return;

      const table = type === 'expense' ? 'expenses' : 'invoices';

      if (type === 'expense') {
          const removed = expenseLog.find(e => e.id === id);
          setExpenseLog(prev => prev.filter(e => e.id !== id));
          if (removed) {
             setFinances(prev => ({ ...prev, totalExpenses: prev.totalExpenses - removed.amount, netProfit: prev.netProfit + removed.amount }));
          }
      } else {
          const removed = revenueLog.find(r => r.id === id);
          setRevenueLog(prev => prev.filter(r => r.id !== id));
          if (removed) {
             setFinances(prev => ({ ...prev, totalCollected: prev.totalCollected - removed.amount, netProfit: prev.netProfit - removed.amount }));
          }
      }

      try {
          if (!navigator.onLine) throw new Error("Offline");
          const { error } = await supabase.from(table).delete().eq('id', id);
          if (error) throw error;
          
          // 🚨 AUDIT LOG: LEDGER RECORD DELETED
          if (user?.subscriberId) {
              await logAudit(
                  user.subscriberId, 
                  user.fullName || user.username || 'System', 
                  user.role, 
                  'Deleted Financial Record', 
                  `Removed an ${type} from the main ledger.`
              );
          }
      } catch(e) { 
          setPendingSyncs(prev => [...prev, {
              id: Date.now(),
              table: table,
              action: 'DELETE',
              recordId: id
          }]);
      }
  };

  const startEdit = (item: Transaction, type: 'expense' | 'invoice') => {
      if (type === 'expense') {
          setEditingTx(item);
          setNewExpense({
              tripId: '', 
              supplierId: '',
              supplierName: item.supplier || '',
              category: item.category || 'Transport',
              amount: item.amount.toString(),
              status: item.status,
              notes: item.raw.description?.split(' - ').pop() || item.raw.description || ''
          });
          setIsExpenseModalOpen(true);
      } else {
          alert("To edit revenue, please go to the Invoices or Booking module.");
      }
  };

  // 🌟 CSV EXPORT UTILITY
  const handleExportCSV = async () => {
      const data = activeTab === 'revenue' ? revenueLog : expenseLog;
      if (data.length === 0) return alert("No data to export.");

      let csvContent = "data:text/csv;charset=utf-8,";
      
      if (activeTab === 'revenue') {
          csvContent += "Date,Type,Payer,Trip,Total Cost,Amount Paid,Balance Due,Status\n";
          data.forEach(row => {
              const safeName = row.name ? `"${row.name.replace(/"/g, '""')}"` : 'Unknown';
              const safeTrip = row.trip ? `"${row.trip.replace(/"/g, '""')}"` : 'Unknown';
              csvContent += `${row.date},${row.source},${safeName},${safeTrip},${row.totalAmount || 0},${row.amount},${row.balance || 0},${row.status}\n`;
          });
      } else {
          csvContent += "Date,Payee,Category,Description,Amount,Status\n";
          data.forEach(row => {
              const safeSupplier = row.supplier ? `"${row.supplier.replace(/"/g, '""')}"` : 'Unknown';
              const safeDesc = row.trip ? `"${row.trip.replace(/"/g, '""')}"` : 'N/A';
              csvContent += `${row.date},${safeSupplier},${row.category},${safeDesc},${row.amount},${row.status}\n`;
          });
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Pronomad_Ledger_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 🚨 AUDIT LOG: EXPORTED FINANCES
      if (user?.subscriberId) {
          await logAudit(
              user.subscriberId, 
              user.fullName || user.username || 'System', 
              user.role, 
              'Exported Financial Ledger', 
              `Downloaded the ${activeTab} history to CSV.`
          );
      }
  };

  // ==================================================================================
  // 3. UI RENDER
  // ==================================================================================
  
  let filteredRevenue = revenueLog.filter(item => filterTrip === 'All' || item.trip.includes(filterTrip));
  if (filterStatus !== 'All') {
      filteredRevenue = filteredRevenue.filter(item => item.status === filterStatus);
  }
  
  let filteredExpenses = expenseLog.filter(item => filterTrip === 'All' || item.trip?.includes(filterTrip));
  if (filterStatus !== 'All') {
      filteredExpenses = filteredExpenses.filter(item => filterStatus === 'Paid' ? item.status === 'Paid' : item.status !== 'Paid');
  }

  return (
    <div className="animate-fade-in pb-20 relative">
      
      {/* HEADER WITH OFFLINE STATUS */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Finance Ledger</h1>
            
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
          <p className="text-slate-500 font-medium mt-1">Centralized Financial Command.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          
          {/* Trip Filter */}
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2 transition-all focus-within:ring-2" style={{ '--tw-ring-color': APP_COLOR } as any}>
             <Filter size={16} className="text-slate-400"/>
             <select className="bg-transparent outline-none text-sm font-bold text-slate-700" value={filterTrip} onChange={(e) => setFilterTrip(e.target.value)}>
                <option value="All">All Trips</option>
                {tripsDb.map(t => <option key={t.id} value={t.title}>{t.title}</option>)}
             </select>
          </div>

          {/* Status Filter */}
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2 transition-all focus-within:ring-2" style={{ '--tw-ring-color': APP_COLOR } as any}>
             <select className="bg-transparent outline-none text-sm font-bold text-slate-700" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                {activeTab === 'revenue' ? (
                   <><option value="Full">Full Payment</option><option value="Partial">Partial (Deposit)</option><option value="Pending">Pending (Unpaid)</option></>
                ) : (
                   <><option value="Paid">Paid</option><option value="Pending">Unpaid</option></>
                )}
             </select>
          </div>

          <button onClick={handleExportCSV} className="bg-white border border-slate-200 text-slate-500 p-2.5 rounded-xl hover:bg-slate-50 transition-colors" title="Export to CSV">
             <FileSpreadsheet size={18}/>
          </button>
          <button onClick={fetchFinancials} className="bg-white border border-slate-200 text-slate-500 p-2.5 rounded-xl hover:bg-slate-50 transition-colors" title="Sync Data">
             <RefreshCw size={18} className={loading ? "animate-spin" : ""}/>
          </button>

          <button 
            onClick={() => { setEditingTx(null); setIsExpenseModalOpen(true); }} 
            className="text-white px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95 hover:brightness-110"
            style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}
          >
            <Plus size={18}/> Log Expense
          </button>
        </div>
      </header>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}><Wallet size={24} /></div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Revenue Collected</p>
          </div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">
            <span className="text-lg text-slate-400 mr-1">{BASE_CURRENCY}</span>{loading ? '...' : finances.totalCollected.toLocaleString()}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 text-red-700 rounded-xl"><TrendingDown size={24} /></div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Costs</p>
          </div>
          <h2 className="text-3xl font-black text-red-600 tracking-tight">
            <span className="text-lg text-red-300 mr-1">{BASE_CURRENCY}</span>{loading ? '...' : finances.totalExpenses.toLocaleString()}
          </h2>
        </div>

        {/* 🌟 NEW: Receivables KPI Card */}
        <div className="bg-orange-50 p-6 rounded-[2rem] shadow-xl border border-orange-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><AlertCircle size={24} /></div>
            <p className="text-sm font-bold text-orange-700 uppercase tracking-wider">Outstanding Receivables</p>
          </div>
          <h2 className="text-3xl font-black text-orange-600 tracking-tight">
            <span className="text-lg text-orange-300 mr-1">{BASE_CURRENCY}</span>{loading ? '...' : finances.outstandingBalance.toLocaleString()}
          </h2>
        </div>

        <div className={`p-6 rounded-[2rem] shadow-2xl relative overflow-hidden ${finances.netProfit >= 0 ? 'bg-slate-900' : 'bg-red-950'}`}>
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full blur-3xl transition-colors" style={finances.netProfit >= 0 ? { backgroundColor: `${APP_COLOR}30` } : { backgroundColor: 'rgba(239, 68, 68, 0.2)' }}></div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-3 bg-white/10 text-white rounded-xl"><Activity size={24} /></div>
            <p className="text-sm font-bold text-slate-300 uppercase tracking-wider">Net Profit</p>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tight relative z-10">
            <span className="text-lg text-slate-500 mr-1">{BASE_CURRENCY}</span>{loading ? '...' : finances.netProfit.toLocaleString()}
          </h2>
        </div>
      </div>

      {/* LEDGER TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex gap-4 bg-slate-50/50">
          <button 
            onClick={() => setActiveTab('revenue')} 
            className={`font-bold pb-2 border-b-2 transition-all flex items-center gap-2 ${activeTab === 'revenue' ? '' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            style={activeTab === 'revenue' ? { borderColor: APP_COLOR, color: APP_COLOR } : {}}
          >
            <TrendingUp size={18}/> Inbound ({filteredRevenue.length})
          </button>
          <button 
            onClick={() => setActiveTab('expenses')} 
            className={`font-bold pb-2 border-b-2 transition-all flex items-center gap-2 ${activeTab === 'expenses' ? 'border-red-500 text-red-700' : 'border-transparent text-slate-400 hover:text-red-400'}`}
          >
            <Receipt size={18}/> Outbound ({filteredExpenses.length})
          </button>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                <th className="p-6 font-bold">Date</th>
                <th className="p-6 font-bold">{activeTab === 'revenue' ? 'Payer / Source' : 'Supplier / Payee'}</th>
                <th className="p-6 font-bold">Trip / Context</th>
                
                {/* Dynamic Columns based on tab */}
                {activeTab === 'revenue' ? (
                  <>
                    <th className="p-6 font-bold text-right">Total Cost</th>
                    <th className="p-6 font-bold text-right">Amount Paid</th>
                    <th className="p-6 font-bold text-right">Balance Due</th>
                  </>
                ) : (
                  <>
                    <th className="p-6 font-bold">Category</th>
                    <th className="p-6 font-bold text-right">Amount</th>
                  </>
                )}

                <th className="p-6 font-bold text-center">Status</th>
                {isCEO && <th className="p-6 font-bold text-center">Admin</th>}
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-50">
              {activeTab === 'revenue' ? (
                filteredRevenue.map((trx, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-6 text-sm font-bold text-slate-500">{trx.date}</td>
                      <td className="p-6 font-bold text-slate-800 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-sm" style={trx.source === 'Invoice' ? { backgroundColor: '#f3e8ff', color: '#7e22ce' } : { backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}>{trx.source?.charAt(0)}</div>
                        <div>
                            <p>{trx.name}</p>
                            <span className="text-[10px] text-slate-400 uppercase font-normal">{trx.source}</span>
                        </div>
                      </td>
                      <td className="p-6 text-sm font-medium text-slate-600 max-w-[200px] truncate">{trx.trip}</td>
                      
                      {/* 🌟 NEW: The Three Financial Pillars */}
                      <td className="p-6 text-right font-bold text-slate-700 text-sm">{BASE_CURRENCY} {(trx.totalAmount || 0).toLocaleString()}</td>
                      <td className="p-6 text-right font-black text-emerald-600 text-sm">+ {BASE_CURRENCY} {trx.amount.toLocaleString()}</td>
                      <td className="p-6 text-right font-bold text-orange-500 text-sm">{trx.balance && trx.balance > 0 ? `${BASE_CURRENCY} ${trx.balance.toLocaleString()}` : '-'}</td>
                      
                      <td className="p-6 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              trx.status === 'Full' || trx.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                              trx.status === 'Partial' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-500'
                          }`}>
                              {trx.status}
                          </span>
                      </td>
                      {isCEO && <td className="p-6 text-center"><button onClick={() => handleDelete(trx.id, 'invoice')} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>}
                    </tr>
                ))
              ) : (
                filteredExpenses.map((exp, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-6 text-sm font-bold text-slate-500">{exp.date}</td>
                      <td className="p-6 font-bold text-slate-800 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-50 text-red-500"><Building2 size={16}/></div>
                        <div>
                            <p>{exp.supplier}</p>
                            <span className="text-[10px] text-slate-400 uppercase font-normal">{exp.supplierType}</span>
                        </div>
                      </td>
                      <td className="p-6 text-sm font-medium text-slate-600 max-w-[200px] truncate">{exp.trip}</td>
                      <td className="p-6 text-xs font-bold text-slate-700">{exp.category}</td>
                      <td className="p-6 text-right font-black text-red-600 text-lg">- {BASE_CURRENCY} {exp.amount.toLocaleString()}</td>
                      <td className="p-6 text-center">
                          <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full ${exp.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {exp.status}
                          </span>
                      </td>
                      {isCEO && (
                          <td className="p-6 text-center flex gap-2 justify-center">
                              <button onClick={() => startEdit(exp, 'expense')} className="text-slate-300 hover:text-blue-500 transition-colors"><Pencil size={16}/></button>
                              <button onClick={() => handleDelete(exp.id, 'expense')} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                          </td>
                      )}
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXPENSE LOGGING / EDITING MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsExpenseModalOpen(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl z-10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-800">{editingTx ? 'Edit Expense' : 'Log Expense'}</h2>
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mt-1">Outbound Payment</p>
              </div>
              <button onClick={() => setIsExpenseModalOpen(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-red-500 border border-slate-200 transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Trip Dropdown */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Assign to Trip (Operations Link)</label>
                <div className="relative">
                    <select value={newExpense.tripId} onChange={e => setNewExpense({...newExpense, tripId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none mt-1 font-bold text-slate-700 appearance-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                    <option value="">-- General / Overhead --</option>
                    {tripsDb.map(t => (<option key={t.id} value={t.id}>{t.title} ({new Date(t.start_date).toLocaleDateString()})</option>))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16}/>
                </div>
              </div>

              {/* Supplier Dropdown */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Payee / Supplier (Vendor Link)</label>
                <div className="relative">
                    <select value={newExpense.supplierName} onChange={e => setNewExpense({...newExpense, supplierName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none mt-1 font-bold text-slate-700 appearance-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                    <option value="">Select a Partner...</option>
                    {suppliersDb.map(s => (<option key={s.id} value={s.name}>{s.name} ({s.type})</option>))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16}/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Category</label>
                  <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none mt-1 text-sm focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                    <option>Transport / Bus</option><option>Flight Tickets</option><option>Accommodation</option><option>Tour Guide Fee</option><option>Excursion / Tickets</option><option>Food & Catering</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Status</label>
                  <select value={newExpense.status} onChange={e => setNewExpense({...newExpense, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none mt-1 text-red-600 font-bold focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                    <option>Unpaid (Pending)</option><option className="text-green-600">Paid (Cleared)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block">Amount ({BASE_CURRENCY})</label>
                <input type="number" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className="w-full bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl outline-none mt-1 font-black text-2xl focus:border-red-400 transition-colors" placeholder="0.00"/>
              </div>

              <input type="text" value={newExpense.notes} onChange={e => setNewExpense({...newExpense, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 transition-all text-sm" placeholder="Invoice # or Notes (Optional)" style={{ '--tw-ring-color': APP_COLOR } as any}/>

              <button 
                onClick={handleSaveExpense} 
                className="w-full py-4 mt-2 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-white active:scale-95 hover:brightness-110"
                style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}
              >
                <Receipt size={20}/> {editingTx ? 'Update Record' : 'Record Expense'}
              </button>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FinanceLedger;