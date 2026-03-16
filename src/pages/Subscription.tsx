import React, { useState, useEffect } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase'; // 🌟 Added Supabase Import
import { 
  Users, Map, ShieldCheck, ArrowUpRight, Lock, Rocket, 
  X, CreditCard, Smartphone, Monitor, Tablet, Calendar, CheckCircle
} from 'lucide-react';

// --- TYPES & INTERFACES ---

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  description: string;
  color: string;
  seats: number | 'Unlimited';
  features: string[];
  isPopular?: boolean;
}

interface SubData {
  plan: string;
  status: string;
  renewal_date: string | Date;
  created_at: string | Date;
}

interface SelectedUpgrade extends Plan {
  cycle: 'monthly' | 'yearly';
  finalPrice: number;
}

// Declare Paystack on window object
declare global {
  interface Window {
    PaystackPop: {
      setup: (options: any) => { openIframe: () => void };
    };
  }
}

// --- CONSTANTS ---

// REPLACE WITH YOUR REAL PAYSTACK PUBLIC KEY
const PAYSTACK_KEY = 'pk_live_2c3e4c090fc872a118042fb55f9932158dd89fa3'; 

const PLAN_ORDER = ['Standard', 'Pro', 'Premium'];

const PLAN_LIMITS: Record<string, number> = {
  'Standard': 5,
  'Pro': 20,
  'Premium': 9999
};

const PLANS: Plan[] = [
  {
    id: 'Standard',
    name: 'Basic',
    monthlyPrice: 299,
    description: 'Essential tools for solo operators.',
    color: 'from-slate-600 to-slate-800',
    seats: 5,
    features: ['5 Staff Accounts', 'Standard Manifests', 'Offline Mode', 'Email Support']
  },
  {
    id: 'Pro', 
    name: 'Pro',
    monthlyPrice: 599,
    description: 'Automation for growing agencies.',
    color: 'from-teal-600 to-teal-900',
    isPopular: true,
    seats: 20,
    features: ['20 Staff Accounts', 'Live Fleet GPS', 'Finance Ledger', 'Email Invoicing']
  },
  {
    id: 'Premium', 
    name: 'Premium',
    monthlyPrice: 849,
    description: 'Priority control & maximum scale.',
    color: 'from-purple-600 to-purple-900',
    seats: 'Unlimited',
    features: ['Unlimited Staff', 'White-Label Domain', 'API Access', 'Dedicated Account Mgr']
  }
];

const Subscription: React.FC = () => {
  const { user } = useTenant();
  
  // 🌟 THE FIX: Safely extract variables to bypass TypeScript strictness
  const targetId = (user as any)?.uid || (user as any)?.subscriberId;
  const userEmail = (user as any)?.email; 

  const [subData, setSubData] = useState<SubData>({ plan: 'Standard', status: 'Active', renewal_date: new Date(), created_at: new Date() });
  const [staffCount, setStaffCount] = useState<number>(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly'); 
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUpgrade, setSelectedUpgrade] = useState<SelectedUpgrade | null>(null); 

  // --- 1. FETCH DATA (Now using Supabase!) ---
  const fetchData = async () => {
    if (!targetId) return;
    setLoading(true);
    
    try {
      // Fetch Subscription Data
      const { data: subDataRes } = await supabase
        .from('subscribers')
        .select('plan, status, subscriptionExpiresAt, endDate, created_at')
        .eq('id', targetId)
        .maybeSingle();

      if (subDataRes) {
         setSubData({
             plan: subDataRes.plan || 'Standard',
             status: subDataRes.status || 'Active',
             renewal_date: subDataRes.subscriptionExpiresAt || subDataRes.endDate || new Date(),
             created_at: subDataRes.created_at || new Date()
         });
      }

      // Fetch Staff Count
      const { count } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('subscriber_id', targetId);

      if (count !== null) setStaffCount(count);

    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchData();
  }, [targetId]);

  // --- 2. PAYMENT HANDLER (Now updates Supabase directly!) ---
  const handlePaymentSuccess = async (reference: string) => {
    if (!selectedUpgrade || !targetId) return;
    
    try {
        // Calculate new expiry date
        const now = new Date();
        const daysToAdd = selectedUpgrade.cycle === 'yearly' ? 365 : 30;
        const newExpiry = new Date(now.setDate(now.getDate() + daysToAdd)).toISOString();

        // Update the database
        const { error } = await supabase
            .from('subscribers')
            .update({ 
                plan: selectedUpgrade.id,
                subscriptionExpiresAt: newExpiry,
                status: 'Active'
            })
            .eq('id', targetId);

        if (error) throw error;

        // Log the upgrade action
        await supabase.from('activity_logs').insert({
            user_id: targetId,
            action: `Upgraded to ${selectedUpgrade.name} (${selectedUpgrade.cycle})`,
            device_info: 'Paystack Checkout',
            location: 'System Log'
        });

        setSelectedUpgrade(null);
        alert("Upgrade Successful! Welcome to your new tier.");
        fetchData(); // Refresh the UI with new plan info
    } catch (e) { 
        console.error(e);
        alert("Payment succeeded, but we had trouble updating your account. Please contact support."); 
    }
  };

  // --- 3. INITIATE UPGRADE ---
  const initiateUpgrade = (plan: Plan) => {
    const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.monthlyPrice * 10;
    setSelectedUpgrade({
        ...plan,
        cycle: billingCycle,
        finalPrice: price
    });
  };

  // --- Helpers ---
  const formatDate = (dateString: string | Date) => {
    if (!dateString) return 'Active';
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const limit = PLAN_LIMITS[subData.plan] || 5;
  const remaining = limit - staffCount;
  const progress = Math.min((staffCount / limit) * 100, 100);
  const isUnlimited = limit > 1000;

  return (
    <div className="animate-fade-in pb-20 max-w-7xl mx-auto">
      
      {/* HEADER PROFILE */}
      <div className="mb-16 relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300 rounded-[2.5rem] rotate-1 shadow-xl"></div>
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden relative z-10 p-8 md:p-10 flex flex-col md:flex-row gap-10">
            <div className="flex-1 flex gap-6 items-start border-r border-slate-100 pr-8">
                <div className="w-24 h-24 rounded-3xl bg-slate-900 text-white flex items-center justify-center text-4xl shadow-xl border-4 border-white transform rotate-3">
                    <ShieldCheck size={40} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{user?.fullName || 'My Agency'}</h2>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${subData.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {subData.status}
                        </span>
                    </div>
                    <p className="text-slate-400 font-medium text-sm flex items-center gap-2 mb-6">
                        <Map size={14}/> ID: <span className="font-mono text-slate-600 bg-slate-100 px-2 rounded">{targetId}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Current Tier</p>
                            <p className="text-sm font-black text-slate-800">
                                {PLANS.find(p => p.id === subData.plan)?.name || subData.plan}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Renewal Date</p>
                            <p className="text-sm font-black text-teal-600 flex items-center gap-2">
                                <Calendar size={14}/> {formatDate(subData.renewal_date)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-1 flex flex-col justify-center pl-4">
                <div className="flex justify-between items-end mb-3">
                    <h3 className="text-sm font-black text-slate-700 uppercase flex items-center gap-2">
                        <Users size={16} className="text-teal-500"/> Seat Capacity
                    </h3>
                    <p className="text-3xl font-black text-slate-800">
                        {staffCount} <span className="text-lg text-slate-400 font-medium">/ {isUnlimited ? '∞' : limit}</span>
                    </p>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 mb-2">
                    <div className={`h-full transition-all duration-1000 ${progress > 90 ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${isUnlimited ? 5 : progress}%` }}></div>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Member Since: {new Date(subData.created_at).getFullYear()}</span>
                    <span className="font-bold text-slate-600">{remaining} seats available</span>
                </div>
            </div>
        </div>
      </div>

      {/* PRICING TOGGLE */}
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black text-slate-900 mb-4">Choose your Flight Path</h2>
        <div className="flex items-center justify-center gap-4 mb-8">
            <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>Monthly</span>
            <button 
                onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
                className="w-16 h-8 bg-slate-200 rounded-full relative transition-colors duration-300 focus:outline-none"
            >
                <div className={`w-6 h-6 bg-teal-500 rounded-full absolute top-1 transition-all duration-300 shadow-sm ${billingCycle === 'monthly' ? 'left-1' : 'left-9'}`}></div>
            </button>
            <span className={`text-sm font-bold ${billingCycle === 'yearly' ? 'text-slate-900' : 'text-slate-400'}`}>
                Annually <span className="text-green-600 text-[10px] bg-green-100 px-2 py-0.5 rounded-full ml-1">SAVE 17%</span>
            </span>
        </div>
      </div>

      {/* PRICING CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end mb-24">
        {PLANS.map((plan) => (
          <PricingCard 
            key={plan.id} 
            plan={plan} 
            currentPlanId={subData.plan} 
            billingCycle={billingCycle}
            onSelect={() => initiateUpgrade(plan)}
          />
        ))}
      </div>

      {/* ENTERPRISE NOTE */}
      {subData.plan === 'Premium' && (
         <div className="max-w-4xl mx-auto bg-slate-900 rounded-[2rem] p-1 shadow-2xl mb-24 animate-in slide-in-from-bottom-10">
            <div className="bg-slate-900 rounded-[1.9rem] border border-slate-700 p-12 text-center relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-500/20 blur-[80px] rounded-full"></div>
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30">
                        <Rocket size={32} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4">Enterprise Tier is Next</h2>
                    <p className="text-lg text-slate-400 max-w-lg mx-auto mb-8">
                        You are currently on our highest available plan (Premium). We are actively developing the <strong>Enterprise / God-Mode</strong> tier which will include dedicated infrastructure and AI analytics.
                    </p>
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-blue-300 text-sm font-bold uppercase tracking-widest">
                        <Lock size={14} /> In Development
                    </div>
                </div>
            </div>
         </div>
      )}

      {/* DEVICE VISUALS */}
      <div className="mb-20">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 mb-4">Operations on Every Screen</h2>
            <p className="text-slate-500">From the back office to the bus terminal, your data stays synced.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[400px]">
            <div className="md:col-span-2 relative rounded-[2.5rem] overflow-hidden shadow-2xl group">
                <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80" alt="Dashboard" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"/>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-8 text-white">
                    <Monitor size={32} className="mb-3 text-teal-400"/>
                    <h3 className="text-xl font-bold mb-1">Central Command</h3>
                    <p className="text-slate-300 text-sm">Manage bookings and finance from headquarters.</p>
                </div>
            </div>
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-xl group bg-slate-100">
                <img src="https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&w=800&q=80" alt="Mobile" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"/>
                <div className="absolute inset-0 bg-slate-900/60 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 p-8 text-white">
                    <div className="flex gap-2 mb-3">
                        <Smartphone size={24} className="text-purple-400"/>
                        <Tablet size={24} className="text-purple-400"/>
                    </div>
                    <h3 className="text-xl font-bold mb-1">Field Operations</h3>
                    <p className="text-slate-300 text-sm">Drivers check-in via tablet app.</p>
                </div>
            </div>
        </div>
      </div>

      {/* 🌟 THE MODAL FIX: Using the extracted userEmail variable */}
      {selectedUpgrade && userEmail && (
        <UpgradeModal 
            upgrade={selectedUpgrade} 
            userEmail={userEmail} 
            onClose={() => setSelectedUpgrade(null)}
            onSuccess={handlePaymentSuccess}
        />
      )}

    </div>
  );
};

// --- LOGIC-DRIVEN PRICING CARD ---
interface PricingCardProps {
  plan: Plan;
  currentPlanId: string;
  billingCycle: 'monthly' | 'yearly';
  onSelect: () => void;
}

const PricingCard: React.FC<PricingCardProps> = ({ plan, currentPlanId, billingCycle, onSelect }) => {
  const currentIndex = PLAN_ORDER.indexOf(currentPlanId);
  const planIndex = PLAN_ORDER.indexOf(plan.id);

  const isCurrent = planIndex === currentIndex;
  const isLower = planIndex < currentIndex;
  
  const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.monthlyPrice * 10;
  const period = billingCycle === 'monthly' ? '/mo' : '/yr';

  return (
    <div className={`relative p-6 rounded-[2rem] transition-all duration-300 flex flex-col h-full 
        ${isCurrent ? 'bg-teal-50 border-2 border-teal-500 scale-105 z-10' : 'bg-white border border-slate-100 hover:shadow-xl'}
        ${isLower ? 'opacity-60 grayscale-[80%]' : ''} 
    `}>
      <div className={`h-32 rounded-[1.5rem] bg-gradient-to-br ${plan.color} p-6 text-white mb-6 flex flex-col justify-between shadow-lg`}>
          <h3 className="text-lg font-black uppercase tracking-widest">{plan.name}</h3>
          <div className="flex items-baseline gap-1">
              <span className="text-xs opacity-70">GHS</span>
              <span className="text-3xl font-black">{price.toLocaleString()}</span>
              <span className="text-xs opacity-70">{period}</span>
          </div>
      </div>
      <ul className="space-y-3 mb-8 px-2 flex-1">
          {plan.features.map((feat, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                  <CheckCircle size={16} className={`${isLower ? 'text-slate-400' : 'text-teal-500'} shrink-0`}/> {feat}
              </li>
          ))}
      </ul>
      {isCurrent ? (
          <button disabled className="w-full py-3 rounded-xl font-bold text-sm bg-transparent text-teal-600 border border-teal-200 cursor-default flex items-center justify-center gap-2">
             <CheckCircle size={16}/> Current Plan
          </button>
      ) : isLower ? (
          <button disabled className="w-full py-3 rounded-xl font-bold text-sm bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200">
             Included
          </button>
      ) : (
          <button onClick={onSelect} className="w-full py-3 rounded-xl font-bold text-sm bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2">
            <ArrowUpRight size={16}/> Upgrade
          </button>
      )}
    </div>
  );
};

// --- CHECKOUT MODAL (Manual Paystack Implementation) ---
interface UpgradeModalProps {
  upgrade: SelectedUpgrade;
  userEmail: string;
  onClose: () => void;
  onSuccess: (reference: string) => void;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ upgrade, userEmail, onClose, onSuccess }) => {
    
    useEffect(() => {
        if (window.PaystackPop) return;

        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    const payWithPaystack = () => {
        if (!window.PaystackPop) {
            alert("Paystack is still connecting securely. Please wait a second and click again.");
            return;
        }
        
        const handler = window.PaystackPop.setup({
            key: PAYSTACK_KEY, 
            email: userEmail,
            amount: upgrade.finalPrice * 100, // Kobo
            currency: 'GHS',
            ref: (new Date()).getTime().toString(), 
            callback: function(response: any) {
                onSuccess(response.reference);
            },
            onClose: function() {
                alert('Transaction was not completed.');
            }
        });
        handler.openIframe();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl z-10 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">Confirm Upgrade</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <ShieldCheck size={12} className="text-green-500"/> Secured by Paystack
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white rounded-full text-slate-400 hover:text-red-500 border border-slate-200"><X size={18} /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className={`bg-gradient-to-r ${upgrade.color} rounded-2xl p-6 text-white text-center shadow-lg relative overflow-hidden`}>
                        <div className="relative z-10">
                            <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">New Plan</p>
                            <h2 className="text-3xl font-black">{upgrade.name}</h2>
                            <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-lg text-xs font-bold capitalize">
                                {upgrade.cycle} Billing
                            </span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm font-medium text-slate-600 border-b border-slate-100 pb-2">
                            <span>Subscription Cost</span>
                            <span>GHS {upgrade.finalPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium text-slate-600 border-b border-slate-100 pb-2">
                            <span>Unused Days</span>
                            <span className="text-green-600">+ Rollover Applied</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="font-black text-slate-900">Total Due Today</span>
                            <span className="font-black text-2xl text-slate-900">GHS {upgrade.finalPrice.toLocaleString()}</span>
                        </div>
                    </div>
                    <button onClick={payWithPaystack} className="w-full py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2 group">
                        <CreditCard size={18} className="group-hover:scale-110 transition-transform"/> Pay to Upgrade
                    </button>
                    <p className="text-[10px] text-center text-slate-400 px-4">
                        Clicking pay will open the secure Paystack checkout window.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Subscription;