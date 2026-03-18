import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// 1. Pronomad Tenant Data
export interface TenantData {
  subscriberId: string;
  role: string;
  fullName: string;
  username: string;
  access: string[];
  plan: 'basic' | 'pro' | 'premium';
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
  login: (loginData: { loginName: string; loginPin: string }) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<TenantData>) => void; 
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// --- PRONOMAD ACCESS CONTROL ---
const getModulesForRole = (role: string, plan: string): string[] => {
  const r = (role || 'agent').toLowerCase();
  const p = (plan || 'basic').toLowerCase();

  const basicPlan = ['dashboard', 'tours', 'bookings', 'fleet', 'settings'];
  const proPlan = [...basicPlan, 'itinerary-builder', 'customer-crm', 'staff'];
  const premiumPlan = [...proPlan, 'analytics', 'marketing'];
  
  const planCeiling = p === 'premium' ? premiumPlan : (p === 'pro' ? proPlan : basicPlan);

  let roleAccess: string[] = [];

  if (r.includes('ceo') || r.includes('admin') || r === 'owner' || r === 'proadmin') {
    roleAccess = planCeiling;
  } else if (r.includes('operations')) {
    roleAccess = ['dashboard', 'tours', 'bookings', 'fleet', 'customer-crm'];
  } else if (r.includes('finance')) {
    roleAccess = ['dashboard', 'bookings', 'analytics'];
  } else {
    roleAccess = ['dashboard', 'tours'];
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

const fetchSystemSettings = async (subscriberId: string) => {
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('subscriber_id', subscriberId)
      .maybeSingle(); 

    if (error) {
       console.warn("System Settings Note:", error.message);
       return null;
    }

    if (settings?.theme_color) {
       document.documentElement.style.setProperty('--brand-primary', settings.theme_color);
    }
    return settings || null; 
  } catch (e) {
    return null;
  }
};

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<TenantData | null>(null);
  const [loading] = useState(false);
  const [initializing, setInitializing] = useState(true); 

  const saveSession = (formattedUser: any) => {
    localStorage.setItem('pronomad_active_sub_id', formattedUser.subscriberId);
    localStorage.setItem('pronomad_user_role', formattedUser.role);
    localStorage.setItem('pronomad_user_name', formattedUser.fullName);
    localStorage.setItem('pronomad_user_username', formattedUser.username);
    localStorage.setItem('pronomad_user', JSON.stringify(formattedUser));

    setUser(formattedUser);
  };

  const updateUser = (updates: Partial<TenantData>) => {
    setUser(prev => {
        if (!prev) return prev;
        const updatedUser = { ...prev, ...updates };
        localStorage.setItem('pronomad_user', JSON.stringify(updatedUser)); // Keep storage in sync
        return updatedUser;
    });
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setInitializing(false);
    window.location.href = '/login';
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const subId = localStorage.getItem('pronomad_active_sub_id');
        const sessionRole = localStorage.getItem('pronomad_user_role');
        const savedName = localStorage.getItem('pronomad_user_name');
        const savedUsername = localStorage.getItem('pronomad_user_username');
        const savedUserStr = localStorage.getItem('pronomad_user');

        let cachedUser: any = null;

        if (!subId) { 
          setInitializing(false); 
          return; 
        }

        // 🌟 CACHE CAPTURE: Save the local storage user so we can fall back to it
        if (savedUserStr) {
            cachedUser = JSON.parse(savedUserStr);
            setUser(cachedUser);
        }

        // Then fetch fresh data in the background
        const { data: subData, error } = await supabase
          .from('subscribers')
          .select('*')
          .eq('id', subId)
          .single();

        if (error || !subData) {
          logout();
          return;
        }

        const settings = await fetchSystemSettings(subData.id);

        const expiryStr = subData.subscriptionExpiresAt || subData.endDate || subData.subscription_expires_at || "";
        const daysRemaining = calculateDaysRemaining(expiryStr);
        const rawPlan = (subData.plan || 'basic').toLowerCase().trim();
        
        const freshUser = {
          subscriberId: subData.id,
          fullName: savedName || subData.fullName || subData.full_name,
          username: savedUsername || subData.username || subData.email,
          role: sessionRole || subData.role || "CEO",
          plan: rawPlan as any,
          access: getModulesForRole(sessionRole || subData.role || "CEO", rawPlan),
          subscriptionExpiresAt: expiryStr,
          daysRemaining: daysRemaining,
          isExpired: daysRemaining <= 0,
          uid: subData.id, 
          email: subData.email || '',
          status: subData.status || 'active',
          
          // 🌟 THE FIX: Chain of command logic -> Database OR Cache OR Default
          prefix: settings?.system_prefix || cachedUser?.prefix || 'PND',
          currency: settings?.currency || cachedUser?.currency || 'GHS',
          companyLogo: settings?.company_logo || cachedUser?.companyLogo || '',
          companyName: settings?.company_name || cachedUser?.companyName || 'Pronomad Travels',
          taxRate: Number(settings?.tax_rate ?? cachedUser?.taxRate ?? 0),
          themeColor: settings?.theme_color || cachedUser?.themeColor || '#0d9488',
          address: settings?.address || cachedUser?.address || '',
          supportEmail: settings?.support_email || cachedUser?.supportEmail || ''
        };

        // Push the final protected state
        setUser(freshUser as TenantData);
        localStorage.setItem('pronomad_user', JSON.stringify(freshUser));
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
      if (loginName === 'PROADMIN' && loginPin === '!Ab3nkwan.') {
        const masterUser = {
            subscriberId: 'PROADMIN-MASTER', 
            fullName: 'System Administrator',
            username: 'PROADMIN',
            role: 'PROADMIN',
            plan: 'premium' as any,
            access: ['dashboard', 'tours', 'bookings', 'fleet', 'settings', 'itinerary-builder', 'customer-crm', 'staff', 'analytics', 'marketing'], 
            subscriptionExpiresAt: '2099-12-31',
            daysRemaining: 9999,
            isExpired: false,
            uid: 'proadmin-001',
            email: 'admin@pronomad.com',
            status: 'active' as any,
            prefix: 'PND',
            currency: 'GHS',
            companyLogo: '',
            companyName: 'Pronomad Master Console',
            taxRate: 0,
            themeColor: '#0f172a', 
            address: 'HQ',
            supportEmail: 'support@pronomad.com'
        };
        saveSession(masterUser);
        return; 
      }

      const { data: ceoData, error: ceoError } = await supabase
        .from('subscribers')
        .select('*')
        .eq('username', loginName) 
        .eq('pin', loginPin)       
        .eq('app', 'pronomad'); 

      if (ceoData && ceoData.length > 0) {
        const ceoMatch = ceoData[0];
        const settings = await fetchSystemSettings(ceoMatch.id);
        const rawPlan = (ceoMatch.plan || 'basic').toLowerCase().trim();
        const role = ceoMatch.role || 'CEO';

        const formattedUser = {
            subscriberId: ceoMatch.id,
            fullName: ceoMatch.fullName || ceoMatch.full_name,
            username: ceoMatch.username, 
            role: role,
            plan: rawPlan as any,
            access: getModulesForRole(role, rawPlan),
            subscriptionExpiresAt: ceoMatch.subscriptionExpiresAt || ceoMatch.endDate || '',
            daysRemaining: calculateDaysRemaining(ceoMatch.subscriptionExpiresAt || ceoMatch.endDate),
            isExpired: false,
            uid: ceoMatch.id,
            email: ceoMatch.email,
            status: ceoMatch.status || 'active',
            prefix: settings?.system_prefix || 'PND',
            currency: settings?.currency || 'GHS',
            companyLogo: settings?.company_logo || '',
            companyName: settings?.company_name || 'Pronomad Travels',
            taxRate: Number(settings?.tax_rate || 0),
            themeColor: settings?.theme_color || '#0d9488',
            address: settings?.address || '',
            supportEmail: settings?.support_email || ''
        };
        saveSession(formattedUser);
      } else {
        const { data: staffMatch, error } = await supabase
          .from('staff')
          .select('*') 
          .eq('username', loginName)   
          .eq('password', loginPin)    
          .single();

        if (error || !staffMatch) {
            throw new Error("Invalid Username or Password.");
        }
        
        const { data: bossData } = await supabase
          .from('subscribers')
          .select('*')
          .eq('id', staffMatch.subscriber_id)
          .single();

        if (!bossData || bossData.app !== 'pronomad') {
            throw new Error("Unauthorized Application Access.");
        }

        const settings = await fetchSystemSettings(staffMatch.subscriber_id);
        const bossPlan = (bossData.plan || 'basic').toLowerCase().trim();
        const role = staffMatch.role || 'Guide';
        const expiryDate = bossData.subscriptionExpiresAt || bossData.endDate || '';
        const daysLeft = calculateDaysRemaining(expiryDate);

        const formattedUser = {
            subscriberId: staffMatch.subscriber_id,
            fullName: staffMatch.full_name || staffMatch.name,
            username: staffMatch.username,
            role: role,
            plan: bossPlan as any,
            access: getModulesForRole(role, bossPlan),
            subscriptionExpiresAt: expiryDate,
            daysRemaining: daysLeft,
            isExpired: daysLeft <= 0,
            uid: staffMatch.id,
            email: staffMatch.email || '',
            status: staffMatch.status || 'active',
            prefix: settings?.system_prefix || 'PND',
            currency: settings?.currency || 'GHS',
            companyLogo: settings?.company_logo || '',
            companyName: settings?.company_name || 'Pronomad Travels',
            taxRate: Number(settings?.tax_rate || 0),
            themeColor: settings?.theme_color || '#0d9488',
            address: settings?.address || '',
            supportEmail: settings?.support_email || ''
        };

        saveSession(formattedUser);
      }
    } catch (err: any) {
      throw new Error(err.message || "Authentication Failed");
    }
  };

  return (
    <div style={{ '--tw-ring-color': user?.themeColor || '#0d9488' } as React.CSSProperties}>
       <TenantContext.Provider value={{ user, loading, initializing, login, logout, updateUser }}>
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