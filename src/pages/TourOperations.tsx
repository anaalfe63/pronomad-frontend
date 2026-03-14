import React, { useState, useEffect } from 'react';
import { MapPin, Calendar, Users, PlusCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

interface Trip {
  id: string | number;
  title: string;
  start_date: string;
  end_date: string;
  passenger_count: number;
  itinerary: any[];
}

const TourOperations = () => {
  const { user } = useTenant();
  const APP_COLOR = user?.themeColor || '#10b981';

  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State for Personalizing Passengers
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    passport_no: '',
    phone: '',
    trip_id: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- FETCH TRIPS FROM SUPABASE ---
  useEffect(() => {
    const fetchTrips = async () => {
      if (!user?.subscriberId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('id, title, start_date, end_date, passenger_count, itinerary')
          .eq('subscriber_id', user.subscriberId)
          .order('start_date', { ascending: true });

        if (!error && data) {
            setTrips(data);
            // Auto-select the closest upcoming trip
            const upcoming = data.find(t => new Date(t.start_date) >= new Date());
            if (upcoming) {
                setActiveTrip(upcoming);
                setFormData(prev => ({ ...prev, trip_id: String(upcoming.id) }));
            } else if (data.length > 0) {
                setActiveTrip(data[0]);
                setFormData(prev => ({ ...prev, trip_id: String(data[0].id) }));
            }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, [user]);

  // Handle Dropdown Change to update the UI instantly
  const handleTripChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedId = e.target.value;
      setFormData({ ...formData, trip_id: selectedId });
      const foundTrip = trips.find(t => String(t.id) === selectedId);
      if (foundTrip) setActiveTrip(foundTrip);
  };

  // --- SAVE PASSENGER TO DATABASE ---
  const handleAddTourist = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.first_name || !formData.last_name || !formData.trip_id) {
          return alert("Please fill in the required fields (First Name, Last Name, and select a Trip).");
      }

      setIsSubmitting(true);

      try {
          const payload = {
              first_name: formData.first_name,
              last_name: formData.last_name,
              passport_no: formData.passport_no || null,
              phone: formData.phone || null,
              trip_id: formData.trip_id,
              subscriber_id: user?.subscriberId,
              is_lead: true, // Assuming single manual additions are lead travelers for their party
              boarded: false,
              payment_status: 'Pending',
              amount_paid: 0
          };

          const { error } = await supabase.from('passengers').insert([payload]);
          if (error) throw error;

          alert("✅ Tourist successfully added to the Manifest!");

          // Clear form visually
          setFormData({ ...formData, first_name: '', last_name: '', passport_no: '', phone: '' });

      } catch (error: any) {
          console.error("Save Error:", error);
          alert(`Error saving tourist: ${error.message}`);
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="h-full animate-fade-in flex flex-col gap-6">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Tour Operations</h2>
          <p className="text-slate-500 font-medium mt-1">Plan itineraries and manage traveler manifests.</p>
        </div>
        <button 
            className="text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{ backgroundColor: APP_COLOR, boxShadow: `0 10px 15px -3px ${APP_COLOR}40` }}
        >
          <PlusCircle size={20}/> Create New Tour
        </button>
      </header>

      {/* The Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        
        {/* COLUMN 1: Add Tourist Form (CLOUD CONNECTED) */}
        <div className="lg:col-span-1 bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
          <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
            <Users size={20} style={{ color: APP_COLOR }}/> Add Tourist
          </h3>
          
          <form onSubmit={handleAddTourist} className="space-y-4">
            <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">First Name *</label>
                <input 
                    type="text" 
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    placeholder="e.g. Kwame" 
                    className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 transition-all font-medium text-slate-800" 
                    style={{ '--tw-ring-color': APP_COLOR } as any}
                />
            </div>
            
            <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Last Name *</label>
                <input 
                    type="text" 
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    placeholder="e.g. Mensah" 
                    className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 transition-all font-medium text-slate-800" 
                    style={{ '--tw-ring-color': APP_COLOR } as any}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Phone</label>
                    <input 
                        type="text" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="+233..." 
                        className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 transition-all text-sm font-medium text-slate-800" 
                        style={{ '--tw-ring-color': APP_COLOR } as any}
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Passport No.</label>
                    <input 
                        type="text" 
                        value={formData.passport_no}
                        onChange={(e) => setFormData({...formData, passport_no: e.target.value})}
                        placeholder="Optional" 
                        className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 transition-all text-sm font-medium text-slate-800" 
                        style={{ '--tw-ring-color': APP_COLOR } as any}
                    />
                </div>
            </div>
            
            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Select Tour Package *</label>
              <select 
                  required
                  value={formData.trip_id}
                  onChange={handleTripChange}
                  className="w-full bg-white p-4 rounded-xl border-2 outline-none mt-1 font-bold text-slate-800 cursor-pointer focus:ring-2 transition-all"
                  style={{ borderColor: `${APP_COLOR}40`, '--tw-ring-color': APP_COLOR } as any}
              >
                <option value="">-- Assign to Trip --</option>
                {trips.map(trip => (
                    <option key={trip.id} value={trip.id}>{trip.title}</option>
                ))}
              </select>
            </div>
            
            <button 
                type="submit"
                disabled={isSubmitting || loading || trips.length === 0}
                className="w-full text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg mt-4 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: APP_COLOR }}
            >
              {isSubmitting ? <RefreshCw size={18} className="animate-spin"/> : <CheckCircle size={18}/>}
              {isSubmitting ? 'Saving to Cloud...' : 'Add to Manifest'}
            </button>
          </form>
        </div>

        {/* COLUMN 2 & 3: Itinerary Planner (DYNAMIC VIEW) */}
        <div className="lg:col-span-2 space-y-6">
          
          {loading ? (
              <div className="bg-white p-16 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                  <RefreshCw size={40} className="animate-spin mb-4 text-slate-300" />
                  <p className="font-bold text-slate-400 uppercase tracking-widest">Loading Live Operations Data...</p>
              </div>
          ) : !activeTrip ? (
              <div className="bg-white p-16 rounded-[2rem] shadow-sm border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
                  <p className="font-bold text-slate-400">No active trips found. Create a tour to get started.</p>
              </div>
          ) : (
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -z-10 transition-colors" style={{ backgroundColor: `${APP_COLOR}20` }}></div>
                
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <span className="text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm" style={{ backgroundColor: APP_COLOR }}>Selected Trip</span>
                    <h3 className="text-3xl font-black text-slate-900 mt-3 tracking-tight">{activeTrip.title}</h3>
                    <p className="text-slate-500 flex items-center gap-2 mt-2 font-medium">
                        <Calendar size={16} style={{ color: APP_COLOR }}/> 
                        {activeTrip.start_date ? new Date(activeTrip.start_date).toLocaleDateString() : 'TBD'} - {activeTrip.end_date ? new Date(activeTrip.end_date).toLocaleDateString() : 'TBD'}
                    </p>
                  </div>
                </div>

                {/* Timeline / Itinerary (Rendered dynamically if it exists in JSON) */}
                <div className="space-y-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">Daily Itinerary Schedule</p>
                  
                  {(!activeTrip.itinerary || activeTrip.itinerary.length === 0) ? (
                      <p className="text-sm font-medium text-slate-400 py-4 italic">No itinerary steps configured for this trip yet.</p>
                  ) : (
                      activeTrip.itinerary.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors border border-slate-100">
                          <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl font-black" style={{ color: APP_COLOR }}>
                            {item.day || (idx + 1)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-800 text-lg">{item.title || 'Scheduled Activity'}</h4>
                            <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-1">
                                <MapPin size={12}/> {item.location || 'Location TBD'} {item.time && `• ${item.time}`}
                            </p>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TourOperations;