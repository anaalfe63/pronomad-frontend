import React, { ReactNode } from 'react';
import { TrendingUp, Users, MapPin, DollarSign } from 'lucide-react';

// --- TYPES & INTERFACES ---
interface StatCardData {
  label: string;
  value: string;
  trend: string;
  icon: ReactNode;
  bg: string;
}

const StatsCards: React.FC = () => {
  const stats: StatCardData[] = [
    { 
      label: 'Monthly Revenue', 
      value: 'GHS 245,000', 
      trend: '+18% vs last month',
      icon: <DollarSign size={24} className="text-white" />,
      bg: 'bg-green-500' // Money is Green
    },
    { 
      label: 'Active Travelers', 
      value: '1,204', 
      trend: '4 Groups in Transit',
      icon: <Users size={24} className="text-white" />,
      bg: 'bg-teal-500' // People are Teal
    },
    { 
      label: 'Fleet Status', 
      value: '8/10 Active', 
      trend: '2 in Maintenance',
      icon: <MapPin size={24} className="text-white" />,
      bg: 'bg-slate-600' // Logistics are Slate
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {stats.map((stat, index) => (
        <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-2">{stat.value}</h3>
            </div>
            <div className={`p-3 rounded-xl shadow-md ${stat.bg}`}>
              {stat.icon}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-600" />
            <span className="text-sm font-medium text-slate-400">{stat.trend}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;