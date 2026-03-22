import React, { createContext, useContext, useState,
   useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// 1. User Identity Data
export interface TenantData {
  subscriberId: string;
  role: string;
  fullName: string;
  username: string;
  access: string[];
  plan: 'basic' | 'pro' | 'premium' | 'startup';
  subscriptionExpiresAt: string; 
  isExpired: boolean;
  daysRemaining: number;
  uid?: string;
  email?: string;
  status: 'active' | 'suspended' | 'terminated';
  companyName?:string;
  themeColor?: string;
}

// 2. Global Company Settings Data (The Master Truth)
export interface GlobalSettings {
  company_name: string;
  company_logo: string;
  support_email: string;
  address: string;
  country: string;
  currency: string;
  tax_rate: number;
  system_prefix: string;
  theme_color: string;
  date_format: string;
  time_format: string;
  timezone: string;
  invoice_prefix: string;
  merchant_number: string;
  distance_unit: string;
  receipt_footer_note: string;
  default_deposit_pct: number;
  auto_send_receipts: boolean;
  enable_smartyield_ai: boolean;
  sms_notifications: boolean;
  session_timeout_mins: number;
  require_staff_mfa: boolean;
  restrict_ip_access: boolean;
}

interface TenantContextType {
  user: TenantData | null;
  settings: GlobalSettings; 
  loading: boolean;
  initializing: boolean; 
  login: (loginData: { loginName: string; loginPin: string }) => Promise<void>;
  logout: () => void;
  applySettings: (newSettings: Partial<GlobalSettings>) => void; 
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// Default Fallback Settings
const DEFAULT_SETTINGS: GlobalSettings = {
  company_name: 'Pronomad Travels',
  company_logo: '', support_email: '', address: '', country: 'GH', currency: 'GHS',
  tax_rate: 0, system_prefix: 'PND', theme_color: '#0d9488', date_format: 'DD/MM/YYYY',
  time_format: '12h', timezone: 'Africa/Accra', invoice_prefix: 'INV', merchant_number: '',
  distance_unit: 'km', receipt_footer_note: 'Thank you for your business!',
  default_deposit_pct: 20, auto_send_receipts: true, enable_smartyield_ai: true,
  sms_notifications: true, session_timeout_mins: 60, require_staff_mfa: false, restrict_ip_access: false
};

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

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<TenantData | null>(null);
  const [settings, setSettings] = useState<GlobalSettings>(() => {
    const cached = localStorage.getItem('pronomad_settings_cache');
    return cached ? JSON.parse(cached) : DEFAULT_SETTINGS;
  });
  
  // 🌟 FIX: Added the missing setLoading setter!
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true); 

  const loadSettingsFromDB = async (subscriberId: string) => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .eq('subscriber_id', subscriberId)
        .order('updated_at', { ascending: false, nullsFirst: false }) 
        .limit(1);

      if (data && data.length > 0) {
        const freshSettings = { ...DEFAULT_SETTINGS, ...data[0] };
        setSettings(freshSettings);
        localStorage.setItem('pronomad_settings_cache', JSON.stringify(freshSettings));
        document.documentElement.style.setProperty('--brand-primary', freshSettings.theme_color || '#0d9488');
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  };

  const applySettings = (newSettings: Partial<GlobalSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('pronomad_settings_cache', JSON.stringify(updated));
      document.documentElement.style.setProperty('--brand-primary', updated.theme_color || '#0d9488');
      return updated;
    });
  };

  const saveSession = (formattedUser: any) => {
    localStorage.setItem('pronomad_active_sub_id', formattedUser.subscriberId);
    localStorage.setItem('pronomad_user_role', formattedUser.role);
    localStorage.setItem('pronomad_user_name', formattedUser.fullName);
    localStorage.setItem('pronomad_user_username', formattedUser.username);
    localStorage.setItem('pronomad_user', JSON.stringify(formattedUser));
    setUser(formattedUser);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setSettings(DEFAULT_SETTINGS);
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

        if (!subId) { 
          setInitializing(false); 
          return; 
        }

        if (savedUserStr) {
            setUser(JSON.parse(savedUserStr));
            const cachedSet = localStorage.getItem('pronomad_settings_cache');
            if (cachedSet) document.documentElement.style.setProperty('--brand-primary', JSON.parse(cachedSet).theme_color || '#0d9488');
            loadSettingsFromDB(subId); 
        }

        const { data: subData, error } = await supabase.from('subscribers').select('*').eq('id', subId).single();
        if (error || !subData) {
          logout();
          return;
        }

        const expiryStr = subData.subscriptionExpiresAt || subData.endDate || subData.subscription_expires_at || "";
        const rawPlan = (subData.plan || 'basic').toLowerCase().trim();
        
        const freshUser: TenantData = {
          subscriberId: subData.id,
          fullName: savedName || subData.fullName || subData.full_name,
          username: savedUsername || subData.username || subData.email,
          role: sessionRole || subData.role || "CEO",
          plan: rawPlan as any,
          access: getModulesForRole(sessionRole || subData.role || "CEO", rawPlan),
          subscriptionExpiresAt: expiryStr,
          daysRemaining: calculateDaysRemaining(expiryStr),
          isExpired: calculateDaysRemaining(expiryStr) <= 0,
          uid: subData.id, 
          email: subData.email || '',
          status: subData.status || 'active',
        };

        setUser(freshUser);
        localStorage.setItem('pronomad_user', JSON.stringify(freshUser));
        
        if (!savedUserStr) loadSettingsFromDB(subData.id);
        
        setInitializing(false);
      } catch (err) {
        setInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  // 🌟 FIX: Bulletproof, case-insensitive login for Subscribers and Staff
  const login = async (credentials: any) => {
    setLoading(true);
    // Trim spaces just in case the user accidentally hit spacebar
    const loginName = credentials.loginName.trim();
    const loginPin = credentials.loginPin;

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
            status: 'active' as any
        };
        saveSession(masterUser);
        setLoading(false);
        return; 
      }

      // 1. 👑 SUBSCRIBER / CEO LOGIN
      // Checks BOTH username and email columns, ignoring case-sensitivity
      const { data: ceoData } = await supabase
        .from('subscribers')
        .select('*')
        .or(`username.ilike.${loginName},email.ilike.${loginName}`) 
        .eq('pin', loginPin)       
        .eq('app', 'pronomad'); 

      if (ceoData && ceoData.length > 0) {
        const ceoMatch = ceoData[0];
        const rawPlan = (ceoMatch.plan || 'basic').toLowerCase().trim();
        const role = ceoMatch.role || 'CEO';

        const formattedUser = {
            subscriberId: ceoMatch.id,
            fullName: ceoMatch.fullName || ceoMatch.full_name,
            username: ceoMatch.username || ceoMatch.email, 
            role: role,
            plan: rawPlan as any,
            access: getModulesForRole(role, rawPlan),
            subscriptionExpiresAt: ceoMatch.subscriptionExpiresAt || ceoMatch.endDate || '',
            daysRemaining: calculateDaysRemaining(ceoMatch.subscriptionExpiresAt || ceoMatch.endDate),
            isExpired: false,
            uid: ceoMatch.id,
            email: ceoMatch.email,
            status: ceoMatch.status || 'active'
        };
        saveSession(formattedUser);
        setLoading(false);
        return;
      } 
      
      // 2. 🚐 STAFF LOGIN (Prefix usernames)
      // Case-insensitive check for staff
      const { data: staffMatch, error } = await supabase
          .from('staff')
          .select('*') 
          .ilike('username', loginName)  
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
          status: staffMatch.status || 'active'
      };

      saveSession(formattedUser);
      setLoading(false);
      return;
      
    } catch (err: any) {
      setLoading(false);
      throw new Error(err.message || "Authentication Failed");
    }
  };

  return (
    <div style={{ '--tw-ring-color': settings.theme_color || '#0d9488' } as React.CSSProperties}>
       <TenantContext.Provider value={{ user, settings, loading, initializing, login, logout, applySettings }}>
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