import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLogger'; 
import { 
  Download, Search, RefreshCw, CloudOff, CloudUpload, 
  ChevronLeft, ChevronRight, Eye, UserCircle, X, 
  MapPin, HeartPulse, Utensils, BedDouble, ArrowUpDown, ShieldAlert,
  Smartphone
} from 'lucide-react';

// --- INTERFACES ---
interface ClientRecord {
  id: string;
  booking_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  trip_id: string;
  trip_title: string;
  start_date: string;
  payment_status: string;
  created_at: string;
  nationality: string;
  passport_no: string;
  dietary_needs: string;
  medical_info: string;
  room_preference: string;
  amount_paid: number;
}

interface SyncAction {
  id: number;
  table: string;
  action: 'UPDATE' | 'INSERT' | 'DELETE';
  recordId?: string | number;
  payload?: any;
}

const ClientHub: React.FC = () => {
  const { user } = useTenant(); 

  // --- STATE ---
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'All Clients' | 'Fully Paid' | 'Pending Deposits' | 'Cancelled'>('All Clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [tripFilter, setTripFilter] = useState('All');
  
  const [sortField, setSortField] = useState<keyof ClientRecord>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 🌟 MODAL STATES
  const [viewProfileClient, setViewProfileClient] = useState<ClientRecord | null>(null);
  const [previewBookingId, setPreviewBookingId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // --- DATA FETCHING ---
  const fetchClients = async () => {
    if (!user?.subscriberId) return;
    setLoading(true);

    try {
      const { data: tripsData } = await supabase
        .from('trips')
        .select('id, title, start_date')
        .eq('subscriber_id', user.subscriberId);

      const tripMap = new Map();
      if (tripsData) tripsData.forEach(t => tripMap.set(t.id, t));

      const { data: paxData, error: paxError } = await supabase
        .from('passengers')
        .select('*')
        .eq('subscriber_id', user.subscriberId);

      if (paxError) throw paxError;

      let allClients: ClientRecord[] = [];

      if (paxData) {
        allClients = paxData.map((p: any) => {
           const tripInfo = tripMap.get(p.trip_id) || { title: 'Unknown Trip', start_date: '' };
           return {
             id: String(p.id),
             booking_id: p.booking_id,
             first_name: p.first_name || 'Guest',
             last_name: p.last_name || '',
             email: p.email || '',
             phone: p.phone || '',
             trip_id: p.trip_id,
             trip_title: tripInfo.title,
             start_date: tripInfo.start_date,
             payment_status: p.payment_status || 'Pending',
             created_at: p.created_at || new Date().toISOString(),
             nationality: p.nationality || 'Not Provided',
             passport_no: p.passport_no || 'Not Provided',
             dietary_needs: p.dietary_needs || 'None',
             medical_info: p.medical_info || 'None',
             room_preference: p.room_preference || 'Standard',
             amount_paid: Number(p.amount_paid) || 0
           };
        });
      }
      setClients(allClients);
    } catch (error) {
      console.error("ClientHub Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [user?.subscriberId]);

  // --- SORTING & FILTERING ---
  const handleSort = (field: keyof ClientRecord) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const processedClients = useMemo(() => {
    let result = clients.filter(c => {
      const matchesSearch = 
        (c.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.last_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(c.booking_id || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTrip = tripFilter === 'All' || c.trip_title === tripFilter;
      let matchesStatus = true;
      const safeStatus = (c.payment_status || '').toLowerCase();
      if (activeTab === 'Fully Paid') matchesStatus = safeStatus === 'paid' || safeStatus === 'confirmed' || safeStatus === 'full';
      if (activeTab === 'Pending Deposits') matchesStatus = safeStatus === 'pending' || safeStatus === 'partial' || safeStatus === 'deposit';
      if (activeTab === 'Cancelled') matchesStatus = safeStatus === 'cancelled' || safeStatus === 'failed';
      return matchesSearch && matchesTrip && matchesStatus;
    });

    result.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return 0;
    });
    return result;
  }, [clients, searchQuery, tripFilter, activeTab, sortField, sortOrder]);

  const uniqueTrips = Array.from(new Set(clients.map(c => c.trip_title)));
  const paginatedClients = processedClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(processedClients.length / itemsPerPage);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(new Set(paginatedClients.map(c => c.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectRow = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleCancelBooking = async (client: ClientRecord) => {
    if (!window.confirm(`Are you sure you want to cancel the booking for ${client.first_name}?`)) return;
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, payment_status: 'Cancelled' } : c));
    try {
      await supabase.from('passengers').update({ payment_status: 'Cancelled' }).eq('id', client.id);
      await logAudit(user?.subscriberId || '', user?.fullName || 'System', user?.role || '', 'Cancelled Passenger', `Cancelled booking for ${client.first_name} ${client.last_name}.`);
    } catch (e) { console.error(e); }
  };

  const PRIMARY_BLUE = '#3b82f6';
  const LIGHT_BG = '#f4f7fc';

  return (
    <div className="min-h-screen pb-20 font-sans" style={{ backgroundColor: LIGHT_BG }}>
      
      <div className="pt-8 px-8 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Client Hub Management</h1>
          <p className="text-sm text-slate-400 mt-1">Direct relational passenger database and CRM hub.</p>
        </div>
        <button onClick={fetchClients} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-400 hover:text-blue-500 transition-colors">
            <RefreshCw size={20} className={loading ? "animate-spin" : ""}/>
        </button>
      </div>

      <div className="px-8">
        {/* FOLDER TABS */}
        <div className="flex items-end gap-1 px-2">
          {['All Clients', 'Fully Paid', 'Pending Deposits', 'Cancelled'].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`relative px-6 py-3 text-sm font-semibold rounded-t-xl transition-all duration-200 z-10 ${isActive ? 'bg-white text-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]' : 'bg-[#e2e8f0] text-slate-500 hover:bg-[#cbd5e1] hover:text-slate-700'}`}
                style={{ marginBottom: isActive ? '-1px' : '0', borderBottom: isActive ? '1px solid white' : 'none' }}
              >
                {tab}
              </button>
            )
          })}
        </div>

        <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-sm border border-slate-200/60 flex flex-col min-h-[600px] relative z-0">
          
          {/* CONTROLS */}
          <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-slate-600">Client Name</label>
                <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-3 pr-10 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 w-64" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-slate-600">Trip</label>
                <select value={tripFilter} onChange={(e) => setTripFilter(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none w-48 bg-white">
                  <option value="All">All Trips</option>
                  {uniqueTrips.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <button className="px-5 py-2 rounded-lg text-sm font-bold text-white shadow-sm bg-blue-500 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2">
              <Download size={16}/> Export
            </button>
          </div>

          {/* TABLE */}
          <div className="px-6 flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] text-slate-500 text-xs font-bold border-y border-slate-200">
                  <th className="py-4 px-4 w-10">
                    <input type="checkbox" checked={selectedIds.size === paginatedClients.length && paginatedClients.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded text-blue-600 border-slate-300"/>
                  </th>
                  <th className="py-4 px-4 font-bold cursor-pointer hover:text-slate-700" onClick={() => handleSort('first_name')}>Passenger <ArrowUpDown size={12} className="inline ml-1"/></th>
                  <th className="py-4 px-4 font-bold cursor-pointer hover:text-slate-700" onClick={() => handleSort('trip_title')}>Assignment <ArrowUpDown size={12} className="inline ml-1"/></th>
                  <th className="py-4 px-4 font-bold cursor-pointer hover:text-slate-700" onClick={() => handleSort('created_at')}>Date <ArrowUpDown size={12} className="inline ml-1"/></th>
                  <th className="py-4 px-4 font-bold">Status</th>
                  <th className="py-4 px-4 font-bold text-right">Operate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                   <tr><td colSpan={6} className="py-20 text-center text-slate-300 font-bold"><RefreshCw size={24} className="mx-auto mb-2 animate-spin"/> Loading...</td></tr>
                ) : (
                  paginatedClients.map((client) => (
                    <tr key={client.id} className={`transition-colors ${selectedIds.has(client.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}`}>
                      <td className="py-4 px-4">
                        <input type="checkbox" checked={selectedIds.has(client.id)} onChange={() => handleSelectRow(client.id)} className="w-4 h-4 rounded text-blue-600 border-slate-300"/>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-800 text-sm">{client.first_name} {client.last_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{client.email || client.phone}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-700 text-sm">{client.trip_title}</p>
                      </td>
                      <td className="py-4 px-4 text-sm font-medium text-slate-600">
                        {new Date(client.created_at).toLocaleDateString('en-GB').replace(/\//g, '.')}
                      </td>
                      <td className="py-4 px-4">
                        <p className={`text-sm font-bold ${client.payment_status.toLowerCase().includes('paid') ? 'text-emerald-600' : 'text-orange-500'}`}>
                          {client.payment_status}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          {/* 🌟 EYE ICON TOGGLE FOR PREVIEW */}
                          <button 
                            onClick={() => setPreviewBookingId(client.booking_id)}
                            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-all"
                            title="Preview Passport"
                          >
                            <Eye size={16}/>
                          </button>
                          <button onClick={() => setViewProfileClient(client)} className="px-3 py-1 border rounded text-xs font-bold transition-colors hover:bg-blue-50" style={{ borderColor: PRIMARY_BLUE, color: PRIMARY_BLUE }}>Profile</button>
                          {client.payment_status !== 'Cancelled' && (
                            <button onClick={() => handleCancelBooking(client)} className="px-3 py-1 border border-slate-300 text-slate-500 rounded text-xs font-bold transition-colors hover:bg-red-50 hover:text-red-500 hover:border-red-200">Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINATION */}
          <div className="p-6 flex justify-end items-center mt-auto border-t border-slate-100">
             <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-slate-300 disabled:opacity-50"><ChevronLeft size={16} /></button>
                {[...Array(totalPages)].map((_, i) => (
                    <button key={i+1} onClick={() => setCurrentPage(i+1)} className={`w-8 h-8 flex items-center justify-center rounded border text-sm font-bold transition-colors ${currentPage === i+1 ? 'border-blue-500 text-blue-500 bg-blue-50' : 'border-slate-200 text-slate-500'}`}>{i+1}</button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-slate-300 disabled:opacity-50"><ChevronRight size={16} /></button>
             </div>
          </div>
        </div>
      </div>

      {/* 🌟 MODAL: PROFILE VIEW */}
      {viewProfileClient && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setViewProfileClient(null)}></div>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-[#f8fafc] border-b border-slate-200 p-6 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-black text-xl">{viewProfileClient.first_name[0]}{viewProfileClient.last_name[0]}</div>
                <div><h2 className="text-xl font-bold text-slate-800">{viewProfileClient.first_name} {viewProfileClient.last_name}</h2><p className="text-sm font-medium text-slate-500">{viewProfileClient.email}</p></div>
              </div>
              <button onClick={() => setViewProfileClient(null)} className="text-slate-400 hover:text-slate-700"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div><p className="text-[10px] font-black uppercase text-slate-400 mb-1">Passport No.</p><p className="font-mono font-bold text-slate-700">{viewProfileClient.passport_no}</p></div>
                <div><p className="text-[10px] font-black uppercase text-slate-400 mb-1">Nationality</p><p className="font-bold text-slate-700">{viewProfileClient.nationality}</p></div>
                <div><p className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1"><Utensils size={10}/> Dietary</p><p className="font-bold text-orange-600">{viewProfileClient.dietary_needs}</p></div>
                <div><p className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1"><HeartPulse size={10}/> Medical</p><p className="font-bold text-red-600">{viewProfileClient.medical_info}</p></div>
                <div className="col-span-2"><p className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1"><BedDouble size={10}/> Room Preference</p><p className="font-bold text-slate-800">{viewProfileClient.room_preference}</p></div>
              </div>
              <button 
                onClick={() => { setPreviewBookingId(viewProfileClient.booking_id); setViewProfileClient(null); }}
                className="w-full py-4 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
              >
                <Smartphone size={18}/> Preview Digital Passport
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL: DIGITAL PASSPORT PREVIEW (IFRAME) */}
      {previewBookingId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
           <div className="bg-slate-900 w-[45vh] h-[85vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border-4 border-slate-800 animate-in zoom-in-95 duration-200 relative">
              <div className="flex justify-between items-center p-4 bg-slate-900 border-b border-slate-800 text-white">
                  <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400">Live Passport Preview</h3>
                  </div>
                  <button onClick={() => setPreviewBookingId(null)} className="p-2 bg-slate-800 hover:bg-red-500 hover:text-white rounded-full transition-all text-slate-400"><X size={14}/></button>
              </div>
              <div className="flex-1 w-full relative bg-slate-50">
                  <iframe 
                      src={`${window.location.origin}/clientpassport/${previewBookingId}`} 
                      className="w-full h-full border-none"
                      title="Passport Preview"
                  />
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default ClientHub;