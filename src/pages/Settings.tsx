import React, { useState, useEffect, useRef } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { 
  Settings as SettingsIcon, Building, ShieldAlert, 
  CreditCard, Save, CheckCircle, Palette, Upload, Image as ImageIcon,
  Briefcase, Hash, MapPin, Globe, ToggleRight, Bell, Shield, 
  Percent, Clock, Sparkles, FileText, Phone, RefreshCw, Zap
} from 'lucide-react';

const COUNTRIES = [
  { code: 'GH', name: 'Ghana', currency: 'GHS' }, { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' }, { code: 'NG', name: 'Nigeria', currency: 'NGN' },
  { code: 'KE', name: 'Kenya', currency: 'KES' }, { code: 'ZA', name: 'South Africa', currency: 'ZAR' }
];

const CURRENCIES = [
  { code: 'GHS', name: 'Ghanaian Cedi' }, { code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' }, { code: 'NGN', name: 'Nigerian Naira' }
];

const TIMEZONES = [
  { code: 'Africa/Accra', name: 'GMT (Accra / London)' }, { code: 'Africa/Lagos', name: 'WAT (Lagos)' },
  { code: 'Europe/London', name: 'GMT (London)' }, { code: 'America/New_York', name: 'EST (New York)' }
];

// GHANA BANKS FOR PAYSTACK
const GHANA_BANKS = [
  { name: 'MTN Mobile Money', code: 'MTN' },
  { name: 'Vodafone Cash', code: 'VOD' },
  { name: 'AirtelTigo Cash', code: 'ATL' },
  { name: 'Ecobank Ghana', code: '050123' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '030267' },
  { name: 'Stanbic Bank', code: '030240' }
];

const Settings: React.FC = () => {
  const { user, settings: globalSettings, applySettings } = useTenant(); 
  const APP_COLOR = globalSettings?.theme_color || '#10b981';

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'identity' | 'financial' | 'operations' | 'branding' | 'security'>('identity');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState<any>({});
  
  // 🌟 SUBACCOUNT CREATION STATE
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isCreatingSubaccount, setIsCreatingSubaccount] = useState(false);

  useEffect(() => {
    if (globalSettings) {
        setFormData(globalSettings);
    }
  }, [globalSettings]);

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
      reader.onloadend = () => { setFormData((prev:any) => ({ ...prev, company_logo: reader.result as string })); };
      reader.readAsDataURL(file);
  };

  const handleToggle = (field: string) => { setFormData((prev:any) => ({ ...prev, [field]: !prev[field] })); };

  // 🌟 DIRECT REACT PAYSTACK INTEGRATION (FOR QUICK TESTING)
  const handleGenerateSubaccount = async () => {
      if (!bankCode || !accountNumber) return alert("Please select a Bank and enter an Account/Momo Number.");
      if (!formData.company_name) return alert("Please set your Company Name in the Identity tab first.");
      
      setIsCreatingSubaccount(true);

      try {
          // REMINDER: Move this to an edge function for production!
          const PAYSTACK_SECRET_KEY = "sk_test_removed_for_security";

          const response = await fetch('https://api.paystack.co/subaccount', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  business_name: formData.company_name,
                  settlement_bank: bankCode,
                  account_number: accountNumber,
                  percentage_charge: 5 // Platform Fee Default
              })
          });

          const data = await response.json();

          if (!response.ok || !data.status) {
              throw new Error(data.message || "Failed to create subaccount on Paystack.");
          }

          // SUCCESS! Save the ACCT_ code to our form data
          const newSubaccountCode = data.data.subaccount_code;
          setFormData((prev:any) => ({ ...prev, merchant_number: newSubaccountCode }));
          
          alert(`✅ Subaccount Created Successfully!\nYour ID is: ${newSubaccountCode}\n\nClick "Commit System Changes" at the bottom to save this to your database.`);
          
      } catch (err: any) {
          alert(`Error creating Subaccount: ${err.message}`);
      } finally {
          setIsCreatingSubaccount(false);
      }
  };

  // 🌟 THE STRICT DATABASE SAVE
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.subscriberId) return;
    setIsSaving(true);
    
    // Strip out metadata
    const { id, created_at, updated_at, subscriber_id, ...cleanData } = formData;
    
    const payload = { 
        ...cleanData, 
        subscriber_id: user.subscriberId,
        updated_at: new Date().toISOString() 
    };

    try {
        const { data, error } = await supabase.from('system_settings').update(payload).eq('subscriber_id', user.subscriberId).select();

        if (!error && (!data || data.length === 0)) {
            const { error: insertError } = await supabase.from('system_settings').insert([payload]);
            if (insertError) throw insertError;
        } else if (error) {
            throw error;
        }

        applySettings(payload);
        
        setSuccessMsg('Successfully Saved to Cloud Database!');
        setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
        alert(`Error Saving to Cloud: ${error.message}`);
    } finally { 
        setIsSaving(false); 
    }
  };

  return (
    <div className="animate-fade-in pb-20 max-w-5xl mx-auto">
      
      {/* HEADER */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg"><SettingsIcon size={28} /></div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Core</h1>
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
                        {formData.company_logo ? ( <img src={formData.company_logo} alt="Company Logo" className="w-full h-full object-contain p-2" /> ) : ( <ImageIcon size={40} className="text-slate-300" /> )}
                        <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm"><Upload size={24}/></div>
                    </div>
                    <div>
                        <h4 className="font-black text-lg text-slate-800">Company Logo</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed max-w-sm">This logo will automatically appear on all generated Client Passports, Layaway Contracts, and PDF Invoices.</p>
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoUpload}/>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-200 hover:border-slate-400 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm">Choose Image (Max 2MB)</button>
                        {formData.company_logo && <button type="button" onClick={() => setFormData((prev:any) => ({...prev, company_logo: ''}))} className="ml-3 text-red-500 text-xs font-bold hover:underline">Remove</button>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Briefcase size={12}/> Registered Company Name</label><input type="text" value={formData.company_name || ''} onChange={(e) => setFormData((prev:any) => ({...prev, company_name: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-800 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. Acme Tours Ltd."/></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Hash size={12}/> Business Reg. Number</label><input type="text" value={formData.registration_number || ''} onChange={(e) => setFormData((prev:any) => ({...prev, registration_number: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-800 font-mono transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. CS123456789"/></div>
                  <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin size={12}/> Official HQ Address (Appears on Invoices)</label><input type="text" value={formData.address || ''} onChange={(e) => setFormData((prev:any) => ({...prev, address: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-medium text-slate-800 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. 123 Independence Ave, Accra"/></div>
                  <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Globe size={12}/> Public Support Email</label><input type="email" value={formData.support_email || ''} onChange={(e) => setFormData((prev:any) => ({...prev, support_email: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-medium text-slate-800 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="support@company.com"/></div>
                </div>

                {/* 🌟 NEW HELPLINE SETTINGS */}
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl mt-8">
                    <h4 className="font-black text-slate-800 mb-6 border-b border-slate-200 pb-2 flex items-center gap-2">
                        <Phone size={18} style={{ color: APP_COLOR }}/> Dispatch & Support Numbers
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Customer Support Helpline</label>
                            <input 
                                type="tel" 
                                value={formData.customer_helpline || ''} 
                                onChange={(e) => setFormData((prev:any) => ({...prev, customer_helpline: e.target.value}))} 
                                placeholder="+233 24 000 0000" 
                                className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-700 shadow-sm transition-all"
                                style={{ '--tw-ring-color': APP_COLOR } as any}
                            />
                            <p className="text-[10px] text-slate-500 font-medium mt-2">Shown on the Client's Digital Passport.</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">HQ Operations Number</label>
                            <input 
                                type="tel" 
                                value={formData.operations_helpline || ''} 
                                onChange={(e) => setFormData((prev:any) => ({...prev, operations_helpline: e.target.value}))} 
                                placeholder="+233 20 000 0000" 
                                className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-700 shadow-sm transition-all"
                                style={{ '--tw-ring-color': APP_COLOR } as any}
                            />
                            <p className="text-[10px] text-slate-500 font-medium mt-2">Called when drivers click "Call Base".</p>
                        </div>
                    </div>
                </div>

              </div>
            )}

            {/* TAB 2: FINANCIAL RULES & AUTOMATED PAYOUTS */}
            {activeTab === 'financial' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                
                {/* GLOBAL TAX */}
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl">
                    <h4 className="font-black text-slate-800 mb-6 border-b border-slate-200 pb-2">Global Tax & Currency</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600">Country of Operation</label>
                            <select 
                                value={formData.country || ''} 
                                onChange={(e) => {
                                    const newCountry = e.target.value;
                                    const mappedCurrency = COUNTRIES.find(c => c.code === newCountry)?.currency || formData.currency;
                                    setFormData((prev:any) => ({...prev, country: newCountry, currency: mappedCurrency}));
                                }} 
                                className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-black text-slate-800 cursor-pointer shadow-sm transition-all" 
                                style={{ '--tw-ring-color': APP_COLOR } as any}
                            >
                                <option value="">Select Country...</option>
                                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600">Base Platform Currency</label>
                            <select value={formData.currency || ''} onChange={(e) => setFormData((prev:any) => ({...prev, currency: e.target.value}))} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-black text-slate-800 cursor-pointer shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                                {CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.code} - {c.name}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600">Global Tax Rate (VAT / GST %)</label>
                            <div className="relative"><input type="number" value={formData.tax_rate || 0} onChange={(e) => setFormData((prev:any) => ({...prev, tax_rate: Number(e.target.value)}))} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-black text-slate-800 pr-10 shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="0.0"/><span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span></div>
                        </div>
                        <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Company Tax ID / TIN</label><input type="text" value={formData.tax_id || ''} onChange={(e) => setFormData((prev:any) => ({...prev, tax_id: e.target.value}))} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-800 font-mono shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. V0012345678"/></div>
                    </div>
                </div>

                {/* 🌟 AUTOMATED PAYOUTS (SUBACCOUNT ENGINE) */}
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl mt-8">
                    <div className="flex justify-between items-start mb-6 border-b border-slate-200 pb-4">
                        <div>
                            <h4 className="font-black text-slate-800 flex items-center gap-2"><CreditCard size={18}/> Automated Payouts</h4>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Connect your bank to instantly receive online booking funds.</p>
                        </div>
                        {formData.merchant_number && formData.merchant_number.startsWith('ACCT_') ? (
                           <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle size={12}/> Connected</span>
                        ) : (
                           <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Not Connected</span>
                        )}
                    </div>

                    {formData.merchant_number && formData.merchant_number.startsWith('ACCT_') ? (
                       <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Paystack Subaccount</p>
                              <p className="text-xl font-black text-slate-800 font-mono mt-1">{formData.merchant_number}</p>
                           </div>
                           <button type="button" onClick={() => { if(window.confirm('Disconnect this bank account?')) setFormData((prev:any) => ({...prev, merchant_number: ''})) }} className="text-xs font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">Disconnect</button>
                       </div>
                    ) : (
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                  <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600">Bank / Mobile Money Provider</label>
                                  <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-800 shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                                      <option value="">Select your provider...</option>
                                      {GHANA_BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600 flex items-center gap-1"><Phone size={10}/> Account / Momo Number</label>
                                  <input 
                                      type="text" 
                                      value={accountNumber}
                                      onChange={(e) => setAccountNumber(e.target.value)}
                                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-black text-slate-800 font-mono shadow-sm transition-all" 
                                      style={{ '--tw-ring-color': APP_COLOR } as any} 
                                      placeholder="e.g. 024XXXXXXX"
                                  />
                              </div>
                          </div>
                          
                          <button 
                             type="button"
                             onClick={handleGenerateSubaccount}
                             disabled={isCreatingSubaccount || !bankCode || !accountNumber}
                             className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm flex justify-center items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
                          >
                             {isCreatingSubaccount ? <RefreshCw size={18} className="animate-spin"/> : <Zap size={18} className="text-amber-400"/>}
                             {isCreatingSubaccount ? 'Connecting to Paystack...' : 'Generate Payout Account'}
                          </button>
                          <p className="text-[10px] text-center text-slate-400 font-bold">This will automatically route 95% of online payments directly to your account.</p>
                      </div>
                    )}
                </div>

                <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl">
                    <h4 className="font-black text-slate-800 mb-6 border-b border-slate-200 pb-2 flex items-center gap-2"><FileText size={18}/> Invoicing Preferences</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600">Invoice Number Prefix</label>
                            <input type="text" value={formData.invoice_prefix || ''} onChange={(e) => setFormData((prev:any) => ({...prev, invoice_prefix: e.target.value.toUpperCase()}))} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-black text-slate-800 font-mono shadow-sm transition-all uppercase" style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="e.g. INV"/>
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">New invoices will look like: <strong>{formData.invoice_prefix || 'INV'}-00142</strong></p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block text-slate-600">Default Receipt Footer Note</label>
                            <textarea value={formData.receipt_footer_note || ''} onChange={(e) => setFormData((prev:any) => ({...prev, receipt_footer_note: e.target.value}))} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-medium text-slate-800 shadow-sm transition-all resize-none" rows={3} style={{ '--tw-ring-color': APP_COLOR } as any} placeholder="Thank you for your business!"></textarea>
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
                            <div className="relative"><input type="number" value={formData.default_deposit_pct || 20} onChange={(e) => setFormData((prev:any) => ({...prev, default_deposit_pct: Number(e.target.value)}))} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-black text-slate-800 pr-10 shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/><span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span></div>
                        </div>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Bell size={16} className="text-blue-500"/> Auto-Send Receipts</p></div><button type="button" onClick={() => handleToggle('auto_send_receipts')} className={`w-12 h-6 rounded-full transition-colors relative ${formData.auto_send_receipts ? 'bg-teal-500' : 'bg-slate-300'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.auto_send_receipts ? 'translate-x-6' : ''}`}></div></button></div>
                            <div className="flex items-center justify-between border-t border-slate-200 pt-4"><div><p className="text-sm font-bold text-slate-800 flex items-center gap-2"><ToggleRight size={16} className="text-orange-500"/> SMS Notifications</p></div><button type="button" onClick={() => handleToggle('sms_notifications')} className={`w-12 h-6 rounded-full transition-colors relative ${formData.sms_notifications ? 'bg-teal-500' : 'bg-slate-300'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.sms_notifications ? 'translate-x-6' : ''}`}></div></button></div>
                            <div className="flex items-center justify-between border-t border-slate-200 pt-4"><div><p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Sparkles size={16} className="text-purple-500"/> SmartYield AI</p></div><button type="button" onClick={() => handleToggle('enable_smartyield_ai')} className={`w-12 h-6 rounded-full transition-colors relative ${formData.enable_smartyield_ai ? 'bg-teal-500' : 'bg-slate-300'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.enable_smartyield_ai ? 'translate-x-6' : ''}`}></div></button></div>
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
                            <div className="relative w-16 h-16 rounded-2xl shadow-inner overflow-hidden border-4 border-white shrink-0" style={{ backgroundColor: formData.theme_color || '#10b981' }}>
                                <input type="color" value={formData.theme_color || '#10b981'} onChange={(e) => setFormData((prev:any) => ({...prev, theme_color: e.target.value}))} className="absolute -inset-10 w-40 h-40 opacity-0 cursor-pointer"/>
                            </div>
                            <div>
                                <input type="text" value={formData.theme_color || ''} onChange={(e) => setFormData((prev:any) => ({...prev, theme_color: e.target.value}))} className="w-28 bg-white border border-slate-200 p-2 rounded-lg outline-none font-mono font-bold text-slate-700 text-sm uppercase"/>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block flex items-center gap-2"><Hash size={14}/> Staff ID Prefix Rule</label>
                        <div className="flex gap-3 items-center">
                            <input type="text" value={formData.system_prefix || ''} onChange={(e) => setFormData((prev:any) => ({...prev, system_prefix: e.target.value.toUpperCase()}))} className="w-24 bg-white border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 font-mono font-black text-slate-800 uppercase text-center shadow-sm transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} maxLength={4}/>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl">
                    <h4 className="font-black text-slate-800 mb-6 border-b border-slate-200 pb-2 flex items-center gap-2"><Globe size={18}/> Localization & Formats</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">System Date Format</label>
                            <select value={formData.date_format || ''} onChange={(e) => setFormData((prev:any) => ({...prev, date_format: e.target.value}))} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-700 cursor-pointer transition-all shadow-sm" style={{ '--tw-ring-color': APP_COLOR } as any}>
                                <option value="MM/DD/YYYY">MM/DD/YYYY (US Format)</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY (UK/Global Format)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Primary Timezone</label>
                            <select value={formData.timezone || ''} onChange={(e) => setFormData((prev:any) => ({...prev, timezone: e.target.value}))} className="w-full bg-white border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-700 cursor-pointer transition-all shadow-sm" style={{ '--tw-ring-color': APP_COLOR } as any}>
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
                        <div className="bg-white p-5 rounded-2xl border border-red-100 flex items-center justify-between"><div><p className="text-sm font-bold text-slate-800">Require Two-Factor Auth (MFA)</p><p className="text-[10px] text-slate-500 font-medium mt-1">Force all staff to use an Authenticator app when logging in.</p></div><button type="button" onClick={() => handleToggle('require_staff_mfa')} className={`w-12 h-6 rounded-full transition-colors relative ${formData.require_staff_mfa ? 'bg-red-500' : 'bg-slate-300'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.require_staff_mfa ? 'translate-x-6' : ''}`}></div></button></div>
                        <div className="bg-white p-5 rounded-2xl border border-red-100 flex items-center justify-between"><div><p className="text-sm font-bold text-slate-800">Restrict System to HQ Network (IP Whitelist)</p><p className="text-[10px] text-slate-500 font-medium mt-1">If enabled, staff cannot log in from home or unapproved Wi-Fi networks.</p></div><button type="button" onClick={() => handleToggle('restrict_ip_access')} className={`w-12 h-6 rounded-full transition-colors relative ${formData.restrict_ip_access ? 'bg-red-500' : 'bg-slate-300'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.restrict_ip_access ? 'translate-x-6' : ''}`}></div></button></div>
                        <div><label className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Clock size={12}/> Auto-Logout Session Timeout (Minutes)</label><input type="number" min="15" max="1440" value={formData.session_timeout_mins || 60} onChange={(e) => setFormData((prev:any) => ({...prev, session_timeout_mins: Number(e.target.value)}))} className="w-full md:w-1/3 bg-white border border-red-200 p-4 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-slate-800 shadow-sm transition-all"/><p className="text-[10px] text-slate-500 mt-2 font-medium">Log out inactive users automatically. Minimum 15 mins.</p></div>
                    </div>
                </div>
              </div>
            )}
        </div>

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