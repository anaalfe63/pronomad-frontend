import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { 
  Plane, MapPin, Calendar, Clock, CreditCard, 
  CheckCircle, Info, ArrowRight, User, WifiOff, ShieldCheck
} from 'lucide-react';

interface PassportData {
  bookingRef: string;
  trip: { title: string; startDate: string; endDate: string; itinerary: any[] };
  financials: { totalPrice: number; amountPaid: number; status: string };
  passengers: any[];
  company?: { name: string; logo: string; color: string; currency: string };
}

const ClientPassport: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [data, setData] = useState<PassportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const fetchPassport = async () => {
      if (!bookingId) return;

      try {
        // 1. OFFLINE AIRPORT CACHE
        const cachedTicket = localStorage.getItem(`pronomad_passport_${bookingId}`);
        if (cachedTicket) {
            setData(JSON.parse(cachedTicket));
            setLoading(false); 
        }

        // 2. FETCH LATEST FROM SUPABASE
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .single();

        if (bookingError) throw bookingError;

        let tripData = null;
        let companyData = null;

        if (booking?.trip_id) {
            const { data: trip } = await supabase
                .from('trips')
                .select('*')
                .eq('id', booking.trip_id)
                .single();
            tripData = trip;
            
            // Fetch the specific company branding for this ticket
            if (trip?.subscriber_id) {
                const { data: settings } = await supabase
                    .from('system_settings')
                    .select('company_name, company_logo, theme_color, currency')
                    .eq('subscriber_id', trip.subscriber_id)
                    .single();
                companyData = settings;
            }
        }

        if (booking) {
            let pax = [];
            if (booking.raw_data?.roster && booking.raw_data.roster.length > 0) {
                pax = booking.raw_data.roster;
            } else if (booking.raw_data?.allTravelers && booking.raw_data.allTravelers.length > 0) {
                pax = booking.raw_data.allTravelers;
            } else if (booking.raw_data?.leadTraveler) {
                pax = [booking.raw_data.leadTraveler];
            } else {
                const names = (booking.customer_name || 'Guest').split(' ');
                pax = [{ first_name: names[0], last_name: names.slice(1).join(' ') }];
            }

            const normalizedPax = pax.map((p: any) => ({
                first_name: p.firstName || p.first_name || 'Guest',
                last_name: p.lastName || p.last_name || '',
                title: p.title || 'Mr'
            }));

            const targetTotal = Number(booking.total_cost || booking.raw_data?.financials?.agreedPrice || booking.amount_paid || 0);

            const formattedData: PassportData = {
                bookingRef: String(booking.booking_id || booking.id).slice(0, 8).toUpperCase(), 
                trip: {
                    title: tripData?.title || 'Custom Trip',
                    startDate: tripData?.start_date ? new Date(tripData.start_date).toLocaleDateString() : 'TBD',
                    endDate: tripData?.end_date ? new Date(tripData.end_date).toLocaleDateString() : 'TBD',
                    itinerary: typeof tripData?.itinerary === 'string' ? JSON.parse(tripData.itinerary) : (tripData?.itinerary || [])
                },
                financials: {
                    totalPrice: targetTotal,
                    amountPaid: Number(booking.amount_paid || 0),
                    status: booking.payment_status || 'Pending'
                },
                passengers: normalizedPax,
                company: {
                    name: companyData?.company_name || 'Tour Passport',
                    logo: companyData?.company_logo || '',
                    color: companyData?.theme_color || '#0d9488',
                    currency: companyData?.currency || 'GHS'
                }
            };

            setData(formattedData);
            localStorage.setItem(`pronomad_passport_${bookingId}`, JSON.stringify(formattedData));
        }

      } catch (error) {
        console.error('Failed to load passport from Cloud', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPassport();

    const handleOnline = () => { setIsOffline(false); fetchPassport(); };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    }
  }, [bookingId]);

  if (loading && !data) {
    return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-teal-400 font-bold animate-pulse"><Plane size={40} className="mb-4 animate-bounce"/> Fetching Digital Passport...</div>;
  }

  if (!data) {
    return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-bold"><ShieldCheck size={64} className="text-slate-600 mb-4"/>Booking Not Found. Please verify your link.</div>;
  }

  const balance = Math.max(0, data.financials.totalPrice - data.financials.amountPaid);
  const APP_COLOR = data.company?.color || '#0d9488';
  const CURRENCY = data.company?.currency || 'GHS';

  return (
    <div className="min-h-screen bg-slate-900 p-4 py-10 font-sans flex justify-center">
      
      <div className="w-full max-w-md animate-in slide-in-from-bottom-8 duration-700">
        
        {/* BRAND HEADER */}
        <div className="text-center mb-8 relative">
          {isOffline && (
              <div className="absolute left-0 top-0 flex items-center gap-1 bg-slate-800 text-slate-400 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm border border-slate-700">
                  <WifiOff size={10}/> Offline Ready
              </div>
          )}
          
          {data.company?.logo ? (
              <img src={data.company.logo} alt="Brand Logo" className="h-16 object-contain mx-auto mb-4 drop-shadow-2xl bg-white/5 p-2 rounded-2xl backdrop-blur-sm border border-white/10" />
          ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg border border-white/10" style={{ backgroundColor: APP_COLOR }}>
                <Plane size={32} className="text-white -rotate-45" />
              </div>
          )}
          
          <h1 className="text-2xl font-black text-white tracking-tight">{data.company?.name} Passport</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-2 bg-white/10 w-fit mx-auto px-4 py-1 rounded-full border border-white/10" style={{ color: APP_COLOR }}>Verified Booking</p>
        </div>

        {/* DIGITAL TICKET */}
        <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative border border-white/10">
          
          {/* Top Section */}
          <div className="p-8 text-white relative overflow-hidden" style={{ backgroundColor: APP_COLOR }}>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-black/10 rounded-full blur-xl"></div>
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <p className="text-[10px] text-white/70 uppercase font-black tracking-widest mb-1.5">Destination</p>
                <h2 className="text-3xl font-black leading-tight max-w-[200px]">{data.trip.title}</h2>
              </div>
              <div className="text-right shrink-0 bg-black/20 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                <p className="text-[9px] text-white/70 uppercase font-black tracking-widest mb-1">Booking Ref</p>
                <p className="text-lg font-mono font-black tracking-wider">{data.bookingRef}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-black/20 p-5 rounded-2xl relative z-10 backdrop-blur-sm border border-white/10">
              <div className="flex-1">
                <p className="text-[9px] text-white/70 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1"><Calendar size={10}/> Departure</p>
                <p className="font-black text-sm">{data.trip.startDate}</p>
              </div>
              <ArrowRight className="text-white/50 shrink-0"/>
              <div className="flex-1 text-right">
                <p className="text-[9px] text-white/70 uppercase font-black tracking-widest mb-1.5 flex items-center justify-end gap-1"><Calendar size={10}/> Return</p>
                <p className="font-black text-sm">{data.trip.endDate}</p>
              </div>
            </div>
          </div>

          {/* Tear Line Decoration */}
          <div className="h-8 bg-slate-900 relative -my-4 z-20 flex justify-between items-center px-1">
             <div className="w-8 h-8 bg-slate-900 rounded-full -ml-5 shadow-inner"></div>
             <div className="border-t-[3px] border-dashed border-slate-300 w-full mx-3 opacity-50"></div>
             <div className="w-8 h-8 bg-slate-900 rounded-full -mr-5 shadow-inner"></div>
          </div>

          {/* Middle Section: Passengers */}
          <div className="p-8 pt-10 bg-white">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={14}/> Passenger Manifest</h3>
            <div className="space-y-3">
              {data.passengers.map((pax, idx) => (
                <div key={idx} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-black text-xs shrink-0 shadow-sm border border-white">
                    {pax.first_name?.charAt(0) || ''}{pax.last_name?.charAt(0) || ''}
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-sm leading-none">{pax.title || 'Mr'} {pax.first_name} {pax.last_name}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Class: Standard</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Middle Section: Financials */}
          <div className="p-8 border-t border-slate-100 bg-slate-50">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2"><CreditCard size={14}/> Payment Status</h3>
            
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Package</span>
              <span className="font-black text-slate-800 text-lg">{CURRENCY} {data.financials.totalPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-5">
              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Amount Paid</span>
              <span className="font-black text-emerald-600 text-lg">- {CURRENCY} {data.financials.amountPaid.toLocaleString()}</span>
            </div>

            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-4 shadow-inner">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((data.financials.amountPaid / Math.max(1, data.financials.totalPrice)) * 100, 100)}%` }}></div>
            </div>

            {balance > 0 ? (
              <div className="flex justify-between items-center bg-orange-50 p-4 rounded-2xl border border-orange-100 mt-6 shadow-sm">
                <span className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Balance Due</span>
                <span className="font-black text-xl text-orange-600">{CURRENCY} {balance.toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex justify-center items-center bg-emerald-50 text-emerald-600 p-4 rounded-2xl border border-emerald-100 mt-6 font-black text-sm uppercase tracking-widest gap-2 shadow-sm">
                <CheckCircle size={18}/> Fully Paid & Secured
              </div>
            )}
          </div>

          {/* REAL QR Code Boarding Pass */}
          <div className="p-10 border-t border-slate-100 flex flex-col items-center justify-center bg-white rounded-b-[2.5rem]">
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-3xl mb-4 bg-white">
                <QRCodeSVG 
                    value={`pronomad:verify:${data.bookingRef}`}
                    size={140}
                    level="H" 
                    fgColor="#0f172a" 
                    bgColor="transparent"
                />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Scan at Departure Gate</p>
            <p className="text-[9px] font-bold text-slate-300 mt-1">REF: {data.bookingRef}</p>
          </div>

        </div> {/* <-- This was the missing closing tag! */}

        {/* ITINERARY TAB (If available) */}
        {data.trip.itinerary && data.trip.itinerary.length > 0 && (
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <h3 className="text-white font-black text-lg mb-6 flex items-center gap-2">
                <MapPin size={20} style={{ color: APP_COLOR }}/> Daily Itinerary
            </h3>
            <div className="space-y-4">
              {data.trip.itinerary.map((step, idx) => (
                <div key={idx} className="bg-slate-800/80 backdrop-blur-md p-5 rounded-3xl flex gap-5 relative overflow-hidden border border-slate-700/50 shadow-xl group hover:bg-slate-800 transition-colors">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: APP_COLOR }}></div>
                  <div className="text-center shrink-0 w-12 pt-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Day {step.day}</p>
                    <p className="text-sm font-black text-white mt-1">{step.time}</p>
                  </div>
                  <div className="flex-1 border-l border-slate-700 pl-4">
                    <h4 className="font-bold text-slate-100 text-sm leading-tight">{step.title || step.activity}</h4>
                    {step.location && <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2 flex items-center gap-1"><MapPin size={10} className="text-slate-500"/> {step.location}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ClientPassport;