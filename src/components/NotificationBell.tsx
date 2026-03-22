import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, Zap, MessageSquare, Info, 
  CheckCheck, BellRing, AlertTriangle } from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase'; 

interface Notification {
  id: number;
  subscriber_id?: string | null;
  type: string;
  title: string;
  message: string;
  created_at: string;
}

const NotificationBell: React.FC = () => {
  const { user } = useTenant();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- NATIVE SUPABASE FETCH & REAL-TIME LISTENER ---
  useEffect(() => {
    if (!user?.subscriberId) return;

    // 1. Initial Fetch
    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`subscriber_id.eq.${user.subscriberId},subscriber_id.is.null`) 
        .eq('is_read', false)
        .in('type', ['feedback', 'alert', 'update', 'general', 'goodwill', 'success']) 
        .order('created_at', { ascending: false })
        .limit(15);

      if (!error && data) setNotifications(data);
    };

    fetchNotifs();

    // 2. Real-time Subscription
    const channel = supabase
      .channel('public:notifications_bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as Notification;
          
          const isForUser = newNotif.subscriber_id === user.subscriberId || newNotif.subscriber_id === null;
          const isRightType = ['feedback', 'alert', 'update', 'general', 'goodwill', 'success'].includes(newNotif.type);

          if (isForUser && isRightType) {
            setNotifications((prev) => [newNotif, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.subscriberId]);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- MARK SINGLE AS READ ---
  const markAsRead = async (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  // --- MARK ALL AS READ ---
  const markAllAsRead = async () => {
    if (notifications.length === 0) return;
    const idsToUpdate = notifications.map(n => n.id);
    setNotifications([]); // Instant UI clear
    await supabase.from('notifications').update({ is_read: true }).in('id', idsToUpdate);
  };

  // 🌟 Premium Theme Icons
  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'update': return <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-sm border border-blue-100/50"><Zap size={16}/></div>;
      case 'alert': return <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shadow-sm border border-rose-100/50"><AlertTriangle size={16}/></div>;
      case 'success': return <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm border border-emerald-100/50"><CheckCircle2 size={16}/></div>;
      default: return <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl shadow-sm border border-slate-100/50"><MessageSquare size={16}/></div>;
    }
  };

  return (
    // 🌟 Wrapper ensures right-alignment in the top corner of the main content
    <div className="flex justify-end items-center mb-6 relative z-50">
      <div className="relative" ref={dropdownRef}>
        
        {/* THE BELL BUTTON */}
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className={`relative p-3 transition-all rounded-[1.2rem] border flex items-center justify-center
            ${isOpen 
              ? 'bg-blue-50 text-blue-600 border-blue-100 shadow-inner' 
              : 'bg-white text-slate-400 border-slate-200 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100 shadow-sm'
            }`}
        >
          <Bell size={20} className={isOpen ? 'fill-blue-100' : ''} />
          {notifications.length > 0 && (
            <span className="absolute top-2 right-2.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-white shadow-sm"></span>
            </span>
          )}
        </button>

        {/* THE PREMIUM DROPDOWN */}
        {isOpen && (
          // 🌟 Top-Down Right-Aligned Positioning for Top Bar
          <div className="absolute right-0 top-full mt-3 w-[calc(100vw-2rem)] max-w-sm sm:w-[400px] bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-[0_15px_50px_rgba(0,0,0,0.12)] border border-slate-200 overflow-hidden z-[200] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            
            {/* HEADER SECTION */}
            <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-[1rem] border border-blue-100">
                  <BellRing size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 tracking-tight leading-none mb-1">Inbox</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{notifications.length} Unread Alerts</p>
                </div>
              </div>
              {notifications.length > 0 && (
                <button 
                  onClick={markAllAsRead} 
                  className="text-[10px] font-black text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:text-slate-800 px-3 py-1.5 rounded-full transition-all flex items-center gap-1 active:scale-95"
                >
                  <CheckCheck size={14}/> Clear All
                </button>
              )}
            </div>

            {/* NOTIFICATIONS LIST */}
            <div className="max-h-[420px] overflow-y-auto p-3 space-y-2">
              {notifications.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                     <CheckCircle2 size={32} className="text-slate-300"/>
                  </div>
                  <h4 className="font-black text-slate-800 mb-1">You're all caught up!</h4>
                  <p className="text-xs text-slate-400 font-medium">No new system alerts or messages.</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all flex gap-4 group relative overflow-hidden"
                  >
                    <div className="shrink-0 relative z-10">{getIcon(notif.type)}</div>
                    
                    <div className="flex-1 pr-4 relative z-10">
                      <div className="flex justify-between items-center mb-1.5">
                        <p className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 uppercase tracking-widest px-2 py-0.5 rounded-md">
                          {notif.type}
                        </p>
                        <span className="text-[10px] font-bold text-slate-400">
                            {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight mb-1">{notif.title}</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-2">{notif.message}</p>
                    </div>

                    {/* Hover Clear Button */}
                    <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end pr-4 z-20">
                      <button 
                          onClick={() => markAsRead(notif.id)} 
                          className="text-slate-400 hover:text-emerald-500 bg-white shadow-md border border-slate-100 p-2.5 rounded-full transition-all hover:scale-110 active:scale-95"
                          title="Mark as Read"
                      >
                          <CheckCircle2 size={16}/>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationBell;