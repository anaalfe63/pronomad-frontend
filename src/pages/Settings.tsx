import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { 
  Settings as SettingsIcon, Building, ShieldAlert, 
  CreditCard, Save, CheckCircle, Palette, Upload, Image as ImageIcon,
  CloudOff, CloudUpload, RefreshCw, Briefcase, Hash, MapPin, Globe,
  ToggleRight, Bell, Shield, Percent, Clock, Sparkles, Map, FileText
} from 'lucide-react';

interface SystemSettings {
  company_name: string;
  support_email: string;
  address: string;
  registration_number: string;
  company_logo: string;
  currency: string;
  tax_rate: number;
  tax_id: string;
  system_prefix: string;
  theme_color: string;
  date_format: string;
  // NEW: Localization & Units
  time_format: string;
  timezone: string;
  distance_unit: string;
  // NEW: Invoicing
  invoice_prefix: string;
  receipt_footer_note: string;
  // Operations & Automations
  default_deposit_pct: number;
  auto_send_receipts: boolean;
  enable_smartyield_ai: boolean;
  sms_notifications: boolean;
  // Security & Access
  session_timeout_mins: number;
  require_staff_mfa: boolean;
  restrict_ip_access: boolean;
}

interface SyncAction {
  id: number;
  table: string;
  action: 'UPSERT';
  payload?: any;
}

const CURRENCIES = [
  { code: 'GHS', name: 'Ghanaian Cedi' }, { code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' }, { code: 'NGN', name: 'Nigerian Naira' }, { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'ZAR', name: 'South African Rand' }
];

const TIMEZONES = [
  { code: 'Africa/Accra', name: 'GMT (Accra / London)' },
  { code: 'Africa/Lagos', name: 'WAT (Lagos)' },
  { code: 'Africa/Nairobi', name: 'EAT (Nairobi)' },
  { code: 'America/New_York', name: 'EST (New York)' },
  { code: 'Europe/Paris', name: 'CET (Paris)' },
  { code: 'Asia/Dubai', name: 'GST (Dubai)' }
];

const Settings: React.FC = () => {
  const { user } = useTenant();
  const APP_COLOR = user?.themeColor || '#10b981';

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'identity' | 'financial' | 'operations' | 'branding' | 'security'>('identity');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<SystemSettings>({
    company_name: '', support_email: '', address: '', registration_number: '', company_logo: '', 
    currency: 'GHS', tax_rate: 0, tax_id: '', invoice_prefix: 'INV', receipt_footer_note: 'Thank you for your business!',
    system_prefix: 'PN', theme_color: '#10b981', date_format: 'DD/MM/YYYY', time_format: '12h', timezone: 'Africa/Accra', distance_unit: 'km',
    default_deposit_pct: 20, auto_send_receipts: true, enable_smartyield_ai: true, sms_notifications: true,
    session_timeout_mins: 60, require_staff_mfa: false, restrict_ip_access: false
  });

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<SyncAction[]>(() => {
     const saved = localStorage.getItem('pronomad_settings_sync');
     return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => { localStorage.setItem('pronomad_settings_sync', JSON.stringify(pendingSyncs)); }, [pendingSyncs]);

  const processSyncQueue = useCallback(async () => {
      if (!navigator.onLine || pendingSyncs.length === 0 || isSyncing || !user?.subscriberId) return;
      setIsSyncing(true);
      const remaining = [...pendingSyncs];

      for (const task of pendingSyncs) {
          try {
              if (task.action === 'UPSERT') {
                  const { error } = await supabase.from('system_settings').upsert({ ...task.payload, subscriber_id: user.subscriberId });
                  if (error) throw error;
              }
              remaining.shift();
          } catch (e) { break; }
      }
      
      setPendingSyncs(remaining);
      setIsSyncing(false);
  }, [pendingSyncs, isSyncing, user?.subscriberId]);

  useEffect(() => {
      const handleOnline = () => { setIsOnline(true); processSyncQueue(); };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [processSyncQueue]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.subscriberId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.from('system_settings').select('*').eq('subscriber_id', user.subscriberId).single();
        if (data && !error) {
            setSettings(prev => ({ ...prev, ...data }));
            document.documentElement.style.setProperty('--brand-primary', data.theme_color);
        }
      } catch (err) { console.error("Using defaults"); }
      finally { setLoading(false); }
    };
    fetchSettings();
  }, [user?.subscriberId]);

  if (user?.role !== 'CEO' && user?.role !== 'owner' && user?.role !== 'PROADMIN') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center p-20 text-center animate-fade-in">
        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-lg border-4 border-white"><ShieldAlert size={48} /></div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Access Restricted</h2>
        <p className="text-slate-500 mt-3 max-w-md font-medium">Only Administrators have clearance to modify global system variables.</p>
      </div>
    );
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2000000) return alert("Logo must be smaller than 2MB");

      const reader = new FileReader();
      reader.onloadend = () => { setSettings(prev => ({ ...prev, company_logo: reader.result as string })); };
      reader.readAsDataURL(file);
  };

  const handleToggle = (field: keyof SystemSettings) => { setSettings(prev => ({ ...prev, [field]: !prev[field] as any })); };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.subscriberId) return;
    
    setIsSaving(true);
    const payload = { ...settings, subscriber_id: user.subscriberId, updated_at: new Date().toISOString() };

    try {
        localStorage.setItem('pronomad_system_config', JSON.stringify(payload));
        document.documentElement.style.setProperty('--brand-primary', settings.theme_color);

        if (!navigator.onLine) throw new Error("Offline");
        const { error } = await supabase.from('system_settings').upsert(payload);
        if (error) throw error;
        
        setSuccessMsg('Global system settings updated successfully.');
        setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error) {
        setPendingSyncs(prev => [...prev, { id: Date.now(), table: 'system_settings', action: 'UPSERT', payload }]);
        setSuccessMsg('Saved Offline. Will sync to the cloud when connected.');
        setTimeout(() => setSuccessMsg(''), 4000);
    } finally { setIsSaving(false); }
  };

  if (loading) return <div className="p-20 text-center text-slate-400 font-bold animate-pulse flex flex-col items-center"><RefreshCw className="animate-spin mb-4" size={32} style={{ color: APP_COLOR }}/> Loading Settings Profile...</div>;

  return (
    <div className="animate-fade-in pb-20 max-w-5xl mx-auto">
      
      {/* HEADER */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg"><SettingsIcon size={28} /></div>
          <div>
            <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Core</h1>
                {pendingSyncs.length > 0 ? (
                     <div className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer" onClick={processSyncQueue}>
                        {isSyncing ? <RefreshCw size={12} className="animate-spin"/> : <CloudOff size={12}/>} Pending Sync
                     </div>
                ) : ( <div className="flex items-center gap-1 text-slate-300" title="Cloud Synced"><CloudUpload size={18}/></div> )}
            </div>
            <p className="text-slate-500 font-medium mt-1">Configure global variables, branding, and master tax rules.</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl mb-8 font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 shadow-sm">
          <CheckCircle size={20}/> {successMsg}
        </div>
      )}

      {/* TOP NAVIGATION TABS */}
      <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto w-full md:w-max shadow-inner hide-scrollbar">
          <button type="button" onClick={() => setActiveTab('identity')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'identity' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Building size={16}/> Identity</button>
          <button type="button" onClick={() => setActiveTab('financial')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'financial' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><CreditCard size={16}/> Financial</button>
          <button type="button" onClick={() => setActiveTab('operations')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'operations' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Briefcase size={16}/> Operations</button>
          <button type="button" onClick={() => setActiveTab('branding')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'branding' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Palette size={16}/> Localization</button>
          <button type="button" onClick={() => setActiveTab('security')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'security' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Shield size={16}/> Security</button>
      </div>

      <form onSubmit={handleSaveSettings} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 md:p-12">
            
            {/* TAB 1: IDENTITY & DOCUMENTS */}
            {activeTab === 'identity' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="flex flex-col md:flex-row gap-8 items-center bg-slate-50 p-6 rounded-3xl border border-slate-200">
                    <div className="w-32 h-32 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0 relative group">
                        {settings.company_logo ? ( <img src={settings.company_logo} alt="Company Logo" className="w-full h-full object-contain p-2" /> ) : ( <ImageIcon size={40} className="text-slate-300" /> )}
                        <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm"><Upload size={24}/></div>
                    </div>
                    <div>
                        <h4 className="font-black text-lg text-slate-800">Company Logo</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed max-w-sm">This logo will automatically appear on all generated Client Passports, Layaway Contracts, and PDF Invoices.</p>
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoUpload}/>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-200 hover:border-slate-400 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm">Choose Image (Max 2MB)</button>
                        {settings.company_logo && <button type="button" onClick={() => setSettings({...settings, company_logo: ''})} className="ml-3 text-red-500 text-xs font-bold hover:underline">Remove</button>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Briefcase size={12}/> Registered Company Name</label><input type="text" value={settings.company_name} onChange={(e) => setSettings({...settings, company_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-800 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. Acme Tours Ltd."/></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Hash size={12}/> Business Reg. Number</label><input type="text" value={settings.registration_number} onChange={(e) => setSettings({...settings, registration_number: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-800 font-mono transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. CS123456789"/></div>
                  <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin size={12}/> Official HQ Address (Appears on Invoices)</label><input type="text" value={settings.address} onChange={(e) => setSettings({...settings, address: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-medium text-slate-800 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. 123 Independence Ave, Accra"/></div>
                  <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Globe size={12}/> Public Support Email</label><input type="email" value={settings.support_email} onChange={(e) => setSettings({...settings, support_email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-medium text-slate-800 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="support@company.com"/></div>
                </div>
              </div>
            )}

            {/* TAB 2: FINANCIAL RULES & INVOICING */}
            {activeTab === 'financial' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl">
                    <h4 className="font-black text-slate-800 mb-6 border-b border-slate-200 pb-2">Global Tax & Currency</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600">Base Platform Currency</label><select value={settings.currency} onChange={(e) => setSettings({...settings, currency: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-black text-slate-800 cursor-pointer shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>{CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} - {c.name}</option>))}</select></div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600">Global Tax Rate (VAT / GST %)</label>
                            <div className="relative"><input type="number" value={settings.tax_rate} onChange={(e) => setSettings({...settings, tax_rate: Number(e.target.value)})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-black text-slate-800 pr-10 shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="0.0"/><span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span></div>
                        </div>
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Company Tax ID / TIN</label><input type="text" value={settings.tax_id} onChange={(e) => setSettings({...settings, tax_id: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-800 font-mono shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. V0012345678"/></div>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl">
                    <h4 className="font-black text-slate-800 mb-6 border-b border-slate-200 pb-2 flex items-center gap-2"><FileText size={18}/> Invoicing Preferences</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600">Invoice Number Prefix</label>
                            <input type="text" value={settings.invoice_prefix} onChange={(e) => setSettings({...settings, invoice_prefix: e.target.value.toUpperCase()})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-black text-slate-800 font-mono shadow-sm transition-all uppercase" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. INV"/>
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">New invoices will look like: <strong>{settings.invoice_prefix}-00142</strong></p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600">Default Receipt Footer Note</label>
                            <textarea value={settings.receipt_footer_note} onChange={(e) => setSettings({...settings, receipt_footer_note: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-medium text-slate-800 shadow-sm transition-all resize-none" rows={3} style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="Thank you for your business!"></textarea>
                        </div>
                    </div>
                </div>
              </div>
            )}

            {/* TAB 3: OPERATIONS & AUTOMATION */}
            {activeTab === 'operations' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                    <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2"><Briefcase size={18} style={{ color: APP_COLOR }}/> Booking & Automations</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Percent size={12}/> Default SmartSave Deposit Required</label>
                            <div className="relative"><input type="number" value={settings.default_deposit_pct} onChange={(e) => setSettings({...settings, default_deposit_pct: Number(e.target.value)})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-black text-slate-800 pr-10 shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/><span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span></div>
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">When clients choose partial payment, this % determines their minimum upfront deposit.</p>
                        </div>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Bell size={16} className="text-blue-500"/> Auto-Send Receipts</p><p className="text-[10px] text-slate-500 font-medium">Email receipts instantly upon payment confirmation.</p></div><button type="button" onClick={() => handleToggle('auto_send_receipts')} className={`w-12 h-6 rounded-full transition-colors relative ${settings.auto_send_receipts ? 'bg-teal-500' : 'bg-slate-300'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.auto_send_receipts ? 'translate-x-6' : ''}`}></div></button></div>
                            <div className="flex items-center justify-between border-t border-slate-200 pt-4"><div><p className="text-sm font-bold text-slate-800 flex items-center gap-2"><ToggleRight size={16} className="text-orange-500"/> SMS Notifications</p><p className="text-[10px] text-slate-500 font-medium">Enable Twilio/Hubtel API for text message updates.</p></div><button type="button" onClick={() => handleToggle('sms_notifications')} className={`w-12 h-6 rounded-full transition-colors relative ${settings.sms_notifications ? 'bg-teal-500' : 'bg-slate-300'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.sms_notifications ? 'translate-x-6' : ''}`}></div></button></div>
                            <div className="flex items-center justify-between border-t border-slate-200 pt-4"><div><p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Sparkles size={16} className="text-purple-500"/> SmartYield AI</p><p className="text-[10px] text-slate-500 font-medium">Allow AI to autonomously suggest ticket pricing surges.</p></div><button type="button" onClick={() => handleToggle('enable_smartyield_ai')} className={`w-12 h-6 rounded-full transition-colors relative ${settings.enable_smartyield_ai ? 'bg-teal-500' : 'bg-slate-300'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.enable_smartyield_ai ? 'translate-x-6' : ''}`}></div></button></div>
                        </div>
                    </div>
                </div>
              </div>
            )}

            {/* TAB 4: BRANDING & LOCALIZATION */}
            {activeTab === 'branding' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block flex items-center gap-2"><Palette size={14}/> Core Theme Color</label>
                        <div className="flex items-center gap-4">
                            <div className="relative w-16 h-16 rounded-2xl shadow-inner overflow-hidden border-4 border-white shrink-0" style={{ backgroundColor: settings.theme_color }}>
                                <input type="color" value={settings.theme_color} onChange={(e) => setSettings({...settings, theme_color: e.target.value})} className="absolute -inset-10 w-40 h-40 opacity-0 cursor-pointer"/>
                            </div>
                            <div>
                                <input type="text" value={settings.theme_color} onChange={(e) => setSettings({...settings, theme_color: e.target.value})} className="w-28 bg-white border border-slate-200 p-2 rounded-lg outline-none font-mono font-bold text-slate-700 text-sm uppercase"/>
                                <p className="text-[10px] text-slate-500 mt-2 font-medium">Click the square to pick a color.<br/>Affects buttons and accents.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block flex items-center gap-2"><Hash size={14}/> Staff ID Prefix Rule</label>
                        <div className="flex gap-3 items-center">
                            <input type="text" value={settings.system_prefix} onChange={(e) => setSettings({...settings, system_prefix: e.target.value.toUpperCase()})} className="w-24 bg-white border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 font-mono font-black text-slate-800 uppercase text-center shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} maxLength={4}/>
                            <span className="text-xs font-bold text-slate-400">e.g., AT26-CEO-001</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-4 font-medium leading-relaxed">This determines how employee logins are generated in the Enterprise HR module.</p>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl">
                    <h4 className="font-black text-slate-800 mb-6 border-b border-slate-200 pb-2 flex items-center gap-2"><Globe size={18}/> Localization & Formats</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">System Date Format</label>
                            <select value={settings.date_format} onChange={(e) => setSettings({...settings, date_format: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-700 cursor-pointer transition-all shadow-sm" style={{ '--tw-ring-color': APP_COLOR } as any}>
                                <option value="MM/DD/YYYY">MM/DD/YYYY (US Format)</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY (UK/Global Format)</option>
                                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Database Format)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Time Format</label>
                            <select value={settings.time_format} onChange={(e) => setSettings({...settings, time_format: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-700 cursor-pointer transition-all shadow-sm" style={{ '--tw-ring-color': APP_COLOR } as any}>
                                <option value="12h">12-Hour (02:30 PM)</option>
                                <option value="24h">24-Hour (14:30)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fleet Distance Unit</label>
                            <select value={settings.distance_unit} onChange={(e) => setSettings({...settings, distance_unit: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-700 cursor-pointer transition-all shadow-sm" style={{ '--tw-ring-color': APP_COLOR } as any}>
                                <option value="km">Kilometers (km)</option>
                                <option value="mi">Miles (mi)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Primary Timezone</label>
                            <select value={settings.timezone} onChange={(e) => setSettings({...settings, timezone: e.target.value})} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-700 cursor-pointer transition-all shadow-sm" style={{ '--tw-ring-color': APP_COLOR } as any}>
                                {TIMEZONES.map(tz => (
                                    <option key={tz.code} value={tz.code}>{tz.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
              </div>
            )}

            {/* TAB 5: SECURITY & COMPLIANCE */}
            {activeTab === 'security' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
                    <h4 className="font-black text-red-800 mb-6 flex items-center gap-2"><Shield size={18}/> Access & Security Compliance</h4>
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-white p-5 rounded-2xl border border-red-100 flex items-center justify-between"><div><p className="text-sm font-bold text-slate-800">Require Two-Factor Auth (MFA)</p><p className="text-[10px] text-slate-500 font-medium mt-1">Force all staff to use an Authenticator app when logging in.</p></div><button type="button" onClick={() => handleToggle('require_staff_mfa')} className={`w-12 h-6 rounded-full transition-colors relative ${settings.require_staff_mfa ? 'bg-red-500' : 'bg-slate-300'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.require_staff_mfa ? 'translate-x-6' : ''}`}></div></button></div>
                        <div className="bg-white p-5 rounded-2xl border border-red-100 flex items-center justify-between"><div><p className="text-sm font-bold text-slate-800">Restrict System to HQ Network (IP Whitelist)</p><p className="text-[10px] text-slate-500 font-medium mt-1">If enabled, staff cannot log in from home or unapproved Wi-Fi networks.</p></div><button type="button" onClick={() => handleToggle('restrict_ip_access')} className={`w-12 h-6 rounded-full transition-colors relative ${settings.restrict_ip_access ? 'bg-red-500' : 'bg-slate-300'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.restrict_ip_access ? 'translate-x-6' : ''}`}></div></button></div>
                        <div><label className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Clock size={12}/> Auto-Logout Session Timeout (Minutes)</label><input type="number" min="15" max="1440" value={settings.session_timeout_mins} onChange={(e) => setSettings({...settings, session_timeout_mins: Number(e.target.value)})} className="w-full md:w-1/3 bg-white border border-red-200 p-4 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-slate-800 shadow-sm transition-all"/><p className="text-[10px] text-slate-500 mt-2 font-medium">Log out inactive users automatically. Minimum 15 mins.</p></div>
                    </div>
                </div>
              </div>
            )}
        </div>

        {/* FOOTER ACTION */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end rounded-b-[2.5rem]">
            <button type="submit" disabled={isSaving} className="w-full md:w-auto text-white px-10 py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-70 active:scale-95" style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}>
                {isSaving ? <RefreshCw size={18} className="animate-spin"/> : <Save size={18}/>}
                {isSaving ? 'Synchronizing Cloud...' : 'Commit System Changes'}
            </button>
        </div>

      </form>
    </div>
  );
};

export default Settings;