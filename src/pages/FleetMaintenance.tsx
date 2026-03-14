import React from 'react';
import { PenTool, AlertCircle, CheckCircle, Activity } from 'lucide-react';

// --- TYPES ---
interface Vehicle {
  id: string;
  model: string;
  mileage: number;
  status: 'Healthy' | 'Warning' | 'Critical';
  lastService: string;
}

const FleetMaintenance: React.FC = () => {
  const fleet: Vehicle[] = [
    { id: 'BUS-01', model: 'Toyota Coaster', mileage: 12400, status: 'Healthy', lastService: '2 weeks ago' },
    { id: 'BUS-04', model: 'Mercedes Sprinter', mileage: 5020, status: 'Warning', lastService: '6 months ago' }, // Needs oil change
    { id: 'JEEP-02', model: 'Wrangler 4x4', mileage: 8900, status: 'Critical', lastService: '1 year ago' },
  ];

  return (
    <div className="h-full animate-fade-in flex flex-col gap-6">
      <h2 className="text-3xl font-bold text-teal-900">Fleet Health Monitor</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {fleet.map((vehicle) => (
          <div key={vehicle.id} className="bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] border border-white/60 shadow-xl relative overflow-hidden group">
            
            {/* Status Indicator Bar */}
            <div className={`absolute top-0 left-0 w-full h-2 
              ${vehicle.status === 'Healthy' ? 'bg-green-500' : vehicle.status === 'Warning' ? 'bg-orange-500' : 'bg-red-500'}`} 
            />

            <div className="flex justify-between items-start mb-4 mt-2">
              <div>
                <h3 className="text-2xl font-black text-slate-800">{vehicle.id}</h3>
                <p className="text-slate-500 text-sm">{vehicle.model}</p>
              </div>
              <div className={`p-2 rounded-xl ${vehicle.status === 'Healthy' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                <Activity size={24}/>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Mileage</span>
                <span className="font-bold text-slate-700">{vehicle.mileage.toLocaleString()} km</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Last Service</span>
                <span className="font-bold text-slate-700">{vehicle.lastService}</span>
              </div>
            </div>

            {vehicle.status !== 'Healthy' ? (
               <button className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors">
                 <PenTool size={16}/> Schedule Repair
               </button>
            ) : (
               <div className="w-full py-3 rounded-xl bg-green-50 text-green-600 font-bold text-center flex items-center justify-center gap-2">
                 <CheckCircle size={16}/> All Systems Go
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FleetMaintenance;