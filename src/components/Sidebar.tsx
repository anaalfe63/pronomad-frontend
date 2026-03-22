import React, { useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext'; 
import NotificationBell from './NotificationBell'; 
import { supabase } from '../lib/supabase';  
import { 
  LayoutDashboard, Map, Wallet, Compass, Key, Users, Lock, Target,
  CreditCard, LogOut, BookOpen, Truck, Briefcase, Building2,  
  ShieldCheck, Settings, FileText, MessageSquare, Sparkles, Receipt,
  PiggyBank, Route, TrendingUp, Headphones, Bus, X, ShieldAlert, 
  MessageCircle, Car, Wrench, Banknote, FileClock, Globe, UserCircle, Smartphone
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { user, settings, logout } = useTenant(); 
  const navigate = useNavigate();
  const location = useLocation();

  // 🌟 Premium Rich Blue Fallback Color
  const APP_COLOR = settings?.theme_color || '#0f2d6e'; 
  const isLocked = user?.isExpired;

  // Check if we are on the Lounge page to trigger the full-bleed layout
  const isLounge = location.pathname === '/lounge' || location.pathname === '/';

  // --- SUPPORT DESK ---
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!user) return null;

  // --- 🛡️ ROLE DEFINITIONS ---
  const safeRole = (user?.role || '').toLowerCase().trim();
  const isGodMode = safeRole === 'proadmin';
  const hasFullAccess = isGodMode || safeRole === 'ceo' || safeRole === 'admin' || safeRole === 'owner';
  const isCEO = hasFullAccess; // 🌟 Alias for strict CEO checks
  const isOps = safeRole.includes('operations') || safeRole.includes('ops');
  const isFinance = safeRole.includes('finance') || safeRole.includes('accountant');
  const isDriver = safeRole.includes('driver');
  const isGuide = safeRole.includes('guide');

  // 🌟 Master trigger to hide the global sidebar
  const hideSidebarUI = isDriver || isGuide || location.pathname === '/landing';

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) return;
    setIsSending(true);
    try {
      await supabase.from('support_tickets').insert([{
        subscriber_id: user?.subscriberId, 
        sender_name: user?.fullName || user?.username,
        message: feedbackText,
        status: 'Open'
      }]);
      setFeedbackText('');
      setIsSupportOpen(false);
      alert("Message sent to Pro-Central!");
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };

  return (
    <div className="relative flex h-screen w-full overflow-hidden font-sans">
      
      {/* 🌟 PREMIUM GRADIENT & GRAIN BACKGROUND (Hidden on Lounge & Full-Screen Apps) */}
      {!isLounge && !hideSidebarUI && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-400 via-slate-50 to-white z-0"></div>
          <div 
            className="absolute inset-0 opacity-[0.04] mix-blend-multiply z-0 pointer-events-none" 
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
          ></div>
        </>
      )}

      {/* FOREGROUND CONTENT CONTAINER */}
      <div className="relative z-10 flex w-full h-full">
        
        {/* 🌟 PREMIUM DARK PILL SIDEBAR (Hidden for Drivers/Guides/Landing) */}
        {!hideSidebarUI && (
          <div className="fixed bottom-0 left-0 w-full z-[100] p-4 md:static md:h-screen md:w-auto md:py-6 md:pl-6 md:pr-2 flex flex-col justify-end md:justify-center bg-transparent pointer-events-none md:pointer-events-auto">
            
            <div className="bg-slate-950 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/5 flex flex-row justify-between items-center px-4 py-3 rounded-[2rem] md:flex-col md:w-[5.5rem] md:h-auto md:py-8 md:rounded-[2.5rem] md:justify-start md:gap-8 pointer-events-auto mx-auto w-full md:max-w-none">
              
              <div 
                className="hidden md:flex w-12 h-12 rounded-[1.2rem] items-center justify-center text-white font-black text-xl shrink-0 transition-all hover:scale-105 cursor-pointer"
                style={{ backgroundColor: isLocked ? '#ef4444' : APP_COLOR, boxShadow: isLocked ? '0 8px 20px -4px rgba(239, 68, 68, 0.4)' : `0 8px 20px -4px ${APP_COLOR}60` }}
                onClick={() => !isLocked && navigate('/')}
              >
                {isLocked ? <Lock size={20} strokeWidth={3}/> : (settings?.company_name ? settings.company_name.charAt(0).toUpperCase() : 'P')}
              </div>

              <nav className="flex flex-row justify-between w-full md:flex-col md:space-y-4 md:justify-start relative">
                <NavItem to={hasFullAccess ? '/dashboard' : (isOps || isFinance) ? '/lounge' : '/landing'} icon={<LayoutDashboard size={22} />} label="Home" activeColor={APP_COLOR} disabled={isLocked} />
                
                {(isDriver || isGuide ) && (
                  <NavDropdown to="/field-hub" icon={<Compass size={22} />} label="Field" activeColor={APP_COLOR} disabled={isLocked} isHighlighted={location.pathname.includes('cockpit') || location.pathname.includes('guide') || location.pathname.includes('mobile-field')}>
                    {({ close }) => (
                      <>
                        {isDriver && <DropdownItem to="/driver-cockpit" icon={<Compass size={18} />} label="Driver Cockpit" onClick={close} activeColor={APP_COLOR} />}
                        {isGuide && <DropdownItem to="/guide-app" icon={<Bus size={18} />} label="Guide App" onClick={close} activeColor={APP_COLOR} />}
                        {(isDriver || isGuide || isOps) && <DropdownItem to="/mobile-field" icon={<Smartphone size={18} />} label="Mobile Field App" onClick={close} activeColor={APP_COLOR} />}
                        {(isDriver || isGuide) && <DropdownItem to="/clientpassport" icon={<Globe size={18} />} label="Client Passport" onClick={close} activeColor={APP_COLOR} />}
                      </>
                    )}
                  </NavDropdown>
                )}

                {(hasFullAccess || isOps) && (
                  <NavDropdown to="/ops-hub" icon={<Truck size={22} />} label="Ops" activeColor={APP_COLOR} disabled={isLocked} isHighlighted={location.pathname.includes('ops') || location.pathname.includes('fleet') || location.pathname.includes('booking')}>
                    {({ close }) => (
                      <>
                        <DropdownItem to="/booking-engine" icon={<BookOpen size={18} />} label="Booking Engine" onClick={close} activeColor={APP_COLOR} />
                        <DropdownItem to="/tour-operations" icon={<Map size={18} />} label="Trips" onClick={close} activeColor={APP_COLOR} />
                        <DropdownItem to="/clienthub" icon={<Car size={18} />} label="ClientHub" onClick={close} activeColor={APP_COLOR} />
                        <DropdownItem to="/live-fleet" icon={<Car size={18} />} label="Live Fleet" onClick={close} activeColor={APP_COLOR} />
                        <DropdownItem to="/supplier-portal" icon={<Building2 size={18} />} label="Supplier Portal" onClick={close} activeColor={APP_COLOR} />
                      </>
                    )}
                  </NavDropdown>
                )}

                {(hasFullAccess || isFinance) && (
                  <NavDropdown to="/finance-hub" icon={<Wallet size={22} />} label="Finance" activeColor={APP_COLOR} disabled={isLocked} isHighlighted={location.pathname.includes('finance') || location.pathname.includes('invoice') || location.pathname.includes('expense') || location.pathname.includes('payroll')}>
                    {({ close }) => (
                      <>
                        <DropdownItem to="/expenses" icon={<Receipt size={18} />} label="Expenses" onClick={close} activeColor={APP_COLOR} />
                        <DropdownItem to="/invoices" icon={<FileText size={18} />} label="Invoices" onClick={close} activeColor={APP_COLOR} />
                        <DropdownItem to="/payroll" icon={<Banknote size={18} />} label="Payroll" onClick={close} activeColor={APP_COLOR} />
                        <DropdownItem to="/finance-ledger" icon={<Wallet size={18} />} label="Ledger" onClick={close} activeColor={APP_COLOR} />
                      </>
                    )}
                  </NavDropdown>
                )}

                {(hasFullAccess || isOps || isFinance) && (
                  <NavDropdown to="/ai-hub" icon={<Sparkles size={22} />} label="AI Hub" activeColor={APP_COLOR} disabled={isLocked} isHighlighted={location.pathname.includes('smart') || location.pathname.includes('communication')}>
                    {({ close }) => (
                      <>
                        {(hasFullAccess || isFinance) && <DropdownItem to="/smartsave" icon={<PiggyBank size={18} />} label="Smartsave" onClick={close} activeColor={APP_COLOR} />}
                        {(hasFullAccess || isOps) && <DropdownItem to="/smartroute" icon={<Route size={18} />} label="SmartRoute" onClick={close} activeColor={APP_COLOR} />}
                        {(hasFullAccess || isOps) && <DropdownItem to="/smartmatch" icon={<Target size={18} />} label="SmartMatch" onClick={close} activeColor={APP_COLOR} />}
                        {(hasFullAccess || isOps) && <DropdownItem to="/communications" icon={<MessageSquare size={18} />} label="Communications" onClick={close} activeColor={APP_COLOR} />}
                      </>
                    )}
                  </NavDropdown>
                )}

                {(hasFullAccess || isOps) && (
                  <NavDropdown to="/admin-hub" icon={<ShieldCheck size={22} />} label="Admin" activeColor={APP_COLOR} disabled={isLocked} isHighlighted={location.pathname.includes('staff') || location.pathname.includes('audit-log')}>
                      {({ close }) => (
                        <>
                          <DropdownItem to="/staff-management" icon={<Users size={18} />} label="Staff Management" onClick={close} activeColor={APP_COLOR} />
                          <DropdownItem to="/clienthub" icon={<Car size={18} />} label="ClientHub" onClick={close} activeColor={APP_COLOR} />
                          {hasFullAccess && <DropdownItem to="/audit-log" icon={<FileClock size={18} />} label="Audit Log" onClick={close} activeColor={APP_COLOR} />}
                          {hasFullAccess && <DropdownItem to="/subscription" icon={<CreditCard size={18} />} label="Subscription" onClick={close} activeColor={APP_COLOR} />}
                        </>
                      )}
                  </NavDropdown>
                )}

                {/* 🌟 STRICTLY CEO ONLY: Settings Hub */}
                {isCEO && (
                  <NavDropdown to="/settings-hub" icon={<Settings size={22} />} label="Settings" activeColor={APP_COLOR} disabled={isLocked} isHighlighted={location.pathname.includes('settings') || location.pathname.includes('profile')}>
                      {({ close }) => (
                        <>
                          <DropdownItem to="/profile" icon={<UserCircle size={18} />} label="Profile" onClick={close} activeColor={APP_COLOR} />
                          <DropdownItem to="/settings" icon={<Settings size={18} />} label="System Settings" onClick={close} activeColor={APP_COLOR} />
                        </>
                      )}
                  </NavDropdown>
                )}
                
              </nav>

              <div className="hidden md:flex flex-col items-center mt-4 space-y-6 shrink-0 pt-6 border-t border-white/10 w-full">
                <button onClick={() => setIsSupportOpen(true)} className="text-slate-500 hover:text-white transition-colors"><Headphones size={22} /></button>
                
                {/* 🌟 STRICTLY CEO ONLY: Profile Avatar */}
                {isCEO && (
                  <div 
                    onClick={() => navigate('/profile')}
                    className="w-10 h-10 rounded-[1rem] bg-slate-800 flex items-center justify-center font-black text-sm border border-slate-700 uppercase text-slate-300 shadow-inner cursor-pointer hover:bg-slate-700 transition-colors"
                    title="My Profile"
                  >
                    {user.username?.charAt(0)}
                  </div>
                )}

                <button onClick={logout} className="text-slate-500 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            MAIN PAGE CONTENT (Fills 100% of screen if Sidebar is hidden)
            ========================================================= */}
        <main className={`flex-1 h-screen relative overflow-y-auto ${isLounge || hideSidebarUI ? 'p-0' : 'pb-28 md:pb-8 pt-4 px-4 md:py-8 md:pr-8 md:pl-4'}`}>
          <div className={`mx-auto ${isLounge || hideSidebarUI ? 'w-full h-full max-w-none' : 'max-w-[1600px]'}`}>
            {!isLocked && !isLounge && !hideSidebarUI && <NotificationBell />}

            <div className={isLounge || hideSidebarUI ? 'h-full' : 'mt-2'}>
              {/* THE ACTUAL PAGE RENDERS HERE */}
              <Outlet />
            </div>
          </div>

          {/* 🛡️ SYSTEM LOCK OVERLAY (Kept active to protect the app even without sidebar) */}
          {isLocked && location.pathname !== '/subscription' && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-700"></div>
              
              <div className="relative z-10 bg-white p-10 md:p-14 rounded-[3rem] shadow-2xl max-w-lg w-full text-center border border-slate-100 animate-in zoom-in-95 duration-300">
                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-100 border border-red-100 rotate-3">
                  <ShieldAlert size={48} />
                </div>
                
                <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Access Restricted</h1>
                <p className="text-slate-500 font-medium leading-relaxed text-lg mb-10">
                  Your enterprise operating license has expired. Please renew your subscription to restore access to your fleet and financial data.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <button onClick={() => navigate('/subscription')} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95">
                     <CreditCard size={18}/> Renew Now
                  </button>
                  <a href="https://wa.me/233248518528" target="_blank" rel="noreferrer" className="flex-1 bg-slate-100 text-slate-700 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95">
                     <MessageCircle size={18}/> Support
                  </a>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* SUPPORT MODAL */}
      {isSupportOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSupportOpen(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-slate-900 font-black text-lg flex items-center gap-2"><Headphones size={20} className="text-blue-600"/> Support Desk</h2>
              <button onClick={() => setIsSupportOpen(false)} className="text-slate-400 hover:text-slate-700 bg-white p-1.5 rounded-full border border-slate-200"><X size={18}/></button>
            </div>
            <div className="p-6">
              <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="How can we help?" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-700 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all h-32"></textarea>
              <button onClick={handleSendFeedback} disabled={!feedbackText.trim() || isSending} className="w-full mt-4 bg-blue-600 disabled:bg-slate-300 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-600/20">{isSending ? 'Sending...' : 'Send Message'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- REUSABLE NAV HELPERS --- */
interface NavItemProps { to: string; icon: React.ReactNode; label: string; activeColor: string; disabled?: boolean; }
const NavItem: React.FC<NavItemProps> = ({ to, icon, label, activeColor, disabled }) => (
  <NavLink to={disabled ? '#' : to} onClick={(e) => disabled && e.preventDefault()}
    className={({ isActive }) => `p-3.5 rounded-[1.2rem] transition-all flex flex-col items-center gap-1 w-[3.25rem] ${isActive && !disabled ? 'text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/10'} ${disabled ? 'opacity-20 cursor-not-allowed grayscale' : ''}`}
    style={({ isActive }) => isActive && !disabled ? { backgroundColor: activeColor, boxShadow: `0 8px 20px -4px ${activeColor}60` } : {}}
  >
    {disabled ? <Lock size={20} className="text-red-500"/> : icon}
  </NavLink>
);

interface NavDropdownProps { to: string; icon: React.ReactNode; label: string; children: (props: { close: () => void }) => React.ReactNode; activeColor: string; isHighlighted: boolean; disabled?: boolean; }
const NavDropdown: React.FC<NavDropdownProps> = ({ icon, label, children, activeColor, isHighlighted, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<any>(null);
  
  const handlePointerEnter = (e: React.PointerEvent) => { 
    if (!disabled && e.pointerType === 'mouse') { 
      if (timeoutRef.current) clearTimeout(timeoutRef.current); 
      setIsOpen(true); 
    } 
  };
  
  const handlePointerLeave = (e: React.PointerEvent) => { 
    if (!disabled && e.pointerType === 'mouse') { 
      timeoutRef.current = setTimeout(() => setIsOpen(false), 250); 
    } 
  };
  
  const toggleMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={`relative group ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave}>
      <button onClick={toggleMenu}
        className={`p-3.5 rounded-[1.2rem] transition-all flex flex-col items-center gap-1 w-[3.25rem] ${isOpen ? 'bg-white/10 text-white' : isHighlighted ? 'text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/10'} ${disabled ? '' : ''}`} 
        style={(!isOpen && isHighlighted) ? { backgroundColor: activeColor, boxShadow: `0 8px 20px -4px ${activeColor}60` } : {}}
      >
        {disabled ? <Lock size={20} className="text-red-500"/> : icon}
      </button>
      
      {isOpen && !disabled && (
        <>
          <div className="md:hidden fixed inset-0 z-[190]" onClick={() => setIsOpen(false)}></div>
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[240px] md:absolute md:w-auto md:bottom-auto md:mb-0 md:top-0 md:left-[110%] md:translate-x-0 md:ml-4 bg-white border border-slate-100 p-2.5 rounded-2xl shadow-[0_15px_40px_rgb(0,0,0,0.12)] flex flex-col gap-1 min-w-[220px] z-[200] animate-in fade-in zoom-in-95 duration-200">
            <div className="hidden md:block absolute top-0 -left-6 w-8 h-full bg-transparent"></div>
            <div className="text-[10px] font-black uppercase tracking-widest px-3 py-2 border-b border-slate-100 mb-1 text-slate-400">{label} Hub</div>
            {children({ close: () => setIsOpen(false) })}
          </div>
        </>
      )}
    </div>
  );
};

interface DropdownItemProps { to: string; icon: React.ReactNode; label: string; onClick: () => void; activeColor: string; disabled?: boolean; }
const DropdownItem: React.FC<DropdownItemProps> = ({ to, icon, label, onClick, activeColor, disabled }) => (
  <NavLink to={disabled ? '#' : to} onClick={(e) => { if (disabled) e.preventDefault(); else onClick(); }}
    className={({ isActive }) => `flex items-center gap-3 p-3 rounded-[1rem] text-sm font-bold transition-all ${isActive && !disabled ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'} ${disabled ? 'opacity-20 cursor-not-allowed' : ''}`}
  >
    {disabled ? <Lock size={16} className="text-red-500"/> : icon}
    <span className="tracking-wide">{label}</span>
  </NavLink>
);

export default Sidebar;