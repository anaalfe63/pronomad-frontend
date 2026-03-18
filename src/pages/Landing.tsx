import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { 
  Power, Sun, Moon, Volume2, Volume1, VolumeX, Navigation, Users, 
  LayoutDashboard, CloudSun, CloudRain, CloudSnow, CloudFog, Cloud, SunMedium,
  Bus, ArrowRight, CheckCircle2, RefreshCw, ClipboardCheck, Phone, 
  ShieldAlert, Receipt, MessageSquare, Info, User, CheckSquare
} from 'lucide-react';

const Landing: React.FC = () => {
  const { user, logout } = useTenant();
  const navigate = useNavigate();
  const APP_COLOR = user?.themeColor || '#0d9488'; 

  const [nextTrip, setNextTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- HARDWARE & THEME STATES ---
  const [isStandby, setIsStandby] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(2); 

  // --- LIVE WEATHER STATE ---
  const [weather, setWeather] = useState({ temp: 32, condition: 'Sunny', icon: <SunMedium size={48} strokeWidth={1.5} /> });

  // --- STRICT ROLE CHECKS ---
  const isCEO = user?.role === 'CEO' || user?.role === 'PROADMIN' || user?.role === 'Operations' || user?.role === 'Finance';
  const isGuide = user?.role === 'Guide';
  const isDriver = user?.role === 'Driver';

  let primaryActionLabel = 'Launch Dashboard';
  let primaryActionRoute = '/';

  if (isDriver) {
      primaryActionLabel = 'Launch Cockpit';
      primaryActionRoute = '/driver-cockpit';
  } else if (isGuide) {
      primaryActionLabel = 'Launch Manifest';
      primaryActionRoute = '/manifest';
  }

  // 🌟 Extract User's First Name
  const firstName = user?.fullName?.split(' ')[0] || 'Team';

  // 1. Clock Timer
  useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(timer);
  }, []);

  // 2. Fetch Live Weather Data (Open-Meteo API - No Auth Required)
  useEffect(() => {
      const fetchWeather = async () => {
          try {
              // Defaulting to Accra, Ghana coordinates. Can be made dynamic via geolocation.
              const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=5.6037&longitude=-0.1870&current_weather=true');
              const data = await res.json();
              
              if (data && data.current_weather) {
                  const temp = Math.round(data.current_weather.temperature);
                  const code = data.current_weather.weathercode;
                  
                  let condition = 'Clear';
                  let icon = <SunMedium size={48} strokeWidth={1.5} />;
                  
                  if (code >= 1 && code <= 3) { condition = 'Partly Cloudy'; icon = <CloudSun size={48} strokeWidth={1.5} />; }
                  else if (code >= 45 && code <= 48) { condition = 'Foggy'; icon = <CloudFog size={48} strokeWidth={1.5} />; }
                  else if (code >= 51 && code <= 67) { condition = 'Rainy'; icon = <CloudRain size={48} strokeWidth={1.5} />; }
                  else if (code >= 71 && code <= 77) { condition = 'Snow'; icon = <CloudSnow size={48} strokeWidth={1.5} />; }
                  else if (code >= 95) { condition = 'Storm'; icon = <CloudRain size={48} strokeWidth={1.5} className="text-red-400"/>; }

                  setWeather({ temp, condition, icon });
              }
          } catch (e) { console.error("Weather fetch failed, using fallback."); }
      };
      fetchWeather();
  }, []);

  // 3. Fetch Trip Assignment
  useEffect(() => {
    const fetchAssignment = async () => {
      if (!user?.subscriberId || !user?.fullName) return;
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*, passengers(id)')
          .eq('subscriber_id', user.subscriberId)
          .neq('status', 'Completed')
          .order('start_date', { ascending: true });

        if (data && !error && data.length > 0) {
            if (isCEO) {
                setNextTrip(data[0]);
            } else {
                const myTrip = data.find(t => 
                    t.logistics?.driver === user.fullName || 
                    t.logistics?.guide === user.fullName
                );
                if (myTrip) setNextTrip(myTrip);
            }
        }
      } catch (err) {
        console.error("No upcoming trips found.");
      } finally {
        setLoading(false);
      }
    };
    fetchAssignment();
  }, [user, isCEO]);

  // --- BUTTON HANDLERS ---
  const handleVolumeChange = () => setVolumeLevel((prev) => (prev + 1) % 3);

  const triggerSOS = async () => {
      if (!window.confirm("🚨 TRIGGER EMERGENCY ALERT? This will immediately notify Operations HQ.")) return;
      try {
          await supabase.from('notifications').insert([{ 
              subscriber_id: user?.subscriberId, type: 'Emergency', title: '🔴 SOS: FIELD EMERGENCY', 
              message: `${user?.fullName} triggered an SOS from the Pre-Flight Portal.`, is_read: false 
          }]);
          alert("SOS Broadcast Sent. Help is on the way.");
      } catch (e) { alert("SOS Failed. Please call Base directly."); }
  };

  const handleQuickAction = (action: string) => {
      // Passes state to the child app so it can potentially open modals automatically
      navigate(primaryActionRoute, { state: { quickAction: action } });
  };

  // ==========================================
  // 🛑 STANDBY MODE (Black Screen)
  // ==========================================
  if (isStandby) {
      return (
          <div className="h-screen w-full bg-black flex flex-col items-center justify-center cursor-pointer animate-in fade-in duration-500" onClick={() => setIsStandby(false)}>
              <Power size={48} className="text-slate-800 animate-pulse mb-6" />
              <p className="text-slate-600 font-bold tracking-widest uppercase text-sm">Tap screen to wake</p>
          </div>
      );
  }

  // Dynamic Theme Classes
  const textMain = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-300' : 'text-slate-700';
  const cardBg = isDarkMode ? 'bg-slate-800/80 border-slate-700/50' : 'bg-white/95 border-white/50';
  const glassEffect = 'backdrop-blur-2xl shadow-2xl border transition-colors duration-700';

  // Partner Logic
  const partnerRole = isDriver ? 'Assigned Guide' : 'Assigned Driver';
  const partnerName = isDriver ? nextTrip?.logistics?.guide : nextTrip?.logistics?.driver;

  return (
    <div className={`h-screen w-full flex flex-col md:flex-row overflow-hidden relative font-sans transition-colors duration-700 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      
      {/* 🌎 ATMOSPHERIC CLOUD & GRAIN BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className={`absolute inset-0 transition-opacity duration-1000 ${isDarkMode ? 'opacity-80' : 'opacity-100'}`}>
              <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(56,189,248,0.15)_0,transparent_50%)]"></div>
              <div className="absolute inset-0 bg-[radial-gradient(at_100%_100%,rgba(168,85,247,0.15)_0,transparent_50%)]"></div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[100px] opacity-[0.08]" style={{ backgroundColor: APP_COLOR }}></div>
          </div>
          <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxmaWx0ZXIgaWQ9Im5vaXNlRmlsdGVyIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC45IiBnum1PY3RhdmVzPSIxIiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI25vaXNlRmlsdGVyKSIvPjwvc3ZnPg==')]"></div>
          <img 
              src="/l-bg.jpg" 
              alt="Background" 
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${isDarkMode ? 'brightness-[0.45] contrast-[1.05]' : 'brightness-[1.08] contrast-[0.98]'}`}
          />
          <div className={`absolute inset-0 transition-colors duration-1000 ${isDarkMode ? 'bg-slate-950/40' : 'bg-blue-900/[0.03]'}`}></div>
      </div>

      {/* 🧭 LEFT NAVIGATION */}
      <nav className={`md:h-full w-full md:w-24 shadow-[10px_0_30px_rgb(0,0,0,0.05)] flex md:flex-col items-center justify-between md:py-10 px-6 md:px-0 z-20 relative border-b md:border-b-0 md:border-r transition-colors duration-700 md:rounded-r-[3rem] ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-white/50'}`}>
        <div className={`hidden md:flex w-12 h-12 rounded-full border-2 shadow-sm items-center justify-center font-black text-xl transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-gradient-to-tr from-slate-200 to-slate-100 border-white text-slate-400'}`}>
            {user?.fullName?.[0] || 'W'}
        </div>

        <div className="flex md:flex-col w-full md:w-auto justify-around md:justify-center gap-2 md:gap-8 py-4 md:py-0">
            {(isDriver || isCEO) && (
              <button onClick={() => navigate('/driver-cockpit')} className={`relative flex items-center justify-center w-12 h-12 transition-colors group ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
                  <Navigation size={26} />
                  <span className="absolute hidden md:block left-14 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Cockpit</span>
              </button>
            )}

            {(isGuide || isCEO) && (
              <button onClick={() => navigate('/manifest')} className={`relative flex items-center justify-center w-12 h-12 transition-colors group ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
                  <Users size={26} />
                  <span className="absolute hidden md:block left-14 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Manifest</span>
              </button>
            )}

            {/* 🌟 NEW: Unified Mobile Field App Button for Guides/Drivers */}
            {(isGuide || isDriver || isCEO) && (
              <button onClick={() => navigate('/field-app')} className={`relative flex items-center justify-center w-12 h-12 transition-colors group ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
                  <ClipboardCheck size={26} />
                  <span className="absolute hidden md:block left-14 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Field App</span>
              </button>
            )}

            {isCEO && (
                <button onClick={() => navigate('/')} className={`relative flex items-center justify-center w-12 h-12 transition-colors group mt-0 md:mt-4 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
                    <LayoutDashboard size={26} />
                    <span className="absolute hidden md:block left-14 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Dashboard</span>
                </button>
            )}
        </div>

        <button onClick={logout} className="hidden md:flex w-12 h-12 items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
            <Power size={24} />
        </button>
      </nav>

      {/* 🌤 MAIN CONTENT AREA */}
      <div className="flex-1 h-full flex flex-col p-6 md:p-10 z-10 overflow-y-auto">
        
        {/* 🎛️ HARDWARE CONTROL BAR */}
        <header className="flex justify-between items-center w-full mb-8 md:mb-12">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsStandby(true)} className={`transition-colors active:scale-90 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}><Power size={22} /></button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`transition-colors active:scale-90 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>{isDarkMode ? <Sun size={22} /> : <Moon size={22} />}</button>
            <button onClick={handleVolumeChange} className={`transition-colors active:scale-90 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                {volumeLevel === 0 && <VolumeX size={22} className="text-red-400" />}
                {volumeLevel === 1 && <Volume1 size={22} />}
                {volumeLevel === 2 && <Volume2 size={22} />}
            </button>
          </div>
          
          <div className={`px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest shadow-sm ml-auto transition-colors border flex items-center gap-2 ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-white/40 border-white/50 text-slate-800'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> On Duty
          </div>
        </header>

        {/* HERO CONTENT & WIDGETS GRID */}
        <div className="flex-1 flex flex-col lg:flex-row items-start justify-between gap-12 lg:px-10">
          
          {/* LEFT: Welcome & Briefing */}
          <div className="max-w-xl w-full text-center lg:text-left z-10 flex flex-col h-full">
             <div className="mb-10">
                 <h1 className={`text-5xl lg:text-[5.5rem] font-extrabold leading-[1.05] tracking-tight transition-colors ${textMain}`}>
                    Welcome, <br/> <span style={{ color: APP_COLOR }}>{firstName}</span>
                 </h1>
                 <p className={`font-medium text-lg lg:text-xl mt-6 transition-colors ${textSub}`}>
                    {nextTrip ? `Your next tour begins on ${new Date(nextTrip.start_date).toLocaleDateString()}` : 'You are currently on standby for dispatch.'}
                 </p>
             </div>

             {/* HQ Operations Briefing Widget */}
             <div className={`mt-auto ${glassEffect} ${cardBg} p-6 rounded-[2rem] w-full max-w-sm text-left`}>
                 <div className="flex items-center gap-2 mb-3">
                     <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Info size={18}/></div>
                     <h3 className={`font-black uppercase tracking-widest text-xs ${textMain}`}>HQ Briefing</h3>
                 </div>
                 <p className={`text-sm font-medium leading-relaxed ${textSub}`}>
                     Ensure all pre-trip vehicle checks are completed before departure. Check manifest for specific dietary requirements. Drive safe!
                 </p>
             </div>
          </div>

          {/* RIGHT: The Floating Widgets */}
          <div className="w-full max-w-md space-y-6 z-10">
             
             {/* 1. THE TRIP TRACKER CARD */}
             <div className={`${glassEffect} ${cardBg} ${textMain} p-8 rounded-[2rem]`}>
                {loading ? (
                    <div className="h-32 flex items-center justify-center"><RefreshCw className="animate-spin text-slate-400" size={32}/></div>
                ) : nextTrip ? (
                    <>
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Departure</p>
                                <h3 className="text-2xl font-black truncate max-w-[120px]">{nextTrip.logistics?.pickup || 'BASE'}</h3>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Status</p>
                                <h3 className="text-2xl font-black text-emerald-500 uppercase">{nextTrip.status}</h3>
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

                        <div className="flex justify-between items-center text-sm font-bold mb-6">
                            <span>{new Date(nextTrip.start_date).toLocaleDateString()}</span>
                            <span className="truncate max-w-[150px] text-right">{nextTrip.title}</span>
                        </div>

                        {/* Partner & Insights Block */}
                        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'} flex items-center justify-between mb-8`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-500 shadow-sm'}`}>
                                    <User size={18}/>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{partnerRole}</p>
                                    <p className={`text-sm font-bold ${textMain}`}>{partnerName || 'Unassigned'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{isDriver ? 'Unit' : 'Manifest'}</p>
                                <p className={`text-sm font-bold ${textMain}`}>{isDriver ? (nextTrip.logistics?.vehicleDetail || 'TBA') : `${nextTrip.passengers?.length || 0} PAX`}</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => navigate(primaryActionRoute)} 
                            className="w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-transform active:scale-95 text-white shadow-xl"
                            style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}
                        >
                            {primaryActionLabel} <ArrowRight size={18}/>
                        </button>
                    </>
                ) : (
                    <div className="text-center py-8">
                        <CheckCircle2 size={48} className="text-slate-400 mx-auto mb-4" />
                        <h3 className="text-xl font-black">All Clear</h3>
                        <p className="text-slate-400 text-sm mt-2 font-medium">No pending assignments. Enjoy your downtime!</p>
                        
                        {isCEO && (
                            <button onClick={() => navigate('/')} className={`w-full mt-6 py-3 rounded-xl font-bold transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                                Return to Dashboard
                            </button>
                        )}
                    </div>
                )}
             </div>

             {/* 2. THE BOTTOM WIDGETS ROW (LIVE WEATHER + TIME) */}
             <div className="grid grid-cols-2 gap-6">
                <div className={`${glassEffect} ${cardBg} ${textMain} p-6 rounded-[2rem] flex items-center justify-between`}>
                    <div>
                        <h2 className="text-4xl font-black">{weather.temp}°</h2>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{weather.condition}</p>
                    </div>
                    <div className="text-amber-400">{weather.icon}</div>
                </div>

                <div className={`${glassEffect} ${cardBg} ${textMain} p-6 rounded-[2rem] flex flex-col justify-center`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Local Time</p>
                    <h2 className="text-2xl font-black">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </h2>
                </div>
             </div>

             {/* 3. QUICK ACTION GRID */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                 <button onClick={() => window.location.href = 'tel:+233244000000'} className={`${glassEffect} ${cardBg} p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:brightness-110 active:scale-95 group`}>
                     <Phone size={20} className={`${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} group-hover:scale-110 transition-transform`}/>
                     <span className={`text-[9px] font-black uppercase tracking-widest ${textSub}`}>Call HQ</span>
                 </button>
                 <button onClick={() => handleQuickAction('expense')} className={`${glassEffect} ${cardBg} p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:brightness-110 active:scale-95 group`}>
                     <Receipt size={20} className={`${isDarkMode ? 'text-orange-400' : 'text-orange-500'} group-hover:scale-110 transition-transform`}/>
                     <span className={`text-[9px] font-black uppercase tracking-widest ${textSub}`}>Expense</span>
                 </button>
                 
                 {/* 🌟 Role-Specific Action */}
                 {isDriver ? (
                     <button onClick={() => handleQuickAction('checklist')} className={`${glassEffect} ${cardBg} p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:brightness-110 active:scale-95 group`}>
                         <CheckSquare size={20} className={`${isDarkMode ? 'text-blue-400' : 'text-blue-500'} group-hover:scale-110 transition-transform`}/>
                         <span className={`text-[9px] font-black uppercase tracking-widest ${textSub}`}>Pre-Check</span>
                     </button>
                 ) : (
                     <button onClick={() => handleQuickAction('chat')} className={`${glassEffect} ${cardBg} p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:brightness-110 active:scale-95 group`}>
                         <MessageSquare size={20} className={`${isDarkMode ? 'text-blue-400' : 'text-blue-500'} group-hover:scale-110 transition-transform`}/>
                         <span className={`text-[9px] font-black uppercase tracking-widest ${textSub}`}>Chat</span>
                     </button>
                 )}

                 <button onClick={triggerSOS} className={`${glassEffect} ${cardBg} p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-red-500/10 hover:border-red-500/30 active:scale-95 group`}>
                     <ShieldAlert size={20} className="text-red-500 group-hover:scale-110 transition-transform"/>
                     <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>S.O.S</span>
                 </button>
             </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;