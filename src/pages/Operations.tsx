import React, { useState, useEffect, useCallback } from 'react';
import { useTenant } from '../contexts/TenantContext'; 
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom'; 
import { 
  Users, CheckCircle, Clock, MapPin, Send, Plus, X, Pencil, Save, Wallet,
  Navigation, CloudUpload, RefreshCw, BedDouble, Utensils, 
  HeartPulse, Briefcase, Search, UserCheck, Trash2, Globe, ListPlus,
  CloudOff
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
  // 🌟 DYNAMIC TENANT SETTINGS
  const APP_COLOR = user?.themeColor || '#0d9488';
  const BASE_CURRENCY = user?.currency || 'GHS';

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

      const [tripsResponse, suppliersResponse, staffResponse] = await Promise.all([
        supabase.from('trips').select('*').eq('subscriber_id', user.subscriberId),
        supabase.from('suppliers').select('*').eq('subscriber_id', user.subscriberId),
        supabase.from('staff').select('*').eq('subscriber_id', user.subscriberId)
      ]);

      if (tripsResponse.data) {
         const tripIds = tripsResponse.data.map(t => t.id);
         let paxCounts: Record<string, number> = {};
         
         if (tripIds.length > 0) {
             const { data: paxData } = await supabase
                 .from('passengers')
                 .select('trip_id')
                 .in('trip_id', tripIds);
                 
             if (paxData) {
                 paxData.forEach(pax => {
                     paxCounts[pax.trip_id] = (paxCounts[pax.trip_id] || 0) + 1;
                 });
             }
         }

         const tripsWithLiveCounts = tripsResponse.data.map(trip => ({
             ...trip,
             passenger_count: paxCounts[trip.id] || 0
         }));

         setTrips(tripsWithLiveCounts);
      }
      
      if (suppliersResponse.data) setSuppliersDb(suppliersResponse.data);
      if (staffResponse.data) setStaffDb(staffResponse.data);

    } catch (e) { console.error("Database Sync Error:", e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user?.subscriberId]);

  // --- MANIFEST ACTIONS (WITH SMART FINANCIAL SYNC) ---
  const handleOpenManifest = async (trip: Trip) => {
    setSelectedTrip(trip);
    try {
        // 1. Fetch passengers AND pull their parent booking data!
        const { data, error } = await supabase
            .from('passengers')
            .select('*, bookings(amount_paid, payment_status)')
            .eq('trip_id', trip.id);

        if (error) throw error;

        // 2. Intelligently merge the financial data
        const enrichedManifest = (data || []).map((pax: any) => {
            let finalAmount = Number(pax.amount_paid) || 0;
            let finalStatus = pax.payment_status;

            // If the passenger doesn't have individual payment info, inherit from the Master Booking!
            if (pax.bookings) {
                // If they are the Lead Passenger, show the master payment amount
                if (finalAmount === 0 && pax.is_lead) {
                    finalAmount = Number(pax.bookings.amount_paid) || 0;
                }
                // Apply the master booking status (e.g., 'Full' or 'Deposit') to everyone in their group
                if (!finalStatus || finalStatus === 'Pending') {
                    finalStatus = pax.bookings.payment_status || 'Pending';
                }
            }

            return {
                ...pax,
                amount_paid: finalAmount,
                payment_status: finalStatus || 'Pending'
            };
        });

        setManifestData(enrichedManifest);

        // 🌟 AUTO-HEAL: Fix mismatched passenger counts instantly
        if (data && data.length !== trip.passenger_count) {
            setTrips(prev => prev.map(t => t.id === trip.id ? { ...t, passenger_count: data.length } : t));
            setSelectedTrip(prev => ({ ...prev!, passenger_count: data.length }));
            
            if (navigator.onLine) {
                await supabase.from('trips').update({ passenger_count: data.length }).eq('id', trip.id);
            }
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
          setPendingSyncs(prev => [...prev, {
              id: Date.now(), table: 'passengers', action: 'UPDATE', recordId: pax.id, payload: { boarded: newStatus }
          }]);
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

              if (selectedTrip) {
                 await supabase.from('trips').update({ passenger_count: newCount }).eq('id', selectedTrip.id);
              }
          } catch(e) {
              setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'passengers', action: 'DELETE', recordId: paxId, payload: {} }]);
              if (selectedTrip) {
                  setPendingSyncs(prev => [...prev, { id: Date.now() + 1, table: 'trips', action: 'UPDATE', recordId: selectedTrip.id, payload: { passenger_count: newCount } }]);
              }
          }
      }
  };

  // 🟢 BULLETPROOF PASSENGER UPDATER
  const handleSavePassenger = async () => {
    // 1. Ensure numbers are strictly formatted
    const cleanAmount = Number(paxForm.amount_paid) || 0;
    
    const payload = {
        title: paxForm.title, 
        first_name: paxForm.first_name, 
        last_name: paxForm.last_name,
        phone: paxForm.phone, 
        email: paxForm.email, 
        passport_no: paxForm.passport_no,
        room_preference: paxForm.room_preference, 
        requested_roommate: paxForm.requested_roommate,
        amount_paid: cleanAmount, // 👈 Strict number conversion
        payment_status: paxForm.payment_status || 'Pending',
        dietary_needs: paxForm.dietary_needs, 
        medical_info: paxForm.medical_info
    };

    // 2. Instantly update UI so you don't have to wait
    setIsEditingPax(false);
    setManifestData(prev => prev.map(p => String(p.id) === String(paxForm.id) ? { ...p, ...payload } as Passenger : p));

    try {
      if (!navigator.onLine) throw new Error("Offline");
      
      // 3. Send to Supabase AND demand a response (.select)
      const { data, error } = await supabase
          .from('passengers')
          .update(payload)
          .eq('id', paxForm.id)
          .select(); // 👈 This forces Supabase to send back the updated row

      if (error) throw error;

      // 4. If Supabase returns an empty array, the ID didn't match!
      if (!data || data.length === 0) {
          alert(`Warning: Supabase could not find Passenger ID ${paxForm.id} in the database. The update failed.`);
      } else {
          console.log("✅ Successfully saved to cloud:", data[0]);
      }

    } catch (e: any) { 
      console.error("SAVE ERROR:", e);
      alert(`Cloud Sync Error: ${e.message}`);
      
      // Push to offline queue if network fails
      setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'passengers', action: 'UPDATE', recordId: paxForm.id as string, payload: payload }]);
    }
  };

  // --- TRIP ACTIONS ---
  const handleUpdateTripStatus = async (tripId: string | number, newStatus: string) => {
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: newStatus } : t));

    try {
      if (!navigator.onLine) throw new Error("Offline");
      const { error } = await supabase.from('trips').update({ status: newStatus }).eq('id', tripId);
      if (error) throw error;
    } catch (e) {
      setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'trips', action: 'UPDATE', recordId: tripId, payload: { status: newStatus } }]);
    }
  };

  const handleDeleteTrip = async (tripId: string | number, tripTitle: string) => {
      if(window.confirm(`⚠️ DANGER: Delete "${tripTitle}" and ALL its passengers?`)) {
          const { error } = await supabase.from('trips').delete().eq('id', tripId);
          if (!error) setTrips(prev => prev.filter(t => t.id !== tripId));
      }
  };

  const openMasterEditor = (trip: Trip) => {
      setTripForm({
          ...trip,
          start_date: trip.start_date ? new Date(trip.start_date).toISOString().split('T')[0] : '',
          end_date: trip.end_date ? new Date(trip.end_date).toISOString().split('T')[0] : '',
          marketing_data: trip.marketing_data || {},
          financials: trip.financials || {},
          terms: trip.terms || {},
          logistics: trip.logistics || {},
          itinerary: trip.itinerary || [],
          transport_modes: trip.transport_modes || ['Bus']
      });
      setEditTab('basics');
      setIsEditingTrip(true);
  };

  const handleSaveMasterTrip = async () => {
    const payload = {
        title: tripForm.title, subtitle: tripForm.subtitle, description: tripForm.description,
        start_date: tripForm.start_date, end_date: tripForm.end_date, capacity: tripForm.capacity,
        marketing_data: tripForm.marketing_data, financials: tripForm.financials, terms: tripForm.terms,
        logistics: tripForm.logistics, itinerary: tripForm.itinerary, transport_modes: tripForm.transport_modes
    };

    setIsEditingTrip(false);
    setTrips(prev => prev.map(t => t.id === tripForm.id ? { ...t, ...payload } as Trip : t));

    try {
      if (!navigator.onLine) throw new Error("Offline");
      const { error } = await supabase.from('trips').update(payload).eq('id', tripForm.id);
      if (error) throw error;
    } catch (e) {
      setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'trips', action: 'UPDATE', recordId: tripForm.id as string, payload: payload }]);
    }
  };

  const handleUpdateItinerary = (id: number, field: string, value: any) => {
      setTripForm(prev => ({
          ...prev, itinerary: prev.itinerary?.map(step => step.id === id ? { ...step, [field]: value } : step)
      }));
  };

  const filteredTrips = trips.filter(t => t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || t.trip_ref?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="animate-fade-in pb-20">
      
      {/* HEADER WITH OFFLINE STATUS */}
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
                 <div className="flex items-center gap-1 text-slate-300" title="Cloud Synced">
                    <CloudUpload size={20}/>
                 </div>
             )}
          </div>
          <p className="text-slate-500 font-medium mt-1">Live management of dispatch, manifests, and traveler safety.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
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
                      <button onClick={() => handleDeleteTrip(trip.id, trip.title)} className="text-slate-300 hover:text-red-500 transition-colors p-2" title="Delete Trip"><Trash2 size={18}/></button>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 ml-2 mb-1 block uppercase">Assigned Driver</label>
                                        <select value={tripForm.logistics?.driver || ''} onChange={e => setTripForm({...tripForm, logistics: {...tripForm.logistics, driver: e.target.value}})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none font-bold text-sm">
                                            <option value="">Unassigned</option>{staffDb.filter(s => s.role === 'Driver').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 ml-2 mb-1 block uppercase">Assigned Guide</label>
                                        <select value={tripForm.logistics?.guide || ''} onChange={e => setTripForm({...tripForm, logistics: {...tripForm.logistics, guide: e.target.value}})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none font-bold text-sm">
                                            <option value="">Unassigned</option>{staffDb.filter(s => s.role === 'Guide').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 ml-2 mb-1 block uppercase">Vehicle / Flight Detail</label>
                                        <input type="text" value={tripForm.logistics?.vehicleDetail || ''} onChange={e => setTripForm({...tripForm, logistics: {...tripForm.logistics, vehicleDetail: e.target.value}})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none font-bold text-sm font-mono"/>
                                    </div>
                                </div>
                            </div>
                         </div>
                     )}

                     {/* TAB: ITINERARY */}
                     {editTab === 'itinerary' && (
                         <div className="space-y-6">
                            <h3 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Daily Itinerary</h3>
                            <div className="space-y-4">
                                {tripForm.itinerary?.map((step) => (
                                    <div key={step.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col md:flex-row gap-4 relative pr-10">
                                        <div className="w-16"><label className="text-[10px] font-black uppercase text-slate-400">Day</label><input type="number" value={step.day} onChange={e => handleUpdateItinerary(step.id, 'day', Number(e.target.value))} className="w-full p-2 bg-white rounded-lg border outline-none font-bold text-center"/></div>
                                        <div className="w-28"><label className="text-[10px] font-black uppercase text-slate-400">Time</label><input type="time" value={step.time} onChange={e => handleUpdateItinerary(step.id, 'time', e.target.value)} className="w-full p-2 bg-white rounded-lg border outline-none text-sm"/></div>
                                        <div className="flex-1"><label className="text-[10px] font-black uppercase text-slate-400">Title</label><input type="text" value={step.title} onChange={e => handleUpdateItinerary(step.id, 'title', e.target.value)} className="w-full p-2 bg-white rounded-lg border outline-none text-sm font-bold"/></div>
                                        <div className="flex-1"><label className="text-[10px] font-black uppercase text-slate-400">Location</label><input type="text" value={step.location} onChange={e => handleUpdateItinerary(step.id, 'location', e.target.value)} className="w-full p-2 bg-white rounded-lg border outline-none text-sm"/></div>
                                        
                                        {tripForm.itinerary!.length > 1 && (
                                            <button onClick={() => setTripForm(prev => ({...prev, itinerary: prev.itinerary?.filter(s => s.id !== step.id)}))} className="absolute top-1/2 -translate-y-1/2 right-4 text-slate-300 hover:text-red-500"><X size={16}/></button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => setTripForm(prev => ({...prev, itinerary: [...(prev.itinerary || []), { id: Date.now(), day: 1, time: '', title: '', location: '', notes: '' }]}))} className="w-full py-3 border-2 border-dashed border-teal-300 text-teal-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-teal-50" style={{ color: APP_COLOR, borderColor: APP_COLOR }}>
                                    <Plus size={16}/> Add Step
                                </button>
                            </div>
                         </div>
                     )}

                  </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t bg-slate-50 flex justify-end">
                  <button onClick={handleSaveMasterTrip} className="text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2" style={{ backgroundColor: APP_COLOR }}>
                      <Save size={20}/> Save Changes
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
                       {manifestData.map((pax) => (
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
                               <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${pax.payment_status === 'Full' ? 'text-emerald-500' : 'text-amber-500'}`}>{pax.payment_status || 'Pending'}</div>
                            </td>
                            <td className="px-6 py-5 text-center rounded-r-[2rem]">
                               <div className="flex justify-center gap-2">
                                   <button onClick={() => { setPaxForm(pax); setIsEditingPax(true); }} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95"><Pencil size={16}/></button>
                                   <button onClick={() => handleDeletePassenger(pax.id, `${pax.first_name} ${pax.last_name}`)} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-400 hover:text-red-600 hover:border-red-200 transition-all active:scale-95"><Trash2 size={16}/></button>
                               </div>
                            </td>
                         </tr>
                       ))}
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
  
    useEffect(() => {
      const fetchMyTrips = async () => {
        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('subscriber_id', subscriberId)
            .or(`logistics->>driver.eq.${user?.fullName},logistics->>guide.eq.${user?.fullName}`);

        if (!error && data) setTours(data);
      };
      if (user?.fullName) fetchMyTrips();
    }, [user]);
  
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
                  <button onClick={() => navigate(`/fleet`)} className="flex-1 text-white py-4 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all" style={{ backgroundColor: APP_COLOR }}>
                      <Navigation size={18}/> Go Live (GPS)
                  </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
};

const Operations: React.FC = () => {
  const { user } = useTenant();
  if (!user) return null;
  if (user.role === 'Guide' || user.role === 'Driver') return <FieldOperations subscriberId={user.subscriberId} />;
  return <AdminOperations user={user} />;
};

export default Operations;