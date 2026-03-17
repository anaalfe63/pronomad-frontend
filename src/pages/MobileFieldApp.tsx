import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { 
  MapPin, Users, Receipt, CheckCircle2, ChevronLeft,ChevronRight, Camera, 
  Bus, Clock, Phone, AlertTriangle, Home, Navigation, 
  Activity, CheckSquare, Coffee, ExternalLink
} from 'lucide-react';

interface PassengerData {
  id: string | number;
  first_name: string;
  last_name: string;
  phone?: string;
  seat_number?: string;
  boarded: boolean;
  dietary_reqs?: string;
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

  // Expense Form State
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // =====================================================================
  // 1. FETCH LIVE CLOUD DATA
  // =====================================================================
  useEffect(() => {
    const fetchFieldData = async () => {
      if (!user?.subscriberId || !user?.fullName) return;
      setLoading(true);
      try {
        // Find active trips for this tenant
        const { data: trips } = await supabase
          .from('trips')
          .select('*')
          .eq('subscriber_id', user.subscriberId)
          .neq('status', 'Completed');

        if (trips && trips.length > 0) {
          // Match the trip to the logged-in driver/guide
          const assignedTrip = trips.find(t => 
             t.logistics?.driver === user.fullName || 
             t.logistics?.guide === user.fullName
          ) || trips[0]; // Fallback to first trip for testing

          if (assignedTrip) {
            setMyTrip(assignedTrip);
            
            // Fetch the passengers for this specific trip
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
  // 2. FIELD ACTIONS (Sync to Supabase)
  // =====================================================================
  const handleCheckIn = async (paxId: string | number, currentStatus: boolean) => {
    // Optimistic UI Update
    setPassengers(prev => prev.map(p => p.id === paxId ? { ...p, boarded: !currentStatus } : p));
    
    // Cloud Sync
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
            category: 'Field Ops', 
            description: expenseDesc, 
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

  // Launch Google Maps
  const openGPS = (locationString: string) => {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationString)}`, '_blank');
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Activity className="text-slate-400 animate-spin" size={40}/></div>;
  }

  const boardedCount = passengers.filter(p => p.boarded).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl relative font-sans">
      
      {/* 📱 NATIVE APP HEADER (With Back & Home) */}
      <div className="bg-slate-900 text-white pt-10 pb-6 px-4 shadow-lg shrink-0 rounded-b-[2rem] sticky top-0 z-50">
        
        {/* Navigation Bar */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
             <p className="text-[10px] text-teal-400 uppercase tracking-widest font-bold">Field Operations</p>
             <h2 className="font-black text-sm">{user?.fullName || 'Agent'}</h2>
          </div>
          <button onClick={() => navigate('/landing')} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center">
            <Home size={18} />
          </button>
        </div>

        {/* Trip Overview Card */}
        {myTrip ? (
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="flex justify-between items-start mb-2">
                <span className="bg-teal-500 text-slate-900 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest">Active Dispatch</span>
                <span className="text-xs font-bold text-slate-300">{new Date(myTrip.start_date).toLocaleDateString()}</span>
            </div>
            <h1 className="text-xl font-black leading-tight mb-2">{myTrip.title}</h1>
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
              <span className="flex items-center gap-1"><Bus size={12} className="text-teal-400"/> {myTrip.logistics?.vehicleDetail || 'Assigned Vehicle'}</span>
              <span className="flex items-center gap-1"><Users size={12} className="text-teal-400"/> {boardedCount}/{passengers.length} Boarded</span>
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
            
            {/* Vehicle Pre-Check Widget */}
            <div className="bg-teal-50 border border-teal-100 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-teal-600 shadow-sm"><CheckSquare size={20}/></div>
                    <div>
                        <h4 className="font-black text-teal-900 text-sm">Vehicle Pre-Check</h4>
                        <p className="text-[10px] font-bold text-teal-600 uppercase">Required before departure</p>
                    </div>
                </div>
                <ChevronRight className="text-teal-400"/>
            </div>

            <h3 className="font-black text-slate-800 text-lg ml-2 mb-2 mt-6">Daily Route</h3>
            
            {(!myTrip.itinerary || myTrip.itinerary.length === 0) ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-100"><p className="text-slate-400 font-bold">No itinerary stops recorded.</p></div>
            ) : (
                myTrip.itinerary.map((step: any, index: number) => (
                  <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: APP_COLOR }}></div>
                    <div className="text-center shrink-0 w-16">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stop {index + 1}</p>
                      <p className="text-sm font-black text-slate-800 mt-1">{step.time || '00:00'}</p>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900">{step.activity || step.title}</h4>
                      <p className="text-xs text-slate-500 flex items-start gap-1 mt-1 font-medium"><MapPin size={12} className="shrink-0 mt-0.5"/> {step.location || 'Location TBA'}</p>
                      
                      {/* One-Tap Navigation Button */}
                      {step.location && (
                          <button onClick={() => openGPS(step.location)} className="mt-3 flex items-center gap-1.5 bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-colors">
                              <ExternalLink size={12}/> Get Directions
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
          <div className="space-y-3 animate-in fade-in">
            <div className="flex justify-between items-center ml-2 mb-4">
              <h3 className="font-black text-slate-800 text-lg">Passenger List</h3>
              <span className="bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">{passengers.length} Pax</span>
            </div>
            
            {passengers.length === 0 ? (
                 <div className="p-8 text-center bg-white rounded-2xl border border-slate-100"><p className="text-slate-400 font-bold">Manifest is empty.</p></div>
            ) : (
                passengers.map((pax) => (
                  <div key={pax.id} className={`p-4 rounded-2xl shadow-sm border transition-all ${pax.boarded ? 'bg-slate-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-3 border-b border-slate-50 pb-3">
                      <div>
                        <h4 className={`font-black text-base ${pax.boarded ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                            {pax.first_name} {pax.last_name}
                        </h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Seat {pax.seat_number || 'Any'}</p>
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
                    {(pax.dietary_reqs || pax.notes) && (
                        <div className="flex flex-wrap gap-2">
                           {pax.dietary_reqs && <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"><Coffee size={10}/> {pax.dietary_reqs}</span>}
                           {pax.notes && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"><AlertTriangle size={10}/> Note added</span>}
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Expense Amount (GHS)</label>
                <input 
                    type="number" 
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    placeholder="0.00" 
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-black text-2xl text-slate-800 mb-5 outline-none focus:border-teal-400 transition-colors"
                />
                
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Description / Reason</label>
                <input 
                    type="text" 
                    value={expenseDesc}
                    onChange={e => setExpenseDesc(e.target.value)}
                    placeholder="e.g. Emergency fuel, Toll booth..." 
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-bold text-sm mb-6 outline-none focus:border-teal-400 transition-colors"
                />
                
                <button className="w-full bg-slate-50 text-slate-500 border-2 border-dashed border-slate-200 py-6 rounded-2xl flex flex-col items-center justify-center gap-2 mb-6 cursor-not-allowed">
                  <Camera size={28}/>
                  <span className="font-bold text-xs">Photo Upload (Coming Soon)</span>
                </button>

                <button 
                    disabled={!expenseAmount || !expenseDesc || isSubmittingExpense}
                    onClick={handleExpenseSubmit} 
                    className="w-full text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                    style={{ backgroundColor: APP_COLOR }}
                >
                  {isSubmittingExpense ? 'Sending...' : 'Submit to Finance'}
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