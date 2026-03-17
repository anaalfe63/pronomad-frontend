import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { 
  Power, Sun, Moon, Volume2, Volume1, VolumeX, Navigation, Users, 
  Receipt, LayoutDashboard, CloudSun, Bus, ArrowRight, 
  CheckCircle2, RefreshCw, ClipboardCheck
} from 'lucide-react';

const Landing: React.FC = () => {
  const { user, logout } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const APP_COLOR = user?.themeColor || '#ef4444'; 

  const [nextTrip, setNextTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- HARDWARE CONTROL STATES ---
  const [isStandby, setIsStandby] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(2); // 0 = Muted, 1 = Low, 2 = High

  // Clock Timer
  useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(timer);
  }, []);

  // Fetch Assignment
  useEffect(() => {
    const fetchAssignment = async () => {
      if (!user?.subscriberId || !user?.fullName) return;
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('subscriber_id', user.subscriberId)
          .neq('status', 'Completed')
          .contains('logistics', { driver: user.fullName }) 
          .order('start_date', { ascending: true })
          .limit(1)
          .single();

        if (data && !error) setNextTrip(data);
      } catch (err) {
        console.error("No upcoming trips found.");
      } finally {
        setLoading(false);
      }
    };
    fetchAssignment();
  }, [user]);

  const isCEO = user?.role === 'CEO' || user?.role === 'PROADMIN' || user?.role === 'Operations';

  const handleVolumeChange = () => {
      setVolumeLevel((prev) => (prev + 1) % 3);
  };

  // ==========================================
  // 🛑 STANDBY MODE (Black Screen)
  // ==========================================
  if (isStandby) {
      return (
          <div 
            className="h-screen w-full bg-black flex flex-col items-center justify-center cursor-pointer animate-in fade-in duration-500"
            onClick={() => setIsStandby(false)}
          >
              <Power size={48} className="text-slate-800 animate-pulse mb-6" />
              <p className="text-slate-600 font-bold tracking-widest uppercase text-sm">Tap screen to wake</p>
          </div>
      );
  }

  // Dynamic Theme Classes
  const themeBg = isDarkMode ? 'from-slate-900 via-slate-800 to-black' : 'from-blue-400 via-sky-200 to-white';
  const textMain = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-300' : 'text-slate-700';
  const cardBg = isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/95 border-white/50';

  return (
    <div className={`h-screen w-full bg-gradient-to-br ${themeBg} flex flex-col md:flex-row overflow-hidden relative font-sans transition-colors duration-700`}>
      
      {/* --- BACKGROUND DECORATIONS & AIRPLANE --- */}
      <div className="absolute top-[-0%] left-[-10%] w-[0%] h-[00%] bg-white/40 blur-[100px] rounded-full mix-blend-overlay pointer-events-none z-0"></div>
      
     {/* 🌍 FULL SCREEN BACKGROUND IMAGE */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img 
              src="/l-bg.jpg" 
              alt="Background" 
              className={`w-full h-full object-cover transition-all duration-1000 ${isDarkMode ? 'brightness-50' : 'brightness-105'}`}
          />
          {/* Subtle overlay to ensure your white glassmorphism cards and text are always easy to read! */}
          <div className={`absolute inset-0 transition-colors duration-1000 ${isDarkMode ? 'bg-slate-900/60' : 'bg-blue-900/10'}`}></div>
      </div>

      {/* ========================================== */}
      {/* 🧭 LEFT NAVIGATION (The Curved Menu)       */}
      {/* ========================================== */}
      <nav className={`md:h-full w-full md:w-24 shadow-[10px_0_30px_rgb(0,0,0,0.05)] flex md:flex-col items-center justify-between md:py-10 px-6 md:px-0 z-20 relative border-b md:border-b-0 md:border-r transition-colors duration-700 md:rounded-r-[3rem] ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-white/50'}`}>
        
        {/* Top: Profile Avatar */}
        <div className={`hidden md:flex w-12 h-12 rounded-full border-2 shadow-sm items-center justify-center font-black text-xl transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-gradient-to-tr from-slate-200 to-slate-100 border-white text-slate-400'}`}>
            {user?.fullName?.[0] || 'W'}
        </div>

        {/* Center: The App Links */}
        <div className="flex md:flex-col w-full md:w-auto justify-around md:justify-center gap-2 md:gap-8 py-4 md:py-0">
            <button onClick={() => navigate('/driver-cockpit')} className={`relative flex items-center justify-center w-12 h-12 transition-colors group ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
                <Navigation size={26} />
                <span className="absolute hidden md:block left-14 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Cockpit</span>
            </button>

            <button onClick={() => navigate('/manifest')} className={`relative flex items-center justify-center w-12 h-12 transition-colors group ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
                <Users size={26} />
                <span className="absolute hidden md:block left-14 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Manifest</span>
            </button>

            <button onClick={() => navigate('/field-app')} className={`relative flex items-center justify-center w-12 h-12 transition-colors group ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
                <ClipboardCheck size={26} />
                <span className="absolute hidden md:block left-14 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Field Tasks</span>
            </button>

            {isCEO && (
                <button onClick={() => navigate('/')} className={`relative flex items-center justify-center w-12 h-12 transition-colors group mt-0 md:mt-4 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
                    <LayoutDashboard size={26} />
                    <span className="absolute hidden md:block left-14 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">CEO Dashboard</span>
                </button>
            )}
        </div>

        {/* Bottom: Logout */}
        <button onClick={logout} className="hidden md:flex w-12 h-12 items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
            <Power size={24} />
        </button>
      </nav>

      {/* ========================================== */}
      {/* 🌤 MAIN CONTENT AREA                       */}
      {/* ========================================== */}
      <div className="flex-1 h-full flex flex-col p-6 md:p-10 z-10 overflow-y-auto">
        
        {/* 🎛️ HARDWARE CONTROL BAR */}
        <header className="flex justify-between items-center w-full mb-8 md:mb-12">
          
          <div className="flex items-center gap-6">
            {/* Standby Button */}
            <button onClick={() => setIsStandby(true)} className={`transition-colors active:scale-90 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                <Power size={22} />
            </button>
            
            {/* Theme Toggle Button */}
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`transition-colors active:scale-90 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
            </button>
            
            {/* Volume Control Button */}
            <button onClick={handleVolumeChange} className={`transition-colors active:scale-90 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                {volumeLevel === 0 && <VolumeX size={22} className="text-red-400" />}
                {volumeLevel === 1 && <Volume1 size={22} />}
                {volumeLevel === 2 && <Volume2 size={22} />}
            </button>
          </div>
          
          {/* PRONOMAD BRANDING (Non-clickable) */}
          <div className={`px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest shadow-sm ml-auto transition-colors border backdrop-blur-md
              ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-white/40 border-white/50 text-slate-800'}`}>
            PRONOMAD
          </div>
        </header>

        {/* HERO CONTENT & WIDGETS GRID */}
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-between gap-12 lg:px-10">
          
          {/* LEFT: The Big Welcome Text */}
          <div className="max-w-lg w-full text-center lg:text-left z-10">
             <h1 className={`text-5xl lg:text-[5.5rem] font-extrabold leading-[1.05] tracking-tight transition-colors ${textMain}`}>
                Welcome <br/> on board
             </h1>
             <p className={`font-medium text-lg lg:text-xl mt-6 transition-colors ${textSub}`}>
                {nextTrip ? `Your next tour begins on ${new Date(nextTrip.start_date).toLocaleDateString()}` : 'You are currently on standby for dispatch.'}
             </p>
          </div>

          {/* RIGHT: The Floating Widgets (Glassmorphism Cards) */}
          <div className="w-full max-w-md space-y-6 z-10">
             
             {/* 1. THE TRIP TRACKER CARD */}
             <div className={`backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl border transition-colors duration-700 ${cardBg} ${textMain}`}>
                {loading ? (
                    <div className="h-32 flex items-center justify-center"><RefreshCw className="animate-spin text-slate-400" size={32}/></div>
                ) : nextTrip ? (
                    <>
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Departure</p>
                                <h3 className="text-2xl font-black">BASE</h3>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Destination</p>
                                <h3 className="text-2xl font-black">TOUR</h3>
                            </div>
                        </div>

                        {/* Progress Line */}
                        <div className="relative flex items-center justify-center py-4 mb-6">
                            <div className={`absolute w-full h-1 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                            <div className="absolute left-0 w-1/2 h-1 rounded-full" style={{ backgroundColor: APP_COLOR }}></div>
                            <div className={`p-2 rounded-full shadow-md z-10 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`} style={{ color: APP_COLOR }}>
                                <Bus size={20} className="animate-pulse" />
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-sm font-bold">
                            <span>08:00 AM</span>
                            <span className="bg-emerald-100/20 text-emerald-500 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest">Scheduled</span>
                            <span>Pending</span>
                        </div>

                        <button onClick={() => navigate('/driver-cockpit')} className={`w-full mt-8 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-colors ${isDarkMode ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                            Launch Cockpit <ArrowRight size={18}/>
                        </button>
                    </>
                ) : (
                    <div className="text-center py-8">
                        <CheckCircle2 size={48} className="text-slate-400 mx-auto mb-4" />
                        <h3 className="text-xl font-black">All Clear</h3>
                        <p className="text-slate-400 text-sm mt-2 font-medium">No pending assignments. Enjoy your downtime!</p>
                    </div>
                )}
             </div>

             {/* 2. THE BOTTOM WIDGETS ROW */}
             <div className="grid grid-cols-2 gap-6">
                {/* Weather Widget */}
                <div className={`backdrop-blur-2xl p-6 rounded-[2rem] shadow-xl border flex items-center justify-between transition-colors duration-700 ${cardBg} ${textMain}`}>
                    <div>
                        <h2 className="text-4xl font-black">32°</h2>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Accra</p>
                    </div>
                    <div className="text-amber-400"><CloudSun size={48} strokeWidth={1.5} /></div>
                </div>

                {/* Clock Widget */}
                <div className={`backdrop-blur-2xl p-6 rounded-[2rem] shadow-xl border flex flex-col justify-center transition-colors duration-700 ${cardBg} ${textMain}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Local Time</p>
                    <h2 className="text-2xl font-black">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </h2>
                </div>
             </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default Landing;