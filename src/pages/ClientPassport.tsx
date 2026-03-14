import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Plane, MapPin, Calendar, Clock, CreditCard, 
  QrCode, CheckCircle, Info, ArrowRight, User, WifiOff
} from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';

interface PassportData {
  bookingRef: string;
  trip: { title: string; startDate: string; endDate: string; itinerary: any[] };
  financials: { totalPrice: number; amountPaid: number; status: string };
  passengers: any[];
}

const ClientPassport: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useTenant();
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
        if (booking?.trip_id) {
            const { data: trip } = await supabase
                .from('trips')
                .select('*')
                .eq('id', booking.trip_id)
                .single();
            tripData = trip;
        }

        if (booking) {
            let pax = [];
            if (booking.raw_data?.allTravelers && booking.raw_data.allTravelers.length > 0) {
                pax = booking.raw_data.allTravelers;
            } else if (booking.raw_data?.leadTraveler) {
                pax = [booking.raw_data.leadTraveler];
            } else {
                const names = (booking.customer_name || 'Guest').split(' ');
                pax = [{ first_name: names[0], last_name: names.slice(1).join(' ') }];
            }

            const normalizedPax = pax.map((p: any) => ({
                first_name: p.firstName || p.first_name || 'Guest',
                last_name: p.lastName || p.last_name || ''
            }));

            const targetTotal = Number(booking.raw_data?.financials?.agreedPrice || booking.amount_paid || 0);

            const formattedData: PassportData = {
                bookingRef: String(booking.id).slice(0, 8).toUpperCase(), 
                trip: {
                    title: tripData?.title || 'Custom Trip',
                    startDate: tripData?.start_date || 'TBD',
                    endDate: tripData?.end_date || 'TBD',
                    itinerary: typeof tripData?.itinerary === 'string' ? JSON.parse(tripData.itinerary) : (tripData?.itinerary || [])
                },
                financials: {
                    totalPrice: targetTotal,
                    amountPaid: Number(booking.amount_paid || 0),
                    status: booking.payment_status || 'Pending'
                },
                passengers: normalizedPax
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
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold">Booking Not Found. Please verify your link.</div>;
  }

  const balance = Math.max(0, data.financials.totalPrice - data.financials.amountPaid);
  const APP_COLOR = user?.themeColor || '#0d9488'; // Fallback to Teal

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 font-sans flex justify-center">
      
      <div className="w-full max-w-md animate-in slide-in-from-bottom-8 duration-700">
        
        {/* BRAND HEADER */}
        <div className="text-center mb-6 pt-4 relative">
          {isOffline && (
              <div className="absolute left-0 top-2 flex items-center gap-1 bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  <WifiOff size={12}/> Offline Mode
              </div>
          )}
          
          {/* 🌟 DYNAMIC LOGO INJECTION */}
          {user?.companyLogo ? (
              <img src={user.companyLogo} alt="Brand Logo" className="h-20 object-contain mx-auto mb-3 drop-shadow-2xl" />
          ) : (
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg" style={{ backgroundColor: APP_COLOR }}>
                <Plane size={24} className="text-slate-900 -rotate-45" />
              </div>
          )}
          
          {/* 🌟 DYNAMIC COMPANY NAME */}
          <h1 className="text-2xl font-black text-white tracking-tight">{user?.companyName || 'Pronomad'} Passport</h1>
          <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: APP_COLOR }}>Verified Booking</p>
        </div>

        {/* DIGITAL TICKET */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl relative">
          
          {/* Top Section */}
          <div className="p-6 text-white relative overflow-hidden" style={{ backgroundColor: APP_COLOR }}>
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <p className="text-xs text-white/70 uppercase font-bold tracking-widest mb-1">Destination</p>
                <h2 className="text-2xl font-black leading-tight max-w-[200px]">{data.trip.title}</h2>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-white/70 uppercase font-bold tracking-widest mb-1">Booking Ref</p>
                <p className="text-lg font-mono font-black">{data.bookingRef}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl relative z-10 backdrop-blur-sm border border-white/10">
              <div className="flex-1">
                <p className="text-[10px] text-white/70 uppercase font-bold mb-1">Departure</p>
                <p className="font-bold text-sm">{data.trip.startDate}</p>
              </div>
              <ArrowRight className="text-white/50 shrink-0"/>
              <div className="flex-1 text-right">
                <p className="text-[10px] text-white/70 uppercase font-bold mb-1">Return</p>
                <p className="font-bold text-sm">{data.trip.endDate}</p>
              </div>
            </div>
          </div>

          {/* Tear Line Decoration */}
          <div className="h-6 bg-slate-900 relative -my-3 z-20 flex justify-between items-center px-2">
             <div className="w-6 h-6 bg-slate-900 rounded-full -ml-5"></div>
             <div className="border-t-2 border-dashed border-slate-300 w-full mx-2"></div>
             <div className="w-6 h-6 bg-slate-900 rounded-full -mr-5"></div>
          </div>

          {/* Middle Section: Passengers */}
          <div className="p-6 pt-8 bg-white">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={14}/> Passenger Manifest</h3>
            <div className="space-y-3">
              {data.passengers.map((pax, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                    {pax.first_name?.charAt(0) || ''}{pax.last_name?.charAt(0) || ''}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm leading-none">{pax.first_name} {pax.last_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ticket: Standard</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Middle Section: Financials */}
          <div className="p-6 border-t border-slate-100 bg-slate-50">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><CreditCard size={14}/> Payment Status</h3>
            
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-slate-600">Total Package</span>
              <span className="font-black text-slate-800">{user?.currency || 'GHS'} {data.financials.totalPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-emerald-600">Amount Paid</span>
              <span className="font-black text-emerald-600">- {user?.currency || 'GHS'} {data.financials.amountPaid.toLocaleString()}</span>
            </div>

            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.min((data.financials.amountPaid / Math.max(1, data.financials.totalPrice)) * 100, 100)}%` }}></div>
            </div>

            {balance > 0 ? (
              <div className="flex justify-between items-center bg-orange-50 p-3 rounded-xl border border-orange-100 mt-4">
                <span className="text-xs font-bold text-orange-800 uppercase tracking-widest">Balance Due</span>
                <span className="font-black text-lg text-orange-600">{user?.currency || 'GHS'} {balance.toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex justify-center items-center bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100 mt-4 font-black text-sm uppercase tracking-widest gap-2">
                <CheckCircle size={16}/> Fully Paid
              </div>
            )}
          </div>

          {/* QR Code Boarding Pass */}
          <div className="p-8 border-t border-slate-100 flex flex-col items-center justify-center bg-white">
            <QrCode size={120} className="text-slate-800 mb-4" strokeWidth={1.5} />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Scan at Boarding</p>
          </div>
        </div>

        {/* ITINERARY TAB */}
        {data.trip.itinerary && data.trip.itinerary.length > 0 && (
          <div className="mt-6">
            <h3 className="text-white font-black text-lg mb-4 flex items-center gap-2">
                <MapPin size={18} style={{ color: APP_COLOR }}/> Daily Itinerary
            </h3>
            <div className="space-y-3">
              {data.trip.itinerary.map((step, idx) => (
                <div key={idx} className="bg-slate-800 p-4 rounded-2xl flex gap-4 relative overflow-hidden border border-slate-700">
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: APP_COLOR }}></div>
                  <div className="text-center shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: APP_COLOR }}>Day {step.day}</p>
                    <p className="text-sm font-black text-white">{step.time}</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100 text-sm">{step.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{step.location}</p>
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