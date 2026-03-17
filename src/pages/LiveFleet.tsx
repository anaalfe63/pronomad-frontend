import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  AlertTriangle, User, Battery, Navigation, RefreshCw,
  Gauge, Search, ArrowRight, ShieldAlert, MapPin, Siren, Radio, Maximize, CheckCircle2, Map, Save, X, Flame, ChevronDown, Activity, Users, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

// Fix for default Leaflet marker icons not showing in React/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Vehicle {
  id: string | number;
  vehicleId: string;
  driver: string;
  lat: number;
  lng: number;
  speed: number;
  fuel: number;
  location: string;
  status: string;
  tripTitle?: string;
  isIdle?: boolean;
  hasGPS?: boolean;
}

const MapController: React.FC<{ vehicles: Vehicle[], selectedId: string | number | null, hqLocation: [number, number] }> = ({ vehicles, selectedId, hqLocation }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedId) {
      const target = vehicles.find(v => v.id === selectedId);
      if (target) map.flyTo([target.lat, target.lng], 16, { duration: 1.5 }); 
    } else if (vehicles.length > 0) {
      const bounds = L.latLngBounds(vehicles.map(v => [v.lat, v.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    } else {
      map.flyTo(hqLocation, 12, { duration: 1.5 });
    }
  }, [selectedId, vehicles.length, map, hqLocation]); 
  return null;
};

const getMarkerIcon = (vehicle: Vehicle, themeColor: string) => {
  const isSpeeding = vehicle.speed > 100;
  const isIdle = vehicle.isIdle || vehicle.status === 'Standby' || !vehicle.hasGPS;
  
  let colorHex = themeColor;
  let pulse = '';
  
  if (isSpeeding) {
      colorHex = '#dc2626'; // Red
      pulse = '<div class="absolute -inset-2 bg-red-500/40 rounded-full animate-ping"></div>';
  } else if (isIdle) {
      colorHex = '#94a3b8'; // Slate
  }

  const html = `
    <div class="relative flex items-center justify-center w-8 h-8">
       ${pulse}
       <div class="w-6 h-6 rounded-full border-2 border-white shadow-lg z-10" style="background-color: ${colorHex}"></div>
    </div>
  `;

  return L.divIcon({
    html, className: 'bg-transparent', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16]
  });
};

const LiveFleet: React.FC = () => {
  const { user } = useTenant();
  const APP_COLOR = user?.themeColor || '#10b981';
  const navigate = useNavigate();
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | number | null>(null);
  const [selectedDropdownId, setSelectedDropdownId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const [hqLocation, setHqLocation] = useState<[number, number]>([5.6037, -0.1870]); 
  const [isEditingHQ, setIsEditingHQ] = useState<boolean>(false);
  const [editLat, setEditLat] = useState<string>('');
  const [editLng, setEditLng] = useState<string>('');
  const [searchLocationQuery, setSearchLocationQuery] = useState<string>('');
  const [searchLocationStatus, setSearchLocationStatus] = useState<string>('');
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);

  const [heatmapLocations, setHeatmapLocations] = useState<any[]>([]);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);

  // 🌟 NEW: Modal States for Driver & Manifest
  const [detailsModal, setDetailsModal] = useState<{ isOpen: boolean; type: 'manifest' | 'driver'; vehicle: Vehicle | null }>({ isOpen: false, type: 'manifest', vehicle: null });
  const [modalPassengers, setModalPassengers] = useState<any[]>([]);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  useEffect(() => {
    const fetchHeatmapData = async () => {
        if (!user?.subscriberId) return;
        const { data } = await supabase.from('trips').select('title, lat, lng').eq('subscriber_id', user.subscriberId);
        if (data) {
            const validPoints = data.filter(t => t.lat && t.lng).map(t => ({ title: t.title, lat: t.lat, lng: t.lng }));
            setHeatmapLocations(validPoints);
        }
    };
    fetchHeatmapData();
  }, [user]);

  // --- SMART POLLING VIA SUPABASE ---
  useEffect(() => {
    const fetchFleetAndHQ = async () => {
      try {
        if (!user?.subscriberId) return;

        let currentHqLat = hqLocation[0];
        let currentHqLng = hqLocation[1];

        const { data: subData } = await supabase.from('subscribers').select('fleet_lat, fleet_lng').eq('id', user.subscriberId).maybeSingle();

        if (subData && subData.fleet_lat && subData.fleet_lng) {
            currentHqLat = subData.fleet_lat;
            currentHqLng = subData.fleet_lng;
            setHqLocation([currentHqLat, currentHqLng]);
        }

        const { data: activeTrips, error } = await supabase.from('trips').select('*').eq('subscriber_id', user.subscriberId).neq('status', 'Completed'); 

        if (!error && activeTrips) {
            const mappedVehicles: Vehicle[] = activeTrips.map(trip => {
                const hasLiveGps = !!(trip.lat && trip.lng);
                return {
                    id: trip.id,
                    vehicleId: trip.logistics?.vehicleDetail || `Unit-${String(trip.id).substring(0,4)}`,
                    driver: trip.logistics?.driver || 'Unassigned',
                    lat: hasLiveGps ? trip.lat : currentHqLat,
                    lng: hasLiveGps ? trip.lng : currentHqLng,
                    speed: trip.current_speed || 0,
                    fuel: 85, 
                    location: hasLiveGps ? 'Live on Route' : 'Awaiting GPS Signal',
                    status: trip.status || 'Active',
                    tripTitle: trip.title || '',
                    hasGPS: hasLiveGps,
                    isIdle: !hasLiveGps || (!trip.current_speed || trip.current_speed === 0)
                };
            });
            
            setVehicles(mappedVehicles);
            setLastSync(new Date());
        } 
      } catch (error) { console.error("Fleet Telemetry Error:", error); } 
      finally { setLoading(false); }
    };

    fetchFleetAndHQ(); 
    const interval = setInterval(fetchFleetAndHQ, 3000); 
    return () => clearInterval(interval);
  }, [user]);

  const filteredVehicles = useMemo(() => {
      let filtered = vehicles;
      if (selectedDropdownId !== 'ALL') filtered = filtered.filter(v => String(v.id) === String(selectedDropdownId));
      if (searchTerm) {
          const lowerQuery = searchTerm.toLowerCase();
          filtered = filtered.filter(v => v.vehicleId.toLowerCase().includes(lowerQuery) || v.driver.toLowerCase().includes(lowerQuery) || (v.tripTitle && v.tripTitle.toLowerCase().includes(lowerQuery)));
      }
      return filtered;
  }, [vehicles, searchTerm, selectedDropdownId]);

  const kpi = useMemo(() => {
      return {
          total: vehicles.length,
          speeding: vehicles.filter(v => v.speed > 100).length,
          lowFuel: vehicles.filter(v => v.fuel < 20).length,
          active: vehicles.filter(v => v.hasGPS && !v.isIdle).length
      };
  }, [vehicles]);

  const handleReportIncident = (v: Vehicle) => {
      if(window.confirm(`REPORT INCIDENT: Flag vehicle ${v.vehicleId} for safety review?`)) alert("Incident logged to Safety Officer dashboard.");
  };

  const handleSelectVehicle = (id: string | number) => {
      setSelectedVehicleId(id);
      setSelectedDropdownId(String(id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🌟 NEW: Open Details Modal Handler
  const handleOpenDetails = async (v: Vehicle, type: 'manifest' | 'driver') => {
      setDetailsModal({ isOpen: true, type, vehicle: v });
      
      if (type === 'manifest') {
          setIsFetchingDetails(true);
          try {
              const { data } = await supabase.from('passengers').select('*').eq('trip_id', v.id).order('first_name', { ascending: true });
              setModalPassengers(data || []);
          } catch (err) {
              console.error("Failed to load manifest", err);
          } finally {
              setIsFetchingDetails(false);
          }
      }
  };

  const handleSearchLocation = async () => {
      if (!searchLocationQuery) return;
      setIsSearchingLocation(true);
      setSearchLocationStatus('Scanning global maps...');
      try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchLocationQuery)}`);
          const data = await res.json();
          if (data && data.length > 0) {
              setEditLat(data[0].lat);
              setEditLng(data[0].lon);
              const shortName = data[0].display_name.split(',').slice(0, 3).join(',');
              setSearchLocationStatus(`📍 Found: ${shortName}`);
          } else {
              setSearchLocationStatus('❌ Location not found. Try adding the country name.');
              setEditLat(''); setEditLng('');
          }
      } catch (e) { setSearchLocationStatus('❌ Network error while searching. Try again.'); } 
      finally { setIsSearchingLocation(false); }
  };

  const handleSaveHQ = async () => {
      if (!editLat || !editLng || !user?.subscriberId) { alert("Please search and select a valid location first."); return; }
      const newCoords: [number, number] = [parseFloat(editLat), parseFloat(editLng)];
      try {
          const { error } = await supabase.from('subscribers').update({ fleet_lat: newCoords[0], fleet_lng: newCoords[1] }).eq('id', user.subscriberId);
          if (error) throw error;
          setHqLocation(newCoords);
          setIsEditingHQ(false);
          setSearchLocationQuery('');
          setSearchLocationStatus('');
          alert("Fleet Headquarters updated successfully!");
      } catch (err: any) { alert("Failed to update HQ location: " + err.message); }
  };

  return (
    <div className="animate-fade-in relative pb-16 space-y-8">
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              Live Fleet Command 
              {loading ? <RefreshCw size={18} className="animate-spin text-slate-300"/> : <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: APP_COLOR }}></div>}
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Real-time GPS telematics synced at {lastSync.toLocaleTimeString()}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHeatmap(!showHeatmap)} className={`flex items-center gap-2 text-sm font-bold border px-4 py-2 rounded-xl transition-all shadow-sm ${showHeatmap ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'}`}>
              <Flame size={16} className={showHeatmap ? "animate-pulse" : ""} /> {showHeatmap ? 'Hide Heatmap' : 'Overlay Heatmap'}
          </button>

          <button onClick={() => { setEditLat(hqLocation[0].toString()); setEditLng(hqLocation[1].toString()); setSearchLocationStatus(''); setSearchLocationQuery(''); setIsEditingHQ(true); }} className="flex items-center gap-2 text-sm font-bold bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 transition-colors">
              <Map size={16} style={{ color: APP_COLOR }}/> Set Default HQ
          </button>
        </div>
      </div>

      {/* SMART SEARCH HQ MODAL */}
      {isEditingHQ && (
         <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
             <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
                 <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><MapPin size={20} style={{ color: APP_COLOR }}/> Set Fleet Headquarters</h3><button onClick={() => setIsEditingHQ(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button></div>
                 <p className="text-sm text-slate-500 mb-6 font-medium">Type your city, region, or specific landmark below to set the center of your Fleet Map.</p>
                 <div className="space-y-4 mb-6">
                     <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Search Location</label>
                         <div className="flex gap-2">
                             <input type="text" value={searchLocationQuery} onChange={e => setSearchLocationQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchLocation()} className="w-full bg-slate-50 border p-4 rounded-xl outline-none font-bold focus:ring-2 transition-all text-slate-800" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. Accra, Ghana" />
                             <button onClick={handleSearchLocation} disabled={isSearchingLocation || !searchLocationQuery} className="bg-slate-900 text-white px-5 rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center">
                                 {isSearchingLocation ? <RefreshCw size={20} className="animate-spin"/> : <Search size={20} />}
                             </button>
                         </div>
                         <div className="mt-3 min-h-[24px]">
                             {searchLocationStatus && <p className={`text-sm font-bold ${searchLocationStatus.includes('Found') ? 'text-emerald-600' : searchLocationStatus.includes('Scanning') ? 'text-blue-500 animate-pulse' : 'text-red-500'}`}>{searchLocationStatus}</p>}
                         </div>
                     </div>
                 </div>
                 <button onClick={handleSaveHQ} disabled={!editLat} className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:grayscale" style={{ backgroundColor: APP_COLOR }}>
                     <Save size={18}/> Lock in this Location
                 </button>
             </div>
         </div>
      )}

      {/* 2. HUGE HERO MAP */}
      <div className="w-full h-[60vh] min-h-[500px] bg-slate-200 rounded-[3rem] shadow-xl border-4 border-white/60 overflow-hidden relative isolate">
          <MapContainer center={hqLocation} zoom={13} className="h-full w-full z-0">
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="map-tiles-muted" />
              <MapController vehicles={filteredVehicles} selectedId={selectedVehicleId} hqLocation={hqLocation} />

              {showHeatmap && heatmapLocations.map((loc, i) => (
                  <React.Fragment key={`heat-${i}`}>
                      <CircleMarker center={[loc.lat, loc.lng]} radius={40} fillColor="#ef4444" color="transparent" fillOpacity={0.2}><Popup>{loc.title}</Popup></CircleMarker>
                      <CircleMarker center={[loc.lat, loc.lng]} radius={15} fillColor="#dc2626" color="transparent" fillOpacity={0.4} />
                      <CircleMarker center={[loc.lat, loc.lng]} radius={4} fillColor="#b91c1c" color="white" weight={2} fillOpacity={1} />
                  </React.Fragment>
              ))}

              {/* LIVE VEHICLE MARKERS */}
              {filteredVehicles.map((v) => (
                  <Marker key={v.id} position={[v.lat, v.lng]} icon={getMarkerIcon(v, APP_COLOR)}>
                      <Popup className="rounded-3xl shadow-2xl border-none">
                          <div className="p-2 min-w-[240px]">
                              {v.speed > 100 && (
                                  <div className="bg-red-50 border border-red-100 p-2.5 rounded-xl mb-3 flex items-center justify-center gap-2 text-red-600 text-[10px] font-black uppercase tracking-widest animate-pulse">
                                      <AlertTriangle size={14}/> Critical Speed Alert
                                  </div>
                              )}

                              <div className="mb-4">
                                  <h3 className="font-black text-slate-900 text-lg mb-0.5">{v.vehicleId}</h3>
                                  <p className={`text-xs font-medium flex items-center gap-1 ${!v.hasGPS ? 'text-orange-500 animate-pulse' : 'text-slate-500'}`}>
                                    <MapPin size={12} style={{ color: !v.hasGPS ? '#f97316' : APP_COLOR }}/> 
                                    {v.location}
                                  </p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 mb-4">
                                  <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-100">
                                      <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1">Speed</p>
                                      <p className={`font-black text-lg leading-none ${v.speed > 100 ? 'text-red-600' : 'text-slate-800'}`}>{v.speed} <span className="text-[9px] text-slate-400">km/h</span></p>
                                  </div>
                                  <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-100">
                                      <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1">Fuel Lvl</p>
                                      <p className={`font-black text-lg leading-none ${v.fuel < 20 ? 'text-orange-500' : 'text-slate-800'}`}>{v.fuel}<span className="text-[9px] text-slate-400">%</span></p>
                                  </div>
                              </div>

                              <div className="space-y-2">
                                  {/* 🌟 NEW: Launch local Driver & Manifest Modals */}
                                  <button onClick={() => handleOpenDetails(v, 'driver')} className="w-full flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors p-3 rounded-xl border border-slate-100">
                                      <span className="flex items-center gap-2"><User size={14}/> {v.driver}</span>
                                      <ArrowRight size={14}/>
                                  </button>
                                  <button onClick={() => handleOpenDetails(v, 'manifest')} className="w-full flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors p-3 rounded-xl border border-slate-100">
                                      <span className="flex items-center gap-2"><Users size={14} className="truncate"/> Trip Manifest</span>
                                      <ArrowRight size={14}/>
                                  </button>

                                  <div className="grid grid-cols-2 gap-2 pt-2">
                                      <a href={`tel:000`} className="bg-slate-900 text-white py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-md">
                                          <Radio size={14}/> Dispatch
                                      </a>
                                      <button onClick={() => handleReportIncident(v)} className="bg-red-50 text-red-600 border border-red-100 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">
                                          <Siren size={14}/> Flag
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </Popup>
                  </Marker>
              ))}
          </MapContainer>
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-900/10 to-transparent pointer-events-none z-[400]"></div>
      </div>

      {/* 3. BENEATH THE MAP: KPI CONTROLS & VEHICLE GRID */}
      <div className="flex flex-col gap-8">
          <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6">
              
              <div className="flex gap-3 overflow-x-auto pb-2 lg:pb-0 hide-scrollbar w-full lg:w-auto">
                  <div className="bg-white px-6 py-4 rounded-[1.5rem] shadow-sm border border-slate-200 flex items-center gap-4 min-w-[160px]">
                      <div className="p-3 bg-slate-100 text-slate-500 rounded-2xl"><Navigation size={20}/></div>
                      <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Units</p>
                          <p className="text-2xl font-black text-slate-800">{kpi.active} <span className="text-sm font-medium text-slate-400">/ {kpi.total}</span></p>
                      </div>
                  </div>
                  
                  <div className={`px-6 py-4 rounded-[1.5rem] shadow-sm border flex items-center gap-4 min-w-[160px] transition-colors ${kpi.speeding > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                      <div className={`p-3 rounded-2xl ${kpi.speeding > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                          {kpi.speeding > 0 ? <ShieldAlert size={20}/> : <CheckCircle2 size={20} style={{ color: APP_COLOR }}/>}
                      </div>
                      <div>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${kpi.speeding > 0 ? 'text-red-500' : 'text-slate-400'}`}>Speed Alerts</p>
                          <p className={`text-2xl font-black ${kpi.speeding > 0 ? 'text-red-600' : 'text-slate-800'}`}>{kpi.speeding}</p>
                      </div>
                  </div>

                  <div className="bg-white px-6 py-4 rounded-[1.5rem] shadow-sm border border-slate-200 flex items-center gap-4 min-w-[160px]">
                      <div className={`p-3 rounded-2xl ${kpi.lowFuel > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                          <Battery size={20}/>
                      </div>
                      <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Low Fuel</p>
                          <p className="text-2xl font-black text-slate-800">{kpi.lowFuel}</p>
                      </div>
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto min-w-[350px]">
                  <div className="relative flex-1">
                      <select 
                          value={selectedDropdownId}
                          onChange={(e) => {
                              setSelectedDropdownId(e.target.value);
                              if (e.target.value !== 'ALL') {
                                  setSelectedVehicleId(e.target.value);
                              } else {
                                  setSelectedVehicleId(null);
                              }
                          }}
                          className="w-full pl-4 pr-10 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm outline-none text-sm font-bold text-slate-700 appearance-none focus:ring-2 transition-all cursor-pointer truncate"
                          style={{ '--tw-ring-color': APP_COLOR } as any}
                      >
                          <option value="ALL">All Active Trips & Drivers</option>
                          {vehicles.map(v => (
                              <option key={v.id} value={v.id}>
                                  {v.driver} • {v.tripTitle || v.vehicleId}
                              </option>
                          ))}
                      </select>
                      <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                  </div>

                  <div className="relative flex-1">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                      <input 
                          type="text" 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search plate..." 
                          className="w-full pl-11 pr-4 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm outline-none text-sm font-bold text-slate-700 focus:ring-2 transition-all"
                          style={{ '--tw-ring-color': APP_COLOR } as any}
                      />
                  </div>
                  
                  {selectedVehicleId && (
                      <button onClick={() => { setSelectedVehicleId(null); setSelectedDropdownId('ALL'); }} className="px-6 py-4 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap">
                          <Maximize size={16}/> Clear Focus
                      </button>
                  )}
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVehicles.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-slate-400 text-base font-bold bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                      {loading ? 'Connecting to GPS Satellites...' : 'No active trips recorded in database.'}
                  </div>
              ) : (
                  filteredVehicles.map((v) => (
                      <div 
                          key={v.id} 
                          onClick={() => handleSelectVehicle(v.id)}
                          className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer group bg-white shadow-md hover:-translate-y-1`}
                          style={selectedVehicleId === v.id ? { borderColor: APP_COLOR, boxShadow: `0 10px 15px -3px ${APP_COLOR}40`, transform: 'scale(1.02)' } : { borderColor: 'transparent' }}
                      >
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h4 className="font-black text-slate-800 text-xl">{v.vehicleId}</h4>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 line-clamp-1">{v.tripTitle || 'Unassigned Trip'}</p>
                              </div>
                              {v.speed > 100 ? (
                                  <span className="px-3 py-1.5 bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1 animate-pulse"><AlertTriangle size={12}/> ALERT</span>
                              ) : (
                                  <span className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl ${v.hasGPS ? 'text-white' : 'bg-slate-100 text-slate-500'}`} style={v.hasGPS ? { backgroundColor: APP_COLOR } : {}}>
                                      {v.hasGPS ? v.status : 'Awaiting GPS'}
                                  </span>
                              )}
                          </div>
                          
                          <div className="flex items-center justify-between text-sm text-slate-500 pt-4 border-t border-slate-100">
                              <div className="flex items-center gap-2 font-bold text-slate-700" onClick={(e) => { e.stopPropagation(); handleOpenDetails(v, 'driver'); }}><User size={16} style={{ color: APP_COLOR }} className="hover:scale-110 transition-transform"/> {v.driver}</div>
                              <div className="flex items-center gap-4">
                                  <span className={`flex items-center gap-1.5 font-black ${v.speed > 100 ? 'text-red-600' : 'text-slate-600'}`}><Gauge size={16}/> {v.speed}</span>
                                  <span className={`flex items-center gap-1.5 font-black ${v.fuel < 20 ? 'text-orange-500' : 'text-slate-600'}`}><Battery size={16}/> {v.fuel}%</span>
                              </div>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>

      {/* =====================================================================
          🚀 MODALS: Trip Manifest & Driver Info
      ===================================================================== */}
      {detailsModal.isOpen && detailsModal.vehicle && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]">
                  
                  {/* Modal Header */}
                  <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 pb-4">
                      <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                          {detailsModal.type === 'manifest' ? <><Users size={20} style={{ color: APP_COLOR }}/> Trip Manifest</> : <><User size={20} style={{ color: APP_COLOR }}/> Driver Profile</>}
                      </h3>
                      <button onClick={() => setDetailsModal({ isOpen: false, type: 'manifest', vehicle: null })} className="text-slate-400 hover:text-red-500 bg-slate-50 p-2 rounded-full"><X size={20}/></button>
                  </div>

                  {/* Modal Body */}
                  <div className="overflow-y-auto flex-1 pr-2 space-y-4 custom-scrollbar">
                      {detailsModal.type === 'driver' ? (
                          <div className="text-center py-6">
                              <div className="w-28 h-28 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-4xl font-black text-slate-400 mb-4 border-4 border-white shadow-lg" style={{ color: APP_COLOR, backgroundColor: `${APP_COLOR}15` }}>
                                  {detailsModal.vehicle.driver.charAt(0)}
                              </div>
                              <h2 className="text-3xl font-black text-slate-800">{detailsModal.vehicle.driver}</h2>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 mb-8">Assigned to {detailsModal.vehicle.vehicleId}</p>
                              
                              <div className="grid grid-cols-2 gap-3 text-left">
                                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Current Status</p>
                                      <p className="font-bold text-sm text-slate-800">{detailsModal.vehicle.status}</p>
                                  </div>
                                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Current Speed</p>
                                      <p className={`font-black text-sm ${detailsModal.vehicle.speed > 100 ? 'text-red-600' : 'text-slate-800'}`}>{detailsModal.vehicle.speed} km/h</p>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          isFetchingDetails ? (
                              <div className="flex flex-col items-center justify-center py-16">
                                  <Activity size={32} className="animate-spin text-slate-300 mb-4"/>
                                  <p className="text-sm font-bold text-slate-400">Loading passenger list...</p>
                              </div>
                          ) : modalPassengers.length === 0 ? (
                              <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100">
                                  <Users size={32} className="mx-auto text-slate-300 mb-2"/>
                                  <p className="text-slate-400 font-bold">No passengers found for this trip.</p>
                              </div>
                          ) : (
                              <div className="space-y-3">
                                  {modalPassengers.map(pax => (
                                      <div key={pax.id} className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-between hover:border-slate-300 transition-colors">
                                          <div>
                                              <h4 className="font-black text-slate-800 text-base">{pax.first_name} {pax.last_name}</h4>
                                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{pax.phone || 'No Phone Number'}</p>
                                          </div>
                                          <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${pax.boarded ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                              {pax.boarded ? <CheckCircle2 size={12}/> : <Clock size={12}/>}
                                              {pax.boarded ? 'Boarded' : 'Pending'}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default LiveFleet;