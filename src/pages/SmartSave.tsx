import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  PiggyBank, Plus, TrendingUp, Search, X, CheckCircle, AlertCircle, 
  CreditCard, Calculator, Clock, MapPin, History, TrendingDown, 
  Settings, CheckSquare, Ban, Edit3, MessageSquare, BrainCircuit, ShieldAlert,
  UserCircle, Mail, RefreshCw, Globe, Users, User, Baby, ChevronDown, ChevronUp,
  HeartPulse, BedDouble, CloudOff, CloudUpload
} from 'lucide-react';
// 🟢 Swapped Auth Engine
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';

// --- TYPES ---
interface Transaction { id: string; date: string; amount: number; note: string; }
interface Traveler {
  id: string; isLead: boolean; title: string; firstName: string; lastName: string;
  gender: string; dob: string; nationality: string; passportNo: string; passportExpiry: string;
  phone: string; email: string; roomPreference: string; requestedRoommate: string;
  dietaryPreference: string; medicalConditions: string;
}
interface TripLogistics {
  emergencyContactName: string; emergencyContactPhone: string; emergencyContactRelation: string;
  pickupLocation: string; insuranceOptIn: string; specialOccasion: string; additionalNotes: string;
}
interface GroupMeta { adults: number; children: number; infants: number; }
interface ClientDetails { 
  email: string; dob: string; idNumber: string; tripId?: string | number; 
  travelers?: Traveler[]; logistics?: TripLogistics; groupMeta?: GroupMeta;
}
interface SavingsPlan {
  id: string; dbId?: string; customer: string; phone: string; 
  clientDetails: ClientDetails; 
  targetTrip: string; targetAmount: number; currentSaved: number; frequency: string; 
  periods: number; installmentAmount: number; deadline: string; status: 'Active' | 'Completed' | 'Cancelled';
  startDate: string; transactions: Transaction[];
}
interface Trip { 
  id: string | number; title: string; adultPrice: number; childPrice: number; infantPrice: number; startDate?: string; 
}
interface EditFormState { 
    customer: string; phone: string; email: string; dob: string; idNumber: string; 
    frequency: string; status: string; 
}

// 🟢 OFFLINE SYNC TYPE
interface SyncAction {
  id: number;
  table: string;
  action: 'UPDATE' | 'INSERT' | 'DELETE' | 'COMPLEX_BOOKING';
  recordId?: string | number;
  payload?: any;
}

const SmartSave: React.FC = () => {
  const { user } = useTenant();
  
  // 1. Core Databases
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([]);
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [existingPassengers, setExistingPassengers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTab, setEditTab] = useState<'client' | 'plan'>('client'); 
  const [selectedPlan, setSelectedPlan] = useState<SavingsPlan | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [manageTab, setManageTab] = useState<'schedule' | 'ledger' | 'ai'>('schedule');

  // 3. New Plan Form States
  const [bookingMeta, setBookingMeta] = useState({ tripId: '', adults: 1, children: 0, infants: 0 });
  const [layawayMeta, setLayawayMeta] = useState({ frequency: 'Monthly', initialDeposit: '' });
  const [expandedTraveler, setExpandedTraveler] = useState<string | null>(null);

  const getEmptyTraveler = (isLead: boolean = false): Traveler => ({
    id: `TRV-${Math.random().toString(36).substr(2, 9)}`, isLead, title: 'Mr', firstName: '', lastName: '', gender: '', dob: '',
    nationality: '', passportNo: '', passportExpiry: '', phone: '', email: '', roomPreference: 'Double (Shared)', requestedRoommate: '',
    dietaryPreference: 'None', medicalConditions: ''
  });

  const [travelers, setTravelers] = useState<Traveler[]>([getEmptyTraveler(true)]);
  const [logistics, setLogistics] = useState<TripLogistics>({
    emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: 'Spouse',
    pickupLocation: '', insuranceOptIn: 'Declined', specialOccasion: 'None', additionalNotes: ''
  });

  const [editFormData, setEditFormData] = useState<EditFormState>({ customer: '', phone: '', email: '', dob: '', idNumber: '', frequency: 'Monthly', status: 'Active' });

  // 🟢 OFFLINE SYNC STATE ENGINE
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<SyncAction[]>(() => {
     const saved = localStorage.getItem('pronomad_smartsave_sync');
     return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
     localStorage.setItem('pronomad_smartsave_sync', JSON.stringify(pendingSyncs));
  }, [pendingSyncs]);

  const processSyncQueue = useCallback(async () => {
      if (!navigator.onLine || pendingSyncs.length === 0 || isSyncing) return;
      
      setIsSyncing(true);
      const remaining = [...pendingSyncs];

      for (const task of pendingSyncs) {
          try {
              if (task.action === 'INSERT') {
                  const { error } = await supabase.from(task.table).insert([task.payload]);
                  if (error) throw error;
              } else if (task.action === 'UPDATE') {
                  const { error } = await supabase.from(task.table).update(task.payload).eq('id', task.recordId);
                  if (error) throw error;
              } else if (task.action === 'COMPLEX_BOOKING') {
                  // If it's a completed layaway, we must push it to the bookings table
                  const { error } = await supabase.from('bookings').insert([task.payload]);
                  if (error) throw error;
              }
              remaining.shift();
          } catch (e) {
              console.error("SmartSave Sync failed:", task.id, e);
              break; 
          }
      }
      
      setPendingSyncs(remaining);
      setIsSyncing(false);
      if (remaining.length === 0) fetchData(); 
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


  // --- DATABASE SYNC ---
  const fetchData = async () => {
      setLoading(true);
      try {
          if (!user?.subscriberId) return;

          const [tripsRes, plansRes] = await Promise.all([
             supabase.from('trips').select('*').eq('subscriber_id', user.subscriberId),
             supabase.from('smartsave').select('*').eq('subscriber_id', user.subscriberId).order('created_at', { ascending: false })
          ]);

          if (tripsRes.data) {
              setAvailableTrips(tripsRes.data.map((t:any) => {
                  const fin = t.financials || {};
                  return {
                      id: t.id, title: t.title, startDate: t.start_date,
                      adultPrice: Number(fin.adultPrice) || Number(fin.basePrice) || 0,
                      childPrice: Number(fin.childPrice) || Number(fin.basePrice) || 0,
                      infantPrice: Number(fin.infantPrice) || 0
                  };
              }));
          }

          if (plansRes.data) {
              const formatted = plansRes.data.map((p:any) => ({
                  ...p, dbId: p.id, targetTrip: p.target_trip, targetAmount: Number(p.target_amount),
                  currentSaved: Number(p.current_saved), installmentAmount: Number(p.installment_amount),
                  clientDetails: p.client_details || { email: '', dob: '', idNumber: '' },
                  transactions: p.transactions || []
              }));
              setSavingsPlans(formatted);
          }
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.subscriberId) fetchData(); }, [user?.subscriberId]);

  // --- TRAVELER ARRAY MANAGEMENT ---
  useEffect(() => {
    const totalPax = bookingMeta.adults + bookingMeta.children + bookingMeta.infants;
    setTravelers(prev => {
      const newArray = [...prev];
      while (newArray.length < totalPax) newArray.push(getEmptyTraveler(false));
      if (newArray.length > totalPax) newArray.length = totalPax;
      return newArray;
    });

    if (bookingMeta.tripId && user?.subscriberId) {
        const fetchManifest = async () => {
          try {
            const { data } = await supabase.from('passengers').select('*').eq('subscriber_id', user.subscriberId).eq('trip_id', bookingMeta.tripId);
            if (data) setExistingPassengers(data);
          } catch (e) { setExistingPassengers([]); }
        };
        fetchManifest();
    } else { setExistingPassengers([]); }
  }, [bookingMeta.adults, bookingMeta.children, bookingMeta.infants, bookingMeta.tripId, user?.subscriberId]);

  const handleTravelerChange = (id: string, field: keyof Traveler, value: string) => {
    setTravelers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // --- SMART CALCULATOR & PREDICTIVE ENGINE ---
  const selectedTripObj = useMemo(() => availableTrips.find(t => String(t.id) === String(bookingMeta.tripId)), [bookingMeta.tripId, availableTrips]);

  const planProjection = useMemo(() => {
    if (!selectedTripObj) return null;

    let tripDate = selectedTripObj.startDate ? new Date(selectedTripObj.startDate) : new Date();
    if (isNaN(tripDate.getTime())) { tripDate = new Date(); tripDate.setMonth(tripDate.getMonth() + 3); }

    const cutoffDate = new Date(tripDate);
    cutoffDate.setDate(tripDate.getDate() - 14);

    const today = new Date();
    let daysRemaining = Math.floor((cutoffDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining < 1) daysRemaining = 1; 
    
    const adultTotal = bookingMeta.adults * selectedTripObj.adultPrice;
    const childTotal = bookingMeta.children * selectedTripObj.childPrice;
    const infantTotal = bookingMeta.infants * selectedTripObj.infantPrice;
    const targetAmount = adultTotal + childTotal + infantTotal;

    const deposit = Number(layawayMeta.initialDeposit) || 0;
    const balance = Math.max(0, targetAmount - deposit);

    let periods = 1;
    if (layawayMeta.frequency === 'Weekly') periods = Math.max(1, Math.floor(daysRemaining / 7));
    if (layawayMeta.frequency === 'Monthly') periods = Math.max(1, Math.floor(daysRemaining / 30));

    const installmentAmount = balance / periods;

    let feasibilityScore = 'Safe';
    let warning = '';
    if (installmentAmount > 3000 && layawayMeta.frequency === 'Monthly') {
        feasibilityScore = 'Risky';
        warning = 'Installment is very high. High risk of default. Suggest a higher deposit.';
    }
    if (daysRemaining < 30 && balance > 1000) {
        feasibilityScore = 'Unrealistic';
        warning = 'Timeline is too tight to realistically save this balance.';
    }

    return {
      tripName: selectedTripObj.title, targetAmount, balance, cutoffDate: cutoffDate.toLocaleDateString(), 
      periods, installmentAmount: installmentAmount.toFixed(2), feasibilityScore, warning
    };
  }, [selectedTripObj, layawayMeta.frequency, layawayMeta.initialDeposit, bookingMeta]);

  // --- ACTIONS ---
  const handleCreatePlan = async () => {
    const lead = travelers[0];
    if (!lead.firstName || !lead.lastName) return alert("Please enter the Lead Traveler's name.");
    if (!bookingMeta.tripId) return alert("Please select a trip from the dropdown.");
    if (!planProjection) return alert("Calculation error. Please ensure the selected trip has a valid price.");

    if (planProjection.feasibilityScore === 'Unrealistic') {
        if (!window.confirm("The AI flagged this plan as UNREALISTIC. Are you sure you want to proceed?")) return;
    }
    
    const initialDepositNum = Number(layawayMeta.initialDeposit) || 0;
    
    const clientDetails: ClientDetails = { 
        email: lead.email, dob: lead.dob, idNumber: lead.passportNo, tripId: bookingMeta.tripId,
        travelers: travelers, logistics: logistics, groupMeta: { adults: bookingMeta.adults, children: bookingMeta.children, infants: bookingMeta.infants }
    };
    
    const payload = {
        subscriber_id: user?.subscriberId,
        customer: `${lead.firstName} ${lead.lastName}`, phone: lead.phone, client_details: clientDetails,
        target_trip: planProjection.tripName, target_amount: planProjection.targetAmount, 
        current_saved: initialDepositNum, frequency: layawayMeta.frequency, periods: planProjection.periods, 
        installment_amount: Number(planProjection.installmentAmount), deadline: planProjection.cutoffDate, 
        status: (initialDepositNum >= planProjection.targetAmount) ? 'Completed' : 'Active',
        start_date: new Date().toISOString(),
        transactions: initialDepositNum > 0 ? [{ id: `TXN-${Date.now()}`, date: new Date().toLocaleString(), amount: initialDepositNum, note: 'Initial Deposit' }] : []
    };

    // Optimistic Reset
    setIsNewPlanModalOpen(false);
    setBookingMeta({ tripId: '', adults: 1, children: 0, infants: 0 });
    setLayawayMeta({ frequency: 'Monthly', initialDeposit: '' });
    setTravelers([getEmptyTraveler(true)]);
    setLogistics({ emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: 'Spouse', pickupLocation: '', insuranceOptIn: 'Declined', specialOccasion: 'None', additionalNotes: '' });

    try {
        if (!navigator.onLine) throw new Error("Offline");
        const { error } = await supabase.from('smartsave').insert([payload]);
        if (error) throw error;
        fetchData(); 
        alert("AI Layaway Plan successfully created! All passenger data stored.");
    } catch(e) { 
        setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'smartsave', action: 'INSERT', payload: payload }]);
    }
  };

  const executeDeposit = async (amount: number | string, note: string = 'Installment Payment') => {
    if (!selectedPlan) return;
    
    const depositAmount = Number(amount);
    const currentSaved = Number(selectedPlan.currentSaved);
    const newTotal = currentSaved + depositAmount;
    
    const newTx: Transaction = { id: `TXN-${Date.now()}`, date: new Date().toLocaleString(), amount: depositAmount, note };
    const updatedStatus = newTotal >= selectedPlan.targetAmount ? 'Completed' : selectedPlan.status;
    const allTx = [...(selectedPlan.transactions || []), newTx];

    const updatedPlan = {...selectedPlan, currentSaved: newTotal, status: updatedStatus, transactions: allTx};
    setSavingsPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    setSelectedPlan(updatedPlan);
    setIsDepositModalOpen(false);

    try {
        if (!navigator.onLine) throw new Error("Offline");

        // 1. UPDATE LAYAWAY LEDGER
        const { error } = await supabase.from('smartsave').update({ 
            current_saved: newTotal, status: updatedStatus, transactions: allTx 
        }).eq('id', selectedPlan.dbId);

        if (error) throw error;

        // 2. AUTO-PUSH TO BOOKING MANIFEST IF COMPLETED
        if (updatedStatus === 'Completed' && selectedPlan.status !== 'Completed') {
            const tId = selectedPlan.clientDetails?.tripId || availableTrips.find(t => t.title === selectedPlan.targetTrip)?.id;
            
            if (tId) {
                const hasFullTravelerData = selectedPlan.clientDetails?.travelers && selectedPlan.clientDetails.travelers.length > 0;
                const nameParts = selectedPlan.customer.split(' ');
                const fallbackLead = {
                    firstName: nameParts[0], lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
                    phone: selectedPlan.phone, email: selectedPlan.clientDetails?.email || '',
                    dob: selectedPlan.clientDetails?.dob || '', passportNo: selectedPlan.clientDetails?.idNumber || '',
                    isLead: true, roomPreference: 'Double (Shared)', requestedRoommate: '', dietaryPreference: 'None', medicalConditions: ''
                };

                const bookingPayload = {
                    subscriber_id: user?.subscriberId,
                    trip_id: tId,
                    lead_name: selectedPlan.customer,
                    customer_name: selectedPlan.customer,
                    email: selectedPlan.clientDetails?.email || '',
                    phone: selectedPlan.phone,
                    amount_paid: newTotal,
                    payment_status: 'Full',
                    check_in_status: false,
                    raw_data: {
                      groupMeta: selectedPlan.clientDetails?.groupMeta || { adults: 1, children: 0, infants: 0 },
                      leadTraveler: hasFullTravelerData ? selectedPlan.clientDetails.travelers![0] : fallbackLead,
                      allTravelers: hasFullTravelerData ? selectedPlan.clientDetails.travelers : [fallbackLead],
                      logistics: selectedPlan.clientDetails?.logistics || { emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: 'N/A', pickupLocation: 'TBD', insuranceOptIn: 'Declined', specialOccasion: 'None', additionalNotes: 'Auto-booked from SmartSave Layaway' }
                    }
                };

                const { error: bError } = await supabase.from('bookings').insert([bookingPayload]);
                if (bError) throw bError;
                alert(`🎉 LAYAWAY COMPLETED! ${selectedPlan.customer} has been pushed to the official Trip Manifest!`);
            }
        }
    } catch(e) { 
        setPendingSyncs(prev => [...prev, {
            id: Date.now(), table: 'smartsave', action: 'UPDATE', recordId: selectedPlan.dbId, 
            payload: { current_saved: newTotal, status: updatedStatus, transactions: allTx }
        }]);
    }
  };

  const handleLogManualDeposit = () => {
    if (!depositAmount || Number(depositAmount) <= 0) return alert("Enter a valid deposit amount.");
    executeDeposit(depositAmount, 'Manual Payment');
  };

  const handlePayInFull = () => {
    if (!selectedPlan) return;
    const remaining = Number(selectedPlan.targetAmount) - Number(selectedPlan.currentSaved);
    if (window.confirm(`Are you sure you want to log a final payment of ₵ ${remaining.toLocaleString()}? This will auto-add them to the manifest.`)) {
      executeDeposit(remaining, 'Paid in Full');
    }
  };

  const handleCheckInstallment = () => {
    if (selectedPlan) executeDeposit(selectedPlan.installmentAmount, `${selectedPlan.frequency} Installment Checked`);
  };

  const handleSaveEdit = async () => {
    if (!selectedPlan) return;

    const updatedClientDetails = { ...selectedPlan.clientDetails, email: editFormData.email, dob: editFormData.dob, idNumber: editFormData.idNumber };
    const payload = { 
        status: editFormData.status, 
        frequency: editFormData.frequency, 
        customer: editFormData.customer, 
        phone: editFormData.phone, 
        client_details: updatedClientDetails 
    };

    setSavingsPlans(prev => prev.map(p => p.dbId === selectedPlan.dbId ? { ...p, ...payload, clientDetails: updatedClientDetails } as any : p));
    setIsEditModalOpen(false);

    try {
        if (!navigator.onLine) throw new Error("Offline");
        await supabase.from('smartsave').update(payload).eq('id', selectedPlan.dbId);
    } catch(e) { 
        setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'smartsave', action: 'UPDATE', recordId: selectedPlan.dbId, payload: payload }]);
    }
  };

  const checkPlanHealth = (plan: SavingsPlan) => {
    if (plan.status !== 'Active') return { isAtRisk: false, message: 'Stable' };
    const expectedPeriodsPassed = Math.floor((new Date().getTime() - new Date(plan.startDate || new Date()).getTime()) / (1000 * 60 * 60 * 24 * (plan.frequency === 'Weekly' ? 7 : 30)));
    const expectedSavings = plan.installmentAmount * expectedPeriodsPassed;
    if (plan.currentSaved < expectedSavings - (plan.installmentAmount * 1.5)) {
        return { isAtRisk: true, message: `High Flight Risk: Customer is behind on ${plan.frequency} installments.` };
    }
    return { isAtRisk: false, message: 'Customer is on track and healthy.' };
  };

  const openManage = (plan: SavingsPlan, initialTab: 'schedule' | 'ledger' | 'ai' = 'schedule') => {
    setSelectedPlan(plan); setManageTab(initialTab); setIsManageModalOpen(true);
  };

  const openEdit = (plan: SavingsPlan) => {
    setSelectedPlan(plan);
    setEditFormData({ 
        customer: plan.customer, phone: plan.phone, email: plan.clientDetails?.email || '', 
        dob: plan.clientDetails?.dob || '', idNumber: plan.clientDetails?.idNumber || '', 
        frequency: plan.frequency, status: plan.status 
    });
    setEditTab('client');
    setIsEditModalOpen(true);
  };

  const totalLockedFunds = savingsPlans.filter(p => p.status !== 'Cancelled').reduce((sum, plan) => sum + plan.currentSaved, 0);
  const projectedNextMonth = savingsPlans.filter(p => p.status === 'Active').reduce((sum, plan) => sum + (plan.frequency === 'Weekly' ? plan.installmentAmount * 4 : plan.installmentAmount), 0);
  const activePlansCount = savingsPlans.filter(p => p.status === 'Active').length;
  const filteredPlans = savingsPlans.filter(plan => plan.customer.toLowerCase().includes(searchQuery.toLowerCase()) || plan.targetTrip.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="animate-fade-in pb-20 relative">
      
      {/* HEADER & KPIs */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-pink-500/10 rounded-xl"><PiggyBank size={28} className="text-pink-500" /></div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">SmartSave</h1>
            {/* 🟢 THE SYNC INDICATOR */}
            {pendingSyncs.length > 0 ? (
                 <div className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest cursor-pointer" onClick={processSyncQueue}>
                    {isSyncing ? <RefreshCw size={14} className="animate-spin"/> : <CloudOff size={14}/>}
                    {pendingSyncs.length} Pending
                 </div>
            ) : (
                 <div className="flex items-center gap-1 text-slate-300" title="Cloud Synced">
                    <CloudUpload size={20}/>
                 </div>
            )}
          </div>
          <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
             <BrainCircuit size={16} className="text-pink-500"/> Predictive Layaway & Cash Flow Engine
          </p>
        </div>
        <button onClick={() => setIsNewPlanModalOpen(true)} className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95">
          <Plus size={18}/> Generate AI Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-pink-50 rounded-full blur-3xl group-hover:bg-pink-100 transition-colors"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Secured AUM (Assets Under Mgt)</p>
          <h2 className="text-4xl font-black text-slate-800 relative z-10"><span className="text-xl text-slate-400 mr-1">₵</span>{totalLockedFunds.toLocaleString()}</h2>
          <div className="mt-4 flex items-center gap-2 text-pink-600 text-xs font-bold bg-pink-50 w-fit px-3 py-1.5 rounded-lg relative z-10">
              <ShieldAlert size={14}/> Funds locked for future trips
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-50 rounded-full blur-3xl group-hover:bg-blue-100 transition-colors"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Next 30 Days Forecast</p>
          <h2 className="text-4xl font-black text-slate-800 relative z-10"><span className="text-xl text-slate-400 mr-1">+ ₵</span>{projectedNextMonth.toLocaleString()}</h2>
          <div className="mt-4 flex items-center gap-2 text-blue-600 text-xs font-bold bg-blue-50 w-fit px-3 py-1.5 rounded-lg relative z-10">
              <TrendingUp size={14}/> Guaranteed Cash Flow
          </div>
        </div>
        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-teal-500/20 rounded-full blur-3xl"></div>
          <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-2 relative z-10">Active Layaway Contracts</p>
          <h2 className="text-4xl font-black text-white relative z-10">{activePlansCount} <span className="text-xl text-slate-400 font-medium ml-1">Clients</span></h2>
          <div className="mt-4 flex items-center gap-2 text-teal-400 text-xs font-bold bg-white/10 backdrop-blur-sm w-fit px-3 py-1.5 rounded-lg relative z-10">
              <CheckCircle size={14}/> Default Protection
          </div>
        </div>
      </div>

      {/* TRACKER LIST */}
      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><History size={20}/> Customer Portfolios</h3>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-3 rounded-2xl w-full max-w-xs focus-within:border-teal-500 transition-colors">
            <Search size={18} className="text-slate-400" />
            <input type="text" placeholder="Search customer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent outline-none text-sm font-bold text-slate-700" />
          </div>
        </div>

        {loading && savingsPlans.length === 0 ? (
             <div className="text-center py-12"><RefreshCw className="animate-spin text-teal-500 mx-auto mb-4"/> Loading Cloud Data...</div>
        ) : filteredPlans.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
            <PiggyBank size={48} className="text-slate-300 mx-auto mb-4"/>
            <p className="text-slate-500 font-bold">No active savings plans yet.</p>
          </div>
        ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filteredPlans.map(plan => {
                const progress = Math.min((plan.currentSaved / plan.targetAmount) * 100, 100);
                const isCompleted = plan.status === 'Completed';
                const isCancelled = plan.status === 'Cancelled';
                const health = checkPlanHealth(plan);

                return (
                <div key={plan.id} className={`bg-white border-2 rounded-[2rem] p-6 shadow-sm hover:shadow-lg transition-all relative overflow-hidden ${health.isAtRisk && !isCancelled && !isCompleted ? 'border-red-100' : 'border-slate-100'}`}>
                    {health.isAtRisk && !isCancelled && !isCompleted && <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>}

                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className={`font-black text-2xl ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{plan.customer}</h3>
                            <div className="flex items-center gap-3 mt-1.5">
                                <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1"><MapPin size={12} className={isCancelled ? "text-slate-400" : "text-pink-500"}/> {plan.targetTrip}</p>
                                {plan.clientDetails?.email && <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 border-l pl-3"><Mail size={10}/> {plan.clientDetails.email}</p>}
                            </div>
                        </div>
                        <span className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg h-min ${isCompleted ? 'bg-green-100 text-green-700' : isCancelled ? 'bg-slate-100 text-slate-500' : 'bg-slate-100 text-slate-700'}`}>
                            {plan.status}
                        </span>
                    </div>

                    <div className={`rounded-2xl p-5 mb-6 border ${isCancelled ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between text-sm font-black mb-3">
                            <span className="text-slate-800 text-xl">₵ {Number(plan.currentSaved).toLocaleString()}</span>
                            <span className="text-slate-400">/ ₵ {Number(plan.targetAmount).toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden mb-3">
                            <div className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-green-500' : isCancelled ? 'bg-slate-400' : health.isAtRisk ? 'bg-red-400' : 'bg-teal-500'}`} style={{ width: `${progress}%` }}></div>
                        </div>
                        {!isCompleted && !isCancelled && (
                            <div className="flex justify-between items-center text-xs font-bold text-slate-500 pt-2 border-t border-slate-200">
                                <span className="flex items-center gap-1"><Clock size={12}/> {plan.frequency} Target:</span>
                                <span className="text-slate-800">₵ {Number(plan.installmentAmount).toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center">
                        {health.isAtRisk && !isCancelled && !isCompleted ? (
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-600 flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-lg animate-pulse">
                                <AlertCircle size={14}/> Churn Risk
                            </span>
                        ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                Deadline: {plan.deadline}
                            </span>
                        )}
                        
                        <div className="flex gap-2">
                            <button onClick={() => openEdit(plan)} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl transition-colors" title="Client Profile & Settings">
                                <Settings size={18}/>
                            </button>
                            <button onClick={() => openManage(plan, 'ai')} className={`p-2.5 rounded-xl transition-colors ${health.isAtRisk && !isCancelled && !isCompleted ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-pink-400 hover:text-pink-600 bg-pink-50/50 hover:bg-pink-100'}`} title="AI Health Check">
                                <BrainCircuit size={18}/>
                            </button>
                            <button onClick={() => openManage(plan, 'schedule')} className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-200 p-2.5 rounded-xl transition-colors" title="Transaction Ledger">
                                <History size={18}/>
                            </button>
                            {!isCompleted && !isCancelled && (
                                <button onClick={() => { setSelectedPlan(plan); setDepositAmount(''); setIsDepositModalOpen(true); }} className="text-white bg-slate-900 hover:bg-slate-800 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md">
                                    Deposit
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                )
            })}
            </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: COMPREHENSIVE AI PLAN GENERATOR (WITH FULL BOOKING DATA)       */}
      {/* ========================================================================= */}
      {isNewPlanModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setIsNewPlanModalOpen(false)}></div>
          <div className="bg-white w-full max-w-7xl rounded-[2.5rem] shadow-2xl z-10 overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
            
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Generate AI Layaway Contract</h2>
                <p className="text-xs font-bold text-pink-600 uppercase tracking-widest mt-1 flex items-center gap-1"><BrainCircuit size={12}/> Automatically transfers to Manifest upon completion</p>
              </div>
              <button onClick={() => setIsNewPlanModalOpen(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-red-500 border border-slate-200 shadow-sm"><X size={20} /></button>
            </div>

            <div className="flex flex-col lg:flex-row  flex-1 overflow-auto">
                {/* LEFT SIDE: FULL BOOKING FORM */}
                <div className="lg:w-[60%] min-h-[60vh] p-8 overflow-y-auto border-r border-slate-100 space-y-8">
                    
                    {/* 1. Trip & Group Size */}
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2"><Globe size={16} className="text-teal-600"/> 1. Package & Group Size</h3>
                        <select value={bookingMeta.tripId} onChange={e => setBookingMeta({...bookingMeta, tripId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none font-black text-teal-900 text-lg mb-4">
                            <option value="">Select a Tour / Package...</option>
                            {availableTrips.map(trip => (<option key={trip.id} value={trip.id}>{trip.title} - Base ₵{trip.adultPrice.toLocaleString()}</option>))}
                        </select>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Users size={14}/> Adults</span>
                            <input value={bookingMeta.adults} onChange={e => setBookingMeta({...bookingMeta, adults: Math.max(1, Number(e.target.value))})} type="number" min="1" className="bg-white border rounded-lg w-16 p-1 text-center font-bold outline-none" />
                            </div>
                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><User size={14}/> Child</span>
                            <input value={bookingMeta.children} onChange={e => setBookingMeta({...bookingMeta, children: Math.max(0, Number(e.target.value))})} type="number" min="0" className="bg-white border rounded-lg w-16 p-1 text-center font-bold outline-none" />
                            </div>
                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Baby size={14}/> Infant</span>
                            <input value={bookingMeta.infants} onChange={e => setBookingMeta({...bookingMeta, infants: Math.max(0, Number(e.target.value))})} type="number" min="0" className="bg-white border rounded-lg w-16 p-1 text-center font-bold outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* 2. Travelers */}
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2"><UserCircle size={16} className="text-teal-600"/> 2. Traveler Information</h3>
                        <div className="space-y-4">
                            {travelers.map((traveler, index) => {
                            const isExpanded = expandedTraveler === traveler.id || (index === 0 && expandedTraveler === null);
                            return (
                                <div key={traveler.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all">
                                <div onClick={() => setExpandedTraveler(isExpanded ? null : traveler.id)} className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-teal-50/50 border-b border-slate-200' : 'hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${traveler.isLead ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{index + 1}</div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">{traveler.firstName || traveler.lastName ? `${traveler.firstName} ${traveler.lastName}` : `Traveler ${index + 1}`}</h4>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{traveler.isLead ? 'Lead Passenger / Bill Payer' : 'Additional Guest'}</p>
                                    </div>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                                </div>

                                {isExpanded && (
                                    <div className="p-6 space-y-6 bg-slate-50/30">
                                    <div>
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        <select value={traveler.title} onChange={e => handleTravelerChange(traveler.id, 'title', e.target.value)} className="md:col-span-2 bg-white border border-slate-200 p-3 rounded-xl outline-none text-sm font-bold"><option>Mr</option><option>Mrs</option><option>Ms</option><option>Dr</option></select>
                                        <input value={traveler.firstName} onChange={e => handleTravelerChange(traveler.id, 'firstName', e.target.value)} type="text" placeholder="First Name (As on Passport)" className="md:col-span-5 bg-white border border-slate-200 p-3 rounded-xl outline-none text-sm" required/>
                                        <input value={traveler.lastName} onChange={e => handleTravelerChange(traveler.id, 'lastName', e.target.value)} type="text" placeholder="Last Name" className="md:col-span-5 bg-white border border-slate-200 p-3 rounded-xl outline-none text-sm" required/>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Gender</label><select value={traveler.gender} onChange={e => handleTravelerChange(traveler.id, 'gender', e.target.value)} className="w-full bg-white border border-slate-200 p-3 rounded-xl outline-none text-sm"><option value="">Select Gender...</option><option>Male</option><option>Female</option></select></div>
                                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Date of Birth</label><input value={traveler.dob} onChange={e => handleTravelerChange(traveler.id, 'dob', e.target.value)} type="date" className="w-full bg-white border border-slate-200 p-3 rounded-xl outline-none text-sm text-slate-600" /></div>
                                        </div>
                                    </div>

                                    {traveler.isLead && (
                                        <div>
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b pb-1">Contact Info</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input value={traveler.phone} onChange={e => handleTravelerChange(traveler.id, 'phone', e.target.value)} type="tel" placeholder="WhatsApp / Mobile Number" className="w-full bg-white border border-slate-200 p-3 rounded-xl outline-none text-sm" />
                                            <input value={traveler.email} onChange={e => handleTravelerChange(traveler.id, 'email', e.target.value)} type="email" placeholder="Email Address" className="w-full bg-white border border-slate-200 p-3 rounded-xl outline-none text-sm" />
                                        </div>
                                        </div>
                                    )}

                                    <div>
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b pb-1">Travel Documents</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input value={traveler.nationality} onChange={e => handleTravelerChange(traveler.id, 'nationality', e.target.value)} type="text" placeholder="Nationality" className="w-full bg-white border border-slate-200 p-3 rounded-xl outline-none text-sm" />
                                        <input value={traveler.passportNo} onChange={e => handleTravelerChange(traveler.id, 'passportNo', e.target.value)} type="text" placeholder="Passport / ID No." className="w-full bg-white border border-slate-200 p-3 rounded-xl outline-none text-sm font-mono text-slate-700" />
                                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Doc Expiry</label><input value={traveler.passportExpiry} onChange={e => handleTravelerChange(traveler.id, 'passportExpiry', e.target.value)} type="date" className="w-full bg-white border border-slate-200 p-3 rounded-xl outline-none text-sm text-slate-600" /></div>
                                        </div>
                                    </div>

                                    <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                                        <h5 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-1"><HeartPulse size={12}/> Health & Comfort</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-orange-500 uppercase ml-1 block mb-1">Dietary Req</label>
                                            <select value={traveler.dietaryPreference} onChange={e => handleTravelerChange(traveler.id, 'dietaryPreference', e.target.value)} className="w-full bg-white border border-orange-200 p-3 rounded-xl outline-none text-sm text-slate-700"><option value="None">No Restrictions</option><option value="Vegetarian">Vegetarian</option><option value="Vegan">Vegan</option><option value="Halal">Halal</option><option value="Allergies">Severe Allergies</option></select>
                                        </div>
                                        <div><label className="text-[10px] font-bold text-orange-500 uppercase ml-1 block mb-1">Medical Conditions</label><input value={traveler.medicalConditions} onChange={e => handleTravelerChange(traveler.id, 'medicalConditions', e.target.value)} type="text" placeholder="e.g. Asthma, Wheelchair..." className="w-full bg-white border border-orange-200 p-3 rounded-xl outline-none text-sm" /></div>
                                        </div>
                                    </div>

                                    <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl">
                                        <h5 className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3 flex items-center gap-1"><BedDouble size={12}/> Room Allocation</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <select value={traveler.roomPreference} onChange={e => handleTravelerChange(traveler.id, 'roomPreference', e.target.value)} className="w-full bg-white border border-purple-200 p-3 rounded-xl outline-none text-sm text-slate-700"><option>Double (Shared Bed)</option><option>Twin (Separate Beds)</option><option>Single (Private - Surcharge)</option></select>
                                        {(traveler.roomPreference.includes('Double') || traveler.roomPreference.includes('Twin')) && bookingMeta.tripId && (
                                            <select value={traveler.requestedRoommate} onChange={e => handleTravelerChange(traveler.id, 'requestedRoommate', e.target.value)} className="w-full bg-white border border-purple-200 p-3 rounded-xl outline-none text-sm text-slate-700">
                                            <option value="">Roommate: No preference</option>
                                            {travelers.filter(t => t.id !== traveler.id && t.firstName).map(t => (<option key={t.id} value={`${t.firstName} ${t.lastName}`}>{t.firstName} {t.lastName} (From Group)</option>))}
                                            <option disabled>--- Other Booked Passengers ---</option>
                                            {existingPassengers.map(pax => (<option key={pax.id} value={pax.first_name}>{pax.first_name} {pax.last_name}</option>))}
                                            </select>
                                        )}
                                        </div>
                                    </div>
                                    </div>
                                )}
                                </div>
                            )
                            })}
                        </div>
                    </div>

                    {/* 3. Logistics */}
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2"><ShieldAlert size={16} className="text-teal-600"/> 3. Group Logistics & Safety</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Emergency Name</label><input value={logistics.emergencyContactName} onChange={e => setLogistics({...logistics, emergencyContactName: e.target.value})} type="text" placeholder="Not traveling with group" className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Emergency Phone</label><input value={logistics.emergencyContactPhone} onChange={e => setLogistics({...logistics, emergencyContactPhone: e.target.value})} type="tel" className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Relationship</label><select value={logistics.emergencyContactRelation} onChange={e => setLogistics({...logistics, emergencyContactRelation: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm"><option>Spouse</option><option>Parent</option><option>Sibling</option><option>Friend</option></select></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Pickup / Terminal</label><input value={logistics.pickupLocation} onChange={e => setLogistics({...logistics, pickupLocation: e.target.value})} type="text" placeholder="e.g. Accra Mall" className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Travel Insurance</label><select value={logistics.insuranceOptIn} onChange={e => setLogistics({...logistics, insuranceOptIn: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm"><option>Declined</option><option>Opted In (Added to Bill)</option><option>Has Own Insurance</option></select></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1 block mb-1">Special Occasion</label><select value={logistics.specialOccasion} onChange={e => setLogistics({...logistics, specialOccasion: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-sm text-pink-600 font-bold"><option value="None">None</option><option>Honeymoon</option><option>Birthday</option><option>Anniversary</option></select></div>
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE: AI FINANCIAL PROJECTION (Sticky) */}
                <div className="lg:w-[40%] bg-slate-50 p-8 border-l border-slate-200">
                    <div className="sticky top-0">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><CreditCard size={16}/> Layaway Settings</h3>
                        
                        <div className="bg-white border border-slate-200 p-5 rounded-2xl mb-6 shadow-sm">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Initial Deposit (GHS)</label>
                            <input type="number" value={layawayMeta.initialDeposit} onChange={e => setLayawayMeta({...layawayMeta, initialDeposit: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-black text-slate-800 outline-none focus:border-teal-500 transition-colors" placeholder="0.00"/>
                        </div>

                        {planProjection ? (
                            <div className={`border-2 rounded-2xl p-6 transition-all shadow-xl ${planProjection.feasibilityScore === 'Unrealistic' ? 'bg-red-900 border-red-800' : planProjection.feasibilityScore === 'Risky' ? 'bg-orange-900 border-orange-800' : 'bg-slate-900 border-slate-800'}`}>
                                <div className={`flex justify-between items-center mb-4 border-b pb-4 border-white/10`}>
                                    <h4 className={`font-black flex items-center gap-2 text-white`}>
                                        <Calculator size={18} className={planProjection.feasibilityScore === 'Safe' ? "text-teal-400" : "text-white"}/> AI Projection
                                    </h4>
                                    <select value={layawayMeta.frequency} onChange={e => setLayawayMeta({...layawayMeta, frequency: e.target.value})} className={`border-none text-sm font-bold p-2 rounded-lg outline-none bg-white/10 text-white cursor-pointer hover:bg-white/20 transition-colors`}>
                                        <option className="text-slate-800" value="Weekly">Weekly</option>
                                        <option className="text-slate-800" value="Monthly">Monthly</option>
                                    </select>
                                </div>
                                
                                {planProjection.warning && (
                                    <div className={`p-3 rounded-xl mb-6 text-xs font-bold flex items-start gap-2 ${planProjection.feasibilityScore === 'Unrealistic' ? 'bg-red-500/20 text-red-200' : 'bg-orange-500/20 text-orange-200'}`}>
                                        <AlertCircle size={16} className="shrink-0 mt-0.5"/> {planProjection.warning}
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Group Cost</p><p className="font-black text-xl text-white">₵ {planProjection.targetAmount.toLocaleString()}</p></div>
                                    <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Remaining Bal.</p><p className="font-black text-xl text-white">₵ {planProjection.balance.toLocaleString()}</p></div>
                                    <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Layaway Deadline</p><p className="font-bold text-orange-400">{planProjection.cutoffDate}</p></div>
                                    <div><p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Portions</p><p className="font-bold text-teal-400">{planProjection.periods} {layawayMeta.frequency.replace('ly', 's')}</p></div>
                                </div>

                                <div className="bg-black/20 p-5 rounded-xl border border-white/5 flex items-center justify-between">
                                    <span className="font-bold text-xs uppercase text-slate-300">Client Pays:</span>
                                    <span className={`text-2xl font-black ${planProjection.feasibilityScore === 'Unrealistic' ? 'text-red-400' : 'text-teal-400'}`}>₵ {Number(planProjection.installmentAmount).toLocaleString()} <span className="text-xs font-bold text-slate-400">/ {layawayMeta.frequency.replace('ly','')}</span></span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-200/50 border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500 font-bold flex flex-col items-center justify-center h-64">
                                <Calculator size={32} className="mb-2 text-slate-400"/>
                                Select a trip on the left to generate the AI Payment Plan
                            </div>
                        )}

                        <button onClick={handleCreatePlan} disabled={!planProjection} className={`w-full mt-8 py-5 rounded-2xl font-black shadow-xl transition-all flex items-center justify-center gap-2 text-lg ${planProjection ? (planProjection.feasibilityScore === 'Unrealistic' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-teal-500 hover:bg-teal-400 text-white') : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                            {planProjection?.feasibilityScore === 'Unrealistic' ? <AlertCircle size={20}/> : <CheckCircle size={20}/>} 
                            {planProjection?.feasibilityScore === 'Unrealistic' ? 'Override Risk & Activate' : 'Activate Contract'}
                        </button>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: LOG DEPOSIT MODAL                                                */}
      {/* ========================================================================= */}
      {isDepositModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsDepositModalOpen(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl z-10 overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800">Receive Payment</h2>
              <button onClick={() => setIsDepositModalOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500"><X size={20} /></button>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Paying Customer</p>
              <p className="font-black text-slate-800 text-lg">{selectedPlan.customer}</p>
              <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-500 font-medium">Total Remaining:</span>
                <span className="text-xs font-bold text-orange-600">₵ {Math.max(0, Number(selectedPlan.targetAmount) - Number(selectedPlan.currentSaved)).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              <button onClick={() => setDepositAmount(selectedPlan.installmentAmount.toString())} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-xl transition-colors">
                Fill Installment
              </button>
              <button onClick={handlePayInFull} className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold py-2 rounded-xl transition-colors">
                Pay in Full
              </button>
            </div>

            <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Custom Amount (GHS)</label>
            <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="w-full bg-white border-2 border-slate-200 focus:border-slate-800 p-4 rounded-xl outline-none font-black text-3xl text-slate-900 text-center mb-2 transition-colors" placeholder="0.00" autoFocus/>

            <button onClick={handleLogManualDeposit} className="w-full py-4 mt-4 rounded-2xl font-bold shadow-lg bg-slate-900 hover:bg-slate-800 text-white flex justify-center items-center gap-2">
              <CreditCard size={18}/> Process to Ledger
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PLAN MANAGEMENT (SCHEDULE, LEDGER, & AI ENGINE)                */}
      {/* ========================================================================= */}
      {isManageModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsManageModalOpen(false)}></div>
          <div className="bg-white w-full max-w-md h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="bg-slate-900 text-white p-6 shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl"></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h2 className="text-xl font-black">{selectedPlan.customer}</h2>
                  <p className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1"><MapPin size={12} className="text-pink-400"/> {selectedPlan.targetTrip}</p>
                </div>
                <button onClick={() => setIsManageModalOpen(false)} className="p-2 text-slate-400 hover:text-white bg-white/10 rounded-full"><X size={16} /></button>
              </div>
              
              <div className="flex gap-4 border-b border-white/20 mt-4 relative z-10">
                <button onClick={() => setManageTab('schedule')} className={`pb-2 text-sm font-bold transition-all ${manageTab === 'schedule' ? 'text-white border-b-2 border-white' : 'text-slate-400 hover:text-white'}`}>Schedule</button>
                <button onClick={() => setManageTab('ledger')} className={`pb-2 text-sm font-bold transition-all ${manageTab === 'ledger' ? 'text-white border-b-2 border-white' : 'text-slate-400 hover:text-white'}`}>Ledger</button>
                <button onClick={() => setManageTab('ai')} className={`pb-2 text-sm font-bold transition-all flex items-center gap-1 ${manageTab === 'ai' ? 'text-pink-400 border-b-2 border-pink-400' : 'text-slate-400 hover:text-pink-300'}`}><BrainCircuit size={14}/> AI Health</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              
              {/* TAB 1: SCHEDULE */}
              {manageTab === 'schedule' && (
                <div className="space-y-3">
                  <div className="bg-slate-100 text-slate-600 p-3 rounded-xl text-xs font-medium mb-4 flex items-start gap-2">
                    <CheckSquare size={16} className="shrink-0 mt-0.5 text-slate-400"/>
                    Check a box below to instantly log a ₵ {Number(selectedPlan.installmentAmount).toLocaleString()} payment.
                  </div>
                  
                  {Array.from({ length: selectedPlan.periods || 1 }).map((_, i) => {
                    const expectedTotalByNow = selectedPlan.installmentAmount * (i + 1);
                    const isPaid = selectedPlan.currentSaved >= expectedTotalByNow - 1;

                    return (
                      <div key={i} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${isPaid ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <div className="flex items-center gap-3">
                          {isPaid ? (
                            <CheckCircle size={24} className="text-green-500"/>
                          ) : (
                            <button onClick={() => {
                              if(window.confirm(`Log ₵ ${selectedPlan.installmentAmount} payment for Period ${i+1}?`)) {
                                handleCheckInstallment();
                              }
                            }} className="w-6 h-6 rounded border-2 border-slate-300 hover:border-slate-800 hover:bg-slate-100 transition-all flex items-center justify-center text-transparent hover:text-slate-800">
                              <CheckSquare size={16} />
                            </button>
                          )}
                          <div>
                            <p className={`font-bold text-sm ${isPaid ? 'text-green-800 line-through opacity-70' : 'text-slate-800'}`}>Period {i + 1}</p>
                            <p className="text-xs text-slate-500">{selectedPlan.frequency}</p>
                          </div>
                        </div>
                        <span className={`font-black ${isPaid ? 'text-green-700 opacity-70' : 'text-slate-800'}`}>₵ {Number(selectedPlan.installmentAmount).toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* TAB 2: LEDGER */}
              {manageTab === 'ledger' && (
                <div>
                  {(!selectedPlan.transactions || selectedPlan.transactions.length === 0) ? (
                    <p className="text-sm text-slate-500 italic text-center py-8">No payments recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {[...selectedPlan.transactions].reverse().map((tx, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{tx.date}</p>
                            <p className="text-sm font-bold text-slate-700">{tx.note || 'Payment'}</p>
                          </div>
                          <span className="font-black text-slate-800 text-lg">+ ₵{Number(tx.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: AI HEALTH */}
              {manageTab === 'ai' && (() => {
                  const health = checkPlanHealth(selectedPlan);
                  return (
                      <div className="space-y-6">
                          <div className={`p-6 rounded-[2rem] border-2 ${health.isAtRisk ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${health.isAtRisk ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                  {health.isAtRisk ? <AlertCircle size={24}/> : <CheckCircle size={24}/>}
                              </div>
                              <h3 className={`text-xl font-black ${health.isAtRisk ? 'text-red-700' : 'text-emerald-700'}`}>
                                  {health.isAtRisk ? 'High Churn Risk' : 'Plan is Healthy'}
                              </h3>
                              <p className={`text-sm mt-2 font-medium ${health.isAtRisk ? 'text-red-600/80' : 'text-emerald-600/80'}`}>{health.message}</p>
                          </div>

                          {health.isAtRisk && (
                              <button onClick={() => alert(`Simulating: Sending automated WhatsApp reminder to ${selectedPlan.phone}...`)} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-red-600/20 hover:bg-red-500 transition-all flex items-center justify-center gap-2 active:scale-95">
                                  <MessageSquare size={18}/> Auto-Nudge Customer
                              </button>
                          )}
                      </div>
                  );
              })()}

            </div>
            
            <div className="p-6 bg-white border-t border-slate-100 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
              <div className="flex justify-between font-bold text-sm mb-2"><span>Total Paid:</span> <span className="text-slate-800">₵ {Number(selectedPlan.currentSaved).toLocaleString()}</span></div>
              <div className="flex justify-between font-bold text-sm mb-4"><span>Remaining:</span> <span className="text-orange-600">₵ {Math.max(0, Number(selectedPlan.targetAmount) - Number(selectedPlan.currentSaved)).toLocaleString()}</span></div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                <div className="bg-slate-900 h-full rounded-full transition-all" style={{ width: `${Math.min((Number(selectedPlan.currentSaved) / Number(selectedPlan.targetAmount)) * 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: COMPREHENSIVE CLIENT MASTER RECORD                               */}
      {/* ========================================================================= */}
      {isEditModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            <div className="bg-slate-900 text-white p-6 shrink-0 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black">Client Master Record</h2>
                <p className="text-xs text-slate-400 mt-1 font-medium font-mono">{String(selectedPlan.dbId).slice(0,8)}</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 bg-white/10 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
            </div>

            {/* TABS */}
            <div className="flex border-b border-slate-100 bg-slate-50 shrink-0">
              <button onClick={() => setEditTab('client')} className={`flex-1 py-4 text-sm font-black transition-all ${editTab === 'client' ? 'text-teal-600 bg-white border-b-2 border-teal-600' : 'text-slate-400 hover:text-slate-800'}`}>Client Details</button>
              <button onClick={() => setEditTab('plan')} className={`flex-1 py-4 text-sm font-black transition-all ${editTab === 'plan' ? 'text-teal-600 bg-white border-b-2 border-teal-600' : 'text-slate-400 hover:text-slate-800'}`}>Plan Settings</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              
              {editTab === 'client' && (
                  <div className="space-y-4">
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Full Legal Name</label><input type="text" value={editFormData.customer} onChange={e => setEditFormData({...editFormData, customer: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl font-bold outline-none text-slate-800 focus:border-teal-500"/></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Phone Number</label><input type="tel" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl font-bold outline-none text-slate-800 focus:border-teal-500"/></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Email Address</label><input type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl font-bold outline-none text-slate-800 focus:border-teal-500"/></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Date of Birth</label><input type="date" value={editFormData.dob} onChange={e => setEditFormData({...editFormData, dob: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl font-bold outline-none text-slate-800 focus:border-teal-500"/></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">ID Number</label><input type="text" value={editFormData.idNumber} onChange={e => setEditFormData({...editFormData, idNumber: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl font-bold outline-none text-slate-800 focus:border-teal-500 font-mono text-xs"/></div>
                    </div>
                  </div>
              )}

              {editTab === 'plan' && (
                  <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Target Frequency</label>
                        <select value={editFormData.frequency} onChange={e => setEditFormData({...editFormData, frequency: e.target.value})} className="w-full bg-slate-50 border p-3 rounded-xl outline-none text-slate-800 font-bold focus:border-teal-500">
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                        </select>
                        <p className="text-[10px] text-slate-400 mt-2 ml-1">Warning: Changing frequency will recalculate expected remaining portions.</p>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Contract Status</label>
                        <select value={editFormData.status} onChange={e => setEditFormData({...editFormData, status: e.target.value})} className={`w-full border p-3 rounded-xl outline-none font-bold focus:ring-2 focus:ring-opacity-50 ${editFormData.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200 focus:ring-red-500' : 'bg-slate-50 text-slate-800 focus:ring-teal-500'}`}>
                        <option>Active</option>
                        <option>Completed</option>
                        <option>Cancelled</option>
                        </select>
                        {editFormData.status === 'Cancelled' && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold mt-2 flex items-start gap-2">
                            <AlertCircle size={14} className="shrink-0 mt-0.5"/>
                            Cancelling this plan stops all AI tracking. This action cannot be easily undone.
                        </div>
                        )}
                    </div>
                  </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                <button onClick={handleSaveEdit} className="w-full py-4 rounded-2xl font-black shadow-lg bg-slate-900 hover:bg-slate-800 text-white flex justify-center items-center gap-2 transition-all active:scale-95">
                <Edit3 size={18}/> Update Master Record
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SmartSave;