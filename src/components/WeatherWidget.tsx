import React from 'react';
import { CloudSun, Wind } from 'lucide-react';

const WeatherWidget: React.FC = () => {
  return (
    <div className="flex gap-6">
      <div className="flex-1 bg-white/90 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border border-white/60 flex items-center justify-between">
        <div>
          <h3 className="text-5xl font-bold text-slate-800">32°</h3>
          <p className="text-slate-500 font-medium mt-1">Sunny, Accra</p>
        </div>
        <div className="bg-yellow-400 p-4 rounded-full shadow-lg shadow-yellow-400/40 text-white">
          <CloudSun size={32} />
        </div>
      </div>
      
      {/* Small extra widget for variety */}
      <div className="w-1/3 bg-teal-600 text-white p-6 rounded-[2rem] shadow-xl shadow-teal-600/30 flex flex-col items-center justify-center">
        <Wind size={24} className="mb-2 opacity-80" />
        <span className="font-bold text-lg">14 km/h</span>
        <span className="text-xs opacity-70">Wind</span>
      </div>
    </div>
  );
};

export default WeatherWidget;