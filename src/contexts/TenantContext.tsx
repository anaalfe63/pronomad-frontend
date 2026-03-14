import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// 1. Expand the interface to include the global settings
export interface TenantData {
  subscriberId: string;
  role: string;
  fullName: string;
  username: string;
  access: string[];
  plan: 'basic' | 'pro' | 'premium';
  activeBranchId: string | null;
  subscriptionExpiresAt: string; 
  isExpired: boolean;
  daysRemaining: number;
  uid?: string;
  email?: string;
  status: 'active' | 'suspended' | 'terminated';
  // --- GLOBAL SETTINGS ---
  prefix?: string;
  currency?: string;
  companyLogo?: string;
  companyName?: string;
  taxRate?: number;
  themeColor?: string;
  address?: string;
  supportEmail?: string;
}

interface TenantContextType {
  user: TenantData | null;
  loading: boolean;
  initializing: boolean; 
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
  login: (loginData: { loginName: string; loginPin: string }) => Promise<void>;
  logout: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// --- PRONOMAD ACCESS CONTROL ---
const getModulesForRole = (role: string, plan: string): string[] => {
  const r = (role || 'agent').toLowerCase();
  const p = (plan || 'basic').toLowerCase();

  const basicPlan = ['dashboard', 'tours', 'bookings', 'settings'];
  const proPlan = [...basicPlan, 'itinerary-builder', 'customer-crm'];
  const premiumPlan = [...proPlan, 'analytics', 'marketing'];
  
  const planCeiling = p === 'premium' ? premiumPlan : (p === 'pro' ? proPlan : basicPlan);

  let roleAccess: string[] = [];

  if (r.includes('ceo') || r.includes('admin') || r === 'owner') {
    roleAccess = planCeiling;
  } else if (r.includes('manager')) {
    roleAccess = ['dashboard', 'tours', 'bookings', 'customer-crm'];
  } else {
    // Standard Agent
    roleAccess = ['dashboard', 'bookings'];
  }

  return roleAccess.filter(module => planCeiling.includes(module));
};

const calculateDaysRemaining = (expiryDateString: string) => {
  if (!expiryDateString) return 0;
  const expiry = new Date(expiryDateString);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// --- HELPER: FETCH GLOBAL SETTINGS ---
const fetchSystemSettings = async (subscriberId: string) => {
  try {
    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .eq('subscriber_id', subscriberId)
      .single();

    if (settings?.theme_color) {
       document.documentElement.style.setProperty('--brand-primary', settings.theme_color);
    }
    return settings;
  } catch (e) {
    return null;
  }
};

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<TenantData | null>(null);
  const [loading] = useState(false);
  const [initializing, setInitializing] = useState(true); 
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(() => localStorage.getItem('pronomad_active_branch'));

  const setActiveBranchId = (id: string | null) => {
    setActiveBranchIdState(id);
    if (id) localStorage.setItem('pronomad_active_branch', id);
    else localStorage.removeItem('pronomad_active_branch');
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const subId = localStorage.getItem('pronomad_active_sub_id');
        const sessionRole = localStorage.getItem('pronomad_user_role');
        const savedName = localStorage.getItem('pronomad_user_name');
        const savedUsername = localStorage.getItem('pronomad_user_username');

        if (!subId) { 
          setInitializing(false); 
          return; 
        }

        const { data: subData, error } = await supabase
          .from('subscribers')
          .select('*')
          .eq('id', subId)
          .single();

        if (error || !subData) {
          logout();
          return;
        }

        // 🌟 THE PRO TRICK: Fetch System Settings on App Load
        const settings = await fetchSystemSettings(subData.id);

        const expiryStr = subData.subscriptionExpiresAt || subData.endDate || subData.subscription_expires_at || "";
        const daysRemaining = calculateDaysRemaining(expiryStr);
        const rawPlan = (subData.plan || 'basic').toLowerCase().trim();
        
        setUser({
          subscriberId: subData.id,
          fullName: savedName || subData.fullName || subData.full_name,
          username: savedUsername || subData.username,
          role: sessionRole || subData.role || "CEO",
          plan: rawPlan as any,
          access: getModulesForRole(sessionRole || subData.role || "CEO", rawPlan),
          activeBranchId: localStorage.getItem('pronomad_active_branch'),
          subscriptionExpiresAt: expiryStr,
          daysRemaining: daysRemaining,
          isExpired: daysRemaining <= 0,
          uid: subData.id, 
          email: subData.email || '',
          status: subData.status || 'active',
          // Apply Global Settings
          prefix: settings?.system_prefix || 'PN',
          currency: settings?.currency || 'GHS',
          companyLogo: settings?.company_logo || '',
          companyName: settings?.company_name || 'Pronomad Travels',
          taxRate: Number(settings?.tax_rate || 0),
          themeColor: settings?.theme_color || '#0d9488',
          address: settings?.address || '',
          supportEmail: settings?.support_email || ''
        });

        setInitializing(false);
      } catch (err) {
        console.error("Auth Init Error:", err);
        setInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials: any) => {
    const { loginName, loginPin } = credentials;

    try {
      if (loginName.startsWith('e') || loginName.includes('-')) {
        // --- STAFF LOGIN (Agents) ---
        const { data: staffMatch, error } = await supabase
          .from('staff')
          .select('*, branches(id), subscribers(*)')
          .eq('eusername', loginName)
          .eq('epin', loginPin)
          .single();

        if (error || !staffMatch) throw new Error("Invalid Agent Credentials.");
        
        if (staffMatch.subscribers?.app !== 'pronomad') {
            throw new Error("Unauthorized Application Access.");
        }

        // 🌟 THE PRO TRICK: Fetch System Settings on Agent Login
        const settings = await fetchSystemSettings(staffMatch.subscriber_id || staffMatch.subscribers?.id);

        const bossPlan = (staffMatch.subscribers?.plan || 'basic').toLowerCase().trim();
        const role = staffMatch.role || 'Agent';
        const expiryDate = staffMatch.subscribers?.subscriptionExpiresAt || staffMatch.subscribers?.endDate || '';
        const daysLeft = calculateDaysRemaining(expiryDate);

        const formattedUser = {
            subscriberId: staffMatch.subscriber_id || staffMatch.subscribers?.id,
            fullName: staffMatch.full_name || staffMatch.name,
            username: staffMatch.eusername,
            role: role,
            plan: bossPlan as any,
            access: getModulesForRole(role, bossPlan),
            activeBranchId: staffMatch.branch_id,
            subscriptionExpiresAt: expiryDate,
            daysRemaining: daysLeft,
            isExpired: daysLeft <= 0,
            uid: staffMatch.id,
            email: staffMatch.email || '',
            status: staffMatch.status || 'active',
            // Apply Global Settings
            prefix: settings?.system_prefix || 'PN',
            currency: settings?.currency || 'GHS',
            companyLogo: settings?.company_logo || '',
            companyName: settings?.company_name || 'Pronomad Travels',
            taxRate: Number(settings?.tax_rate || 0),
            themeColor: settings?.theme_color || '#0d9488',
            address: settings?.address || '',
            supportEmail: settings?.support_email || ''
        };

        saveSession(formattedUser, staffMatch.branch_id);

      } else {
        // --- CEO LOGIN ---
        const response = await supabase
          .from('subscribers')
          .select('*')
          .eq('username', loginName)
          .eq('pin', loginPin)
          .eq('app', 'pronomad'); 

        if (response.error) throw new Error(`Database Error: ${response.error.message}`);
        if (!response.data || response.data.length === 0) throw new Error("Invalid username or PIN.");

        const ceoMatch = response.data[0];

        const { data: branchData } = await supabase
          .from('branches')
          .select('id')
          .eq('subscriber_id', ceoMatch.id)
          .limit(1);

        // 🌟 THE PRO TRICK: Fetch System Settings on CEO Login
        const settings = await fetchSystemSettings(ceoMatch.id);

        const branchId = branchData && branchData.length > 0 ? branchData[0].id : null;
        const rawPlan = (ceoMatch.plan || 'basic').toLowerCase().trim();
        const role = ceoMatch.role || 'CEO';

        const formattedUser = {
            subscriberId: ceoMatch.id,
            fullName: ceoMatch.fullName || ceoMatch.full_name,
            username: ceoMatch.username,
            role: role,
            plan: rawPlan as any,
            access: getModulesForRole(role, rawPlan),
            activeBranchId: branchId,
            subscriptionExpiresAt: ceoMatch.subscriptionExpiresAt || ceoMatch.endDate || '',
            daysRemaining: calculateDaysRemaining(ceoMatch.subscriptionExpiresAt || ceoMatch.endDate),
            isExpired: false,
            uid: ceoMatch.id,
            email: ceoMatch.email,
            status: ceoMatch.status || 'active',
            // Apply Global Settings
            prefix: settings?.system_prefix || 'PN',
            currency: settings?.currency || 'GHS',
            companyLogo: settings?.company_logo || '',
            companyName: settings?.company_name || 'Pronomad Travels',
            taxRate: Number(settings?.tax_rate || 0),
            themeColor: settings?.theme_color || '#0d9488',
            address: settings?.address || '',
            supportEmail: settings?.support_email || ''
        };

        saveSession(formattedUser, branchId);
      }
    } catch (err: any) {
      throw new Error(err.message || "Authentication Failed");
    }
  };

  const saveSession = (formattedUser: any, branchId: string | null) => {
    localStorage.setItem('pronomad_active_sub_id', formattedUser.subscriberId);
    localStorage.setItem('pronomad_user_role', formattedUser.role);
    localStorage.setItem('pronomad_user_name', formattedUser.fullName);
    localStorage.setItem('pronomad_user_username', formattedUser.username);
    localStorage.setItem('pronomad_user', JSON.stringify(formattedUser));

    setUser(formattedUser);
    setActiveBranchId(branchId);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setActiveBranchIdState(null);
    setInitializing(false);
    window.location.href = '/login';
  };

  return (
    <div style={{ '--tw-ring-color': user?.themeColor || '#0d9488' } as React.CSSProperties}>
       <TenantContext.Provider value={{ user, loading, initializing, activeBranchId, setActiveBranchId, login, logout }}>
         {children}
       </TenantContext.Provider>
    </div>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within a TenantProvider');
  return context;
};