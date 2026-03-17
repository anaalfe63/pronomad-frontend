import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useSystemPresence from '../hooks/useSystemPresence';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase'; 
import { 
  TrendingUp, Users, AlertCircle, ArrowRight, Key, Plane, CheckCircle,
  Building2, BusFront, CalendarDays, MapPin, Wallet, Activity,
  Receipt, Map, Zap, RefreshCw, CreditCard, Briefcase
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

interface ActivityItemProps {
  text: string;
  time: string;
}

const Dashboard: React.FC = () => {
  // 1. Get the user FIRST
  const { user } = useTenant() as any; 
  const navigate = useNavigate();

  // 2. Define the ID
  const MY_SUBSCRIBER_ID = user?.subscriberId || user?.uid || "";

  // 3. NOW pass it into the presence hook!
  useSystemPresence(MY_SUBSCRIBER_ID); 

  // --- STATE FOR REAL DATA ---
  const [stats, setStats] = useState<DashboardStats>({ 
    totalRevenue: 0, cashInHand: 0, outstandingBalance: 0,
    pendingExpenses: 0, activeStaff: 0, activeTrips: 0
  });
  const [loading, setLoading] = useState<boolean>(true);

  // State for the Quick Search Bar
  const [quickSearch, setQuickSearch] = useState<QuickSearchState>({
    packageSearch: '', pax: 1, date: ''
  });

  // --- 🌟 FETCH LIVE DATA DIRECTLY FROM SUPABASE ---
  const fetchStats = async () => {
    if (!MY_SUBSCRIBER_ID) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      // Fire all 4 database queries simultaneously for maximum speed
      const [
        { data: bookingsData },
        { data: expensesData },
        { count: staffCount },
        { count: tripsCount }
      ] = await Promise.all([
        // 1. Get Revenue & Cash Flow from Bookings
        supabase.from('bookings').select('total_cost, amount_paid').eq('subscriber_id', MY_SUBSCRIBER_ID),
        // 2. Get Pending Expenses
        supabase.from('expenses').select('amount').eq('subscriber_id', MY_SUBSCRIBER_ID).in('status', ['Pending', 'pending']),
        // 3. Count Active Staff
        supabase.from('staff').select('*', { count: 'exact', head: true }).eq('subscriber_id', MY_SUBSCRIBER_ID).neq('status', 'suspended'),
        // 4. Count Active Trips
        supabase.from('trips').select('*', { count: 'exact', head: true }).eq('subscriber_id', MY_SUBSCRIBER_ID).in('status', ['Active', 'active', 'Published', 'published'])
      ]);

      // Calculate totals from the returned data
      let totalRev = 0;
      let cash = 0;
      let pendingExp = 0;

      if (bookingsData) {
        bookingsData.forEach((b: any) => {
          totalRev += Number(b.total_cost || 0);
          cash += Number(b.amount_paid || 0);
        });
      }

      if (expensesData) {
        expensesData.forEach((e: any) => {
          pendingExp += Number(e.amount || 0);
        });
      }

      // Update the UI
      setStats({
        totalRevenue: totalRev,
        cashInHand: cash,
        outstandingBalance: Math.max(0, totalRev - cash), // Ensure it doesn't drop below 0
        pendingExpenses: pendingExp,
        activeStaff: staffCount || 0,
        activeTrips: tripsCount || 0
      });

    } catch (error) { 
      console.error("Failed to fetch live stats from Supabase", error); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchStats(); }, [MY_SUBSCRIBER_ID]);

  // Handler to jump to booking
  const handleJumpToBooking = () => { navigate('/booking', { state: { prefill: quickSearch } }); };
  
  return (
    <div className="animate-fade-in pb-20 relative">
      
      {/* ===================================================================== */}
      {/* 1. THE HERO SECTION (Visuals)                                         */}
      {/* ===================================================================== */}
      <div 
        className="relative rounded-[2.5rem] h-[600px] bg-cover bg-center overflow-hidden shadow-lg border border-slate-200 mb-12"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?q=80&w=2070&auto=format&fit=crop')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent"></div>
        
        <div className="relative z-10 p-10 md:p-16 h-full flex flex-col pt-24">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4 leading-tight drop-shadow-md">
            Hey {user?.fullName?.split(' ')[0] || user?.name?.split(' ')[0] || 'Team'}! What are we <br className="hidden md:block"/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-emerald-100">Managing today?</span>
          </h1>
          <p onClick={() => window.scrollTo({ top: 500, behavior: 'smooth' })} className="text-teal-50 text-lg font-medium flex items-center gap-2 cursor-pointer hover:text-white transition-colors drop-shadow-md w-max mt-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm border border-white/20">
            <Activity size={18} className="animate-pulse text-teal-300" /> Explore Live Insights
          </p>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. FLOATING QUICK-ACTION CARD                                         */}
      {/* ===================================================================== */}
      <div className="relative z-20 max-w-6xl mx-auto -mt-36 px-4 md:px-8 mb-16">
        
        {/* Tabs */}
        <div className="flex gap-2 ml-6 mb-0 translate-y-2">
          <button onClick={() => navigate('/booking')} className="bg-white px-8 py-3.5 rounded-t-2xl font-black text-slate-800 text-sm flex items-center gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-10 relative hover:text-teal-600 transition-colors">
            <Plane size={18} className="text-teal-600"/> Book Trip
          </button>
          <button onClick={() => navigate('/suppliers')} className="bg-slate-900/60 backdrop-blur-md px-6 py-3 rounded-t-2xl font-bold text-white text-sm flex items-center gap-2 hover:bg-slate-900/80 hover:text-teal-300 transition-colors">
            <Building2 size={16} className="text-teal-400"/> Supplier
          </button>
          <button onClick={() => navigate('/fleet')} className="bg-slate-900/60 backdrop-blur-md px-6 py-3 rounded-t-2xl font-bold text-white text-sm flex items-center gap-2 hover:bg-slate-900/80 hover:text-teal-300 transition-colors">
            <BusFront size={16} className="text-teal-400"/> Fleet
          </button>
        </div>
        
        {/* Main Bar */}
        <div className="bg-white rounded-[2rem] rounded-tl-none shadow-[0_20px_60px_rgba(0,0,0,0.08)] p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 border border-white relative z-20">
            
            <div className="flex-1 w-full bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500 transition-all border border-slate-100 rounded-2xl p-3 flex items-center gap-4 cursor-text">
               <div className="bg-white p-2 rounded-xl shadow-sm text-teal-600 shrink-0"><MapPin size={20}/></div>
               <div className="w-full">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Package</p>
                 
               </div>
            </div>

            <div className="hidden md:block text-slate-300"><ArrowRight size={20}/></div>

            <div className="flex-1 w-full bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500 transition-all border border-slate-100 rounded-2xl p-3 flex items-center gap-4 cursor-text">
               <div className="bg-white p-2 rounded-xl shadow-sm text-teal-600 shrink-0"><Users size={20}/></div>
               <div className="w-full">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Passenger Count</p>
               </div>
            </div>

            <div className="flex-1 w-full bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500 transition-all border border-slate-100 rounded-2xl p-3 flex items-center gap-4 cursor-text">
               <div className="bg-white p-2 rounded-xl shadow-sm text-teal-600 shrink-0"><CalendarDays size={20}/></div>
               <div className="w-full">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Travel Dates</p>
               </div>
            </div>

            <button onClick={handleJumpToBooking} className="w-full md:w-auto bg-slate-800 hover:bg-slate-900 text-white px-10 py-5 rounded-2xl font-black shadow-lg transition-transform active:scale-95 shrink-0 flex items-center justify-center gap-2">
              Jump to Booking <ArrowRight size={18} className="text-teal-400" />
            </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. LIVE KPI METRICS (Connected to Database)                           */}
      {/* ===================================================================== */}
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Financial Health</h2>
          <button onClick={fetchStats} className="text-slate-400 hover:text-teal-600 transition-colors" title="Refresh Live Data"><RefreshCw size={20} className={loading ? 'animate-spin' : ''}/></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        
        {/* 1. REVENUE (Total Invoiced) */}
        <div onClick={() => navigate('/invoices')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-teal-50 rounded-full blur-3xl transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-teal-50 group-hover:bg-teal-100 transition-colors rounded-2xl text-teal-600"><TrendingUp size={24} /></div>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-teal-500 transition-colors" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Total Billed Revenue</p>
          <h3 className="text-3xl font-black text-slate-800 relative z-10 truncate">
            {loading ? '...' : <><span className="text-lg text-slate-400 mr-1 font-medium">₵</span>{stats.totalRevenue?.toLocaleString()}</>}
          </h3>
        </div>

        {/* 2. CASH IN HAND (Paid Invoices) */}
        <div onClick={() => navigate('/finance-ledger')} className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-white/10 rounded-2xl text-emerald-400 backdrop-blur-md"><Wallet size={24} /></div>
            <ArrowRight size={16} className="text-slate-400 group-hover:text-emerald-400 transition-colors" />
          </div>
          <p className="text-[10px] font-black text-emerald-400/80 uppercase tracking-widest mb-1 relative z-10">Actual Cash Received</p>
          <h3 className="text-3xl font-black text-white relative z-10 truncate">
            {loading ? '...' : <><span className="text-lg text-emerald-400/50 mr-1 font-medium">₵</span>{stats.cashInHand?.toLocaleString()}</>}
          </h3>
        </div>

        {/* 3. RECEIVABLES */}
        <div onClick={() => navigate('/invoices')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-orange-50 rounded-full blur-3xl transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-orange-50 group-hover:bg-orange-100 transition-colors rounded-2xl text-orange-600"><CreditCard size={24} /></div>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-orange-500 transition-colors" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Outstanding Receivables</p>
          <h3 className="text-3xl font-black text-slate-800 relative z-10 truncate">
            {loading ? '...' : <><span className="text-lg text-slate-400 mr-1 font-medium">₵</span>{stats.outstandingBalance?.toLocaleString()}</>}
          </h3>
        </div>

        {/* 4. EXPENSES (Pending Outflow) */}
        <div onClick={() => navigate('/expenses')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-red-50 rounded-full blur-3xl transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-red-50 group-hover:bg-red-100 transition-colors rounded-2xl text-red-600"><Receipt size={24} /></div>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-red-500 transition-colors" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Pending Expenses</p>
          <h3 className="text-3xl font-black text-red-600 relative z-10 truncate">
             {loading ? '...' : <><span className="text-lg text-red-300 mr-1 font-medium">₵</span>{stats.pendingExpenses?.toLocaleString()}</>}
          </h3>
        </div>

      </div>

      {/* ===================================================================== */}
      {/* 4. SECONDARY GRID: OPERATIONS & AI ENGINE                             */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: Operations Summary & Visual Cash Flow */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* Visual Cash Flow Bar */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 text-lg mb-6 flex items-center gap-2"><Activity size={20} className="text-teal-500"/> Cash Flow Health</h3>
                
                {stats && stats.totalRevenue > 0 ? (
                    <div>
                        <div className="flex justify-between text-sm font-bold mb-2">
                            <span className="text-emerald-600">Collected: {Math.round((stats.cashInHand / stats.totalRevenue) * 100)}%</span>
                            <span className="text-orange-500">Pending: {Math.round((stats.outstandingBalance / stats.totalRevenue) * 100)}%</span>
                        </div>
                        <div className="w-full h-6 bg-orange-100 rounded-full overflow-hidden flex shadow-inner border border-slate-100">
                            <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(stats.cashInHand / stats.totalRevenue) * 100}%` }}></div>
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-4">Your current collection rate vs billed invoices. Use the Invoicing tab to send payment reminders.</p>
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">Not enough financial data to generate cash flow health. Create bookings to begin tracking your collection rate.</p>
                )}
            </div>

            {/* Quick Links / Operations Pulse */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group cursor-pointer" onClick={() => navigate('/operations')}>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Map size={24}/></div>
                        <div>
                            <p className="text-3xl font-black text-slate-800 leading-none">{loading ? '-' : stats?.activeTrips}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active Trips</p>
                        </div>
                    </div>
                    <ArrowRight className="text-slate-300 group-hover:text-blue-500 transition-colors"/>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group cursor-pointer" onClick={() => navigate('/staff')}>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Users size={24}/></div>
                        <div>
                            <p className="text-3xl font-black text-slate-800 leading-none">{loading ? '-' : stats?.activeStaff}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active Staff</p>
                        </div>
                    </div>
                    <ArrowRight className="text-slate-300 group-hover:text-purple-500 transition-colors"/>
                </div>
            </div>
        </div>

        {/* RIGHT: AI Command Center & Alerts */}
        <div className="lg:col-span-1 space-y-6">
            
            {/* SmartYield Ad/Alert */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden text-white">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex items-center gap-2 mb-4">
                    <Zap size={20} className="text-teal-400 fill-teal-400 animate-pulse"/>
                    <h3 className="font-black tracking-widest uppercase text-[10px] text-teal-400">Nomad AI Engine</h3>
                </div>
                <h4 className="text-2xl font-black mb-2 leading-tight">Maximize your margins today.</h4>
                <p className="text-slate-400 text-sm font-medium mb-6">SmartYield is analyzing your live trips. There may be opportunities to surge pricing or run flash sales.</p>
                <button onClick={() => navigate('/smartyield')} className="w-full bg-teal-500 hover:bg-teal-400 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 text-sm uppercase tracking-wider">
                    Open SmartYield
                </button>
            </div>

            {/* System Alerts */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-widest"><AlertCircle size={16} className="text-orange-500"/> Action Required</h3>
                <div className="space-y-3">
                    {stats && stats.pendingExpenses > 0 && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-xs font-bold border border-red-100 flex gap-3">
                            <Receipt size={16} className="shrink-0 mt-0.5"/>
                            You have ₵{stats.pendingExpenses.toLocaleString()} in pending expenses requiring executive approval.
                        </div>
                    )}
                    {stats && stats.outstandingBalance > 5000 && (
                        <div className="bg-orange-50 text-orange-700 p-4 rounded-xl text-xs font-bold border border-orange-100 flex gap-3">
                            <CreditCard size={16} className="shrink-0 mt-0.5"/>
                            High outstanding receivables detected. Please follow up on due invoices.
                        </div>
                    )}
                    {(!stats || (stats.pendingExpenses === 0 && stats.outstandingBalance <= 5000)) && (
                        <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-xs font-bold border border-blue-100 flex items-center gap-2">
                            <CheckCircle size={16}/> System running smoothly. All queues clear.
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;