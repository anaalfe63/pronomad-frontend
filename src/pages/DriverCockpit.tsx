import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { 
  Navigation, Phone, AlertTriangle, Signal, 
  Gauge, ClipboardCheck, Fuel, X, CheckCircle2, 
  Activity, CreditCard, Droplets, ChevronLeft, Map as MapIcon, 
  Send, CloudDownload, WifiOff, Maximize2, Minimize2, CheckSquare, ChevronRight,
  QrCode, ScanLine, Smartphone
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

// 📷 QR SCANNER IMPORT
import { Scanner } from '@yudiel/react-qr-scanner';

// 🗺️ REAL MAP IMPORTS
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// 🌟 CSS-based Map Marker
const createDriverIcon = (color: string) => L.divIcon({
  html: `<div class="relative flex items-center justify-center w-8 h-8"><div class="absolute -inset-2 bg-blue-500/40 rounded-full animate-ping"></div><div class="w-6 h-6 rounded-full border-2 border-white shadow-lg z-10" style="background-color: ${color}"></div></div>`,
  className: 'bg-transparent',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

interface Trip { id: string | number; title: string; trip_ref: string; status: string; start_date: string; logistics?: any; passenger_count?: number; }

const MapUpdater = ({ coords }: { coords: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => { if (coords) map.setView(coords, 15); }, [coords, map]);
  return null;
};

const DriverCockpit: React.FC = () => {
  const { user } = useTenant();
  const navigate = useNavigate();
  const APP_COLOR = user?.themeColor || '#2563eb';
  
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTripActive, setIsTripActive] = useState<boolean>(false);
  
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0); 
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);

  const [isDriveMode, setIsDriveMode] = useState<boolean>(false); 
  const [offlineMapStatus, setOfflineMapStatus] = useState<'none' | 'downloading' | 'ready'>('none');
  const [showChecklist, setShowChecklist] = useState<boolean>(false);
  
  const [vehicleCheck, setVehicleCheck] = useState({ fuel: false, tires: false, brakes: false, cleanliness: false });
  const checklistComplete = Object.values(vehicleCheck).every(v => v === true);

  const [showExpenseLogger, setShowExpenseLogger] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseType, setExpenseType] = useState<'Fuel' | 'Toll'>('Fuel');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // 🌟 SCANNER STATES
  const [showScanner, setShowScanner] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);
  const processingScan = useRef(false);

  // 1. FETCH ALL ASSIGNED TRIPS
  useEffect(() => {
    const fetchAvailableTrips = async () => {
      if (!user?.subscriberId || !user?.fullName) return;
      try {
        const { data: tripData, error } = await supabase
            .from('trips')
            .select('*')
            .eq('subscriber_id', user.subscriberId)
            .neq('status', 'Completed')
            .contains('logistics', { driver: user.fullName }) 
            .order('start_date', { ascending: true });

        if (tripData && !error) {
            setAvailableTrips(tripData);
            if (tripData.length === 1) setCurrentTrip(tripData[0]);
        }
      } catch (e) { console.error("Standby..."); } 
      finally { setLoading(false); }
    };
    fetchAvailableTrips();
  }, [user]);

  // 2. 🌍 REAL GPS TELEMETRY
  useEffect(() => {
    if (!currentTrip) return;
    let watchId: number;
    let timerInterval: ReturnType<typeof setInterval>;

    if (isTripActive) {
      timerInterval = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    }

    watchId = navigator.geolocation.watchPosition(
      async (position) => {
          const { latitude, longitude, speed } = position.coords;
          setCurrentLocation([latitude, longitude]);
          const realSpeedKmh = speed ? Math.round(speed * 3.6) : 0;
          setCurrentSpeed(realSpeedKmh);

          if (navigator.onLine) {
              const payload: any = {
                  lat: latitude, lng: longitude,
                  current_speed: realSpeedKmh,
                  last_ping: new Date().toISOString()
              };
              if (isTripActive) payload.status = 'In Transit';
              await supabase.from('trips').update(payload).eq('id', currentTrip.id);
          }
      },
      (error) => console.error("GPS Error:", error),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
        if (timerInterval) clearInterval(timerInterval);
        if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTripActive, currentTrip]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // 3. 🚨 REAL ACTIONS
  const triggerSOS = async () => {
    if (!window.confirm("🚨 SEND EMERGENCY ALERTS TO HQ? This will notify Operations immediately.")) return;
    try {
      await supabase.from('notifications').insert([{ subscriber_id: user?.subscriberId, type: 'Emergency', title: '🔴 SOS: DRIVER EMERGENCY', message: `${user?.fullName} has triggered an SOS for Trip: ${currentTrip?.title}`, is_read: false }]);
      alert("SOS Broadcast Sent. Help is on the way.");
    } catch (e) { alert("SOS Failed. Please call HQ directly."); }
  };

  const callBase = () => { window.location.href = 'tel:+233244000000'; };

  const handleExpenseSubmit = async () => {
      if (!expenseAmount || !user?.subscriberId) return;
      setIsSubmittingExpense(true);
      const payload = { subscriber_id: user.subscriberId, submitter: user.fullName || 'Driver', category: expenseType, description: `Vehicle Log - ${currentTrip?.title || 'General Routing'}`, amount: Number(expenseAmount), status: 'Pending', date: new Date().toISOString() };
      try {
          if (!navigator.onLine) throw new Error("Offline");
          const { error } = await supabase.from('expenses').insert([payload]);
          if (error) throw error;
          alert("Expense successfully submitted!");
          setShowExpenseLogger(false); setExpenseAmount('');
      } catch (e) { alert("Network error. Could not send expense."); } 
      finally { setIsSubmittingExpense(false); }
  };

  const handleDownloadMap = () => {
      if(offlineMapStatus === 'ready') return;
      setOfflineMapStatus('downloading');
      setTimeout(() => setOfflineMapStatus('ready'), 3000); 
  };

  // 🌟 QR SCAN PROCESSING ENGINE
  const handleScan = async (text: string) => {
      if (processingScan.current) return;
      processingScan.current = true;
      setScanFeedback(null);

      try {
          if (!text.startsWith('pronomad:verify:')) {
              throw new Error("Invalid QR Code. Please scan a valid Pronomad Passport.");
          }

          const bookingId = text.replace('pronomad:verify:', '');
          if (!bookingId) throw new Error("Corrupted QR Code.");

          // Look up the passenger on THIS specific trip
          const { data: pax, error } = await supabase
              .from('passengers')
              .select('*')
              .eq('booking_id', bookingId)
              .eq('trip_id', currentTrip?.id)
              .single();

          if (error || !pax) {
              setScanFeedback({ type: 'error', message: "Passenger not found on this manifest!" });
              return;
          }

          // Check Payment Verification
          if (pax.payment_status !== 'Full') {
              setScanFeedback({ type: 'warning', message: `STOP! ${pax.first_name} ${pax.last_name} has an unverified or pending balance. Do not board.` });
              new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(()=>console.log('Audio blocked'));
              return;
          }

          // Check if already boarded
          if (pax.boarded) {
              setScanFeedback({ type: 'warning', message: `${pax.first_name} is already checked in.` });
              return;
          }

          // Update Database -> Boarded!
          await supabase.from('passengers').update({ boarded: true }).eq('id', pax.id);
          
          setScanFeedback({ type: 'success', message: `✅ ${pax.first_name} ${pax.last_name} Boarded Successfully!` });
          new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3').play().catch(()=>console.log('Audio blocked'));

      } catch (e: any) {
          setScanFeedback({ type: 'error', message: e.message });
      } finally {
          setTimeout(() => { processingScan.current = false; }, 3000);
      }
  };

  const defaultCenter: [number, number] = [5.6037, -0.1870]; 

  if (loading) return <div className="h-screen bg-[#e5e7eb] flex items-center justify-center"><Activity className="text-slate-400 animate-spin" size={48}/></div>;
  
  if (!currentTrip) {
      return (
          <div className="h-screen bg-[#e5e7eb] flex flex-col font-sans overflow-hidden">
              <div className="p-6 flex justify-between items-center bg-slate-900 text-white rounded-b-[2rem] shadow-lg sticky top-0 z-20">
                  <button onClick={() => navigate('/landing')} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center"><ChevronLeft size={20} /></button>
                  <h2 className="font-black">Select Dispatch</h2>
                  <div className="w-10"></div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {availableTrips.length > 0 ? (
                      availableTrips.map(trip => (
                          <div key={trip.id} onClick={() => setCurrentTrip(trip)} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer hover:border-blue-200 active:scale-95 transition-all group flex justify-between items-center">
                              <div>
                                  <div className="flex items-center gap-2 mb-2">
                                      <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">{trip.trip_ref}</span>
                                      <span className="text-xs font-bold text-slate-400">{new Date(trip.start_date).toLocaleDateString()}</span>
                                  </div>
                                  <h3 className="font-black text-lg text-slate-800 leading-tight">{trip.title}</h3>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                  <ChevronRight size={20}/>
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full opacity-50 mt-20">
                          <MapIcon size={64} className="text-slate-400 mb-4"/>
                          <h2 className="text-2xl font-black text-slate-800">Standby for Dispatch</h2>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  return (
    <div className="h-screen bg-[#e5e7eb] text-slate-900 flex flex-col font-sans overflow-hidden relative">
      
      {isDriveMode ? (
          <div className="absolute inset-0 z-0 bg-slate-900 overflow-hidden">
              <div className="absolute inset-0 z-0">
                  <MapContainer center={currentLocation || defaultCenter} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <MapUpdater coords={currentLocation} />
                      {currentLocation && (
                          <Marker position={currentLocation} icon={createDriverIcon(APP_COLOR)}>
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
                  {/* Scanner added to Drive Mode Dock */}
                  <DockButton icon={<ScanLine size={22} className="text-blue-500"/>} onClick={() => setShowScanner(true)} />
                  <DockButton icon={<CheckSquare size={22}/>} onClick={() => setShowChecklist(true)} />
                  <DockButton icon={<CreditCard size={22}/>} onClick={() => setShowExpenseLogger(true)} />
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
      ) : (
          <>
            <div className="p-6 flex justify-between items-center relative z-20">
              <button 
                  onClick={() => {
                      if (availableTrips.length > 1) {
                          setCurrentTrip(null); 
                          setIsDriveMode(false);
                          setIsTripActive(false);
                      } else {
                          navigate('/landing'); 
                      }
                  }} 
                  className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors border border-white"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="bg-white/60 backdrop-blur-md px-6 py-2.5 rounded-full shadow-sm border border-white flex items-center gap-2">
                  <Signal size={16} className={isTripActive ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}/>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-700">{isTripActive ? 'GPS Live' : 'Standby'}</span>
              </div>
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-white font-black shadow-lg" style={{ backgroundColor: APP_COLOR }}>
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
                          {currentTrip.passenger_count && <span className="bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full">Est. {currentTrip.passenger_count} PAX</span>}
                       </div>
                   </div>

                   {/* 🌟 NEW PROMINENT SCAN & BOARD BUTTON */}
                   <button 
                      onClick={() => setShowScanner(true)}
                      className="w-full bg-slate-900 text-white p-5 rounded-[2rem] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-slate-800"
                   >
                      <ScanLine size={24} className="text-blue-400"/>
                      <span className="font-black text-lg">Scan & Board Passengers</span>
                   </button>

                   {/* 🌟 NEW MOBILE FIELD APP REDIRECT BUTTON */}
                   <button 
                      onClick={() => navigate('/mobile-field')} // Make sure this matches your Route path in App.tsx!
                      className="w-full bg-blue-50 text-blue-600 p-5 rounded-[2rem] shadow-sm flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-blue-100 border border-blue-100 mt-4"
                   >
                      <Smartphone size={24} className="text-blue-500"/>
                      <span className="font-black text-lg">Open Field App</span>
                   </button>

                   <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2.5rem] shadow-[0_20px_40px_rgb(0,0,0,0.08)] border border-white">
                       <div className="flex justify-between items-center mb-6">
                          <h3 className="font-black text-slate-800 flex items-center gap-2"><ClipboardCheck size={18} style={{ color: APP_COLOR }}/> Pre-Flight</h3>
                       </div>
                       
                       <div className="bg-slate-50 p-4 rounded-2xl mb-6">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vehicle Status</p>
                           <p className={`font-bold text-sm ${checklistComplete ? 'text-emerald-600' : 'text-slate-800'}`}>{checklistComplete ? 'Cleared for Departure' : 'Pending Safety Checks'}</p>
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
                                <p className="font-bold text-sm flex items-center gap-1"><MapIcon size={14} style={{ color: APP_COLOR }}/> Route Ready</p>
                            </div>
                            <button onClick={() => setIsDriveMode(true)} className="bg-white/90 backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center shadow-sm text-slate-600 hover:text-slate-900 pointer-events-auto"><Maximize2 size={18}/></button>
                        </div>

                        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
                            <button 
                               onClick={handleDownloadMap}
                               className={`w-full py-3 rounded-xl font-bold text-xs flex justify-center items-center gap-2 backdrop-blur-md transition-all pointer-events-auto
                               ${offlineMapStatus === 'ready' ? 'bg-emerald-500/90 text-white' : 'bg-slate-900/90 text-white hover:bg-slate-800'}`}
                            >
                               {offlineMapStatus === 'none' && <><CloudDownload size={16}/> Download Map Offline</>}
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
                        <WidgetButton icon={<CheckSquare size={20}/>} label="Checks" onClick={() => setShowChecklist(true)} active={!checklistComplete}/>
                        <WidgetButton icon={<CreditCard size={20}/>} label="Fuel/Toll" onClick={() => setShowExpenseLogger(true)} />
                        <WidgetButton icon={<Phone size={20}/>} label="Call Base" onClick={callBase} />
                        <WidgetButton icon={<AlertTriangle size={20} className="text-red-500"/>} label="SOS" bg="bg-red-50" onClick={triggerSOS} />
                    </div>
                </div>
            </div>
          </>
      )}

      {/* 🛡️ PRE-TRIP CHECKLIST MODAL */}
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
                      <CheckRow label="Interior clean" checked={vehicleCheck.cleanliness} onClick={() => setVehicleCheck({...vehicleCheck, cleanliness: !vehicleCheck.cleanliness})} />
                  </div>
                  <button disabled={!checklistComplete} onClick={() => { setIsTripActive(true); setIsDriveMode(true); setShowChecklist(false); }} className={`w-full py-5 rounded-[2rem] font-black text-lg transition-all ${checklistComplete ? 'text-white shadow-xl shadow-emerald-500/20' : 'bg-slate-100 text-slate-400'}`} style={checklistComplete ? { backgroundColor: APP_COLOR } : {}}>{checklistComplete ? 'START TRIP' : 'COMPLETE CHECKS'}</button>
                  <button onClick={() => setShowChecklist(false)} className="w-full mt-4 py-3 text-slate-500 font-bold hover:text-slate-800">Cancel</button>
              </div>
          </div>
      )}

      {/* 💰 REAL EXPENSE LOGGER MODAL */}
      {showExpenseLogger && (
          <div className="fixed inset-0 z-[200] flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md mx-auto rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom-full border-t border-white pb-12">
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

      {/* 🌟 FULL SCREEN QR SCANNER MODAL */}
      {showScanner && (
         <div className="fixed inset-0 z-[300] bg-black flex flex-col animate-in slide-in-from-bottom-full duration-300">
             <div className="p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-10">
                 <div className="text-white">
                    <h3 className="font-black text-lg flex items-center gap-2"><QrCode size={18}/> Scan Passport</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Position QR Code in frame</p>
                 </div>
                 <button onClick={() => { setShowScanner(false); setScanFeedback(null); }} className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md active:scale-95"><X/></button>
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
                         {scanFeedback.type === 'success' ? <CheckCircle2 size={32} /> : <AlertTriangle size={32}/>}
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

const DockButton = ({ icon, onClick, active }: any) => (
    <button onClick={onClick} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all relative ${active ? 'bg-slate-100 text-slate-900' : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'}`}>
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