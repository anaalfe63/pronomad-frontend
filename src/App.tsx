import React, { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TenantProvider, useTenant } from './contexts/TenantContext';

// Layout Components
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import PublicBooking from './pages/PublicBooking';

// Hubs
import OpsHub from './pages/OpsHub';
import FinanceHub from './pages/FinanceHub';
import AIHub from './pages/AIHub';
import AdminHub from './pages/AdminHub';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import StaffManagement from './pages/StaffManagement';
import BookingEngine from './pages/BookingEngine';
import TourOperations from './pages/TourOperations';
import LiveFleet from './pages/LiveFleet';
import SupplierPortal from './pages/SupplierPortal';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import Subscription from './pages/Subscription';
import Profile from './pages/Profile';
import AuditLog from './pages/AuditLog';
import FinanceLedger from './pages/FinanceLedger';
import Payroll from './pages/Payroll';
import SmartSave from './pages/SmartSave';
import SmartRoute from './pages/SmartRoute';
import SmartYield from './pages/SmartYield';
import Settings from './pages/Settings';
import MobileFieldApp from './pages/MobileFieldApp';
import ClientPassport from './pages/ClientPassport';
import SmartMatch from './pages/SmartMatch';
import Communications from './pages/Communications';

// Field Apps
import GuideMode from './pages/DriverCockpit';
import GuideApp from './pages/GuideApp';

// --- TYPES & INTERFACES ---
interface LayoutProps {
  children: ReactNode;
}

// Layout Wrapper (Desktop Friendly with Sidebar)
const AppLayout: React.FC<LayoutProps> = ({ children }) => (
  <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
    <Sidebar />
    <main className="flex-1 overflow-y-auto pb-24 md:pb-0 relative">
      <div className="p-4 md:p-8">
        <TopHeader />
        <div className="mt-6">{children}</div>
      </div>
    </main>
  </div>
);

// 🛡️ SMART ROLE GUARD (Built right into App.tsx)
const RoleGuard: React.FC<{ children: ReactNode, allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, initializing } = useTenant(); 
  const location = useLocation();
  
  if (initializing) return <div className="h-screen flex items-center justify-center font-bold text-slate-400">Loading Secure Environment...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  
  // 👑 GOD MODE: ONLY PROADMIN bypasses all restrictions
  if (user.role === 'PROADMIN') return <>{children}</>;

  // 🚨 FOOLPROOF DASHBOARD BLOCKER
  // If a Field Agent tries to load the main dashboard ("/"), kick them to "/landing"
  if (location.pathname === '/' && (user.role === 'Driver' || user.role === 'Guide')) {
      return <Navigate to="/landing" replace />;
  }

  // 🚫 Specific Role Checking
  if (allowedRoles && !allowedRoles.includes(user.role)) {
      // If they are rejected, send Field staff to /landing, and Office staff to /
      return <Navigate to={(user.role === 'Driver' || user.role === 'Guide') ? "/landing" : "/"} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <TenantProvider>
        <Routes>
          
          {/* ======================================================== */}
          {/* PUBLIC ROUTES (No login required)                        */}
          {/* ======================================================== */}
          <Route path="/login" element={<Login />} />
          <Route path="/passport/:bookingId" element={<ClientPassport />} />
          <Route path="/book/:tripId" element={<PublicBooking />} />

          {/* 🌟 FIX: Corrected typo from /landin to /landing */}
          <Route path="/landing" element={<RoleGuard><Landing/></RoleGuard>}/>
      
          {/* ======================================================== */}
          {/* FIELD APP ROUTES (Protected, but NO Sidebar/Header)      */}
          {/* ======================================================== */}
          <Route path="/field-app" element={<RoleGuard><MobileFieldApp /></RoleGuard>} />
          <Route path="/driver-cockpit" element={<RoleGuard allowedRoles={['Driver', 'CEO', 'Operations']}><GuideMode /></RoleGuard>} />
          <Route path="/manifest" element={<RoleGuard allowedRoles={['Guide', 'Driver', 'CEO', 'Operations']}><GuideApp /></RoleGuard>} />

          {/* ======================================================== */}
          {/* MAIN APP ROUTES (Protected AND includes Sidebar Layout)  */}
          {/* ======================================================== */}
          
          {/* 🌟 FIX: Only Office Staff can see the Dashboard */}
          <Route path="/" element={<RoleGuard allowedRoles={['CEO', 'Operations', 'Finance']}><AppLayout><Dashboard /></AppLayout></RoleGuard>} />
          <Route path="/profile" element={<RoleGuard><AppLayout><Profile /></AppLayout></RoleGuard>} />

          {/* 🏢 OPERATIONS RESTRICTIONS */}
          <Route path="/ops-hub" element={<RoleGuard allowedRoles={['Operations', 'CEO']}><AppLayout><OpsHub /></AppLayout></RoleGuard>} /> 
          <Route path="/operations" element={<RoleGuard allowedRoles={['Operations', 'CEO']}><AppLayout><TourOperations /></AppLayout></RoleGuard>} />
          <Route path="/tour-operations" element={<RoleGuard allowedRoles={['Operations', 'CEO']}><AppLayout><TourOperations /></AppLayout></RoleGuard>} />
          <Route path="/fleet" element={<RoleGuard allowedRoles={['Operations', 'CEO']}><AppLayout><LiveFleet /></AppLayout></RoleGuard>} />
          <Route path="/suppliers" element={<RoleGuard allowedRoles={['Operations', 'Finance', 'CEO']}><AppLayout><SupplierPortal /></AppLayout></RoleGuard>} />
          <Route path="/communications" element={<RoleGuard allowedRoles={['Operations', 'CEO']}><AppLayout><Communications /></AppLayout></RoleGuard>} />

          {/* 💰 FINANCE RESTRICTIONS */}
          <Route path="/finance-hub" element={<RoleGuard allowedRoles={['Finance', 'CEO']}><AppLayout><FinanceHub /></AppLayout></RoleGuard>} />
          <Route path="/booking" element={<RoleGuard allowedRoles={['Finance', 'Operations', 'CEO']}><AppLayout><BookingEngine /></AppLayout></RoleGuard>} />
          <Route path="/expenses" element={<RoleGuard allowedRoles={['Finance', 'Operations', 'CEO']}><AppLayout><Expenses /></AppLayout></RoleGuard>} />
          <Route path="/invoices" element={<RoleGuard allowedRoles={['Finance', 'CEO']}><AppLayout><Invoices /></AppLayout></RoleGuard>} />
          <Route path="/finance-ledger" element={<RoleGuard allowedRoles={['Finance', 'CEO']}><AppLayout><FinanceLedger /></AppLayout></RoleGuard>} />
<Route path="/payroll" element={<RoleGuard allowedRoles={['Finance', 'CEO']}><AppLayout><Payroll /></AppLayout></RoleGuard>} />
          {/* 🤖 AI HUB RESTRICTIONS */}
          <Route path="/ai-hub" element={<RoleGuard allowedRoles={['Operations', 'Finance', 'CEO']}><AppLayout><AIHub /></AppLayout></RoleGuard>} />
          <Route path="/smartsave" element={<RoleGuard allowedRoles={['Finance', 'CEO']}><AppLayout><SmartSave /></AppLayout></RoleGuard>} />
          <Route path="/smartroute" element={<RoleGuard allowedRoles={['Operations', 'CEO']}><AppLayout><SmartRoute /></AppLayout></RoleGuard>} />
          <Route path="/smartyield" element={<RoleGuard allowedRoles={['Finance', 'Operations', 'CEO']}><AppLayout><SmartYield /></AppLayout></RoleGuard>} />
          <Route path="/smartmatch" element={<RoleGuard allowedRoles={['Operations', 'CEO']}><AppLayout><SmartMatch /></AppLayout></RoleGuard>} />

          {/* ⚙️ ADMIN & IT RESTRICTIONS */}
          <Route path="/admin-hub" element={<RoleGuard allowedRoles={['Finance', 'Operations', 'CEO']}><AppLayout><AdminHub /></AppLayout></RoleGuard>} />
          <Route path="/staff" element={<RoleGuard allowedRoles={['Operations', 'Finance', 'CEO']}><AppLayout><StaffManagement /></AppLayout></RoleGuard>} />
          <Route path="/settings" element={<RoleGuard allowedRoles={['Operations', 'CEO']}><AppLayout><Settings /></AppLayout></RoleGuard>} />
          <Route path="/subscription" element={<RoleGuard allowedRoles={['Finance', 'CEO']}><AppLayout><Subscription /></AppLayout></RoleGuard>} />
          
          <Route path="/auditlog" element={<RoleGuard allowedRoles={['CEO']}><AppLayout><AuditLog /></AppLayout></RoleGuard>} /> 
          
          {/* Fallback Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TenantProvider>
    </Router>
  );
};

export default App;