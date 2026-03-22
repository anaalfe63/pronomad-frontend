import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { 
  ArrowRightLeft, Calendar, Clock, 
  Users, UserCircle, Compass, Wallet, Plane
} from 'lucide-react';

const Lounge: React.FC = () => {
  const { user, settings } = useTenant();
  const navigate = useNavigate();

  const isOps = user?.role === 'Operations' || user?.role === 'CEO' || user?.role === 'PROADMIN';
  const isFinance = user?.role === 'Finance' || user?.role === 'CEO' || user?.role === 'PROADMIN';

  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Widget Tab State
  const defaultTab = isOps ? 'operations' : isFinance ? 'finance' : 'clients';
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 🌟 THEME COLORS
  const WIDGET_BLUE = '#26546c'; 
  const BACKGROUND_IMAGE = "/lg-bg.jpg"; 

  // Dynamic text based on active tab
  const tabData = {
    operations: { title: 'Ops Command', action: 'Live Dispatch' },
    finance: { title: 'Finance Ledger', action: 'Process Billing' },
    clients: { title: 'Client Hub', action: 'Manage CRM' }
  };

  return (
    <div className="relative min-h-screen flex flex-col font-sans text-white animate-in fade-in duration-700">
      
      {/* 📸 FULL BLEED BACKGROUND (Lightened overlay to let the image pop) */}
      <div className="fixed inset-0 z-[-1]">
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[30s] hover:scale-[1.03]"
          style={{ backgroundImage: `url('${BACKGROUND_IMAGE}')` }}
        ></div>
        {/* Minimal darkening just so white text is readable */}
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-transparent to-transparent"></div>
      </div>

      {/* TOP NAVBAR (Minimalist) */}
      <div className="w-full flex justify-between items-center p-6 md:px-12 md:py-8 z-10">
        <div className="flex items-center gap-2 font-black text-xl tracking-tight drop-shadow-md">
          <Plane size={24} className="text-white"/> {settings?.company_name || 'Pronomad'}
        </div>
        
        <div className="hidden md:flex items-center gap-8 font-bold text-sm text-white drop-shadow-md">
          <button onClick={() => navigate('/dashboard')} className="hover:text-white/70 transition-colors">Dashboard</button>
          <button onClick={() => navigate('/tour-operations')} className="hover:text-white/70 transition-colors">Operations</button>
          <button onClick={() => navigate('/settings')} className="hover:text-white/70 transition-colors">Settings</button>
        </div>

        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/profile')}>
          <span className="hidden md:block font-bold text-sm drop-shadow-md group-hover:text-white/70 transition-colors">
            {user?.fullName}
          </span>
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg group-hover:bg-white group-hover:text-slate-900 transition-colors">
            {user?.fullName?.charAt(0) || <UserCircle size={20} />}
          </div>
        </div>
      </div>

      {/* =========================================================
          MAIN HERO & COMPACT WIDGET
          ========================================================= */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-24 w-full max-w-[1200px] mx-auto relative z-10 -mt-20">
        
        {/* HERO TEXT */}
        <div className="mb-10 animate-in slide-in-from-left-8 duration-700 delay-100">
          <h1 className="text-4xl md:text-[3.5rem] font-light tracking-tight text-white drop-shadow-lg">
            Hey {user?.fullName?.split(' ')[0] || 'Buddy'}! what are you
          </h1>
          <h1 className="text-5xl md:text-[4.5rem] font-black tracking-tight text-white mt-2 drop-shadow-xl">
            Managing today ?
          </h1>
          <p className="text-white font-bold text-sm mt-4 tracking-widest uppercase flex items-center gap-2 drop-shadow-md">
            Explore your hub <span className="tracking-tighter">----&gt;</span>
          </p>
        </div>

        {/* 🌟 THE COMPACT HORIZONTAL WIDGET */}
        <div className="w-full animate-in slide-in-from-bottom-10 duration-700 delay-200">
          
          {/* TABS */}
          <div className="flex gap-2 px-2">
            {isOps && (
              <button onClick={() => setActiveTab('operations')} className={`px-6 md:px-8 py-3.5 rounded-t-2xl font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'operations' ? 'bg-[#fffafaf] text-slate-800' : 'bg-white/20 text-white backdrop-blur-md hover:bg-white/30'}`}>
                <Compass size={16} className={activeTab === 'operations' ? 'text-slate-500' : ''}/> Operations
              </button>
            )}
            {isFinance && (
              <button onClick={() => setActiveTab('finance')} className={`px-6 md:px-8 py-3.5 rounded-t-2xl font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'finance' ? 'bg-[#fcfdfd] text-slate-800' : 'bg-white/20 text-white backdrop-blur-md hover:bg-white/30'}`}>
                <Wallet size={16} className={activeTab === 'finance' ? 'text-slate-500' : ''}/> Finance
              </button>
            )}
            <button onClick={() => setActiveTab('clients')} className={`px-6 md:px-8 py-3.5 rounded-t-2xl font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'clients' ? 'bg-[#fcfdfd] text-slate-800' : 'bg-white/20 text-white backdrop-blur-md hover:bg-white/30'}`}>
              <Users size={16} className={activeTab === 'clients' ? 'text-slate-500' : ''}/> Client Hub
            </button>
          </div>

          {/* WIDGET BODY (Slim & Horizontal) */}
          <div className="bg-[#fcfdfd] rounded-b-[2rem] rounded-tr-[2rem] shadow-2xl px-6 py-8 md:px-10 relative flex flex-col">
            
            {/* Top Filter Row (Inside the white box) */}
            <div className="flex gap-8 mb-6 pb-4 border-b border-slate-200">
              <span className="text-slate-800 font-bold text-sm cursor-pointer flex items-center gap-1 hover:text-blue-600">Main Dashboard <ChevronDown size={14} className="text-slate-400"/></span>
              <span className="text-slate-800 font-bold text-sm cursor-pointer flex items-center gap-1 hover:text-blue-600">Quick Actions <ChevronDown size={14} className="text-slate-400"/></span>
              <span className="text-slate-800 font-bold text-sm cursor-pointer flex items-center gap-1 hover:text-blue-600">System Logs <ChevronDown size={14} className="text-slate-400"/></span>
            </div>

            {/* Main Horizontal Input Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center w-full md:pr-40">
              
              {/* Block 1: From */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current</p>
                <h3 className="text-xl font-black text-slate-900">Lounge</h3>
                <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">HQ Gateway</p>
              </div>

              {/* Swap Icon */}
              <div className="hidden md:flex justify-center">
                <ArrowRightLeft className="text-slate-300" size={20}/>
              </div>

              {/* Block 2: To (Dynamic based on tab) */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target</p>
                <h3 className="text-xl font-black text-slate-900">{tabData[activeTab as keyof typeof tabData].title}</h3>
                <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">{tabData[activeTab as keyof typeof tabData].action}</p>
              </div>

              {/* Block 3: Date & Time */}
              <div className="flex items-center gap-8 md:border-l border-slate-200 md:pl-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                    <Calendar size={10}/> Date
                  </p>
                  <h3 className="text-base font-black text-slate-900 whitespace-nowrap">
                    {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {currentTime.toLocaleDateString('en-US', { weekday: 'short' })}
                  </h3>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                    <Clock size={10}/> Time
                  </p>
                  <h3 className="text-base font-black text-slate-900 whitespace-nowrap">
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </h3>
                </div>
              </div>

            </div>

            {/* 🌟 OFFSET LAUNCH BUTTON */}
            <button 
              onClick={() => {
                if (activeTab === 'operations') navigate('/tour-operations');
                if (activeTab === 'finance') navigate('/finance-ledger');
                if (activeTab === 'clients') navigate('/clienthub');
              }}
              className="mt-6 md:mt-0 md:absolute -bottom-5 right-8 text-white px-10 py-4 rounded-2xl font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-transform"
              style={{ backgroundColor: WIDGET_BLUE }}
            >
              Launch Module
            </button>

          </div>
        </div>

      </div>
    </div>
  );
};

// Quick helper for the ChevronDown icon so we don't have to import it separately at the top if we don't want to
const ChevronDown = ({ size, className }: { size: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
);

export default Lounge;