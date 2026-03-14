import React, { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import OpsHub from './pages/OpsHub';
import FinanceHub from './pages/FinanceHub';
import AIHub from './pages/AIHub';
import AdminHub from './pages/AdminHub';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StaffManagement from './pages/StaffManagement';
import BookingEngine from './pages/BookingEngine';
import Operations from './pages/Operations';
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


// --- TYPES & INTERFACES ---

interface LayoutProps {
  children: ReactNode;
}

interface ProtectedRouteProps {
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

// Route Guard
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth() as any; 
  
  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-400">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          
          {/* ======================================================== */}
          {/* PUBLIC ROUTES (No login required)                        */}
          {/* ======================================================== */}
          <Route path="/login" element={<Login />} />
          <Route path="/passport/:bookingId" element={<ClientPassport />} />
      
          {/* ======================================================== */}
          {/* FIELD APP ROUTE (Protected, but NO Sidebar/Header Layout)*/}
          {/* ======================================================== */}
          <Route path="/field-app" element={<ProtectedRoute><MobileFieldApp /></ProtectedRoute>} />

          {/* ======================================================== */}
          {/* MAIN APP ROUTES (Protected AND includes Sidebar Layout)  */}
          {/* ======================================================== */}
          <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/booking" element={<ProtectedRoute><AppLayout><BookingEngine /></AppLayout></ProtectedRoute>} />
          <Route path="/operations" element={<ProtectedRoute><AppLayout><Operations /></AppLayout></ProtectedRoute>} />
          <Route path="/fleet" element={<ProtectedRoute><AppLayout><LiveFleet /></AppLayout></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute><AppLayout><StaffManagement /></AppLayout></ProtectedRoute>} />
          <Route path="/suppliers" element={<ProtectedRoute><AppLayout><SupplierPortal /></AppLayout></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><AppLayout><Expenses /></AppLayout></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><AppLayout><Invoices /></AppLayout></ProtectedRoute>} />
          <Route path="/finance-ledger" element={<ProtectedRoute><AppLayout><FinanceLedger /></AppLayout></ProtectedRoute>} />
          <Route path="/subscription" element={<ProtectedRoute><AppLayout><Subscription /></AppLayout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
          <Route path="/auditlog" element={<ProtectedRoute><AppLayout><AuditLog /></AppLayout></ProtectedRoute>} />
          <Route path="/payroll" element={<ProtectedRoute><AppLayout><Payroll /></AppLayout></ProtectedRoute>} />
          <Route path="/smartsave" element={<ProtectedRoute><AppLayout><SmartSave /></AppLayout></ProtectedRoute>} />
          <Route path="/smartroute" element={<ProtectedRoute><AppLayout><SmartRoute /></AppLayout></ProtectedRoute>} />
          <Route path="/smartyield" element={<ProtectedRoute><AppLayout><SmartYield /></AppLayout></ProtectedRoute>} />
          <Route path="/smartmatch" element={<ProtectedRoute><AppLayout><SmartMatch /></AppLayout></ProtectedRoute>} />
          <Route path="/communications" element={<ProtectedRoute><AppLayout><Communications /></AppLayout></ProtectedRoute>} />
          
          {/* 🟢 NEW HUB PAGES PROPERLY WRAPPED IN AppLayout */}
          <Route path="/ops-hub" element={<ProtectedRoute><AppLayout><OpsHub /></AppLayout></ProtectedRoute>} /> 
          <Route path="/admin-hub" element={<ProtectedRoute><AppLayout><AdminHub /></AppLayout></ProtectedRoute>} />
          <Route path="/ai-hub" element={<ProtectedRoute><AppLayout><AIHub /></AppLayout></ProtectedRoute>} />
          <Route path="/finance-hub" element={<ProtectedRoute><AppLayout><FinanceHub /></AppLayout></ProtectedRoute>} />
          
          {/* Fallback Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;