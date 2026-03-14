import React, { useState, useEffect } from 'react';
import { useTenant } from '../contexts/TenantContext'; 
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  Send, User, Globe, Plus, Trash2, Bus, Plane, MapPin, PackagePlus, Ticket, 
  ArrowRight, ArrowLeft, CheckCircle, HeartPulse, FileText, ShieldAlert, 
  BedDouble, FileWarning, Utensils, Map, AlignLeft, Ship, Train, X, RefreshCw, 
  Users, Baby, ChevronDown, ChevronUp, Copy, Link as LinkIcon, PiggyBank,
  CheckCircle2, Wallet, UserCircle, UserPlus, Calendar, ShieldCheck
} from 'lucide-react';

interface Trip {
  id: string | number;
  title: string;
  type: string;
  basePrice: number; 
  childPrice?: number;
  infantPrice?: number;
  startDate: string;
  endDate: string;
  capacity: number;
  passengers: number;
}

interface Supplier {
  id: string | number;
  name: string;
  type: string;
}

interface Traveler {
  id: string;
  isLead: boolean;
  title: string;
  firstName: string;
  lastName: string;
  gender: string;
  dob: string;
  nationality: string;
  passportNo: string;
  passportExpiry: string;
  phone: string;
  email: string;
  roomPreference: string;
  requestedRoommate: string;
  dietaryPreference: string;
  medicalConditions: string;
}

interface TripLogistics {
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  pickupLocation: string;
  insuranceOptIn: string;
  specialOccasion: string;
  additionalNotes: string;
}

interface ItineraryStep {
  id: number;
  day: number | string;
  time: string;
  title: string;
  location: string;
  notes: string;
}

interface NewTripState {
  title: string; subtitle: string; description: string; startDate: string; endDate: string;
  capacity: number | string; targetDemographic: string; difficulty: string; visaRequired: string;
  transportModes: string[]; meetingPoint: string; departureTime: string; returnPoint: string; returnTime: string;
  accommodationLevel: string; supplierTransport1: string; supplierTransport2: string;
  supplierHotel: string; supplierActivity: string; supplierFood: string; vehicleDetail: string;
  driver: string; guide: string; hotelNotes: string; foodNotes: string;
  adultPrice: string | number; childPrice: string | number; infantPrice: string | number;
  singleSupplement: string | number; requiredDeposit: string | number; inclusions: string;
  exclusions: string; cancellationPolicy: string; includesInsurance: string; itinerary: ItineraryStep[];
}

const BookingEngine: React.FC = () => {
  const { user } = useTenant(); 
  const navigate = useNavigate();
  const APP_COLOR = user?.themeColor || '#10b981';
  const BASE_CURRENCY = user?.currency || 'GHS';

  const [viewMode, setViewMode] = useState<'book' | 'wizard'>('book');
  const [loadingData, setLoadingData] = useState<boolean>(true);

  const [successLink, setSuccessLink] = useState<string | null>(null);
  const [smartSaveAlert, setSmartSaveAlert] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  
  const [availablePackages, setAvailablePackages] = useState<Trip[]>([]);
  const [suppliersDb, setSuppliersDb] = useState<Supplier[]>([]);
  const [existingPassengers, setExistingPassengers] = useState<any[]>([]); 

  const [isSubmittingBooking, setIsSubmittingBooking] = useState<boolean>(false);
  const [expandedTraveler, setExpandedTraveler] = useState<string | null>(null);

  // Core Booking State
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | null>(null);
  const [amountPaid, setAmountPaid] = useState<string>('');

  const getEmptyTraveler = (isLead: boolean = false): Traveler => ({
    id: `TRV-${Math.random().toString(36).substr(2, 9)}`,
    isLead, title: 'Mr', firstName: '', lastName: '', gender: '', dob: '',
    nationality: '', passportNo: '', passportExpiry: '', phone: '', email: '', 
    roomPreference: 'Double (Shared)', requestedRoommate: '', dietaryPreference: 'None', medicalConditions: ''
  });

  const [travelers, setTravelers] = useState<Traveler[]>([getEmptyTraveler(true)]);
  
  const [logistics, setLogistics] = useState<TripLogistics>({
    emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: 'Spouse',
    pickupLocation: '', insuranceOptIn: 'Declined', specialOccasion: 'None', additionalNotes: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.subscriberId) return;
        
        const { data: tripsData, error: tripsError } = await supabase
            .from('trips')
            .select('*')
            .eq('subscriber_id', user.subscriberId)
            .in('status', ['Draft', 'Planning', 'Active', 'Published', 'active', 'published', 'draft']);
        if (!tripsError && tripsData) {
          const mappedTrips: Trip[] = tripsData.map((t: any) => ({
            id: t.id,
            title: t.title,
            type: (t.transport_modes || ['Bus']).join(' + '),
            basePrice: t.financials?.adultPrice || t.financials?.basePrice || 0,
            childPrice: t.financials?.childPrice || t.financials?.basePrice || 0,
            infantPrice: t.financials?.infantPrice || 0,
            startDate: t.start_date,
            endDate: t.end_date,
            capacity: t.capacity || 0,
            passengers: t.passenger_count || 0
          }));
          setAvailablePackages(mappedTrips);
        }

        const { data: supData } = await supabase.from('suppliers').select('*').eq('subscriber_id', user.subscriberId);
        if (supData) setSuppliersDb(supData);

      } catch (err) { console.error("DB Connection Error:", err); } 
      finally { setLoadingData(false); }
    };
    if (user?.subscriberId) fetchData();
  }, [user, viewMode]);

  const selectedTrip = availablePackages.find(t => String(t.id) === selectedTripId);
  const totalTripCost = selectedTrip ? selectedTrip.basePrice * travelers.length : 0;

  // Fetch Manifest to populate Roommate dropdowns
  useEffect(() => {
    if (!selectedTripId) {
        setExistingPassengers([]);
        return;
    }
    const fetchManifest = async () => {
      try {
        const { data: paxData } = await supabase.from('passengers').select('*').eq('trip_id', selectedTripId);
        if (paxData) setExistingPassengers(paxData);
      } catch (e) { setExistingPassengers([]); }
    };
    fetchManifest();
  }, [selectedTripId]);

  const handleTravelerChange = (id: string, field: keyof Traveler, value: string) => {
    setTravelers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleAddTraveler = () => { setTravelers([...travelers, getEmptyTraveler(false)]); };
  const handleRemoveTraveler = (idToRemove: string) => { setTravelers(travelers.filter(t => t.id !== idToRemove)); };

  const [wizardStep, setWizardStep] = useState<number>(1);
  const [newTrip, setNewTrip] = useState<NewTripState>({
    title: '', subtitle: '', description: '', startDate: '', endDate: '', capacity: 45, 
    targetDemographic: 'All Ages', difficulty: 'Moderate', visaRequired: 'No', transportModes: ['Bus'], 
    meetingPoint: '', departureTime: '', returnPoint: '', returnTime: '', accommodationLevel: '3-Star', 
    supplierTransport1: '', supplierTransport2: '', supplierHotel: '', supplierActivity: '', supplierFood: '', 
    vehicleDetail: '', driver: '', guide: '', hotelNotes: '', foodNotes: '',
    adultPrice: '', childPrice: '', infantPrice: '0', singleSupplement: '', requiredDeposit: '', 
    inclusions: '', exclusions: '', cancellationPolicy: 'Moderate (50% Refund)', includesInsurance: 'No',
    itinerary: [{ id: Date.now(), day: 1, time: '08:00', title: 'Departure & Roll Call', location: 'Meeting Point', notes: '' }]
  });

  // 🟢 CORE BOOKING & ROUTING LOGIC
  const handleConfirmBooking = async () => {
    const lead = travelers[0];
    if (!lead.firstName || !lead.lastName || !selectedTripId) {
        return alert("Lead Traveler Name and Trip Selection are required.");
    }
    if (!user?.subscriberId || !selectedTrip) return;

    setIsSubmittingBooking(true);

    try {
        const currentPaid = Number(amountPaid) || 0;
        
        // --- ROUTE A: SMARTSAVE INSTALLMENT INTERCEPT ---
        if (paymentMode === 'partial' || currentPaid < totalTripCost) {
            
            // Generate a SmartSave Account
            const savePayload = {
                subscriber_id: user.subscriberId,
                customer_name: `${lead.firstName} ${lead.lastName}`,
                customer_phone: lead.phone,
                customer_email: lead.email,
                target_amount: totalTripCost,
                current_balance: currentPaid,
                status: 'Active',
                trip_id: selectedTripId,
                raw_data: { 
                    group_size: travelers.length,
                    roster: travelers, 
                    logistics: logistics 
                }
            };

            const { error: saveError } = await supabase.from('smartsaves').insert([savePayload]);
            if (saveError) throw saveError;

            // Trigger SmartSave Alert Success Modal
            setSmartSaveAlert(true);
            return; 
        }

        // --- ROUTE B: FULL PAYMENT (MANIFEST & BOOKING LEDGER) ---
        const masterBookingPayload = {
            subscriber_id: user.subscriberId,
            trip_id: selectedTripId,
            customer_name: `${lead.firstName} ${lead.lastName}`,
            email: lead.email,
            phone: lead.phone,
            amount_paid: totalTripCost,
            total_cost: totalTripCost,
            payment_status: 'Full',
            payment_method: 'Cash/Transfer',
            pax_count: travelers.length,
            pickup_location: logistics.pickupLocation,
            emergency_contact: logistics,
            lead_name: `${lead.firstName} ${lead.lastName}`,
            raw_data: { roster: travelers }
        };

        const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert([masterBookingPayload]).select();
        if (bookingError || !bookingData) throw new Error(bookingError?.message || "Failed to create booking.");

        const newBookingId = bookingData[0].id;

        // Unpack Roster into Passengers Manifest
        const passengersPayload = travelers.map(t => ({
           booking_id: newBookingId,
           trip_id: selectedTripId,
           subscriber_id: user.subscriberId,
           first_name: t.firstName,
           last_name: t.lastName,
           title: t.title,
           gender: t.gender,
           dob: t.dob || null,
           nationality: t.nationality,
           passport_no: t.passportNo,
           passport_expiry: t.passportExpiry || null,
           is_lead: t.isLead,
           room_preference: t.roomPreference,
           requested_roommate: t.requestedRoommate,
           dietary_needs: t.dietaryPreference,
           medical_info: t.medicalConditions,
           phone: t.phone,
           email: t.email,
           amount_paid: selectedTrip.basePrice,
           payment_status: 'Full',
           boarded: false
        }));

        const { error: paxError } = await supabase.from('passengers').insert(passengersPayload);
        if (paxError) console.error("Error saving passengers:", paxError);

        // Update Trip Capacity
        const newPaxCount = (selectedTrip.passengers || 0) + travelers.length;
        await supabase.from('trips').update({ passenger_count: newPaxCount }).eq('id', selectedTrip.id);

        // Show Success Passport
        setSuccessLink(`${window.location.origin}/passport/${newBookingId}`);
        
        // Reset
        setSelectedTripId('');
        setPaymentMode(null);
        setAmountPaid('');
        setTravelers([getEmptyTraveler(true)]);
        setLogistics({ emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: 'Spouse', pickupLocation: '', insuranceOptIn: 'Declined', specialOccasion: 'None', additionalNotes: '' });
        
    } catch (e: any) { alert(`Booking Error: ${e.message}`); } 
    finally { setIsSubmittingBooking(false); }
  };

  const handlePublishTrip = async () => {
    if (!newTrip.title || !newTrip.adultPrice) return alert("Please provide a title and adult trip cost!");
    if (!user?.subscriberId) return;

    try {
        const payload = {
            subscriber_id: user.subscriberId,
            title: newTrip.title,
            subtitle: newTrip.subtitle,
            description: newTrip.description,
            start_date: newTrip.startDate || null,
            end_date: newTrip.endDate || null,
            capacity: Number(newTrip.capacity),
            status: 'active',
            transport_modes: newTrip.transportModes,
            itinerary: newTrip.itinerary,
            marketing_data: { demographic: newTrip.targetDemographic, difficulty: newTrip.difficulty, visaRequired: newTrip.visaRequired },
            financials: {
              adultPrice: Number(newTrip.adultPrice), childPrice: Number(newTrip.childPrice), infantPrice: Number(newTrip.infantPrice),
              singleSupplement: Number(newTrip.singleSupplement), requiredDeposit: Number(newTrip.requiredDeposit)
            },
            terms: { inclusions: newTrip.inclusions, exclusions: newTrip.exclusions, cancellationPolicy: newTrip.cancellationPolicy, includesInsurance: newTrip.includesInsurance },
            logistics: {
              supplierTransport: newTrip.supplierTransport1, supplierHotel: newTrip.supplierHotel, supplierActivity: newTrip.supplierActivity,
              supplierFood: newTrip.supplierFood, vehicleDetail: newTrip.vehicleDetail, driver: newTrip.driver, guide: newTrip.guide
            }
        };

        const { error } = await supabase.from('trips').insert([payload]);

        if (error) {
            alert("Failed to create trip: " + error.message);
        } else {
            alert(`Success! "${newTrip.title}" created. It is now available in the Operations tab.`);
            setWizardStep(1); setViewMode('book'); window.location.reload(); 
        }
    } catch (e) { alert("Failed to save trip. Check your connection."); }
  };

  const toggleTransportMode = (mode: string) => {
    setNewTrip(prev => {
      const modes = prev.transportModes.includes(mode) ? prev.transportModes.filter(m => m !== mode) : [...prev.transportModes, mode];
      return { ...prev, transportModes: modes.length > 0 ? modes : ['Bus'] }; 
    });
  };

  const handleAddItineraryStep = () => { setNewTrip({ ...newTrip, itinerary: [...newTrip.itinerary, { id: Date.now(), day: 1, time: '', title: '', location: '', notes: '' }] }); };
  const handleUpdateItineraryStep = (id: number, field: keyof ItineraryStep, value: string | number) => { setNewTrip({ ...newTrip, itinerary: newTrip.itinerary.map(step => step.id === id ? { ...step, [field]: field === 'day' ? Number(value) : value } : step) }); };
  const handleRemoveItineraryStep = (id: number) => { setNewTrip({ ...newTrip, itinerary: newTrip.itinerary.filter(step => step.id !== id) }); };

  return (
    <div className="animate-fade-in pb-20 max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-2xl shadow-sm" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}>
                <Ticket size={28} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Booking Engine</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg ml-1">Create reservations and process customer payments.</p>
        </div>
        <div className="flex bg-slate-200 p-1 rounded-xl w-fit">
          <button onClick={() => setViewMode('book')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'book' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} style={viewMode === 'book' ? { color: APP_COLOR } : {}}><Ticket size={16} /> Book Customer</button>
          {(user?.role === 'CEO' || user?.role === 'Operations' || user?.role === 'PROADMIN') && (
            <button onClick={() => setViewMode('wizard')} className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'wizard' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} style={viewMode === 'wizard' ? { color: APP_COLOR } : {}}><PackagePlus size={16} /> Create New Trip</button>
          )}
        </div>
      </header>

      {/* VIEW 1: CUSTOMER BOOKING ENGINE */}
      {viewMode === 'book' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
          
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

              {selectedTrip && (
                 <div className="mt-4 flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-2 text-sm font-bold text-slate-600"><Calendar size={16} style={{ color: APP_COLOR }}/> {new Date(selectedTrip.startDate).toLocaleDateString()}</div>
                     <div className="flex items-center gap-2 text-sm font-bold text-slate-600"><Users size={16} style={{ color: APP_COLOR }}/> {selectedTrip.passengers} / {selectedTrip.capacity} Seats Booked</div>
                 </div>
              )}
          </div>

          {/* STEP 2: PAYMENT PATH GATEWAY */}
          {selectedTrip && (
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 animate-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black">2</div>
                      <h2 className="text-2xl font-black text-slate-800">Payment Structure</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* OPTION A: FULL PAYMENT */}
                      <div 
                          onClick={() => { setPaymentMode('full'); setAmountPaid(totalTripCost.toString()); }}
                          className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${paymentMode === 'full' ? 'bg-slate-50 shadow-md' : 'bg-white hover:border-slate-300'}`}
                          style={paymentMode === 'full' ? { borderColor: APP_COLOR } : { borderColor: '#e2e8f0' }}
                      >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}>
                              <CheckCircle2 size={24}/>
                          </div>
                          <h3 className="text-xl font-black text-slate-800 mb-2">Upfront / Full Payment</h3>
                          <p className="text-sm font-medium text-slate-500">Client is paying the exact total trip cost right now. Adds passengers instantly to Operations Manifest.</p>
                      </div>

                      {/* OPTION B: INSTALLMENTS (Redirects to SmartSave) */}
                      <div 
                          onClick={() => { setPaymentMode('partial'); setAmountPaid(''); }}
                          className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${paymentMode === 'partial' ? 'bg-pink-50 border-pink-400 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                      >
                          <div className="w-12 h-12 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center mb-4">
                              <PiggyBank size={24}/>
                          </div>
                          <h3 className="text-xl font-black text-slate-800 mb-2">Deposits & Installments</h3>
                          <p className="text-sm font-medium text-slate-500">Client wants to secure their spot with a deposit. Keeps manifest clean until balance is paid.</p>
                      </div>
                  </div>
              </div>
          )}

          {/* STEP 3: MULTI-TRAVELER ROSTER */}
          {selectedTrip && paymentMode && (
              <div className="space-y-6 animate-in slide-in-from-bottom-8">
                  
                  <div className="flex items-center gap-3 mb-2 px-4">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black shrink-0">3</div>
                      <h2 className="text-2xl font-black text-slate-800">Traveler Details</h2>
                  </div>

                  {/* Dynamic Form Loop */}
                  {travelers.map((traveler, index) => {
                    const isExpanded = expandedTraveler === traveler.id || (index === 0 && expandedTraveler === null);
                    
                    return (
                      <div key={traveler.id} className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden relative group">
                          
                          <div onClick={() => setExpandedTraveler(isExpanded ? null : traveler.id)} className={`p-6 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'}`}>
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-sm" style={{ backgroundColor: traveler.isLead ? APP_COLOR : '#94a3b8' }}>
                                      <UserCircle size={20}/>
                                  </div>
                                  <div>
                                      <h3 className="text-xl font-black text-slate-800">
                                          {traveler.firstName || traveler.lastName ? `${traveler.firstName} ${traveler.lastName}` : `Traveler ${index + 1}`}
                                          {traveler.isLead && <span className="ml-2 text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-full uppercase tracking-widest align-middle">Lead Contact</span>}
                                      </h3>
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Rate: {BASE_CURRENCY} {selectedTrip.basePrice.toLocaleString()}</p>
                                  </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                  {!traveler.isLead && (
                                      <button onClick={(e) => { e.stopPropagation(); handleRemoveTraveler(traveler.id); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                          <Trash2 size={18}/>
                                      </button>
                                  )}
                                  {isExpanded ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                              </div>
                          </div>

                          {isExpanded && (
                            <div className="p-8 space-y-6">
                               <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                  <select value={traveler.title} onChange={e => handleTravelerChange(traveler.id, 'title', e.target.value)} className="md:col-span-2 bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none text-sm font-bold"><option>Mr</option><option>Mrs</option><option>Ms</option><option>Dr</option><option>Prof</option></select>
                                  <input value={traveler.firstName} onChange={e => handleTravelerChange(traveler.id, 'firstName', e.target.value)} type="text" placeholder="First Name (As on ID)" className="md:col-span-5 bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-800 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} required/>
                                  <input value={traveler.lastName} onChange={e => handleTravelerChange(traveler.id, 'lastName', e.target.value)} type="text" placeholder="Last Name" className="md:col-span-5 bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-800 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} required/>
                               </div>
                               
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Gender</label>
                                    <select value={traveler.gender} onChange={e => handleTravelerChange(traveler.id, 'gender', e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none font-medium text-slate-700 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}><option value="">Select...</option><option>Male</option><option>Female</option></select>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Phone Number {traveler.isLead ? '*' : '(Optional)'}</label>
                                    <input value={traveler.phone} onChange={e => handleTravelerChange(traveler.id, 'phone', e.target.value)} type="tel" placeholder="+233 55 ..." className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none font-medium text-slate-700 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/>
                                  </div>
                               </div>

                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Email Address {traveler.isLead ? '*' : '(Optional)'}</label>
                                    <input value={traveler.email} onChange={e => handleTravelerChange(traveler.id, 'email', e.target.value)} type="email" placeholder="john@example.com" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none font-medium text-slate-700 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Date of Birth</label>
                                    <input value={traveler.dob} onChange={e => handleTravelerChange(traveler.id, 'dob', e.target.value)} type="date" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none font-medium text-slate-700 focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/>
                                  </div>
                               </div>

                               {/* Optional Accordion for extra details */}
                               <details className="group">
                                   <summary className="text-xs font-bold text-slate-500 cursor-pointer list-none flex items-center gap-2 hover:text-slate-800 transition-colors">
                                       <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center group-open:rotate-180 transition-transform"><ChevronDown size={14}/></span>
                                       Add Medical, Room & Passport Info (Optional)
                                   </summary>
                                   <div className="pt-6 space-y-6">
                                      <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl">
                                        <h5 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-1"><HeartPulse size={12}/> Health & Comfort</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                            <label className="text-[10px] font-bold text-orange-500 uppercase ml-1 block mb-1">Dietary Requirements</label>
                                            <select value={traveler.dietaryPreference} onChange={e => handleTravelerChange(traveler.id, 'dietaryPreference', e.target.value)} className="w-full bg-white border border-orange-200 p-3 rounded-xl outline-none text-sm text-slate-700"><option value="None">No Restrictions</option><option value="Vegetarian">Vegetarian</option><option value="Vegan">Vegan</option><option value="Halal">Halal</option><option value="Gluten-Free">Gluten-Free</option><option value="Allergies">Severe Allergies</option></select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-bold text-orange-500 uppercase ml-1 block mb-1">Medical Conditions / Mobility</label>
                                            <input value={traveler.medicalConditions} onChange={e => handleTravelerChange(traveler.id, 'medicalConditions', e.target.value)} type="text" placeholder="e.g. Asthma, Wheelchair required..." className="w-full bg-white border border-orange-200 p-3 rounded-xl outline-none text-sm" />
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input value={traveler.nationality} onChange={e => handleTravelerChange(traveler.id, 'nationality', e.target.value)} type="text" placeholder="Nationality" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm" />
                                        <input value={traveler.passportNo} onChange={e => handleTravelerChange(traveler.id, 'passportNo', e.target.value)} type="text" placeholder="Passport / ID No." className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm font-mono text-slate-700" />
                                        <div>
                                          <input value={traveler.passportExpiry} onChange={e => handleTravelerChange(traveler.id, 'passportExpiry', e.target.value)} type="date" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none text-sm text-slate-600" />
                                        </div>
                                      </div>
                                   </div>
                               </details>
                            </div>
                          )}
                      </div>
                    );
                  })}

                  <button 
                      onClick={handleAddTraveler}
                      className="w-full py-5 rounded-[2rem] border-2 border-dashed font-black text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                      style={{ borderColor: `${APP_COLOR}40` }}
                  >
                      <UserPlus size={18}/> Add Another Traveler to Group
                  </button>

                  {/* FINAL CHECKOUT & SUMMARY */}
                  <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 md:p-10 text-white mt-10 relative overflow-hidden">
                      <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: APP_COLOR }}></div>
                      
                      <div className="flex flex-col md:flex-row justify-between md:items-end gap-8 border-b border-slate-800 pb-8 mb-8 relative z-10">
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><ShieldCheck size={14}/> Booking Summary</p>
                              <h3 className="text-3xl font-black">{travelers.length} Travelers</h3>
                              <p className="text-slate-400 font-medium mt-1 text-sm">Destination: {selectedTrip.title}</p>
                          </div>
                          <div className="md:text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Cart Value</p>
                              <h2 className="text-5xl font-black tracking-tight" style={{ color: APP_COLOR }}>
                                  <span className="text-2xl mr-2 text-slate-500">{BASE_CURRENCY}</span>
                                  {totalTripCost.toLocaleString()}
                              </h2>
                          </div>
                      </div>

                      {paymentMode === 'partial' && (
                        <div className="mb-8">
                            <label className="text-xs font-bold text-pink-400 uppercase tracking-widest mb-2 block flex items-center gap-2"><PiggyBank size={16}/> Deposit Paid Today ({BASE_CURRENCY})</label>
                            <input 
                                type="number" 
                                value={amountPaid} 
                                onChange={e => setAmountPaid(e.target.value)} 
                                className="w-full bg-slate-950 border border-slate-700 text-white p-4 rounded-xl outline-none font-black text-2xl focus:border-pink-500 transition-colors" 
                                placeholder="Enter amount..."
                            />
                            {Number(amountPaid) > 0 && (
                                <p className="text-sm font-bold text-slate-400 mt-3">
                                    Outstanding Balance: <span className="text-orange-400">{BASE_CURRENCY} {(totalTripCost - Number(amountPaid)).toLocaleString()}</span>
                                </p>
                            )}
                        </div>
                      )}

                      <button 
                          onClick={handleConfirmBooking}
                          disabled={isSubmittingBooking || (paymentMode === 'partial' && !amountPaid)}
                          className="w-full py-5 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 hover:brightness-110 relative z-10"
                          style={paymentMode === 'partial' ? { backgroundColor: '#ec4899', boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.4)' } : { backgroundColor: APP_COLOR, boxShadow: `0 10px 25px -5px ${APP_COLOR}60` }}
                      >
                          {isSubmittingBooking ? <RefreshCw size={22} className="animate-spin"/> : paymentMode === 'partial' ? <PiggyBank size={22}/> : <Wallet size={22}/>}
                          {isSubmittingBooking ? 'Processing...' : paymentMode === 'partial' ? 'Log to SmartSave vault' : 'Confirm Full Payment & Book Group'}
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

      {/* ================= SMARTSAVE REDIRECT MODAL ================= */}
      {smartSaveAlert && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-lg w-full shadow-2xl text-center animate-in zoom-in-95 duration-500 relative overflow-hidden">
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-50 rounded-full blur-3xl"></div>
               <div className="w-24 h-24 bg-pink-100 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 shadow-inner">
                  <PiggyBank size={48} strokeWidth={2.5} />
               </div>
               
               <h2 className="text-3xl font-black text-slate-800 mb-2 relative z-10">SmartSave Activated</h2>
               <p className="text-slate-500 font-medium mb-8 relative z-10 leading-relaxed">
                  Because this is a partial payment, this booking has been routed to your <strong>SmartSave Vault</strong>. 
                  They will be added to the official Trip Manifest once their balance is fully cleared!
               </p>
               
               <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                  <button 
                     onClick={() => {
                         setSmartSaveAlert(false);
                         navigate('/smartsave');
                     }} 
                     className="flex-1 bg-pink-500 hover:bg-pink-400 text-white font-black py-4 rounded-2xl shadow-lg shadow-pink-500/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                     Open SmartSave <ArrowRight size={18}/>
                  </button>
                  <button 
                     onClick={() => {
                         setSmartSaveAlert(false);
                         setSelectedTripId('');
                         setPaymentMode(null);
                         setAmountPaid('');
                         setTravelers([getEmptyTraveler(true)]);
                     }} 
                     className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl transition-all"
                  >
                     New Booking
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* ================= SUCCESS MODAL (FULL PAYMENT) ================= */}
      {successLink && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 max-w-lg w-full shadow-2xl text-center animate-in zoom-in-95 duration-500 relative overflow-hidden">
            
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ backgroundColor: APP_COLOR }}></div>

            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 shadow-inner" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}>
              <CheckCircle size={48} strokeWidth={2.5} />
            </div>
            
            <h2 className="text-3xl font-black text-slate-800 mb-2 relative z-10">Booking Secured!</h2>
            <p className="text-slate-500 font-medium mb-8 relative z-10">
              The group has been added to the Operations Manifest. Here is the Lead Contact's Digital Passport link:
            </p>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-4 mb-8 text-left relative z-10 group hover:border-slate-300 transition-colors">
              <div className="bg-white p-2 rounded-xl shadow-sm shrink-0" style={{ color: APP_COLOR }}>
                  <LinkIcon size={20} />
              </div>
              <span className="text-sm font-bold text-slate-700 break-all select-all">{successLink}</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(successLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 active:scale-95"
              >
                {copied ? <><CheckCircle size={18} className="text-emerald-500"/> Copied!</> : <><Copy size={18}/> Copy Link</>}
              </button>
              
              <a 
                href={successLink} 
                target="_blank" 
                rel="noreferrer"
                className="flex-1 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 hover:brightness-110"
                style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}
              >
                Open Passport <ArrowRight size={18} />
              </a>
            </div>

            <button 
              onClick={() => setSuccessLink(null)} 
              className="mt-8 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors relative z-10 uppercase tracking-widest"
            >
              Create Another Booking
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingEngine;