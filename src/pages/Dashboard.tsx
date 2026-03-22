import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useSystemPresence from '../hooks/useSystemPresence';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase'; 
import { 
  TrendingUp, Users, AlertCircle, ArrowRight, Key, Plane, CheckCircle,
  Building2, BusFront, CalendarDays, MapPin, Wallet, Activity,
  Receipt, Map, Zap, RefreshCw, CreditCard, Briefcase, Globe, 
  Clock, ArrowUpRight, BarChart3, PieChart
} from 'lucide-react';

// --- TYPES & INTERFACES ---
interface DashboardStats {
  totalRevenue: number;
  cashInHand: number;
  outstandingBalance: number;
  pendingExpenses: number;
  activeStaff: number;
  activeTrips: number;
}

interface QuickSearchState {
  packageSearch: string;
  pax: number | string;
  date: string;
}

interface TopDestination {
  name: string;
  revenue: number;
  growth: string;
}

interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  type: 'booking' | 'expense' | 'trip' | 'system';
}

// Helper for formatting time ago
const timeAgo = (dateString: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)} secs ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hrs ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
};

const Dashboard: React.FC = () => {
  const { user } = useTenant() as any; 
  const navigate = useNavigate();

  const MY_SUBSCRIBER_ID = user?.subscriberId || user?.uid || "";
  useSystemPresence(MY_SUBSCRIBER_ID); 

  const [stats, setStats] = useState<DashboardStats>({ 
    totalRevenue: 0, cashInHand: 0, outstandingBalance: 0,
    pendingExpenses: 0, activeStaff: 0, activeTrips: 0
  });
  
  const [topDestinations, setTopDestinations] = useState<TopDestination[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [quickSearch, setQuickSearch] = useState<QuickSearchState>({
    packageSearch: '', pax: '', date: ''
  });

  // --- 🌟 FETCH LIVE DATA DIRECTLY FROM SUPABASE ---
  const fetchStats = async () => {
    if (!MY_SUBSCRIBER_ID) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const [
        { data: bookingsData },
        { data: expensesData },
        { count: staffCount },
        { count: tripsCount },
        { data: tripsData },
        { data: logsData }
      ] = await Promise.all([
        supabase.from('bookings').select('trip_id, total_cost, amount_paid').eq('subscriber_id', MY_SUBSCRIBER_ID),
        supabase.from('expenses').select('amount').eq('subscriber_id', MY_SUBSCRIBER_ID).in('status', ['Pending', 'pending']),
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('subscriber_id', MY_SUBSCRIBER_ID).neq('status', 'suspended'),
        supabase.from('trips').select('*', { count: 'exact', head: true }).eq('subscriber_id', MY_SUBSCRIBER_ID).in('status', ['Active', 'active', 'Published', 'published', 'Dispatched', 'dispatched']),
        supabase.from('trips').select('id, title').eq('subscriber_id', MY_SUBSCRIBER_ID),
        supabase.from('audit_logs').select('*').eq('subscriber_id', MY_SUBSCRIBER_ID).order('created_at', { ascending: false }).limit(5)
      ]);

      let totalRev = 0;
      let cash = 0;
      let pendingExp = 0;
      const tripRevenueMap: Record<string, number> = {};

      // Calculate Revenue & Cash Flow
      if (bookingsData) {
        bookingsData.forEach((b: any) => {
          totalRev += Number(b.total_cost || 0);
          cash += Number(b.amount_paid || 0);
          
          // Accumulate revenue for top destinations
          if (b.trip_id) {
             tripRevenueMap[b.trip_id] = (tripRevenueMap[b.trip_id] || 0) + Number(b.amount_paid || 0);
          }
        });
      }

      // Calculate Pending Expenses
      if (expensesData) {
        expensesData.forEach((e: any) => {
          pendingExp += Number(e.amount || 0);
        });
      }

      // Process Top Destinations
      const mappedDestinations = Object.entries(tripRevenueMap)
        .map(([tripId, rev]) => {
           const trip = tripsData?.find(t => String(t.id) === String(tripId));
           return {
              name: trip?.title || 'Custom Booking',
              revenue: rev,
              growth: 'Active' // Replace with historical calc if time-series data exists
           };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3); // Get Top 3

      // Process Audit Logs into Activity Feed
      const mappedActivity: ActivityItem[] = (logsData || []).map(log => {
         const lowerAction = log.action?.toLowerCase() || '';
         let type: ActivityItem['type'] = 'system';
         
         if (lowerAction.includes('book') || lowerAction.includes('payment')) type = 'booking';
         else if (lowerAction.includes('expense') || lowerAction.includes('invoice')) type = 'expense';
         else if (lowerAction.includes('trip') || lowerAction.includes('dispatch')) type = 'trip';

         return {
            id: log.id,
            user: log.user_name || 'System',
            action: log.action || 'performed an action',
            target: log.details || '',
            time: timeAgo(log.created_at),
            type: type
         };
      });

      setStats({
        totalRevenue: totalRev,
        cashInHand: cash,
        outstandingBalance: Math.max(0, totalRev - cash), 
        pendingExpenses: pendingExp,
        activeStaff: staffCount || 0,
        activeTrips: tripsCount || 0
      });
      
      setTopDestinations(mappedDestinations);
      setRecentActivity(mappedActivity);

    } catch (error) { 
      console.error("Failed to fetch live stats from Supabase", error); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchStats(); }, [MY_SUBSCRIBER_ID]);

  const handleJumpToBooking = () => { navigate('/booking', { state: { prefill: quickSearch } }); };

  return (
    <div className="animate-in fade-in duration-700 pb-20 relative">
      
      {/* ===================================================================== */}
      {/* 1. THE HERO SECTION (Premium SaaS Visuals)                              */}
      {/* ===================================================================== */}
      <div 
        className="relative rounded-[2.5rem] h-[500px] md:h-[600px] bg-cover bg-center overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.1)] mb-12"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=2074&auto=format&fit=crop')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-transparent"></div>
        <div className="absolute inset-0 bg-blue-900/20 mix-blend-multiply"></div>
        
        <div className="relative z-10 p-8 md:p-16 h-full flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white w-max mb-6">
            <Globe size={14} className="text-blue-300"/>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-4 leading-[1.1] drop-shadow-md">
            Welcome back, <br className="hidden md:block"/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">
              {user?.fullName?.split(' ')[0] || user?.name?.split(' ')[0] || 'Executive'}.
            </span>
          </h1>
          <p className="text-blue-50/80 text-lg md:text-xl font-medium max-w-xl leading-relaxed drop-shadow-sm mb-8">
            Your agency's performance at a glance. Manage revenue, dispatch fleets, and oversee operations from one unified dashboard.
          </p>

          <button onClick={() => window.scrollTo({ top: 500, behavior: 'smooth' })} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-black flex items-center gap-2 w-max shadow-[0_10px_30px_rgba(37,99,235,0.3)] transition-all active:scale-95">
            View Live Insights <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. FLOATING QUICK-ACTION CARD                                         */}
      {/* ===================================================================== */}
      <div className="relative z-20 max-w-6xl mx-auto -mt-28 md:-mt-36 px-4 md:px-8 mb-16">
        
        {/* Tabs */}
        <div className="flex gap-1 ml-4 md:ml-8 mb-0 translate-y-2">
          <button onClick={() => navigate('/booking')} className="bg-white px-6 md:px-8 py-3 md:py-4 rounded-t-2xl font-black text-slate-800 text-xs md:text-sm flex items-center gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10 relative hover:text-blue-600 transition-colors">
            <Plane size={18} className="text-blue-600"/> Book Trip
          </button>
          <button onClick={() => navigate('/suppliers')} className="bg-slate-900/70 backdrop-blur-md px-5 md:px-6 py-3 rounded-t-2xl font-bold text-white text-xs md:text-sm flex items-center gap-2 hover:bg-slate-900 transition-colors">
            <Building2 size={16} className="text-slate-400"/> Supplier
          </button>
          <button onClick={() => navigate('/fleet')} className="bg-slate-900/70 backdrop-blur-md px-5 md:px-6 py-3 rounded-t-2xl font-bold text-white text-xs md:text-sm flex items-center gap-2 hover:bg-slate-900 transition-colors">
            <BusFront size={16} className="text-slate-400"/> Fleet
          </button>
        </div>
        
        {/* Main Bar */}
        <div className="bg-white rounded-[2rem] rounded-tl-none shadow-[0_20px_60px_rgba(0,0,0,0.08)] p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 border border-slate-100 relative z-20">
            
            <div className="flex-1 w-full bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 transition-all border border-slate-200 rounded-[1.5rem] p-3 flex items-center gap-4 cursor-text">
               <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 text-slate-500 shrink-0"><MapPin size={20}/></div>
               <div className="w-full">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Package</p>
                 <input 
                    type="text" 
                    placeholder="Where to?" 
                    className="w-full bg-transparent outline-none text-sm font-bold text-slate-800"
                    value={quickSearch.packageSearch}
                    onChange={(e) => setQuickSearch({...quickSearch, packageSearch: e.target.value})}
                 />
               </div>
            </div>

            <div className="hidden md:block text-slate-300"><ArrowRight size={20}/></div>

            <div className="flex-1 w-full bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 transition-all border border-slate-200 rounded-[1.5rem] p-3 flex items-center gap-4 cursor-text">
               <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 text-slate-500 shrink-0"><Users size={20}/></div>
               <div className="w-full">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Passengers</p>
                 <input 
                    type="number" 
                    placeholder="e.g. 2" 
                    className="w-full bg-transparent outline-none text-sm font-bold text-slate-800"
                    value={quickSearch.pax}
                    onChange={(e) => setQuickSearch({...quickSearch, pax: e.target.value})}
                 />
               </div>
            </div>

            <div className="flex-1 w-full bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 transition-all border border-slate-200 rounded-[1.5rem] p-3 flex items-center gap-4 cursor-text">
               <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 text-slate-500 shrink-0"><CalendarDays size={20}/></div>
               <div className="w-full">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Travel Dates</p>
                 <input 
                    type="date" 
                    className="w-full bg-transparent outline-none text-sm font-bold text-slate-800"
                    value={quickSearch.date}
                    onChange={(e) => setQuickSearch({...quickSearch, date: e.target.value})}
                 />
               </div>
            </div>

            <button onClick={handleJumpToBooking} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-5 rounded-[1.5rem] font-black shadow-lg transition-transform active:scale-95 shrink-0 flex items-center justify-center gap-2">
              Launch <ArrowUpRight size={18} className="text-blue-400" />
            </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. EXECUTIVE KPI METRICS (Clean SaaS Style)                             */}
      {/* ===================================================================== */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Executive Summary</h2>
              <p className="text-slate-500 text-sm font-medium">Live financial and operational data.</p>
            </div>
            <button onClick={fetchStats} className="text-slate-400 hover:text-blue-600 bg-white p-2 rounded-full shadow-sm border border-slate-200 transition-colors" title="Refresh Live Data">
              <RefreshCw size={18} className={loading ? 'animate-spin text-blue-600' : ''}/>
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
          
          {/* 1. REVENUE (Total Invoiced) */}
          <div onClick={() => navigate('/finance-ledger')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 group-hover:bg-blue-600 transition-colors rounded-[1rem] text-blue-600 group-hover:text-white"><TrendingUp size={22} /></div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Billed Revenue</p>
            <h3 className="text-3xl font-black text-slate-900 truncate">
              {loading ? '...' : <><span className="text-lg text-slate-400 mr-1 font-medium">₵</span>{stats.totalRevenue?.toLocaleString()}</>}
            </h3>
          </div>

          {/* 2. CASH IN HAND (Paid Invoices) - Dark Accent Card */}
          <div onClick={() => navigate('/finance-ledger')} className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl"></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-3 bg-white/10 rounded-[1rem] text-emerald-400 backdrop-blur-md"><Wallet size={22} /></div>
            </div>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 relative z-10">Actual Cash Received</p>
            <h3 className="text-3xl font-black text-white relative z-10 truncate">
              {loading ? '...' : <><span className="text-lg text-emerald-400/50 mr-1 font-medium">₵</span>{stats.cashInHand?.toLocaleString()}</>}
            </h3>
          </div>

          {/* 3. RECEIVABLES */}
          <div onClick={() => navigate('/invoices')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 hover:shadow-md hover:border-amber-200 transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-amber-50 group-hover:bg-amber-500 transition-colors rounded-[1rem] text-amber-600 group-hover:text-white"><CreditCard size={22} /></div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Outstanding Receivables</p>
            <h3 className="text-3xl font-black text-slate-900 truncate">
              {loading ? '...' : <><span className="text-lg text-slate-400 mr-1 font-medium">₵</span>{stats.outstandingBalance?.toLocaleString()}</>}
            </h3>
          </div>

          {/* 4. EXPENSES (Pending Outflow) */}
          <div onClick={() => navigate('/expenses')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 hover:shadow-md hover:border-rose-200 transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-rose-50 group-hover:bg-rose-500 transition-colors rounded-[1rem] text-rose-600 group-hover:text-white"><Receipt size={22} /></div>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">Pending</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unpaid Expenses</p>
            <h3 className="text-3xl font-black text-rose-600 truncate">
               {loading ? '...' : <><span className="text-lg text-rose-300 mr-1 font-medium">₵</span>{stats.pendingExpenses?.toLocaleString()}</>}
            </h3>
          </div>

        </div>

        {/* ===================================================================== */}
        {/* 4. CEO GRID: OPERATIONS, ACTIVITY, & AI ENGINE                        */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* LEFT COLUMN: Operations & Performance */}
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">
              
              {/* Visual Cash Flow Bar */}
              <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-slate-900 text-lg flex items-center gap-2"><PieChart size={20} className="text-blue-500"/> Collection Rate</h3>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">YTD</span>
                  </div>
                  
                  {stats && stats.totalRevenue > 0 ? (
                      <div>
                          <div className="flex justify-between text-sm font-bold mb-3">
                              <span className="text-emerald-600 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Collected: {Math.round((stats.cashInHand / stats.totalRevenue) * 100)}%</span>
                              <span className="text-amber-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Pending: {Math.round((stats.outstandingBalance / stats.totalRevenue) * 100)}%</span>
                          </div>
                          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                              <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(stats.cashInHand / stats.totalRevenue) * 100}%` }}></div>
                              <div className="bg-amber-400 h-full transition-all duration-1000" style={{ width: `${(stats.outstandingBalance / stats.totalRevenue) * 100}%` }}></div>
                          </div>
                      </div>
                  ) : (
                      <p className="text-sm text-slate-500 font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">Not enough financial data to generate cash flow health.</p>
                  )}
              </div>

              {/* CEO Split: Top Destinations & Ops Pulse */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Ops Pulse */}
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all group cursor-pointer" onClick={() => navigate('/tour-operations')}>
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors"><Map size={20}/></div>
                          <div>
                              <p className="text-2xl font-black text-slate-900 leading-none">{loading ? '-' : stats?.activeTrips}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active Trips</p>
                          </div>
                      </div>
                      <ArrowUpRight className="text-slate-300 group-hover:text-blue-500 transition-colors"/>
                  </div>

                  <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all group cursor-pointer" onClick={() => navigate('/staff')}>
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Users size={20}/></div>
                          <div>
                              <p className="text-2xl font-black text-slate-900 leading-none">{loading ? '-' : stats?.activeStaff}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active Staff</p>
                          </div>
                      </div>
                      <ArrowUpRight className="text-slate-300 group-hover:text-indigo-500 transition-colors"/>
                  </div>
                </div>

                {/* Top Destinations */}
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
                  <h3 className="font-black text-slate-900 mb-4 flex items-center gap-2 text-sm"><BarChart3 size={18} className="text-blue-500"/> Top Packages</h3>
                  <div className="space-y-4">
                    {topDestinations.length > 0 ? topDestinations.map((dest, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-300 font-black text-lg w-4">{i + 1}</span>
                          <div>
                            <p className="text-sm font-bold text-slate-800 line-clamp-1 max-w-[120px]">{dest.name}</p>
                            <p className="text-xs text-slate-400 font-medium">₵{dest.revenue.toLocaleString()}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md">{dest.growth}</span>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400 font-medium text-center py-4">No package data available yet.</p>
                    )}
                  </div>
                </div>

              </div>
          </div>

          {/* RIGHT COLUMN: AI & Live Activity */}
          <div className="lg:col-span-1 space-y-6">
              
              {/* SmartYield Engine */}
              <div className="bg-slate-900 rounded-[2rem] p-8 shadow-xl relative overflow-hidden text-white border border-slate-800">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="flex items-center gap-2 mb-4 relative z-10">
                      <Zap size={20} className="text-blue-400 fill-blue-400 animate-pulse"/>
                      <h3 className="font-black tracking-widest uppercase text-[10px] text-blue-400">Nomad AI</h3>
                  </div>
                  <h4 className="text-2xl font-black mb-2 leading-tight relative z-10">Maximize your margins today.</h4>
                  <p className="text-slate-400 text-sm font-medium mb-6 relative z-10">SmartYield dynamically suggests pricing shifts based on your active metrics.</p>
                  <button onClick={() => navigate('/smartyield')} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-xl shadow-[0_10px_20px_rgba(37,99,235,0.2)] transition-all active:scale-95 text-xs uppercase tracking-wider relative z-10">
                      Open Engine
                  </button>
              </div>

              {/* CEO Live Activity Feed */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
                  <h3 className="font-black text-slate-900 mb-5 flex items-center gap-2 text-sm"><Clock size={18} className="text-slate-400"/> Live Activity</h3>
                  <div className="space-y-5 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {recentActivity.length > 0 ? recentActivity.map((activity, i) => (
                      <div key={i} className="relative flex items-start gap-4">
                        <div className={`w-2 h-2 mt-1.5 rounded-full ring-4 ring-white shrink-0 z-10
                          ${activity.type === 'booking' ? 'bg-blue-500' : 
                            activity.type === 'expense' ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        ></div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-medium text-slate-600 truncate">
                            <span className="font-bold text-slate-900">{activity.user}</span> {activity.action} <span className="font-bold text-slate-800">{activity.target}</span>
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{activity.time}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400 font-medium text-center py-4 relative z-10 bg-white">No recent system activity.</p>
                    )}
                  </div>
                  <button onClick={() => navigate('/audit-log')} className="w-full mt-6 py-3 border-t border-slate-100 text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors">
                    View Full Audit Log
                  </button>
              </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;