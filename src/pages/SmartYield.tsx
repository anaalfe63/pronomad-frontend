import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, Zap, ArrowUpRight, ArrowDownRight, 
  CheckCircle2, AlertTriangle, BarChart3, DollarSign, 
  Percent, Sparkles, RefreshCw, Send, Lock, CloudOff, CloudUpload, Edit2, AlertCircle
} from 'lucide-react';

// --- TYPES ---
interface TripData {
  id: string | number;
  title: string;
  capacity: number;
  passengers: number;
  basePrice: number;
  startDate: string;
  rawFinancials: any; 
}

interface PriceUpdate {
  id: string | number;
  newPrice: number;
  type: 'surge' | 'discount' | 'manual';
}

interface SyncAction {
  id: number;
  table: string;
  action: 'UPDATE';
  recordId: string | number;
  payload: any;
}

const SmartYield: React.FC = () => {
  // 🌟 FIX: Added `settings` to the destructuring!
  const { user, settings } = useTenant();
  
  // 🌟 FIX: Pulled currency and color from `settings` instead of `user`
  const APP_COLOR = settings?.theme_color || '#10b981'; 
  const BASE_CURRENCY = settings?.currency || 'GHS';

  const [trips, setTrips] = useState<TripData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stagedUpdates, setStagedUpdates] = useState<PriceUpdate[]>([]);
  
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<SyncAction[]>(() => {
     const saved = localStorage.getItem('pronomad_yield_sync');
     return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const isAuthorized = user?.role === 'CEO' || user?.role === 'owner' || user?.role === 'PROADMIN';

  useEffect(() => { localStorage.setItem('pronomad_yield_sync', JSON.stringify(pendingSyncs)); }, [pendingSyncs]);

  const processSyncQueue = useCallback(async () => {
      if (!navigator.onLine || pendingSyncs.length === 0 || isSyncing) return;
      setIsSyncing(true);
      const remaining = [...pendingSyncs];

      for (const task of pendingSyncs) {
          try {
              if (task.action === 'UPDATE') {
                  const { error } = await supabase.from(task.table).update(task.payload).eq('id', task.recordId);
                  if (error) throw error;
              }
              remaining.shift();
          } catch (e) {
              console.error("Yield Sync failed:", task.id, e);
              break; 
          }
      }
      setPendingSyncs(remaining);
      setIsSyncing(false);
      if (remaining.length === 0) fetchTrips(); 
  }, [pendingSyncs, isSyncing]);

  useEffect(() => {
      const handleOnline = () => { setIsOnline(true); processSyncQueue(); };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      const syncInterval = setInterval(processSyncQueue, 30000);
      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
          clearInterval(syncInterval);
      };
  }, [processSyncQueue]);

  // --- FETCH LIVE DATA ---
  const fetchTrips = async () => {
    if (!user?.subscriberId) return;
    setLoading(true);
    try {
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('id, title, capacity, start_date, financials')
        .eq('subscriber_id', user.subscriberId);

      if (tripsError) throw tripsError;

      if (tripsData) {
         const tripIds = tripsData.map(t => t.id);
         let paxCounts: Record<string, number> = {};
         
         if (tripIds.length > 0) {
             const { data: paxData } = await supabase.from('passengers').select('trip_id').in('trip_id', tripIds);
             if (paxData) {
                 paxData.forEach(pax => { paxCounts[pax.trip_id] = (paxCounts[pax.trip_id] || 0) + 1; });
             }
         }

         const mappedTrips = tripsData.map((t: any) => {
           const fin = typeof t.financials === 'string' ? JSON.parse(t.financials) : (t.financials || {});
           return {
             id: t.id,
             title: t.title,
             capacity: Number(t.capacity) || 1, 
             passengers: paxCounts[t.id] || 0,
             // Look for adultPrice, fallback to basePrice, fallback to 0
             basePrice: Number(fin.adultPrice) || Number(fin.basePrice) || 0,
             startDate: t.start_date,
             rawFinancials: fin
           };
         });
         setTrips(mappedTrips);
      }
    } catch (e) { console.error("SmartYield Fetch Error:", e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { if (isAuthorized) fetchTrips(); }, [user, isAuthorized]);

  // --- 🧠 UPGRADED AI ENGINE ---
  const opportunities = useMemo(() => {
    if (!trips.length) return [];
    const opps: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    trips.forEach(trip => {
      if (stagedUpdates.find(p => p.id === trip.id)) return; 
      if (trip.basePrice <= 0) return; // 🛑 AI IGNORING TRIP: No price set!

      const fillRate = (trip.passengers / trip.capacity) * 100;
      let tripDate = trip.startDate ? new Date(trip.startDate) : new Date();
      if (isNaN(tripDate.getTime())) return;

      const daysRemaining = Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Skip past trips
      if (daysRemaining < 0) return;

      // 🟢 RULE 1: HIGH DEMAND SURGE (> 50% full & > 7 days left)
      if (fillRate >= 50 && daysRemaining > 7) {
        const suggestedPrice = Math.round(trip.basePrice * 1.15); // +15%
        const impact = (suggestedPrice - trip.basePrice) * (trip.capacity - trip.passengers);
        opps.push({
          id: trip.id, trip: trip.title, type: 'surge',
          reason: `High velocity. ${Math.round(fillRate)}% capacity reached with ${daysRemaining} days left.`,
          currentPrice: trip.basePrice, suggestedPrice, impact: `+ ${BASE_CURRENCY} ${impact.toLocaleString()}`,
          actionText: 'Execute +15% Surge'
        });
      }
      
      // 🟢 RULE 2: EARLY BIRD PROMO (Empty & > 60 days away)
      else if (fillRate < 20 && daysRemaining >= 60) {
        const suggestedPrice = Math.round(trip.basePrice * 0.90); // -10%
        opps.push({
          id: trip.id, trip: trip.title, type: 'discount',
          reason: `Early Bird window. Trip is ${daysRemaining} days away. Stimulate early bookings.`,
          currentPrice: trip.basePrice, suggestedPrice, impact: 'Secure Baseline Revenue',
          actionText: 'Execute -10% Early Bird'
        });
      }

      // 🟢 RULE 3: LAST MINUTE PANIC (< 50% full & < 7 days left)
      else if (fillRate < 50 && daysRemaining <= 7) {
        const suggestedPrice = Math.round(trip.basePrice * 0.75); // -25%
        opps.push({
          id: trip.id, trip: trip.title, type: 'discount',
          reason: `CRITICAL: Departs in ${daysRemaining} days and is only ${Math.round(fillRate)}% full!`,
          currentPrice: trip.basePrice, suggestedPrice, impact: 'Fill Empty Seats Immediately',
          actionText: 'Execute -25% Fire Sale'
        });
      }

      // 🟢 RULE 4: LOW VELOCITY DISCOUNT (< 40% full & < 60 days left)
      else if (fillRate <= 40 && daysRemaining < 60 && daysRemaining > 7) {
        const suggestedPrice = Math.round(trip.basePrice * 0.85); // -15%
        opps.push({
          id: trip.id, trip: trip.title, type: 'discount',
          reason: `Booking stalled. Only ${Math.round(fillRate)}% booked with ${daysRemaining} days remaining.`,
          currentPrice: trip.basePrice, suggestedPrice, impact: 'Revive Booking Velocity',
          actionText: 'Execute -15% Flash Sale'
        });
      }
    });

    return opps;
  }, [trips, stagedUpdates, BASE_CURRENCY]);

  // --- STAGING & SYNC ACTIONS ---
  const handleStageUpdate = (id: string | number, newPrice: number, type: 'surge' | 'discount' | 'manual') => {
    setStagedUpdates([...stagedUpdates, { id, newPrice, type }]);
  };

  const handleManualOverride = (trip: TripData) => {
      const newPriceStr = window.prompt(`Enter new target price for ${trip.title} (${BASE_CURRENCY}):`, trip.basePrice.toString());
      if (!newPriceStr) return;
      const newPrice = Number(newPriceStr);
      if (isNaN(newPrice) || newPrice <= 0) return alert("Invalid price.");
      
      const type = newPrice > trip.basePrice ? 'surge' : 'discount';
      handleStageUpdate(trip.id, newPrice, type);
  };

  const handleSyncToOperations = async () => {
    if (stagedUpdates.length === 0) return;
    setIsSyncing(true);
    
    try {
      if (!navigator.onLine) throw new Error("Offline");

      for (const update of stagedUpdates) {
          const trip = trips.find(t => t.id === update.id);
          if (!trip) continue;

          const updatedFinancials = {
              ...trip.rawFinancials,
              adultPrice: update.newPrice,
              basePrice: update.newPrice 
          };

          const { error } = await supabase.from('trips').update({ financials: updatedFinancials }).eq('id', update.id);
          if (error) throw error;
      }

      setStagedUpdates([]);
      fetchTrips(); 
    } catch (e) { 
      stagedUpdates.forEach(update => {
          const trip = trips.find(t => t.id === update.id);
          if (trip) {
              setPendingSyncs(prev => [...prev, {
                  id: Date.now() + Math.random(), table: 'trips', action: 'UPDATE', recordId: update.id, 
                  payload: { financials: { ...trip.rawFinancials, adultPrice: update.newPrice, basePrice: update.newPrice } }
              }]);
          }
      });
      setStagedUpdates([]);
      alert("Saved offline. Will push to Live Booking Engine when connection is restored.");
    } finally { 
      setIsSyncing(false); 
    }
  };

  const activeTripsCount = trips.length;
  const projectedLift = stagedUpdates.reduce((sum, update) => {
      const trip = trips.find(t => t.id === update.id);
      if (trip && update.type === 'surge') {
          return sum + ((update.newPrice - trip.basePrice) * (trip.capacity - trip.passengers));
      }
      return sum;
  }, 0);

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-in fade-in">
        <div className="w-24 h-24 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner"><Lock size={40}/></div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Executive Access Required</h2>
        <p className="text-slate-500 font-medium mt-2 max-w-md text-center">SmartYield Dynamic Pricing is restricted to the CEO/Owner role due to its direct impact on company revenue and margins.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20 relative">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-10 gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 rounded-xl" style={{ backgroundColor: `${APP_COLOR}20` }}>
               <TrendingUp size={28} style={{ color: APP_COLOR }} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">SmartYield</h1>
            {pendingSyncs.length > 0 ? (
                 <div className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest cursor-pointer" onClick={processSyncQueue}>
                    {isSyncing ? <RefreshCw size={14} className="animate-spin"/> : <CloudOff size={14}/>}
                    {pendingSyncs.length} DB Syncs Pending
                 </div>
             ) : (
                 <div className="flex items-center gap-1 text-slate-300" title="Cloud Synced">
                    <CloudUpload size={20}/>
                 </div>
             )}
          </div>
          <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
             <Sparkles size={16} style={{ color: APP_COLOR }}/> AI Dynamic Pricing & Revenue Optimization
          </p>
        </div>
        
        {/* Sync Controls */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-xl shadow-slate-900/20">
              <div className="relative flex h-3 w-3">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${loading ? 'bg-orange-400 animate-ping' : ''}`} style={!loading ? { backgroundColor: APP_COLOR } : {}}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${loading ? 'bg-orange-500' : ''}`} style={!loading ? { backgroundColor: APP_COLOR } : {}}></span>
              </div>
              <span className="text-xs font-black text-white uppercase tracking-widest">{loading ? 'Scanning DB...' : 'Engine Active'}</span>
          </div>

          <button 
            onClick={handleSyncToOperations} 
            disabled={stagedUpdates.length === 0 || isSyncing}
            className={`px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-lg ${stagedUpdates.length > 0 ? 'text-white animate-pulse' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            style={stagedUpdates.length > 0 ? { backgroundColor: APP_COLOR, boxShadow: `0 10px 15px -3px ${APP_COLOR}40` } : {}}
          >
            {isSyncing ? <RefreshCw size={18} className="animate-spin"/> : <Send size={18}/>}
            Push to Live Engine ({stagedUpdates.length})
          </button>
        </div>
      </div>

      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full blur-3xl transition-colors" style={{ backgroundColor: `${APP_COLOR}20` }}></div>
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Simulated Lift (Staged)</p>
                    <h3 className="text-4xl font-black text-slate-800"><span className="text-xl text-slate-400 mr-1">{BASE_CURRENCY}</span>{projectedLift.toLocaleString()}</h3>
                </div>
                <div className="p-3 rounded-2xl" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}><DollarSign size={24}/></div>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm font-bold w-fit px-3 py-1 rounded-lg" style={{ backgroundColor: `${APP_COLOR}10`, color: APP_COLOR }}>
                <ArrowUpRight size={16}/> Margin Protected
            </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-50 rounded-full blur-3xl group-hover:bg-blue-100 transition-colors"></div>
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pending Adjustments</p>
                    <h3 className="text-4xl font-black text-slate-800">{stagedUpdates.length} <span className="text-xl text-slate-400 font-medium">Trips</span></h3>
                </div>
                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><Zap size={24}/></div>
            </div>
            <div className="mt-6 flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
                Awaiting executive sync
            </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full blur-3xl transition-colors" style={{ backgroundColor: `${APP_COLOR}30` }}></div>
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: APP_COLOR }}>Active Monitored Trips</p>
                    <h3 className="text-4xl font-black text-white">{activeTripsCount}</h3>
                </div>
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm" style={{ color: APP_COLOR }}><BarChart3 size={24}/></div>
            </div>
            <div className="mt-6 w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="w-full h-full rounded-full animate-pulse" style={{ backgroundColor: APP_COLOR }}></div>
            </div>
            <p className="text-[10px] font-bold text-slate-400 mt-2 text-right">AI Scanning 24/7</p>
        </div>
      </div>

      {/* AI ACTION CENTER */}
      <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  AI Action Center
                  {opportunities.length > 0 && (
                      <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                          {opportunities.length} Action{opportunities.length !== 1 && 's'} Required
                      </span>
                  )}
              </h2>
          </div>

          {loading ? (
              <div className="bg-white rounded-[3rem] p-16 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                  <RefreshCw size={40} className="animate-spin mb-4" style={{ color: APP_COLOR }}/>
                  <h3 className="text-xl font-black text-slate-800">Scanning Trip Database...</h3>
              </div>
          ) : opportunities.length === 0 ? (
              <div className="bg-white rounded-[3rem] p-16 text-center border-2 border-dashed border-slate-200 shadow-sm flex flex-col items-center justify-center transition-all">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}>
                      <CheckCircle2 size={40}/>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800">Pricing is Optimized</h3>
                  <p className="text-slate-500 font-medium mt-2 max-w-md">SmartYield AI is monitoring all trips in Operations. No immediate price adjustments are required.</p>
              </div>
          ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {opportunities.map((opp) => (
                      <div key={opp.id} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 flex flex-col relative overflow-hidden group animate-in zoom-in-95">
                          <div className={`absolute top-0 left-0 w-full h-1.5 ${opp.type === 'surge' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-orange-400 to-red-500'}`}></div>
                          
                          <div className="flex justify-between items-start mb-6">
                              <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${opp.type === 'surge' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                                  {opp.type === 'surge' ? <TrendingUp size={12}/> : <Percent size={12}/>}
                                  {opp.type === 'surge' ? 'High Demand Surge' : 'Low Velocity Drop'}
                              </span>
                          </div>

                          <h3 className="text-xl font-black text-slate-800 leading-tight mb-2 pr-4 truncate" title={opp.trip}>{opp.trip}</h3>
                          <p className="text-xs font-bold text-slate-500 leading-relaxed min-h-[40px] mb-6">{opp.reason}</p>

                          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-6 flex-1">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Cost</span>
                                  <span className="text-sm font-bold text-slate-400 line-through">{BASE_CURRENCY} {opp.currentPrice.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-end">
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${opp.type === 'surge' ? 'text-emerald-600' : 'text-orange-600'}`}>Suggested Yield</span>
                                  <span className={`text-3xl font-black ${opp.type === 'surge' ? 'text-emerald-600' : 'text-orange-600'}`}>{BASE_CURRENCY} {opp.suggestedPrice.toLocaleString()}</span>
                              </div>
                              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-500">Projected Impact:</span>
                                  <span className="text-xs font-black text-slate-800 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">{opp.impact}</span>
                              </div>
                          </div>

                          <button 
                              onClick={() => handleStageUpdate(opp.id, opp.suggestedPrice, opp.type)}
                              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                  opp.type === 'surge' 
                                      ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20' 
                                      : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'
                              }`}
                          >
                              <Zap size={18}/> {opp.actionText}
                          </button>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* TRIP YIELD PORTFOLIO (Live Database View) */}
      <div>
        <h2 className="text-2xl font-black text-slate-800 mb-6">Live Operations Portfolio</h2>
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr className="text-slate-400 text-[10px] uppercase tracking-widest">
                            <th className="p-6 font-black">Trip Details</th>
                            <th className="p-6 font-black w-1/4">Capacity Filled</th>
                            <th className="p-6 font-black">Current Trip Cost</th>
                            <th className="p-6 font-black text-center">Status / Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                              <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold">Loading Database...</td></tr>
                        ) : trips.length === 0 ? (
                              <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold">No trips found in Operations. Create a trip to enable AI tracking.</td></tr>
                        ) : trips.map((trip) => {
                            const pendingSync = stagedUpdates.find(p => p.id === trip.id);
                            const fillRate = Math.round((trip.passengers / trip.capacity) * 100);

                            return (
                            <tr key={trip.id} className={`hover:bg-slate-50 transition-colors ${pendingSync ? 'bg-teal-50/30' : ''}`}>
                                <td className="p-6 align-middle">
                                    <p className="font-black text-slate-800 text-sm">{trip.title}</p>
                                    <p className="font-mono text-[10px] text-slate-400 mt-1">{String(trip.id).slice(0,8)}</p>
                                </td>
                                <td className="p-6 align-middle pr-12">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-1000 ${fillRate > 75 ? 'bg-emerald-500' : fillRate < 30 ? 'bg-orange-400' : 'bg-blue-500'}`} style={{ width: `${Math.min(fillRate, 100)}%` }}></div>
                                        </div>
                                        <span className="text-xs font-black text-slate-600 min-w-[3ch]">{fillRate}%</span>
                                    </div>
                                </td>
                                <td className="p-6 align-middle">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-base font-bold ${pendingSync || trip.basePrice === 0 ? 'text-slate-400' : 'text-slate-700'} ${pendingSync ? 'line-through' : ''}`}>
                                            {trip.basePrice === 0 ? 'No Price Set' : `${BASE_CURRENCY} ${trip.basePrice.toLocaleString()}`}
                                        </span>
                                        {trip.basePrice === 0 && (
                                            <span title="Set an Adult Price in Operations for AI to track this trip.">
                                                <AlertCircle size={14} className="text-red-400" />
                                            </span>
                                        )}
                                        {pendingSync && (
                                            <span className="font-black flex items-center gap-1 px-2 py-0.5 rounded" style={{ color: APP_COLOR, backgroundColor: `${APP_COLOR}20` }}>
                                                {pendingSync.type === 'surge' ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} 
                                                {BASE_CURRENCY} {pendingSync.newPrice.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-6 align-middle text-center flex justify-center items-center gap-2">
                                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                        pendingSync ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 
                                        fillRate >= 100 ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {pendingSync ? 'Staged Update' : fillRate >= 100 ? 'Sold Out' : 'Monitoring'}
                                    </span>
                                    
                                    {!pendingSync && fillRate < 100 && trip.basePrice > 0 && (
                                      <button onClick={() => handleManualOverride(trip)} className="p-2 text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-200 rounded-lg transition-colors" title="Manual Price Override">
                                          <Edit2 size={14}/>
                                      </button>
                                    )}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

    </div>
  );
};

export default SmartYield;