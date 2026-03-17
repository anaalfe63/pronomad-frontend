import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[]; 
}

const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles }) => {
  const { user } = useTenant();
  const location = useLocation();

  // 1. If there is no user, send them to login
  if (!user) return <Navigate to="/login" replace />;

  // 2. 👑 GOD MODE: ONLY PROADMIN bypasses all restrictions
  if (user.role === 'PROADMIN') {
      return <>{children}</>;
  }

  // 3. 🚨 FOOLPROOF DASHBOARD BLOCKER
  // If they try to load the main dashboard ("/") and they ARE NOT a CEO or Operations...
  if (location.pathname === '/' && user.role !== 'CEO' && user.role !== 'Operations') {
      // Kick them straight to the employee landing page!
      return <Navigate to="/landing" replace />;
  }

  // 4. Dynamic Route Checking (For your other pages)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Prevent infinite loops if they are already on /landing
      if (location.pathname !== '/landing') {
          return <Navigate to="/landing" replace />; 
      }
  }

  // 5. If they pass the checks, render the page
  return <>{children}</>;
};

export default RoleGuard;