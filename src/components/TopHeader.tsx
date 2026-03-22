import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle, Zap, MessageSquare, AlertTriangle, X } from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

// --- TYPES & INTERFACES ---
interface Notification {
  id: number | string; 
  subscriber_id?: string | null; 
  type: string;
  title: string;
  message: string;
  is_local?: boolean; 
}

const TopHeader: React.FC = () => {
  const { user } = useTenant();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- 1. FETCH CLOUD ALERTS & REAL-TIME LISTENER ---
  useEffect(() => {
    if (!user?.subscriberId) return;

    const fetchCloudNotifs = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`subscriber_id.eq.${user.subscriberId},subscriber_id.is.null`)
        .eq('is_read', false)
        .in('type', ['feedback', 'alert', 'update', 'general', 'goodwill'])
        .order('created_at', { ascending: false });

      if (data && !error) {
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newCloudNotifs = data.filter(n => !existingIds.has(n.id));
          return [...newCloudNotifs, ...prev];
        });
      }
    };

    fetchCloudNotifs();

    const channel = supabase
      .channel('public:notifications_header')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as Notification;
          const isForUser = newNotif.subscriber_id === user.subscriberId || newNotif.subscriber_id === null;
          const isRightType = ['feedback', 'alert', 'update', 'general', 'goodwill'].includes(newNotif.type);

          if (isForUser && isRightType) {
            setNotifications((prev) => {
               if (prev.some(n => n.id === newNotif.id)) return prev;
               return [newNotif, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.subscriberId]);

  // --- 2. LISTEN FOR LOCAL ALERTS ---
  useEffect(() => {
    const handleDispatch = (e: Event) => {
      const customEvent = e as CustomEvent<{ destination: string }>;
      const newAlert: Notification = {
        id: `local-${Date.now()}`, 
        type: 'success',
        title: 'Manifest Dispatched',
        message: `Trip to ${customEvent.detail?.destination || 'Destination'} sent to driver.`,
        is_local: true
      };
      setNotifications(prev => [newAlert, ...prev]);
    };

    window.addEventListener('dispatch_alert', handleDispatch);
    return () => window.removeEventListener('dispatch_alert', handleDispatch);
  }, []);

  // --- 3. CLOSE DROPDOWN ON OUTSIDE CLICK ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- 4. MARK AS READ (CLEAR ALERT) ---
  const markAsRead = async (id: number | string, isLocal?: boolean) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (!isLocal && typeof id === 'number') {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      } catch (e) {
        console.error("Failed to mark notification as read in cloud.");
      }
    }
  };

  // --- HELPER: DYNAMIC ICONS (Updated for Blue/White Theme) ---
  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'update': return <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shrink-0"><Zap size={16}/></div>;
      case 'alert': return <div className="p-2 bg-rose-100 text-rose-600 rounded-xl shrink-0"><AlertTriangle size={16}/></div>;
      case 'success': return <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shrink-0"><CheckCircle size={16}/></div>;
      default: return <div className="p-2 bg-slate-100 text-slate-600 rounded-xl shrink-0"><MessageSquare size={16}/></div>;
    }
  };

  return (
    <div className="flex justify-end items-center relative z-[150]">
      <div className="relative" ref={dropdownRef}>
        
        {/* 🔔 BELL BUTTON */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`p-3 rounded-2xl transition-all relative border flex items-center justify-center
            ${isOpen 
              ? 'bg-blue-50 text-blue-600 border-blue-100 shadow-inner' 
              : 'bg-white text-slate-400 border-slate-200 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100 shadow-sm'
            }`}
        >
          <Bell size={20} />
          {notifications.length > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse border-2 border-white"></span>
          )}
        </button>

        {/* 🗂️ DROPDOWN PANEL */}
        {isOpen && (
          // 🌟 FIX: Mobile width is calculated to fit screen minus padding. Anchored right.
          <div className="absolute right-0 top-full mt-3 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-white/95 backdrop-blur-2xl shadow-[0_10px_40px_rgb(0,0,0,0.1)] rounded-[2rem] p-5 border border-slate-200 origin-top-right animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-3">
              <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-widest">System Alerts</h4>
              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100">
                {notifications.length} New
              </span>
            </div>
            
            {notifications.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                   <CheckCircle size={28} className="text-slate-300"/>
                </div>
                <p className="text-sm font-bold text-slate-400">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {notifications.map(note => (
                  <div key={note.id} className="flex gap-3 items-start bg-slate-50/50 hover:bg-blue-50/50 p-4 rounded-2xl border border-slate-100 hover:border-blue-100 transition-all group relative cursor-default">
                    {getIcon(note.type)}
                    <div className="flex-1 pr-6">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{note.type}</p>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight mb-1">{note.title}</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">{note.message}</p>
                    </div>
                    {/* Clear Button */}
                    <button 
                      onClick={() => markAsRead(note.id, note.is_local)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white rounded-full shadow-sm border border-slate-200 text-slate-400 hover:text-emerald-500 hover:border-emerald-200 opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                      title="Mark as Read"
                    >
                      <CheckCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopHeader;