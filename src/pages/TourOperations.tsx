import React, { useState, useEffect, useCallback,
    useRef } from 'react';
    import { Scanner } from '@yudiel/react-qr-scanner';
import { useTenant } from '../contexts/TenantContext'; 
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLogger';
import { useNavigate } from 'react-router-dom'; 
import { 
  Users, CheckCircle, Clock, MapPin, Send, Plus, X, Pencil, Save, Wallet,
  Navigation, CloudUpload, RefreshCw, BedDouble, Utensils, QrCode, ScanLine,
  HeartPulse, Briefcase, Search, UserCheck, Trash2, Globe, ListPlus,AlertTriangle,
  CloudOff, ChevronUp, ChevronDown, Link, AlertCircle, LinkIcon, Eye,
  Bell, Share2 // 🌟 Added Share2 for WhatsApp button
} from 'lucide-react';

// =========================================================================
// 1. INTERFACES
// =========================================================================

interface Trip {
  id: string | number;
  trip_ref: string;
  title: string;
  subtitle?: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  capacity: number;
  passenger_count?: number;
  transport_modes?: string[];
  marketing_data?: any;
  financials?: any;
  terms?: any;
  itinerary?: any[];
  logistics?: any;
}

interface Passenger {
  id: string | number;
  booking_id: string | number;
  title?: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  gender?: string;
  dob?: string;
  nationality?: string;
  passport_no?: string;
  passport_expiry?: string;
  is_lead: boolean;
  room_preference?: string;
  requested_roommate?: string;
  dietary_needs?: string;
  medical_info?: string;
  boarded?: boolean;
  amount_paid?: number | string;
  payment_status?: string;
  trips?: { title: string }; // For notification joining
}

interface SyncAction {
  id: number;
  table: string;
  action: 'UPDATE' | 'INSERT' | 'DELETE';
  recordId: string | number;
  payload: any;
}

// =========================================================================
// 2. HQ COMMAND CENTER (Admin & Operations)
// =========================================================================

const AdminOperations: React.FC<{ user: any }> = ({ user }) => {
  const { settings } = useTenant(); 
  const APP_COLOR = settings?.theme_color || '#0d9488';
  const BASE_CURRENCY = settings?.currency || 'GHS';

  const canDeleteTrip = ['Finance', 'Operations', 'CEO', 'PROADMIN'].includes(user?.role);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [suppliersDb, setSuppliersDb] = useState<any[]>([]);
  const [staffDb, setStaffDb] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [manifestData, setManifestData] = useState<Passenger[]>([]);
  
  const [isEditingTrip, setIsEditingTrip] = useState<boolean>(false);
  const [editTab, setEditTab] = useState<'basics' | 'finance' | 'logistics' | 'itinerary'>('basics');
  const [tripForm, setTripForm] = useState<Partial<Trip>>({});
  
  const [isEditingPax, setIsEditingPax] = useState<boolean>(false);
  const [paxForm, setPaxForm] = useState<Partial<Passenger>>({});
  const [previewBookingId, setPreviewBookingId] = useState<string | null>(null);

  // 🌟 NOTIFICATIONS & VERIFICATION STATE
  const [pendingVerifications, setPendingVerifications] = useState<Passenger[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [verifiedPax, setVerifiedPax] = useState<Passenger | null>(null); // 🌟 NEW: Controls the Success Modal
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If the menu is open AND the click was NOT inside the notifRef container
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };

    // Attach listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Cleanup listener on unmount
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 🟢 OFFLINE SYNC STATE ENGINE
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<SyncAction[]>(() => {
     const saved = localStorage.getItem('pronomad_sync_queue');
     return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
     localStorage.setItem('pronomad_sync_queue', JSON.stringify(pendingSyncs));
  }, [pendingSyncs]);

  const processSyncQueue = useCallback(async () => {
      if (!navigator.onLine || pendingSyncs.length === 0 || isSyncing) return;
      setIsSyncing(true);
      const remaining = [...pendingSyncs];

      for (const task of pendingSyncs) {
          try {
              if (task.action === 'UPDATE') {
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


  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
      if (!user?.subscriberId) return;

      const [tripsResponse, suppliersResponse, staffResponse, pendingResponse] = await Promise.all([
        supabase.from('trips').select('*').eq('subscriber_id', user.subscriberId),
        supabase.from('suppliers').select('*').eq('subscriber_id', user.subscriberId),
        supabase.from('staff').select('*').eq('subscriber_id', user.subscriberId),
        // 🌟 Fetch passengers awaiting verification
        supabase.from('passengers').select('*, trips(title)').eq('subscriber_id', user.subscriberId).ilike('payment_status', '%Pending%').order('created_at', { ascending: false })
      ]);

      if (tripsResponse.data) {
         const tripIds = tripsResponse.data.map(t => t.id);
         let paxCounts: Record<string, number> = {};
         
         if (tripIds.length > 0) {
             const { data: paxData } = await supabase.from('passengers').select('trip_id').in('trip_id', tripIds);
             if (paxData) {
                 paxData.forEach(pax => { paxCounts[pax.trip_id] = (paxCounts[pax.trip_id] || 0) + 1; });
             }
         }

         const tripsWithLiveCounts = tripsResponse.data.map(trip => ({
             ...trip, passenger_count: paxCounts[trip.id] || 0
         }));

         setTrips(tripsWithLiveCounts);
      }
      
      if (suppliersResponse.data) setSuppliersDb(suppliersResponse.data);
      if (staffResponse.data) setStaffDb(staffResponse.data);
      if (pendingResponse.data) setPendingVerifications(pendingResponse.data as Passenger[]);

    } catch (e) { console.error("Database Sync Error:", e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user?.subscriberId]);

  // 🌟 UNIFIED VERIFICATION HANDLER
  const handleVerifyPayment = async (pax: Passenger) => {
      if(window.confirm(`Verify funds received for ${pax.first_name}? This will instantly unlock their Digital Passport.`)) {
          const newStatus = 'Full'; // Mark as Full/Verified
          
          // Optimistically remove from notifications
          setPendingVerifications(prev => prev.filter(p => String(p.id) !== String(pax.id)));
          
          // Optimistically update manifest if it's currently open
          setManifestData(prev => prev.map(p => String(p.id) === String(pax.id) ? { ...p, payment_status: newStatus } : p));

          try {
              if (!navigator.onLine) throw new Error("Offline");
              
              // Update Both Tables to Ensure Sync
              await Promise.all([
                 supabase.from('passengers').update({ payment_status: newStatus }).eq('id', pax.id),
                 supabase.from('bookings').update({ payment_status: newStatus }).eq('id', pax.booking_id)
              ]);
              
              await logAudit(user?.subscriberId || '', user?.fullName || 'System', user?.role || '', 'Verified Payment', `Verified offline payment for ${pax.first_name} ${pax.last_name}.`);
              
              // 🌟 Trigger the Success Modal
              setVerifiedPax(pax);
              setIsNotifOpen(false);

          } catch (e) {
              setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'passengers', action: 'UPDATE', recordId: pax.id, payload: { payment_status: newStatus } }]);
              // Still show the modal even if offline
              setVerifiedPax(pax);
              setIsNotifOpen(false);
          }
      }
  };

  // --- MANIFEST ACTIONS ---
  const handleOpenManifest = async (trip: Trip) => {
    setSelectedTrip(trip);
    try {
        const { data, error } = await supabase.from('passengers').select('*, bookings(amount_paid, payment_status)').eq('trip_id', trip.id);
        if (error) throw error;

        const enrichedManifest = (data || []).map((pax: any) => {
            let finalAmount = Number(pax.amount_paid) || 0;
            let finalStatus = pax.payment_status;

            if (pax.bookings) {
                if (finalAmount === 0 && pax.is_lead) { finalAmount = Number(pax.bookings.amount_paid) || 0; }
                if (!finalStatus || finalStatus === 'Pending') { finalStatus = pax.bookings.payment_status || 'Pending'; }
            }

            return { ...pax, amount_paid: finalAmount, payment_status: finalStatus || 'Pending' };
        });

        setManifestData(enrichedManifest);

        if (data && data.length !== trip.passenger_count) {
            setTrips(prev => prev.map(t => t.id === trip.id ? { ...t, passenger_count: data.length } : t));
            setSelectedTrip(prev => ({ ...prev!, passenger_count: data.length }));
            if (navigator.onLine) await supabase.from('trips').update({ passenger_count: data.length }).eq('id', trip.id);
        }
    } catch (e) { console.error("Manifest Load Error:", e); }
  };

  const handleToggleBoarding = async (pax: Passenger) => {
      const newStatus = !pax.boarded;
      setManifestData(prev => prev.map(p => String(p.id) === String(pax.id) ? { ...p, boarded: newStatus } : p));
      try {
          if (!navigator.onLine) throw new Error("Offline mode active");
          const { error } = await supabase.from('passengers').update({ boarded: newStatus }).eq('id', pax.id);
          if (error) throw error;
      } catch (e) { 
          setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'passengers', action: 'UPDATE', recordId: pax.id, payload: { boarded: newStatus } }]);
      }
  };

  const handleDeletePassenger = async (paxId: string | number, paxName: string) => {
      if(window.confirm(`Remove ${paxName} from this manifest permanently?`)) {
          setManifestData(prev => prev.filter(p => String(p.id) !== String(paxId)));
          let newCount = 0;
          if (selectedTrip) {
              newCount = Math.max(0, (selectedTrip.passenger_count || 1) - 1);
              setTrips(prev => prev.map(t => t.id === selectedTrip.id ? { ...t, passenger_count: newCount } : t));
              setSelectedTrip(prev => ({ ...prev!, passenger_count: newCount }));
          }

          try {
              if (!navigator.onLine) throw new Error("Offline");
              const { error } = await supabase.from('passengers').delete().eq('id', paxId);
              if (error) throw error;
              if (selectedTrip) await supabase.from('trips').update({ passenger_count: newCount }).eq('id', selectedTrip.id);
          } catch(e) {
              setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'passengers', action: 'DELETE', recordId: paxId, payload: {} }]);
              if (selectedTrip) setPendingSyncs(prev => [...prev, { id: Date.now() + 1, table: 'trips', action: 'UPDATE', recordId: selectedTrip.id, payload: { passenger_count: newCount } }]);
          }
      }
  };

  const handleSavePassenger = async () => {
    const cleanAmount = Number(paxForm.amount_paid) || 0;
    const payload = {
        title: paxForm.title, first_name: paxForm.first_name, last_name: paxForm.last_name, phone: paxForm.phone, email: paxForm.email, 
        passport_no: paxForm.passport_no, room_preference: paxForm.room_preference, requested_roommate: paxForm.requested_roommate,
        amount_paid: cleanAmount, payment_status: paxForm.payment_status || 'Pending', dietary_needs: paxForm.dietary_needs, medical_info: paxForm.medical_info
    };

    setIsEditingPax(false);
    setManifestData(prev => prev.map(p => String(p.id) === String(paxForm.id) ? { ...p, ...payload } as Passenger : p));

    try {
      if (!navigator.onLine) throw new Error("Offline");
      const { error } = await supabase.from('passengers').update(payload).eq('id', paxForm.id);
      if (error) throw error;
    } catch (e: any) { 
      setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'passengers', action: 'UPDATE', recordId: paxForm.id as string, payload: payload }]);
    }
  };

  // --- TRIP ACTIONS ---
  const handleUpdateTripStatus = async (tripId: string | number, newStatus: string) => {
    const targetTrip = trips.find(t => t.id === tripId);
    if(!targetTrip) return;

    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: newStatus } : t));

    try {
      if (!navigator.onLine) throw new Error("Offline");
      const { error } = await supabase.from('trips').update({ status: newStatus }).eq('id', tripId);
      if (error) throw error;
      
      if(user?.subscriberId) {
          await logAudit(user.subscriberId, user.fullName || user.username || 'System', user.role, 'Trip Status Updated', `Changed status of trip "${targetTrip.title}" to ${newStatus}.`);
      }
    } catch (e) {
      setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'trips', action: 'UPDATE', recordId: tripId, payload: { status: newStatus } }]);
    }
  };

  const handleDeleteTrip = async (tripId: string | number, tripTitle: string) => {
      if(window.confirm(`⚠️ DANGER: Delete "${tripTitle}" and ALL its passengers?`)) {
          const { error } = await supabase.from('trips').delete().eq('id', tripId);
          if (!error) {
              setTrips(prev => prev.filter(t => t.id !== tripId));
              if(user?.subscriberId) await logAudit(user.subscriberId, user.fullName || user.username || 'System', user.role, 'Deleted Master Trip', `Permanently deleted master trip profile: "${tripTitle}".`);
          }
      }
  };

  const openMasterEditor = (trip: Trip) => {
      setTripForm({
          ...trip,
          start_date: trip.start_date ? new Date(trip.start_date).toISOString().split('T')[0] : '',
          end_date: trip.end_date ? new Date(trip.end_date).toISOString().split('T')[0] : '',
          marketing_data: trip.marketing_data || {}, financials: trip.financials || {}, terms: trip.terms || {},
          logistics: trip.logistics || { vendors: [] }, itinerary: trip.itinerary || [], transport_modes: trip.transport_modes || ['Bus']
      });
      setEditTab('basics');
      setIsEditingTrip(true);
  };

  const handleSaveMasterTrip = async () => {
    const payload = {
        title: tripForm.title, subtitle: tripForm.subtitle, description: tripForm.description, start_date: tripForm.start_date, end_date: tripForm.end_date, capacity: tripForm.capacity,
        marketing_data: tripForm.marketing_data, financials: tripForm.financials, terms: tripForm.terms, logistics: tripForm.logistics, itinerary: tripForm.itinerary, transport_modes: tripForm.transport_modes
    };

    setIsEditingTrip(false);
    setTrips(prev => prev.map(t => t.id === tripForm.id ? { ...t, ...payload } as Trip : t));

    try {
      if (!navigator.onLine) throw new Error("Offline");
      const { error } = await supabase.from('trips').update(payload).eq('id', tripForm.id);
      if (error) throw error;
      if(user?.subscriberId) await logAudit(user.subscriberId, user.fullName || user.username || 'System', user.role, 'Edited Master Trip Profile', `Saved changes to trip details for: "${tripForm.title}".`);
    } catch (e) {
      setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'trips', action: 'UPDATE', recordId: tripForm.id as string, payload: payload }]);
    }
  };

  const handleUpdateItinerary = (id: number, field: string, value: any) => { setTripForm(prev => ({ ...prev, itinerary: prev.itinerary?.map(step => step.id === id ? { ...step, [field]: value } : step) })); };

  const moveItineraryStep = (index: number, direction: 'up' | 'down') => {
      const newItinerary = [...(tripForm.itinerary || [])];
      if (direction === 'up' && index > 0) {
          const temp = newItinerary[index];
          newItinerary[index] = newItinerary[index - 1];
          newItinerary[index - 1] = temp;
      } else if (direction === 'down' && index < newItinerary.length - 1) {
          const temp = newItinerary[index];
          newItinerary[index] = newItinerary[index + 1];
          newItinerary[index + 1] = temp;
      }
      setTripForm(prev => ({ ...prev, itinerary: newItinerary }));
  };

  const filteredTrips = trips.filter(t => t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || t.trip_ref?.toLowerCase().includes(searchTerm.toLowerCase()));
  const supplierCategories = Array.from(new Set(suppliersDb.map(s => s.category || 'Other')));

  return (
    <div className="animate-fade-in pb-20">
      
      {/* HEADER WITH OFFLINE STATUS & NOTIFICATIONS */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-4">
             <h1 className="text-4xl font-black tracking-tight flex items-center gap-3" style={{ color: APP_COLOR }}>
                Operations Command <span className={`w-2 h-2 rounded-full animate-pulse ${isOnline && pendingSyncs.length === 0 ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
             </h1>
             {pendingSyncs.length > 0 ? (
                 <div className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest cursor-pointer" onClick={processSyncQueue}>
                    {isSyncing ? <RefreshCw size={14} className="animate-spin"/> : <CloudOff size={14}/>}
                    {pendingSyncs.length} Pending
                 </div>
             ) : (
                 <div className="flex items-center gap-1 text-slate-300" title="Cloud Synced"><CloudUpload size={20}/></div>
             )}
          </div>
          <p className="text-slate-500 font-medium mt-1">Live management of dispatch, manifests, and traveler safety.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto relative">
           
           {/* 🌟 NOTIFICATIONS BELL */}
           <div className="relative" ref={notifRef}>
             <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)} 
                className="p-3.5 bg-white border border-slate-200 shadow-sm rounded-2xl hover:bg-slate-50 transition-all text-slate-600 relative"
             >
                <Bell size={20} />
                {pendingVerifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-bounce">
                    {pendingVerifications.length}
                  </span>
                )}
             </button>

             {/* DROPDOWN PANEL */}
             {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                   <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                      <h4 className="font-black text-sm uppercase tracking-widest">Action Required</h4>
                      <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{pendingVerifications.length} Pending</span>
                   </div>
                   <div className="max-h-96 overflow-y-auto p-2">
                      {pendingVerifications.length === 0 ? (
                        <div className="p-8 text-center flex flex-col items-center gap-2">
                            <CheckCircle size={32} className="text-emerald-200"/>
                            <p className="text-slate-400 font-bold text-sm">All payments verified.</p>
                        </div>
                      ) : (
                        pendingVerifications.map(pax => (
                           <div key={pax.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors rounded-xl">
                              <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest truncate">{pax.trips?.title || 'Unknown Trip'}</p>
                              <p className="text-sm font-black text-slate-800">{pax.first_name} {pax.last_name}</p>
                              <div className="flex justify-between items-center mt-3">
                                 <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-1 rounded-md uppercase tracking-widest">{pax.payment_status}</span>
                                 <button onClick={() => handleVerifyPayment(pax)} className="bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1">
                                     <CheckCircle size={12}/> Verify
                                 </button>
                              </div>
                           </div>
                        ))
                      )}
                   </div>
                </div>
             )}
           </div>

           <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
              <input type="text" placeholder="Search Trip Ref / Name..." className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 rounded-2xl outline-none focus:ring-2 ring-teal-500/20 font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <button onClick={fetchData} className="p-3.5 bg-white border border-slate-200 shadow-sm rounded-2xl hover:bg-slate-50 transition-all text-slate-400">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} style={{ color: APP_COLOR }}/>
           </button>
        </div>
      </header>

      {/* TRIP PROFILES */}
      {loading && trips.length === 0 ? (
        <div className="p-32 text-center flex flex-col items-center gap-4">
           <RefreshCw size={48} className="animate-spin text-slate-200"/>
           <p className="font-black text-slate-300 uppercase tracking-widest text-xs">Synchronizing with Cloud...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredTrips.map(trip => {
              const occupancyRate = trip.capacity ? Math.min(100, Math.round(((trip.passenger_count || 0) / trip.capacity) * 100)) : 0;
              return (
                <div key={trip.id} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all group flex flex-col">
                  
                  <div className="p-6 pb-0 flex justify-between items-center">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] ${trip.status === 'Dispatched' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {trip.status}
                      </span>
                      {canDeleteTrip && (
                          <button onClick={() => handleDeleteTrip(trip.id, trip.title)} className="text-slate-300 hover:text-red-500 transition-colors p-2" title="Delete Trip"><Trash2 size={18}/></button>
                      )}
                  </div>

                  <div className="p-6 flex-1">
                    <div className="text-[10px] font-black text-slate-400 mb-1 tracking-widest">{trip.trip_ref}</div>
                    <h3 className="text-2xl font-black text-slate-800 leading-tight mb-6 transition-colors line-clamp-2">{trip.title}</h3>
                    
                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                            <span>Occupancy</span>
                            <span>{trip.passenger_count || 0} / {trip.capacity || '∞'} PAX</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${occupancyRate}%`, backgroundColor: APP_COLOR }}></div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                       <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Clock size={14}/></div>
                          <div>
                             <p className="text-[9px] font-black text-slate-400 uppercase">Departure</p>
                             <p className="text-xs font-bold text-slate-800">{trip.start_date ? new Date(trip.start_date).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'TBD'}</p>
                          </div>
                       </div>
                       <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><UserCheck size={14}/></div>
                          <div className="overflow-hidden">
                             <p className="text-[9px] font-black text-slate-400 uppercase">Field Staff</p>
                             <p className="text-xs font-bold text-slate-800 truncate">{trip.logistics?.driver || 'None'}</p>
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                      <button onClick={() => handleOpenManifest(trip)} className="flex-1 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2" style={{ backgroundColor: APP_COLOR }}>
                        <Users size={16}/> Manifest
                      </button>
                      
                      <button 
                        onClick={() => {
                            const url = `${window.location.origin}/book/${trip.id}`;
                            navigator.clipboard.writeText(url);
                            alert('Booking Link copied to clipboard!\n\n' + url);
                        }} 
                        className="w-14 bg-white border border-slate-200 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-all shadow-sm" 
                        title="Copy Client Booking Link"
                      >
                        <Link size={18}/>
                      </button>
                      
                      <button onClick={() => openMasterEditor(trip)} className="w-14 bg-white border border-slate-200 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-all shadow-sm" title="Edit Full Trip Profile">
                        <Pencil size={18}/>
                      </button>
                      
                      {trip.status !== 'Dispatched' && (
                        <button onClick={() => handleUpdateTripStatus(trip.id, 'Dispatched')} className="w-14 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition-all shadow-md" title="Dispatch Trip">
                          <Send size={18}/>
                        </button>
                      )}
                  </div>
                </div>
              );
          })}
        </div>
      )}

      {/* 🌟 VERIFICATION SUCCESS / SHARE MODAL */}
      {verifiedPax && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                 <CheckCircle size={40} />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2">Verification Complete</h2>
              <p className="text-slate-500 font-medium mb-8">Funds for <strong>{verifiedPax.first_name}</strong> have been verified. Their Digital Passport is now fully unlocked.</p>
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-3 mb-6 text-left overflow-hidden">
                 <LinkIcon size={20} className="text-slate-400 shrink-0"/>
                 <span className="text-[10px] font-mono font-bold text-slate-500 truncate">{window.location.origin}/passport/{verifiedPax.booking_id}</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                 <button 
                   onClick={() => {
                      const url = `${window.location.origin}/passport/${verifiedPax.booking_id}`;
                      const msg = `Hi ${verifiedPax.first_name}! Your payment is verified. Here is your Digital Passport for the trip: ${url}`;
                      window.open(`https://wa.me/${verifiedPax.phone?.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`);
                   }}
                   className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                 >
                    <Share2 size={18}/> Share on WhatsApp
                 </button>
                 <button 
                   onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/passport/${verifiedPax.booking_id}`);
                      alert("Link Copied!");
                   }}
                   className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-black uppercase tracking-widest transition-all"
                 >
                    Copy Link
                 </button>
                 <button 
                    onClick={() => {
                        setPreviewBookingId(String(verifiedPax.booking_id));
                        setVerifiedPax(null);
                    }}
                    className="w-full mt-2 text-blue-500 font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:text-blue-600 transition-colors"
                 >
                    <Eye size={16}/> View Digital Passport
                 </button>
                 <button onClick={() => setVerifiedPax(null)} className="mt-4 text-slate-400 font-bold text-sm uppercase tracking-widest hover:text-slate-600 transition-colors">Close</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL 1: MASTER TRIP EDITOR */}
      {isEditingTrip && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60">
           <div className="bg-white w-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
              
              <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900">Master Trip Profile</h2>
                    <p className="text-xs font-black uppercase tracking-[0.2em] mt-1" style={{ color: APP_COLOR }}>{tripForm.trip_ref} • Global Configuration</p>
                  </div>
                  <button onClick={() => setIsEditingTrip(false)} className="p-3 bg-white border shadow-sm hover:text-red-500 rounded-full transition-all"><X/></button>
              </div>

              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                  <div className="w-full md:w-64 bg-slate-50 border-r border-slate-100 p-6 flex flex-col gap-2 shrink-0 overflow-y-auto">
                     <button onClick={() => setEditTab('basics')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all ${editTab === 'basics' ? 'bg-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`} style={editTab === 'basics' ? { color: APP_COLOR } : {}}><Globe size={18}/> Basics & Market</button>
                     <button onClick={() => setEditTab('finance')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all ${editTab === 'finance' ? 'bg-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`} style={editTab === 'finance' ? { color: APP_COLOR } : {}}><Wallet size={18}/> Pricing & Terms</button>
                     <button onClick={() => setEditTab('logistics')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all ${editTab === 'logistics' ? 'bg-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`} style={editTab === 'logistics' ? { color: APP_COLOR } : {}}><Briefcase size={18}/> Suppliers & Staff</button>
                     <button onClick={() => setEditTab('itinerary')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all ${editTab === 'itinerary' ? 'bg-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`} style={editTab === 'itinerary' ? { color: APP_COLOR } : {}}><ListPlus size={18}/> Daily Itinerary</button>
                  </div>

                  <div className="flex-1 p-8 overflow-y-auto bg-white space-y-8">
                     {/* TAB: BASICS */}
                     {editTab === 'basics' && (
                         <div className="space-y-6">
                            <h3 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Core Identity & Dates</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Trip Title</label><input type="text" value={tripForm.title} onChange={e => setTripForm({...tripForm, title: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none font-bold text-lg"/></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Marketing Subtitle</label><input type="text" value={tripForm.subtitle} onChange={e => setTripForm({...tripForm, subtitle: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-sm font-medium"/></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Description</label><textarea value={tripForm.description} onChange={e => setTripForm({...tripForm, description: e.target.value})} rows={3} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-sm"></textarea></div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Start Date</label><input type="date" value={tripForm.start_date} onChange={e => setTripForm({...tripForm, start_date: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm font-bold"/></div>
                                <div className="col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">End Date</label><input type="date" value={tripForm.end_date} onChange={e => setTripForm({...tripForm, end_date: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm font-bold"/></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Max Capacity</label><input type="number" value={tripForm.capacity} onChange={e => setTripForm({...tripForm, capacity: Number(e.target.value)})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm font-bold"/></div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Demographic</label>
                                    <select value={tripForm.marketing_data?.demographic || ''} onChange={e => setTripForm({...tripForm, marketing_data: {...tripForm.marketing_data, demographic: e.target.value}})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm font-bold"><option>All Ages</option><option>Adults Only (18+)</option><option>Corporate</option><option>Couples / Honeymoon</option></select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Difficulty</label>
                                    <select value={tripForm.marketing_data?.difficulty || ''} onChange={e => setTripForm({...tripForm, marketing_data: {...tripForm.marketing_data, difficulty: e.target.value}})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm font-bold"><option>Easy (Relaxation)</option><option>Moderate (Walking)</option><option>Strenuous (Hiking)</option></select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Visa Req?</label>
                                    <select value={tripForm.marketing_data?.visaRequired || ''} onChange={e => setTripForm({...tripForm, marketing_data: {...tripForm.marketing_data, visaRequired: e.target.value}})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm font-bold text-orange-600"><option>No</option><option>Yes (Required)</option><option>Visa on Arrival</option></select>
                                </div>
                            </div>
                         </div>
                     )}

                     {/* TAB: FINANCE */}
                     {editTab === 'finance' && (
                         <div className="space-y-6">
                            <h3 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Financials & Booking Terms</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Adult Price ({BASE_CURRENCY})</label><input type="number" value={tripForm.financials?.adultPrice || 0} onChange={e => setTripForm({...tripForm, financials: {...tripForm.financials, adultPrice: Number(e.target.value)}})} className="w-full bg-white border p-4 rounded-xl outline-none font-bold text-xl text-teal-700"/></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Child Price ({BASE_CURRENCY})</label><input type="number" value={tripForm.financials?.childPrice || 0} onChange={e => setTripForm({...tripForm, financials: {...tripForm.financials, childPrice: Number(e.target.value)}})} className="w-full bg-white border p-4 rounded-xl outline-none font-bold text-lg text-slate-600"/></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Infant Price ({BASE_CURRENCY})</label><input type="number" value={tripForm.financials?.infantPrice || 0} onChange={e => setTripForm({...tripForm, financials: {...tripForm.financials, infantPrice: Number(e.target.value)}})} className="w-full bg-white border p-4 rounded-xl outline-none font-bold text-lg text-slate-600"/></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Single Supplement ({BASE_CURRENCY})</label><input type="number" value={tripForm.financials?.singleSupplement || 0} onChange={e => setTripForm({...tripForm, financials: {...tripForm.financials, singleSupplement: Number(e.target.value)}})} className="w-full bg-white border p-4 rounded-xl outline-none font-bold text-slate-600"/></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Required Deposit ({BASE_CURRENCY})</label><input type="number" value={tripForm.financials?.requiredDeposit || 0} onChange={e => setTripForm({...tripForm, financials: {...tripForm.financials, requiredDeposit: Number(e.target.value)}})} className="w-full bg-white border p-4 rounded-xl outline-none font-bold text-slate-600"/></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Inclusions</label><textarea value={tripForm.terms?.inclusions || ''} onChange={e => setTripForm({...tripForm, terms: {...tripForm.terms, inclusions: e.target.value}})} rows={3} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-sm"></textarea></div>
                                <div><label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Exclusions</label><textarea value={tripForm.terms?.exclusions || ''} onChange={e => setTripForm({...tripForm, terms: {...tripForm.terms, exclusions: e.target.value}})} rows={3} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-sm"></textarea></div>
                            </div>
                         </div>
                     )}

                     {/* TAB: LOGISTICS */}
                     {editTab === 'logistics' && (
                         <div className="space-y-6">
                            <h3 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Vendors, Fleet & Staff</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <h4 className="font-black text-slate-700 mb-2 flex items-center gap-2"><UserCheck size={16}/> Field Team</h4>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 ml-2 mb-1 block uppercase">Assigned Driver</label>
                                        <select value={tripForm.logistics?.driver || ''} onChange={e => setTripForm({...tripForm, logistics: {...tripForm.logistics, driver: e.target.value}})} className="w-full bg-white border p-3 rounded-xl outline-none font-bold text-sm shadow-sm">
                                            <option value="">Unassigned</option>
                                            {staffDb.filter(s => s.role === 'Driver').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 ml-2 mb-1 block uppercase">Assigned Guide</label>
                                        <select value={tripForm.logistics?.guide || ''} onChange={e => setTripForm({...tripForm, logistics: {...tripForm.logistics, guide: e.target.value}})} className="w-full bg-white border p-3 rounded-xl outline-none font-bold text-sm shadow-sm">
                                            <option value="">Unassigned</option>
                                            {staffDb.filter(s => s.role === 'Guide').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <h4 className="font-black text-slate-700 mb-2 flex items-center gap-2"><Briefcase size={16}/> External Vendors</h4>
                                    
                                    <div className="space-y-2 mb-2">
                                        {(tripForm.logistics?.vendors || []).map((vendor: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm group">
                                                <div>
                                                    <span className="text-[9px] font-black uppercase text-slate-400 block">{vendor.category}</span>
                                                    <span className="font-bold text-sm text-slate-800 leading-tight">{vendor.name}</span>
                                                </div>
                                                <button onClick={() => {
                                                    const newVendors = [...tripForm.logistics.vendors];
                                                    newVendors.splice(idx, 1);
                                                    setTripForm({...tripForm, logistics: {...tripForm.logistics, vendors: newVendors}});
                                                }} className="text-slate-300 hover:text-red-500 transition-colors p-1"><X size={16}/></button>
                                            </div>
                                        ))}
                                    </div>

                                    <div>
                                        <select 
                                            value=""
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (!val) return;
                                                const selectedSup = suppliersDb.find(s => String(s.id) === val);
                                                if (selectedSup) {
                                                    const currentVendors = tripForm.logistics?.vendors || [];
                                                    if (!currentVendors.find((v:any) => v.id === selectedSup.id)) {
                                                        setTripForm({
                                                            ...tripForm, 
                                                            logistics: {
                                                                ...tripForm.logistics, 
                                                                vendors: [...currentVendors, { id: selectedSup.id, name: selectedSup.name, category: selectedSup.category || 'Vendor' }]
                                                            }
                                                        });
                                                    }
                                                }
                                            }}
                                            className="w-full bg-white border border-dashed border-teal-300 p-3 rounded-xl outline-none font-bold text-sm shadow-sm cursor-pointer hover:bg-teal-50 transition-colors"
                                            style={{ color: APP_COLOR, borderColor: APP_COLOR }}
                                        >
                                            <option value="">+ Assign Vendor / Supplier</option>
                                            {supplierCategories.map(cat => (
                                                <optgroup key={cat} label={cat}>
                                                    {suppliersDb.filter(s => (s.category || 'Other') === cat).map(s => (
                                                        <option key={s.id} value={s.id}>{s.name} {s.location ? `(${s.location})` : ''}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="pt-2">
                                        <label className="text-[10px] font-black text-slate-500 ml-2 mb-1 block uppercase">Vehicle / Flight Detail</label>
                                        <input type="text" placeholder="e.g. Bus Plate # / Flight No." value={tripForm.logistics?.vehicleDetail || ''} onChange={e => setTripForm({...tripForm, logistics: {...tripForm.logistics, vehicleDetail: e.target.value}})} className="w-full bg-white border p-3 rounded-xl outline-none font-bold text-sm font-mono shadow-sm"/>
                                    </div>
                                </div>
                            </div>
                         </div>
                     )}

                     {/* TAB: ITINERARY */}
                     {editTab === 'itinerary' && (
                         <div className="space-y-6">
                            <h3 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Daily Itinerary & Activities</h3>
                            
                            <div className="space-y-4">
                                {tripForm.itinerary?.map((step, index) => (
                                    <div key={step.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-4 relative pr-16 shadow-sm group hover:border-slate-300 transition-all">
                                        
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => moveItineraryStep(index, 'up')} disabled={index === 0} className="p-1.5 bg-white rounded-lg shadow-sm border text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={16}/></button>
                                            <button onClick={() => moveItineraryStep(index, 'down')} disabled={index === (tripForm.itinerary?.length || 0) - 1} className="p-1.5 bg-white rounded-lg shadow-sm border text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={16}/></button>
                                            
                                            {tripForm.itinerary!.length > 1 && (
                                                <button onClick={() => setTripForm(prev => ({...prev, itinerary: prev.itinerary?.filter(s => s.id !== step.id)}))} className="p-1.5 mt-2 bg-red-50 text-red-500 rounded-lg border border-red-100 hover:bg-red-500 hover:text-white transition-colors">
                                                    <Trash2 size={16}/>
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="w-full md:w-20">
                                                <label className="text-[10px] font-black uppercase text-slate-400">Day</label>
                                                <input type="number" value={step.day} onChange={e => handleUpdateItinerary(step.id, 'day', Number(e.target.value))} className="w-full p-3 bg-white rounded-xl border outline-none font-black text-center text-lg"/>
                                            </div>
                                            <div className="w-full md:w-32">
                                                <label className="text-[10px] font-black uppercase text-slate-400">Time</label>
                                                <input type="time" value={step.time} onChange={e => handleUpdateItinerary(step.id, 'time', e.target.value)} className="w-full p-3 bg-white rounded-xl border outline-none text-sm font-bold"/>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400">Activity Title</label>
                                                <input type="text" placeholder="e.g. Arrival & Check-in" value={step.title} onChange={e => handleUpdateItinerary(step.id, 'title', e.target.value)} className="w-full p-3 bg-white rounded-xl border outline-none text-sm font-bold"/>
                                            </div>
                                        </div>

                                        <div className="flex flex-col md:flex-row gap-4">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><MapPin size={10}/> Location</label>
                                                <input type="text" placeholder="e.g. Kotoka International Airport" value={step.location} onChange={e => handleUpdateItinerary(step.id, 'location', e.target.value)} className="w-full p-3 bg-white rounded-xl border outline-none text-sm font-medium"/>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Utensils size={10}/> Included Meals</label>
                                                <input type="text" placeholder="e.g. Breakfast, Dinner" value={step.meals} onChange={e => handleUpdateItinerary(step.id, 'meals', e.target.value)} className="w-full p-3 bg-white rounded-xl border outline-none text-sm font-medium text-orange-700"/>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400">Key Activities / Guide Notes</label>
                                            <textarea rows={2} placeholder="e.g. Remember to collect passports for hotel check-in..." value={step.notes} onChange={e => handleUpdateItinerary(step.id, 'notes', e.target.value)} className="w-full p-3 bg-white rounded-xl border outline-none text-sm"></textarea>
                                        </div>
                                    </div>
                                ))}
                                
                                <button onClick={() => setTripForm(prev => ({...prev, itinerary: [...(prev.itinerary || []), { id: Date.now(), day: 1, time: '08:00', title: '', location: '', meals: '', notes: '' }]}))} className="w-full py-4 border-2 border-dashed border-teal-300 text-teal-600 rounded-3xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-teal-50 transition-colors" style={{ color: APP_COLOR, borderColor: APP_COLOR }}>
                                    <Plus size={18}/> Add New Itinerary Step
                                </button>
                            </div>
                         </div>
                     )}

                  </div>
              </div>

              <div className="p-6 border-t bg-slate-50 flex justify-end rounded-b-[3rem]">
                  <button onClick={handleSaveMasterTrip} className="text-white px-10 py-5 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3" style={{ backgroundColor: APP_COLOR }}>
                      <Save size={22}/> Save Master Profile
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL 2: LIVE MANIFEST */}
      {selectedTrip && !isEditingTrip && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/60">
           <div className="bg-white w-full max-w-[95vw] md:max-w-7xl rounded-[4rem] z-10 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-white/20 animate-in slide-in-from-bottom-8 duration-300">
              <div className="p-10 border-b flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/50">
                 <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-4xl font-black text-slate-900 tracking-tight">{selectedTrip.title}</h2>
                      <div className="flex items-center gap-1 bg-emerald-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">Live Sync</div>
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Master Dispatch manifest • Group ID: {selectedTrip.trip_ref}</p>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-300 uppercase">Boarding Progress</span>
                        <span className="text-lg font-black" style={{ color: APP_COLOR }}>{manifestData.filter(p => p.boarded).length} / {manifestData.length}</span>
                    </div>
                    <button onClick={() => setSelectedTrip(null)} className="p-5 bg-white rounded-full shadow-sm border border-slate-100 hover:bg-red-50 hover:text-red-500 transition-all text-slate-400"><X size={24}/></button>
                 </div>
              </div>
              <div className="p-10 overflow-y-auto bg-white flex-1">
                 <table className="w-full text-left border-separate border-spacing-y-3">
                    <thead>
                       <tr className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em]">
                          <th className="px-6 py-4 w-20 text-center">Boarded</th>
                          <th className="px-6 py-4">Traveler Identity</th>
                          <th className="px-6 py-4">Logistics & Rooming</th>
                          <th className="px-6 py-4">Safety & Dietary</th>
                          <th className="px-6 py-4">Accounting</th>
                          <th className="px-6 py-4 text-center">Actions</th>
                       </tr>
                    </thead>
                    <tbody>
                       {manifestData.map((pax) => {
                         const needsVerification = pax.payment_status !== 'Full';

                         return (
                           <tr key={pax.id} className={`group shadow-sm transition-all ${pax.is_lead ? 'bg-slate-50 ring-1 ring-slate-200' : 'bg-white border-y border-slate-50 hover:bg-slate-50'}`}>
                               <td className="px-6 py-5 text-center rounded-l-[2rem]">
                                   <button onClick={() => handleToggleBoarding(pax)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${pax.boarded ? 'text-white shadow-lg' : 'bg-slate-50 text-slate-200 border-2 border-dashed border-slate-200 hover:border-teal-200'}`} style={pax.boarded ? { backgroundColor: APP_COLOR } : {}}><CheckCircle size={22}/></button>
                               </td>
                               <td className="px-6 py-5">
                                   <div className="flex items-center gap-4">
                                       <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xs ${pax.is_lead ? 'text-white shadow-md' : 'bg-slate-100 text-slate-400'}`} style={pax.is_lead ? { backgroundColor: APP_COLOR } : {}}>{pax.first_name?.[0] || '?'}{pax.last_name?.[0] || '?'}</div>
                                       <div>
                                         <div className="font-black text-slate-800 text-lg flex items-center gap-2">{pax.title || 'Mr'} {pax.first_name} {pax.last_name} {pax.is_lead && <span className="text-[8px] bg-slate-900 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Lead</span>}</div>
                                         <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2">
                                             <span>{pax.phone || 'No Phone'}</span> • <span>{pax.email || 'No Email'}</span>
                                         </div>
                                       </div>
                                   </div>
                               </td>
                               <td className="px-6 py-5">
                                   <div className="space-y-1">
                                       <div className="flex items-center gap-2 text-slate-700 font-bold text-sm"><BedDouble size={14} className="text-purple-500"/> {pax.room_preference || 'Standard'}</div>
                                       <div className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 w-fit px-2 py-0.5 rounded-md">Partner: <span className="text-slate-800">{pax.requested_roommate || 'Unassigned'}</span></div>
                                   </div>
                               </td>
                               <td className="px-6 py-5">
                                   <div className="flex flex-col gap-2">
                                       <div className={`flex items-center gap-2 px-2 py-1 rounded-lg w-fit text-[10px] font-black uppercase ${pax.dietary_needs && pax.dietary_needs !== 'None' ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'}`}><Utensils size={12}/> {pax.dietary_needs || 'Standard Diet'}</div>
                                       <div className={`flex items-center gap-2 text-xs font-bold ${pax.medical_info ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}><HeartPulse size={14}/> {pax.medical_info || 'No Medical History'}</div>
                                   </div>
                               </td>
                               
                               <td className="px-6 py-5">
                                   <div className="font-black text-slate-900 text-lg leading-none">{BASE_CURRENCY} {Number(pax.amount_paid || 0).toLocaleString()}</div>
                                   
                                   {needsVerification ? (
                                       <button 
                                           onClick={() => handleVerifyPayment(pax)}
                                           className="mt-2 bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white border border-amber-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors"
                                       >
                                           <AlertCircle size={12}/> Verify Funds
                                       </button>
                                   ) : (
                                       <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${pax.payment_status === 'Full' ? 'text-emerald-500' : 'text-blue-500'}`}>{pax.payment_status}</div>
                                   )}
                               </td>

                               <td className="px-6 py-5 text-center rounded-r-[2rem]">
                                   <div className="flex justify-center gap-2">
                                       <button 
                                          onClick={() => setPreviewBookingId(String(pax.booking_id))} 
                                          title="Preview Digital Passport"
                                          className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-all active:scale-95"
                                       >
                                           <Eye size={16}/>
                                       </button>
                                       <button 
                                          onClick={() => {
                                              const url = `${window.location.origin}/passport/${pax.booking_id}`;
                                              navigator.clipboard.writeText(url);
                                              alert(`Passport link copied for ${pax.first_name}!\n\n${url}`);
                                          }} 
                                          title="Copy Passenger Passport Link"
                                          className="p-3 bg-slate-900 text-white rounded-xl shadow-sm hover:bg-slate-700 transition-all active:scale-95"
                                       >
                                           <LinkIcon size={16}/>
                                       </button>
                                       <button onClick={() => { setPaxForm(pax); setIsEditingPax(true); }} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95"><Pencil size={16}/></button>
                                       <button onClick={() => handleDeletePassenger(pax.id, `${pax.first_name} ${pax.last_name}`)} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-400 hover:text-red-600 hover:border-red-200 transition-all active:scale-95"><Trash2 size={16}/></button>
                                   </div>
                               </td>
                           </tr>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* MODAL 3: PASSENGER PROFILE UPDATER */}
      {isEditingPax && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
           <div className="bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl p-12 overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-12 border-b pb-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-800">Update Traveler Profile</h2>
                  </div>
                  <button onClick={() => setIsEditingPax(false)} className="p-4 bg-slate-50 hover:bg-slate-100 rounded-full"><X/></button>
              </div>

              <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">Title</label>
                          <select value={paxForm.title || 'Mr'} onChange={e => setPaxForm({...paxForm, title: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 ring-teal-500/20 border-none">
                              <option>Mr</option><option>Mrs</option><option>Ms</option><option>Miss</option><option>Dr</option><option>Prof</option><option>Rev</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">First Name</label>
                          <input type="text" value={paxForm.first_name || ''} onChange={e => setPaxForm({...paxForm, first_name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 ring-teal-500/20 border-none"/>
                      </div>
                      <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">Last Name</label>
                          <input type="text" value={paxForm.last_name || ''} onChange={e => setPaxForm({...paxForm, last_name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 ring-teal-500/20 border-none"/>
                      </div>
                      <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-2 block">Phone Line</label>
                          <input type="text" value={paxForm.phone || ''} onChange={e => setPaxForm({...paxForm, phone: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 ring-teal-500/20 border-none"/>
                      </div>
                  </div>

                  <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100">
                      <h3 className="text-xs font-black uppercase text-slate-800 mb-6 flex items-center gap-2"><Wallet size={16}/> Payment Status</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div><label className="text-[10px] font-black uppercase text-slate-500 ml-2 mb-2 block">Amount Paid ({BASE_CURRENCY})</label><input type="number" value={paxForm.amount_paid || 0} onChange={e => setPaxForm({...paxForm, amount_paid: e.target.value})} className="w-full bg-white p-4 rounded-2xl outline-none font-black text-xl text-slate-900 shadow-sm border-none"/></div>
                         <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-2 mb-2 block">Status</label>
                            <select value={paxForm.payment_status || 'Pending'} onChange={e => setPaxForm({...paxForm, payment_status: e.target.value})} className="w-full bg-white p-4 rounded-2xl outline-none font-bold text-slate-900 shadow-sm border-none">
                               <option>Pending</option><option>Deposit</option><option>Full</option>
                            </select>
                         </div>
                      </div>
                  </div>

                  <button onClick={handleSavePassenger} className="w-full text-white py-6 rounded-[2.5rem] font-black text-xl shadow-2xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-4" style={{ backgroundColor: APP_COLOR }}>
                    <Save size={24}/> Sync Changes
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* 🌟 MODAL 4: PASSPORT PREVIEW (IFRAME) */}
      {previewBookingId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
           <div className="bg-slate-900  w-[45vh] h-[85vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border-4 border-slate-1000 animate-in zoom-in-95 duration-200 relative">
              <div className="flex justify-between items-center p-4 bg-slate-900 border-b border-slate-800 text-white">
                  <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400">Live Client View</h3>
                  </div>
                  <button onClick={() => setPreviewBookingId(null)} className="p-2 bg-slate-800 hover:bg-red-500 hover:text-white rounded-full transition-all text-slate-400"><X size={14}/></button>
              </div>
              
              <div className="flex-1 w-full relative bg-slate-50">
                  <iframe 
                      src={`${window.location.origin}/passport/${previewBookingId}`} 
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

// =========================================================================
// 3. FIELD OPERATIONS (MOBILE / DRIVER VIEW)
// =========================================================================

const FieldOperations: React.FC<{ subscriberId: string }> = ({ subscriberId }) => {
    const navigate = useNavigate();
    const { user } = useTenant();
    const [tours, setTours] = useState<Trip[]>([]);
    const APP_COLOR = user?.themeColor || '#0d9488';
    
    // 🌟 NEW SCANNER STATES
    const [activeTripForScanner, setActiveTripForScanner] = useState<string | number | null>(null);
    const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);
    const processingScan = useRef(false);
  
    useEffect(() => {
      const fetchMyTrips = async () => {
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('subscriber_id', subscriberId)
            .in('status', ['Dispatched', 'Active']) // Only show dispatched trips
            .or(`logistics->>driver.eq.${user?.fullName},logistics->>guide.eq.${user?.fullName}`);

        if (!error && data) setTours(data);
      };
      if (user?.fullName) fetchMyTrips();
    }, [user]);

    // 🌟 QR SCAN PROCESSING ENGINE
    const handleScan = async (text: string) => {
        // 1. Prevent double-scanning the same code rapidly
        if (processingScan.current) return;
        processingScan.current = true;
        setScanFeedback(null);

        try {
            // 2. Extract the Booking ID from the Pronomad Passport format
                if (!text.startsWith('pronomad:verify:')) {
                    throw new Error("Invalid QR Code. Please scan a valid Pronomad Passport.");
                }

                const bookingId = text.replace('pronomad:verify:', '');

                if (!bookingId) throw new Error("Corrupted QR Code.");

            // 3. Look up the passenger on THIS specific trip
            const { data: pax, error } = await supabase
                .from('passengers')
                .select('*')
                .eq('booking_id', bookingId)
                .eq('trip_id', activeTripForScanner)
                .single();

            if (error || !pax) {
                setScanFeedback({ type: 'error', message: "Passenger not found on this manifest!" });
                return;
            }

            // 4. Check Payment Verification
            if (pax.payment_status !== 'Full') {
                setScanFeedback({ type: 'warning', message: `STOP! ${pax.first_name} ${pax.last_name} has an unverified or pending balance. Do not board.` });
                // Play warning sound (optional)
                new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(()=>console.log('Audio blocked'));
                return;
            }

            // 5. Check if already boarded
            if (pax.boarded) {
                setScanFeedback({ type: 'warning', message: `${pax.first_name} is already checked in.` });
                return;
            }

            // 6. Update Database -> Boarded! (This triggers real-time updates to HQ)
            await supabase.from('passengers').update({ boarded: true }).eq('id', pax.id);
            
            // Success State
            setScanFeedback({ type: 'success', message: `✅ ${pax.first_name} ${pax.last_name} Boarded Successfully!` });
            new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3').play().catch(()=>console.log('Audio blocked'));

        } catch (e: any) {
            setScanFeedback({ type: 'error', message: e.message });
        } finally {
            // Cool down the scanner for 3 seconds before accepting a new scan
            setTimeout(() => { processingScan.current = false; }, 3000);
        }
    };
  
    return (
      <div className="animate-fade-in pb-24 max-w-md mx-auto">
        <div className="text-white p-8 rounded-b-[4rem] shadow-2xl mb-8 relative overflow-hidden" style={{ backgroundColor: APP_COLOR }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <h1 className="text-3xl font-black tracking-tight italic">PRONOMAD</h1>
          <p className="font-black text-[10px] uppercase tracking-[0.4em] mt-1 text-white/70">Field Logistics Live</p>
          
          <div className="mt-10 flex items-center gap-5">
             <div className="w-14 h-14 bg-white/20 border border-white/10 rounded-2xl flex items-center justify-center font-black text-xl">{user?.fullName?.[0]}</div>
             <div>
                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">Active Dispatcher</p>
                <p className="text-xl font-black">{user?.fullName}</p>
             </div>
          </div>
        </div>
  
        <div className="px-6 space-y-6">
          {tours.length === 0 ? (
              <div className="p-16 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center gap-4">
                  <Clock size={40} className="text-slate-200"/>
                  <p className="font-bold text-slate-400 text-sm">Waiting for trip assignments...</p>
              </div>
          ) : tours.map(tour => (
            <div key={tour.id} className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50 flex flex-col gap-6">
              <div className="flex justify-between items-center">
                 <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{tour.status}</span>
                 <span className="text-xs font-black text-slate-200">{tour.trip_ref}</span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 leading-tight">{tour.title}</h3>
                <div className="flex items-center gap-2 mt-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                   <MapPin size={14}/> {tour.logistics?.vehicleDetail || 'Unit Unassigned'}
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                  <button onClick={() => navigate(`/fleet`)} className="w-14 bg-slate-100 text-slate-500 rounded-3xl flex items-center justify-center shadow-sm hover:bg-slate-200 transition-all active:scale-95" title="Open GPS">
                      <Navigation size={18}/>
                  </button>
                  {/* 🌟 NEW BOARDING SCANNER BUTTON */}
                  <button 
                     onClick={() => setActiveTripForScanner(tour.id)} 
                     className="flex-1 text-white py-4 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all" 
                     style={{ backgroundColor: APP_COLOR }}
                  >
                      <ScanLine size={18}/> Scan & Board
                  </button>
              </div>
            </div>
          ))}
        </div>

        {/* 🌟 FULL SCREEN QR SCANNER MODAL */}
        {activeTripForScanner && (
           <div className="fixed inset-0 z-[500] bg-black flex flex-col animate-in slide-in-from-bottom-full duration-300">
               <div className="p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-10">
                   <div className="text-white">
                      <h3 className="font-black text-lg flex items-center gap-2"><QrCode size={18}/> Scan Passport</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Position QR Code in frame</p>
                   </div>
                   <button onClick={() => { setActiveTripForScanner(null); setScanFeedback(null); }} className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md active:scale-95"><X/></button>
               </div>

               {/* Camera Viewport */}
               <div className="flex-1 relative flex items-center justify-center bg-black">
                   <Scanner 
                    onScan={(result) => handleScan(result[0].rawValue)} 
                    components={{ zoom: true, finder: true }}
                    styles={{ container: { width: '100%', height: '100%' } }}
                    />
                   
                   {/* Scanner Overlay Target */}
                   <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                       <div className="w-64 h-64 border-4 border-white/30 rounded-[3rem] relative">
                           {/* Corner brackets for UI styling */}
                           <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-[3rem]"></div>
                           <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-[3rem]"></div>
                           <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-[3rem]"></div>
                           <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-[3rem]"></div>
                       </div>
                   </div>
               </div>

               {/* Live Feedback Toast */}
               <div className="absolute bottom-10 left-6 right-6">
                   {scanFeedback ? (
                       <div className={`p-6 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 zoom-in-95 duration-200
                          ${scanFeedback.type === 'success' ? 'bg-emerald-500 text-white' : 
                            scanFeedback.type === 'warning' ? 'bg-amber-400 text-amber-950' : 
                            'bg-red-500 text-white'}`}
                       >
                           {scanFeedback.type === 'success' ? <CheckCircle size={32} /> : <AlertTriangle size={32}/>}
                           <p className="font-black text-sm">{scanFeedback.message}</p>
                       </div>
                   ) : (
                       <div className="bg-white/10 backdrop-blur-xl p-6 rounded-[2rem] text-center border border-white/10">
                           <p className="text-white font-black text-sm">Waiting for scan...</p>
                           <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Hold device steady</p>
                       </div>
                   )}
               </div>
           </div>
        )}
      </div>
    );
};

const TourOperationsWrapper: React.FC = () => {
  const { user } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'Guide' || user?.role === 'Driver') {
      navigate('/field-app');
    }
  }, [user, navigate]);

  if (!user) return null;
  if (user.role === 'Guide' || user.role === 'Driver') return null;
  
  return <AdminOperations user={user} />;
};

export default TourOperationsWrapper;