import React, { useState, useEffect } from 'react';
import { 
  Phone, CheckCircle, MapPin, AlertTriangle, Bus, Search, 
  Menu, X, LayoutDashboard, User, LogOut, Clock, 
  Users, ChevronRight, ShieldAlert
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { useNavigate } from 'react-router-dom';

interface PassengerData {
  name: string;
  phone: string;
  seat?: string;
  checkedIn: boolean;
  diet?: string;
  notes?: string;
  payStatus?: string;
  partySize?: number;
}

interface TripData {
  id: string;
  title: string;
  type: string;
  passengers: PassengerData[];
  itinerary?: { time: string; activity: string }[];
}

const GuideApp: React.FC = () => {
  const { user, logout } = useTenant();
  const navigate = useNavigate();
  const APP_COLOR = user?.themeColor || '#0d9488';

  const [activeTrip, setActiveTrip] = useState<TripData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'missing' | 'boarded'>('all');

  useEffect(() => {
    try {
      const savedData = localStorage.getItem('pronomad_mock_db');
      const savedPackages = savedData ? JSON.parse(savedData) : [];
      
      // Find a trip that has passengers, or just grab the first one
      const tripToGuide = savedPackages.find((pkg: any) => pkg.passengers && pkg.passengers.length > 0) || savedPackages[0];
      
      if (tripToGuide) {
        setActiveTrip({
          ...tripToGuide,
          itinerary: tripToGuide.itinerary || [
            { time: '08:00 AM', activity: 'Departure' },
            { time: '12:00 PM', activity: 'Lunch Break' }
          ]
        });
      }
    } catch (e) {
      console.error("Failed to load trip data", e);
    }
  }, []);

  const toggleCheckIn = (passengerIndex: number) => {
    if (!activeTrip) return;
    const updatedTrip = { ...activeTrip };
    updatedTrip.passengers[passengerIndex].checkedIn = !updatedTrip.passengers[passengerIndex].checkedIn;
    setActiveTrip(updatedTrip);

    // Update local storage
    const savedData = localStorage.getItem('pronomad_mock_db');
    const savedPackages = savedData ? JSON.parse(savedData) : [];
    const updatedDb = savedPackages.map((pkg: any) => pkg.id === activeTrip.id ? updatedTrip : pkg);
    localStorage.setItem('pronomad_mock_db', JSON.stringify(updatedDb));
  };

  // If no trip is found, show a clean "No Data" state instead of crashing
  if (!activeTrip) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-10 text-center bg-slate-50">
        <Bus size={48} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-black text-slate-800">No Active Manifest</h2>
        <p className="text-slate-500 mt-2">Check back once operations has assigned you a trip.</p>
        <button onClick={() => navigate('/')} className="mt-6 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold">Go Home</button>
      </div>
    );
  }

  const totalPax = activeTrip.passengers?.length || 0;
  const boardedPax = activeTrip.passengers?.filter(p => p.checkedIn).length || 0;

  const filteredPassengers = (activeTrip.passengers || []).filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'missing') return matchesSearch && !p.checkedIn;
    if (filter === 'boarded') return matchesSearch && p.checkedIn;
    return matchesSearch;
  });

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen relative overflow-hidden font-sans pb-24">
      
      {/* 🛠 SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black" style={{ backgroundColor: APP_COLOR }}>
                      {user?.companyName?.charAt(0) || 'P'}
                   </div>
                   <span className="font-black text-slate-800 tracking-tight">Console</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400"><X size={24}/></button>
             </div>
             
             <div className="p-4 space-y-2 flex-1">
                <SidebarLink icon={<LayoutDashboard size={20}/>} label="Dashboard" onClick={() => navigate('/')} />
                <SidebarLink icon={<Users size={20}/>} label="Manifest" active />
                <SidebarLink icon={<User size={20}/>} label="Profile" onClick={() => navigate('/profile')} />
             </div>

             <div className="p-6 border-t border-slate-100">
                <button onClick={logout} className="flex items-center gap-3 text-red-500 font-bold w-full p-3 rounded-xl hover:bg-red-50 transition-colors">
                   <LogOut size={20}/> Logout
                </button>
             </div>
          </div>
        </div>
      )}

      {/* 📱 MOBILE HEADER */}
      <div className="text-white p-6 rounded-b-[2.5rem] shadow-xl sticky top-0 z-50" style={{ backgroundColor: APP_COLOR }}>
        <div className="flex justify-between items-start mb-6">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white/20 rounded-xl">
            <Menu size={24} />
          </button>
          <div className="text-right">
             <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase">{activeTrip.type || 'Trip'}</span>
             <h1 className="text-xl font-black mt-1 leading-tight">{activeTrip.title}</h1>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
          <div className="flex justify-between items-end mb-2">
            <p className="text-[10px] font-black uppercase opacity-60">Boarding Progress</p>
            <p className="text-2xl font-black">{boardedPax} <span className="text-sm opacity-60">/ {totalPax}</span></p>
          </div>
          <div className="h-2 bg-slate-900/30 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 transition-all duration-700" style={{ width: `${(boardedPax / Math.max(totalPax, 1)) * 100}%` }}></div>
          </div>
        </div>
      </div>

      {/* 🚀 QUICK ACTION BAR */}
      <div className="grid grid-cols-4 gap-2 px-4 -mt-5 relative z-[60]">
         <ActionButton icon={<ShieldAlert className="text-red-500" size={20}/>} label="SOS" />
         <ActionButton icon={<Phone className="text-blue-500" size={20}/>} label="Base" />
         <ActionButton icon={<Bus className="text-emerald-600" size={20}/>} label="Driver" />
         <ActionButton icon={<Clock className="text-orange-500" size={20}/>} label="Stop" />
      </div>

      {/* 🔍 SEARCH & FILTERS */}
      <div className="p-4 mt-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-lg p-2 flex items-center gap-2 border border-slate-100">
          <Search size={20} className="text-slate-400 ml-2" />
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 outline-none text-sm font-bold text-slate-800"
          />
        </div>

        <div className="flex gap-2">
            <FilterButton label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
            <FilterButton label="Missing" active={filter === 'missing'} onClick={() => setFilter('missing')} />
            <FilterButton label="Boarded" active={filter === 'boarded'} onClick={() => setFilter('boarded')} />
        </div>
      </div>

      {/* 👥 THE MANIFEST LIST */}
      <div className="px-4 space-y-3">
        {filteredPassengers.map((pax, index) => {
          const originalIndex = activeTrip.passengers.findIndex(p => p.name === pax.name);
          return (
            <div 
              key={index} 
              onClick={() => toggleCheckIn(originalIndex)}
              className={`p-4 rounded-3xl border-2 transition-all active:scale-95 cursor-pointer flex justify-between items-center
                ${pax.checkedIn ? 'bg-white border-emerald-100 opacity-60' : 'bg-white border-white shadow-xl shadow-slate-200/50'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center 
                  ${pax.checkedIn ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {pax.checkedIn ? <CheckCircle size={24} /> : <Users size={24} />}
                </div>
                <div>
                  <h3 className={`font-black text-lg ${pax.checkedIn ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{pax.name}</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase">Seat {pax.seat || 'Any'}</p>
                </div>
              </div>
              <a href={`tel:${pax.phone}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-teal-600">
                <Phone size={18} />
              </a>
            </div>
          );
        })}
      </div>

      {/* 🧭 BOTTOM PEEK */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t p-4 shadow-2xl flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center"><Clock size={20}/></div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Next Stop</p>
                <p className="text-sm font-bold text-slate-800">{activeTrip.itinerary?.[0]?.activity || 'End of Trip'}</p>
            </div>
         </div>
         <ChevronRight className="text-slate-300"/>
      </div>
    </div>
  );
};

/* --- MINI COMPONENTS --- */

const ActionButton = ({ icon, label }: any) => (
    <div className="flex flex-col items-center gap-1">
        <button className="bg-white w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center active:scale-90 transition-transform">
            {icon}
        </button>
        <span className="text-[9px] font-black text-slate-500 uppercase">{label}</span>
    </div>
);

const FilterButton = ({ label, active, onClick }: any) => (
    <button 
        onClick={onClick}
        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all
        ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}
    >
        {label}
    </button>
);

const SidebarLink = ({ icon, label, active, onClick }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold text-sm transition-all
        ${active ? 'bg-teal-50 text-teal-600' : 'text-slate-500 hover:bg-slate-50'}`}>
        {icon}
        {label}
    </button>
);

export default GuideApp;