import React, { useState, useEffect } from 'react';
import { 
  Activity, Search, Download, ChevronLeft, ChevronRight, 
  Calendar, RefreshCw, ShieldAlert, CheckCircle, User, 
  Database, ShieldCheck, Lock
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

// --- TYPES & INTERFACES ---
interface AuditLogEntry {
  id: string | number;
  user_name: string;
  user_role: string;
  action: string;
  details: string;
  created_at: string;
}

const AuditLog: React.FC = () => {
  const { user, settings } = useTenant(); 
  const APP_COLOR = settings?.theme_color || '#0f2d6e';

  // --- 🛡️ ROLE DEFINITIONS ---
  const safeRole = (user?.role || '').toLowerCase().trim();
  const isGodMode = safeRole === 'proadmin';
  const isCEO = isGodMode || safeRole === 'ceo' || safeRole === 'admin' || safeRole === 'owner';

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Pagination States
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const LIMIT = 15;

  // --- 1. FETCH LOGS FROM SUPABASE ---
  const fetchLogs = async () => {
    if (!user?.subscriberId || !isCEO) return;
    setLoading(true);
    
    try {
      const from = (page - 1) * LIMIT;
      const to = from + LIMIT - 1;

      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('subscriber_id', user.subscriberId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`user_name.ilike.%${searchTerm}%,action.ilike.%${searchTerm}%,details.ilike.%${searchTerm}%`);
      }
      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59Z`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      if (data) {
        setLogs(data);
        setTotalLogs(count || 0);
        setTotalPages(count ? Math.ceil(count / LIMIT) : 1);
      }
    } catch (error) {
      console.error("Audit Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
        if(user?.subscriberId) fetchLogs();
    }, 500); 
    return () => clearTimeout(timer);
  }, [page, searchTerm, startDate, endDate, user?.subscriberId]);

  // --- 2. CSV EXPORT FUNCTION ---
  const handleExport = () => {
    if (logs.length === 0) return alert("No data to export");
    
    let csvContent = "data:text/csv;charset=utf-8,ID,Date,User,Role,Action,Details\n";
    
    logs.forEach(log => {
        const row = [
            log.id,
            new Date(log.created_at).toLocaleString(),
            log.user_name,
            log.user_role,
            `"${log.action}"`, 
            `"${log.details}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `security_audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- UI HELPERS ---
  const getRoleColor = (role: string) => {
    const r = (role || '').toLowerCase();
    if (r === 'ceo' || r === 'owner' || r === 'proadmin') return 'bg-purple-100 text-purple-700 border-purple-200';
    if (r === 'finance') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (r === 'operations') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  // 🔒 STRICT SECURITY LOCKOUT
  if (!isCEO) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-in fade-in">
        <div className="w-24 h-24 bg-slate-100 text-slate-300 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner"><Lock size={40}/></div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Executive Clearance Required</h2>
        <p className="text-slate-500 font-medium mt-2 max-w-md text-center">The System Audit Log contains immutable security trails and is strictly restricted to the CEO or System Owner.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-20 relative">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 rounded-[1.2rem] shadow-sm border border-slate-200 bg-slate-900 text-white">
               <Activity size={28} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Audit Log</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
             <ShieldCheck size={18} className="text-emerald-500"/> Immutable security trail and user activity history
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <button onClick={fetchLogs} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-slate-500" title="Refresh Data">
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={handleExport} className="flex-1 md:flex-none text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 hover:brightness-110" style={{ backgroundColor: APP_COLOR, boxShadow: `0 8px 20px -4px ${APP_COLOR}40` }}>
            <Download size={18}/> Export Log
          </button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-100"><Database size={24}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Tracked Actions</p>
                <h3 className="text-3xl font-black text-slate-900">{loading ? '-' : totalLogs.toLocaleString()}</h3>
            </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-50 text-red-600 border border-red-100"><ShieldAlert size={24}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Critical Actions (Deletes)</p>
                <h3 className="text-3xl font-black text-slate-900">{loading ? '-' : logs.filter(l => l.action.toLowerCase().includes('delete') || l.action.toLowerCase().includes('remove')).length}</h3>
            </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2rem] shadow-sm flex items-center gap-5 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-50" style={{ backgroundColor: APP_COLOR }}></div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/10 text-white backdrop-blur-sm relative z-10"><Activity size={24}/></div>
            <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System Status</p>
                <h3 className="text-2xl font-black text-white flex items-center gap-2">Monitoring <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span></h3>
            </div>
        </div>
      </div>

      {/* FILTERS BAR */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center mb-6">
         <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by user, action, or specific details..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-[1.2rem] text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:bg-white transition-all"
              style={{ '--tw-ring-color': APP_COLOR } as any}
            />
         </div>
         
         <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-3 rounded-[1.2rem] focus-within:ring-2 focus-within:bg-white transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                <Calendar size={16} className="text-slate-400"/>
                <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setPage(1);}} className="bg-transparent outline-none text-xs font-bold text-slate-600 uppercase"/>
                <span className="text-slate-300">-</span>
                <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setPage(1);}} className="bg-transparent outline-none text-xs font-bold text-slate-600 uppercase"/>
            </div>
         </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">User & Role</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Action Taken</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/2">Audit Details</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && logs.length === 0 ? (
                 <tr><td colSpan={4} className="px-8 py-20 text-center font-black text-slate-300 animate-pulse"><RefreshCw size={32} className="mx-auto mb-4 animate-spin"/> Querying Secure Database...</td></tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                    
                    <td className="px-8 py-5 align-middle">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black border border-slate-200 shadow-sm">
                            {log.user_name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-900">{log.user_name}</span>
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border w-fit mt-1.5 ${getRoleColor(log.user_role)}`}>
                                {log.user_role}
                            </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-8 py-5 align-middle">
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        {log.action.toLowerCase().includes('delete') || log.action.toLowerCase().includes('suspend') || log.action.toLowerCase().includes('fail') ? 
                            <ShieldAlert size={16} className="text-red-500"/> : 
                            <CheckCircle size={16} style={{ color: APP_COLOR }}/>
                        }
                        {log.action}
                      </span>
                    </td>

                    <td className="px-8 py-5 align-middle whitespace-normal min-w-[300px]">
                      <span className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 block">
                          {log.details}
                      </span>
                    </td>

                    <td className="px-8 py-5 align-middle text-right">
                      <span className="text-[11px] font-bold text-slate-500 font-mono bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm inline-block">
                        {new Date(log.created_at).toLocaleString(undefined, { 
                            month: 'short', day: 'numeric', year: 'numeric', 
                            hour: 'numeric', minute: '2-digit', second: '2-digit' 
                        })}
                      </span>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                        <Search size={24}/>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-1">No Logs Found</h3>
                    <p className="text-sm font-medium text-slate-500">Try adjusting your date range or search query.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 mt-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
                <button 
                    disabled={page === 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-2.5 rounded-[1rem] border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-100 transition-colors text-slate-600 shadow-sm"
                >
                    <ChevronLeft size={18}/>
                </button>
                <button 
                    disabled={page === totalPages || totalPages === 0} 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-2.5 rounded-[1rem] border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-100 transition-colors text-slate-600 shadow-sm"
                >
                    <ChevronRight size={18}/>
                </button>
            </div>
        </div>
      </div>

    </div>
  );
};

export default AuditLog;