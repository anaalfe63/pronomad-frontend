import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTenant } from './contexts/TenantContext';

// Components
import Sidebar from './components/Sidebar'; 
import ProtectedRoute from './components/ProtectedRoute';

// Pages you have built
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Lounge from './pages/Lounge';
import Landing from './pages/Landing'; 
import Subscription from './pages/Subscription';
import PublicBooking from './pages/PublicBooking';
import FinanceLedger from './pages/FinanceLedger';
import Settings from './pages/Settings';
import ClientHub from './pages/ClientHub';

// Active Imports
import DriverCockpit from './pages/DriverCockpit';
import GuideApp from './pages/GuideApp';
import MobileFieldApp from './pages/MobileFieldApp'; 
import TourOperations from './pages/TourOperations';
import LiveFleet from './pages/LiveFleet';
import SupplierPortal from './pages/SupplierPortal';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import Payroll from './pages/Payroll';
import StaffManagement from './pages/StaffManagement';
import Profile from './pages/Profile';
import BookingEngine from './pages/BookingEngine';

// 🚧 PLACEHOLDERS: Uncomment these imports as you create the files in your /pages folder!
import SmartSave from './pages/SmartSave';
import SmartYield from './pages/SmartYield';
import SmartRoute from './pages/SmartRoute';
import SmartMatch from './pages/SmartMatch';
import Communications from './pages/Communications';
import ClientPassport from './pages/ClientPassport';
import AuditLog from './pages/AuditLog';
import FleetMaintenance from './pages/LiveFleet';

const App = () => {
  const { user, initializing } = useTenant();

  // --- 🛡️ BULLETPROOF ROLE DEFINITIONS ---
  const safeRole = (user?.role || '').toLowerCase().trim();
  const isGodMode = safeRole === 'proadmin';
  const hasFullAccess = isGodMode || safeRole === 'ceo' || safeRole === 'admin' || safeRole === 'owner';
  const isCEO = hasFullAccess; // Alias for strict CEO checks
  const isOps = safeRole.includes('operations') || safeRole.includes('ops');
  const isFinance = safeRole.includes('finance') || safeRole.includes('accountant');
  const isDriver = safeRole.includes('driver');
  const isGuide = safeRole.includes('guide');
  
  // 🧭 SMART HOME ROUTER: Decides where a user lands when they log in
  const getHomeRoute = () => {
    if (hasFullAccess) return '/dashboard';
    if (isOps || isFinance) return '/lounge';
    if (isDriver || isGuide) return '/landing';
    return '/login'; // Failsafe
  };

  // 1. Initial Auth/Settings Loading State
  if (initializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h1 className="text-xl font-black tracking-tighter uppercase opacity-50">Please Wait...</h1>
      </div>
    );
  }

  return (
    <Routes>
      {/* =========================================================
          PUBLIC ROUTES
          ========================================================= */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to={getHomeRoute()} replace />} />
      <Route path="/book/:tripId" element={<PublicBooking />} />

      {/* 🌟 PASSENGER FACING: Public Passport View (No Sidebar) */}
      <Route path="/passport/:bookingId" element={<ClientPassport />} />

      {/* =========================================================
          PROTECTED ROUTES (Sidebar Layout Wrapper)
          ========================================================= */}
      <Route element={user ? <Sidebar /> : <Navigate to="/login" replace />}>
        
        {/* 🧭 ROOT REDIRECT */}
        <Route path="/" element={<Navigate to={getHomeRoute()} replace />} />

        {/* =========================================================
            HOME & LANDING PAGES 
            ========================================================= */}
        <Route path="/dashboard" element={<ProtectedRoute isAllowed={hasFullAccess}><Dashboard /></ProtectedRoute>} />
        <Route path="/lounge" element={<ProtectedRoute isAllowed={hasFullAccess || isOps || isFinance}><Lounge /></ProtectedRoute>} />
        <Route path="/landing" element={<ProtectedRoute isAllowed={hasFullAccess || isDriver || isGuide}><Landing /></ProtectedRoute>} />

        {/* =========================================================
            FIELD HUB 
            ========================================================= */}
        <Route path="/driver-cockpit" element={<ProtectedRoute isAllowed={hasFullAccess || isDriver}><DriverCockpit /></ProtectedRoute>} />
        <Route path="/guide-app" element={<ProtectedRoute isAllowed={hasFullAccess || isGuide || isOps}><GuideApp /></ProtectedRoute>} />
        <Route path="/mobile-field" element={<ProtectedRoute isAllowed={hasFullAccess || isDriver || isGuide || isOps}><MobileFieldApp /></ProtectedRoute>} />
        <Route path="/clientpassport/:bookingId" element={<ProtectedRoute isAllowed={hasFullAccess || isDriver || isGuide || isOps}><ClientPassport /></ProtectedRoute>} /> 

        {/* =========================================================
            OPS HUB 
            ========================================================= */}
        <Route path="/booking-engine" element={<ProtectedRoute isAllowed={hasFullAccess || isOps || isFinance}><BookingEngine /></ProtectedRoute>} />
        <Route path="/tour-operations" element={<ProtectedRoute isAllowed={hasFullAccess || isOps}><TourOperations /></ProtectedRoute>} />
        <Route path="/live-fleet" element={<ProtectedRoute isAllowed={hasFullAccess || isOps}><LiveFleet /></ProtectedRoute>} />
        <Route path="/supplier-portal" element={<ProtectedRoute isAllowed={hasFullAccess || isOps}><SupplierPortal /></ProtectedRoute>} />
        <Route path="/fleet-maintenance" element={<ProtectedRoute isAllowed={hasFullAccess || isOps}><FleetMaintenance /></ProtectedRoute>} /> 
        
        {/* 🌟 FIXED: Added <ClientHub /> brackets! */}
        <Route path="/clienthub" element={<ProtectedRoute isAllowed={hasFullAccess || isOps}><ClientHub /></ProtectedRoute>} />
        <Route path="/clientpassport" element={<ProtectedRoute isAllowed={hasFullAccess || isOps}><ClientPassport /></ProtectedRoute>} />
        

        {/* =========================================================
            FINANCE HUB 
            ========================================================= */}
        <Route path="/finance-ledger" element={<ProtectedRoute isAllowed={hasFullAccess || isFinance}><FinanceLedger /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute isAllowed={hasFullAccess || isFinance}><Expenses /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute isAllowed={hasFullAccess || isFinance}><Invoices /></ProtectedRoute>} />
        <Route path="/payroll" element={<ProtectedRoute isAllowed={hasFullAccess || isFinance}><Payroll /></ProtectedRoute>} />

        {/* =========================================================
            AI HUB 
            ========================================================= */}
        <Route path="/smartsave" element={<ProtectedRoute isAllowed={hasFullAccess || isFinance}><SmartSave /></ProtectedRoute>} /> 
        <Route path="/smartyield" element={<ProtectedRoute isAllowed={hasFullAccess || isOps || isFinance}><SmartYield /></ProtectedRoute>} /> 
        <Route path="/smartroute" element={<ProtectedRoute isAllowed={hasFullAccess || isOps}><SmartRoute /></ProtectedRoute>} /> 
        <Route path="/smartmatch" element={<ProtectedRoute isAllowed={hasFullAccess || isOps}><SmartMatch /></ProtectedRoute>} /> 
        <Route path="/communications" element={<ProtectedRoute isAllowed={hasFullAccess || isOps}><Communications /></ProtectedRoute>} /> 

        {/* =========================================================
            ADMIN & SETTINGS HUB 
            ========================================================= */}
        <Route path="/subscription" element={<ProtectedRoute isAllowed={hasFullAccess || isFinance} isSubscriptionPage={true}><Subscription /></ProtectedRoute>} />
        <Route path="/staff-management" element={<ProtectedRoute isAllowed={hasFullAccess || isOps}><StaffManagement /></ProtectedRoute>} />
        <Route path="/audit-log" element={<ProtectedRoute isAllowed={hasFullAccess}><AuditLog /></ProtectedRoute>} /> 
        
        {/* 🔒 STRICTLY CEO ONLY */}
        <Route path="/settings" element={<ProtectedRoute isAllowed={isCEO}><Settings /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute isAllowed={isCEO}><Profile /></ProtectedRoute>} /> 
        
      </Route>

      {/* =========================================================
          FALLBACK
          ========================================================= */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;