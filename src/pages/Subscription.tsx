import React, { useState, useEffect } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase'; 
import { 
  Users, Map, ShieldCheck, ArrowUpRight, Lock, Rocket, 
  X, CreditCard, Smartphone, Monitor, Tablet, Calendar, 
  CheckCircle, AlertTriangle, Phone, MessageCircle, RefreshCw,
  Zap, Shield, Sparkles, Headphones // Added Headphones here!
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

// RESTORED: Missing Interfaces
interface PricingCardProps {
  plan: Plan;
  currentPlanId: string;
  billingCycle: 'monthly' | 'yearly';
  isSystemLocked: boolean;
  onSelect: () => void;
}

interface UpgradeModalProps {
  upgrade: SelectedUpgrade;
  userEmail: string;
  isSystemLocked: boolean;
  onClose: () => void;
  onSuccess: (reference: string) => void;
}

// 🌟 FIX: Match the exact type used in PublicBooking.tsx to avoid TS conflict
declare global {
  interface Window {
    PaystackPop: any;
  }
}

// --- CONSTANTS ---

// REPLACE WITH YOUR REAL PAYSTACK PUBLIC KEY
const PAYSTACK_KEY = 'pk_live_2c3e4c090fc872a118042fb55f9932158dd89fa3'; 

const PLAN_ORDER = ['Startup', 'Basic', 'Pro', 'Premium'];

const PLAN_LIMITS: Record<string, number> = {
  'Startup': 3,
  'Basic': 5,
  'Pro': 20,
  'Premium': 9999
};

const PLANS: Plan[] = [
  {
    id: 'Startup',
    name: 'Startup',
    monthlyPrice: 60,
    description: 'Perfect for new agencies getting off the ground.',
    color: 'from-amber-500 to-orange-600',
    seats: 3,
    features: ['5% Platform Commission', 'Paystack Split Payments', 'Standard Manifests', 'Community Support']
  },
  {
    id: 'Basic',
    name: 'Basic',
    monthlyPrice: 299,
    description: 'Essential management for growing operators.',
    color: 'from-slate-700 to-slate-900',
    seats: 5,
    features: ['0% Platform Commission', 'Offline Operations', 'Advanced Manifests', 'Priority Email Support']
  },
  {
    id: 'Pro', 
    name: 'Pro',
    monthlyPrice: 599,
    description: 'Advanced automation for professional agencies.',
    color: 'from-teal-500 to-emerald-700',
    isPopular: true,
    seats: 20,
    features: ['20 Staff Accounts', 'Live Fleet GPS', 'Finance Ledger', 'API Access']
  },
  {
    id: 'Premium', 
    name: 'Premium',
    monthlyPrice: 849,
    description: 'The ultimate control center for enterprise scale.',
    color: 'from-indigo-600 to-purple-800',
    seats: 'Unlimited',
    features: ['Unlimited Staff', 'White-Label Domain', 'AI Analytics', 'Dedicated Manager']
  }
];

const Subscription: React.FC = () => {
  const { user } = useTenant();
  
  const targetId = (user as any)?.uid || (user as any)?.subscriberId;
  const userEmail = (user as any)?.email; 
  const isSystemLocked = user?.isExpired || false;

  const [subData, setSubData] = useState<SubData>({ plan: 'Startup', status: 'Active', renewal_date: new Date(), created_at: new Date() });
  const [staffCount, setStaffCount] = useState<number>(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly'); 
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUpgrade, setSelectedUpgrade] = useState<SelectedUpgrade | null>(null); 

  // --- 1. FETCH DATA ---
  const fetchData = async () => {
    if (!targetId) return;
    setLoading(true);
    
    try {
      const { data: subDataRes } = await supabase
        .from('subscribers')
        .select('plan, status, subscriptionExpiresAt, endDate, created_at')
        .eq('id', targetId)
        .maybeSingle();

      if (subDataRes) {
         const dbPlan = subDataRes.plan ? subDataRes.plan.charAt(0).toUpperCase() + subDataRes.plan.slice(1).toLowerCase() : 'Startup';
         
         setSubData({
             plan: dbPlan,
             status: subDataRes.status || 'Active',
             renewal_date: subDataRes.subscriptionExpiresAt || subDataRes.endDate || new Date(),
             created_at: subDataRes.created_at || new Date()
         });
      }

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

  // --- 2. PAYMENT HANDLER ---
  const handlePaymentSuccess = async (reference: string) => {
    if (!selectedUpgrade || !targetId) return;
    
    try {
        const now = new Date();
        const daysToAdd = selectedUpgrade.cycle === 'yearly' ? 365 : 30;
        const newExpiry = new Date(now.setDate(now.getDate() + daysToAdd)).toISOString();

        const { error } = await supabase
            .from('subscribers')
            .update({ 
                plan: selectedUpgrade.id,
                subscriptionExpiresAt: newExpiry,
                status: 'active'
            })
            .eq('id', targetId);

        if (error) throw error;

        await supabase.from('activity_logs').insert({
            user_id: targetId,
            action: `${isSystemLocked ? 'Renewed' : 'Upgraded'} to ${selectedUpgrade.name} (${selectedUpgrade.cycle})`,
            device_info: 'Paystack Checkout',
            location: 'System Log'
        });

        setSelectedUpgrade(null);
        alert(`${isSystemLocked ? 'Renewal' : 'Upgrade'} Successful! Your system is now active.`);
        window.location.reload(); 
    } catch (e) { 
        console.error(e);
        alert("Payment succeeded, but we had trouble updating your account. Please contact support."); 
    }
  };

  // --- 3. INITIATE UPGRADE/RENEWAL ---
  const initiateUpgrade = (plan: Plan) => {
    const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.monthlyPrice * 10;
    setSelectedUpgrade({
        ...plan,
        cycle: billingCycle,
        finalPrice: price
    });
  };

  const formatDate = (dateString: string | Date) => {
    if (!dateString) return 'Active';
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const limit = PLAN_LIMITS[subData.plan] || 3;
  const progress = Math.min((staffCount / limit) * 100, 100);
  const isUnlimited = limit > 1000;

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans pb-20">
      
      {/* 🌫️ TEXTURED BACKGROUND ELEMENTS */}
      <div className="absolute inset-0 pointer-events-none opacity-40" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-200/30 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-200/30 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-12">
        
        {/* 🔴 EXPIRED SYSTEM LOCK BANNER */}
        {isSystemLocked && (
          <div className="mb-12 bg-red-950 rounded-[2.5rem] p-1 shadow-2xl relative overflow-hidden animate-in slide-in-from-top-10">
             <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=1200&q=80')] bg-cover opacity-10 mix-blend-overlay"></div>
             <div className="bg-red-950/80 backdrop-blur-xl rounded-[2.4rem] border border-red-500/30 p-8 md:p-12 text-center relative z-10">
                 <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.4)]">
                     <Lock size={40} />
                 </div>
                 <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">System Locked</h2>
                 <p className="text-red-200 text-lg max-w-2xl mx-auto mb-8 font-medium">
                     Your Pronomad operating license expired on <strong>{formatDate(subData.renewal_date)}</strong>. 
                     Core operations have been suspended. Please renew your subscription below.
                 </p>
             </div>
          </div>
        )}

        {/* HEADER PROFILE (Hidden if locked) */}
        {!isSystemLocked && (
          <div className="mb-12 bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white shadow-2xl shadow-slate-200/50 flex flex-col lg:flex-row gap-8 items-center">
            <div className="flex-1 flex gap-6 items-center">
              <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-white shadow-2xl">
                <Shield size={36} className="text-teal-400" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-slate-900">{user?.fullName || 'My Agency'}</h2>
                  <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${subData.status.toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    {subData.status}
                  </span>
                </div>
                <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-tight flex items-center gap-2">
                  <Zap size={12} className="text-amber-500 fill-amber-500" /> Current Plan: <span className="text-slate-700">{subData.plan}</span>
                </p>
              </div>
            </div>

            <div className="w-px h-12 bg-slate-200 hidden lg:block"></div>

            <div className="flex-1 w-full">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Seat Utilization</span>
                <span className="text-sm font-black text-slate-800">{staffCount} / {isUnlimited ? '∞' : limit}</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-slate-900 transition-all duration-1000" style={{ width: `${isUnlimited ? 5 : progress}%` }}></div>
              </div>
            </div>

            <div className="w-px h-12 bg-slate-200 hidden lg:block"></div>

            <div className="flex-1 w-full">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Renewal Date</span>
              <div className="flex items-center gap-2 text-slate-900 font-black">
                <Calendar size={18} className="text-teal-500" />
                {formatDate(subData.renewal_date)}
              </div>
            </div>
          </div>
        )}

        {/* PRICING TOGGLE */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter mb-4">
            {isSystemLocked ? 'Select Renewal Plan.' : <>Scale your <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-indigo-600">Operations.</span></>}
          </h1>
          <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto mb-10">
            Choose the workspace capacity that fits your current fleet size. Save 17% on annual commitments.
          </p>

          <div className="inline-flex items-center bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${billingCycle === 'monthly' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Yearly <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-md">Save 17%</span>
            </button>
          </div>
        </div>

        {/* PRICING CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-20">
          {PLANS.map((plan) => (
            <PricingCard 
              key={plan.id} 
              plan={plan} 
              currentPlanId={subData.plan} 
              billingCycle={billingCycle}
              isSystemLocked={isSystemLocked}
              onSelect={() => initiateUpgrade(plan)}
            />
          ))}
        </div>

        {/* CUSTOMER SUPPORT BAR */}
        <div className="p-8 bg-slate-900 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-teal-500/10 blur-3xl"></div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
              <Headphones size={28} className="text-teal-400" />
            </div>
            <div>
              <h4 className="text-xl font-black">Need a custom plan?</h4>
              <p className="text-slate-400 text-sm font-medium">Contact Ato Williams for enterprise-level fleet solutions.</p>
            </div>
          </div>
          <div className="flex gap-4 relative z-10 w-full md:w-auto">
            <a href="tel:+233248518528" className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 text-white font-black py-4 px-8 rounded-2xl transition-all flex items-center justify-center gap-2">
              <Phone size={18} /> Call
            </a>
            <a href="https://wa.me/233248518528" target="_blank" rel="noreferrer" className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 px-8 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20">
              <MessageCircle size={18} /> WhatsApp
            </a>
          </div>
        </div>

      </div>

      {/* CHECKOUT MODAL */}
      {selectedUpgrade && userEmail && (
        <UpgradeModal 
          upgrade={selectedUpgrade} 
          userEmail={userEmail}
          isSystemLocked={isSystemLocked}
          onClose={() => setSelectedUpgrade(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

// --- LOGIC-DRIVEN PRICING CARD ---
const PricingCard: React.FC<PricingCardProps> = ({ plan, currentPlanId, billingCycle, isSystemLocked, onSelect }) => {
  const currentIndex = PLAN_ORDER.indexOf(currentPlanId);
  const planIndex = PLAN_ORDER.indexOf(plan.id);

  const isCurrent = !isSystemLocked && (planIndex === currentIndex);
  const isLower = !isSystemLocked && (planIndex < currentIndex);
  
  const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.monthlyPrice * 10;

  return (
    <div className={`group relative bg-white/70 backdrop-blur-md rounded-[2.5rem] p-8 transition-all duration-500 flex flex-col border ${isCurrent ? 'ring-4 ring-teal-500/20 border-teal-500 shadow-2xl scale-105 bg-white' : 'border-slate-100 hover:border-slate-300 hover:shadow-xl'} ${isLower ? 'opacity-60 grayscale-[50%]' : ''}`}>
      {plan.isPopular && (
        <div className="absolute top-5 right-5 bg-teal-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
          Best Value
        </div>
      )}
      
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.color} mb-6 flex items-center justify-center text-white shadow-lg`}>
        {plan.id === 'Premium' ? <Sparkles size={24} /> : plan.id === 'Pro' ? <Rocket size={24} /> : <Zap size={24} />}
      </div>

      <h3 className="text-xl font-black text-slate-900 mb-1">{plan.name}</h3>
      <p className="text-slate-400 text-xs font-bold mb-6 h-8 leading-tight">{plan.description}</p>

      <div className="mb-8">
        <div className="flex items-baseline gap-1">
          <span className="text-slate-400 text-sm font-bold">GHS</span>
          <span className="text-4xl font-black text-slate-900">{price.toLocaleString()}</span>
          <span className="text-slate-400 text-xs font-bold">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
        </div>
        {plan.id === 'Startup' && <p className="text-orange-600 text-[10px] font-black mt-1 uppercase tracking-tighter">+ 5% per trip fee</p>}
      </div>

      <ul className="space-y-4 mb-10 flex-1">
        {/* FIX: Added strict typing to feat and i */}
        {plan.features.map((feat: string, i: number) => (
          <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-600">
            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <CheckCircle size={12} className="text-teal-600" />
            </div>
            {feat}
          </li>
        ))}
      </ul>

      <button 
        disabled={isCurrent || isLower}
        onClick={onSelect}
        className={`w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${isCurrent ? 'bg-teal-50 text-teal-600 cursor-default' : isLower ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/10'}`}
      >
        {isCurrent ? <><CheckCircle size={16}/> Current</> : isLower ? 'Included' : isSystemLocked && plan.id === currentPlanId ? <><RefreshCw size={16}/> Renew Plan</> : <><ArrowUpRight size={16}/> {isSystemLocked ? 'Renew & Upgrade' : 'Upgrade'}</>}
      </button>
    </div>
  );
};

// --- CHECKOUT MODAL ---
const UpgradeModal: React.FC<UpgradeModalProps> = ({ upgrade, userEmail, isSystemLocked, onClose, onSuccess }) => {
    
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
            amount: upgrade.finalPrice * 100, 
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white relative z-10">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Secure Checkout</h3>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 mt-1"><Shield size={10}/> SSL Encrypted</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="p-10 space-y-8">
                    <div className={`bg-gradient-to-br ${upgrade.color} p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden`}>
                      <div className="absolute right-[-10%] bottom-[-10%] opacity-20"><Rocket size={100} /></div>
                      <span className="text-[10px] font-black uppercase opacity-60 tracking-widest">Selected Tier</span>
                      <h2 className="text-3xl font-black">{upgrade.name}</h2>
                      <p className="text-xs font-bold opacity-80 mt-2 capitalize">{upgrade.cycle} Billing Cycle</p>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between text-sm font-bold text-slate-500 uppercase tracking-tight">
                            <span>Amount Due</span>
                            <span className="text-slate-900">GHS {upgrade.finalPrice.toLocaleString()}</span>
                        </div>
                        {!isSystemLocked && (
                            <div className="flex justify-between text-sm font-bold text-slate-500 uppercase tracking-tight">
                                <span>Unused Days</span>
                                <span className="text-emerald-500">+ Rollover Applied</span>
                            </div>
                        )}
                        <div className="h-px bg-slate-100 w-full"></div>
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-black text-slate-900 tracking-tighter">Total Payment</span>
                            <span className="text-3xl font-black text-slate-900 tracking-tighter">GHS {upgrade.finalPrice.toLocaleString()}</span>
                        </div>
                    </div>

                    <button onClick={payWithPaystack} className="w-full py-5 rounded-2xl bg-slate-900 text-white font-black text-lg shadow-2xl hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                      <CreditCard size={20}/> Complete Payment
                    </button>
                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">Payment powered by Paystack</p>
                </div>
            </div>
        </div>
    );
};

export default Subscription;