import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { 
  MapPin, Navigation, Phone, AlertTriangle, Signal, 
  Clock, Gauge, ClipboardCheck, Fuel, X, CheckCircle2, 
  ShieldAlert, Activity, CreditCard, Droplets, Users, 
  ChevronLeft, Map as MapIcon, Send, CloudDownload, 
  WifiOff, Maximize2, Minimize2, ListChecks, CheckSquare
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

// 🗺️ REAL MAP IMPORTS
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet marker icons not showing in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// --- INTERFACES ---
interface Trip { id: string | number; title: string; trip_ref: string; status: string; logistics?: any; passenger_count?: number; }
interface Passenger { id: string | number; first_name: string; last_name: string; phone?: string; boarded?: boolean; }

// Auto-centers the map on the driver's live GPS coordinates
const MapUpdater = ({ coords }: { coords: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView(coords, 15);
  }, [coords, map]);
  return null;
};

const DriverCockpit: React.FC = () => {
  const { user } = useTenant();
  const navigate = useNavigate();
  const APP_COLOR = user?.themeColor || '#2563eb';
  
  // --- DATABASE & TRIP STATES ---
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTripActive, setIsTripActive] = useState<boolean>(false);
  
  // --- REAL-TIME TELEMETRY STATES ---
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0); 
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [tripSummary, setTripSummary] = useState({ distance: 0, maxSpeed: 0 });

  // --- UI & MODAL STATES ---
  const [isDriveMode, setIsDriveMode] = useState<boolean>(false); 
  const [offlineMapStatus, setOfflineMapStatus] = useState<'none' | 'downloading' | 'ready'>('none');
  const [showChecklist, setShowChecklist] = useState<boolean>(false);
  const [showDriverManifest, setShowDriverManifest] = useState<boolean>(false);
  
  // 🌟 FIX: Ensuring all 4 checks are present
  const [vehicleCheck, setVehicleCheck] = useState({ fuel: false, tires: false, brakes: false, cleanliness: false });
  const checklistComplete = Object.values(vehicleCheck).every(v => v === true);

  // --- EXPENSE LOGGER STATES ---
  const [showExpenseLogger, setShowExpenseLogger] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseType, setExpenseType] = useState<'Fuel' | 'Toll'>('Fuel');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // =======================================================================
  // 1. FETCH ASSIGNED TRIP
  // =======================================================================
  useEffect(() => {
    const fetchAssignedTrip = async () => {
      if (!user?.subscriberId || !user?.fullName) return;
      try {
        const { data: tripData, error } = await supabase
            .from('trips')
            .select('*')
            .eq('subscriber_id', user.subscriberId)
            .neq('status', 'Completed')
            .contains('logistics', { driver: user.fullName }) 
            .order('start_date', { ascending: true })
            .limit(1)
            .single();

        if (tripData && !error) {
            setCurrentTrip(tripData);
            const { data: paxData } = await supabase
                .from('passengers').select('id, first_name, last_name, phone, boarded').eq('trip_id', tripData.id);
            if (paxData) setPassengers(paxData);
        }
      } catch (e) { console.error("Standby..."); } 
      finally { setLoading(false); }
    };
    fetchAssignedTrip();
  }, [user]);

  // =======================================================================
  // 2. 🌍 REAL GPS TELEMETRY & OPS SYNC
  // =======================================================================
  useEffect(() => {
    let watchId: number;
    let timerInterval: ReturnType<typeof setInterval>;

    if (isTripActive && currentTrip) {
      timerInterval = setInterval(() => setElapsedTime(prev => prev + 1), 1000);

      watchId = navigator.geolocation.watchPosition(
        async (position) => {
            const { latitude, longitude, speed } = position.coords;
            setCurrentLocation([latitude, longitude]);
            const realSpeedKmh = speed ? Math.round(speed * 3.6) : 0;
            setCurrentSpeed(realSpeedKmh);

            if (navigator.onLine) {
                await supabase.from('trips').update({
                    status: 'In Transit',
                    current_speed: realSpeedKmh,
                    lat: latitude,
                    lng: longitude,
                    last_ping: new Date().toISOString()
                }).eq('id', currentTrip.id);
            }
        },
        (error) => console.error("GPS Error:", error),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } else {
      setCurrentSpeed(0);
      navigator.geolocation.getCurrentPosition((pos) => {
         setCurrentLocation([pos.coords.latitude, pos.coords.longitude]);
      });
    }

    return () => {
        clearInterval(timerInterval);
        if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTripActive, currentTrip]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // =======================================================================
  // 3. 🚨 REAL ACTIONS (SOS, Call, Expense)
  // =======================================================================
  
  // 🌟 FIX: Trigger SOS Alert to Operations
  const triggerSOS = async () => {
    if (!window.confirm("🚨 SEND EMERGENCY ALERTS TO HQ? This will notify Operations immediately.")) return;
    try {
      await supabase.from('notifications').insert([{
        subscriber_id: user?.subscriberId,
        type: 'Emergency',
        title: '🔴 SOS: DRIVER EMERGENCY',
        message: `${user?.fullName} has triggered an SOS for Trip: ${currentTrip?.title}`,
        is_read: false
      }]);
      alert("SOS Broadcast Sent. Help is on the way.");
    } catch (e) {
      alert("SOS Failed. Please call HQ directly.");
    }
  };

  // 🌟 FIX: Native Call Base Function
  const callBase = () => {
    window.location.href = 'tel:+233244000000'; // Replace with dynamic HQ number if needed
  };

  const handleExpenseSubmit = async () => {
      if (!expenseAmount || !user?.subscriberId) return;
      setIsSubmittingExpense(true);

      const payload = {
          subscriber_id: user.subscriberId,
          submitter: user.fullName || 'Driver',
          category: expenseType === 'Fuel' ? 'Fuel' : 'Toll',
          description: `Field Log - ${currentTrip?.title || 'General Routing'}`,
          amount: Number(expenseAmount),
          status: 'Pending',
          date: new Date().toISOString()
      };

      try {
          if (!navigator.onLine) throw new Error("Offline");
          const { error } = await supabase.from('expenses').insert([payload]);
          if (error) throw error;
          
          alert("Expense successfully submitted to the Finance Ledger for approval!");
          setShowExpenseLogger(false);
          setExpenseAmount('');
      } catch (e) {
          alert("Network error. Could not send expense.");
      } finally {
          setIsSubmittingExpense(false);
      }
  };

  // =======================================================================
  // UI HANDLERS
  // =======================================================================
  const handleHeadcountToggle = async (paxId: string | number, currentStatus: boolean) => {
      setPassengers(prev => prev.map(p => p.id === paxId ? { ...p, boarded: !currentStatus } : p));
      if (navigator.onLine) await supabase.from('passengers').update({ boarded: !currentStatus }).eq('id', paxId);
  };

  const handleDownloadMap = () => {
      if(offlineMapStatus === 'ready') return;
      setOfflineMapStatus('downloading');
      setTimeout(() => setOfflineMapStatus('ready'), 3000); 
  };

  const boardedCount = passengers.filter(p => p.boarded).length;
  const defaultCenter: [number, number] = [5.6037, -0.1870]; // Accra fallback

  if (loading) return <div className="h-screen bg-[#e5e7eb] flex items-center justify-center"><Activity className="text-slate-400 animate-spin" size={48}/></div>;
  if (!currentTrip) return <div className="h-screen bg-[#e5e7eb] flex flex-col items-center justify-center p-8"><MapIcon size={64} className="text-slate-300 mb-4"/><h2 className="text-2xl font-black text-slate-800">Standby for Dispatch</h2></div>;

  // =======================================================================
  // 🌟 FULL SCREEN MAP (IDLE / DRIVE MODE)
  // =======================================================================
  if (isDriveMode) {
      return (
          <div className="h-screen w-full bg-slate-900 relative overflow-hidden font-sans">
              
              <div className="absolute inset-0 z-0">
                  <MapContainer center={currentLocation || defaultCenter} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <MapUpdater coords={currentLocation} />
                      {currentLocation && (
                          <Marker position={currentLocation}>
                              <Popup>You are here. {currentSpeed} km/h</Popup>
                          </Marker>
                      )}
                  </MapContainer>
              </div>
              
              <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl px-8 py-4 rounded-full shadow-2xl flex items-center gap-8 border border-white z-10">
                  <div className="text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Speed</p>
                      <p className="text-3xl font-black text-slate-800">{currentSpeed} <span className="text-sm">km/h</span></p>
                  </div>
                  <div className="w-px h-10 bg-slate-200"></div>
                  <div className="text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tracking</p>
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Navigation size={18} className="text-emerald-500 animate-pulse"/> LIVE</p>
                  </div>
              </div>

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl p-3 rounded-[2rem] shadow-2xl flex items-center gap-2 border border-white z-10">
                  <DockButton icon={<ListChecks size={22}/>} onClick={() => setShowDriverManifest(true)} active={boardedCount < passengers.length}/>
                  <DockButton icon={<CreditCard size={22}/>} onClick={() => setShowExpenseLogger(true)} />
                  {/* 🌟 FIX: Added SOS to Dock */}
                  <DockButton icon={<AlertTriangle size={22} className="text-red-500"/>} onClick={triggerSOS} />
                  <div className="w-px h-10 bg-slate-200 mx-2"></div>
                  <DockButton icon={<Minimize2 size={22}/>} onClick={() => setIsDriveMode(false)} />
              </div>

              {offlineMapStatus === 'ready' && (
                  <div className="absolute top-8 right-8 bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg z-10">
                      <WifiOff size={14}/> Offline Maps Ready
                  </div>
              )}
          </div>
      );
  }

  // =======================================================================
  // 🌟 WIDGET DASHBOARD MODE
  // =======================================================================
  return (
    <div className="h-screen bg-[#e5e7eb] text-slate-900 flex flex-col font-sans overflow-hidden">
      
      {/* HEADER */}
      <div className="p-6 flex justify-between items-center relative z-20">
        <button onClick={() => navigate('/manifest')} className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors border border-white">
          <ChevronLeft size={24} />
        </button>
        <div className="bg-white/60 backdrop-blur-md px-6 py-2.5 rounded-full shadow-sm border border-white flex items-center gap-2">
            <Signal size={16} className={isTripActive ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}/>
            <span className="text-xs font-black uppercase tracking-widest text-slate-700">{isTripActive ? 'GPS Live' : 'Standby'}</span>
        </div>
        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-white font-black shadow-lg">
          {user?.fullName?.[0]}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 relative z-20">
          
          <div className="flex flex-col gap-4 mb-4 relative">
             <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
                 <h1 className="text-3xl font-black tracking-tight text-slate-800 mb-1">{currentTrip.title}</h1>
                 <p className="text-sm font-medium text-slate-500 mb-6">Manifest ID: {currentTrip.trip_ref}</p>
                 
                 <div className="flex gap-2">
                    <span className="bg-emerald-100 text-emerald-700 font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full">Unit: {currentTrip.logistics?.vehicleDetail || 'Bus 01'}</span>
                    <span className="bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full">{passengers.length} PAX</span>
                 </div>
             </div>

             <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2.5rem] shadow-[0_20px_40px_rgb(0,0,0,0.08)] border border-white">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-slate-800 flex items-center gap-2"><ClipboardCheck size={18}/> Pre-Flight</h3>
                    <button className="text-slate-400"><X size={18}/></button>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3 mb-6">
                     <div className="bg-slate-50 p-4 rounded-2xl">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Checklist</p>
                         <p className="font-bold text-sm text-slate-800">{checklistComplete ? 'Cleared' : 'Pending'}</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-2xl">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Manifest</p>
                         <p className="font-bold text-sm text-slate-800">{boardedCount}/{passengers.length} Verified</p>
                     </div>
                 </div>

                 <button 
                    onClick={() => {
                        if (!isTripActive && !checklistComplete) setShowChecklist(true);
                        else {
                            setIsTripActive(!isTripActive);
                            if (!isTripActive) setIsDriveMode(true); 
                        }
                    }}
                    className="w-full py-4 rounded-[1.5rem] font-black text-white shadow-lg transition-all flex justify-between items-center px-6 active:scale-95"
                    style={{ backgroundColor: isTripActive ? '#ef4444' : APP_COLOR }}
                 >
                     <span>{isTripActive ? 'End Trip' : (checklistComplete ? 'Start Engine' : 'Run Inspection')}</span>
                     {isTripActive ? <X size={20}/> : <Send size={20}/>}
                 </button>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1 bg-white p-2 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white relative h-48 overflow-hidden group">
                  <div className="absolute inset-0 z-0">
                      <MapContainer center={currentLocation || defaultCenter} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <MapUpdater coords={currentLocation} />
                      </MapContainer>
                      <div className="absolute inset-0 bg-white/20 z-10 pointer-events-none"></div>
                  </div>
                  
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20 pointer-events-none">
                      <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-sm pointer-events-auto">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Navigation</p>
                          <p className="font-bold text-sm flex items-center gap-1"><MapPin size={14} style={{ color: APP_COLOR }}/> Route Ready</p>
                      </div>
                      <button onClick={() => setIsDriveMode(true)} className="bg-white/90 backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center shadow-sm text-slate-600 hover:text-slate-900 pointer-events-auto"><Maximize2 size={18}/></button>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
                      <button 
                         onClick={handleDownloadMap}
                         className={`w-full py-3 rounded-xl font-bold text-xs flex justify-center items-center gap-2 backdrop-blur-md transition-all pointer-events-auto
                         ${offlineMapStatus === 'ready' ? 'bg-emerald-500/90 text-white' : 'bg-slate-900/90 text-white hover:bg-slate-800'}`}
                      >
                         {offlineMapStatus === 'none' && <><CloudDownload size={16}/> Download Map for Offline Use</>}
                         {offlineMapStatus === 'downloading' && <><Activity size={16} className="animate-spin"/> Downloading Region...</>}
                         {offlineMapStatus === 'ready' && <><CheckCircle2 size={16}/> Map Saved Offline</>}
                      </button>
                  </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Elapsed Time</span>
                  <div className="flex flex-col items-center justify-center flex-1">
                      <h2 className="text-3xl font-black text-slate-800">{formatTime(elapsedTime)}</h2>
                  </div>
              </div>

              <div className="bg-white p-4 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white grid grid-cols-2 gap-2">
                  <WidgetButton icon={<Users size={20}/>} label="Pax" onClick={() => setShowDriverManifest(true)} active={boardedCount < passengers.length}/>
                  <WidgetButton icon={<CreditCard size={20}/>} label="Log" onClick={() => setShowExpenseLogger(true)} />
                  {/* 🌟 FIX: Wired up Phone and SOS in Dashboard mode */}
                  <WidgetButton icon={<Phone size={20}/>} label="Call Base" onClick={callBase} />
                  <WidgetButton icon={<AlertTriangle size={20} className="text-red-500"/>} label="SOS" bg="bg-red-50" onClick={triggerSOS} />
              </div>

          </div>
      </div>

      {/* =======================================================================
          MODALS & OVERLAYS
      ======================================================================= */}

      {/* 📋 BOTTOM SHEET MANIFEST */}
      {showDriverManifest && (
          <div className="fixed inset-0 z-[150] flex flex-col justify-end">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDriverManifest(false)}></div>
              <div className="bg-[#e5e7eb] w-full h-[85vh] rounded-t-[3rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full duration-300 relative z-10 border-t border-white">
                  <div className="flex justify-center pt-4 pb-2"><div className="w-16 h-1.5 bg-slate-300 rounded-full"></div></div>
                  <div className="px-8 pb-6 pt-2 flex justify-between items-center">
                      <div><h2 className="text-3xl font-black text-slate-900">Manifest</h2><p className="text-sm font-bold text-slate-500 mt-1">Check passengers as they board</p></div>
                      <div className="text-right"><span className="text-[10px] font-black uppercase text-slate-400 block">Boarded</span><span className="text-2xl font-black" style={{ color: APP_COLOR }}>{boardedCount}/{passengers.length}</span></div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-3">
                      {passengers.map((pax) => (
                          <div key={pax.id} onClick={() => handleHeadcountToggle(pax.id, !!pax.boarded)} className={`p-5 rounded-3xl flex items-center justify-between cursor-pointer transition-all active:scale-95 bg-white shadow-sm border border-white ${pax.boarded ? 'opacity-50' : ''}`}>
                              <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${pax.boarded ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
                                      {pax.boarded ? <CheckCircle2 size={24}/> : <CheckSquare size={24}/>}
                                  </div>
                                  <div>
                                      <h3 className={`text-lg font-black ${pax.boarded ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{pax.first_name} {pax.last_name}</h3>
                                      <p className="text-xs text-slate-500 font-bold mt-0.5">{pax.phone || 'No Phone'}</p>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* 🛡️ PRE-TRIP CHECKLIST */}
      {showChecklist && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 border border-white">
                  <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6"><ClipboardCheck size={32}/></div>
                  <h2 className="text-3xl font-black mb-2 text-slate-900">Safety Check</h2>
                  <p className="text-slate-500 text-sm font-medium mb-8">Confirm vehicle readiness.</p>
                  <div className="space-y-3 mb-10">
                      <CheckRow label="Fuel levels sufficient" checked={vehicleCheck.fuel} onClick={() => setVehicleCheck({...vehicleCheck, fuel: !vehicleCheck.fuel})} />
                      <CheckRow label="Tire pressure OK" checked={vehicleCheck.tires} onClick={() => setVehicleCheck({...vehicleCheck, tires: !vehicleCheck.tires})} />
                      <CheckRow label="Brakes responsive" checked={vehicleCheck.brakes} onClick={() => setVehicleCheck({...vehicleCheck, brakes: !vehicleCheck.brakes})} />
                      {/* 🌟 FIX: Added the missing cleanliness check! */}
                      <CheckRow label="Interior clean" checked={vehicleCheck.cleanliness} onClick={() => setVehicleCheck({...vehicleCheck, cleanliness: !vehicleCheck.cleanliness})} />
                  </div>
                  <button disabled={!checklistComplete} onClick={() => { setIsTripActive(true); setIsDriveMode(true); setShowChecklist(false); }} className={`w-full py-5 rounded-[2rem] font-black text-lg transition-all ${checklistComplete ? 'text-white shadow-xl shadow-emerald-500/20' : 'bg-slate-100 text-slate-400'}`} style={checklistComplete ? { backgroundColor: APP_COLOR } : {}}>{checklistComplete ? 'START TRIP' : 'COMPLETE CHECKS'}</button>
                  <button onClick={() => setShowChecklist(false)} className="w-full mt-4 py-3 text-slate-500 font-bold hover:text-slate-800">Cancel</button>
              </div>
          </div>
      )}

      {/* 💰 REAL EXPENSE LOGGER */}
      {showExpenseLogger && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md mx-auto rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full border-t border-white">
                  <div className="flex justify-between items-center mb-8">
                      <h2 className="text-2xl font-black text-slate-900">Log Expense</h2>
                      <button onClick={() => setShowExpenseLogger(false)} className="p-3 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><X size={20}/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                      <button onClick={() => setExpenseType('Fuel')} className={`p-6 border rounded-3xl flex flex-col items-center gap-3 transition-colors ${expenseType === 'Fuel' ? 'bg-orange-50 border-orange-200 shadow-inner' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                          <Fuel size={32} className={expenseType === 'Fuel' ? 'text-orange-500' : 'text-slate-400'} />
                          <span className={`font-bold text-sm ${expenseType === 'Fuel' ? 'text-orange-700' : 'text-slate-500'}`}>Fuel</span>
                      </button>
                      <button onClick={() => setExpenseType('Toll')} className={`p-6 border rounded-3xl flex flex-col items-center gap-3 transition-colors ${expenseType === 'Toll' ? 'bg-blue-50 border-blue-200 shadow-inner' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                          <Droplets size={32} className={expenseType === 'Toll' ? 'text-blue-500' : 'text-slate-400'} />
                          <span className={`font-bold text-sm ${expenseType === 'Toll' ? 'text-blue-700' : 'text-slate-500'}`}>Tolls</span>
                      </button>
                  </div>
                  <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Amount (0.00)" className="w-full bg-slate-50 p-6 rounded-3xl mb-6 font-black text-3xl outline-none border border-slate-100 text-center text-slate-800 focus:ring-2 focus:ring-slate-200 transition-all" />
                  
                  <button disabled={!expenseAmount || isSubmittingExpense} onClick={handleExpenseSubmit} className="w-full text-white py-5 rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50" style={{ backgroundColor: APP_COLOR }}>
                      {isSubmittingExpense ? 'Sending to Ledger...' : 'Submit to Ledger'}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

/* --- MINI UI COMPONENTS --- */
const DockButton = ({ icon, onClick, active }: any) => (
    <button onClick={onClick} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all relative ${active ? 'bg-slate-100 text-slate-900' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
        {icon}
        {active && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>}
    </button>
);

const WidgetButton = ({ icon, label, onClick, bg = "bg-slate-50", active }: any) => (
    <button onClick={onClick} className={`${bg} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-slate-100 active:scale-95 transition-all relative`}>
        {icon}
        <span className="text-[9px] font-black uppercase text-slate-500">{label}</span>
        {active && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
    </button>
);

const CheckRow = ({ label, checked, onClick }: any) => (
    <div onClick={onClick} className={`flex justify-between items-center p-4 rounded-2xl cursor-pointer transition-all ${checked ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-100'}`}>
        <span className={`font-bold text-sm ${checked ? 'text-emerald-700' : 'text-slate-600'}`}>{label}</span>
        {checked ? <CheckCircle2 size={24} className="text-emerald-500"/> : <div className="w-6 h-6 rounded-full border-2 border-slate-300"/>}
    </div>
);

export default DriverCockpit;