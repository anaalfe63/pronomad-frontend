import React from 'react';
import { Plane, ArrowRight } from 'lucide-react';

const TourCard = () => {
  return (
    <div className="bg-white/90 backdrop-blur-md p-8 rounded-[2rem] shadow-xl border border-white/60 relative overflow-hidden group">
      
      {/* Background Decorative Circles */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-100 rounded-full opacity-50 blur-2xl"></div>
      
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Origin</p>
          <h2 className="text-3xl font-black text-slate-800">ACC</h2>
          <p className="text-slate-500 font-medium">Accra, GH</p>
        </div>
        
        {/* The Flight Path Visual */}
        <div className="flex-1 px-4 pb-2 flex flex-col items-center">
          <div className="flex items-center w-full gap-2 text-teal-500">
             <div className="h-2 w-2 rounded-full bg-teal-500"></div>
             <div className="h-0.5 flex-1 bg-teal-200 relative overflow-hidden">
                {/* Animated dash moving across */}
                <div className="absolute inset-0 bg-teal-500 w-1/3 animate-[move_2s_linear_infinite]"></div>
             </div>
             <Plane className="transform rotate-90 text-teal-600" size={20} />
          </div>
          <span className="text-xs font-bold text-red-500 mt-2 bg-red-50 px-2 py-1 rounded-full">
            2 hours remaining
          </span>
        </div>

        <div className="text-right">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Dest.</p>
          <h2 className="text-3xl font-black text-slate-800">CPC</h2>
          <p className="text-slate-500 font-medium">Cape Coast</p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-slate-100">
        <div>
           <p className="text-xs text-slate-400 uppercase font-bold">Departure</p>
           <p className="text-lg font-bold text-slate-800">09:50 AM</p>
        </div>
        <div>
           <p className="text-xs text-slate-400 uppercase font-bold text-right">Arrival</p>
           <p className="text-lg font-bold text-slate-800">01:30 PM</p>
        </div>
      </div>
      
      <style>{`
        @keyframes move {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default TourCard;