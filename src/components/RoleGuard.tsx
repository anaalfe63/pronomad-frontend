import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Made optional just in case you wrap a page without specific roles
}

const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles }) => {
  const { user } = useTenant();

  // 1. If there is no user, send them to login
  if (!user) return <Navigate to="/login" replace />;

  // 2. 👑 GOD MODE: ONLY PROADMIN bypasses all restrictions
  if (user.role === 'PROADMIN') {
      return <>{children}</>;
  }

  // 3. If the route has specific allowed roles and the user isn't one of them, kick them out
  if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to="/" replace />; // Kicks them back to the Home Dashboard
  }

  // 4. If they pass the check, render the page
  return <>{children}</>;
};

export default RoleGuard;