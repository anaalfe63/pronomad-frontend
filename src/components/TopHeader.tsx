import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle } from 'lucide-react';

// --- TYPES & INTERFACES ---
interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
}

const TopHeader: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Listen for the "Dispatch" event
  useEffect(() => {
    // We type 'e' as Event, then cast it to CustomEvent to access the detail payload
    const handleDispatch = (e: Event) => {
      const customEvent = e as CustomEvent<{ destination: string }>;
      
      const newAlert: Notification = {
        id: Date.now(),
        type: 'success',
        title: 'Manifest Dispatched',
        message: `Trip to ${customEvent.detail?.destination || 'Destination'} sent to driver.`
      };
      setNotifications(prev => [newAlert, ...prev]);
    };

    window.addEventListener('dispatch_alert', handleDispatch);
    return () => window.removeEventListener('dispatch_alert', handleDispatch);
  }, []);

  return (
    <div className="flex justify-end items-center mb-6 relative z-40">
      <div className="relative">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-400 hover:text-teal-600 transition-colors relative"
        >
          <Bell size={20} />
          {notifications.length > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-white"></span>
          )}
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white shadow-2xl rounded-2xl p-4 border border-slate-100 z-50 animate-fade-in">
            <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-widest border-b pb-2">System Alerts</h4>
            
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No new notifications</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
                {notifications.map(note => (
                  <div key={note.id} className="flex gap-3 items-start bg-green-50/50 p-3 rounded-xl border border-green-100">
                    <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0"/>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{note.title}</p>
                      <p className="text-xs text-slate-500">{note.message}</p>
                    </div>
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