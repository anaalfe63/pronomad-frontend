import React, { useState, useEffect } from 'react';
import { Phone, CheckCircle, MapPin, AlertTriangle, Bus, Search } from 'lucide-react';

interface PassengerData {
  name: string;
  phone: string;
  seat?: string;
  checkedIn: boolean;
  diet?: string;
  notes?: string;
  payStatus?: string;
}

interface TripData {
  id: string;
  title: string;
  type: string;
  passengers: PassengerData[];
  [key: string]: any;
}

const GuideApp: React.FC = () => {
  const [activeTrip, setActiveTrip] = useState<TripData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Fetch the trip from the database when the guide opens the app
  useEffect(() => {
    const savedPackages = JSON.parse(localStorage.getItem('pronomad_mock_db') || '[]');
    // For the prototype, we just grab the first trip that actually has passengers booked
    const tripToGuide = savedPackages.find((pkg: TripData) => pkg.passengers && pkg.passengers.length > 0);
    
    if (tripToGuide) {
      setActiveTrip(tripToGuide);
    }
  }, []);

  // 2. Handle Check-in Logic
  const toggleCheckIn = (passengerIndex: number) => {
    if (!activeTrip) return;
    const updatedTrip = { ...activeTrip };
    updatedTrip.passengers[passengerIndex].checkedIn = !updatedTrip.passengers[passengerIndex].checkedIn;
    setActiveTrip(updatedTrip);

    // Save back to DB so the CEO can see the check-in live on their dashboard!
    const savedPackages = JSON.parse(localStorage.getItem('pronomad_mock_db') || '[]');
    const updatedDb = savedPackages.map((pkg: TripData) => pkg.id === activeTrip.id ? updatedTrip : pkg);
    localStorage.setItem('pronomad_mock_db', JSON.stringify(updatedDb));
  };

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] max-w-md mx-auto p-6 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <Bus size={32} className="text-slate-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">No Active Manifest</h2>
        <p className="text-slate-500">You have no trips assigned for today. Operations will dispatch your manifest here when ready.</p>
      </div>
    );
  }

  // Calculate stats
  const totalPax = activeTrip.passengers.length;
  const boardedPax = activeTrip.passengers.filter(p => p.checkedIn).length;
  
  // Filter for search
  const filteredPassengers = activeTrip.passengers.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.phone.includes(searchQuery)
  );

  return (
    // We restrict width to max-w-md to simulate a mobile phone view, even on desktop
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen shadow-2xl overflow-hidden pb-24">
      
      {/* MOBILE HEADER */}
      <div className="bg-teal-600 text-white p-6 rounded-b-[2rem] shadow-lg sticky top-0 z-50">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="bg-teal-500/50 text-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full mb-2 inline-block">
              {activeTrip.type}
            </span>
            <h1 className="text-2xl font-black leading-tight">{activeTrip.title}</h1>
            <p className="text-teal-200 text-sm mt-1 flex items-center gap-1"><MapPin size={14}/> Acc - Destination</p>
          </div>
        </div>

        {/* Boarding Progress Bar */}
        <div className="bg-teal-700/50 p-4 rounded-2xl border border-teal-500/30">
          <div className="flex justify-between text-sm font-bold mb-2">
            <span>Boarding Status</span>
            <span>{boardedPax} / {totalPax} Boarded</span>
          </div>
          <div className="h-2 bg-teal-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-400 transition-all duration-500" 
              style={{ width: `${(boardedPax / totalPax) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="px-4 -mt-4 relative z-40 mb-6">
        <div className="bg-white rounded-xl shadow-md p-2 flex items-center gap-2 border border-slate-100">
          <Search size={20} className="text-slate-400 ml-2" />
          <input 
            type="text" 
            placeholder="Search passenger name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 outline-none text-sm font-medium"
          />
        </div>
      </div>

      {/* PASSENGER LIST */}
      <div className="px-4 space-y-4">
        {filteredPassengers.map((pax, index) => {
          // Find original index to update the correct person in the DB
          const originalIndex = activeTrip.passengers.findIndex(p => p.name === pax.name);

          return (
            <div 
              key={index} 
              onClick={() => toggleCheckIn(originalIndex)}
              className={`p-4 rounded-2xl border transition-all active:scale-95 cursor-pointer flex flex-col gap-3
                ${pax.checkedIn ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-slate-200 shadow-md'}`}
            >
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {/* Big Checkbox Toggle */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors 
                    ${pax.checkedIn ? 'bg-green-500 text-white' : 'border-2 border-slate-300'}`}>
                    {pax.checkedIn && <CheckCircle size={20} />}
                  </div>
                  <div>
                    <h3 className={`font-black text-lg ${pax.checkedIn ? 'text-green-900 line-through opacity-70' : 'text-slate-800'}`}>
                      {pax.name}
                    </h3>
                    <p className="text-slate-500 text-sm font-medium">Seat: {pax.seat || 'Unassigned'}</p>
                  </div>
                </div>
                
                {/* One-tap call button */}
                <a 
                  href={`tel:${pax.phone}`} 
                  onClick={(e) => e.stopPropagation()} // Stop it from toggling check-in when clicking call
                  className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-teal-600 transition-colors"
                >
                  <Phone size={18} />
                </a>
              </div>

              {/* MEDICAL & DIETARY ALERTS (Highly visible for the Guide) */}
              {(pax.diet !== 'None' || pax.notes) && (
                <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    {pax.diet !== 'None' && <span className="text-xs font-black text-orange-700 uppercase block mb-0.5">{pax.diet}</span>}
                    {pax.notes && <p className="text-sm text-orange-800 font-medium leading-tight">{pax.notes}</p>}
                  </div>
                </div>
              )}

              {/* PAYMENT ALERT (If they owe money at the bus door) */}
              {pax.payStatus === 'Deposit' && (
                <div className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg w-fit">
                  ⚠️ BALANCE DUE AT BOARDING
                </div>
              )}

            </div>
          )
        })}
      </div>

    </div>
  );
};

export default GuideApp;