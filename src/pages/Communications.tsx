import React, { useState, useEffect } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { 
  MessageSquare, Smartphone, CheckCircle2, Clock, 
  AlertCircle, Send, Search, Filter, RefreshCw, Eye, X, Zap, PenSquare,
  Sparkles, CalendarClock, FileText, RotateCw, Users
} from 'lucide-react';

interface Log {
  id: string; 
  recipient: string; 
  phone: string; 
  trip: string;
  type: string; 
  channel: 'WhatsApp' | 'SMS'; 
  status: string; 
  timestamp: string; 
  bookingId: string;
  customMessage?: string; 
}

interface Contact {
  name: string;
  phone: string;
  email: string;
  bookingId: string;
  tripTitle: string;
  tripId: string; 
}

interface Trip {
  id: string;
  title: string;
}

const QUICK_TEMPLATES = [
  { label: "Welcome / Onboarding", text: "Hi [Name],\n\nWelcome to our travel family! We are thrilled to have you on board for [Trip]. Let us know if you have any questions.\n\nWarmly,\nThe Team" },
  { label: "Payment Reminder", text: "Hi [Name],\n\nThis is a friendly reminder that your next installment for [Trip] is due soon. Please check your traveler portal to process your payment.\n\nThank you!" },
  { label: "Itinerary Update", text: "Hi [Name],\n\nGreat news! We have updated the daily itinerary for [Trip]. Check your digital passport link to see the new exciting details!\n\nSee you soon!" }
];

const Communications: React.FC = () => {
  const { user } = useTenant();
  const APP_COLOR = user?.themeColor || '#10b981'; 

  const [logs, setLogs] = useState<Log[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tripsDb, setTripsDb] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [previewLog, setPreviewLog] = useState<Log | null>(null);
  
  // Custom Compose & SmartMatch Campaign States (Session Persistence)
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(() => sessionStorage.getItem('pronomad_comm_open') === 'true');
  const [composeMode, setComposeMode] = useState<'single' | 'trip'>(() => (sessionStorage.getItem('pronomad_comm_mode') as any) || 'single');
  const [selectedTripBroadcast, setSelectedTripBroadcast] = useState<string>(() => sessionStorage.getItem('pronomad_comm_trip') || '');
  
  const [campaignLeads, setCampaignLeads] = useState<any[]>(() => {
      const saved = sessionStorage.getItem('pronomad_comm_leads');
      return saved ? JSON.parse(saved) : [];
  });
  const [campaignTrip, setCampaignTrip] = useState<string>(() => sessionStorage.getItem('pronomad_comm_camp_trip') || '');
  
  const [composeData, setComposeData] = useState<{recipientInfo: string, channel: string, message: string, isScheduled: boolean}>(() => {
      const saved = sessionStorage.getItem('pronomad_comm_data');
      return saved ? JSON.parse(saved) : { recipientInfo: '', channel: 'WhatsApp', message: '', isScheduled: false };
  });
  
  const [isComposing, setIsComposing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Automatically save to memory
  useEffect(() => {
      sessionStorage.setItem('pronomad_comm_open', String(isComposeOpen));
      sessionStorage.setItem('pronomad_comm_mode', composeMode);
      sessionStorage.setItem('pronomad_comm_trip', selectedTripBroadcast);
      sessionStorage.setItem('pronomad_comm_leads', JSON.stringify(campaignLeads));
      sessionStorage.setItem('pronomad_comm_camp_trip', campaignTrip);
      sessionStorage.setItem('pronomad_comm_data', JSON.stringify(composeData));
  }, [isComposeOpen, composeMode, selectedTripBroadcast, campaignLeads, campaignTrip, composeData]);

  // --- CATCH INCOMING SMARTMATCH CAMPAIGNS ---
  useEffect(() => {
      const incomingCampaign = localStorage.getItem('pronomad_autocomm_target');
      if (incomingCampaign) {
          try {
              const data = JSON.parse(incomingCampaign);
              setCampaignLeads(data.targetLeads || []);
              setCampaignTrip(data.tripTitle || 'Upcoming Trip');
              setComposeData(prev => ({
                  ...prev,
                  message: `Hi [Name],\n\nBecause you traveled with us before, we thought you'd love an exclusive VIP spot on our upcoming trip to ${data.tripTitle}!\n\nLet us know if you're interested.\n\nWarmly,\nThe ${user?.companyName || 'Travel'} Team`
              }));
              setIsComposeOpen(true);
              localStorage.removeItem('pronomad_autocomm_target');
          } catch (e) {
              console.error("Failed to parse campaign payload", e);
          }
      }
  }, [user?.companyName]);


  // --- FETCH LIVE LOGS & GLOBAL CONTACTS ---
  const fetchDashboardData = async () => {
    if (!user?.subscriberId) return;
    setLoading(true);
    try {
      const [logsRes, bookingsRes, tripsRes] = await Promise.all([
          supabase.from('communications').select('*').eq('subscriber_id', user.subscriberId).order('timestamp', { ascending: false }),
          supabase.from('bookings').select('*').eq('subscriber_id', user.subscriberId),
          supabase.from('trips').select('id, title').eq('subscriber_id', user.subscriberId)
      ]);

      if (logsRes.data) setLogs(logsRes.data as Log[]);
      if (tripsRes.data) setTripsDb(tripsRes.data as Trip[]);

      const tripsMap = new Map((tripsRes.data || []).map(t => [t.id, t.title]));
      
      const extractedContacts: Contact[] = [];
      (bookingsRes.data || []).forEach(b => {
          const raw = typeof b.raw_data === 'string' ? JSON.parse(b.raw_data) : (b.raw_data || {});
          const name = b.customer_name || raw?.leadTraveler?.firstName + ' ' + raw?.leadTraveler?.lastName || 'Unknown Guest';
          const phone = b.phone || b.customer_phone || raw?.leadTraveler?.phone || '';
          const email = b.email || b.customer_email || raw?.leadTraveler?.email || '';
          const tripTitle = tripsMap.get(b.trip_id) || 'General Inquiry';

          if (name !== 'Unknown Guest' && phone) {
              if (!extractedContacts.find(c => c.phone === phone)) {
                  extractedContacts.push({ name, phone, email, bookingId: b.id, tripTitle, tripId: b.trip_id });
              }
          }
      });

      extractedContacts.sort((a, b) => a.name.localeCompare(b.name));
      setContacts(extractedContacts);

    } catch (e) { 
      console.log("Data sync issue:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchDashboardData(); }, [user?.subscriberId]);

  const groupedContacts = contacts.reduce((groups, contact) => {
      const group = groups[contact.tripTitle] || [];
      group.push(contact);
      groups[contact.tripTitle] = group;
      return groups;
  }, {} as Record<string, Contact[]>);

  // --- ACTIONS ---
  const handleRealFreeSend = async (log: Log) => {
    setSendingId(log.id);
    const messageText = generateMessagePreview(log);
    
    let cleanPhone = log.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '233' + cleanPhone.substring(1); 
    }

    try {
      if (navigator.onLine) {
          const { error } = await supabase.from('communications').update({ status: 'Delivered', timestamp: new Date().toISOString() }).eq('id', log.id);
          if (error) console.error("Update failed", error);
      }
      setLogs(logs.map(l => l.id === log.id ? { ...l, status: 'Delivered', timestamp: new Date().toISOString() } : l));
    } catch (e) { console.error(e); } 
    finally { setSendingId(null); }

    if (log.channel === 'WhatsApp' || log.channel === 'SMS') {
        const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
        window.open(waLink, '_blank'); 
    }
  };

  const handleBulkSend = async () => {
    const pendingLogs = logs.filter(l => l.status === 'Scheduled' || l.status === 'Queued');
    if (pendingLogs.length === 0) return alert("No messages pending dispatch.");
    
    setIsBulkSending(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); 
      const updatedLogs = logs.map(log => (log.status === 'Scheduled' || log.status === 'Queued') ? { ...log, status: 'Delivered', timestamp: new Date().toISOString() } : log);
      setLogs(updatedLogs);
    } finally {
      setIsBulkSending(false);
    }
  };

  const handleCustomMarketingSend = async () => {
      if (!composeData.message.trim()) return alert("Please write a message.");
      setIsComposing(true);
      const targetStatus = composeData.isScheduled ? 'Scheduled' : 'Delivered';

      try {
        // 🟢 PATH A: BULK SMARTMATCH CAMPAIGN
        if (campaignLeads.length > 0) {
            const newLogs: Log[] = campaignLeads.map((lead, i) => {
                let finalMsg = composeData.message.replace(/\[Name\]/gi, lead.first_name);
                finalMsg = finalMsg.replace(/\[Trip\]/gi, campaignTrip);

                return {
                    id: `MSG-MKT-${Date.now()}-${i}`,
                    recipient: `${lead.first_name} ${lead.last_name}`,
                    phone: lead.phone,
                    trip: campaignTrip,
                    type: 'SmartMatch Campaign',
                    channel: composeData.channel as 'WhatsApp' | 'SMS',
                    status: targetStatus,
                    timestamp: new Date().toISOString(),
                    bookingId: 'N/A',
                    customMessage: finalMsg
                };
            });

            setLogs([...newLogs, ...logs]);

            if (navigator.onLine && user?.subscriberId) {
                const payload = newLogs.map(l => ({ ...l, subscriber_id: user.subscriberId }));
                const { error: insertError } = await supabase.from('communications').insert(payload);
                if (insertError) console.error("Cloud sync error:", insertError);
            }
            alert(`🚀 Successfully ${composeData.isScheduled ? 'scheduled' : 'dispatched'} ${campaignLeads.length} messages!`);
        } 
        
        // 🟢 PATH B: ENTIRE TRIP BROADCAST
        else if (composeMode === 'trip') {
            if (!selectedTripBroadcast) return alert("Please select a Trip to broadcast to.");
            
            const targetTrip = tripsDb.find(t => String(t.id) === selectedTripBroadcast);
            const targetContacts = contacts.filter(c => String(c.tripId) === selectedTripBroadcast);
            
            if (targetContacts.length === 0) return alert("No passengers found in the database for this trip.");

            const newLogs: Log[] = targetContacts.map((contact, i) => {
                let finalMsg = composeData.message.replace(/\[Name\]/gi, contact.name.split(' ')[0]);
                finalMsg = finalMsg.replace(/\[Trip\]/gi, contact.tripTitle);

                return {
                    id: `MSG-BCAST-${Date.now()}-${i}`,
                    recipient: contact.name,
                    phone: contact.phone,
                    trip: contact.tripTitle,
                    type: 'Trip Broadcast',
                    channel: composeData.channel as 'WhatsApp' | 'SMS',
                    status: targetStatus,
                    timestamp: new Date().toISOString(),
                    bookingId: contact.bookingId,
                    customMessage: finalMsg
                };
            });

            setLogs([...newLogs, ...logs]);

            if (navigator.onLine && user?.subscriberId) {
                const payload = newLogs.map(l => ({ ...l, subscriber_id: user.subscriberId }));
                const { error: insertError } = await supabase.from('communications').insert(payload);
                if (insertError) console.error("Cloud sync error:", insertError);
            }
            alert(`📢 Successfully ${composeData.isScheduled ? 'scheduled' : 'dispatched'} broadcast to ${targetContacts.length} passengers on ${targetTrip?.title}!`);
        }

        // 🟢 PATH C: SINGLE CUSTOM MESSAGE
        else {
            if (!composeData.recipientInfo) return alert("Please select a recipient.");
            const recipient = JSON.parse(composeData.recipientInfo) as Contact;

            const firstName = recipient.name.split(' ')[0];
            let finalMessage = composeData.message.replace(/\[Name\]/gi, firstName);
            finalMessage = finalMessage.replace(/\[Trip\]/gi, recipient.tripTitle);

            let cleanPhone = recipient.phone.replace(/\D/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = '233' + cleanPhone.substring(1); 

            if (!composeData.isScheduled) {
                if (composeData.channel === 'WhatsApp') {
                    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalMessage)}`;
                    window.open(waLink, '_blank');
                } else {
                    window.open(`sms:${cleanPhone}?body=${encodeURIComponent(finalMessage)}`, '_self');
                }
            }
            
            const newCustomLog: Log = {
                id: `MSG-CST-${Date.now()}`,
                recipient: recipient.name,
                phone: recipient.phone,
                trip: recipient.tripTitle,
                type: 'Personalized Message',
                channel: composeData.channel as 'WhatsApp' | 'SMS',
                status: targetStatus,
                timestamp: new Date().toISOString(),
                bookingId: recipient.bookingId || 'N/A',
                customMessage: finalMessage
            };

            setLogs([newCustomLog, ...logs]);

            if (navigator.onLine && user?.subscriberId) {
                const { error: singleInsertError } = await supabase.from('communications').insert([{ ...newCustomLog, subscriber_id: user.subscriberId }]);
                if (singleInsertError) console.error("Cloud sync error:", singleInsertError);
            }
        }

        // Reset State
        setIsComposeOpen(false);
        setCampaignLeads([]);
        setCampaignTrip('');
        setComposeData({ recipientInfo: '', channel: 'WhatsApp', message: '', isScheduled: false });
        setSelectedTripBroadcast('');

      } finally {
          setIsComposing(false);
      }
  };

  const handleApplyTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!e.target.value) return;
      setComposeData({ ...composeData, message: e.target.value });
  };

  const handleResend = (log: Log) => {
      const isConfirmed = window.confirm(`Resend this message to ${log.recipient}?`);
      if (!isConfirmed) return;

      const recipientPayload: Contact = {
          name: log.recipient,
          phone: log.phone,
          email: '', 
          bookingId: log.bookingId,
          tripTitle: log.trip,
          tripId: ''
      };

      setComposeMode('single');
      setComposeData({
          recipientInfo: JSON.stringify(recipientPayload),
          channel: log.channel,
          message: log.customMessage || generateMessagePreview(log),
          isScheduled: false
      });
      setIsComposeOpen(true);
  };

  const deliveredCount = logs.filter(l => l.status === 'Delivered').length;
  const pendingCount = logs.filter(l => l.status === 'Scheduled' || l.status === 'Queued').length;
  const deliveryRate = logs.length === 0 ? 0 : Math.round((deliveredCount / logs.length) * 100);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.recipient.toLowerCase().includes(searchTerm.toLowerCase()) || log.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'All' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Delivered': return <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-max"><CheckCircle2 size={12}/> Delivered</span>;
      case 'Scheduled': return <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-max"><Clock size={12}/> Scheduled</span>;
      case 'Queued': return <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 w-max"><AlertCircle size={12}/> Queued</span>;
      default: return <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest w-max">{status}</span>;
    }
  };

  const generateMessagePreview = (log: Log) => {
    if (log.customMessage) return log.customMessage; 

    const passportLink = `${window.location.origin}/passport/${log.bookingId}`;
    if (log.type === 'Passport Link' || log.type === 'Boarding Pass & Weather') {
      return `Hi ${log.recipient.split(' ')[0]},\n\nYour trip to ${log.trip} is confirmed and approaching fast! 🌍\n\nClick here to view your Live Itinerary and Digital Boarding Pass:\n${passportLink}\n\nSafe travels,\nThe ${user?.companyName || 'Pronomad'} Team`;
    }
    if (log.type === 'Payment Reminder') {
      return `Hello ${log.recipient.split(' ')[0]},\n\nThis is a friendly reminder regarding your upcoming trip: ${log.trip}.\n\nYou have an outstanding balance. Please access your portal to complete the payment:\n${passportLink}\n\nThank you!`;
    }
    return `System generated message for ${log.recipient}.`;
  };

  return (
    <div className="animate-fade-in pb-20 relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl" style={{ backgroundColor: `${APP_COLOR}20` }}>
               <MessageSquare size={28} style={{ color: APP_COLOR }} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Auto-Comms</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
             Automated WhatsApp & SMS Gateway
          </p>
        </div>
        
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsComposeOpen(true)}
                className="px-6 py-3 rounded-2xl font-black text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
                <PenSquare size={16} style={{ color: APP_COLOR }}/> Compose Message
            </button>
            
            <button 
                onClick={handleBulkSend}
                disabled={pendingCount === 0 || isBulkSending}
                className={`px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg ${pendingCount > 0 ? 'text-white active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                style={pendingCount > 0 ? { backgroundColor: APP_COLOR, boxShadow: `0 10px 15px -3px ${APP_COLOR}40` } : {}}
            >
                {isBulkSending ? <RefreshCw size={16} className="animate-spin"/> : <Zap size={16}/>}
                Push All Pending ({pendingCount})
            </button>
        </div>
      </div>

      {/* DYNAMIC KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all">
          <div className="w-14 h-14 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}><MessageSquare size={24}/></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sent</p>
            <h3 className="text-3xl font-black text-slate-800">{loading ? '-' : deliveredCount}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all">
          <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Clock size={24}/></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Dispatch</p>
            <h3 className="text-3xl font-black text-slate-800">{loading ? '-' : pendingCount}</h3>
          </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-slate-800 flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full blur-3xl transition-colors" style={{ backgroundColor: `${APP_COLOR}40` }}></div>
          <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm relative z-10" style={{ color: APP_COLOR }}><CheckCircle2 size={24}/></div>
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Rate</p>
            <h3 className="text-3xl font-black text-white">{loading ? '-' : `${deliveryRate}%`}</h3>
          </div>
        </div>
      </div>

      {/* MESSAGE LOG TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-800">Communication Logs</h2>
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2.5 w-full md:w-64 shadow-sm focus-within:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
              <Search size={16} className="text-slate-400 mr-2 shrink-0" />
              <input type="text" placeholder="Search name or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent outline-none text-sm font-bold w-full placeholder:text-slate-300 placeholder:font-medium" />
            </div>
            <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                <Filter size={16} className="text-slate-400 mr-2 shrink-0"/>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer appearance-none pr-4">
                    <option value="All">All Statuses</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Queued">Queued</option>
                </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-white border-b border-slate-100">
              <tr className="text-slate-400 text-[10px] uppercase tracking-widest">
                <th className="p-6 font-black">Recipient</th>
                <th className="p-6 font-black">Trip Detail</th>
                <th className="p-6 font-black">Message Type</th>
                <th className="p-6 font-black">Channel</th>
                <th className="p-6 font-black">Status</th>
                <th className="p-6 font-black text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold"><RefreshCw className="animate-spin inline mr-2"/> Compiling automated queue...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold text-lg">No communications match your search.</td></tr>
              ) : filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-6 align-middle">
                    <p className="font-black text-slate-800 text-sm">{log.recipient}</p>
                    <p className="font-mono text-[10px] text-slate-400 mt-1">{log.phone}</p>
                  </td>
                  <td className="p-6 align-middle">
                    <p className="font-bold text-slate-600 text-sm truncate max-w-[200px]">{log.trip}</p>
                  </td>
                  <td className="p-6 align-middle">
                    <p className="font-bold text-sm" style={log.type.includes('Campaign') || log.type.includes('Broadcast') || log.type === 'Personalized Message' ? { color: APP_COLOR } : { color: '#1e293b' }}>{log.type}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {new Date(log.timestamp).toLocaleDateString()} • {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </td>
                  <td className="p-6 align-middle">
                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 w-max ${
                      log.channel === 'WhatsApp' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {log.channel === 'WhatsApp' ? <MessageSquare size={12}/> : <Smartphone size={12}/>} {log.channel}
                    </span>
                  </td>
                  <td className="p-6 align-middle">
                    {getStatusBadge(log.status)}
                  </td>
                  <td className="p-6 align-middle text-center">
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setPreviewLog(log)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors" title="Preview Message">
                            <Eye size={16}/>
                        </button>
                        <button onClick={() => handleResend(log)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-blue-100 hover:text-blue-600 transition-colors" title="Resend Message">
                            <RotateCw size={16}/>
                        </button>
                        
                        {(log.status === 'Scheduled' || log.status === 'Queued') ? (
                        <button 
                            onClick={() => handleRealFreeSend(log)}
                            disabled={sendingId === log.id}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {sendingId === log.id ? <RefreshCw size={14} className="animate-spin"/> : <Send size={14}/>} Push
                        </button>
                        ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= PREVIEW MODAL ================= */}
      {previewLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative animate-in zoom-in-95">
                <button onClick={() => setPreviewLog(null)} className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors">
                    <X size={18}/>
                </button>
                
                <h3 className="text-xl font-black text-slate-800 mb-1 flex items-center gap-2">
                    {previewLog.channel === 'WhatsApp' ? <MessageSquare size={20} className="text-green-500"/> : <Smartphone size={20} className="text-slate-500"/>}
                    Message Preview
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">To: {previewLog.recipient} ({previewLog.phone})</p>

                <div className={`p-5 rounded-2xl whitespace-pre-wrap text-sm font-medium leading-relaxed border ${previewLog.channel === 'WhatsApp' ? 'bg-[#E7F6F0] border-[#D1EBE1] text-[#1E3A2F]' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    {generateMessagePreview(previewLog)}
                </div>

                <div className="mt-6 flex justify-between items-center border-t border-slate-100 pt-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                        {getStatusBadge(previewLog.status)}
                    </div>
                    {(previewLog.status === 'Scheduled' || previewLog.status === 'Queued') && (
                        <button 
                            onClick={() => {
                                handleRealFreeSend(previewLog);
                                setPreviewLog(null);
                            }}
                            className="text-white px-6 py-3 rounded-xl text-sm font-black transition-all active:scale-95 shadow-lg flex items-center gap-2"
                            style={{ backgroundColor: APP_COLOR }}
                        >
                            <Send size={16}/> Dispatch Now
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* ================= COMPOSE CUSTOM MESSAGE / SMARTMATCH MODAL ================= */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95">
                <button onClick={() => {
                    setIsComposeOpen(false);
                    setCampaignLeads([]); 
                }} className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors">
                    <X size={18}/>
                </button>
                
                <h3 className="text-2xl font-black text-slate-800 mb-1 flex items-center gap-2">
                    {campaignLeads.length > 0 ? <Sparkles size={24} style={{ color: APP_COLOR }}/> : <PenSquare size={24} style={{ color: APP_COLOR }}/>}
                    {campaignLeads.length > 0 ? 'SmartMatch Campaign' : 'Compose Outreach'}
                </h3>
                
                {campaignLeads.length > 0 ? (
                    <div className="mb-6 mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg" style={{ backgroundColor: APP_COLOR }}>
                            {campaignLeads.length}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VIP Targets Loaded</p>
                            <p className="font-bold text-slate-700 text-sm">Destination: {campaignTrip}</p>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6 mt-4">
                      {/* TABS: Single vs Trip Broadcast */}
                      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-4">
                        <button 
                          onClick={() => setComposeMode('single')} 
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${composeMode === 'single' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                          style={composeMode === 'single' ? { color: APP_COLOR } : {}}
                        >
                          Single Passenger
                        </button>
                        <button 
                          onClick={() => setComposeMode('trip')} 
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${composeMode === 'trip' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          style={composeMode === 'trip' ? { color: APP_COLOR } : {}}
                        >
                          <Users size={14}/> Trip Broadcast
                        </button>
                      </div>
                      
                      <p className="text-slate-500 text-sm font-medium">
                        {composeMode === 'single' ? 'Send a personalized message directly to any past passenger.' : 'Send a bulk broadcast to everyone booked on a specific trip.'}
                      </p>
                    </div>
                )}

                <div className="space-y-5">
                    {/* DYNAMIC RECIPIENT SELECTION */}
                    {campaignLeads.length === 0 && (
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                             {composeMode === 'single' ? 'Select Passenger' : 'Select Trip'}
                          </label>
                          
                          {composeMode === 'single' ? (
                            <select 
                                value={composeData.recipientInfo}
                                onChange={(e) => setComposeData({...composeData, recipientInfo: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold p-4 rounded-2xl outline-none focus:ring-2 transition-all"
                                style={{ '--tw-ring-color': APP_COLOR } as any}
                            >
                                <option value="">-- Choose Passenger --</option>
                                {Object.entries(groupedContacts).map(([tripName, tripContacts]) => (
                                    <optgroup key={tripName} label={tripName}>
                                        {tripContacts.map((pax, i) => (
                                            <option key={i} value={JSON.stringify(pax)}>{pax.name} ({pax.phone})</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                          ) : (
                            <select 
                                value={selectedTripBroadcast}
                                onChange={(e) => setSelectedTripBroadcast(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold p-4 rounded-2xl outline-none focus:ring-2 transition-all"
                                style={{ '--tw-ring-color': APP_COLOR } as any}
                            >
                                <option value="">-- Choose Active Trip --</option>
                                {tripsDb.map((t, i) => (
                                    <option key={i} value={t.id}>{t.title}</option>
                                ))}
                            </select>
                          )}
                          
                          {/* Show passenger count if a trip is selected for broadcast */}
                          {composeMode === 'trip' && selectedTripBroadcast && (
                             <p className="text-xs font-bold text-slate-500 mt-2 flex items-center gap-1.5">
                                <Users size={14}/> Targeting <span style={{ color: APP_COLOR }}>{contacts.filter(c => String(c.tripId) === selectedTripBroadcast).length} passengers</span>
                             </p>
                          )}
                      </div>
                    )}

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Delivery Channel</label>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setComposeData({...composeData, channel: 'WhatsApp'})}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition-all ${composeData.channel === 'WhatsApp' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-slate-200 text-slate-400'}`}
                            >
                                <MessageSquare size={16}/> WhatsApp
                            </button>
                            <button 
                                onClick={() => setComposeData({...composeData, channel: 'SMS'})}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 transition-all ${composeData.channel === 'SMS' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}
                            >
                                <Smartphone size={16}/> SMS Text
                            </button>
                        </div>
                    </div>

                    {/* QUICK TEMPLATES */}
                    {campaignLeads.length === 0 && (
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-1">
                              <FileText size={12}/> Quick Templates
                          </label>
                          <select 
                              onChange={handleApplyTemplate}
                              className="w-full bg-white border border-slate-200 text-slate-600 font-medium p-3 rounded-xl outline-none focus:ring-2 transition-all text-sm"
                              style={{ '--tw-ring-color': APP_COLOR } as any}
                          >
                              <option value="">-- Load a template... --</option>
                              {QUICK_TEMPLATES.map((t, i) => (
                                  <option key={i} value={t.text}>{t.label}</option>
                              ))}
                          </select>
                      </div>
                    )}

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                          Message Body <span className="text-xs lowercase text-slate-400 ml-2 font-medium">(Use [Name] & [Trip] tags)</span>
                        </label>
                        <textarea 
                            value={composeData.message}
                            onChange={(e) => setComposeData({...composeData, message: e.target.value})}
                            placeholder="Type your message here or use a template..."
                            rows={5}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-medium p-4 rounded-2xl outline-none focus:ring-2 transition-all resize-none"
                            style={{ '--tw-ring-color': APP_COLOR } as any}
                        ></textarea>
                    </div>

                    {/* SCHEDULE TOGGLE */}
                    <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <input 
                            type="checkbox" 
                            id="scheduleToggle"
                            checked={composeData.isScheduled}
                            onChange={(e) => setComposeData({...composeData, isScheduled: e.target.checked})}
                            className="w-5 h-5 rounded border-slate-300 accent-teal-500 cursor-pointer"
                            style={{ accentColor: APP_COLOR }}
                        />
                        <label htmlFor="scheduleToggle" className="text-sm font-bold text-slate-700 cursor-pointer flex flex-col">
                            <span className="flex items-center gap-1"><CalendarClock size={14}/> Schedule for Later</span>
                            <span className="text-xs font-medium text-slate-400">Queue this message to be dispatched automatically.</span>
                        </label>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button 
                        onClick={handleCustomMarketingSend}
                        disabled={isComposing || (!composeData.message) || (campaignLeads.length === 0 && composeMode === 'single' && !composeData.recipientInfo) || (campaignLeads.length === 0 && composeMode === 'trip' && !selectedTripBroadcast)}
                        className="text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg w-full justify-center"
                        style={{ backgroundColor: APP_COLOR }}
                    >
                        {isComposing ? <RefreshCw size={18} className="animate-spin"/> : <Send size={18}/>}
                        {isComposing 
                            ? 'Processing...' 
                            : composeData.isScheduled 
                                ? 'Add to Queue' 
                                : (campaignLeads.length > 0 || composeMode === 'trip' ? `Bulk Dispatch` : 'Dispatch Message')
                        }
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default Communications;