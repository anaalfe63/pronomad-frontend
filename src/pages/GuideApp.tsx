import React, { useState, useEffect } from 'react';
import { 
  Phone, CheckCircle, MapPin, AlertTriangle, Search, 
  Menu, X, LayoutDashboard, User, LogOut, Clock, 
  Users, ChevronRight, ShieldAlert, Activity, 
  UserPlus, MessageSquare, FileText, Coffee, Bus,
  Receipt, Navigation, Ticket, Map
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface PassengerData { id: string | number; first_name: string; last_name: string; phone?: string; seat_number?: string; boarded: boolean; dietary_reqs?: string; notes?: string; trip_id?: string | number; }
interface TripData { id: string | number; title: string; trip_ref: string; status: string; logistics?: any; itinerary?: any[]; }

const GuideApp: React.FC = () => {
  const { user, logout } = useTenant();
  const navigate = useNavigate();
  const APP_COLOR = user?.themeColor || '#0d9488';

  const [activeTrip, setActiveTrip] = useState<TripData | null>(null);
  const [passengers, setPassengers] = useState<PassengerData[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'missing' | 'boarded'>('all');

  // 🌟 NEW: Live Routing States
  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('');

  // --- MODAL STATES ---
  const [selectedPax, setSelectedPax] = useState<PassengerData | null>(null);
  
  // Walk-In State
  const [showAddWalkIn, setShowAddWalkIn] = useState(false);
  const [walkInForm, setWalkInForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [isAddingWalkIn, setIsAddingWalkIn] = useState(false);

  // Expense Logger State
  const [showExpenseLogger, setShowExpenseLogger] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseType, setExpenseType] = useState<'Meal' | 'Ticket' | 'Fuel' | 'Misc'>('Meal');
  const [expenseDesc, setExpenseDesc] = useState<string>('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // =====================================================================
  // 1. FETCH CLOUD MANIFEST & ITINERARY
  // =====================================================================
  useEffect(() => {
    const fetchManifest = async () => {
      if (!user?.subscriberId || !user?.fullName) return;
      try {
        const { data: trips } = await supabase.from('trips').select('*').eq('subscriber_id', user.subscriberId).neq('status', 'Completed');
        if (trips && trips.length > 0) {
          const myTrip = trips.find(t => t.logistics?.guide === user.fullName || t.logistics?.driver === user.fullName) || trips[0];
          if (myTrip) {
            setActiveTrip(myTrip);
            
            // 🌟 Auto-fill the Pickup Point from the Database Itinerary
            const firstStop = myTrip.itinerary?.[0]?.location;
            if (firstStop) {
                setPickupLocation(firstStop);
            } else if (myTrip.logistics?.pickup) {
                setPickupLocation(myTrip.logistics.pickup);
            }

            const { data: paxData } = await supabase.from('passengers').select('*').eq('trip_id', myTrip.id).order('first_name', { ascending: true });
            if (paxData) setPassengers(paxData);
          }
        }
      } catch (e) { console.error("Failed to load trip data", e); } finally { setLoading(false); }
    };
    fetchManifest();
  }, [user]);

  // =====================================================================
  // 2. REAL-TIME ACTIONS
  // =====================================================================
  const toggleCheckIn = async (paxId: string | number, currentStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setPassengers(prev => prev.map(p => p.id === paxId ? { ...p, boarded: !currentStatus } : p));
    if (navigator.onLine) await supabase.from('passengers').update({ boarded: !currentStatus }).eq('id', paxId);
  };

  const handleAddWalkIn = async () => {
      if (!walkInForm.firstName || !activeTrip) return;
      setIsAddingWalkIn(true);
      try {
          const newPax = { subscriber_id: user?.subscriberId, trip_id: activeTrip.id, first_name: walkInForm.firstName, last_name: walkInForm.lastName || 'Walk-in', phone: walkInForm.phone, boarded: true, notes: 'Added at the door (Walk-in)' };
          const { data, error } = await supabase.from('passengers').insert([newPax]).select().single();
          if (data && !error) { setPassengers(prev => [...prev, data]); setShowAddWalkIn(false); setWalkInForm({ firstName: '', lastName: '', phone: '' }); }
      } catch (err) { alert("Failed to add walk-in."); } finally { setIsAddingWalkIn(false); }
  };

  const handleExpenseSubmit = async () => {
      if (!expenseAmount || !user?.subscriberId) return;
      setIsSubmittingExpense(true);
      try {
          await supabase.from('expenses').insert([{ 
              subscriber_id: user.subscriberId, 
              submitter: user.fullName || 'Field Agent', 
              category: expenseType, 
              description: expenseDesc || `Field Log - ${activeTrip?.title}`, 
              amount: Number(expenseAmount), 
              status: 'Pending', 
              date: new Date().toISOString() 
          }]);
          alert("Expense sent to Finance Ledger!"); 
          setShowExpenseLogger(false); setExpenseAmount(''); setExpenseDesc('');
      } catch (e) { alert("Error submitting expense."); } finally { setIsSubmittingExpense(false); }
  };

  const triggerSOS = async () => {
      if (!window.confirm("🚨 SEND EMERGENCY ALERT TO HQ?")) return;
      try {
          await supabase.from('notifications').insert([{ 
              subscriber_id: user?.subscriberId, type: 'Emergency', title: '🔴 SOS: FIELD EMERGENCY', 
              message: `${user?.fullName} triggered an SOS for Trip: ${activeTrip?.title}`, is_read: false 
          }]);
          alert("SOS Broadcast Sent. Base is notified.");
      } catch (e) { alert("SOS Failed. Please call Base."); }
  };

  // 🌟 NEW: Launch Full Google Maps GPS Route
  const startGPSNavigation = () => {
      if (!destination) return alert("Please enter a destination to start routing.");
      
      // Use official Google Maps direction API format. If pickup is empty, it uses live device location.
      const originParam = pickupLocation ? `&origin=${encodeURIComponent(pickupLocation)}` : '';
      const destParam = `&destination=${encodeURIComponent(destination)}`;
      
      window.open(`https://www.google.com/maps/dir/?api=1${originParam}${destParam}`, '_blank');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Activity className="text-slate-400 animate-spin" size={48} /></div>;
  if (!activeTrip) return <div className="h-screen flex flex-col items-center justify-center p-10 text-center bg-slate-50"><Users size={48} className="text-slate-300 mb-4" /><h2 className="text-xl font-black text-slate-800">No Active Manifest</h2><button onClick={() => navigate('/landing')} className="mt-6 px-6 py-3 text-white rounded-2xl font-bold shadow-lg" style={{ backgroundColor: APP_COLOR }}>Go Home</button></div>;

  const totalPax = passengers.length; const boardedPax = passengers.filter(p => p.boarded).length; const missingPax = passengers.filter(p => !p.boarded);
  const filteredPassengers = passengers.filter(p => { const fullName = `${p.first_name} ${p.last_name}`.toLowerCase(); const matchesSearch = fullName.includes(searchQuery.toLowerCase()); if (filter === 'missing') return matchesSearch && !p.boarded; if (filter === 'boarded') return matchesSearch && p.boarded; return matchesSearch; });

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen relative overflow-hidden font-sans pb-24 shadow-2xl border-x border-slate-100">
      
      {/* 🛠 SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100] flex max-w-md mx-auto">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black" style={{ backgroundColor: APP_COLOR }}>{user?.fullName?.charAt(0) || 'P'}</div><span className="font-black text-slate-800 tracking-tight">Console</span></div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24}/></button>
             </div>
             <div className="p-4 space-y-2 flex-1">
                <SidebarLink icon={<LayoutDashboard size={20}/>} label="Home Portal" onClick={() => navigate('/landing')} />
                <SidebarLink icon={<Users size={20}/>} label="Manifest App" active />
                <SidebarLink icon={<Navigation size={20}/>} label="Driver Cockpit" onClick={() => navigate('/driver-cockpit')} />
             </div>
             <div className="p-6 border-t border-slate-100"><button onClick={logout} className="flex items-center gap-3 text-red-500 font-bold w-full p-3 rounded-xl hover:bg-red-50 transition-colors"><LogOut size={20}/> Logout</button></div>
          </div>
        </div>
      )}

      {/* 📱 MOBILE HEADER */}
      <div className="text-white p-6 rounded-b-[2.5rem] shadow-xl sticky top-0 z-50" style={{ backgroundColor: APP_COLOR }}>
        <div className="flex justify-between items-start mb-6">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"><Menu size={24} /></button>
          <div className="text-right">
             <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{activeTrip.trip_ref || 'TOUR'}</span>
             <h1 className="text-xl font-black mt-2 leading-tight">{activeTrip.title}</h1>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
          <div className="flex justify-between items-end mb-2">
            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Boarding Progress</p>
            <p className="text-2xl font-black">{boardedPax} <span className="text-sm opacity-60">/ {totalPax}</span></p>
          </div>
          <div className="h-2 bg-slate-900/30 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 transition-all duration-700" style={{ width: `${(boardedPax / Math.max(totalPax, 1)) * 100}%` }}></div></div>
        </div>
      </div>

      {/* 🚀 QUICK ACTION BAR */}
      <div className="grid grid-cols-4 gap-2 px-4 -mt-5 relative z-[60]">
         <ActionButton icon={<UserPlus className="text-blue-500" size={20}/>} label="Walk-In" onClick={() => setShowAddWalkIn(true)} />
         <ActionButton icon={<Receipt className="text-orange-500" size={20}/>} label="Expense" onClick={() => setShowExpenseLogger(true)} />
         <ActionButton icon={<Phone className="text-emerald-600" size={20}/>} label="Base" onClick={() => window.location.href = 'tel:000'} />
         <ActionButton icon={<ShieldAlert className="text-red-500" size={20}/>} label="SOS" onClick={triggerSOS} />
      </div>

      {/* 🗺️ LIVE ROUTING WIDGET */}
      <div className="px-4 mt-6 relative z-0">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
                <Map size={18} style={{ color: APP_COLOR }} />
                <h4 className="font-black text-slate-800">Live GPS Routing</h4>
            </div>

            <div className="relative border-l-2 border-dashed border-slate-200 ml-3 pl-6 space-y-4">
                {/* Pickup Point */}
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

                {/* Destination Point */}
                <div className="relative">
                    <div className="absolute -left-[31px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-slate-800 rounded-full"></div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</label>
                    <input 
                        type="text" 
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="Enter destination..."
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
      </div>

      {/* 🔍 SEARCH & FILTERS */}
      <div className="p-4 mt-2 space-y-4 relative z-0">
        <div className="bg-white rounded-2xl shadow-sm p-2 flex items-center gap-2 border border-slate-200">
          <Search size={20} className="text-slate-400 ml-2" />
          <input type="text" placeholder="Search manifest..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-2 outline-none text-sm font-bold text-slate-800 bg-transparent"/>
        </div>
        <div className="flex justify-between items-center">
            <div className="flex gap-2">
                <FilterButton label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
                <FilterButton label="Missing" active={filter === 'missing'} onClick={() => setFilter('missing')} badge={missingPax.length} />
            </div>
            {filter === 'missing' && missingPax.length > 0 && (<button className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors animate-fade-in"><MessageSquare size={14}/> Ping All</button>)}
        </div>
      </div>

      {/* 👥 THE MANIFEST LIST */}
      <div className="px-4 space-y-3 relative z-0">
        {filteredPassengers.length === 0 ? (
             <div className="text-center py-10 bg-white rounded-[2rem] border border-slate-100"><Users size={32} className="text-slate-300 mx-auto mb-3" /><p className="text-slate-500 font-bold text-sm">No passengers found.</p></div>
        ) : (
            filteredPassengers.map((pax) => (
              <div key={pax.id} onClick={() => setSelectedPax(pax)} className={`p-4 rounded-3xl border-2 transition-all active:scale-95 cursor-pointer flex justify-between items-center ${pax.boarded ? 'bg-white border-emerald-100 opacity-70' : 'bg-white border-white shadow-xl shadow-slate-200/50'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black ${pax.boarded ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{pax.first_name.charAt(0)}</div>
                  <div>
                    <h3 className={`font-black text-lg ${pax.boarded ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{pax.first_name} {pax.last_name}</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">{pax.seat_number ? `Seat ${pax.seat_number}` : 'Any Seat'} {pax.dietary_reqs && `• 🍎 Alert`}</p>
                  </div>
                </div>
                <button onClick={(e) => toggleCheckIn(pax.id, !!pax.boarded, e)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm ${pax.boarded ? 'bg-emerald-500 text-white' : 'bg-slate-50 border-2 border-slate-200 text-slate-300 hover:border-emerald-500 hover:text-emerald-500'}`}>
                    <CheckCircle size={24} />
                </button>
              </div>
            ))
        )}
      </div>

      {/* =====================================================================
          🚀 MODALS (Deep-Dive, Walk-In, Expense Logger)
      ===================================================================== */}
      
      {/* PASSENGER DEEP-DIVE */}
      {selectedPax && (
         <div className="fixed inset-0 z-[200] flex flex-col justify-end max-w-md mx-auto">
             <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedPax(null)}></div>
             <div className="bg-white w-full rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full relative z-10 border-t border-slate-100 pb-12">
                 <div className="flex justify-between items-start mb-6"><div><span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full">Digital Ticket</span><h2 className="text-3xl font-black text-slate-900 mt-3 leading-tight">{selectedPax.first_name} <br/>{selectedPax.last_name}</h2></div><button onClick={() => setSelectedPax(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button></div>
                 <div className="space-y-4 mb-8">
                     {selectedPax.phone && (<div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100"><div className="p-3 bg-white rounded-xl shadow-sm text-blue-500"><Phone size={20}/></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</p><p className="font-bold text-slate-800">{selectedPax.phone}</p></div><a href={`tel:${selectedPax.phone}`} className="ml-auto px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md">Call</a></div>)}
                     {selectedPax.dietary_reqs && (<div className="flex items-center gap-4 p-4 bg-orange-50 rounded-2xl border border-orange-100 text-orange-800"><div className="p-3 bg-white rounded-xl shadow-sm text-orange-500"><Coffee size={20}/></div><div><p className="text-[10px] font-black uppercase tracking-widest opacity-70">Dietary Alert</p><p className="font-bold">{selectedPax.dietary_reqs}</p></div></div>)}
                     {selectedPax.notes && (<div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100"><div className="p-3 bg-white rounded-xl shadow-sm text-slate-500"><FileText size={20}/></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guide Notes</p><p className="font-bold text-sm text-slate-700 leading-snug mt-1">{selectedPax.notes}</p></div></div>)}
                 </div>
                 <button onClick={(e) => { toggleCheckIn(selectedPax.id, !!selectedPax.boarded, e); setSelectedPax(null); }} className={`w-full py-5 rounded-[2rem] font-black text-lg transition-all shadow-xl ${selectedPax.boarded ? 'bg-slate-100 text-slate-500' : 'text-white'}`} style={selectedPax.boarded ? {} : { backgroundColor: APP_COLOR }}>{selectedPax.boarded ? 'Undo Check-in' : 'Confirm Boarding'}</button>
             </div>
         </div>
      )}

      {/* ADD WALK-IN */}
      {showAddWalkIn && (
         <div className="fixed inset-0 z-[200] flex flex-col justify-end max-w-md mx-auto">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAddWalkIn(false)}></div>
             <div className="bg-white w-full rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full relative z-10 pb-12">
                 <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black text-slate-900 flex items-center gap-2"><UserPlus size={24} style={{ color: APP_COLOR }}/> Add Walk-In</h2><button onClick={() => setShowAddWalkIn(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button></div>
                 <div className="space-y-4 mb-8">
                     <input type="text" placeholder="First Name" value={walkInForm.firstName} onChange={e => setWalkInForm({...walkInForm, firstName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold focus:border-slate-400 transition-colors" />
                     <input type="text" placeholder="Last Name" value={walkInForm.lastName} onChange={e => setWalkInForm({...walkInForm, lastName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold focus:border-slate-400 transition-colors" />
                     <input type="tel" placeholder="Phone Number (Optional)" value={walkInForm.phone} onChange={e => setWalkInForm({...walkInForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold focus:border-slate-400 transition-colors" />
                 </div>
                 <button onClick={handleAddWalkIn} disabled={!walkInForm.firstName || isAddingWalkIn} className="w-full py-5 rounded-[2rem] font-black text-lg text-white transition-all shadow-xl disabled:opacity-50 disabled:grayscale" style={{ backgroundColor: APP_COLOR }}>{isAddingWalkIn ? 'Adding...' : 'Add & Board Passenger'}</button>
             </div>
         </div>
      )}

      {/* 💰 EXPENSE LOGGER */}
      {showExpenseLogger && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end max-w-md mx-auto bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white w-full rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full border-t border-white pb-12">
                  <div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black text-slate-900">Log Field Expense</h2><button onClick={() => setShowExpenseLogger(false)} className="p-3 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button></div>
                  <div className="grid grid-cols-4 gap-2 mb-6">
                      <button onClick={() => setExpenseType('Meal')} className={`p-4 border rounded-2xl flex flex-col items-center gap-2 transition-colors ${expenseType === 'Meal' ? 'bg-orange-50 border-orange-200 shadow-inner text-orange-600' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}><Coffee size={24} /><span className="font-black text-[9px] uppercase tracking-widest">Meal</span></button>
                      <button onClick={() => setExpenseType('Ticket')} className={`p-4 border rounded-2xl flex flex-col items-center gap-2 transition-colors ${expenseType === 'Ticket' ? 'bg-blue-50 border-blue-200 shadow-inner text-blue-600' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}><Ticket size={24} /><span className="font-black text-[9px] uppercase tracking-widest">Ticket</span></button>
                      <button onClick={() => setExpenseType('Fuel')} className={`p-4 border rounded-2xl flex flex-col items-center gap-2 transition-colors ${expenseType === 'Fuel' ? 'bg-emerald-50 border-emerald-200 shadow-inner text-emerald-600' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}><Bus size={24} /><span className="font-black text-[9px] uppercase tracking-widest">Transit</span></button>
                      <button onClick={() => setExpenseType('Misc')} className={`p-4 border rounded-2xl flex flex-col items-center gap-2 transition-colors ${expenseType === 'Misc' ? 'bg-slate-100 border-slate-300 shadow-inner text-slate-700' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}><Receipt size={24} /><span className="font-black text-[9px] uppercase tracking-widest">Misc</span></button>
                  </div>
                  <input type="text" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="What was this for?" className="w-full bg-slate-50 p-4 rounded-xl mb-3 font-bold text-sm outline-none border border-slate-100 text-slate-800 focus:ring-2 focus:ring-slate-200 transition-all" />
                  <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Amount (0.00)" className="w-full bg-slate-50 p-6 rounded-2xl mb-6 font-black text-3xl outline-none border border-slate-100 text-center text-slate-800 focus:ring-2 focus:ring-slate-200 transition-all" />
                  <button disabled={!expenseAmount || isSubmittingExpense} onClick={handleExpenseSubmit} className="w-full text-white py-5 rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50" style={{ backgroundColor: APP_COLOR }}>{isSubmittingExpense ? 'Sending to Ledger...' : 'Submit Receipt'}</button>
              </div>
          </div>
      )}
    </div>
  );
};

/* --- MINI COMPONENTS --- */
const ActionButton = ({ icon, label, onClick }: any) => (
    <div className="flex flex-col items-center gap-1" onClick={onClick}>
        <button className="bg-white w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center active:scale-90 transition-transform hover:bg-slate-50 border border-slate-50">{icon}</button>
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{label}</span>
    </div>
);

const FilterButton = ({ label, active, onClick, badge }: any) => (
    <button onClick={onClick} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${active ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
        {label} {badge > 0 && <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">{badge}</span>}
    </button>
);

const SidebarLink = ({ icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold text-sm transition-all ${active ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>{icon}{label}</button>
);

export default GuideApp;