import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import NotificationBell from './NotificationBell'; 
import { supabase } from '../lib/supabase';  
import { 
  LayoutDashboard, Map, Wallet, Compass, Key, Users, Lock, Target,
  CreditCard, LogOut, BookOpen, Truck, Briefcase, ChevronRight, 
  Building2, ShieldCheck, Settings, FileText, MessageSquare,
  Sparkles, PiggyBank, Route, TrendingUp, Search, Bell, X, Headphones 
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { user: tenant } = useTenant(); 
  const navigate = useNavigate();
  const location = useLocation();

  const APP_COLOR = tenant?.themeColor || '#14b8a6';

  // --- PRO-CENTRAL SUPPORT DESK STATES ---
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // --- NOTIFICATIONS STATE ---
  const [notifications, setNotifications] = useState<any[]>([]);

  // Fetch Notifications on load
  useEffect(() => {
    const fetchNotifs = async () => {
      if (!user?.subscriberId) return; // <-- Safely using user.subscriberId
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .or(`subscriber_id.eq.${user.subscriberId},subscriber_id.is.null`) 
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      
      if (data) setNotifications(data);
    };
    fetchNotifs();
  }, [user?.subscriberId]); // <-- Dependency array updated

  if (!user) return null;
  if (location.pathname === '/field-app' || location.pathname.startsWith('/passport')) return null;

  const hasFullAccess = user.role === 'PROADMIN' || user.role === 'CEO' || user.role === 'owner';

  // --- SUPPORT TICKET LOGIC ---
  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) return;
    setIsSending(true);
    try {
      // Sends a ticket directly to your Supabase database
      await supabase.from('support_tickets').insert([{
        subscriber_id: user?.subscriberId, // <-- Changed this
        sender_name: user?.name,
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
          {tenant?.companyName ? tenant.companyName.charAt(0).toUpperCase() : 'P'}
        </div>

        {/* MAIN NAVIGATION */}
        <nav className="flex flex-row justify-between w-full md:flex-col md:space-y-4 md:justify-start">
          <NavItem to="/" icon={<LayoutDashboard size={22} />} label="Home" activeColor={APP_COLOR} />
          
          {(hasFullAccess || ['Operations', 'Guide', 'Driver'].includes(user.role)) && (
            <NavDropdown 
              to="/ops-hub" 
              icon={<Truck size={22} />} 
              label="Ops" 
              activeColor={APP_COLOR}
              isHighlighted={location.pathname.includes('ops') || ['/booking', '/operations', '/fleet', '/suppliers'].includes(location.pathname)}
            >
              {({ close }) => (
                <>
                  <DropdownItem to="/booking" icon={<BookOpen />} label="Booking" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/operations" icon={<Map />} label="Trips" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/fleet" icon={<Compass />} label="Live Fleet" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/suppliers" icon={<Building2 />} label="Suppliers" onClick={close} activeColor={APP_COLOR} />
                </>
              )}
            </NavDropdown>
          )}

          {(hasFullAccess || user.role === 'Finance') && (
            <NavDropdown 
              to="/finance-hub" 
              icon={<Wallet size={22} />} 
              label="Finance" 
              activeColor={APP_COLOR}
              isHighlighted={location.pathname.includes('finance') || ['/expenses', '/invoices', '/payroll', '/finance-ledger'].includes(location.pathname)}
            >
              {({ close }) => (
                <>
                  <DropdownItem to="/finance-ledger" icon={<Wallet />} label="Ledger" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/expenses" icon={<CreditCard />} label="Expenses" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/invoices" icon={<FileText />} label="Invoices" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/payroll" icon={<Users />} label="Payroll" onClick={close} activeColor={APP_COLOR} />
                </>
              )}
            </NavDropdown>
          )}

          {(hasFullAccess || ['Operations', 'Finance'].includes(user.role)) && (
            <NavDropdown 
              to="/ai-hub" 
              icon={<Sparkles size={22} />} 
              label="AI" 
              activeColor={APP_COLOR}
              isHighlighted={location.pathname.includes('ai') || ['/smartsave', '/smartroute', '/smartyield', '/smartmatch', '/communications'].includes(location.pathname)}
            >
              {({ close }) => (
                <>
                  <DropdownItem to="/smartsave" icon={<PiggyBank className="text-pink-400" />} label="SmartSave" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/smartroute" icon={<Route className="text-blue-400" />} label="SmartRoute" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/smartyield" icon={<TrendingUp className="text-emerald-400" />} label="SmartYield" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/smartmatch" icon={<Target className="text-amber-400" />} label="SmartMatch" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/communications" icon={<MessageSquare className="text-green-400" />} label="Auto-Comms" onClick={close} activeColor={APP_COLOR} />
                </>
              )}
            </NavDropdown>
          )}

          {hasFullAccess && (
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
                  <DropdownItem to="/subscription" icon={<CreditCard />} label="Billing" onClick={close} activeColor={APP_COLOR} />
                  <DropdownItem to="/auditlog" icon={<Briefcase />} label="Audit Log" onClick={close} activeColor={APP_COLOR} />
                </>
              )}
            </NavDropdown>
          )}

           {hasFullAccess && (
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

        {/* SIDEBAR FOOTER */}
        <div className="hidden md:flex flex-col items-center mt-auto space-y-6 shrink-0 pb-4">
          
          {/* THE NOTIFICATION BELL */}
          <div className="relative">
             <NotificationBell />
          </div>

          {/* THE SUPPORT DESK BUTTON */}
          <button onClick={() => setIsSupportOpen(true)} className="relative text-slate-400 hover:text-teal-400 transition-colors" title="Contact Pro-Central">
            <Headphones size={22} />
            {/* Optional: Show a red dot here if there are notifications related to support! */}
            {notifications.length > 0 && notifications.some(n => n.type === 'Support') && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500 border border-slate-900"></span>
              </span>
            )}
          </button>

          {/* USER AVATAR */}
          <div 
            className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-sm border border-slate-700 shadow-inner"
            style={{ color: APP_COLOR }}
          >
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="text-slate-400 hover:text-red-500 transition-colors">
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
                <p className="text-xs text-slate-400 font-medium mt-1">Send a message to the Pronomad team.</p>
              </div>
              <button onClick={() => setIsSupportOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-6">
              <textarea 
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder="Describe your issue, feature request, or feedback..."
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

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  activeColor: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, activeColor }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `p-3 rounded-2xl transition-all flex flex-col items-center gap-1 w-14 ${isActive ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
    style={({ isActive }) => isActive ? { backgroundColor: activeColor, boxShadow: `0 10px 15px -3px ${activeColor}40` } : {}}
  >
    {icon}
  </NavLink>
);

interface DropdownRenderProps {
  close: () => void;
}

interface NavDropdownProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  children: (props: DropdownRenderProps) => React.ReactNode;
  activeColor: string;
  isHighlighted: boolean;
}

const NavDropdown: React.FC<NavDropdownProps> = ({ to, icon, label, children, activeColor, isHighlighted }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const handleMouseEnter = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setIsOpen(true); };
  const handleMouseLeave = () => { timeoutRef.current = setTimeout(() => { setIsOpen(false); }, 300); };

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button 
        onClick={() => { navigate(to); setIsOpen(false); }} 
        className={`p-3 rounded-2xl transition-all flex flex-col items-center gap-1 w-14 ${isOpen ? 'bg-white text-slate-900 shadow-md' : isHighlighted ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        style={(!isOpen && isHighlighted) ? { backgroundColor: activeColor, boxShadow: `0 10px 15px -3px ${activeColor}40` } : {}}
      >
        {label === 'AI' && !isOpen && !isHighlighted ? (
            <div className="relative">
                {icon}
                <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: activeColor }}></div>
            </div>
        ) : icon}
      </button>
      
      {isOpen && (
        <div className="absolute bottom-[120%] left-1/2 -translate-x-1/2 md:translate-x-0 md:bottom-auto md:top-0 md:left-[140%] bg-slate-800/95 backdrop-blur-xl border border-slate-700 p-2 rounded-2xl shadow-2xl flex flex-col gap-1 min-w-[180px] z-[100] animate-in fade-in zoom-in-95 duration-200">
          <div className="text-[10px] font-black uppercase tracking-widest px-3 py-2 border-b border-slate-700/50 mb-1 text-slate-500">
              {label} HUB
          </div>
          {children({ close: () => setIsOpen(false) })}
        </div>
      )}
    </div>
  );
};

interface DropdownItemProps {
  to: string;
  icon: React.ReactElement; 
  label: string;
  onClick: () => void;
  activeColor: string;
}

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