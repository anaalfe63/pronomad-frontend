import React, { useState, useEffect } from 'react';
import { 
  Activity, Search, Download, ChevronLeft, ChevronRight, 
  Calendar, RefreshCw, ShieldAlert, CheckCircle, User 
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

const AuditLogs: React.FC = () => {
  const { user } = useTenant(); 
  const APP_COLOR = user?.themeColor || '#10b981';

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Pagination States
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const LIMIT = 15;

  // --- 1. FETCH LOGS FROM SUPABASE ---
  const fetchLogs = async () => {
    if (!user?.subscriberId) return;
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
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
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

  return (
    <div className="animate-fade-in pb-20 max-w-7xl mx-auto w-full flex flex-col gap-6">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-900/20">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Audit Log</h1>
            <p className="text-sm font-medium text-slate-500">Security trail and user activity history.</p>
          </div>
        </div>

        <div className="flex gap-2">
            <button onClick={fetchLogs} className="p-2 bg-white border border-slate-200 rounded-xl transition-colors hover:bg-slate-50" style={{ color: APP_COLOR }} title="Refresh">
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl font-bold shadow-lg transition-all active:scale-95 hover:brightness-110" style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}>
                <Download size={18} /> Export CSV
            </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
         <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by user, action, or details..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 transition-all"
              style={{ '--tw-ring-color': APP_COLOR } as any}
            />
         </div>
         
         <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl focus-within:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                <Calendar size={16} className="text-slate-400"/>
                <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setPage(1);}} className="bg-transparent outline-none text-xs font-bold text-slate-600 uppercase"/>
                <span className="text-slate-300">-</span>
                <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setPage(1);}} className="bg-transparent outline-none text-xs font-bold text-slate-600 uppercase"/>
            </div>
         </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">User & Role</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Action Taken</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Details</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && logs.length === 0 ? (
                 <tr><td colSpan={4} className="px-6 py-20 text-center font-bold text-slate-300 animate-pulse">Syncing Secure Cloud Logs...</td></tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            <User size={14}/>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800">{log.user_name}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border w-fit mt-1 ${getRoleColor(log.user_role)}`}>
                            {log.user_role}
                            </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        {log.action.toLowerCase().includes('delete') || log.action.toLowerCase().includes('suspend') ? <ShieldAlert size={14} className="text-red-500"/> : <CheckCircle size={14} style={{ color: APP_COLOR }}/>}
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500 font-medium">{log.details}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-medium">
                    No logs found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/30">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
                <button 
                    disabled={page === 1} 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-50 transition-colors text-slate-600"
                >
                    <ChevronLeft size={16}/>
                </button>
                <button 
                    disabled={page === totalPages || totalPages === 0} 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-2 rounded-lg border border-slate-200 bg-white disabled:opacity-50 hover:bg-slate-50 transition-colors text-slate-600"
                >
                    <ChevronRight size={16}/>
                </button>
            </div>
        </div>
      </div>

    </div>
  );
};

export default AuditLogs;