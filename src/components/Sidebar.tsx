import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext'; 
import NotificationBell from './NotificationBell'; 
import { supabase } from '../lib/supabase';  
import { 
  LayoutDashboard, Map, Wallet, Compass, Key, Users, Lock, Target,
  CreditCard, LogOut, BookOpen, Truck, Briefcase, ChevronRight, 
  Building2, ShieldCheck, Settings, FileText, MessageSquare,
  Sparkles, PiggyBank, Route, TrendingUp, Search, Bell, X, Headphones, Bus 
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { user, logout } = useTenant(); 
  const navigate = useNavigate();
  const location = useLocation();

  const APP_COLOR = user?.themeColor || '#14b8a6';

  // --- PRO-CENTRAL SUPPORT DESK STATES ---
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // --- NOTIFICATIONS STATE ---
  const [notifications, setNotifications] = useState<any[]>([]);

  // Fetch Notifications on load
  useEffect(() => {
    const fetchNotifs = async () => {
      if (!user?.subscriberId) return; 
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .or(`subscriber_id.eq.${user.subscriberId},subscriber_id.is.null`) 
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      
      if (data) setNotifications(data);
    };
    fetchNotifs();
  }, [user?.subscriberId]); 

  // 🛡️ SECURITY GUARD: Sidebar only renders if a user is authenticated
  if (!user) return null;

  // 🛡️ ROLE DEFINITIONS
  const isGodMode = user.role === 'PROADMIN';
  const hasFullAccess = isGodMode || user.role === 'CEO';
  const isOps = user.role === 'Operations';
  const isFinance = user.role === 'Finance';
  const isDriver = user.role === 'Driver';
  const isGuide = user.role === 'Guide';

  // --- SUPPORT TICKET LOGIC ---
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
      alert("Message sent to Pro-Central!");
      setFeedbackText('');
      setIsSupportOpen(false);
    } catch (e) {
      console.error(e);
      alert("Error sending message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 w-full z-[100] p-2 md:static md:h-screen md:w-auto md:py-6 md:pl-4 md:pr-2 md:flex md:flex-col md:items-center bg-transparent pointer-events-none md:pointer-events-auto">
      
      <div className="bg-slate-900/95 backdrop-blur-2xl shadow-2xl border border-white/10 flex flex-row justify-between items-center px-4 py-3 rounded-2xl md:flex-col md:w-24 md:h-full md:py-8 md:rounded-[2.5rem] md:justify-between pointer-events-auto mx-auto max-w-sm md:max-w-none">
        
        {/* BRANDING */}
        <div 
          className="hidden md:flex w-12 h-12 rounded-2xl items-center justify-center text-white font-black text-xl shadow-lg mb-6 shrink-0 transition-transform hover:scale-110 cursor-pointer"
          style={{ backgroundColor: APP_COLOR, boxShadow: `0 8px 20px -4px ${APP_COLOR}60` }}
          onClick={() => navigate('/')}
        >
          {user?.companyName ? user.companyName.charAt(0).toUpperCase() : 'P'}
        </div>

        {/* MAIN NAVIGATION */}
        <nav className="flex flex-row justify-between w-full md:flex-col md:space-y-4 md:justify-start">
          
          {/* DASHBOARD: EVERYONE */}
          <NavItem to="/" icon={<LayoutDashboard size={22} />} label="Home" activeColor={APP_COLOR} />
          
          {/* COCKPIT: Drivers and GodMode (CEO removed) */}
          {(isGodMode || isDriver) && (
             <NavItem to="/driver-cockpit" icon={<Compass size={22} />} label="Cockpit" activeColor={APP_COLOR} />
          )}

          {/* MANIFEST: Guides and GodMode (CEO removed) */}
          {(isGodMode || isGuide) && (
             <NavItem to="/manifest" icon={<Bus size={22} />} label="Manifest" activeColor={APP_COLOR} />
          )}

          {/* OPERATIONS HUB (CEO still sees this!) */}
          {(hasFullAccess || isOps || isFinance) && (
            <NavDropdown 
              to="/ops-hub" 
              icon={<Truck size={22} />} 
              label="Ops" 
              activeColor={APP_COLOR}
              isHighlighted={location.pathname.includes('ops') || ['/booking', '/operations', '/tour-operations', '/fleet', '/suppliers'].includes(location.pathname)}
            >
              {({ close }) => (
                <>
                  <DropdownItem to="/booking" icon={<BookOpen />} label="Booking" onClick={close} activeColor={APP_COLOR} />
                  {(hasFullAccess || isOps) && (
                    <>
                      <DropdownItem to="/tour-operations" icon={<Map />} label="Trips" onClick={close} activeColor={APP_COLOR} />
                      <DropdownItem to="/fleet" icon={<Compass />} label="Live Fleet" onClick={close} activeColor={APP_COLOR} />
                    </>
                  )}
                  <DropdownItem to="/suppliers" icon={<Building2 />} label="Suppliers" onClick={close} activeColor={APP_COLOR} />
                </>
              )}
            </NavDropdown>
          )}

          {/* FINANCE HUB */}
          {(hasFullAccess || isFinance || isOps) && (
            <NavDropdown 
              to="/finance-hub" 
              icon={<Wallet size={22} />} 
              label="Finance" 
              activeColor={APP_COLOR}
              isHighlighted={location.pathname.includes('finance') || ['/expenses', '/invoices', '/payroll', '/finance-ledger'].includes(location.pathname)}
            >
              {({ close }) => (
                <>
                  {(hasFullAccess || isFinance) && (
                     <DropdownItem to="/finance-ledger" icon={<Wallet />} label="Ledger" onClick={close} activeColor={APP_COLOR} />
                  )}
                  <DropdownItem to="/expenses" icon={<CreditCard />} label="Expenses" onClick={close} activeColor={APP_COLOR} />
                  {(hasFullAccess || isFinance) && (
                    <>
                      <DropdownItem to="/invoices" icon={<FileText />} label="Invoices" onClick={close} activeColor={APP_COLOR} />
                      <DropdownItem to="/payroll" icon={<Users />} label="Payroll" onClick={close} activeColor={APP_COLOR} />
                    </>
                  )}
                </>
              )}
            </NavDropdown>
          )}

          {/* AI HUB */}
          {(hasFullAccess || isOps || isFinance) && (
            <NavDropdown 
              to="/ai-hub" 
              icon={<Sparkles size={22} />} 
              label="AI" 
              activeColor={APP_COLOR}
              isHighlighted={location.pathname.includes('ai') || ['/smartsave', '/smartroute', '/smartyield', '/smartmatch', '/communications'].includes(location.pathname)}
            >
              {({ close }) => (
                <>
                  {(hasFullAccess || isFinance) && <DropdownItem to="/smartsave" icon={<PiggyBank className="text-pink-400" />} label="SmartSave" onClick={close} activeColor={APP_COLOR} />}
                  {(hasFullAccess || isOps) && <DropdownItem to="/smartroute" icon={<Route className="text-blue-400" />} label="SmartRoute" onClick={close} activeColor={APP_COLOR} />}
                  {(hasFullAccess || isOps || isFinance) && <DropdownItem to="/smartyield" icon={<TrendingUp className="text-emerald-400" />} label="SmartYield" onClick={close} activeColor={APP_COLOR} />}
                  {(hasFullAccess || isOps) && <DropdownItem to="/smartmatch" icon={<Target className="text-amber-400" />} label="SmartMatch" onClick={close} activeColor={APP_COLOR} />}
                  {(hasFullAccess || isOps) && <DropdownItem to="/communications" icon={<MessageSquare className="text-green-400" />} label="Auto-Comms" onClick={close} activeColor={APP_COLOR} />}
                </>
              )}
            </NavDropdown>
          )}

          {/* ADMIN & GODMODE HUB */}
          {(hasFullAccess || isOps || isFinance) && (
            <NavDropdown 
              to="/admin-hub" 
              icon={<ShieldCheck size={22} />} 
              label="Admin" 
              activeColor={APP_COLOR}
              isHighlighted={location.pathname.includes('admin') || ['/staff', '/subscription', '/auditlog'].includes(location.pathname)}
            >
              {({ close }) => (
                <>
                  <DropdownItem to="/staff" icon={<Users />} label="Staff" onClick={close} activeColor={APP_COLOR} />
                  {(hasFullAccess || isFinance) && (
                    <DropdownItem to="/subscription" icon={<CreditCard />} label="Billing" onClick={close} activeColor={APP_COLOR} />
                  )}
                  {hasFullAccess && (
                    <DropdownItem to="/auditlog" icon={<Briefcase />} label="Audit Log" onClick={close} activeColor={APP_COLOR} />
                  )}
                </>
              )}
            </NavDropdown>
          )}

          {/* SETTINGS */}
          {(hasFullAccess || isOps) && (
            <NavDropdown 
              to="/settings" 
              icon={<Settings size={22} />} 
              label="Settings" 
              activeColor={APP_COLOR}
              isHighlighted={location.pathname === '/settings' || location.pathname === '/profile'}
            >
              {({ close }) => (
                <>
                  <DropdownItem to="/profile" icon={<Key />} label="Profile" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/settings" icon={<Lock />} label="System" onClick={close} activeColor={APP_COLOR} />
                </>
              )}
            </NavDropdown>
          )}

          <button onClick={() => { logout(); navigate('/login'); }} className="md:hidden p-2 rounded-xl text-slate-500 hover:text-red-500 transition-colors">
            <LogOut size={22} />
          </button>
        </nav>

        {/* FOOTER */}
        <div className="hidden md:flex flex-col items-center mt-auto space-y-6 shrink-0 pb-4">
          <div className="relative">
             <NotificationBell />
          </div>
          <button onClick={() => setIsSupportOpen(true)} className="relative text-slate-400 hover:text-teal-400 transition-colors" title="Contact Pro-Central">
            <Headphones size={22} />
            {notifications.length > 0 && notifications.some(n => n.type === 'Support') && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500 border border-slate-900"></span>
              </span>
            )}
          </button>

          {/* USER AVATAR */}
          <div 
            className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-sm border border-slate-700 shadow-inner uppercase"
            style={{ color: APP_COLOR }}
            title={user.role}
          >
            {user.username ? user.username.charAt(0) : 'U'}
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="text-slate-400 hover:text-red-500 transition-colors" title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* ================= PRO-CENTRAL SUPPORT MODAL ================= */}
      {isSupportOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSupportOpen(false)}></div>
          <div className="relative bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <div>
                <h2 className="text-white font-black text-lg flex items-center gap-2"><Headphones size={20} className="text-teal-400"/> Pro-Central Support</h2>
              </div>
              <button onClick={() => setIsSupportOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6">
              <textarea 
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder="How can we help?"
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm outline-none focus:border-teal-500 resize-none h-32"
              ></textarea>
              <button 
                onClick={handleSendFeedback}
                disabled={!feedbackText.trim() || isSending}
                className="w-full mt-4 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 text-white font-black py-4 rounded-2xl transition-colors active:scale-95"
              >
                {isSending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- SUB-COMPONENTS & TYPES --- */
interface NavItemProps { to: string; icon: React.ReactNode; label: string; activeColor: string; }
const NavItem: React.FC<NavItemProps> = ({ to, icon, label, activeColor }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `p-3 rounded-2xl transition-all flex flex-col items-center gap-1 w-14 ${isActive ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
    style={({ isActive }) => isActive ? { backgroundColor: activeColor, boxShadow: `0 10px 15px -3px ${activeColor}40` } : {}}
    title={label}
  >
    {icon}
  </NavLink>
);

interface DropdownRenderProps { close: () => void; }
interface NavDropdownProps { to: string; icon: React.ReactNode; label: string; children: (props: DropdownRenderProps) => React.ReactNode; activeColor: string; isHighlighted: boolean; }

const NavDropdown: React.FC<NavDropdownProps> = ({ to, icon, label, children, activeColor, isHighlighted }) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  // THE MAGIC DELAY TIMERS
  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250); // Gives the user 250 milliseconds to move their mouse to the box
  };

  return (
    <div className="relative group" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button 
        onClick={() => { navigate(to); setIsOpen(false); }} 
        className={`p-3 rounded-2xl transition-all flex flex-col items-center gap-1 w-14 ${isOpen ? 'bg-white text-slate-900 shadow-md' : isHighlighted ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        style={(!isOpen && isHighlighted) ? { backgroundColor: activeColor, boxShadow: `0 10px 15px -3px ${activeColor}40` } : {}}
        title={!isOpen ? label : ''} // Tooltip shows up if menu is closed
      >
        {label === 'AI' && !isOpen && !isHighlighted ? (
            <div className="relative">
                {icon}
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: activeColor }}></div>
            </div>
        ) : icon}
      </button>
      
      {isOpen && (
        <div className="absolute bottom-[120%] left-1/2 -translate-x-1/2 md:translate-x-0 md:bottom-auto md:top-0 md:left-[110%] md:ml-4 bg-slate-800/95 backdrop-blur-xl border border-slate-700 p-2 rounded-2xl shadow-2xl flex flex-col gap-1 min-w-[180px] z-[200] animate-in fade-in zoom-in-95 duration-200">
          
          {/* INVISIBLE BRIDGE: This stops the menu from closing when the mouse is between the button and the box! */}
          <div className="hidden md:block absolute top-0 -left-6 w-8 h-full bg-transparent"></div>

          <div className="text-[10px] font-black uppercase tracking-widest px-3 py-2 border-b border-slate-700/50 mb-1 text-slate-500">
              {label} HUB
          </div>
          {children({ close: () => setIsOpen(false) })}
        </div>
      )}
    </div>
  );
};

interface DropdownItemProps { to: string; icon: React.ReactElement; label: string; onClick: () => void; activeColor: string; }
const DropdownItem: React.FC<DropdownItemProps> = ({ to, icon, label, onClick, activeColor }) => (
  <NavLink 
    to={to} 
    onClick={onClick} 
    className={({ isActive }) => `flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${isActive ? 'text-white shadow-md' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
    style={({ isActive }) => isActive ? { backgroundColor: activeColor } : {}}
  >
    {React.cloneElement(icon, { size: 16 } as any)}
    <span className="uppercase tracking-wide">{label}</span>
  </NavLink>
);

export default Sidebar;