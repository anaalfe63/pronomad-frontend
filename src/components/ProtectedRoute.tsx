import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';

// 🌟 FIX: Added isSubscriptionPage to the interface so TypeScript knows it exists
interface ProtectedRouteProps {
  isAllowed?: boolean; 
  isSubscriptionPage?: boolean; 
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  isAllowed = true, 
  isSubscriptionPage = false, // 🌟 FIX: Destructure it here with a default value
  children 
}) => {
  const { user, loading, initializing } = useTenant();
  const location = useLocation();

  // Show nothing while we figure out who the user is
  if (initializing || loading) {
    return null; 
  }

  // 🔒 STEP 1: Not logged in? Go to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 🔒 STEP 2: Unauthorized Role? Send them to the root to be re-routed
  if (!isAllowed) {
    console.warn("⛔ ACCESS DENIED: Unauthorized Role.");
    return <Navigate to="/" replace />;
  }

  // 🔒 STEP 3: Account Expired? 
  // We use the new prop here. If they are expired AND it's not the billing page, block the render!
  if (user.isExpired && !isSubscriptionPage) {
    return <div className="h-full w-full bg-slate-50"></div>;
  }

  // 🟢 ALL CLEAR
  return <>{children}</>;
};

export default ProtectedRoute;