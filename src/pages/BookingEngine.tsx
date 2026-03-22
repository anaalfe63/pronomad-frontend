import React, { useState, useEffect, useMemo } from 'react';
import { useTenant } from '../contexts/TenantContext'; 
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLogger';
import { useNavigate } from 'react-router-dom'; 
import { 
  Map, Calendar, Users, CheckCircle2, Wallet, 
  UserCircle, UserPlus, Trash2, ChevronUp, ChevronDown, Plus, ArrowLeft,
  MapPin, Utensils, HeartPulse, BedDouble, ShieldAlert, ShieldCheck,
  FileText, ArrowRight, CheckCircle, PackagePlus, Ticket,
  Bus, Plane, Train, Ship, PiggyBank, RefreshCw, X, Link as LinkIcon, Copy,
  BrainCircuit, Calculator, AlertCircle, Globe, PlaneLanding, CreditCard, Banknote,
  FileWarning, AlignLeft
} from 'lucide-react';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

interface Trip {
  id: string | number; title: string; type: string; basePrice: number; 
  childPrice?: number; infantPrice?: number; startDate: string; endDate: string;
  capacity: number; passengers: number;
}

interface Supplier { id: string | number; name: string; type: string; }

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

interface ItineraryStep { id: number; day: number | string; time: string; title: string; location: string; notes: string; }

interface NewTripState {
  title: string; subtitle: string; description: string; startDate: string; endDate: string; capacity: number | string; targetDemographic: string; difficulty: string; visaRequired: string;
  transportModes: string[]; meetingPoint: string; departureTime: string; returnPoint: string; returnTime: string;
  accommodationLevel: string; supplierTransport1: string; supplierTransport2: string; supplierHotel: string; supplierActivity: string; supplierFood: string; vehicleDetail: string; driver: string; guide: string; hotelNotes: string; foodNotes: string;
  adultPrice: string | number; childPrice: string | number; infantPrice: string | number; singleSupplement: string | number; requiredDeposit: string | number; inclusions: string; exclusions: string; cancellationPolicy: string; includesInsurance: string; itinerary: ItineraryStep[];
}

const BookingEngine: React.FC = () => {
  const { user, settings } = useTenant(); 
  const navigate = useNavigate();
  const APP_COLOR = settings?.theme_color || '#10b981';
  const BASE_CURRENCY = settings?.currency || 'GHS';

  const [viewMode, setViewMode] = useState<'book' | 'wizard'>('book');
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [successLink, setSuccessLink] = useState<string | null>(null);
  const [smartSaveAlert, setSmartSaveAlert] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [subscriberPlan, setSubscriberPlan] = useState<string>('startup');
  
  const [availablePackages, setAvailablePackages] = useState<Trip[]>([]);
  const [suppliersDb, setSuppliersDb] = useState<Supplier[]>([]);
  const [existingPassengers, setExistingPassengers] = useState<any[]>([]); 

  const [isSubmittingBooking, setIsSubmittingBooking] = useState<boolean>(false);
  const [expandedTraveler, setExpandedTraveler] = useState<string | null>(null);

  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | null>(null);
  const [transactionType, setTransactionType] = useState<'cash' | 'online'>('online');
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

  // Inject Paystack
  useEffect(() => {
    if (!window.PaystackPop) {
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.subscriberId) return;
        
        const { data: subData } = await supabase.from('subscribers').select('plan').eq('id', user.subscriberId).single();
        if (subData) setSubscriberPlan(subData.plan || 'startup');

        const { data: tripsData, error: tripsError } = await supabase.from('trips').select('*').eq('subscriber_id', user.subscriberId).in('status', ['Draft', 'Planning', 'Active', 'Published', 'active', 'published', 'draft']);
        if (!tripsError && tripsData) {
          setAvailablePackages(tripsData.map((t: any) => ({
            id: t.id, title: t.title, type: (t.transport_modes || ['Bus']).join(' + '),
            basePrice: t.financials?.adultPrice || t.financials?.basePrice || 0, childPrice: t.financials?.childPrice || 0, infantPrice: t.financials?.infantPrice || 0,
            startDate: t.start_date, endDate: t.end_date, capacity: t.capacity || 0, passengers: t.passenger_count || 0
          })));
        }
        const { data: supData } = await supabase.from('suppliers').select('*').eq('subscriber_id', user.subscriberId);
        if (supData) setSuppliersDb(supData);
      } catch (err) { console.error(err); } finally { setLoadingData(false); }
    };
    if (user?.subscriberId) fetchData();
  }, [user, viewMode]);

  const selectedTrip = availablePackages.find(t => String(t.id) === selectedTripId);
  const totalTripCost = selectedTrip ? selectedTrip.basePrice * travelers.length : 0;
  const currentPaid = paymentMode === 'full' ? totalTripCost : (Number(layawayMeta.initialDeposit) || 0);

  const planProjection = useMemo(() => {
    if (!selectedTrip || paymentMode !== 'partial') return null;
    let tripDate = selectedTrip.startDate ? new Date(selectedTrip.startDate) : new Date();
    if (isNaN(tripDate.getTime())) { tripDate = new Date(); tripDate.setMonth(tripDate.getMonth() + 3); }
    const cutoffDate = new Date(tripDate); cutoffDate.setDate(tripDate.getDate() - 14);
    const today = new Date();
    let daysRemaining = Math.floor((cutoffDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 1) daysRemaining = 1; 

    const balance = Math.max(0, totalTripCost - currentPaid);
    let periods = 1;
    if (layawayMeta.frequency === 'Weekly') periods = Math.max(1, Math.floor(daysRemaining / 7));
    if (layawayMeta.frequency === 'Monthly') periods = Math.max(1, Math.floor(daysRemaining / 30));

    const installmentAmount = balance / periods;
    let feasibilityScore = 'Safe', warning = '';
    if (installmentAmount > 3000 && layawayMeta.frequency === 'Monthly') { feasibilityScore = 'Risky'; warning = 'High installment amount. Suggest a higher deposit.'; }
    if (daysRemaining < 30 && balance > 1000) { feasibilityScore = 'Unrealistic'; warning = 'Timeline is too tight to realistically save this balance.'; }

    return { tripName: selectedTrip.title, targetAmount: totalTripCost, balance, cutoffDate: cutoffDate.toLocaleDateString(), periods, installmentAmount: installmentAmount.toFixed(2), feasibilityScore, warning };
  }, [selectedTrip, layawayMeta.frequency, currentPaid, totalTripCost, paymentMode]);

  useEffect(() => {
    if (!selectedTripId) { setExistingPassengers([]); return; }
    const fetchManifest = async () => {
      try {
        const { data: paxData } = await supabase.from('passengers').select('*').eq('trip_id', selectedTripId);
        if (paxData) setExistingPassengers(paxData);
      } catch (e) { setExistingPassengers([]); }
    };
    fetchManifest();
  }, [selectedTripId]);

  const handleTravelerChange = (id: string, field: keyof Traveler, value: string) => { setTravelers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t)); };
  const handleAddTraveler = () => { setTravelers([...travelers, getEmptyTraveler(false)]); setExpandedTraveler(travelers[travelers.length - 1]?.id || null); };
  const handleRemoveTraveler = (idToRemove: string) => { setTravelers(travelers.filter(t => t.id !== idToRemove)); };

  const saveBookingToDatabase = async (paystackRef: string | null = null) => {
      const lead = travelers[0];
      try {
          if (paymentMode === 'partial') {
              if (!planProjection) throw new Error("Calculation error.");
              const clientDetails = { email: lead.email, dob: lead.dob, idNumber: lead.passportNo, tripId: selectedTripId, travelers: travelers, logistics: logistics, groupMeta: { adults: travelers.length, children: 0, infants: 0 } };
              const saveRef = `SS-${Math.floor(1000 + Math.random() * 9000)}`;

              const savePayload = {
                  subscriber_id: user?.subscriberId, save_ref: saveRef, customer: `${lead.firstName} ${lead.lastName}`, phone: lead.phone || '', client_details: clientDetails,
                  target_trip: planProjection.tripName, target_amount: planProjection.targetAmount, current_saved: currentPaid, 
                  frequency: layawayMeta.frequency, periods: planProjection.periods, installment_amount: Number(planProjection.installmentAmount), 
                  deadline: planProjection.cutoffDate, status: (currentPaid >= planProjection.targetAmount) ? 'Completed' : 'Active',
                  start_date: new Date().toISOString(), 
                  transactions: currentPaid > 0 ? [{ id: `TXN-${Date.now()}`, date: new Date().toLocaleString(), amount: currentPaid, note: transactionType === 'online' ? `Online Deposit (Ref: ${paystackRef})` : 'Cash Deposit (Back-Office)' }] : []
              };

              const { error: saveError } = await supabase.from('smartsave').insert([savePayload]);
              if (saveError) throw saveError;
              await logAudit(user?.subscriberId || '', user?.fullName || 'System', user?.role || '', 'Initiated SmartSave Booking', `Started layaway for ${lead.firstName} on "${selectedTrip?.title}".`);

              setSmartSaveAlert(true);
              return; 
          }

          // ROUTE B: FULL PAYMENT
          const masterBookingPayload = {
              subscriber_id: user?.subscriberId, trip_id: selectedTripId, customer_name: `${lead.firstName} ${lead.lastName}`,
              email: lead.email, phone: lead.phone, amount_paid: totalTripCost, total_cost: totalTripCost, payment_status: 'Full',
              payment_method: transactionType === 'online' ? 'Online Gateway' : 'Cash/Transfer', pax_count: travelers.length, pickup_location: logistics.pickupLocation,
              emergency_contact: { name: lead.emergencyContactName, phone: lead.emergencyContactPhone, relation: lead.emergencyContactRelation },
              lead_name: `${lead.firstName} ${lead.lastName}`, raw_data: { roster: travelers, logistics, paystack_ref: paystackRef }
          };

          const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert([masterBookingPayload]).select();
          if (bookingError || !bookingData) throw new Error(bookingError?.message || "Failed to create booking.");

          const newBookingId = bookingData[0].id;

          const passengersPayload = travelers.map(t => ({
             booking_id: newBookingId, trip_id: selectedTripId, subscriber_id: user?.subscriberId,
             first_name: t.firstName, last_name: t.lastName, title: t.title, gender: t.gender, dob: t.dob || null,
             nationality: t.nationality, passport_no: t.passportNo, passport_expiry: t.passportExpiry || null,
             is_lead: t.isLead, room_preference: t.roomPreference, requested_roommate: t.requestedRoommate,
             dietary_needs: t.dietaryPreference, medical_info: t.medicalConditions, phone: t.phone, email: t.email,
             amount_paid: Number(selectedTrip?.basePrice), payment_status: 'Full', boarded: false, raw_data: t
          }));

          const { error: paxError } = await supabase.from('passengers').insert(passengersPayload);
          if (paxError) console.error("Error saving passengers:", paxError);

          const newPaxCount = (Number(selectedTrip?.passengers) || 0) + travelers.length;
          await supabase.from('trips').update({ passenger_count: newPaxCount }).eq('id', selectedTripId);

          await logAudit(user?.subscriberId || '', user?.fullName || 'System', user?.role || '', 'Confirmed Full Booking', `Booked ${travelers.length} pax on "${selectedTrip?.title}".`);

          setSuccessLink(`${window.location.origin}/passport/${newBookingId}`);
      } catch (e: any) {
          alert(`Database Error: ${e.message}`);
      } finally {
          setIsSubmittingBooking(false);
      }
  };

  const triggerCheckout = async () => {
    const lead = travelers[0];
    if (!lead.firstName || !lead.lastName || !selectedTripId) return alert("Lead Traveler Name and Trip Selection are required.");
    if (!user?.subscriberId || !selectedTrip) return;

    if (paymentMode === 'partial' && planProjection?.feasibilityScore === 'Unrealistic') {
        if (!window.confirm("The AI flagged this plan as UNREALISTIC. Proceed anyway?")) return;
    }

    setIsSubmittingBooking(true);

    if (transactionType === 'cash') {
        await saveBookingToDatabase(null);
    } else {
        if (!window.PaystackPop) {
            setIsSubmittingBooking(false);
            return alert("Payment gateway is loading. Please try again in a few seconds.");
        }

        const rawSubaccount = settings?.merchant_number || '';
        const isValidSubaccount = rawSubaccount.startsWith('ACCT_');
        
        const isStartup = subscriberPlan.toLowerCase() === 'startup' || subscriberPlan.toLowerCase() === 'starter';
        const platformFeeKobo = isStartup ? Math.round((currentPaid * 100) * 0.05) : 0;

        const handler = window.PaystackPop.setup({
            key: 'pk_test_1aba8bc644e635df6587945e80d59ea5add57110', // 🔴 Replace with production key
            email: lead.email || 'customer@example.com',
            amount: currentPaid * 100, 
            currency: BASE_CURRENCY,
            reference: `PRONOMAD-OPS-${Date.now()}`,
            ...(isValidSubaccount ? { subaccount: rawSubaccount, transaction_charge: platformFeeKobo, bearer: "subaccount" } : {}), 
            callback: function(response: any) { saveBookingToDatabase(response.reference); },
            onClose: function() { setIsSubmittingBooking(false); alert("Payment window closed. Booking was NOT saved."); }
        });

        handler.openIframe();
    }
  };

  const [wizardStep, setWizardStep] = useState<number>(1);
  const [newTrip, setNewTrip] = useState<NewTripState>({ title: '', subtitle: '', description: '', startDate: '', endDate: '', capacity: 45, targetDemographic: 'All Ages', difficulty: 'Moderate', visaRequired: 'No', transportModes: ['Bus'], meetingPoint: '', departureTime: '', returnPoint: '', returnTime: '', accommodationLevel: '3-Star', supplierTransport1: '', supplierTransport2: '', supplierHotel: '', supplierActivity: '', supplierFood: '', vehicleDetail: '', driver: '', guide: '', hotelNotes: '', foodNotes: '', adultPrice: '', childPrice: '', infantPrice: '0', singleSupplement: '', requiredDeposit: '', inclusions: '', exclusions: '', cancellationPolicy: 'Moderate (50% Refund)', includesInsurance: 'No', itinerary: [{ id: Date.now(), day: 1, time: '08:00', title: 'Departure & Roll Call', location: 'Meeting Point', notes: '' }] });
  
  const handlePublishTrip = async () => {
    if (!newTrip.title || !newTrip.adultPrice) return alert("Please provide a title and adult trip cost!");
    if (!user?.subscriberId) return;

    try {
        const payload = {
            subscriber_id: user.subscriberId, title: newTrip.title, subtitle: newTrip.subtitle, description: newTrip.description,
            start_date: newTrip.startDate || null, end_date: newTrip.endDate || null, capacity: Number(newTrip.capacity), status: 'active',
            transport_modes: newTrip.transportModes, itinerary: newTrip.itinerary, marketing_data: { demographic: newTrip.targetDemographic, difficulty: newTrip.difficulty, visaRequired: newTrip.visaRequired },
            financials: { adultPrice: Number(newTrip.adultPrice), childPrice: Number(newTrip.childPrice), infantPrice: Number(newTrip.infantPrice), singleSupplement: Number(newTrip.singleSupplement), requiredDeposit: Number(newTrip.requiredDeposit) },
            terms: { inclusions: newTrip.inclusions, exclusions: newTrip.exclusions, cancellationPolicy: newTrip.cancellationPolicy, includesInsurance: newTrip.includesInsurance },
            logistics: { supplierTransport: newTrip.supplierTransport1, supplierHotel: newTrip.supplierHotel, supplierActivity: newTrip.supplierActivity, supplierFood: newTrip.supplierFood, vehicleDetail: newTrip.vehicleDetail, driver: newTrip.driver, guide: newTrip.guide }
        };

        const { error } = await supabase.from('trips').insert([payload]);

        if (error) { alert("Failed to create trip: " + error.message); } 
        else {
            await logAudit(user.subscriberId, user.fullName || user.username || 'System', user.role, 'Published New Trip', `Created new tour package: "${newTrip.title}" with a capacity of ${newTrip.capacity} seats.`);
            alert(`Success! "${newTrip.title}" created. It is now available in the Operations tab.`);
            setWizardStep(1); setViewMode('book'); window.location.reload(); 
        }
    } catch (e) { alert("Failed to save trip. Check your connection."); }
  };

  const toggleTransportMode = (mode: string) => { setNewTrip(prev => { const modes = prev.transportModes.includes(mode) ? prev.transportModes.filter(m => m !== mode) : [...prev.transportModes, mode]; return { ...prev, transportModes: modes.length > 0 ? modes : ['Bus'] }; }); };
  const handleAddItineraryStep = () => { setNewTrip({ ...newTrip, itinerary: [...newTrip.itinerary, { id: Date.now(), day: 1, time: '', title: '', location: '', notes: '' }] }); };
  const handleUpdateItineraryStep = (id: number, field: keyof ItineraryStep, value: string | number) => { setNewTrip({ ...newTrip, itinerary: newTrip.itinerary.map(step => step.id === id ? { ...step, [field]: field === 'day' ? Number(value) : value } : step) }); };
  const handleRemoveItineraryStep = (id: number) => { setNewTrip({ ...newTrip, itinerary: newTrip.itinerary.filter(step => step.id !== id) }); };

  return (
    <>
      <div className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-90 pointer-events-none" style={{ backgroundImage: `url('/my-bg.jpg')` }}></div>

      <div className="relative z-10 animate-fade-in pb-20 max-w-7xl mx-auto px-4 md:px-0 mt-6">
        
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-2xl shadow-sm" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}><Ticket size={28} /></div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Booking Engine</h1>
            </div>
            <p className="text-slate-500 font-medium text-lg ml-1">Comprehensive reservation & passenger profiling.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-200 p-1 rounded-xl w-fit">
              <button onClick={() => setViewMode('book')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'book' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
                <Ticket size={16} /> Book Customer
              </button>
            </div>
            {(user?.role === 'CEO' || user?.role === 'Operations' || user?.role === 'PROADMIN') && (
              <button onClick={() => setViewMode('wizard')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all shadow-lg hover:shadow-xl active:scale-95 ${viewMode === 'wizard' ? 'ring-4 ring-offset-2 ring-slate-200' : 'hover:-translate-y-0.5'}`} style={{ backgroundColor: APP_COLOR, color: '#fff' }}>
                  <PackagePlus size={18} /> Create New Trip
              </button>
            )}
          </div>
        </header>

        {viewMode === 'book' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
            
            {/* STEP 1: SELECT TRIP */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8">
                <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black">1</div>
                    <h2 className="text-2xl font-black text-slate-800">Select Destination</h2>
                </div>

                {loadingData ? (
                    <div className="py-8 flex justify-center"><RefreshCw size={32} className="animate-spin text-slate-300"/></div>
                ) : (
                    <div className="relative">
                        <Map className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                        <select 
                            value={selectedTripId}
                            onChange={e => { setSelectedTripId(e.target.value); setPaymentMode(null); }}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-black text-lg p-5 pl-12 rounded-2xl outline-none focus:ring-2 transition-all cursor-pointer appearance-none"
                            style={{ '--tw-ring-color': APP_COLOR } as any}
                        >
                            <option value="">-- Choose an upcoming trip --</option>
                            {availablePackages.map(t => (
                                <option key={t.id} value={t.id}>{t.title} ({BASE_CURRENCY} {t.basePrice.toLocaleString()} per pax)</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* STEP 2: PAYMENT STRUCTURE */}
            {selectedTrip && (
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black">2</div>
                        <h2 className="text-2xl font-black text-slate-800">Payment Structure</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div onClick={() => setPaymentMode('full')} className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${paymentMode === 'full' ? 'bg-slate-50 shadow-md' : 'bg-white hover:border-slate-300'}`} style={paymentMode === 'full' ? { borderColor: APP_COLOR } : { borderColor: '#e2e8f0' }}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}><CheckCircle2 size={24}/></div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">Upfront / Full Payment</h3>
                            <p className="text-sm font-medium text-slate-500">Client is paying the exact total trip cost right now. Adds passengers instantly to Operations Manifest.</p>
                        </div>
                        <div onClick={() => { setPaymentMode('partial'); setLayawayMeta({ frequency: 'Monthly', initialDeposit: '' }); }} className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${paymentMode === 'partial' ? 'bg-pink-50 border-pink-400 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                            <div className="w-12 h-12 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center mb-4"><PiggyBank size={24}/></div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">Deposits & Installments</h3>
                            <p className="text-sm font-medium text-slate-500">Client wants to secure their spot with a deposit. Sent directly to AI Layaway system.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 🌟 STEP 3: THE COMPREHENSIVE TRAVELER FORM */}
            {selectedTrip && paymentMode && (
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-2 px-4">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black shrink-0">3</div>
                        <h2 className="text-2xl font-black text-slate-800">Comprehensive Traveler Manifest</h2>
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
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Cost: {BASE_CURRENCY} {selectedTrip.basePrice.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!traveler.isLead && (<button onClick={(e) => { e.stopPropagation(); handleRemoveTraveler(traveler.id); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>)}
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

                    <button onClick={handleAddTraveler} className="w-full py-5 rounded-[2rem] border-2 border-dashed font-black text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm" style={{ borderColor: `${APP_COLOR}40` }}>
                        <UserPlus size={18}/> Add Another Traveler to Manifest
                    </button>

                    {/* FINAL CHECKOUT & SUMMARY */}
                    <div className={`rounded-[2.5rem] shadow-2xl p-8 md:p-10 mt-10 relative overflow-hidden ${paymentMode === 'partial' ? 'bg-slate-50 border border-slate-200' : 'bg-slate-900 text-white'}`}>
                        {paymentMode !== 'partial' && <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: APP_COLOR }}></div>}
                        
                        <div className={`flex flex-col md:flex-row justify-between md:items-end gap-8 border-b pb-8 mb-8 relative z-10 ${paymentMode === 'partial' ? 'border-slate-200' : 'border-slate-800'}`}>
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${paymentMode === 'partial' ? 'text-slate-500' : 'text-slate-400'}`}><ShieldCheck size={14}/> Booking Summary</p>
                                <h3 className={`text-3xl font-black ${paymentMode === 'partial' ? 'text-slate-800' : 'text-white'}`}>{travelers.length} Travelers</h3>
                                <p className={`font-medium mt-1 text-sm ${paymentMode === 'partial' ? 'text-slate-500' : 'text-slate-400'}`}>Destination: {selectedTrip.title}</p>
                            </div>
                            <div className="md:text-right">
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${paymentMode === 'partial' ? 'text-slate-500' : 'text-slate-400'}`}>Total Cart Value</p>
                                <h2 className="text-5xl font-black tracking-tight" style={paymentMode === 'partial' ? { color: '#0f172a' } : { color: APP_COLOR }}>
                                    <span className={`text-2xl mr-2 ${paymentMode === 'partial' ? 'text-slate-400' : 'text-slate-500'}`}>{BASE_CURRENCY}</span>
                                    {totalTripCost.toLocaleString()}
                                </h2>
                            </div>
                        </div>

                        {/* 🌟 INTEGRATED SMARTSAVE CALCULATOR (For Partial Payments) */}
                        {paymentMode === 'partial' && planProjection && (
                          <div className="mb-8 animate-in slide-in-from-bottom-4">
                              <div className="bg-white border border-slate-200 p-6 rounded-2xl mb-6 shadow-sm">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Initial Deposit (GHS)</label>
                                  <input type="number" value={layawayMeta.initialDeposit} onChange={e => setLayawayMeta({...layawayMeta, initialDeposit: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-black text-slate-800 outline-none focus:border-teal-500 transition-colors" placeholder="0.00"/>
                              </div>

                              <div className={`border-2 rounded-2xl p-6 transition-all shadow-xl ${planProjection.feasibilityScore === 'Unrealistic' ? 'bg-red-50 border-red-200' : planProjection.feasibilityScore === 'Risky' ? 'bg-orange-50 border-orange-200' : 'bg-slate-900 border-slate-800'}`}>
                                  <div className="flex justify-between items-center mb-4 border-b pb-4 border-slate-200/20">
                                      <h4 className={`font-black flex items-center gap-2 ${planProjection.feasibilityScore === 'Safe' ? "text-teal-400" : planProjection.feasibilityScore === 'Risky' ? "text-orange-600" : "text-red-600"}`}>
                                          <Calculator size={18}/> AI Layaway Projection
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

                        {/* 🌟 NEW: IN-PERSON PAYMENT METHOD SELECTOR */}
                        <div className="mb-6 flex gap-4 p-2 bg-black/10 rounded-2xl border border-white/10">
                            <button 
                                onClick={(e) => { e.preventDefault(); setTransactionType('online'); }} 
                                className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${transactionType === 'online' ? 'bg-white text-slate-900 shadow-md' : 'text-white/60 hover:text-white'}`}
                            >
                                <CreditCard size={18}/> Pay Online (Card / Momo)
                            </button>
                            <button 
                                onClick={(e) => { e.preventDefault(); setTransactionType('cash'); }} 
                                className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${transactionType === 'cash' ? 'bg-white text-slate-900 shadow-md' : 'text-white/60 hover:text-white'}`}
                            >
                                <Banknote size={18}/> Log Cash Payment
                            </button>
                        </div>

                        <button 
                            onClick={triggerCheckout}
                            disabled={isSubmittingBooking}
                            className="w-full py-5 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 hover:brightness-110 relative z-10"
                            style={paymentMode === 'partial' && planProjection?.feasibilityScore === 'Unrealistic' ? { backgroundColor: '#ef4444' } : paymentMode === 'partial' ? { backgroundColor: '#ec4899', boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.4)' } : { backgroundColor: APP_COLOR, boxShadow: `0 10px 25px -5px ${APP_COLOR}60` }}
                        >
                            {isSubmittingBooking ? <RefreshCw size={22} className="animate-spin"/> : paymentMode === 'partial' ? (planProjection?.feasibilityScore === 'Unrealistic' ? <AlertCircle size={22}/> : <BrainCircuit size={22}/>) : <Wallet size={22}/>}
                            {isSubmittingBooking ? 'Processing...' : transactionType === 'cash' ? 'Save Booking to Database' : paymentMode === 'partial' ? (planProjection?.feasibilityScore === 'Unrealistic' ? 'Override Risk & Process via Paystack' : 'Process Layaway via Paystack') : 'Process Full Payment via Paystack'}
                        </button>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* VIEW 2: NEW TRIP CREATION WIZARD */}
      {viewMode === 'wizard' && (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-8 relative px-4">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 z-0 rounded-full"></div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 z-0 rounded-full transition-all duration-500" style={{ width: wizardStep === 1 ? '0%' : wizardStep === 2 ? '33%' : wizardStep === 3 ? '66%' : '100%', backgroundColor: APP_COLOR }}></div>
            {[1, 2, 3, 4].map((stepNumber) => (
              <div key={stepNumber} className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${wizardStep >= stepNumber ? 'text-white shadow-lg' : 'bg-slate-100 text-slate-400 border-2 border-slate-200'}`} style={wizardStep >= stepNumber ? { backgroundColor: APP_COLOR, boxShadow: `0 4px 14px 0 ${APP_COLOR}40` } : {}}>
                {wizardStep > stepNumber ? <CheckCircle size={18} /> : stepNumber}
              </div>
            ))}
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
            {wizardStep === 1 && (
              <div className="space-y-6">
                <div><h2 className="text-2xl font-bold text-slate-800">Trip Basics & Marketing</h2></div>
                <div className="grid grid-cols-1 gap-4">
                  <input value={newTrip.title} onChange={e => setNewTrip({...newTrip, title: e.target.value})} type="text" placeholder="Package Title (e.g., Summer in Zanzibar)" className="w-full bg-slate-50 border p-4 rounded-xl outline-none font-bold text-lg text-slate-800 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} />
                  <input value={newTrip.subtitle} onChange={e => setNewTrip({...newTrip, subtitle: e.target.value})} type="text" placeholder="Marketing Subtitle (e.g., 5 Days of pure relaxation...)" className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-slate-600 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} />
                  <textarea value={newTrip.description} onChange={e => setNewTrip({...newTrip, description: e.target.value})} placeholder="Detailed description for brochure..." rows={3} className="w-full bg-slate-50 border p-4 rounded-xl outline-none resize-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}></textarea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2"><label className="text-xs font-bold text-slate-400 uppercase ml-2 block mb-1">Start Date</label><input type="date" value={newTrip.startDate} onChange={e => setNewTrip({...newTrip, startDate: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-slate-700 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                  <div className="md:col-span-2"><label className="text-xs font-bold text-slate-400 uppercase ml-2 block mb-1">End Date</label><input type="date" value={newTrip.endDate} onChange={e => setNewTrip({...newTrip, endDate: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-slate-700 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div><label className="text-xs font-bold text-slate-400 uppercase ml-2 block mb-1">Max Capacity</label><input type="number" value={newTrip.capacity} onChange={e => setNewTrip({...newTrip, capacity: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-slate-700 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase ml-2 block mb-1">Demographic</label><select value={newTrip.targetDemographic} onChange={e => setNewTrip({...newTrip, targetDemographic: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-slate-700 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}><option>All Ages</option><option>Adults Only (18+)</option><option>Corporate</option><option>Couples / Honeymoon</option></select></div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase ml-2 block mb-1">Difficulty</label><select value={newTrip.difficulty} onChange={e => setNewTrip({...newTrip, difficulty: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-slate-700 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}><option>Easy (Relaxation)</option><option>Moderate (Walking)</option><option>Strenuous (Hiking)</option></select></div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase ml-2 block mb-1">Visa Required?</label><select value={newTrip.visaRequired} onChange={e => setNewTrip({...newTrip, visaRequired: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-orange-600 font-bold focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}><option>No</option><option>Yes (Required)</option><option>Visa on Arrival</option></select></div>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-6">
                <div><h2 className="text-2xl font-bold text-slate-800">Granular Pricing & Terms</h2></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Adult Trip Cost ({BASE_CURRENCY}) *</label><input type="number" value={newTrip.adultPrice} onChange={e => setNewTrip({...newTrip, adultPrice: e.target.value})} className="w-full bg-white border p-4 rounded-xl outline-none font-bold text-xl focus:ring-2 transition-all" style={{ color: APP_COLOR, '--tw-ring-color': APP_COLOR } as any} placeholder="Required" /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Child Trip Cost ({BASE_CURRENCY})</label><input type="number" value={newTrip.childPrice} onChange={e => setNewTrip({...newTrip, childPrice: e.target.value})} className="w-full bg-white border p-4 rounded-xl outline-none font-bold text-lg text-slate-600 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="Optional" /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Infant Trip Cost ({BASE_CURRENCY})</label><input type="number" value={newTrip.infantPrice} onChange={e => setNewTrip({...newTrip, infantPrice: e.target.value})} className="w-full bg-white border p-4 rounded-xl outline-none font-bold text-lg text-slate-600 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Single Supplement Fee ({BASE_CURRENCY})</label><input type="number" value={newTrip.singleSupplement} onChange={e => setNewTrip({...newTrip, singleSupplement: e.target.value})} className="w-full bg-white border border-purple-200 p-4 rounded-xl outline-none font-bold text-purple-700" placeholder="For private room request" /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Required Deposit ({BASE_CURRENCY})</label><input type="number" value={newTrip.requiredDeposit} onChange={e => setNewTrip({...newTrip, requiredDeposit: e.target.value})} className="w-full bg-white border p-4 rounded-xl outline-none font-bold text-lg text-slate-600 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold text-slate-400 uppercase ml-2 block mb-1">Package Inclusions</label><textarea value={newTrip.inclusions} onChange={e => setNewTrip({...newTrip, inclusions: e.target.value})} placeholder="What is included (Flights, Hotel, Breakfast...)" rows={3} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-sm focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}></textarea></div>
                  <div><label className="text-xs font-bold text-slate-400 uppercase ml-2 block mb-1">Package Exclusions</label><textarea value={newTrip.exclusions} onChange={e => setNewTrip({...newTrip, exclusions: e.target.value})} placeholder="What is NOT included (Visa, Alcohol...)" rows={3} className="w-full bg-slate-50 border border-orange-100 p-4 rounded-xl outline-none text-sm focus:border-orange-400 transition-colors"></textarea></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 flex items-center gap-1 mb-1"><FileWarning size={12}/> Cancellation Policy</label><select value={newTrip.cancellationPolicy} onChange={e => setNewTrip({...newTrip, cancellationPolicy: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-sm focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}><option>Flexible (Full Refund 48hrs)</option><option>Moderate (50% Refund)</option><option>Strict (Non-refundable)</option></select></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 flex items-center gap-1 mb-1"><ShieldAlert size={12}/> Included Travel Insurance?</label><select value={newTrip.includesInsurance} onChange={e => setNewTrip({...newTrip, includesInsurance: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none text-sm focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}><option>No (Client buys separately)</option><option>Yes (Basic Coverage)</option><option>Yes (Premium Coverage)</option></select></div>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-6">
                <div><h2 className="text-2xl font-bold text-slate-800">Multi-Modal Logistics & Vendors</h2><p className="text-sm text-slate-500 mt-1">Select all transport modes required for this trip, then assign vendors.</p></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <button onClick={() => toggleTransportMode('Bus')} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${newTrip.transportModes.includes('Bus') ? 'bg-slate-50' : 'border-slate-100 text-slate-400'}`} style={newTrip.transportModes.includes('Bus') ? { borderColor: APP_COLOR, color: APP_COLOR } : {}}><Bus size={24} /><span className="font-bold text-sm">Bus / Coach</span></button>
                  <button onClick={() => toggleTransportMode('Flight')} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${newTrip.transportModes.includes('Flight') ? 'bg-slate-50' : 'border-slate-100 text-slate-400'}`} style={newTrip.transportModes.includes('Flight') ? { borderColor: APP_COLOR, color: APP_COLOR } : {}}><Plane size={24} /><span className="font-bold text-sm">Flight</span></button>
                  <button onClick={() => toggleTransportMode('Train')} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${newTrip.transportModes.includes('Train') ? 'bg-slate-50' : 'border-slate-100 text-slate-400'}`} style={newTrip.transportModes.includes('Train') ? { borderColor: APP_COLOR, color: APP_COLOR } : {}}><Train size={24} /><span className="font-bold text-sm">Train</span></button>
                  <button onClick={() => toggleTransportMode('Boat')} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${newTrip.transportModes.includes('Boat') ? 'bg-slate-50' : 'border-slate-100 text-slate-400'}`} style={newTrip.transportModes.includes('Boat') ? { borderColor: APP_COLOR, color: APP_COLOR } : {}}><Ship size={24} /><span className="font-bold text-sm">Boat / Ferry</span></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase mb-3">Departure Routing</h4>
                    <label className="text-[10px] font-bold text-slate-500 ml-1 block mb-1">Initial Meeting Point / Terminal</label>
                    <input type="text" value={newTrip.meetingPoint} onChange={e => setNewTrip({...newTrip, meetingPoint: e.target.value})} placeholder="e.g. Kotoka Terminal 3" className="w-full bg-white border p-3 rounded-xl outline-none mb-3 text-sm focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} />
                    <label className="text-[10px] font-bold text-slate-500 ml-1 block mb-1">Departure Time</label>
                    <input type="time" value={newTrip.departureTime} onChange={e => setNewTrip({...newTrip, departureTime: e.target.value})} className="w-full bg-white border p-3 rounded-xl outline-none text-sm focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase mb-3">Return Routing</h4>
                    <label className="text-[10px] font-bold text-slate-500 ml-1 block mb-1">Final Drop-off Point</label>
                    <input type="text" value={newTrip.returnPoint} onChange={e => setNewTrip({...newTrip, returnPoint: e.target.value})} placeholder="e.g. Accra Mall" className="w-full bg-white border p-3 rounded-xl outline-none mb-3 text-sm focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} />
                    <label className="text-[10px] font-bold text-slate-500 ml-1 block mb-1">Estimated Return Time</label>
                    <input type="time" value={newTrip.returnTime} onChange={e => setNewTrip({...newTrip, returnTime: e.target.value})} className="w-full bg-white border p-3 rounded-xl outline-none text-sm focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} />
                  </div>
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mt-6 border-b pb-2">Supplier Assignments</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 space-y-4">
                    <label className="text-xs font-black text-blue-800 uppercase flex items-center gap-2"><Bus size={14}/> Transport & Fleet</label>
                    <div className="flex gap-2">
                      <select value={newTrip.supplierTransport1} onChange={e => setNewTrip({...newTrip, supplierTransport1: e.target.value})} className="w-full bg-white border border-blue-200 p-3 rounded-xl outline-none text-sm text-slate-700">
                        <option value="">Leg 1 Provider...</option>
                        {suppliersDb.filter(s => s.type === 'Flight' || s.type === 'Bus' || s.type === 'Transport').map(sup => (<option key={sup.id} value={sup.name}>{sup.name}</option>))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={newTrip.vehicleDetail} onChange={e => setNewTrip({...newTrip, vehicleDetail: e.target.value})} placeholder="Veh/Flight Nos." className="w-full bg-white border border-blue-200 p-3 rounded-xl text-sm outline-none"/>
                      <input type="text" value={newTrip.driver} onChange={e => setNewTrip({...newTrip, driver: e.target.value})} placeholder="Driver/Pilot Names" className="w-full bg-white border border-blue-200 p-3 rounded-xl text-sm outline-none"/>
                    </div>
                  </div>
                  <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100 space-y-4">
                    <label className="text-xs font-black text-purple-800 uppercase flex items-center gap-2"><BedDouble size={14}/> Accommodation</label>
                    <select value={newTrip.accommodationLevel} onChange={e => setNewTrip({...newTrip, accommodationLevel: e.target.value})} className="w-full bg-white border border-purple-200 p-3 rounded-xl outline-none text-sm font-bold text-slate-700"><option>Standard / 3-Star</option><option>Luxury / 4-Star</option><option>Premium / 5-Star</option><option>Lodge / Camping</option></select>
                    <select value={newTrip.supplierHotel} onChange={e => setNewTrip({...newTrip, supplierHotel: e.target.value})} className="w-full bg-white border border-purple-200 p-3 rounded-xl outline-none text-sm text-slate-700">
                      <option value="">Assigned Hotel / Lodge...</option>
                      {suppliersDb.filter(s => s.type === 'Hotel' || s.type === 'Lodge').map(sup => (<option key={sup.id} value={sup.name}>{sup.name}</option>))}
                    </select>
                    <input type="text" value={newTrip.hotelNotes} onChange={e => setNewTrip({...newTrip, hotelNotes: e.target.value})} placeholder="Booking Ref / Notes" className="w-full bg-white border border-purple-200 p-3 rounded-xl text-sm outline-none"/>
                  </div>
                  <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100 space-y-4">
                    <label className="text-xs font-black text-orange-800 uppercase flex items-center gap-2"><Map size={14}/> Activities & Parks</label>
                    <select value={newTrip.supplierActivity} onChange={e => setNewTrip({...newTrip, supplierActivity: e.target.value})} className="w-full bg-white border border-orange-200 p-3 rounded-xl outline-none text-sm text-slate-700">
                      <option value="">Assigned Attraction / Park...</option>
                      {suppliersDb.filter(s => s.type !== 'Hotel' && s.type !== 'Flight' && s.type !== 'Bus').map(sup => (<option key={sup.id} value={sup.name}>{sup.name}</option>))}
                    </select>
                    <input type="text" value={newTrip.guide} onChange={e => setNewTrip({...newTrip, guide: e.target.value})} placeholder="Lead Tour Guide Name" className="w-full bg-white border border-orange-200 p-3 rounded-xl text-sm outline-none"/>
                  </div>
                  <div className="bg-green-50/50 p-5 rounded-2xl border border-green-100 space-y-4">
                    <label className="text-xs font-black text-green-800 uppercase flex items-center gap-2"><Utensils size={14}/> Meals</label>
                    <select value={newTrip.supplierFood} onChange={e => setNewTrip({...newTrip, supplierFood: e.target.value})} className="w-full bg-white border border-green-200 p-3 rounded-xl outline-none text-sm text-slate-700">
                      <option value="">Assigned Caterer / Restaurant...</option>
                      {suppliersDb.map(sup => (<option key={sup.id} value={sup.name}>{sup.name}</option>))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-6">
                <div><h2 className="text-2xl font-bold text-slate-800">Daily Itinerary Planner</h2><p className="text-sm text-slate-500 mt-1">This timeline will be sent directly to the Driver/Guide's mobile app during operations.</p></div>
                <div className="space-y-4">
                  {newTrip.itinerary.map((step) => (
                    <div key={step.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative group pl-6 md:pl-8 transition-all hover:border-slate-300">
                      <div className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl opacity-50 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: APP_COLOR }}></div>
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex flex-row md:flex-col gap-3 md:w-32 shrink-0 md:pt-1">
                          <div className="flex-1 md:flex-none"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Day</label><input type="number" min="1" value={step.day} onChange={e => handleUpdateItineraryStep(step.id, 'day', e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl font-black text-center outline-none bg-transparent" style={{ color: APP_COLOR }}/></div>
                          <div className="flex-1 md:flex-none"><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Time</label><input type="time" value={step.time} onChange={e => handleUpdateItineraryStep(step.id, 'time', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none transition-colors" style={{ '--tw-ring-color': APP_COLOR } as any}/></div>
                        </div>
                        <div className="flex-1 w-full space-y-4 pr-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1"><AlignLeft size={12}/> Activity Title</label><input type="text" value={step.title} onChange={e => handleUpdateItineraryStep(step.id, 'title', e.target.value)} placeholder="e.g. Arrive at Mole Park" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-bold text-slate-800 transition-colors focus:ring-2" style={{ '--tw-ring-color': APP_COLOR } as any}/></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1"><MapPin size={12}/> Exact Location</label><input type="text" value={step.location} onChange={e => handleUpdateItineraryStep(step.id, 'location', e.target.value)} placeholder="GPS or Landmark" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none text-slate-600 transition-colors focus:ring-2" style={{ '--tw-ring-color': APP_COLOR } as any}/></div>
                          </div>
                          <div><label className="text-[10px] font-bold text-orange-400 uppercase flex items-center gap-1 mb-1"><FileText size={12}/> Internal Guide Notes (Hidden from clients)</label><input type="text" value={step.notes} onChange={e => handleUpdateItineraryStep(step.id, 'notes', e.target.value)} placeholder="e.g. Ensure VIPs are seated at the front. Pay toll in cash." className="w-full p-3 bg-orange-50/30 border border-orange-200 rounded-xl text-sm outline-none text-slate-600 focus:border-orange-400 transition-colors"/></div>
                        </div>
                      </div>
                      {newTrip.itinerary.length > 1 && (<button onClick={() => handleRemoveItineraryStep(step.id)} className="absolute top-4 right-4 bg-slate-100 text-slate-400 p-2 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm"><X size={14}/></button>)}
                    </div>
                  ))}
                </div>
                <button onClick={handleAddItineraryStep} className="w-full py-4 border-2 border-dashed rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-slate-50" style={{ borderColor: `${APP_COLOR}40`, color: APP_COLOR }}><Plus size={18}/> Add Another Itinerary Step</button>
              </div>
            )}

            <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-100">
              <button onClick={() => setWizardStep(wizardStep - 1)} disabled={wizardStep === 1} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${wizardStep === 1 ? 'opacity-0 cursor-default' : 'text-slate-500 hover:bg-slate-100'}`}><ArrowLeft size={18} /> Back</button>
              {wizardStep < 4 ? (
                <button onClick={() => setWizardStep(wizardStep + 1)} className="flex items-center gap-2 px-8 py-3 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 hover:brightness-110" style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}>Next Step <ArrowRight size={18} /></button>
              ) : (
                <button onClick={handlePublishTrip} className="flex items-center gap-2 px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xl transition-all active:scale-95"><PackagePlus size={18} /> Publish Package</button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* SMARTSAVE REDIRECT MODAL */}
      {smartSaveAlert && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-lg w-full shadow-2xl text-center animate-in zoom-in-95 duration-500 relative overflow-hidden">
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-50 rounded-full blur-3xl"></div>
               <div className="w-24 h-24 bg-pink-100 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 shadow-inner">
                  <PiggyBank size={48} strokeWidth={2.5} />
               </div>
               <h2 className="text-3xl font-black text-slate-800 mb-2 relative z-10">SmartSave Activated</h2>
               <p className="text-slate-500 font-medium mb-8 relative z-10 leading-relaxed">
                  Payment processed. This booking has been routed to your <strong>SmartSave Vault</strong>. 
                  They will be added to the official Trip Manifest once their balance is fully cleared!
               </p>
               <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                  <button onClick={() => { setSmartSaveAlert(false); navigate('/smartsave'); }} className="flex-1 bg-pink-500 hover:bg-pink-400 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95">
                     Open SmartSave <ArrowRight size={18}/>
                  </button>
                  <button onClick={() => { setSmartSaveAlert(false); setSelectedTripId(''); setPaymentMode(null); setLayawayMeta({ frequency: 'Monthly', initialDeposit: '' }); setTravelers([getEmptyTraveler(true)]); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl transition-all">
                     New Booking
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* SUCCESS MODAL (FULL PAYMENT) */}
      {successLink && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-lg w-full shadow-2xl text-center animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ backgroundColor: APP_COLOR }}></div>
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 shadow-inner" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}>
              <CheckCircle size={48} strokeWidth={2.5} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2 relative z-10">Booking Secured!</h2>
            <p className="text-slate-500 font-medium mb-8 relative z-10">The group has been added to the Operations Manifest. Here is the Lead Contact's Digital Passport link:</p>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-4 mb-8 text-left relative z-10 group hover:border-slate-300 transition-colors">
              <div className="bg-white p-2 rounded-xl shadow-sm shrink-0" style={{ color: APP_COLOR }}><LinkIcon size={20} /></div>
              <span className="text-sm font-bold text-slate-700 break-all select-all">{successLink}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <button onClick={() => { navigator.clipboard.writeText(successLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 active:scale-95">
                {copied ? <><CheckCircle size={18} className="text-emerald-500"/> Copied!</> : <><Copy size={18}/> Copy Link</>}
              </button>
              <a href={successLink} target="_blank" rel="noreferrer" className="flex-1 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 hover:brightness-110" style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}>
                Open Passport <ArrowRight size={18} />
              </a>
            </div>
            <button onClick={() => setSuccessLink(null)} className="mt-8 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors relative z-10 uppercase tracking-widest">Create Another Booking</button>
         </div>
        </div>
      )}
    </div>
    </>
  );
};

export default BookingEngine;