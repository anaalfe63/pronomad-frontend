import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Phone, AlertTriangle, Signal, Info } from 'lucide-react';

interface ActiveManifest {
  dispatchToken: string;
  id: string;
  destination: string;
  pax: number;
  [key: string]: any;
}

const GuideMode: React.FC = () => {
  const [isTripActive, setIsTripActive] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [manifest, setManifest] = useState<ActiveManifest | null>(null); 

  // Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTripActive) {
      interval = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [isTripActive]);

  // Manifest Fetching & Audio Alert Logic
  useEffect(() => {
    const playAlertSound = () => {
      try {
        // Using a professional, short notification "ping" sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log("Browser blocked auto-play. User must click on the page first."));
      } catch (error) {
        console.error("Audio playback failed", error);
      }
    };

    const checkManifest = (e?: StorageEvent) => {
      const data = localStorage.getItem('active_manifest');
      if (data) {
        const parsedData: ActiveManifest = JSON.parse(data);
        
        setManifest((prev) => {
          // Check if the dispatchToken is new, instead of just the ID
          if (!prev || prev.dispatchToken !== parsedData.dispatchToken) {
            
            if (e && e.type === 'storage') {
              playAlertSound();
            }
            return parsedData;
          }
          return prev;
        });
      }
    };
    
    // Check immediately on load (no sound)
    checkManifest(); 
    
    // Listen for dispatches from the Operations tab (triggers sound)
    window.addEventListener('storage', checkManifest);
    return () => window.removeEventListener('storage', checkManifest);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col font-sans overflow-hidden">
      
      {/* 1. TOP NAV */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 shadow-lg z-20">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-900 rounded-lg flex items-center justify-center border border-teal-700">
              <Navigation size={20} className="text-teal-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 tracking-wide">NAVIGATOR</h1>
              <p className="text-xs text-teal-500 font-mono uppercase tracking-tighter">UNIT: PRONOMAD-01</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <div className="flex items-center gap-1 text-green-400">
               <Signal size={14} />
               <span className="text-xs font-bold">GPS: STRONG</span>
             </div>
             <span className="text-xs text-slate-500">v2.4.0</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN COCKPIT AREA */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-800 pointer-events-none"></div>

        {/* TRIP DATA DISPLAY */}
        <div className="z-10 w-full max-w-sm grid grid-cols-2 gap-4 mb-10">
          <div className="bg-slate-800/50 backdrop-blur-md p-4 rounded-xl border border-slate-700 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Duration</p>
            <p className="text-2xl font-mono font-bold text-white">{formatTime(elapsedTime)}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-md p-4 rounded-xl border border-slate-700 text-center">
             <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Status</p>
             <p className={`text-xl font-bold ${isTripActive ? 'text-green-400 animate-pulse' : 'text-slate-500'}`}>
               {isTripActive ? '• LIVE' : 'STANDBY'}
             </p>
          </div>
        </div>

        {/* START ENGINE BUTTON */}
        <div className="z-10 relative group cursor-pointer" onClick={() => setIsTripActive(!isTripActive)}>
          <div className={`absolute -inset-4 rounded-full blur-xl transition-all duration-500
            ${isTripActive ? 'bg-green-500/30' : 'bg-teal-500/10'}`}></div>
          
          <div className="w-48 h-48 rounded-full bg-slate-800 p-2 shadow-2xl border border-slate-600 flex items-center justify-center relative">
            <div className={`w-full h-full rounded-full border-4 shadow-inner flex flex-col items-center justify-center transition-all duration-300
              ${isTripActive 
                ? 'bg-gradient-to-br from-green-600 to-green-800 border-green-500' 
                : 'bg-gradient-to-br from-slate-700 to-slate-900 border-slate-600 hover:border-teal-500'
              }`}>
                {isTripActive ? <Navigation size={40} className="text-white mb-1"/> : <MapPin size={40} className="text-slate-400 mb-1"/>}
                <span className="text-lg font-black text-white tracking-widest">
                  {isTripActive ? 'ACTIVE' : 'START'}
                </span>
            </div>
          </div>
        </div>

        {/* --- [NEW] MANIFEST DISPLAY CARD --- */}
        {manifest && (
          <div className="z-10 mt-8 w-full max-w-sm bg-slate-800/80 p-4 rounded-2xl border border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Active Manifest</span>
              <span className="bg-teal-900 text-teal-400 text-[10px] px-2 py-1 rounded font-bold">{manifest.id}</span>
            </div>
            <h4 className="text-white font-bold">{manifest.destination}</h4>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-700">
              <span className="text-sm text-slate-300">Total Pax</span>
              <span className="text-lg font-black text-white">{manifest.pax} Passengers</span>
            </div>
          </div>
        )}

        {/* 3. LEGEND & KEY */}
        <div className="z-10 mt-8 bg-slate-900/80 p-4 rounded-lg border border-slate-700 w-full max-w-sm">
           <div className="flex items-center gap-2 mb-3 border-b border-slate-700 pb-2">
             <Info size={14} className="text-teal-500"/>
             <span className="text-xs font-bold text-slate-300 uppercase">System Legend</span>
           </div>
           <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                <span className="text-slate-400">Live Tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-500 border border-slate-400"></span>
                <span className="text-slate-400">Engine Off</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                <span className="text-slate-400">GPS Acquired</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span className="text-slate-400">Weak Signal</span>
              </div>
           </div>
        </div>
      </div>

      {/* 4. FOOTER ACTIONS */}
      <div className="bg-slate-800 p-4 grid grid-cols-2 gap-4 border-t border-slate-700 z-20">
        <button className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg text-slate-300 font-bold transition-colors">
          <Phone size={18} /> Base
        </button>
        <button className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-red-900/30 hover:text-red-400 py-3 rounded-lg text-slate-300 font-bold transition-colors">
          <AlertTriangle size={18} /> SOS
        </button>
      </div>
    </div>
  );
};

export default GuideMode;