import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLogger';
import { 
  Calendar, MapPin, CheckCircle2, User, Phone, Mail, CheckCircle,
  Utensils, HeartPulse, BedDouble, ArrowRight, ShieldCheck,
  CreditCard, PiggyBank, Wallet, Link as LinkIcon, Copy, Clock, AlertCircle,
  UserCircle, UserPlus, Trash2, ChevronUp, ChevronDown, Globe, PlaneLanding,
  Calculator, BrainCircuit, Banknote, RefreshCw
} from 'lucide-react';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

// --- MIRRORED INTERFACES ---
interface Traveler {
  id: string; isLead: boolean;
  title: string; firstName: string; lastName: string; gender: string; dob: string;
  phone: string; email: string; address: string; city: string; country: string;
  nationality: string; passportNo: string; passportIssueDate: string; passportExpiry: string; passportIssueCountry: string;
  dietaryPreference: string; allergies: string; medicalConditions: string; mobilityNeeds: string;
  roomPreference: string; requestedRoommate: string; arrivalFlight: string; departureFlight: string;
  emergencyContactName: string; emergencyContactPhone: string; emergencyContactRelation: string;
}

interface TripLogistics {
  pickupLocation: string; insuranceOptIn: string; specialOccasion: string; additionalNotes: string;
}

const PublicBooking: React.FC = () => {
  const { tripId } = useParams();
  const [trip, setTrip] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | null>(null);
  // 🌟 NEW: Track if customer is paying online or reserving via offline cash/transfer
  const [checkoutMethod, setCheckoutMethod] = useState<'online' | 'offline'>('online');
  const [newBookingId, setNewBookingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedTraveler, setExpandedTraveler] = useState<string | null>(null);

  const [layawayMeta, setLayawayMeta] = useState({ frequency: 'Monthly', initialDeposit: '' });

  const getEmptyTraveler = (isLead: boolean = false): Traveler => ({
    id: `TRV-${Math.random().toString(36).substr(2, 9)}`, isLead, 
    title: 'Mr', firstName: '', lastName: '', gender: '', dob: '', phone: '', email: '', address: '', city: '', country: '',
    nationality: '', passportNo: '', passportIssueDate: '', passportExpiry: '', passportIssueCountry: '',
    dietaryPreference: 'None', allergies: 'None', medicalConditions: 'None', mobilityNeeds: 'None',
    roomPreference: 'Standard Double (Shared)', requestedRoommate: '', arrivalFlight: '', departureFlight: '',
    emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: ''
  });

  const [travelers, setTravelers] = useState<Traveler[]>([getEmptyTraveler(true)]);
  const [logistics, setLogistics] = useState<TripLogistics>({ pickupLocation: '', insuranceOptIn: 'Declined', specialOccasion: 'None', additionalNotes: '' });

  useEffect(() => {
    if (!window.PaystackPop) {
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const fetchTripDetails = async () => {
      if (!tripId) return;
      try {
        const { data: tripData, error: tripError } = await supabase.from('trips').select('*').eq('id', tripId).single();
        if (tripData && !tripError) {
          const { data: settingsData } = await supabase.from('system_settings').select('*').eq('subscriber_id', tripData.subscriber_id).order('updated_at', { ascending: false }).limit(1);
          if (settingsData && settingsData.length > 0) setSettings(settingsData[0]);

          const { data: subData } = await supabase.from('subscribers').select('plan').eq('id', tripData.subscriber_id).single();
          if (subData) tripData.subscribers = subData;
          setTrip(tripData);
        }
      } catch (err) { console.error("Error loading booking page:", err); } 
      finally { setLoading(false); }
    };
    fetchTripDetails();
  }, [tripId]);

  const APP_COLOR = settings?.theme_color || '#0d9488';
  const CURRENCY = settings?.currency || 'GHS';
  const adultPrice = trip?.financials?.adultPrice || trip?.financials?.basePrice || 0;
  const requiredDeposit = trip?.financials?.requiredDeposit || 0;
  const totalTripCost = adultPrice * travelers.length;
  const currentPaid = paymentMode === 'full' ? totalTripCost : (Number(layawayMeta.initialDeposit) || 0);

  const planProjection = useMemo(() => {
    if (!trip || paymentMode !== 'partial') return null;
    let tripDate = trip.start_date ? new Date(trip.start_date) : new Date();
    if (isNaN(tripDate.getTime())) { tripDate = new Date(); tripDate.setMonth(tripDate.getMonth() + 3); }
    const cutoffDate = new Date(tripDate); cutoffDate.setDate(tripDate.getDate() - 14);
    const today = new Date();
    let daysRemaining = Math.floor((cutoffDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 1) daysRemaining = 1; 

    const balance = Math.max(0, totalTripCost - currentPaid);
    let periods = layawayMeta.frequency === 'Weekly' ? Math.max(1, Math.floor(daysRemaining / 7)) : Math.max(1, Math.floor(daysRemaining / 30));
    const installmentAmount = balance / periods;

    let feasibilityScore = 'Safe', warning = '';
    if (installmentAmount > 3000 && layawayMeta.frequency === 'Monthly') { feasibilityScore = 'Risky'; warning = 'High installment amount. High risk of default.'; }
    if (daysRemaining < 30 && balance > 1000) { feasibilityScore = 'Unrealistic'; warning = 'Timeline is too tight to realistically save this balance.'; }

    return { tripName: trip.title, targetAmount: totalTripCost, balance, cutoffDate: cutoffDate.toLocaleDateString(), periods, installmentAmount: installmentAmount.toFixed(2), feasibilityScore, warning };
  }, [trip, layawayMeta.frequency, currentPaid, totalTripCost, paymentMode]);

  const handleTravelerChange = (id: string, field: keyof Traveler, value: string) => { setTravelers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t)); };
  const handleAddTraveler = () => { setTravelers([...travelers, getEmptyTraveler(false)]); setExpandedTraveler(travelers[travelers.length - 1]?.id || null); };
  const handleRemoveTraveler = (idToRemove: string) => { setTravelers(travelers.filter(t => t.id !== idToRemove)); };

  // 🌟 SAVES TO DB AFTER ONLINE PAYSTACK OR IMMEDIATELY IF OFFLINE
  const handlePaymentSuccess = async (reference: any) => {
    try {
      const lead = travelers[0];
      const isOffline = checkoutMethod === 'offline';
      // If offline, we log the amount they PROMISE to pay, but we mark it as pending
      const loggedAmountPaid = isOffline ? 0 : currentPaid; 
      const finalStatus = isOffline ? 'Pending Verification' : (paymentMode === 'full' ? 'Full' : 'Active');

      if (paymentMode === 'partial') {
          if (!planProjection) throw new Error("Calculation error.");
          const clientDetails = { email: lead.email, dob: lead.dob, idNumber: lead.passportNo, tripId: trip.id, travelers: travelers, logistics: logistics, groupMeta: { adults: travelers.length, children: 0, infants: 0 } };
          const saveRef = `SS-${Math.floor(1000 + Math.random() * 9000)}`;

          const savePayload = {
              subscriber_id: trip.subscriber_id, save_ref: saveRef, customer: `${lead.firstName} ${lead.lastName}`, phone: lead.phone || '', client_details: clientDetails,
              target_trip: planProjection.tripName, target_amount: planProjection.targetAmount, current_saved: loggedAmountPaid, 
              frequency: layawayMeta.frequency, periods: planProjection.periods, installment_amount: Number(planProjection.installmentAmount), 
              deadline: planProjection.cutoffDate, status: finalStatus,
              start_date: new Date().toISOString(), transactions: !isOffline && currentPaid > 0 ? [{ id: `TXN-${Date.now()}`, date: new Date().toLocaleString(), amount: currentPaid, note: `Online Deposit (Ref: ${reference.reference})` }] : []
          };

          const { error: saveError } = await supabase.from('smartsave').insert([savePayload]);
          if (saveError) throw saveError;
          
          await logAudit(trip.subscriber_id, `${lead.firstName} ${lead.lastName}`, 'Customer', 'Public Booking (SmartSave)', `Customer secured layaway for "${trip.title}". Mode: ${checkoutMethod}`);

          setIsSuccess(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return; 
      }

      // FULL PAYMENT DB LOGIC
      const masterBookingPayload = {
          subscriber_id: trip.subscriber_id, trip_id: trip.id, customer_name: `${lead.firstName} ${lead.lastName}`,
          email: lead.email, phone: lead.phone, amount_paid: loggedAmountPaid, total_cost: totalTripCost, payment_status: finalStatus,
          payment_method: isOffline ? 'Offline / Cash' : 'Online Gateway', pax_count: travelers.length, pickup_location: logistics.pickupLocation,
          emergency_contact: { name: lead.emergencyContactName, phone: lead.emergencyContactPhone, relation: lead.emergencyContactRelation },
          lead_name: `${lead.firstName} ${lead.lastName}`, raw_data: { roster: travelers, logistics, paystack_ref: reference.reference }
      };

      const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert([masterBookingPayload]).select();
      if (bookingError || !bookingData) throw new Error("Failed to create booking.");

      const newBookingId = bookingData[0].id;
      setNewBookingId(newBookingId);

      const passengersPayload = travelers.map(t => ({
         booking_id: newBookingId, trip_id: trip.id, subscriber_id: trip.subscriber_id,
         first_name: t.firstName, last_name: t.lastName, title: t.title, gender: t.gender, dob: t.dob || null,
         nationality: t.nationality, passport_no: t.passportNo, passport_expiry: t.passportExpiry || null,
         is_lead: t.isLead, room_preference: t.roomPreference, requested_roommate: t.requestedRoommate,
         dietary_needs: t.dietaryPreference, medical_info: t.medicalConditions, phone: t.phone, email: t.email,
         amount_paid: loggedAmountPaid, payment_status: finalStatus, boarded: false, raw_data: t
      }));

      const { error: paxError } = await supabase.from('passengers').insert(passengersPayload);
      if (paxError) throw paxError;

      const newPaxCount = (trip.passenger_count || 0) + travelers.length;
      await supabase.from('trips').update({ passenger_count: newPaxCount }).eq('id', trip.id);

      await logAudit(trip.subscriber_id, `${lead.firstName} ${lead.lastName}`, 'Customer', 'Public Booking (Full)', `Customer booked ${travelers.length} pax on "${trip.title}". Mode: ${checkoutMethod}`);

      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert("Payment successful, but we had trouble saving your record. Please contact support with your reference: " + reference.reference);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🌟 THE CHECKOUT TRIGGER
  const triggerCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMode) return alert("Please select a payment option.");
    if (paymentMode === 'partial' && currentPaid < requiredDeposit) return alert(`Minimum deposit is ${CURRENCY} ${requiredDeposit}`);
    
    setIsSubmitting(true);

    // 🌟 IF OFFLINE: Bypass Paystack and log directly as pending
    if (checkoutMethod === 'offline') {
        handlePaymentSuccess({ reference: `OFFLINE-${Date.now()}` });
        return;
    }

    // 🌟 IF ONLINE: Trigger Paystack for automatic Split Commission
    if (!window.PaystackPop) {
        setIsSubmitting(false);
        return alert("Payment gateway is loading. Please try again in a few seconds.");
    }
    
    const rawSubaccount = settings?.merchant_number || '';
    const isValidSubaccount = rawSubaccount.startsWith('ACCT_');
    const agencyPlan = (trip?.subscribers?.plan || '').toLowerCase();
    const isStartup = agencyPlan === 'startup' || agencyPlan === 'starter';
    const platformFeeKobo = isStartup ? Math.round((currentPaid * 100) * 0.05) : 0;

    const handler = window.PaystackPop.setup({
        key: 'pk_live_2c3e4c090fc872a118042fb55f9932158dd89fa3',
        email: travelers[0].email || 'customer@example.com',
        amount: currentPaid * 100, 
        currency: CURRENCY,
        reference: `PRONOMAD-PUB-${Date.now()}`,
        ...(isValidSubaccount ? { subaccount: rawSubaccount, transaction_charge: platformFeeKobo, bearer: "subaccount" } : {}), 
        callback: function(response: any) { handlePaymentSuccess(response); },
        onClose: function() { setIsSubmitting(false); alert("Payment window closed. Your seat is not secured yet."); }
    });

    handler.openIframe();
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center animate-pulse"><div className="w-12 h-12 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div></div>;
  if (!trip) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center"><ShieldCheck size={64} className="text-slate-300 mb-4"/><h1 className="text-2xl font-black text-slate-800">Trip Not Found</h1></div>;

  // ==========================================
  // SUCCESS SCREEN (PROVISIONAL PASSPORT)
  // ==========================================
  if (isSuccess) {
    const passportLink = newBookingId ? `${window.location.origin}/passport/${newBookingId}` : '';
    
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-12">
        <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">Registration Received!</h2>
        <div className="bg-white max-w-sm w-full rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 border border-slate-200">
          <div className="p-8 pb-10 bg-amber-400 text-slate-900 relative">
             <div className="absolute right-0 top-0 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
             <span className="bg-slate-900/10 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-900/10 mb-4 inline-block">Provisional Ticket</span>
             <h3 className="text-2xl font-black leading-tight mb-2">{trip.title}</h3>
             <p className="text-slate-800 font-bold text-sm">{travelers[0].firstName} {travelers[0].lastName}</p>
             <div className="mt-6 flex justify-between items-center text-sm font-bold border-t border-slate-900/10 pt-4">
                <span className="text-slate-700">Amount Due:</span>
                <span className="text-slate-900 text-lg font-black">{CURRENCY} {currentPaid.toLocaleString()}</span>
             </div>
          </div>
          <div className="relative flex justify-between items-center -my-3 z-10">
             <div className="w-6 h-6 bg-slate-50 rounded-full -ml-3 shadow-inner"></div>
             <div className="flex-1 border-t-2 border-dashed border-slate-300 mx-2"></div>
             <div className="w-6 h-6 bg-slate-50 rounded-full -mr-3 shadow-inner"></div>
          </div>
          <div className="p-8 pt-10 bg-slate-50">
             <div className="flex items-center gap-3 mb-4 text-amber-600"><Clock size={24} className="animate-pulse" /><h4 className="font-black text-lg">Awaiting Verification</h4></div>
             <p className="text-slate-600 text-sm font-bold mb-6">
                {checkoutMethod === 'offline' ? `Your reservation is saved. Please complete your ${CURRENCY} ${currentPaid} payment offline to verify this ticket.` : "Your payment has been received and is currently being verified by operations."}
             </p>
             {newBookingId && (
               <div className="space-y-3">
                   <button onClick={() => { navigator.clipboard.writeText(passportLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="w-full bg-white border border-slate-200 text-slate-700 font-black py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 active:scale-95 shadow-sm">
                     {copied ? <><CheckCircle size={18} className="text-emerald-500"/> Copied!</> : <><Copy size={18}/> Copy Your Passport Link</>}
                   </button>
                   <p className="text-[10px] text-center font-bold text-slate-400">Save this link. Once verified, it will automatically transform into your Full Digital Passport.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // BOOKING FORM UI
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <div className="bg-slate-900 text-white pt-12 pb-8 px-6 shadow-xl rounded-b-[3rem] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="max-w-3xl mx-auto relative z-10">
          {settings?.company_logo ? (
            <img src={settings.company_logo} alt="Company Logo" className="h-12 object-contain mb-6 bg-white/10 p-2 rounded-xl backdrop-blur-md"/>
          ) : (
            <div className="text-sm font-black uppercase tracking-widest mb-6 opacity-80">{settings?.company_name || 'Tour Booking'}</div>
          )}
          <span className="bg-white/20 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm border border-white/20">Secure Registration</span>
          <h1 className="text-3xl md:text-4xl font-black mt-4 leading-tight">{trip.title}</h1>
          {trip.subtitle && <p className="text-slate-300 font-medium mt-2">{trip.subtitle}</p>}
          
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700 backdrop-blur-sm"><Calendar size={16} className="text-teal-400"/><span className="text-xs font-bold">{new Date(trip.start_date).toLocaleDateString()}</span></div>
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700 backdrop-blur-sm"><MapPin size={16} className="text-rose-400"/><span className="text-xs font-bold">{trip.logistics?.pickup || 'TBA'}</span></div>
            {adultPrice > 0 && (<div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700 backdrop-blur-sm"><CreditCard size={16} className="text-amber-400"/><span className="text-xs font-bold">{CURRENCY} {adultPrice.toLocaleString()} / Pax</span></div>)}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-4 relative z-20">
        <form onSubmit={triggerCheckout} className="space-y-6">
          
          {/* PAYMENT STRUCTURE */}
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black">1</div>
                  <h2 className="text-2xl font-black text-slate-800">Payment Plan</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div onClick={() => setPaymentMode('full')} className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${paymentMode === 'full' ? 'bg-slate-50 shadow-md' : 'bg-white hover:border-slate-300'}`} style={paymentMode === 'full' ? { borderColor: APP_COLOR } : { borderColor: '#e2e8f0' }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}><CheckCircle2 size={24}/></div>
                      <h3 className="text-xl font-black text-slate-800 mb-2">Upfront / Full Payment</h3>
                      <p className="text-sm font-medium text-slate-500">Secure your spot instantly and receive your Digital Passport.</p>
                  </div>
                  <div onClick={() => { setPaymentMode('partial'); setLayawayMeta({ frequency: 'Monthly', initialDeposit: requiredDeposit > 0 ? requiredDeposit.toString() : '' }); }} className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${paymentMode === 'partial' ? 'bg-pink-50 border-pink-400 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                      <div className="w-12 h-12 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center mb-4"><PiggyBank size={24}/></div>
                      <h3 className="text-xl font-black text-slate-800 mb-2">Deposits & Installments</h3>
                      <p className="text-sm font-medium text-slate-500">Pay a deposit now and track your balance via our layaway vault.</p>
                  </div>
              </div>
          </div>

          {/* TRAVELER DETAILS */}
          {paymentMode && (
              <div className="space-y-6 animate-in slide-in-from-bottom-8">
                  <div className="flex items-center gap-3 mb-2 px-4">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black shrink-0">2</div>
                      <h2 className="text-2xl font-black text-slate-800">Traveler Details</h2>
                  </div>

                  {travelers.map((traveler, index) => {
                    const isExpanded = expandedTraveler === traveler.id || (index === 0 && expandedTraveler === null);
                    return (
                      <div key={traveler.id} className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden relative transition-all">
                          <div onClick={() => setExpandedTraveler(isExpanded ? null : traveler.id)} className={`p-6 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'}`}>
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-sm" style={{ backgroundColor: traveler.isLead ? APP_COLOR : '#94a3b8' }}><UserCircle size={20}/></div>
                                  <div>
                                      <h3 className="text-xl font-black text-slate-800">
                                          {traveler.firstName || traveler.lastName ? `${traveler.firstName} ${traveler.lastName}` : `Traveler ${index + 1}`}
                                          {traveler.isLead && <span className="ml-2 text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-full uppercase tracking-widest align-middle">Lead Contact</span>}
                                      </h3>
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Cost: {CURRENCY} {adultPrice.toLocaleString()}</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                  {!traveler.isLead && (<button onClick={(e) => { e.stopPropagation(); handleRemoveTraveler(traveler.id); }} type="button" className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>)}
                                  {isExpanded ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                              </div>
                          </div>

                          {isExpanded && (
                            <div className="p-8 space-y-8 bg-white">
                               {/* SECTION 1: PERSONAL & CONTACT */}
                               <div>
                                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2"><UserCircle size={16} className="text-blue-500"/> Personal & Contact Information</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                                      <select value={traveler.title} onChange={e => handleTravelerChange(traveler.id, 'title', e.target.value)} className="md:col-span-2 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold"><option>Mr</option><option>Mrs</option><option>Ms</option><option>Dr</option><option>Prof</option><option>Rev</option></select>
                                      <input value={traveler.firstName} onChange={e => handleTravelerChange(traveler.id, 'firstName', e.target.value)} type="text" placeholder="First Name (As on Passport)" className="md:col-span-5 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm focus:ring-2 transition-all font-bold text-slate-800" style={{ '--tw-ring-color': APP_COLOR } as any} required/>
                                      <input value={traveler.lastName} onChange={e => handleTravelerChange(traveler.id, 'lastName', e.target.value)} type="text" placeholder="Last Name / Surname" className="md:col-span-5 bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm focus:ring-2 transition-all font-bold text-slate-800" style={{ '--tw-ring-color': APP_COLOR } as any} required/>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Gender</label><select value={traveler.gender} onChange={e => handleTravelerChange(traveler.id, 'gender', e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm"><option value="">Select...</option><option>Male</option><option>Female</option></select></div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Date of Birth</label><input value={traveler.dob} onChange={e => handleTravelerChange(traveler.id, 'dob', e.target.value)} type="date" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm" /></div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Email Address {traveler.isLead && '*'}</label><input required={traveler.isLead} value={traveler.email} onChange={e => handleTravelerChange(traveler.id, 'email', e.target.value)} type="email" placeholder="john@example.com" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm"/></div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Phone / WhatsApp {traveler.isLead && '*'}</label><input required={traveler.isLead} value={traveler.phone} onChange={e => handleTravelerChange(traveler.id, 'phone', e.target.value)} type="tel" placeholder="+1 234 567 8900" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm"/></div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">City / State</label><input value={traveler.city} onChange={e => handleTravelerChange(traveler.id, 'city', e.target.value)} type="text" placeholder="e.g. New York, NY" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm"/></div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Country of Residence</label><input value={traveler.country} onChange={e => handleTravelerChange(traveler.id, 'country', e.target.value)} type="text" placeholder="e.g. USA" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm"/></div>
                                  </div>
                               </div>

                               {/* SECTION 2: TRAVEL DOCUMENTS */}
                               <div>
                                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2"><Globe size={16} className="text-indigo-500"/> Passports & Documents</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Nationality</label><input value={traveler.nationality} onChange={e => handleTravelerChange(traveler.id, 'nationality', e.target.value)} type="text" placeholder="e.g. Ghanaian" className="w-full bg-indigo-50/30 border border-indigo-100 p-3 rounded-xl outline-none text-sm" /></div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Passport / ID Number</label><input value={traveler.passportNo} onChange={e => handleTravelerChange(traveler.id, 'passportNo', e.target.value)} type="text" placeholder="e.g. G0000000" className="w-full bg-indigo-50/30 border border-indigo-100 p-3 rounded-xl outline-none text-sm font-mono font-bold text-indigo-900" /></div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Date of Issue</label><input value={traveler.passportIssueDate} onChange={e => handleTravelerChange(traveler.id, 'passportIssueDate', e.target.value)} type="date" className="w-full bg-indigo-50/30 border border-indigo-100 p-3 rounded-xl outline-none text-sm" /></div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Date of Expiry</label><input value={traveler.passportExpiry} onChange={e => handleTravelerChange(traveler.id, 'passportExpiry', e.target.value)} type="date" className="w-full bg-indigo-50/30 border border-indigo-100 p-3 rounded-xl outline-none text-sm" /></div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Issuing Country</label><input value={traveler.passportIssueCountry} onChange={e => handleTravelerChange(traveler.id, 'passportIssueCountry', e.target.value)} type="text" placeholder="e.g. Ghana" className="w-full bg-indigo-50/30 border border-indigo-100 p-3 rounded-xl outline-none text-sm" /></div>
                                  </div>
                               </div>

                               {/* SECTION 3: HEALTH & SAFETY */}
                               <div>
                                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2"><HeartPulse size={16} className="text-rose-500"/> Health, Dietary & Safety</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      <div>
                                          <label className="text-[10px] font-bold text-rose-500 uppercase ml-1 block mb-1">Dietary Requirements</label>
                                          <select value={traveler.dietaryPreference} onChange={e => handleTravelerChange(traveler.id, 'dietaryPreference', e.target.value)} className="w-full bg-rose-50/30 border border-rose-100 p-3 rounded-xl outline-none text-sm text-slate-800">
                                              <option value="None">No Restrictions</option><option value="Vegetarian">Vegetarian</option><option value="Vegan">Vegan</option><option value="Halal">Halal</option><option value="Kosher">Kosher</option><option value="Gluten-Free">Gluten-Free</option>
                                          </select>
                                      </div>
                                      <div><label className="text-[10px] font-bold text-rose-500 uppercase ml-1 block mb-1">Severe Allergies</label><input value={traveler.allergies} onChange={e => handleTravelerChange(traveler.id, 'allergies', e.target.value)} type="text" placeholder="e.g. Peanuts, Penicillin (Or 'None')" className="w-full bg-rose-50/30 border border-rose-100 p-3 rounded-xl outline-none text-sm" /></div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      <div><label className="text-[10px] font-bold text-rose-500 uppercase ml-1 block mb-1">Medical Conditions</label><input value={traveler.medicalConditions} onChange={e => handleTravelerChange(traveler.id, 'medicalConditions', e.target.value)} type="text" placeholder="e.g. Asthma, Diabetes (Or 'None')" className="w-full bg-rose-50/30 border border-rose-100 p-3 rounded-xl outline-none text-sm" /></div>
                                      <div><label className="text-[10px] font-bold text-rose-500 uppercase ml-1 block mb-1">Mobility Needs</label><input value={traveler.mobilityNeeds} onChange={e => handleTravelerChange(traveler.id, 'mobilityNeeds', e.target.value)} type="text" placeholder="e.g. Wheelchair access required (Or 'None')" className="w-full bg-rose-50/30 border border-rose-100 p-3 rounded-xl outline-none text-sm" /></div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-rose-50 pt-4">
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Emergency Contact Name</label><input value={traveler.emergencyContactName} onChange={e => handleTravelerChange(traveler.id, 'emergencyContactName', e.target.value)} type="text" placeholder="Full Name" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm" /></div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Emergency Phone</label><input value={traveler.emergencyContactPhone} onChange={e => handleTravelerChange(traveler.id, 'emergencyContactPhone', e.target.value)} type="tel" placeholder="+1 234..." className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm" /></div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Relationship</label><input value={traveler.emergencyContactRelation} onChange={e => handleTravelerChange(traveler.id, 'emergencyContactRelation', e.target.value)} type="text" placeholder="e.g. Spouse, Parent" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm" /></div>
                                  </div>
                               </div>

                               {/* SECTION 4: LOGISTICS & PREFERENCES */}
                               <div>
                                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2"><PlaneLanding size={16} className="text-teal-600"/> Logistics & Rooming</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      <div>
                                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Room Preference</label>
                                          <select value={traveler.roomPreference} onChange={e => handleTravelerChange(traveler.id, 'roomPreference', e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold text-slate-700">
                                              <option>Standard Double (Shared Bed)</option><option>Twin (Separate Beds)</option><option>Single Supplement (Private Room)</option><option>Family Suite</option>
                                          </select>
                                      </div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Requested Roommate</label><input value={traveler.requestedRoommate} onChange={e => handleTravelerChange(traveler.id, 'requestedRoommate', e.target.value)} type="text" placeholder="Name of partner/friend" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm" /></div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Arrival Flight Info</label><input value={traveler.arrivalFlight} onChange={e => handleTravelerChange(traveler.id, 'arrivalFlight', e.target.value)} type="text" placeholder="e.g. Delta DL123 arriving Aug 12, 14:00" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm" /></div>
                                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Departure Flight Info</label><input value={traveler.departureFlight} onChange={e => handleTravelerChange(traveler.id, 'departureFlight', e.target.value)} type="text" placeholder="e.g. BA456 departing Aug 20, 22:00" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm" /></div>
                                  </div>
                               </div>
                            </div>
                          )}
                      </div>
                    );
                  })}

                  <button type="button" onClick={handleAddTraveler} className="w-full py-5 rounded-[2rem] border-2 border-dashed font-black text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm" style={{ borderColor: `${APP_COLOR}40` }}>
                      <UserPlus size={18}/> Add Another Traveler to Manifest
                  </button>

                  {/* FINAL CHECKOUT & SUMMARY */}
                  <div className={`rounded-[2.5rem] shadow-2xl p-8 md:p-10 mt-10 relative overflow-hidden ${paymentMode === 'partial' ? 'bg-slate-50 border border-slate-200' : 'bg-slate-900 text-white'}`}>
                      {paymentMode !== 'partial' && <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: APP_COLOR }}></div>}
                      
                      <div className={`flex flex-col md:flex-row justify-between md:items-end gap-8 border-b pb-8 mb-8 relative z-10 ${paymentMode === 'partial' ? 'border-slate-200' : 'border-slate-800'}`}>
                          <div>
                              <p className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${paymentMode === 'partial' ? 'text-slate-500' : 'text-slate-400'}`}><ShieldCheck size={14}/> Booking Summary</p>
                              <h3 className={`text-3xl font-black ${paymentMode === 'partial' ? 'text-slate-800' : 'text-white'}`}>{travelers.length} Travelers</h3>
                              <p className={`font-medium mt-1 text-sm ${paymentMode === 'partial' ? 'text-slate-500' : 'text-slate-400'}`}>Destination: {trip.title}</p>
                          </div>
                          <div className="md:text-right">
                              <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${paymentMode === 'partial' ? 'text-slate-500' : 'text-slate-400'}`}>Total Cart Value</p>
                              <h2 className="text-5xl font-black tracking-tight" style={paymentMode === 'partial' ? { color: '#0f172a' } : { color: APP_COLOR }}>
                                  <span className={`text-2xl mr-2 ${paymentMode === 'partial' ? 'text-slate-400' : 'text-slate-500'}`}>{CURRENCY}</span>
                                  {totalTripCost.toLocaleString()}
                              </h2>
                          </div>
                      </div>

                      {/* 🌟 INTEGRATED SMARTSAVE CALCULATOR (For Partial Payments) */}
                      {paymentMode === 'partial' && planProjection && (
                        <div className="mb-8 animate-in slide-in-from-bottom-4">
                            <div className="bg-white border border-slate-200 p-6 rounded-2xl mb-6 shadow-sm">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Initial Deposit to Pay Now ({CURRENCY})</label>
                                <input type="number" min={requiredDeposit} value={layawayMeta.initialDeposit} onChange={e => setLayawayMeta({...layawayMeta, initialDeposit: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-black text-slate-800 outline-none focus:border-teal-500 transition-colors" placeholder={`Min: ${requiredDeposit}`}/>
                            </div>

                            <div className={`border-2 rounded-2xl p-6 transition-all shadow-xl ${planProjection.feasibilityScore === 'Unrealistic' ? 'bg-red-50 border-red-200' : planProjection.feasibilityScore === 'Risky' ? 'bg-orange-50 border-orange-200' : 'bg-slate-900 border-slate-800'}`}>
                                <div className="flex justify-between items-center mb-4 border-b pb-4 border-slate-200/20">
                                    <h4 className={`font-black flex items-center gap-2 ${planProjection.feasibilityScore === 'Safe' ? "text-teal-400" : planProjection.feasibilityScore === 'Risky' ? "text-orange-600" : "text-red-600"}`}>
                                        <Calculator size={18}/> SmartSave Plan Projection
                                    </h4>
                                    <select value={layawayMeta.frequency} onChange={e => setLayawayMeta({...layawayMeta, frequency: e.target.value})} className={`border-none text-sm font-bold p-2 rounded-lg outline-none cursor-pointer transition-colors ${planProjection.feasibilityScore === 'Safe' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-200 text-slate-800'}`}>
                                        <option className="text-slate-800" value="Weekly">Weekly</option>
                                        <option className="text-slate-800" value="Monthly">Monthly</option>
                                    </select>
                                </div>
                                
                                {planProjection.warning && (
                                    <div className={`p-3 rounded-xl mb-6 text-xs font-bold flex items-start gap-2 ${planProjection.feasibilityScore === 'Unrealistic' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                        <AlertCircle size={16} className="shrink-0 mt-0.5"/> {planProjection.warning}
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div><p className={`text-[10px] uppercase font-bold mb-1 ${planProjection.feasibilityScore === 'Safe' ? 'text-slate-400' : 'text-slate-500'}`}>Remaining Bal.</p><p className={`font-black text-xl ${planProjection.feasibilityScore === 'Safe' ? 'text-white' : 'text-slate-800'}`}>₵ {planProjection.balance.toLocaleString()}</p></div>
                                    <div><p className={`text-[10px] uppercase font-bold mb-1 ${planProjection.feasibilityScore === 'Safe' ? 'text-slate-400' : 'text-slate-500'}`}>Layaway Deadline</p><p className="font-bold text-orange-500">{planProjection.cutoffDate}</p></div>
                                    <div><p className={`text-[10px] uppercase font-bold mb-1 ${planProjection.feasibilityScore === 'Safe' ? 'text-slate-400' : 'text-slate-500'}`}>Total Portions</p><p className="font-bold text-teal-500">{planProjection.periods} {layawayMeta.frequency.replace('ly', 's')}</p></div>
                                </div>

                                <div className={`p-5 rounded-xl flex items-center justify-between ${planProjection.feasibilityScore === 'Safe' ? 'bg-black/20 border border-white/5' : 'bg-white border border-slate-200'}`}>
                                    <span className={`font-bold text-xs uppercase ${planProjection.feasibilityScore === 'Safe' ? 'text-slate-300' : 'text-slate-500'}`}>Client Pays:</span>
                                    <span className={`text-2xl font-black ${planProjection.feasibilityScore === 'Unrealistic' ? 'text-red-500' : 'text-teal-500'}`}>₵ {Number(planProjection.installmentAmount).toLocaleString()} <span className={`text-xs font-bold ${planProjection.feasibilityScore === 'Safe' ? 'text-slate-400' : 'text-slate-400'}`}>/ {layawayMeta.frequency.replace('ly','')}</span></span>
                                </div>
                            </div>
                        </div>
                      )}

                      {/* 🌟 OFFLINE VS ONLINE TOGGLE */}
                      <div className="mb-6 flex gap-4 p-2 bg-black/5 rounded-2xl border border-black/5">
                          <button 
                              type="button"
                              onClick={() => setCheckoutMethod('online')} 
                              className={`flex-1 py-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${checkoutMethod === 'online' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              <CreditCard size={30}/> Pay Online Now
                          </button>
                          <button 
                              type="button"
                              onClick={() => setCheckoutMethod('offline')} 
                              className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${checkoutMethod === 'offline' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              <Banknote size={30}/> Pay Offline (Cash/Transfer)
                          </button>
                      </div>

                      <button 
                          type="submit"
                          disabled={isSubmitting || !travelers[0].firstName || !travelers[0].lastName || !travelers[0].phone || (paymentMode === 'partial' && currentPaid < requiredDeposit)}
                          className="w-full py-5 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 hover:brightness-110 relative z-10"
                          style={paymentMode === 'partial' && planProjection?.feasibilityScore === 'Unrealistic' ? { backgroundColor: '#ef4444' } : paymentMode === 'partial' ? { backgroundColor: '#ec4899', boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.4)' } : { backgroundColor: APP_COLOR, boxShadow: `0 10px 25px -5px ${APP_COLOR}60` }}
                      >
                          {isSubmitting ? <RefreshCw size={22} className="animate-spin"/> : paymentMode === 'partial' ? (planProjection?.feasibilityScore === 'Unrealistic' ? <AlertCircle size={22}/> : <BrainCircuit size={22}/>) : <Wallet size={22}/>}
                          {isSubmitting ? 'Processing Request...' : checkoutMethod === 'offline' ? 'Submit Reservation (Pay Later)' : paymentMode === 'partial' ? (planProjection?.feasibilityScore === 'Unrealistic' ? 'Deposit Too Low' : `Pay ${CURRENCY} ${currentPaid} Deposit`) : `Pay ${CURRENCY} ${currentPaid} & Book`}
                      </button>
                  </div>
              </div>
          )}

        </form>
      </div>
    </div>
  );
};

export default PublicBooking;