import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { 
  MapPin, Users, Receipt, CheckCircle2, ChevronLeft, Camera, 
  Bus, Clock, Phone, AlertTriangle, Home, Navigation, 
  Activity, CheckSquare, Coffee, ExternalLink, Target, Map,
  Ticket, Droplets, Fuel, HeartPulse, BedDouble, Utensils,
  Search, Filter // <-- Added Search and Filter icons
} from 'lucide-react';

interface PassengerData {
  id: string | number;
  first_name: string;
  last_name: string;
  phone?: string;
  seat_number?: string;
  boarded: boolean;
  dietary_reqs?: string;
  dietary_needs?: string;
  medical_info?: string;
  room_preference?: string;
  notes?: string;
}

interface TripData {
  id: string | number;
  title: string;
  start_date: string;
  status: string;
  logistics: any;
  itinerary: any[];
}

const MobileFieldApp: React.FC = () => {
  const { user } = useTenant();
  const navigate = useNavigate();
  const APP_COLOR = user?.themeColor || '#0d9488';

  const [activeTab, setActiveTab] = useState<'itinerary' | 'manifest' | 'expenses'>('itinerary');
  const [myTrip, setMyTrip] = useState<TripData | null>(null);
  const [passengers, setPassengers] = useState<PassengerData[]>([]);
  const [loading, setLoading] = useState(true);

  // 🌟 Live Routing States
  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('');

  // 🌟 Expense Form State
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseType, setExpenseType] = useState<'Fuel' | 'Meal' | 'Ticket' | 'Misc'>('Fuel');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // 🌟 Manifest Search & Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'status' | 'name_asc' | 'name_desc'>('status');

  // =====================================================================
  // 1. FETCH LIVE CLOUD DATA
  // =====================================================================
  useEffect(() => {
    const fetchFieldData = async () => {
      if (!user?.subscriberId || !user?.fullName) return;
      setLoading(true);
      try {
        const { data: trips } = await supabase
          .from('trips')
          .select('*')
          .eq('subscriber_id', user.subscriberId)
          .neq('status', 'Completed');

        if (trips && trips.length > 0) {
          // Finds a trip where they are either the driver OR the guide
          const assignedTrip = trips.find(t => 
             t.logistics?.driver === user.fullName || 
             t.logistics?.guide === user.fullName
          ) || trips[0]; 

          if (assignedTrip) {
            setMyTrip(assignedTrip);
            
            // Auto-fill the Pickup Point from the Database Itinerary
            const firstStop = assignedTrip.itinerary?.[0]?.location;
            if (firstStop) {
                setPickupLocation(firstStop);
            } else if (assignedTrip.logistics?.pickup) {
                setPickupLocation(assignedTrip.logistics.pickup);
            }
            
            const { data: paxData } = await supabase
              .from('passengers')
              .select('*')
              .eq('trip_id', assignedTrip.id)
              .order('first_name', { ascending: true });
            
            if (paxData) setPassengers(paxData);
          }
        }
      } catch (error) {
        console.error("Failed to load field data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFieldData();
  }, [user]);

  // =====================================================================
  // 2. FIELD ACTIONS
  // =====================================================================
  const handleCheckIn = async (paxId: string | number, currentStatus: boolean) => {
    setPassengers(prev => prev.map(p => p.id === paxId ? { ...p, boarded: !currentStatus } : p));
    if (navigator.onLine) {
        await supabase.from('passengers').update({ boarded: !currentStatus }).eq('id', paxId);
    }
  };

  const handleExpenseSubmit = async () => {
    if (!expenseAmount || !expenseDesc || !user?.subscriberId) return;
    setIsSubmittingExpense(true);
    try {
        await supabase.from('expenses').insert([{ 
            subscriber_id: user.subscriberId, 
            submitter: user.fullName || 'Field Agent', 
            category: expenseType, 
            description: `${expenseDesc} (${myTrip?.title || 'Field Log'})`, 
            amount: Number(expenseAmount), 
            status: 'Pending', 
            date: new Date().toISOString() 
        }]);
        alert("Expense submitted to Finance successfully!"); 
        setExpenseAmount(''); 
        setExpenseDesc('');
    } catch (e) {
        alert("Error submitting expense.");
    } finally {
        setIsSubmittingExpense(false);
    }
  };

  const startGPSNavigation = () => {
      if (!destination) return alert("Please enter a destination to start routing.");
      const originParam = pickupLocation ? `&origin=${encodeURIComponent(pickupLocation)}` : '';
      const destParam = `&destination=${encodeURIComponent(destination)}`;
      window.open(`https://www.google.com/maps/dir/?api=1${originParam}${destParam}`, '_blank');
  };

  const openStopGPS = (locationString: string) => {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationString)}`, '_blank');
  };

  // =====================================================================
  // 3. SMART FILTER & SORT ENGINE
  // =====================================================================
  const filteredAndSortedPassengers = useMemo(() => {
      let result = passengers.filter(p => {
          const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
          return fullName.includes(searchQuery.toLowerCase());
      });

      result.sort((a, b) => {
          if (sortBy === 'status') {
              // If status is the same, sort alphabetically
              if (a.boarded === b.boarded) {
                  return a.first_name.localeCompare(b.first_name);
              }
              // Push unboarded (false) to the top!
              return a.boarded ? 1 : -1; 
          }
          if (sortBy === 'name_asc') {
              return a.first_name.localeCompare(b.first_name);
          }
          if (sortBy === 'name_desc') {
              return b.first_name.localeCompare(a.first_name);
          }
          return 0;
      });

      return result;
  }, [passengers, searchQuery, sortBy]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Activity className="text-slate-400 animate-spin" size={40}/></div>;
  }

  const boardedCount = passengers.filter(p => p.boarded).length;
  const roleDisplay = myTrip?.logistics?.driver === user?.fullName && myTrip?.logistics?.guide === user?.fullName 
    ? 'Driver-Guide' 
    : myTrip?.logistics?.driver === user?.fullName ? 'Lead Driver' : 'Tour Guide';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl relative font-sans">
      
      {/* 📱 NATIVE APP HEADER */}
      <div className="bg-slate-900 text-white pt-10 pb-6 px-4 shadow-lg shrink-0 rounded-b-[2.5rem] sticky top-0 z-50">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
             <p className="text-[10px] text-teal-400 uppercase tracking-widest font-bold">{roleDisplay}</p>
             <h2 className="font-black text-sm">{user?.fullName || 'Agent'}</h2>
          </div>
          <button onClick={() => navigate('/landing')} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center">
            <Home size={18} />
          </button>
        </div>

        {/* Trip Overview Card */}
        {myTrip ? (
          <div className="bg-white/10 backdrop-blur-md p-5 rounded-3xl border border-white/10">
            <div className="flex justify-between items-start mb-2">
                <span className="bg-teal-500 text-slate-900 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest">Active Dispatch</span>
                <span className="text-xs font-bold text-slate-300">{new Date(myTrip.start_date).toLocaleDateString()}</span>
            </div>
            <h1 className="text-xl font-black leading-tight mb-4">{myTrip.title}</h1>
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold bg-slate-950/30 p-3 rounded-xl">
              <span className="flex items-center gap-1.5"><Bus size={14} className="text-teal-400"/> {myTrip.logistics?.vehicleDetail || 'Assigned Vehicle'}</span>
              <span className="flex items-center gap-1.5"><Users size={14} className="text-teal-400"/> {boardedCount}/{passengers.length} Boarded</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <h1 className="text-xl font-black">No Active Trips</h1>
            <p className="text-xs text-slate-400 mt-1">You have no dispatches for today.</p>
          </div>
        )}
      </div>

      {/* 📱 MOBILE CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
        
        {/* --- TAB: ITINERARY & ROUTE --- */}
        {myTrip && activeTab === 'itinerary' && (
          <div className="space-y-4 animate-in slide-in-from-left-4">
            
            {/* LIVE ROUTING WIDGET */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                    <Map size={18} style={{ color: APP_COLOR }} />
                    <h4 className="font-black text-slate-800">Live GPS Routing</h4>
                </div>

                <div className="relative border-l-2 border-dashed border-slate-200 ml-3 pl-6 space-y-4">
                    <div className="relative">
                        <div className="absolute -left-[31px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 rounded-full" style={{ borderColor: APP_COLOR }}></div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pickup Point</label>
                        <input 
                            type="text" 
                            value={pickupLocation}
                            onChange={(e) => setPickupLocation(e.target.value)}
                            placeholder="Leave blank for live GPS..."
                            className="w-full bg-slate-50 border border-slate-100 text-slate-800 text-sm font-bold p-3 rounded-xl outline-none focus:ring-2 transition-all mt-1"
                            style={{ '--tw-ring-color': `${APP_COLOR}50` } as any}
                        />
                    </div>

                    <div className="relative">
                        <div className="absolute -left-[31px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-slate-800 rounded-full"></div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</label>
                        <input 
                            type="text" 
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            placeholder="Where are we heading?"
                            className="w-full bg-slate-50 border border-slate-100 text-slate-800 text-sm font-bold p-3 rounded-xl outline-none focus:ring-2 transition-all mt-1"
                            style={{ '--tw-ring-color': `${APP_COLOR}50` } as any}
                        />
                    </div>
                </div>

                <button 
                    onClick={startGPSNavigation}
                    disabled={!destination}
                    className="w-full mt-6 text-white font-black py-4 rounded-xl shadow-lg hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                    style={{ backgroundColor: APP_COLOR }}
                >
                    <Navigation size={18} className="fill-white"/> Start Navigation
                </button>
            </div>

            <h3 className="font-black text-slate-800 text-lg ml-2 mb-2 mt-6">Daily Schedule</h3>
            
            {(!myTrip.itinerary || myTrip.itinerary.length === 0) ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-100"><p className="text-slate-400 font-bold">No itinerary stops recorded.</p></div>
            ) : (
                myTrip.itinerary.map((step: any, index: number) => (
                  <div key={index} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex gap-4 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: APP_COLOR }}></div>
                    <div className="text-center shrink-0 w-12 pt-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stop {index + 1}</p>
                      <p className="text-sm font-black text-slate-800 mt-1">{step.time || '00:00'}</p>
                    </div>
                    <div className="flex-1 border-l border-slate-100 pl-4">
                      <h4 className="font-black text-slate-900 text-base">{step.activity || step.title}</h4>
                      {step.location && <p className="text-xs text-slate-500 flex items-start gap-1 mt-1.5 font-bold"><MapPin size={12} className="shrink-0 mt-0.5"/> {step.location}</p>}
                      {step.meals && <p className="text-[10px] text-orange-600 flex items-start gap-1 mt-2 font-black uppercase tracking-widest bg-orange-50 w-fit px-2 py-1 rounded-lg"><Utensils size={12} className="shrink-0 mt-0.5"/> {step.meals}</p>}
                      {step.notes && (
                          <div className="mt-3 bg-slate-50 p-3 rounded-xl text-xs font-medium text-slate-600 border border-slate-100 leading-snug">
                              <span className="font-black text-slate-800 block mb-1">Guide Notes:</span>
                              {step.notes}
                          </div>
                      )}
                      {step.location && (
                          <button onClick={() => openStopGPS(step.location)} className="mt-4 flex items-center gap-1.5 bg-slate-50 text-slate-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-colors w-fit">
                              <ExternalLink size={12}/> Route Here
                          </button>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* --- TAB: MANIFEST --- */}
        {myTrip && activeTab === 'manifest' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-right-4">
            
            {/* SEARCH & SORT HEADER */}
            <div className="flex flex-col gap-3 mb-4 ml-2 mr-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-slate-800 text-lg">Passenger List</h3>
                  <span className="bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">{passengers.length} Pax</span>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search passengers..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 shadow-sm transition-all"
                            style={{ '--tw-ring-color': `${APP_COLOR}50` } as any}
                        />
                    </div>
                    <div className="relative shrink-0">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <Filter size={16} />
                        </div>
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-white border border-slate-200 pl-9 pr-8 py-2.5 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 shadow-sm appearance-none cursor-pointer"
                            style={{ '--tw-ring-color': `${APP_COLOR}50` } as any}
                        >
                            <option value="status">Pending First</option>
                            <option value="name_asc">Name (A-Z)</option>
                            <option value="name_desc">Name (Z-A)</option>
                        </select>
                    </div>
                </div>
            </div>
            
            {filteredAndSortedPassengers.length === 0 ? (
                 <div className="p-8 text-center bg-white rounded-2xl border border-slate-100">
                    <p className="text-slate-400 font-bold">
                        {searchQuery ? 'No passengers match your search.' : 'Manifest is empty.'}
                    </p>
                 </div>
            ) : (
                filteredAndSortedPassengers.map((pax) => (
                  <div key={pax.id} className={`p-5 rounded-3xl shadow-sm border-2 transition-all ${pax.boarded ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-transparent shadow-slate-200/50'}`}>
                    <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-3">
                      <div>
                        <h4 className={`font-black text-lg ${pax.boarded ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            {pax.first_name} {pax.last_name}
                        </h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Seat {pax.seat_number || 'Any'} • {pax.room_preference || 'Standard Room'}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                          {pax.phone && (
                              <a href={`tel:${pax.phone}`} className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center hover:bg-blue-100 transition-colors">
                                  <Phone size={16}/>
                              </a>
                          )}
                          <button 
                              onClick={() => handleCheckIn(pax.id, !!pax.boarded)} 
                              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors active:scale-90 shadow-sm
                                  ${pax.boarded ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'}`}
                          >
                            <CheckCircle2 size={24}/>
                          </button>
                      </div>
                    </div>
                    
                    {/* Insights for Guide */}
                    {(pax.dietary_reqs || pax.dietary_needs || pax.medical_info || pax.notes) && (
                        <div className="flex flex-wrap gap-2 mt-2">
                           {(pax.dietary_reqs || pax.dietary_needs) && <span className="bg-orange-50 text-orange-700 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1"><Coffee size={12}/> {pax.dietary_reqs || pax.dietary_needs}</span>}
                           {pax.medical_info && <span className="bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 animate-pulse"><HeartPulse size={12}/> Medical Alert</span>}
                           {pax.notes && <span className="bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1"><AlertTriangle size={12}/> Notes</span>}
                        </div>
                    )}
                  </div>
                ))
            )}
          </div>
        )}

        {/* --- TAB: EXPENSES --- */}
        {activeTab === 'expenses' && (
          <div className="animate-in slide-in-from-right-4">
             <h3 className="font-black text-slate-800 text-lg ml-2 mb-4">Log Field Expense</h3>
             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                
                <div className="grid grid-cols-4 gap-2 mb-6">
                    <button onClick={() => setExpenseType('Fuel')} className={`p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors ${expenseType === 'Fuel' ? 'bg-emerald-50 border-emerald-200 shadow-inner text-emerald-600' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}><Fuel size={20} /><span className="font-black text-[9px] uppercase tracking-widest">Fuel</span></button>
                    <button onClick={() => setExpenseType('Meal')} className={`p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors ${expenseType === 'Meal' ? 'bg-orange-50 border-orange-200 shadow-inner text-orange-600' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}><Coffee size={20} /><span className="font-black text-[9px] uppercase tracking-widest">Meal</span></button>
                    <button onClick={() => setExpenseType('Ticket')} className={`p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors ${expenseType === 'Ticket' ? 'bg-blue-50 border-blue-200 shadow-inner text-blue-600' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}><Ticket size={20} /><span className="font-black text-[9px] uppercase tracking-widest">Ticket</span></button>
                    <button onClick={() => setExpenseType('Misc')} className={`p-4 border rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors ${expenseType === 'Misc' ? 'bg-slate-100 border-slate-300 shadow-inner text-slate-700' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}><Receipt size={20} /><span className="font-black text-[9px] uppercase tracking-widest">Misc</span></button>
                </div>

                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Amount Spent</label>
                <input 
                    type="number" 
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    placeholder="0.00" 
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-black text-3xl text-slate-800 mb-5 outline-none focus:ring-2 transition-colors"
                    style={{ '--tw-ring-color': `${APP_COLOR}50` } as any}
                />
                
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Description / Reason</label>
                <input 
                    type="text" 
                    value={expenseDesc}
                    onChange={e => setExpenseDesc(e.target.value)}
                    placeholder="e.g. Emergency fuel, Toll booth..." 
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold text-sm mb-6 outline-none focus:ring-2 transition-colors"
                    style={{ '--tw-ring-color': `${APP_COLOR}50` } as any}
                />

                <button 
                    disabled={!expenseAmount || !expenseDesc || isSubmittingExpense}
                    onClick={handleExpenseSubmit} 
                    className="w-full text-white font-black py-5 rounded-[1.5rem] shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:grayscale text-lg"
                    style={{ backgroundColor: APP_COLOR }}
                >
                  {isSubmittingExpense ? 'Sending...' : 'Submit to Ledger'}
                </button>
             </div>
          </div>
        )}
      </div>

      {/* 📱 BOTTOM NAVIGATION BAR */}
      <div className="bg-white/90 backdrop-blur-xl border-t border-slate-200 fixed bottom-0 left-0 w-full md:max-w-md md:left-1/2 md:-translate-x-1/2 pb-safe shadow-[0_-20px_40px_rgba(0,0,0,0.05)] z-50">
        <div className="flex justify-around p-2 px-4">
          <button onClick={() => setActiveTab('itinerary')} className={`flex flex-col items-center p-3 rounded-2xl transition-all w-24 ${activeTab === 'itinerary' ? 'text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} style={activeTab === 'itinerary' ? { backgroundColor: APP_COLOR } : {}}>
            <Navigation size={22} className={activeTab === 'itinerary' ? 'fill-current opacity-80' : ''}/>
            <span className="text-[10px] font-black uppercase tracking-widest mt-1">Route</span>
          </button>
          
          <button onClick={() => setActiveTab('manifest')} className={`flex flex-col items-center p-3 rounded-2xl transition-all w-24 ${activeTab === 'manifest' ? 'text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} style={activeTab === 'manifest' ? { backgroundColor: APP_COLOR } : {}}>
            <Users size={22} className={activeTab === 'manifest' ? 'fill-current opacity-80' : ''}/>
            <span className="text-[10px] font-black uppercase tracking-widest mt-1">Manifest</span>
          </button>

          <button onClick={() => setActiveTab('expenses')} className={`flex flex-col items-center p-3 rounded-2xl transition-all w-24 ${activeTab === 'expenses' ? 'text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} style={activeTab === 'expenses' ? { backgroundColor: APP_COLOR } : {}}>
            <Receipt size={22} className={activeTab === 'expenses' ? 'fill-current opacity-80' : ''}/>
            <span className="text-[10px] font-black uppercase tracking-widest mt-1">Expenses</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default MobileFieldApp;