import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle, Zap, MessageSquare, Info, 
  AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// --- TYPES & INTERFACES ---
interface Notification {
  id: number | string; 
  subscriber_id?: string | null; // <-- Add this line right here!
  type: string;
  title: string;
  message: string;
  is_local?: boolean; 
}

const TopHeader: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

// --- 1. FETCH CLOUD ALERTS & REAL-TIME LISTENER ---
  useEffect(() => {
    if (!user?.subscriberId) return;

    // 1. Initial Fetch (Filtered for notices/feedback)
    const fetchCloudNotifs = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`subscriber_id.eq.${user.subscriberId},subscriber_id.is.null`)
        .eq('is_read', false)
        // Add a filter so this app only gets notices and feedback:
        .in('type', ['feedback','alert','update', 'general', 'goodwill'])
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

    // 2. Real-time Subscription
    const channel = supabase
      .channel('public:notifications_header')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as Notification;
          
          // Client-side filter: Ensure it belongs to this user AND is the right type
          const isForUser = newNotif.subscriber_id === user.subscriberId || newNotif.subscriber_id === null;
          const isRightType = ['feedback','alert','update', 'general', 'goodwill'].includes(newNotif.type);

          if (isForUser && isRightType) {
            setNotifications((prev) => {
               // Prevent duplicates just in case
               if (prev.some(n => n.id === newNotif.id)) return prev;
               return [newNotif, ...prev];
            });
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.subscriberId]);

  // --- 2. LISTEN FOR LOCAL ALERTS (DISPATCH EVENTS) ---
  useEffect(() => {
    const handleDispatch = (e: Event) => {
      const customEvent = e as CustomEvent<{ destination: string }>;
      
      const newAlert: Notification = {
        id: `local-${Date.now()}`, // String ID for local alerts
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
    // 1. Remove from UI immediately
    setNotifications(prev => prev.filter(n => n.id !== id));

    // 2. If it's a cloud notification, update Supabase
    if (!isLocal && typeof id === 'number') {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      } catch (e) {
        console.error("Failed to mark notification as read in cloud.");
      }
    }
  };

  // --- HELPER: DYNAMIC ICONS ---
  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'update': return <div className="p-2 bg-indigo-100 text-indigo-600 rounded-full shrink-0"><Zap size={16}/></div>;
      case 'alert': return <div className="p-2 bg-rose-100 text-rose-600 rounded-full shrink-0"><AlertTriangle size={16}/></div>;
      case 'success': return <div className="p-2 bg-green-100 text-green-600 rounded-full shrink-0"><CheckCircle size={16}/></div>;
      default: return <div className="p-2 bg-teal-100 text-teal-600 rounded-full shrink-0"><MessageSquare size={16}/></div>;
    }
  };

  return (
    <div className="flex justify-end items-center mb-6 relative z-40">
      <div className="relative" ref={dropdownRef}>
        
        {/* BELL BUTTON */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-400 hover:text-teal-600 transition-colors relative"
        >
          <Bell size={20} />
          {notifications.length > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>
          )}
        </button>

        {/* DROPDOWN PANEL */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white shadow-2xl rounded-[1.5rem] p-5 border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">System Alerts</h4>
              <span className="text-[10px] font-bold bg-teal-100 text-teal-700 px-2 py-1 rounded-full">{notifications.length} New</span>
            </div>
            
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle size={32} className="mx-auto mb-2 text-slate-200"/>
                <p className="text-sm font-bold text-slate-400">You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {notifications.map(note => (
                  <div key={note.id} className="flex gap-3 items-start bg-slate-50/50 hover:bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-colors group relative">
                    {getIcon(note.type)}
                    <div className="flex-1 pr-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{note.type}</p>
                      <h4 className="text-sm font-bold text-slate-800 leading-tight mb-1">{note.title}</h4>
                      <p className="text-xs text-slate-500 font-medium">{note.message}</p>
                    </div>
                    {/* Clear Button */}
                    <button 
                      onClick={() => markAsRead(note.id, note.is_local)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white rounded-full shadow-sm border border-slate-100 text-slate-300 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all"
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