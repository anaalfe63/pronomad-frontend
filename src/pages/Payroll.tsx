import React, { useState, useEffect, useCallback } from 'react';
// 🟢 Swapped Auth Engine
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
// 🌟 1. IMPORT THE AUDIT LOGGER
import { logAudit } from '../lib/auditLogger';
import { 
  CheckCircle, Clock, Play, Wallet, TrendingUp, FileText, 
  Edit3, X, RefreshCw, Plus, Trash2, Receipt, Send,
  CloudOff, CloudUpload
} from 'lucide-react';

interface Adjustment {
  id: string;
  name: string;
  type: 'Earning' | 'Deduction';
  amount: number | string;
}

interface PayrollRecord {
  id: string | number;
  staff_id: string | number;
  staff_name: string;
  role: string;
  base_salary: number | string;
  bonus: number | string;
  deductions: number | string;
  net_pay: number | string;
  status: string;
  adjustments: Adjustment[];
}

// 🟢 OFFLINE SYNC TYPE
interface SyncAction {
  id: number;
  table: string;
  action: 'UPDATE' | 'INSERT' | 'DELETE' | 'INSERT_MANY';
  recordId?: string | number;
  payload?: any;
}

const getCurrentMonthString = () => {
    const date = new Date();
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const Payroll: React.FC = () => {
  const { user } = useTenant();
  const [payrollRun, setPayrollRun] = useState<string>(getCurrentMonthString());
  const [staffPayroll, setStaffPayroll] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Payslip Builder State
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState<boolean>(false);
  const [selectedStaff, setSelectedStaff] = useState<PayrollRecord | null>(null);
  const [activeAdjustments, setActiveAdjustments] = useState<Adjustment[]>([]);

  // 🟢 OFFLINE SYNC STATE ENGINE
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<SyncAction[]>(() => {
     const saved = localStorage.getItem('pronomad_payroll_sync');
     return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
     localStorage.setItem('pronomad_payroll_sync', JSON.stringify(pendingSyncs));
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
              } else if (task.action === 'INSERT_MANY') {
                  const { error } = await supabase.from(task.table).insert(task.payload);
                  if (error) throw error;
              } else if (task.action === 'UPDATE') {
                  const { error } = await supabase.from(task.table).update(task.payload).eq('id', task.recordId);
                  if (error) throw error;
              }
              remaining.shift();
          } catch (e) {
              console.error("Payroll Sync failed:", task.id, e);
              break; 
          }
      }
      
      setPendingSyncs(remaining);
      setIsSyncing(false);
      if (remaining.length === 0) fetchPayroll(); 
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
  const fetchPayroll = async () => {
    setLoading(true);
    try {
      if (!user?.subscriberId) return;

      const { data, error } = await supabase
          .from('payroll')
          .select('*')
          .eq('subscriber_id', user.subscriberId)
          .eq('payroll_month', payrollRun);

      if (!error && data) {
          setStaffPayroll(data);
      }
    } catch (error) { console.error("Failed to fetch payroll", error); } 
    finally { setLoading(false); }
  };

  useEffect(() => { if (user?.subscriberId) fetchPayroll(); }, [payrollRun, user?.subscriberId]);

  // --- 2. GENERATE PAYROLL (SERVERLESS CLIENT-SIDE) ---
  const handleGeneratePayroll = async () => {
    if (!window.confirm(`Generate draft payroll for all active staff for ${payrollRun}?`)) return;
    if (!user?.subscriberId) return;
    
    setIsGenerating(true);
    try {
      
      const { data: existing } = await supabase.from('payroll').select('staff_id').eq('subscriber_id', user.subscriberId).eq('payroll_month', payrollRun);
      const existingIds = existing?.map(e => e.staff_id) || [];

      // B. Get all active staff
      const { data: staff } = await supabase.from('staff').select('*').eq('subscriber_id', user.subscriberId);
      
      if (!staff) throw new Error("Could not fetch staff");

      // C. Filter out staff who already have a payslip this month
      const toInsert = staff
        .filter(s => !existingIds.includes(s.id))
        .map(s => ({
            subscriber_id: user.subscriberId,
            payroll_month: payrollRun,  
            staff_id: s.id,
            staff_name: s.name || s.full_name || 'Unnamed Staff',
            role: s.role || 'Staff',
            base_salary: Number(s.salary || 0),
            bonus: 0,
            deductions: 0,
            net_pay: Number(s.salary || 0),
            status: 'Pending',
            adjustments: []
        }));

      if (toInsert.length === 0) {
          alert(`Payroll already generated for all active staff for ${payrollRun}.`);
          setIsGenerating(false);
          return;
      }

      // Optimistic UI
      const optimisticRecords = toInsert.map((rec, idx) => ({ ...rec, id: `temp-${Date.now()}-${idx}` }));
      setStaffPayroll([...staffPayroll, ...optimisticRecords]);

      // D. Save to Supabase (or Offline Queue)
      if (navigator.onLine) {
          const { error } = await supabase.from('payroll').insert(toInsert);
          if (error) throw error;
          fetchPayroll();
          
          // 🚨 2. AUDIT LOG: PAYROLL GENERATED
          await logAudit(
              user.subscriberId,
              user.fullName || user.username || 'System',
              user.role,
              'Generated Monthly Payroll',
              `Drafted ${toInsert.length} new payslips for the ${payrollRun} payroll cycle.`
          );

          alert(`${toInsert.length} payslips drafted!`);
      } else {
          setPendingSyncs(prev => [...prev, {
              id: Date.now(),
              table: 'payroll',
              action: 'INSERT_MANY',
              payload: toInsert
          }]);
          alert(`Offline: ${toInsert.length} payslips queued for sync.`);
      }
    } catch (error: any) { 
      console.error("PAYROLL CRASH:", error);
      alert(`Database Error: ${error.message || "Check the console for details"}`); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  // --- PAYSLIP BUILDER LOGIC ---
  const openPayslipEditor = (staff: PayrollRecord) => {
      setSelectedStaff(staff);
      if (staff.adjustments && staff.adjustments.length > 0) {
          setActiveAdjustments(staff.adjustments);
      } else {
          setActiveAdjustments([
              { id: '1', name: 'SSNIT (Tier 1 & 2)', type: 'Deduction', amount: 0 },
              { id: '2', name: 'Income Tax (GRA)', type: 'Deduction', amount: 0 },
              { id: '3', name: 'Tour Allowance / Per Diem', type: 'Earning', amount: 0 }
          ]);
      }
      setIsPayslipModalOpen(true);
  };

  const handleAddAdjustment = () => {
      setActiveAdjustments([...activeAdjustments, { id: Date.now().toString(), name: '', type: 'Deduction', amount: 0 }]);
  };

  const handleUpdateAdjustment = (id: string, field: keyof Adjustment, value: any) => {
      setActiveAdjustments(activeAdjustments.map(adj => adj.id === id ? { ...adj, [field]: value } : adj));
  };

  const handleRemoveAdjustment = (id: string) => {
      setActiveAdjustments(activeAdjustments.filter(adj => adj.id !== id));
  };

  const savePayslip = async () => {
      if (!selectedStaff || !user?.subscriberId) return;
      
      const newBonus = activeAdjustments.filter(a => a.type === 'Earning').reduce((sum, a) => sum + Number(a.amount), 0);
      const newDeductions = activeAdjustments.filter(a => a.type === 'Deduction').reduce((sum, a) => sum + Number(a.amount), 0);
      const newNetPay = Number(selectedStaff.base_salary) + newBonus - newDeductions;

      const payload = {
          adjustments: activeAdjustments,
          bonus: newBonus,
          deductions: newDeductions,
          net_pay: newNetPay
      };

      // Optimistic UI
      setStaffPayroll(prev => prev.map(s => s.id === selectedStaff.id ? { ...s, ...payload } : s));
      setIsPayslipModalOpen(false);

      try {
          if (!navigator.onLine) throw new Error("Offline");
          const { error } = await supabase.from('payroll').update(payload).eq('id', selectedStaff.id);
          if (error) throw error;
          
          // 🚨 3. AUDIT LOG: PAYSLIP EDITED
          await logAudit(
              user.subscriberId,
              user.fullName || user.username || 'System',
              user.role,
              'Updated Payslip',
              `Adjusted payslip for ${selectedStaff.staff_name}. Net Pay set to: ₵${newNetPay.toLocaleString()}`
          );

      } catch (e) { 
          setPendingSyncs(prev => [...prev, {
              id: Date.now(), table: 'payroll', action: 'UPDATE', recordId: selectedStaff.id, payload: payload
          }]);
      }
  };

  const updateStatus = async (id: string | number, newStatus: string) => {
    if (!window.confirm(`Mark this salary as ${newStatus}?`)) return;
    
    // Find staff name for audit log
    const staffMember = staffPayroll.find(s => s.id === id);

    // Optimistic UI
    setStaffPayroll(staffPayroll.map(staff => staff.id === id ? { ...staff, status: newStatus } : staff));
    
    try {
        if (!navigator.onLine) throw new Error("Offline");
        const { error } = await supabase.from('payroll').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        
        // 🚨 4. AUDIT LOG: INDIVIDUAL DISBURSEMENT
        if (user?.subscriberId && staffMember) {
            await logAudit(
                user.subscriberId,
                user.fullName || user.username || 'System',
                user.role,
                'Disbursed Salary',
                `Marked salary as ${newStatus} for ${staffMember.staff_name} (₵${Number(staffMember.net_pay).toLocaleString()}).`
            );
        }

    } catch(e) { 
        setPendingSyncs(prev => [...prev, {
            id: Date.now(), table: 'payroll', action: 'UPDATE', recordId: id, payload: { status: newStatus }
        }]); 
    }
  };

  const bulkDisburse = async () => {
      const pendingStaff = staffPayroll.filter(s => s.status !== 'Paid');
      if (pendingStaff.length === 0) return alert("All staff are already marked as Paid for this month.");
      if (!window.confirm(`Are you sure you want to mark ${pendingStaff.length} pending payslips as PAID?`)) return;
      
      // Calculate total disbursed for audit log
      const totalDisbursed = pendingStaff.reduce((sum, s) => sum + Number(s.net_pay), 0);

      // Optimistic UI
      setStaffPayroll(staffPayroll.map(s => s.status !== 'Paid' ? { ...s, status: 'Paid' } : s));

      for (const staff of pendingStaff) {
          try {
              if (!navigator.onLine) throw new Error("Offline");
              await supabase.from('payroll').update({ status: 'Paid' }).eq('id', staff.id);
          } catch(e) {
              setPendingSyncs(prev => [...prev, {
                  id: Date.now() + Math.random(), table: 'payroll', action: 'UPDATE', recordId: staff.id, payload: { status: 'Paid' }
              }]);
          }
      }

      // 🚨 5. AUDIT LOG: BULK DISBURSEMENT
      if (user?.subscriberId) {
          await logAudit(
              user.subscriberId,
              user.fullName || user.username || 'System',
              user.role,
              'Bulk Disbursed Payroll',
              `Marked ${pendingStaff.length} payslips as PAID for ${payrollRun}. Total value: ₵${totalDisbursed.toLocaleString()}.`
          );
      }
  };

  // KPIs
  const totalPayroll = staffPayroll.reduce((sum, s) => sum + Number(s.net_pay), 0);
  const totalPaid = staffPayroll.filter(s => s.status === 'Paid').reduce((sum, s) => sum + Number(s.net_pay), 0);
  const totalPending = totalPayroll - totalPaid;

  // Live Modal Calculations
  const modalEarnings = activeAdjustments.filter(a => a.type === 'Earning').reduce((sum, a) => sum + Number(a.amount), 0);
  const modalDeductions = activeAdjustments.filter(a => a.type === 'Deduction').reduce((sum, a) => sum + Number(a.amount), 0);
  const modalNetPay = selectedStaff ? Number(selectedStaff.base_salary) + modalEarnings - modalDeductions : 0;

  return (
    <div className="animate-fade-in pb-20 relative">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-teal-500/10 rounded-xl"><Wallet size={28} className="text-teal-600" /></div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Payroll Engine</h1>
            
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
          <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
             Process salaries, automated commissions, and strict tax deductions.
          </p>
        </div>
        
        <div className="flex gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <select 
            value={payrollRun} 
            onChange={(e) => setPayrollRun(e.target.value)} 
            className="bg-slate-50 border border-slate-100 px-6 py-3 rounded-xl outline-none focus:border-teal-500 font-black text-slate-700 cursor-pointer"
          >
            <option>{getCurrentMonthString()}</option>
            {[1, 2, 3].map(i => {
                const d = new Date(); d.setMonth(d.getMonth() - i);
                const str = d.toLocaleString('default', { month: 'long', year: 'numeric' });
                return <option key={i} value={str}>{str}</option>
            })}
          </select>
          <button onClick={handleGeneratePayroll} disabled={isGenerating} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black shadow-lg flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-70">
            {isGenerating ? <RefreshCw size={18} className="animate-spin"/> : <Play size={18}/>} 
            {isGenerating ? 'Scanning...' : 'Run Payroll Engine'}
          </button>
        </div>
      </div>

      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden group md:col-span-2">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-slate-50 rounded-full blur-3xl transition-colors"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Monthly Liability</p>
          <h2 className="text-4xl font-black text-slate-800 relative z-10"><span className="text-xl text-slate-400 mr-1">₵</span>{totalPayroll.toLocaleString()}</h2>
          <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs font-bold bg-slate-50 w-fit px-3 py-1.5 rounded-lg relative z-10">
              <FileText size={14}/> {staffPayroll.length} Staff on ledger
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-orange-50 rounded-full blur-3xl group-hover:bg-orange-100 transition-colors"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Pending</p>
          <h2 className="text-3xl font-black text-orange-600 relative z-10"><span className="text-lg text-orange-300 mr-1">₵</span>{totalPending.toLocaleString()}</h2>
        </div>

        <div className="bg-teal-900 p-6 rounded-[2rem] shadow-lg relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-teal-500/20 rounded-full blur-3xl"></div>
          <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-2 relative z-10">Cleared</p>
          <h2 className="text-3xl font-black text-white relative z-10"><span className="text-lg text-teal-400 mr-1">₵</span>{totalPaid.toLocaleString()}</h2>
        </div>
      </div>

      {/* PAYROLL TABLE */}
      <div className="bg-white/70 backdrop-blur-xl rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Bulk Actions Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-black text-slate-800">Master Ledger: {payrollRun}</h3>
            <button onClick={bulkDisburse} className="bg-green-100 hover:bg-green-200 text-green-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
                <Send size={14}/> Bulk Disburse Pending
            </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="text-slate-400 text-[10px] uppercase tracking-widest bg-white">
                <th className="p-6 font-black border-b border-slate-100">Staff Member</th>
                <th className="p-6 font-black border-b border-slate-100">Base Salary</th>
                <th className="p-6 font-black border-b border-slate-100">Adjustments</th>
                <th className="p-6 font-black text-teal-700 border-b border-slate-100">Net Pay</th>
                <th className="p-6 font-black border-b border-slate-100">Status</th>
                <th className="p-6 font-black text-center border-b border-slate-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && staffPayroll.length === 0 ? (
                  <tr><td colSpan={6} className="p-12 text-center text-teal-600 font-bold animate-pulse"><RefreshCw className="inline animate-spin mr-2"/> Syncing Ledger...</td></tr> 
              ) : staffPayroll.length === 0 ? (
                  <tr>
                      <td colSpan={6} className="p-16 text-center">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><FileText size={32}/></div>
                          <p className="text-slate-800 font-black text-xl mb-2">No records for {payrollRun}</p>
                          <p className="text-slate-500 font-medium max-w-sm mx-auto">Click "Run Payroll Engine" to automatically scan HR records and draft the ledger.</p>
                      </td>
                  </tr> 
              ) : (
                staffPayroll.map((staff) => {
                  const isPaid = staff.status === 'Paid';

                  return (
                    <tr key={staff.id} className={`hover:bg-slate-50 transition-colors group ${isPaid ? 'opacity-70' : ''}`}>
                      <td className="p-6 align-middle">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-black text-sm shrink-0 border-2 border-white shadow-sm">
                                {staff.staff_name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-black text-slate-800 text-sm leading-tight">{staff.staff_name}</p>
                                <p className="font-mono text-[10px] text-slate-400 mt-0.5">{staff.role}</p>
                            </div>
                        </div>
                      </td>
                      <td className="p-6 align-middle font-bold text-slate-500">
                        ₵ {Number(staff.base_salary).toLocaleString()}
                      </td>
                      
                      <td className="p-6 align-middle">
                          <div className="flex items-center gap-3">
                              {Number(staff.bonus) > 0 && <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md text-[10px] font-black tracking-wider">+ ₵{Number(staff.bonus).toLocaleString()}</span>}
                              {Number(staff.deductions) > 0 && <span className="bg-red-50 text-red-700 px-2 py-1 rounded-md text-[10px] font-black tracking-wider">- ₵{Number(staff.deductions).toLocaleString()}</span>}
                              {Number(staff.bonus) === 0 && Number(staff.deductions) === 0 && <span className="text-xs font-bold text-slate-300">Standard</span>}
                          </div>
                      </td>

                      <td className="p-6 align-middle">
                          <span className={`font-black text-lg ${isPaid ? 'text-slate-400 line-through decoration-2' : 'text-teal-700'}`}>
                              ₵ {Number(staff.net_pay).toLocaleString()}
                          </span>
                      </td>

                      <td className="p-6 align-middle">
                        <span className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 w-max ${isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-600 border border-orange-200'}`}>
                          {isPaid ? <CheckCircle size={14}/> : <Clock size={14}/>} {staff.status}
                        </span>
                      </td>

                      <td className="p-6 align-middle text-center">
                        <div className="flex items-center justify-center gap-2">
                            {!isPaid && <button onClick={() => openPayslipEditor(staff)} className="text-slate-400 hover:text-teal-600 bg-slate-50 hover:bg-teal-50 p-2.5 rounded-xl transition-all" title="Build Payslip"><Receipt size={18}/></button>}
                            {!isPaid && <button onClick={() => updateStatus(staff.id, 'Paid')} className="bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs hover:bg-slate-800 transition-all shadow-md active:scale-95">Disburse</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================================= */}
      {/* MODAL: FLEXIBLE PAYSLIP BUILDER */}
      {/* ========================================================================================= */}
      {isPayslipModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPayslipModalOpen(false)}></div>
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            <div className="bg-slate-900 text-white p-6 shrink-0 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black">Payslip Builder</h2>
                <p className="text-xs text-teal-400 mt-1 font-bold">{selectedStaff.staff_name} • {selectedStaff.role}</p>
              </div>
              <button onClick={() => setIsPayslipModalOpen(false)} className="p-2 bg-white/10 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 bg-slate-50">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center mb-6 shadow-sm">
                    <span className="font-bold text-slate-500 uppercase text-xs tracking-widest">Base Salary Contract</span>
                    <span className="text-xl font-black text-slate-800">₵ {Number(selectedStaff.base_salary).toLocaleString()}</span>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-end border-b border-slate-200 pb-2 mb-2">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Flexible Adjustments</h3>
                        <button onClick={handleAddAdjustment} className="text-teal-600 font-bold text-xs flex items-center gap-1 hover:text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg"><Plus size={14}/> Add Item</button>
                    </div>

                    {activeAdjustments.map((adj) => (
                        <div key={adj.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm animate-in fade-in">
                            <select value={adj.type} onChange={(e) => handleUpdateAdjustment(adj.id, 'type', e.target.value)} className={`p-3 rounded-lg outline-none font-bold text-xs border ${adj.type === 'Earning' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                <option value="Earning">Earning (+)</option>
                                <option value="Deduction">Deduction (-)</option>
                            </select>
                            
                            <input type="text" value={adj.name} onChange={(e) => handleUpdateAdjustment(adj.id, 'name', e.target.value)} placeholder="e.g. SSNIT, Loan Repayment..." className="flex-1 bg-transparent border-b border-dashed border-slate-300 focus:border-slate-800 p-2 outline-none text-sm font-bold text-slate-800"/>
                            
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₵</span>
                                <input type="number" value={adj.amount} onChange={(e) => handleUpdateAdjustment(adj.id, 'amount', e.target.value)} className="w-28 bg-slate-50 border border-slate-200 p-2 pl-7 rounded-lg outline-none font-bold text-slate-800" placeholder="0.00"/>
                            </div>

                            <button onClick={() => handleRemoveAdjustment(adj.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    {activeAdjustments.length === 0 && <p className="text-center text-xs font-bold text-slate-400 py-4">No deductions or bonuses added.</p>}
                </div>
            </div>

            {/* LIVE CALCULATION FOOTER */}
            <div className="p-6 border-t border-slate-200 bg-white shrink-0">
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 p-3 rounded-xl border border-green-100 flex justify-between items-center">
                        <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Total Additions</span>
                        <span className="font-bold text-green-700">+ ₵{modalEarnings.toLocaleString()}</span>
                    </div>
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex justify-between items-center">
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Total Deductions</span>
                        <span className="font-bold text-red-700">- ₵{modalDeductions.toLocaleString()}</span>
                    </div>
                </div>
                
                <div className="flex justify-between items-center mb-6">
                    <span className="font-black text-slate-800 uppercase tracking-widest">Final Net Pay</span>
                    <span className="text-4xl font-black text-teal-600">₵ {modalNetPay.toLocaleString()}</span>
                </div>

                <button onClick={savePayslip} className="w-full py-4 rounded-2xl font-black shadow-xl bg-slate-900 hover:bg-slate-800 text-white flex justify-center items-center gap-2 transition-all active:scale-95">
                   <CheckCircle size={18}/> Finalize & Save Payslip
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Payroll;