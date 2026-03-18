import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Calendar, MapPin, CheckCircle2, User, Phone, Mail, CheckCircle,
  Utensils, HeartPulse, BedDouble, ArrowRight, ShieldCheck,
  CreditCard, PiggyBank, Wallet, Link as LinkIcon, Copy, Clock, AlertCircle
} from 'lucide-react';

const PublicBooking: React.FC = () => {
  const { tripId } = useParams();
  const [trip, setTrip] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | null>(null);
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [newBookingId, setNewBookingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    title: 'Mr',
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    room_preference: 'Standard Double (Shared)',
    requested_roommate: '',
    dietary_needs: 'None',
    medical_info: ''
  });

  useEffect(() => {
    const fetchTripDetails = async () => {
      if (!tripId) return;
      try {
        const { data: tripData, error: tripError } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (tripData && !tripError) {
          setTrip(tripData);
          
          const { data: settingsData } = await supabase
            .from('system_settings')
            .select('company_name, company_logo, theme_color, currency')
            .eq('subscriber_id', tripData.subscriber_id)
            .single();
            
          if (settingsData) setSettings(settingsData);
        }
      } catch (err) {
        console.error("Error loading booking page:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTripDetails();
  }, [tripId]);

  const APP_COLOR = settings?.theme_color || '#0d9488';
  const CURRENCY = settings?.currency || 'GHS';
  
  const adultPrice = trip?.financials?.adultPrice || 0;
  const requiredDeposit = trip?.financials?.requiredDeposit || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMode) return alert("Please select a payment option.");
    setIsSubmitting(true);

    try {
      const currentPaid = paymentMode === 'full' ? adultPrice : (Number(amountPaid) || 0);

      // --- ALL BOOKINGS GO TO PENDING/UNVERIFIED STATUS INITIALLY ---
      const bookingPayload = {
          subscriber_id: trip.subscriber_id,
          trip_id: trip.id,
          customer_name: `${formData.first_name} ${formData.last_name}`,
          email: formData.email,
          phone: formData.phone,
          amount_paid: currentPaid,
          total_cost: adultPrice,
          payment_status: paymentMode === 'full' ? 'Pending Full' : 'Pending Deposit',
          payment_method: 'Manual/Momo',
          pax_count: 1,
          lead_name: `${formData.first_name} ${formData.last_name}`,
          raw_data: { roster: [formData], payment_mode: paymentMode }
      };

      const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert([bookingPayload]).select();
      if (bookingError || !bookingData) throw new Error("Failed to create booking.");

      const bId = bookingData[0].id;
      setNewBookingId(bId);

      const paxPayload = {
          booking_id: bId,
          trip_id: trip.id,
          subscriber_id: trip.subscriber_id,
          first_name: formData.first_name,
          last_name: formData.last_name,
          title: formData.title,
          phone: formData.phone,
          email: formData.email,
          room_preference: formData.room_preference,
          requested_roommate: formData.requested_roommate,
          dietary_needs: formData.dietary_needs,
          medical_info: formData.medical_info,
          amount_paid: currentPaid,
          payment_status: paymentMode === 'full' ? 'Pending Full' : 'Pending Deposit',
          boarded: false,
          is_lead: true
      };

      const { error: paxError } = await supabase.from('passengers').insert([paxPayload]);
      if (paxError) throw paxError;

      // Update Trip Capacity
      const newPaxCount = (trip.passenger_count || 0) + 1;
      await supabase.from('trips').update({ passenger_count: newPaxCount }).eq('id', trip.id);

      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert("Something went wrong processing your booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center animate-pulse"><div className="w-12 h-12 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div></div>;
  if (!trip) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center"><ShieldCheck size={64} className="text-slate-300 mb-4"/><h1 className="text-2xl font-black text-slate-800">Trip Not Found</h1></div>;

  // ==========================================
  // SUCCESS SCREEN (THE "HALF-PASSPORT")
  // ==========================================
  if (isSuccess) {
    const passportLink = newBookingId ? `${window.location.origin}/passport/${newBookingId}` : '';
    const claimedAmount = paymentMode === 'full' ? adultPrice : (Number(amountPaid) || 0);

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-12">
        <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">Registration Received!</h2>
        
        {/* THE TICKET UI */}
        <div className="bg-white max-w-sm w-full rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95">
          
          {/* Top Half: Booking Info */}
          <div className="p-8 pb-10 bg-slate-900 text-white relative">
             <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
             <span className="bg-white/20 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 mb-4 inline-block">Provisional Seat</span>
             <h3 className="text-2xl font-black leading-tight mb-2">{trip.title}</h3>
             <p className="text-slate-400 font-medium text-sm">{formData.first_name} {formData.last_name}</p>
             
             <div className="mt-6 flex justify-between items-center text-sm font-bold border-t border-white/10 pt-4">
                <span className="text-slate-400">Total Claimed:</span>
                <span className="text-white text-lg">{CURRENCY} {claimedAmount.toLocaleString()}</span>
             </div>
          </div>

          {/* Ticket Cutout Effect */}
          <div className="relative flex justify-between items-center -my-3 z-10">
             <div className="w-6 h-6 bg-slate-50 rounded-full -ml-3 shadow-inner"></div>
             <div className="flex-1 border-t-2 border-dashed border-slate-200 mx-2"></div>
             <div className="w-6 h-6 bg-slate-50 rounded-full -mr-3 shadow-inner"></div>
          </div>

          {/* Bottom Half: Action Required (Yellow/Warning State) */}
          <div className="p-8 pt-10 bg-amber-50">
             <div className="flex items-center gap-3 mb-4 text-amber-600">
                <Clock size={24} className="animate-pulse" />
                <h4 className="font-black text-lg">Awaiting Payment</h4>
             </div>
             <p className="text-amber-800/80 text-sm font-bold mb-6">
                Your details are saved, but your seat is <span className="underline">not secured</span> until operations verifies your funds.
             </p>

             <div className="bg-white p-4 rounded-xl border border-amber-200 mb-6 shadow-sm">
                <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Instructions</p>
                <p className="text-sm font-bold text-slate-700">Please send {CURRENCY} {claimedAmount.toLocaleString()} to Momo: <span className="text-slate-900 font-black">024 XXX XXXX</span>. Use your name as the reference.</p>
             </div>

             {/* The Link to check back */}
             <div className="space-y-3">
                 <button onClick={() => { navigator.clipboard.writeText(passportLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="w-full bg-white border border-slate-200 text-slate-700 font-black py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 active:scale-95 shadow-sm">
                   {copied ? <><CheckCircle size={18} className="text-emerald-500"/> Copied!</> : <><Copy size={18}/> Copy Your Passport Link</>}
                 </button>
                 <p className="text-[10px] text-center font-bold text-slate-400">Save this link. Once operations verifies your payment, it will transform into your Full Digital Passport.</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // ... (Keep the exact same render code for the booking form from the previous step here) ...
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Dynamic Header */}
      <div className="bg-slate-900 text-white pt-12 pb-8 px-6 shadow-xl rounded-b-[3rem] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="max-w-2xl mx-auto relative z-10">
          {settings?.company_logo ? (
            <img src={settings.company_logo} alt="Company Logo" className="h-12 object-contain mb-6 bg-white/10 p-2 rounded-xl backdrop-blur-md"/>
          ) : (
            <div className="text-sm font-black uppercase tracking-widest mb-6 opacity-80">{settings?.company_name || 'Tour Booking'}</div>
          )}
          
          <span className="bg-white/20 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm border border-white/20">Secure Registration</span>
          <h1 className="text-3xl md:text-4xl font-black mt-4 leading-tight">{trip.title}</h1>
          {trip.subtitle && <p className="text-slate-300 font-medium mt-2">{trip.subtitle}</p>}
          
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700 backdrop-blur-sm">
              <Calendar size={16} className="text-teal-400"/>
              <span className="text-xs font-bold">{new Date(trip.start_date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700 backdrop-blur-sm">
              <MapPin size={16} className="text-rose-400"/>
              <span className="text-xs font-bold">{trip.logistics?.pickup || 'TBA'}</span>
            </div>
            {adultPrice > 0 && (
                <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-2xl border border-slate-700 backdrop-blur-sm">
                  <CreditCard size={16} className="text-amber-400"/>
                  <span className="text-xs font-bold">{CURRENCY} {adultPrice.toLocaleString()} / Adult</span>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Form */}
      <div className="max-w-2xl mx-auto px-4 -mt-4 relative z-20">
        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-6 md:p-10 space-y-8">
          
          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-5"><User size={18} style={{ color: APP_COLOR }}/> Primary Traveler Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1">Title</label>
                <select value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                  <option>Mr</option><option>Mrs</option><option>Ms</option><option>Miss</option><option>Dr</option><option>Prof</option>
                </select>
              </div>
              <div className="md:col-span-2 grid grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1">First Name *</label>
                  <input required type="text" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1">Last Name *</label>
                  <input required type="text" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1 flex items-center gap-1"><Phone size={12}/> Phone Number *</label>
                <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1 flex items-center gap-1"><Mail size={12}/> Email Address *</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-5"><BedDouble size={18} style={{ color: APP_COLOR }}/> Rooming & Logistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1">Room Preference</label>
                <select value={formData.room_preference} onChange={e => setFormData({...formData, room_preference: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                  <option>Standard Double (Shared)</option><option>Single Supplement (Private)</option><option>Twin Room</option><option>Family Room</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1">Requested Roommate (If applicable)</label>
                <input type="text" placeholder="Name of partner/friend" value={formData.requested_roommate} onChange={e => setFormData({...formData, requested_roommate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-5"><Utensils size={18} style={{ color: APP_COLOR }}/> Health & Dietary</h3>
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1">Dietary Requirements</label>
                <select value={formData.dietary_needs} onChange={e => setFormData({...formData, dietary_needs: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                  <option>None</option><option>Vegetarian</option><option>Vegan</option><option>Halal</option><option>Kosher</option><option>Gluten-Free</option><option>Nut Allergy</option><option>Seafood Allergy</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1 flex items-center gap-1"><HeartPulse size={12}/> Medical Conditions / Allergies</label>
                <textarea rows={3} placeholder="Please list any medical conditions the tour guide should be aware of..." value={formData.medical_info} onChange={e => setFormData({...formData, medical_info: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none text-sm font-bold text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}></textarea>
              </div>
            </div>
          </div>

          {/* PAYMENT STRUCTURE SELECTION */}
          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-5"><CreditCard size={18} style={{ color: APP_COLOR }}/> Payment Options</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div 
                  onClick={() => { setPaymentMode('full'); setAmountPaid(adultPrice.toString()); }}
                  className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${paymentMode === 'full' ? 'bg-slate-50 shadow-md' : 'bg-white hover:border-slate-300'}`}
                  style={paymentMode === 'full' ? { borderColor: APP_COLOR } : { borderColor: '#e2e8f0' }}
              >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}>
                      <CheckCircle2 size={24}/>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">Pay in Full</h3>
                  <p className="text-sm font-medium text-slate-500">Secure your spot instantly and receive your Digital Passport.</p>
                  <p className="mt-4 font-black text-lg" style={{ color: APP_COLOR }}>{CURRENCY} {adultPrice.toLocaleString()}</p>
              </div>

              <div 
                  onClick={() => { setPaymentMode('partial'); setAmountPaid(requiredDeposit > 0 ? requiredDeposit.toString() : ''); }}
                  className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${paymentMode === 'partial' ? 'bg-amber-50 border-amber-400 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300'}`}
              >
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                      <Wallet size={24}/>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">Installments</h3>
                  <p className="text-sm font-medium text-slate-500">Pay a deposit now and log the rest to your SmartSave vault.</p>
                  <p className="mt-4 font-black text-lg text-amber-600">Min Deposit: {CURRENCY} {requiredDeposit.toLocaleString()}</p>
              </div>
            </div>

            {paymentMode === 'partial' && (
                <div className="mb-6 animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black uppercase text-amber-500 ml-2 block mb-1">Deposit Amount ({CURRENCY})</label>
                    <input 
                        type="number" 
                        min={requiredDeposit} 
                        value={amountPaid} 
                        onChange={e => setAmountPaid(e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-2xl outline-none font-black text-2xl focus:border-amber-500 transition-colors" 
                        placeholder="Enter amount..."
                    />
                </div>
            )}
          </div>

          <button 
            disabled={isSubmitting || !formData.first_name || !formData.last_name || !formData.phone || !paymentMode || (paymentMode === 'partial' && !amountPaid)} 
            type="submit" 
            className="w-full text-white py-5 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale mt-4" 
            style={paymentMode === 'partial' ? { backgroundColor: '#f59e0b' } : { backgroundColor: APP_COLOR }}
          >
            {isSubmitting ? 'Processing...' : paymentMode === 'partial' ? 'Save Seat & Request Payment' : 'Complete Registration'} <ArrowRight size={20}/>
          </button>

        </form>
      </div>
    </div>
  );
};

export default PublicBooking;