import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  UserCircle, Key, Shield, Save, CheckCircle, 
  Phone, AtSign, Calendar, Briefcase, BadgeCheck, 
  Activity, AlertCircle, Mail, MapPin, Bell, 
  Smartphone, Laptop, Clock, ShieldAlert, ToggleRight, ToggleLeft, Edit3, X
} from 'lucide-react';

// --- TYPES ---
interface PasswordsState {
  current: string;
  new: string;
  confirm: string;
}

interface UserProfile {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
  created_at: string;
  email_notifs: boolean;
  push_notifs: boolean;
  two_factor_enabled: boolean;
  table_name: 'subscribers' | 'staff';
}

interface AuditLog {
  id: number;
  action: string;
  device_info: string;
  location: string;
  created_at: string;
}

const Profile: React.FC = () => {
  const { user, activeBranchId } = useAuth() as any;
  
  // --- STATES ---
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  
  const [passwords, setPasswords] = useState<PasswordsState>({ current: '', new: '', confirm: '' });
  const [isSubmittingPassword, setIsSubmittingPassword] = useState<boolean>(false);
  
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // --- EDIT PROFILE STATES ---
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '' });

  // Sync edit form when profile data loads
  useEffect(() => {
    if (profileData) {
      setEditForm({
        full_name: profileData.full_name || '',
        email: profileData.email || '',
        phone: profileData.phone || ''
      });
    }
  }, [profileData]);

  // --- 1. SMART FETCH PROFILE & LOGS ---
  useEffect(() => {
    const fetchProfileData = async () => {
      const targetId = user?.uid || user?.subscriberId;
      if (!targetId) {
        setIsLoadingProfile(false);
        return;
      }
      
      setIsLoadingProfile(true);
      
      try {
        let finalProfile: UserProfile | null = null;

        const { data: subData } = await supabase.from('subscribers').select('*').eq('id', targetId).maybeSingle();

        if (subData) {
          finalProfile = {
            full_name: subData.fullName || subData.full_name || 'CEO',
            username: subData.username || 'N/A',
            email: subData.email || '',
            phone: subData.phone || '',
            role: subData.role || 'CEO',
            is_active: subData.status !== 'suspended',
            created_at: subData.created_at || subData.subscriptionExpiresAt || new Date().toISOString(),
            email_notifs: subData.email_notifs ?? true,
            push_notifs: subData.push_notifs ?? true,
            two_factor_enabled: subData.two_factor_enabled ?? false,
            table_name: 'subscribers'
          };
        } else {
          const { data: staffData } = await supabase.from('staff').select('*').eq('id', targetId).maybeSingle();

          if (staffData) {
            finalProfile = {
              full_name: staffData.name || staffData.full_name || 'Staff Member',
              username: staffData.eusername || 'N/A',
              email: staffData.email || '',
              phone: staffData.phone || '',
              role: staffData.role || 'Agent',
              is_active: staffData.status !== 'suspended',
              created_at: staffData.created_at || new Date().toISOString(),
              email_notifs: staffData.email_notifs ?? true,
              push_notifs: staffData.push_notifs ?? true,
              two_factor_enabled: staffData.two_factor_enabled ?? false,
              table_name: 'staff'
            };
          }
        }

        if (finalProfile) setProfileData(finalProfile);

        const { data: logs } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', targetId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (logs) setRecentActivity(logs);

      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfileData();
  }, [user]);

  // --- 2. HANDLE SAVE PROFILE DETAILS (Updated for Cloud!) ---
  const handleSaveProfile = async () => {
    if (!profileData) return;
    setIsSavingProfile(true);
    setErrorMsg(''); setSuccessMsg('');

    try {
      const targetId = user?.uid || user?.subscriberId;
      
      // 🌟 Reverted to match your actual database schema
      const updatePayload = profileData.table_name === 'subscribers' 
        ? { fullName: editForm.full_name, email: editForm.email, phone: editForm.phone }
        : { name: editForm.full_name, email: editForm.email, phone: editForm.phone };

      const { error } = await supabase
        .from(profileData.table_name)
        .update(updatePayload)
        .eq('id', targetId);

      // If there is an error, throw it so we can read it!
      if (error) throw error;

      // Update UI
      setProfileData({ ...profileData, ...editForm });
      setSuccessMsg("Profile details updated successfully!");
      setIsEditingProfile(false);

    } catch (err: any) {
      console.error("Database Update Error:", err);
      // Tells you EXACTLY which column is failing if it happens again!
      setErrorMsg(err.message || "Failed to save profile details. Check column names.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- 3. HANDLE LIVE PREFERENCE TOGGLES ---
  const handleTogglePreference = async (field: keyof UserProfile) => {
    if (!profileData) return;
    const targetId = user?.uid || user?.subscriberId;
    const currentValue = profileData[field] as boolean;
    const newValue = !currentValue;

    setProfileData({ ...profileData, [field]: newValue });

    const { error } = await supabase
      .from(profileData.table_name)
      .update({ [field]: newValue })
      .eq('id', targetId);

    if (error) {
      setProfileData({ ...profileData, [field]: currentValue });
      alert("Failed to save preference.");
    }
  };

  // --- 4. HANDLE PASSWORD UPDATE (Fully Supabase Cloud Now!) ---
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');

    if (passwords.new !== passwords.confirm) return setErrorMsg("New passwords do not match!");
    if (passwords.new.length < 6) return setErrorMsg("Password must be at least 6 characters.");
    
    setIsSubmittingPassword(true);

    try {
      const targetId = user?.uid || user?.subscriberId;
      
      // 1. Fetch current password from DB to verify
      const authCol = profileData!.table_name === 'subscribers' ? 'pin' : 'epin';
      
      const { data: verifyData, error: verifyError } = await supabase
        .from(profileData!.table_name)
        .select(authCol)
        .eq('id', targetId)
        .single();

      if (verifyError) throw new Error("Could not verify current user identity.");
      
      const actualCurrentPin = (verifyData as any)[authCol];
      
      if (actualCurrentPin !== passwords.current) {
         throw new Error("The current password you entered is incorrect.");
      }

      // 2. If it matches, update to the new password in Supabase directly
      const { error: updateError } = await supabase
        .from(profileData!.table_name)
        .update({ [authCol]: passwords.new })
        .eq('id', targetId);

      if (updateError) throw updateError;
      
      setSuccessMsg('Security credentials updated successfully in the cloud!');
      setPasswords({ current: '', new: '', confirm: '' });
      
    } catch (error: any) {
      setErrorMsg(error.message || "Network error updating password in cloud.");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="animate-fade-in pb-20 max-w-6xl mx-auto px-4 md:px-0">
      
      {/* HEADER PAGE TITLE */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Identity & Access</h1>
          <p className="text-slate-500 font-medium mt-1">Manage your personal information, security, and preferences.</p>
        </div>
        {profileData?.is_active && (
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-100 font-bold text-sm shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            System Access Authorized
          </div>
        )}
      </div>

      {/* SUCCESS/ERROR TOASTS */}
      {successMsg && (
        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl mb-6 font-bold flex items-center justify-between border border-emerald-100 animate-in fade-in shadow-sm">
          <div className="flex items-center gap-3"><CheckCircle size={20}/> {successMsg}</div>
          <button onClick={() => setSuccessMsg('')}><X size={18} className="text-emerald-500 hover:text-emerald-800"/></button>
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl mb-6 font-bold flex items-center justify-between border border-rose-100 animate-in fade-in shadow-sm">
          <div className="flex items-center gap-3"><AlertCircle size={20}/> {errorMsg}</div>
          <button onClick={() => setErrorMsg('')}><X size={18} className="text-rose-500 hover:text-rose-800"/></button>
        </div>
      )}

      {isLoadingProfile ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white/50 backdrop-blur-xl rounded-[2.5rem] border border-slate-100">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4 shadow-lg"></div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Decrypting Profile Data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ================= LEFT COLUMN: IDENTITY (Span 4) ================= */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* ID CARD */}
            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden relative transition-all duration-300">
              <div className="h-32 bg-gradient-to-br from-slate-800 via-teal-900 to-slate-900 relative">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
              </div>
              
              <div className="px-6 pb-8 flex flex-col items-center relative -mt-16">
                <div className="w-32 h-32 bg-white rounded-full p-2 shadow-xl mb-4 relative z-10 border border-slate-50">
                  <div className="w-full h-full bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white shadow-inner">
                    <UserCircle size={64} strokeWidth={1.5} />
                  </div>
                  <div className={`absolute bottom-2 right-2 w-6 h-6 border-4 border-white rounded-full ${profileData?.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                </div>
                
                {/* DYNAMIC NAME FIELD */}
                {isEditingProfile ? (
                  <input 
                    type="text" 
                    value={editForm.full_name} 
                    onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                    className="text-2xl font-black text-center text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2 py-1 mb-1 w-full outline-none focus:ring-2 focus:ring-teal-500/50"
                    placeholder="Your Full Name"
                  />
                ) : (
                  <h2 className="text-2xl font-black text-slate-800 text-center leading-tight mb-1">
                    {profileData?.full_name || 'Staff Member'}
                  </h2>
                )}
                
                <div className="flex items-center gap-1 text-teal-600 bg-teal-50 px-3 py-1 rounded-full mb-6 border border-teal-100 mt-1">
                  <BadgeCheck size={14} className="shrink-0" />
                  <span className="text-xs font-black uppercase tracking-widest">{profileData?.role || 'User'}</span>
                </div>
                
                <div className="w-full space-y-2">
                  <div className="flex flex-col p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><AtSign size={12}/> Username</span>
                    <span className="font-mono font-black text-slate-700">{profileData?.username}</span>
                  </div>
                  <div className="flex flex-col p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><MapPin size={12}/> Assigned Branch</span>
                    <span className="text-sm font-bold text-slate-700">{activeBranchId ? `Branch ID: ${activeBranchId.substring(0,8)}...` : 'Headquarters (HQ)'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* NOTIFICATION PREFERENCES */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100">
              <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                <Bell size={18} className="text-amber-500"/> Notifications
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between cursor-pointer group" onClick={() => handleTogglePreference('email_notifs')}>
                  <div>
                    <p className="text-sm font-bold text-slate-700 group-hover:text-teal-600 transition-colors">Email Alerts</p>
                    <p className="text-xs text-slate-400 font-medium">Daily summaries & billing</p>
                  </div>
                  {profileData?.email_notifs ? <ToggleRight size={32} className="text-teal-500 transition-all" /> : <ToggleLeft size={32} className="text-slate-300 transition-all" />}
                </div>
                <div className="flex items-center justify-between cursor-pointer group" onClick={() => handleTogglePreference('push_notifs')}>
                  <div>
                    <p className="text-sm font-bold text-slate-700 group-hover:text-teal-600 transition-colors">In-App Alerts</p>
                    <p className="text-xs text-slate-400 font-medium">Real-time trip updates</p>
                  </div>
                  {profileData?.push_notifs ? <ToggleRight size={32} className="text-teal-500 transition-all" /> : <ToggleLeft size={32} className="text-slate-300 transition-all" />}
                </div>
              </div>
            </div>

          </div>

          {/* ================= RIGHT COLUMN: SETTINGS (Span 8) ================= */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* CONTACT DETAILS (EDITABLE) */}
            <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border transition-colors duration-300 ${isEditingProfile ? 'border-teal-300 ring-4 ring-teal-50' : 'border-slate-100'}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Phone size={20} className="text-teal-500"/> Contact Details
                </h3>
                
                {/* EDIT BUTTONS */}
                {!isEditingProfile ? (
                  <button 
                    onClick={() => setIsEditingProfile(true)} 
                    className="flex items-center gap-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-full transition-colors border border-teal-100"
                  >
                    <Edit3 size={14}/> Edit Profile
                  </button>
                ) : (
                  <div className="flex items-center gap-2 animate-in fade-in">
                    <button 
                      onClick={() => { setIsEditingProfile(false); setEditForm({ full_name: profileData!.full_name, email: profileData!.email, phone: profileData!.phone }); }} 
                      className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveProfile} 
                      disabled={isSavingProfile}
                      className="flex items-center gap-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:bg-teal-300 px-4 py-2 rounded-full transition-colors shadow-md shadow-teal-600/20"
                    >
                      {isSavingProfile ? 'Saving...' : <><Save size={14}/> Save Changes</>}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Work Email</label>
                  <div className={`border p-4 rounded-2xl flex items-center gap-3 transition-colors ${isEditingProfile ? 'bg-white border-teal-200 shadow-inner' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                    <Mail size={18} className="text-slate-400 shrink-0" />
                    {isEditingProfile ? (
                      <input 
                        type="email" 
                        value={editForm.email} 
                        onChange={e => setEditForm({...editForm, email: e.target.value})}
                        className="w-full bg-transparent outline-none font-bold text-teal-800 placeholder-teal-300"
                        placeholder="email@example.com"
                      />
                    ) : (
                      <span className="font-bold text-slate-700 truncate">{profileData?.email || 'Not provided'}</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Phone Number</label>
                  <div className={`border p-4 rounded-2xl flex items-center gap-3 transition-colors ${isEditingProfile ? 'bg-white border-teal-200 shadow-inner' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                    <Phone size={18} className="text-slate-400 shrink-0" />
                    {isEditingProfile ? (
                      <input 
                        type="text" 
                        value={editForm.phone} 
                        onChange={e => setEditForm({...editForm, phone: e.target.value})}
                        className="w-full bg-transparent outline-none font-bold text-teal-800 placeholder-teal-300"
                        placeholder="+233 55 123 4567"
                      />
                    ) : (
                      <span className="font-bold text-slate-700">{profileData?.phone || 'Not provided'}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECURITY & CREDENTIALS */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-100 pb-4 mb-6 gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-1">
                    <Shield size={20} className="text-rose-500"/> Security & Credentials
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Manage passwords and access protocols</p>
                </div>
                
                {/* 2FA Toggle */}
                <div 
                  className={`flex items-center gap-3 bg-slate-50 border p-2 pl-4 rounded-full cursor-pointer transition-colors ${profileData?.two_factor_enabled ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 hover:bg-slate-100'}`}
                  onClick={() => handleTogglePreference('two_factor_enabled')}
                >
                  <ShieldAlert size={16} className={profileData?.two_factor_enabled ? "text-emerald-500" : "text-slate-400"}/>
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Two-Factor (2FA)</span>
                  {profileData?.two_factor_enabled ? <ToggleRight size={28} className="text-emerald-500" /> : <ToggleLeft size={28} className="text-slate-300" />}
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-5 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Current Password</label>
                  <div className="relative">
                    <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="password" required
                      value={passwords.current}
                      onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                      placeholder="Enter current password..."
                      className="w-full bg-white border border-slate-200 pl-11 pr-4 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-bold text-slate-800 shadow-sm"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">New Password</label>
                    <input 
                      type="password" required minLength={6}
                      value={passwords.new}
                      onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                      placeholder="Min. 6 characters"
                      className="w-full bg-white border border-slate-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-bold text-slate-800 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Confirm New Password</label>
                    <input 
                      type="password" required minLength={6}
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                      placeholder="Repeat new password"
                      className="w-full bg-white border border-slate-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent font-bold text-slate-800 shadow-sm"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button 
                    type="submit" disabled={isSubmittingPassword}
                    className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-70 w-full md:w-auto"
                  >
                    <Save size={18}/> {isSubmittingPassword ? 'Encrypting...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

            {/* ACTIVE SESSIONS & AUDIT LOG */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                   <Activity size={20} className="text-indigo-500"/> Account Activity
                 </h3>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last 3 Actions</span>
              </div>
              
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                     <p className="text-sm font-bold text-slate-400">No recent activity found.</p>
                  </div>
                ) : (
                  recentActivity.map((log, index) => (
                    <div key={log.id} className={`flex items-center justify-between p-4 rounded-2xl border ${index === 0 ? 'bg-indigo-50/50 border-indigo-100' : 'hover:bg-slate-50 border-transparent hover:border-slate-100 transition-colors'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl shadow-sm ${index === 0 ? 'bg-white text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                          {log.device_info.toLowerCase().includes('mobile') || log.device_info.toLowerCase().includes('ios') ? <Smartphone size={20}/> : <Laptop size={20}/>}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${index === 0 ? 'text-slate-800' : 'text-slate-700'}`}>{log.action}</p>
                          <p className="text-xs text-slate-500 font-medium">{log.device_info} • {log.location}</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        {index === 0 && <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm mb-1">Latest</span>}
                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock size={12}/> 
                          {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;