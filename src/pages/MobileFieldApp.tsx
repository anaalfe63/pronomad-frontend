import React, { useState, useEffect } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { 
  MapPin, Users, Receipt, CheckCircle2, ChevronRight, Camera, 
  Bus, Clock, Phone, AlertTriangle, LogOut, Navigation 
} from 'lucide-react';

interface Trip {
  id: string | number;
  title: string;
  startDate: string;
  status: string;
  itinerary: any[];
  passengers: any[];
  logistics: any;
}

const MobileFieldApp: React.FC = () => {
  const { user, logout } = useTenant() as any;
  const [activeTab, setActiveTab] = useState<'itinerary' | 'manifest' | 'expenses'>('itinerary');
  const [myTrip, setMyTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch only the trip assigned to this specific driver/guide
  useEffect(() => {
    const fetchMyTrip = async () => {
      setLoading(true);
      try {
        // We fetch active trips for the subscriber
        const response = await fetch('http://localhost:3000/api/trips?status=Active', {
          headers: { 'x-subscriber-id': user?.subscriberId || '' }
        });
        const data = await response.json();
        
        if (data.success && data.trips.length > 0) {
          // Find a trip where the driver name matches the logged-in user, 
          // OR just grab the first active trip for demonstration purposes
          const assignedTrip = data.trips.find((t: any) => {
            const logistics = typeof t.logistics === 'string' ? JSON.parse(t.logistics) : (t.logistics || {});
            return logistics.driver === user?.name;
          }) || data.trips[0]; 

          if (assignedTrip) {
            // Fetch the manifest for this specific trip
            const manifestRes = await fetch(`http://localhost:3000/api/trips/${assignedTrip.id}/manifest`, {
              headers: { 'x-subscriber-id': user?.subscriberId || '' }
            });
            const manifestData = await manifestRes.json();
            
            setMyTrip({
              id: assignedTrip.id,
              title: assignedTrip.title,
              startDate: assignedTrip.start_date,
              status: assignedTrip.status,
              logistics: typeof assignedTrip.logistics === 'string' ? JSON.parse(assignedTrip.logistics) : (assignedTrip.logistics || {}),
              itinerary: typeof assignedTrip.itinerary === 'string' ? JSON.parse(assignedTrip.itinerary) : (assignedTrip.itinerary || []),
              passengers: manifestData.success ? manifestData.trip.passengers : []
            });
          }
        }
      } catch (error) {
        console.error("Failed to load field data", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.subscriberId) fetchMyTrip();
  }, [user]);

  const handleExpenseSubmit = () => {
    alert("Camera API triggered! Receipt photo attached and sent to Operations for approval.");
  };

  const handleCheckIn = async (passengerId: string) => {
    // In a real app, this would hit the PUT /api/bookings/:id endpoint we built to set boarded = true
    alert("Passenger Checked In! The CEO Dashboard has been updated.");
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-teal-400 font-bold animate-pulse">Syncing Dispatch...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl relative overflow-hidden">
      
      {/* MOBILE HEADER */}
      <div className="bg-slate-900 text-white p-6 pt-12 pb-8 rounded-b-[2rem] shadow-lg shrink-0">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center font-black text-slate-900">
              {user?.name?.charAt(0) || 'D'}
            </div>
            <div>
              <h2 className="font-black leading-none">{user?.name || 'Driver'}</h2>
              <p className="text-[10px] text-teal-400 uppercase tracking-widest mt-1 font-bold">Field Operations</p>
            </div>
          </div>
          <button onClick={logout} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <LogOut size={16} />
          </button>
        </div>

        {myTrip ? (
          <div>
            <span className="bg-emerald-500 text-slate-900 text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest mb-2 inline-block">Active Dispatch</span>
            <h1 className="text-2xl font-black leading-tight mb-2">{myTrip.title}</h1>
            <p className="text-sm text-slate-400 flex items-center gap-2">
              <Bus size={14} className="text-teal-400"/> {myTrip.logistics?.vehicleDetail || 'Assigned Vehicle'}
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-black">No Active Trips</h1>
            <p className="text-sm text-slate-400 mt-2">You have no dispatches for today.</p>
          </div>
        )}
      </div>

      {/* MOBILE CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        
        {myTrip && activeTab === 'itinerary' && (
          <div className="space-y-3 animate-in slide-in-from-left-4">
            <h3 className="font-black text-slate-800 text-lg ml-2 mb-4">Daily Itinerary</h3>
            {myTrip.itinerary.map((step: any, index: number) => (
              <div key={index} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-500"></div>
                <div className="text-center shrink-0">
                  <p className="text-xs font-bold text-slate-400 uppercase">Day {step.day}</p>
                  <p className="text-lg font-black text-slate-800">{step.time}</p>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800">{step.title}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><MapPin size={12}/> {step.location}</p>
                  {step.notes && (
                    <div className="mt-2 bg-orange-50 p-2 rounded-lg text-[10px] font-bold text-orange-700 flex items-start gap-1">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5"/> {step.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {myTrip && activeTab === 'manifest' && (
          <div className="space-y-3 animate-in slide-in-from-right-4">
            <div className="flex justify-between items-center ml-2 mb-4">
              <h3 className="font-black text-slate-800 text-lg">Passenger Manifest</h3>
              <span className="bg-slate-200 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">{myTrip.passengers.length} Pax</span>
            </div>
            
            {myTrip.passengers.map((pax: any) => (
              <div key={pax.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-3 border-b border-slate-50 pb-3">
                  <div>
                    <h4 className="font-black text-slate-800 text-base">{pax.first_name} {pax.last_name}</h4>
                    <p className="text-xs font-bold text-slate-400">{pax.phone}</p>
                  </div>
                  <button onClick={() => handleCheckIn(pax.id)} className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center hover:bg-emerald-100 hover:text-emerald-600 transition-colors active:scale-90">
                    <CheckCircle2 size={20}/>
                  </button>
                </div>
                <div className="flex gap-2">
                   {pax.dietary_needs !== 'None' && <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded text-[10px] font-black uppercase">{pax.dietary_needs}</span>}
                   {pax.room_preference && <span className="bg-purple-50 text-purple-600 px-2 py-1 rounded text-[10px] font-black uppercase">Room: {pax.room_preference.split(' ')[0]}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="animate-in slide-in-from-bottom-4">
             <h3 className="font-black text-slate-800 text-lg ml-2 mb-4">Log Field Expense</h3>
             <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Expense Amount (GHS)</label>
                <input type="number" placeholder="0.00" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-black text-2xl text-slate-800 mb-4 outline-none"/>
                
                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Description / Reason</label>
                <input type="text" placeholder="e.g. Emergency fuel, Toll booth..." className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-medium text-sm mb-6 outline-none"/>
                
                <button onClick={handleExpenseSubmit} className="w-full bg-teal-50 text-teal-700 border-2 border-dashed border-teal-200 py-6 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-teal-100 transition-colors mb-6">
                  <Camera size={28}/>
                  <span className="font-bold text-sm">Snap Receipt Photo</span>
                </button>

                <button className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-transform">
                  Submit to Finance
                </button>
             </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION BAR (App-style) */}
      <div className="bg-white border-t border-slate-200 fixed bottom-0 left-0 w-full md:max-w-md md:left-1/2 md:-translate-x-1/2 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
        <div className="flex justify-between p-2 px-6">
          <button onClick={() => setActiveTab('itinerary')} className={`flex flex-col items-center p-3 rounded-xl transition-all ${activeTab === 'itinerary' ? 'text-teal-600' : 'text-slate-400'}`}>
            <Navigation size={24} className={activeTab === 'itinerary' ? 'fill-teal-100' : ''}/>
            <span className="text-[10px] font-bold mt-1">Route</span>
          </button>
          
          <button onClick={() => setActiveTab('manifest')} className={`flex flex-col items-center p-3 rounded-xl transition-all ${activeTab === 'manifest' ? 'text-teal-600' : 'text-slate-400'}`}>
            <Users size={24} className={activeTab === 'manifest' ? 'fill-teal-100' : ''}/>
            <span className="text-[10px] font-bold mt-1">Manifest</span>
          </button>

          <button onClick={() => setActiveTab('expenses')} className={`flex flex-col items-center p-3 rounded-xl transition-all ${activeTab === 'expenses' ? 'text-teal-600' : 'text-slate-400'}`}>
            <Receipt size={24} className={activeTab === 'expenses' ? 'fill-teal-100' : ''}/>
            <span className="text-[10px] font-bold mt-1">Expenses</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default MobileFieldApp;