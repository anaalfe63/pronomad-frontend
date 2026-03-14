import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Map as MapIcon, Zap, Clock, Fuel, CheckCircle2, 
  ArrowRight, BrainCircuit, RefreshCw, Send, AlertTriangle,
  Coffee, MapPin, Navigation, Sparkles
} from 'lucide-react';

// Fix Leaflet Icons (Using CDN to bypass TypeScript PNG import errors)
const DefaultIcon = L.icon({ 
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', 
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', 
  iconSize: [25, 41], 
  iconAnchor: [12, 41] 
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom AI Marker Icon
const aiIconHtml = `
  <div class="relative flex items-center justify-center w-8 h-8">
     <div class="absolute -inset-2 bg-blue-500/40 rounded-full animate-ping"></div>
     <div class="w-6 h-6 rounded-full border-2 border-white shadow-lg bg-blue-500 z-10 flex items-center justify-center text-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
     </div>
  </div>
`;
const aiIcon = L.divIcon({ html: aiIconHtml, className: 'bg-transparent', iconSize: [32, 32], iconAnchor: [16, 16] });

// --- TYPES & MOCK DATA ---
interface RouteStop {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type: string;
  eta: string;
  note?: string; 
}

const STANDARD_ROUTE: RouteStop[] = [
  { id: 1, name: "Accra Mall (Pickup)", lat: 5.6230, lng: -0.1730, type: "pickup", eta: "07:00 AM" },
  { id: 2, name: "Cape Coast Castle", lat: 5.1056, lng: -1.2461, type: "attraction", eta: "10:30 AM" },
  { id: 3, name: "Kakum National Park", lat: 5.3486, lng: -1.3828, type: "attraction", eta: "01:00 PM" },
  { id: 4, name: "Elmina Castle", lat: 5.0833, lng: -1.3500, type: "attraction", eta: "04:30 PM" },
];

const AI_OPTIMIZED_ROUTE: RouteStop[] = [
  { id: 1, name: "Accra Mall (Pickup)", lat: 5.6230, lng: -0.1730, type: "pickup", eta: "07:00 AM" },
  { id: 5, name: "Winneba Rest Stop (AI Added)", lat: 5.3365, lng: -0.6268, type: "rest", eta: "08:45 AM", note: "Suggested 15m break. High fatigue risk on straight highway." },
  { id: 3, name: "Kakum National Park", lat: 5.3486, lng: -1.3828, type: "attraction", eta: "10:15 AM", note: "Reordered to avoid afternoon heat & crowds." },
  { id: 2, name: "Cape Coast Castle", lat: 5.1056, lng: -1.2461, type: "attraction", eta: "01:30 PM" },
  { id: 4, name: "Elmina Castle", lat: 5.0833, lng: -1.3500, type: "attraction", eta: "03:45 PM" },
];

const AutoFitBounds: React.FC<{ markers: any[] }> = ({ markers }) => {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], duration: 1.5 });
    }
  }, [markers, map]);
  return null;
};

const SmartRoute: React.FC = () => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isOptimized, setIsOptimized] = useState(false);
  const [activeRoute, setActiveRoute] = useState(STANDARD_ROUTE);

  const handleOptimize = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setActiveRoute(AI_OPTIMIZED_ROUTE);
      setIsOptimized(true);
      setIsOptimizing(false);
    }, 2000);
  };

  const handleRevert = () => {
    setActiveRoute(STANDARD_ROUTE);
    setIsOptimized(false);
  };

  return (
    <div className="animate-fade-in pb-20 relative">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-xl">
               <BrainCircuit size={28} className="text-blue-500" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">SmartRoute</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
             <Sparkles size={16} className="text-teal-500"/> AI Logistics, Fuel, & Itinerary Mapping
          </p>
        </div>
        
        {/* Active Dispatch Button */}
        <button disabled={!isOptimized} className={`px-8 py-4 rounded-2xl font-black shadow-xl flex items-center gap-3 transition-all ${isOptimized ? 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-1' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
            <Send size={18}/> Push Route to Driver App
        </button>
      </div>

      {/* TOP KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Distance</p>
                <h3 className="text-2xl font-black text-slate-800">{isOptimized ? '342 km' : '385 km'}</h3>
            </div>
            <MapIcon size={28} className="text-slate-300"/>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Est. Drive Time</p>
                <h3 className="text-2xl font-black text-slate-800">{isOptimized ? '6h 15m' : '7h 40m'}</h3>
            </div>
            <Clock size={28} className="text-slate-300"/>
        </div>
        <div className={`p-6 rounded-[2rem] shadow-sm border transition-colors flex items-center justify-between ${isOptimized ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
            <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isOptimized ? 'text-emerald-600' : 'text-slate-400'}`}>Fuel Efficiency</p>
                <h3 className={`text-2xl font-black ${isOptimized ? 'text-emerald-700' : 'text-slate-800'}`}>{isOptimized ? '+18% Saved' : 'Standard'}</h3>
            </div>
            <Fuel size={28} className={isOptimized ? 'text-emerald-400' : 'text-slate-300'}/>
        </div>
        <div className={`p-6 rounded-[2rem] shadow-sm border transition-colors flex items-center justify-between ${isOptimized ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100'}`}>
            <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isOptimized ? 'text-blue-600' : 'text-slate-400'}`}>AI Optimization</p>
                <h3 className={`text-2xl font-black ${isOptimized ? 'text-blue-700' : 'text-slate-800'}`}>{isOptimized ? 'Active' : 'Off'}</h3>
            </div>
            {isOptimized ? <Zap size={28} className="text-blue-400"/> : <BrainCircuit size={28} className="text-slate-300"/>}
        </div>
      </div>

      {/* MAIN SPLIT VIEW */}
      <div className="flex flex-col lg:flex-row gap-8 min-h-[600px]">
        
        {/* LEFT: ITINERARY & AI CONTROLS */}
        <div className="lg:w-[400px] flex flex-col gap-6">
            
            {/* AI Control Box */}
            <div className={`p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden transition-colors duration-500 ${isOptimized ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}>
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <h3 className="text-xl font-black mb-2 flex items-center gap-2">
                    <BrainCircuit size={20}/> 
                    {isOptimizing ? 'Analyzing Nodes...' : isOptimized ? 'Route Optimized' : 'SmartRoute Engine'}
                </h3>
                <p className={`text-sm font-medium mb-8 ${isOptimized ? 'text-blue-100' : 'text-slate-400'}`}>
                    {isOptimized ? 'AI has reordered your stops to save 1h 25m of traffic and 18% fuel.' : 'Let AI rearrange this itinerary for maximum fuel & time efficiency.'}
                </p>

                {isOptimizing ? (
                    <div className="w-full bg-white/10 p-4 rounded-2xl flex items-center justify-center gap-3 font-bold animate-pulse">
                        <RefreshCw size={20} className="animate-spin text-blue-400"/> Crunching Traffic Data
                    </div>
                ) : isOptimized ? (
                    <button onClick={handleRevert} className="w-full bg-white/20 hover:bg-white/30 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all">
                        Revert to Original
                    </button>
                ) : (
                    <button onClick={handleOptimize} className="w-full bg-blue-500 hover:bg-blue-400 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all active:scale-95">
                        <Zap size={18}/> Optimize Now
                    </button>
                )}
            </div>

            {/* Daily Itinerary Timeline */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 flex-1 overflow-y-auto">
                <h3 className="font-black text-slate-800 text-lg mb-6">Daily Dispatch Timeline</h3>
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[19px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {activeRoute.map((stop, index) => (
                        <div key={stop.id} className="relative flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border-4 border-white shadow-sm ${stop.type === 'rest' ? 'bg-orange-100 text-orange-500' : stop.type === 'pickup' ? 'bg-slate-800 text-white' : 'bg-teal-100 text-teal-600'}`}>
                                {stop.type === 'rest' ? <Coffee size={14}/> : stop.type === 'pickup' ? <MapPin size={14}/> : <Navigation size={14}/>}
                            </div>
                            <div className={`flex-1 p-4 rounded-2xl border ${stop.type === 'rest' ? 'bg-orange-50/50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-black text-slate-800 text-sm leading-tight">{stop.name}</h4>
                                    <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-100 whitespace-nowrap">{stop.eta}</span>
                                </div>
                                {stop.note && (
                                    <div className="mt-2 flex items-start gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-100/50 p-2 rounded-lg">
                                        <Zap size={12} className="shrink-0 mt-0.5"/> {stop.note}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* RIGHT: THE MAP */}
        <div className="flex-1 bg-slate-200 rounded-[3rem] shadow-xl border-4 border-white/60 overflow-hidden relative z-0">
            <MapContainer center={[5.35, -0.8]} zoom={9} className="h-full w-full min-h-[500px]">
                <TileLayer 
                  attribution='&copy; OpenStreetMap' 
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                
                <AutoFitBounds markers={activeRoute} />

                {/* Draw Lines connecting the stops */}
                <Polyline 
                    positions={activeRoute.map(r => [r.lat, r.lng] as [number, number])} 
                    color={isOptimized ? "#3b82f6" : "#cbd5e1"} 
                    weight={isOptimized ? 5 : 4}
                    dashArray={isOptimized ? undefined : "10, 10"}
                    className={isOptimized ? "animate-pulse" : ""}
                />

                {/* Draw Markers */}
                {activeRoute.map((stop, index) => (
                    <Marker 
                        key={stop.id} 
                        position={[stop.lat, stop.lng]} 
                        icon={stop.type === 'rest' ? aiIcon : DefaultIcon}
                    >
                        <Popup className="rounded-2xl border-none shadow-2xl">
                            <div className="p-1">
                                <span className="bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md mb-2 inline-block">Stop {index + 1}</span>
                                <h3 className="font-black text-slate-800 text-sm leading-tight">{stop.name}</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1"><Clock size={12}/> ETA: {stop.eta}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* Overlays */}
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-slate-900/10 to-transparent pointer-events-none z-[400]"></div>
            
            {/* Live Traffic Warning Simulation */}
            {!isOptimized && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-red-100 z-[400] flex items-center gap-4 w-[90%] max-w-md animate-in slide-in-from-bottom-10">
                    <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center shrink-0">
                        <AlertTriangle size={24}/>
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 text-sm">Traffic Warning: N1 Highway</h4>
                        <p className="text-xs text-slate-500 font-medium mt-1">Severe congestion detected on current route. Expected delay: +1h 15m.</p>
                    </div>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default SmartRoute;