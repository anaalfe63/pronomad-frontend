import React, { useState, useEffect } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom'; 
import { 
  Sparkles, Target, Users, ArrowRight, Search, History,
  Mail, Phone, Filter, CheckCircle2, AlertCircle, RefreshCw,
  Download, Send, Megaphone
} from 'lucide-react';

interface Trip { id: string; title: string; basePrice: number; }
interface Lead { 
  first_name: string; 
  last_name: string; 
  email: string; 
  phone: string; 
  total_trips: number; 
  lifetime_value: number; 
  matchScore: number; 
  reason: string; 
  contacted: boolean;
}

const SmartMatch: React.FC = () => {
  const { user } = useTenant();
  const navigate = useNavigate(); 
  
  // 🌟 DYNAMIC TENANT SETTINGS
  const APP_COLOR = user?.themeColor || '#6366f1'; 
  const BASE_CURRENCY = user?.currency || 'GHS';

  const [trips, setTrips] = useState<Trip[]>([]);
  //const [selectedTrip, setSelectedTrip] = useState<string>('');
  //const [leads, setLeads] = useState<Lead[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  //const [hasRun, setHasRun] = useState(false);

  // --- USE THIS (Session Persistence) ---
  const [selectedTrip, setSelectedTrip] = useState<string>(() => {
      return sessionStorage.getItem('pronomad_sm_trip') || '';
  });
  const [leads, setLeads] = useState<Lead[]>(() => {
      const saved = sessionStorage.getItem('pronomad_sm_leads');
      return saved ? JSON.parse(saved) : [];
  });
  const [hasRun, setHasRun] = useState<boolean>(() => {
      return sessionStorage.getItem('pronomad_sm_hasRun') === 'true';
  });

  // Automatically save to memory whenever the AI finishes running
  useEffect(() => {
      sessionStorage.setItem('pronomad_sm_trip', selectedTrip);
      sessionStorage.setItem('pronomad_sm_leads', JSON.stringify(leads));
      sessionStorage.setItem('pronomad_sm_hasRun', String(hasRun));
  }, [selectedTrip, leads, hasRun]);

  // 1. Fetch available trips to target
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        if (!user?.subscriberId) return;

        const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('subscriber_id', user.subscriberId);

        if (!error && data) {
          const mapped = data.map((t: any) => {
            const fin = typeof t.financials === 'string' ? JSON.parse(t.financials) : (t.financials || {});
            return { id: t.id, title: t.title, basePrice: Number(fin.adultPrice || fin.basePrice) || 0 };
          });
          setTrips(mapped);
        }
      } catch (e) { console.error("Trip Fetch Error:", e); }
    };
    fetchTrips();
  }, [user]);

  // 2. RUN THE AI PREDICTION 
  const runSmartMatch = async () => {
    if (!selectedTrip) return alert("Please select a target trip first.");
    if (!user?.subscriberId) return;
    
    setIsAnalyzing(true);
    setHasRun(false);
    
    const targetTripData = trips.find(t => String(t.id) === String(selectedTrip));
    const targetPrice = targetTripData?.basePrice || 0;

    try {
      const { data: bookings, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('subscriber_id', user.subscriberId);

      if (error) throw error;

      await new Promise(resolve => setTimeout(resolve, 1500)); 

      const customerProfiles: Record<string, { name: string, email: string, phone: string, total_trips: number, ltv: number }> = {};
      
      (bookings || []).forEach(b => {
          const raw = typeof b.raw_data === 'string' ? JSON.parse(b.raw_data) : (b.raw_data || {});
          
          const name = b.customer_name || raw?.leadTraveler?.firstName + ' ' + raw?.leadTraveler?.lastName || 'Unknown Guest';
          if (name === 'Unknown Guest') return;

          const email = b.email || b.customer_email || raw?.leadTraveler?.email || '';
          const phone = b.phone || b.customer_phone || raw?.leadTraveler?.phone || '';
          const amountPaid = Number(b.amount_paid) || Number(raw?.financials?.agreedPrice) || 0;
          
          const uniqueKey = email || phone || name.toLowerCase();

          if (!customerProfiles[uniqueKey]) {
              customerProfiles[uniqueKey] = { name, email, phone, total_trips: 0, ltv: 0 };
          }
          customerProfiles[uniqueKey].total_trips += 1;
          customerProfiles[uniqueKey].ltv += amountPaid;
      });

      const generatedLeads: Lead[] = [];

      for (const profile of Object.values(customerProfiles)) {
          if (profile.ltv <= 0) continue;

          let score = 50; 
          let reasons: string[] = [];

          const avgSpend = profile.ltv / profile.total_trips;
          if (targetPrice > 0 && avgSpend >= targetPrice * 0.8) {
              score += 25;
              reasons.push(`Historical average spend (${BASE_CURRENCY} ${avgSpend.toLocaleString()}) matches this trip's budget.`);
          } else if (targetPrice > 0 && avgSpend >= targetPrice * 0.5) {
              score += 10;
              reasons.push(`May require a payment plan. Average spend is lower than this trip's price.`);
          } else if (targetPrice > 0) {
              score -= 20; 
          }

          if (profile.total_trips > 3) {
              score += 20;
              reasons.push("Highly loyal VIP client (4+ past trips). Excellent conversion probability.");
          } else if (profile.total_trips > 1) {
              score += 10;
              reasons.push("Repeat customer. Highly familiar with your services.");
          }

          if (profile.email && profile.phone) {
              score += 5;
          } else {
              score -= 10;
              reasons.push("Missing contact information reduces outreach capability.");
          }

          score = Math.max(10, Math.min(score, 99)); 

          if (score >= 60) {
              const nameParts = profile.name.split(' ');
              generatedLeads.push({
                  first_name: nameParts[0],
                  last_name: nameParts.slice(1).join(' '),
                  email: profile.email || 'No Email',
                  phone: profile.phone || 'No Phone',
                  total_trips: profile.total_trips,
                  lifetime_value: profile.ltv,
                  matchScore: score,
                  reason: reasons[0] || "Algorithmic match based on booking history.",
                  contacted: false
              });
          }
      }

      generatedLeads.sort((a, b) => b.matchScore - a.matchScore);
      setLeads(generatedLeads);

    } catch (e: any) {
      console.error("SmartMatch Error:", e);
      alert(`Database Error: ${e.message || "Failed to analyze bookings."}`);
    } finally {
      setIsAnalyzing(false);
      setHasRun(true);
    }
  };

  // --- 3. EXPORT / ACTIONS ---
  const handleExportList = () => {
    if (leads.length === 0) return alert("No leads to export.");
    let csv = "First Name,Last Name,Email,Phone,Match Score,LTV,Reason\n";
    leads.forEach(l => {
        csv += `${l.first_name},${l.last_name},${l.email},${l.phone},${l.matchScore}%,${l.lifetime_value},"${l.reason}"\n`;
    });
    const link = document.createElement('a');
    link.href = encodeURI(`data:text/csv;charset=utf-8,${csv}`);
    link.download = `SmartMatch_Leads_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const toggleContacted = (index: number) => {
      const newLeads = [...leads];
      newLeads[index].contacted = !newLeads[index].contacted;
      setLeads(newLeads);
  };

  // 🟢 NEW FEATURE: SEND TO AUTO-COMM
  const handleTransferToAutoComm = () => {
    if (leads.length === 0) return alert("No leads available to transfer.");
    
    const validLeads = leads.filter(l => l.email !== 'No Email' || l.phone !== 'No Phone');
    
    if (validLeads.length === 0) {
        return alert("None of the generated leads have an Email or Phone number to contact.");
    }

    const tripData = trips.find(t => String(t.id) === String(selectedTrip));

    // Save payload to local storage as a bridge to the AutoComm module
    const payload = {
        source: 'SmartMatch',
        tripId: selectedTrip,
        tripTitle: tripData?.title || 'Upcoming Trip',
        targetLeads: validLeads
    };
    
    localStorage.setItem('pronomad_autocomm_target', JSON.stringify(payload));
    
    // Teleport the user directly to the Auto-Comm page
    navigate('/communications');
  };

  return (
    <div className="animate-fade-in pb-20 relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl" style={{ backgroundColor: `${APP_COLOR}20` }}>
               <Target size={28} style={{ color: APP_COLOR }} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">SmartMatch AI</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
             <Sparkles size={16} style={{ color: APP_COLOR }}/> Predictive Lead Generation & CRM
          </p>
        </div>
      </div>

      {/* AI TARGET SELECTOR */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden mb-10">
        <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-colors" style={{ backgroundColor: `${APP_COLOR}40` }}></div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-black uppercase tracking-widest mb-2 block" style={{ color: APP_COLOR }}>Select Upcoming Trip</label>
            <select 
              value={selectedTrip}
              onChange={(e) => setSelectedTrip(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white font-bold text-lg p-4 rounded-2xl outline-none focus:border-white transition-colors appearance-none cursor-pointer shadow-inner"
            >
              <option value=""> Choose an active trip to analyze </option>
              {trips.map(t => (
                <option key={t.id} value={t.id}>{t.title} {t.basePrice > 0 ? `(Target Budget: ${BASE_CURRENCY} ${t.basePrice.toLocaleString()})` : ''}</option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={runSmartMatch}
            disabled={!selectedTrip || isAnalyzing}
            className={`w-full md:w-auto px-10 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 shrink-0 ${
              !selectedTrip ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 
              isAnalyzing ? 'text-white animate-pulse' : 'text-white hover:brightness-110'
            }`}
            style={selectedTrip ? { backgroundColor: APP_COLOR, boxShadow: `0 10px 15px -3px ${APP_COLOR}40` } : {}}
          >
            {isAnalyzing ? (
              <><RefreshCw size={20} className="animate-spin"/> Analyzing DB...</>
            ) : (
              <><Sparkles size={20}/> Scan Database</>
            )}
          </button>
        </div>
      </div>

      {/* RESULTS AREA */}
      {isAnalyzing && (
        <div className="bg-white rounded-[2.5rem] p-16 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
           <div className="relative mb-6">
              <div className="w-20 h-20 border-4 rounded-full animate-spin" style={{ borderColor: `${APP_COLOR}30`, borderTopColor: APP_COLOR }}></div>
              <Target size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: APP_COLOR }}/>
           </div>
           <h3 className="text-2xl font-black text-slate-800 mb-2">Calculating Probability Algorithms...</h3>
           <p className="text-slate-500 font-medium max-w-md">SmartMatch is analyzing your entire booking history, calculating lifetime values, and scoring VIP matches based on spending habits.</p>
        </div>
      )}

      {hasRun && !isAnalyzing && (
        <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
             <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                 Sales Pipeline 
                 <span className="px-3 py-1 rounded-lg text-sm" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}>{leads.length} Hot Leads</span>
             </h2>
             <div className="flex flex-wrap justify-center gap-2 w-full md:w-auto">
                 <button onClick={handleExportList} className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors flex-1 md:flex-none">
                   <Download size={16}/> Export CSV
                 </button>
                 
                 {/* 🟢 THE NEW TRANSFER BUTTON */}
                 <button onClick={handleTransferToAutoComm} className="text-xs font-bold text-white px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md hover:brightness-110 flex-1 md:flex-none" style={{ backgroundColor: APP_COLOR }}>
                   <Megaphone size={16}/> Send to Auto-Comm
                 </button>
             </div>
          </div>

          {leads.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm text-center">
               <AlertCircle size={48} className="text-orange-400 mx-auto mb-4"/>
               <h3 className="text-xl font-black text-slate-800">No strong matches found.</h3>
               <p className="text-slate-500 mt-2">Try selecting a different trip. The AI requires more historical data to find matches for this specific price tier.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leads.map((lead, i) => (
                <div key={i} className={`bg-white rounded-[2rem] p-6 border-2 transition-all group relative overflow-hidden ${lead.contacted ? 'border-slate-200 opacity-70 grayscale-[30%]' : 'shadow-xl hover:-translate-y-1'}`} style={!lead.contacted ? { borderColor: `${APP_COLOR}20` } : {}}>
                  
                  {/* Match Score Badge */}
                  <div className="absolute top-6 right-6 flex flex-col items-end">
                    <span className={`text-3xl font-black ${lead.contacted ? 'text-slate-400' : ''}`} style={!lead.contacted ? { color: APP_COLOR } : {}}>{lead.matchScore}%</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Match Score</span>
                  </div>

                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black mb-4 ${lead.contacted ? 'bg-slate-200 text-slate-500' : ''}`} style={!lead.contacted ? { backgroundColor: `${APP_COLOR}20`, color: APP_COLOR } : {}}>
                    {lead.first_name.charAt(0)}{lead.last_name.charAt(0)}
                  </div>
                  
                  <h3 className="text-xl font-black text-slate-800 truncate pr-16">{lead.first_name} {lead.last_name}</h3>
                  <div className="flex gap-4 mt-1 mb-4">
                      <p className="text-xs font-bold text-slate-400 flex items-center gap-1">LTV: <span className="font-black" style={{ color: APP_COLOR }}>{BASE_CURRENCY} {Number(lead.lifetime_value).toLocaleString()}</span></p>
                      <p className="text-xs font-bold text-slate-400 flex items-center gap-1"><History size={12}/> {lead.total_trips} Past Trips</p>
                  </div>

                  <div className={`p-4 rounded-xl border mb-6 text-xs font-bold leading-relaxed flex items-start gap-2 ${lead.contacted ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-50'}`} style={!lead.contacted ? { borderColor: `${APP_COLOR}30`, color: '#334155' } : {}}>
                    <Sparkles size={14} className="shrink-0 mt-0.5" style={!lead.contacted ? { color: APP_COLOR } : {}}/>
                    {lead.reason}
                  </div>

                  <div className="flex gap-2">
                    <a href={`mailto:${lead.email}`} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors">
                      <Mail size={14}/> {lead.email.includes('@') ? 'Email' : 'N/A'}
                    </a>
                    <a href={`tel:${lead.phone}`} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors">
                      <Phone size={14}/> Call
                    </a>
                    <button 
                      onClick={() => toggleContacted(i)} 
                      className={`w-12 flex items-center justify-center rounded-xl transition-colors ${lead.contacted ? 'text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`} 
                      style={lead.contacted ? { backgroundColor: APP_COLOR } : {}}
                      title="Mark as Contacted"
                    >
                        <CheckCircle2 size={16}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default SmartMatch;