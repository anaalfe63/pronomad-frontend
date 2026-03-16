import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { 
  Users, Shield, CheckCircle, ChevronRight, Key, Plus, X, UserCircle, 
  HeartPulse, MapPin, Search, Briefcase, Phone, Mail, MoreVertical, 
  FileCheck, Languages, UserCog, Edit3, PauseCircle, Trash2, Lock, 
  Zap, RefreshCw, Copy, Check, PlayCircle, AlertCircle, Save, Calendar, Wallet,
  CloudOff, CloudUpload
} from 'lucide-react';

// --- INTERFACES ---
interface Staff {
  id: string; 
  dbId: string | number; 
  name: string; role: string; status: string; availability: string;
  phone: string; email: string; gender: string; dob: string; nationality: string; address: string;
  jobTitle: string; department: string; employmentType: string; startDate: string;
  bankName: string; accountNumber: string; baseSalary: string;
  emergencyName: string; emergencyPhone: string; emergencyRelation: string;
  licenseType: string; licenseNumber: string; licenseExpiry: string; compliance: string;
}

interface NewStaffState {
  name: string; dob: string; gender: string; nationality: string; languages: string;
  email: string; phone: string; address: string; emergencyName: string; emergencyPhone: string; emergencyRelation: string;
  role: string; jobTitle: string; department: string; employmentType: string; startDate: string;
  bankName: string; accountNumber: string; baseSalary: string;
  licenseType: string; licenseNumber: string; licenseExpiry: string; password: string;
}

interface SyncAction {
  id: number;
  table: string;
  action: 'UPDATE' | 'INSERT' | 'DELETE';
  recordId?: string | number;
  payload?: any;
}

const safeJSON = (data: any) => {
    if (!data) return {};
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch (e) { return {}; }
    }
    return data;
};

const StaffManagement: React.FC = () => {
  const { user } = useTenant(); 
  const location = useLocation(); 
  
  const APP_COLOR = user?.themeColor || '#10b981'; 
  const BASE_CURRENCY = user?.currency || 'GHS';
  const companyPrefix = (user as any)?.prefix || 'PND';

  const [staffList, setStaffList] = useState<Staff[]>([]); 
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('All'); 
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [step, setStep] = useState<number>(1);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editModalTab, setEditModalTab] = useState<'personal' | 'employment' | 'payroll' | 'emergency'>('personal');
  const [securityStaff, setSecurityStaff] = useState<Staff | null>(null);
  
  const [newPassword, setNewPassword] = useState<string>('');
  const [newUsernameSuffix, setNewUsernameSuffix] = useState<string>('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState<boolean>(false);

  const [newStaff, setNewStaff] = useState<NewStaffState>({ 
    name: '', dob: '', gender: '', nationality: '', languages: '',
    email: '', phone: '', address: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '',
    role: 'Guide', jobTitle: 'Tour Guide', department: 'Field Operations', employmentType: 'Full-Time', startDate: new Date().toISOString().split('T')[0],
    bankName: '', accountNumber: '', baseSalary: '',
    licenseType: 'None', licenseNumber: '', licenseExpiry: '', password: '' 
  });
  
  const [customSuffix, setCustomSuffix] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState<SyncAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
     localStorage.removeItem('pronomad_staff_sync');
     setPendingSyncs([]);
  }, []);

  const processSyncQueue = useCallback(async () => {
      if (!navigator.onLine || pendingSyncs.length === 0 || isSyncing) return;
      setIsSyncing(true);
      const remaining = [...pendingSyncs];

      for (const task of pendingSyncs) {
          try {
              if (task.action === 'INSERT') {
                  const { error } = await supabase.from(task.table).insert([task.payload]);
                  if (error) throw error;
              } else if (task.action === 'UPDATE') {
                  const { error } = await supabase.from(task.table).update(task.payload).eq('id', task.recordId);
                  if (error) throw error;
              } else if (task.action === 'DELETE') {
                  const { error } = await supabase.from(task.table).delete().eq('id', task.recordId);
                  if (error) throw error;
              }
              remaining.shift();
          } catch (e) {
              console.error("Staff Sync failed:", task.id, e);
              break; 
          }
      }
      
      setPendingSyncs(remaining);
      setIsSyncing(false);
      if (remaining.length === 0) fetchStaff(); 
  }, [pendingSyncs, isSyncing]);

  useEffect(() => {
      const handleOnline = () => { setIsOnline(true); processSyncQueue(); };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      const syncInterval = setInterval(processSyncQueue, 30000);
      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
          clearInterval(syncInterval);
      };
  }, [processSyncQueue]);


  const fetchStaff = async () => {
    setLoading(true);
    try {
      if (!user?.subscriberId) return;

      const { data, error } = await supabase
          .from('staff')
          .select('*')
          .eq('subscriber_id', user.subscriberId)
          .order('created_at', { ascending: false });

      if (!error && data) {
        const formattedStaff: Staff[] = data.map((s: any) => {
          const ec = safeJSON(s.emergency_contact);
          const comp = safeJSON(s.compliance_data);
          const hr = safeJSON(s.hr_data);
          const pay = safeJSON(s.payroll_data);

          return {
            // 🌟 FIXED: Using the real `username` column
            id: s.username || `USER-${s.id}`, dbId: s.id, name: s.name, role: s.role, 
            status: s.status || 'Active', availability: s.status === 'Active' ? 'Available' : 'Offline', 
            phone: s.phone || '', email: s.email || '', gender: s.gender || '', nationality: s.nationality || '', address: s.address || '', dob: s.dob || '',
            emergencyName: ec.name || '', emergencyPhone: ec.phone || '', emergencyRelation: ec.relation || '',
            licenseType: comp.licenseType || 'None', licenseNumber: comp.licenseNumber || '', licenseExpiry: comp.licenseExpiry || '',
            compliance: comp.licenseExpiry ? `Exp: ${comp.licenseExpiry}` : 'N/A',
            jobTitle: hr.jobTitle || s.role, department: hr.department || '', employmentType: hr.employmentType || s.employment_type || 'Full-Time', startDate: hr.startDate || '',
            bankName: pay.bankName || '', accountNumber: pay.accountNumber || '', baseSalary: pay.baseSalary || ''
          };
        });
        setStaffList(formattedStaff);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.subscriberId) fetchStaff(); }, [user]);

  useEffect(() => {
    if (location.state?.searchQuery) { setSearchQuery(location.state.searchQuery); setActiveTab('All'); }
  }, [location]);

  const getRolePrefix = (role: string) => {
    switch(role) { 
      case 'Operations': return 'OPS'; 
      case 'Finance': return 'FIN'; 
      case 'CEO': return 'CEO'; 
      case 'Guide': return 'GDE';
      case 'Driver': return 'DVR';
      case 'PROADMIN': return 'ADM';
      default: return 'EMP'; 
    }
  };
  
  const lockedPrefix = `${companyPrefix}-${getRolePrefix(newStaff.role)}-`;
  const fullUsername = lockedPrefix + customSuffix.toUpperCase();

  const filteredStaff = staffList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'All') return matchesSearch;
    if (activeTab === 'Field Team') return matchesSearch && (s.role === 'Guide' || s.role === 'Driver');
    if (activeTab === 'Office') return matchesSearch && (s.role !== 'Guide' && s.role !== 'Driver');
    return matchesSearch;
  });

  const checkUsernameAvailability = async (usernameToCheck: string): Promise<boolean> => {
    setIsCheckingUsername(true);
    try {
        // 🌟 FIXED: Checking the real `username` column
        const { data, error } = await supabase.from('staff').select('username').eq('username', usernameToCheck);
        setIsCheckingUsername(false);
        if (error) throw error;
        return data.length === 0; 
    } catch (e: any) { 
        setIsCheckingUsername(false); 
        return false; 
    }
  };

  const handleCopy = (text: string, id: string) => {
      navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };

  const handleActionClick = async (e: React.MouseEvent, staff: Staff, action: string) => {
    e.stopPropagation(); setOpenMenuId(null);
    
    if (action === 'edit') {
        setEditingStaff(staff);
        setEditModalTab('personal');
    }
    if (action === 'security') {
        setSecurityStaff(staff); setNewPassword(''); setUsernameError(null);
        const parts = staff.id.split('-');
        setNewUsernameSuffix(parts.length >= 3 ? parts[parts.length - 1] : staff.id);
    }
    if (action === 'suspend' || action === 'activate') {
      const newStatus = action === 'suspend' ? 'Suspended' : 'Active';
      if (window.confirm(`Change ${staff.name}'s status to ${newStatus}?`)) {
          setStaffList(prev => prev.map(s => s.dbId === staff.dbId ? { ...s, status: newStatus } : s));
          try {
              await supabase.from('staff').update({ status: newStatus }).eq('id', staff.dbId);
          } catch(e) {}
      }
    }
    if (action === 'delete') {
      if (window.confirm(`⚠️ PERMANENTLY OFFBOARD ${staff.name}? This removes their access immediately.`)) {
          setStaffList(prev => prev.filter(s => s.dbId !== staff.dbId));
          try {
              await supabase.from('staff').delete().eq('id', staff.dbId);
          } catch(e) {}
      }
    }
  };

  const handleUpdateProfile = async () => {
      if (!editingStaff || !user?.subscriberId) return;
      
      const payload = {
        name: editingStaff.name,
        dob: editingStaff.dob ? editingStaff.dob : null,
        gender: editingStaff.gender,
        nationality: editingStaff.nationality,
        phone: editingStaff.phone,
        email: editingStaff.email,
        address: editingStaff.address,
        role: editingStaff.role,
        employment_type: editingStaff.employmentType,
        hr_data: { jobTitle: editingStaff.jobTitle, department: editingStaff.department, employmentType: editingStaff.employmentType, startDate: editingStaff.startDate },
        payroll_data: { bankName: editingStaff.bankName, accountNumber: editingStaff.accountNumber, baseSalary: editingStaff.baseSalary },
        emergency_contact: { name: editingStaff.emergencyName, phone: editingStaff.emergencyPhone, relation: editingStaff.emergencyRelation },
        compliance_data: { licenseType: editingStaff.licenseType, licenseNumber: editingStaff.licenseNumber, licenseExpiry: editingStaff.licenseExpiry }
      };

      setStaffList(prev => prev.map(s => s.dbId === editingStaff.dbId ? editingStaff : s));
      setEditingStaff(null); 

      try {
          const { error } = await supabase.from('staff').update(payload).eq('id', editingStaff.dbId);
          if (error) throw error;
      } catch(e: any) { 
          alert(`SUPABASE ERROR: ${e.message}\nDetails: ${e.details || 'None'}`);
      }
  };

  const handleSecurityUpdate = async () => {
      if (!securityStaff || !user?.subscriberId) return;
      
      const newUsername = `${companyPrefix}-${getRolePrefix(securityStaff.role)}-${newUsernameSuffix.toUpperCase()}`;
      
      if (newUsername !== securityStaff.id) {
          const isAvailable = await checkUsernameAvailability(newUsername);
          if (!isAvailable) { setUsernameError(`The username "${newUsername}" is already taken.`); return; }
      }
      
      // 🌟 FIXED: Using real `username` and `password`
      const payload: any = { username: newUsername };
      if (newPassword) payload.password = newPassword;

      setSecurityStaff(null);
      setStaffList(prev => prev.map(s => s.dbId === securityStaff.dbId ? { ...s, id: newUsername } : s));

      try {
          const { error } = await supabase.from('staff').update(payload).eq('id', securityStaff.dbId);
          if (error) throw error;
      } catch(e: any) { 
          alert(`SUPABASE ERROR: ${e.message}\nDetails: ${e.details || 'None'}`);
      }
  };

  const handleNextStep = async () => {
      if (step === 5) {
          const isAvailable = await checkUsernameAvailability(fullUsername);
          if (!isAvailable) { setUsernameError(`The username "${fullUsername}" is already taken.`); return; }
      }
      setStep(prev => prev + 1);
  };

  // --- PROVISION NEW STAFF ---
  const handleIssueCredentials = async () => {
    if (!user?.subscriberId) return;
    setIsSubmitting(true);
    
    // 🌟 FIXED: Using real `username` and `password`
    const payload = {
        subscriber_id: user.subscriberId,
        name: newStaff.name,
        username: fullUsername,
        password: newStaff.password,
        role: newStaff.role,
        status: 'Active',
        phone: newStaff.phone,
        email: newStaff.email,
        gender: newStaff.gender,
        nationality: newStaff.nationality,
        address: newStaff.address,
        dob: newStaff.dob ? newStaff.dob : null,
        salary: newStaff.baseSalary ? Number(newStaff.baseSalary) : 0,
        employment_type: newStaff.employmentType,
        emergency_contact: { name: newStaff.emergencyName, phone: newStaff.emergencyPhone, relation: newStaff.emergencyRelation },
        hr_data: { jobTitle: newStaff.jobTitle, department: newStaff.department, employmentType: newStaff.employmentType, startDate: newStaff.startDate },
        payroll_data: { bankName: newStaff.bankName, accountNumber: newStaff.accountNumber, baseSalary: newStaff.baseSalary },
        compliance_data: { licenseType: newStaff.licenseType, licenseNumber: newStaff.licenseNumber, licenseExpiry: newStaff.licenseExpiry }
    };

    try {
        const { error } = await supabase.from('staff').insert([payload]);
        if (error) throw error;
        
        // SUCCESS!
        setIsWizardOpen(false); 
        setStep(1); 
        setCustomSuffix('');
        setNewStaff({ name: '', dob: '', gender: '', nationality: '', languages: '', email: '', phone: '', address: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '', role: 'Guide', jobTitle: '', department: '', employmentType: 'Full-Time', startDate: '', bankName: '', accountNumber: '', baseSalary: '', licenseType: 'None', licenseNumber: '', licenseExpiry: '', password: '' });
        fetchStaff(); 

    } catch (error: any) { 
        alert(`🔴 DATABASE REJECTED SAVE:\n\nError: ${error.message}\nDetails: ${error.details || 'None'}`);
        console.error("Full Supabase Data Error:", error);
    } finally { 
        setIsSubmitting(false); 
    }
  };

  const roleColors: Record<string, string> = { 'CEO': 'bg-purple-100 text-purple-700', 'PROADMIN': 'bg-slate-900 text-white', 'Operations': 'bg-blue-100 text-blue-700', 'Finance': 'bg-emerald-100 text-emerald-700', 'Guide': 'bg-orange-100 text-orange-700', 'Driver': 'bg-yellow-100 text-yellow-700' };

  return (
    <div className="animate-fade-in pb-20 relative" onClick={() => setOpenMenuId(null)}>
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
        <div>
          <div className="flex items-center gap-4">
             <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Enterprise HR</h1>
             {pendingSyncs.length > 0 ? (
                  <div className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest cursor-pointer" onClick={processSyncQueue}>
                     {isSyncing ? <RefreshCw size={14} className="animate-spin"/> : <CloudOff size={14}/>}
                     {pendingSyncs.length} Pending
                  </div>
             ) : (
                  <div className="flex items-center gap-1 text-slate-300" title="Cloud Synced">
                     <CloudUpload size={20}/>
                  </div>
             )}
          </div>
          <p className="text-slate-500 font-medium mt-1">Manage personnel, payroll data, and access controls.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
          <div className="relative flex-1 md:w-64 group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" />
            <input type="text" placeholder="Search staff..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:ring-2 shadow-sm transition-all font-bold" style={{ '--tw-ring-color': APP_COLOR } as any} />
          </div>
          <div className="bg-slate-100 p-1 rounded-xl flex shrink-0">
            {['All', 'Field Team', 'Office'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} style={activeTab === tab ? { color: APP_COLOR } : {}}>{tab}</button>
            ))}
          </div>
          <button onClick={() => setIsWizardOpen(true)} className="text-white px-5 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all shrink-0 active:scale-95 hover:brightness-110" style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}>
            <Plus size={18}/> Onboard Employee
          </button>
        </div>
      </div>

      {/* ACTIVE STAFF TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-slate-400 text-[10px] uppercase tracking-widest">
                <th className="p-6 font-black">Employee Profile</th>
                <th className="p-6 font-black">Role & Department</th>
                <th className="p-6 font-black">Contact Details</th>
                <th className="p-6 font-black">IAM Credentials</th>
                <th className="p-6 font-black text-center">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && staffList.length === 0 ? (
                 <tr><td colSpan={5} className="p-16 text-center text-slate-400 font-bold"><RefreshCw size={32} className="animate-spin mx-auto mb-2" style={{ color: APP_COLOR }}/> Loading Cloud Database...</td></tr>
              ) : filteredStaff.length === 0 ? (
                <tr><td colSpan={5} className="p-16 text-center text-slate-400 font-bold"><Search size={32} className="opacity-20 mx-auto mb-2"/>No personnel found.</td></tr>
              ) : (
                filteredStaff.map((staff, idx) => (
                  <tr key={idx} className={`transition-colors group ${staff.status === 'Suspended' ? 'bg-red-50/30 grayscale-[50%]' : 'hover:bg-slate-50'}`}>
                    <td className="p-6 align-middle">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${staff.status === 'Suspended' ? 'bg-red-100 text-red-500' : 'text-white shadow-md'}`} style={staff.status !== 'Suspended' ? { backgroundColor: APP_COLOR } : {}}>
                          {staff.name.charAt(0)}
                        </div>
                        <div>
                          <p className={`font-black text-base leading-tight ${staff.status === 'Suspended' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{staff.name}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                             <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${staff.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{staff.status}</div>
                             {staff.employmentType && <div className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-slate-100 text-slate-500 uppercase tracking-widest">{staff.employmentType}</div>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 align-middle">
                      <div className="space-y-1.5">
                        <span className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5 w-max ${roleColors[staff.role] || 'bg-slate-100 text-slate-700'}`}>
                          <Shield size={12}/> {staff.role}
                        </span>
                        <p className="text-xs font-bold text-slate-600 pl-1">{staff.jobTitle}</p>
                        <p className="text-[10px] font-bold text-slate-400 pl-1">{staff.department}</p>
                      </div>
                    </td>
                    <td className="p-6 align-middle">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <Phone size={14} className="text-slate-400"/> {staff.phone || 'N/A'}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            <Mail size={14} className="text-slate-400"/> {staff.email || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="p-6 align-middle">
                      <div className="space-y-2">
                         <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm w-max">
                            <Key size={12} style={{ color: APP_COLOR }}/> {staff.id}
                            <button onClick={() => handleCopy(staff.id, `user-${staff.id}`)} className="text-slate-300 ml-2 hover:brightness-75 transition-all" style={{ color: copiedId === `user-${staff.id}` ? '#10b981' : APP_COLOR }}>{copiedId === `user-${staff.id}` ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}</button>
                         </div>
                         {staff.compliance !== 'N/A' && (
                            <span className={`px-2 py-1 border rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 w-max ${staff.compliance.includes('Expiring') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                              <FileCheck size={10}/> {staff.compliance}
                            </span>
                         )}
                      </div>
                    </td>
                    <td className="p-6 text-center align-middle relative">
                      <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === staff.id ? null : staff.id); }} className={`p-2 rounded-xl transition-all mx-auto block ${openMenuId === staff.id ? 'bg-slate-900 text-white shadow-md' : 'bg-white border shadow-sm text-slate-400 hover:text-slate-800'}`}>
                        <MoreVertical size={18}/>
                      </button>

                      {openMenuId === staff.id && (
                        <div className="absolute right-12 top-8 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                          <div className="p-2 space-y-1">
                            <div className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-2">Actions</div>
                            <button onClick={(e) => handleActionClick(e, staff, 'edit')} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2 transition-colors">
                              <Edit3 size={14} className="text-blue-600"/> Edit HR Profile
                            </button>
                            <button onClick={(e) => handleActionClick(e, staff, 'security')} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2 transition-colors">
                              <Lock size={14} className="text-orange-500"/> Security & Access
                            </button>
                            {staff.status === 'Active' ? (
                                <button onClick={(e) => handleActionClick(e, staff, 'suspend')} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2 transition-colors">
                                  <PauseCircle size={14} className="text-purple-600"/> Suspend Access
                                </button>
                            ) : (
                                <button onClick={(e) => handleActionClick(e, staff, 'activate')} className="w-full text-left px-3 py-2 hover:bg-emerald-50 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2 transition-colors">
                                  <PlayCircle size={14} className="text-emerald-600"/> Reactivate Account
                                </button>
                            )}
                            <div className="h-px bg-slate-100 my-2"></div>
                            <button onClick={(e) => handleActionClick(e, staff, 'delete')} className="w-full text-left px-3 py-2 hover:bg-red-50 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2 transition-colors">
                              <Trash2 size={14}/> Terminate & Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      {editingStaff && (
         <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                   <div>
                     <h2 className="text-3xl font-black text-slate-800">HR Master Profile</h2>
                     <p className="text-slate-500 text-xs font-bold mt-1">Editing record for: <span className="uppercase tracking-widest" style={{ color: APP_COLOR }}>{editingStaff.id}</span></p>
                   </div>
                   <button onClick={() => setEditingStaff(null)} className="p-3 bg-white shadow-sm border border-slate-200 hover:text-red-500 rounded-full transition-colors"><X size={20}/></button>
               </div>

               <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                   <div className="w-full md:w-64 bg-slate-50 border-r border-slate-100 p-6 flex flex-col gap-2 shrink-0 overflow-y-auto">
                       <button onClick={() => setEditModalTab('personal')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all ${editModalTab === 'personal' ? 'bg-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`} style={editModalTab === 'personal' ? { color: APP_COLOR } : {}}><UserCircle size={18}/> Personal Data</button>
                       <button onClick={() => setEditModalTab('employment')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all ${editModalTab === 'employment' ? 'bg-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`} style={editModalTab === 'employment' ? { color: APP_COLOR } : {}}><Briefcase size={18}/> Employment</button>
                       <button onClick={() => setEditModalTab('payroll')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all ${editModalTab === 'payroll' ? 'bg-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`} style={editModalTab === 'payroll' ? { color: APP_COLOR } : {}}><Wallet size={18}/> Payroll & Bank</button>
                       <button onClick={() => setEditModalTab('emergency')} className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-sm transition-all ${editModalTab === 'emergency' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:bg-red-50 hover:text-red-600'}`}><HeartPulse size={18}/> Emergency</button>
                   </div>

                   <div className="flex-1 p-8 overflow-y-auto bg-white">
                       {editModalTab === 'personal' && (
                           <div className="space-y-6">
                               <h3 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Personal Identity & Contact</h3>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                   <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Full Legal Name</label><input type="text" value={editingStaff.name} onChange={e => setEditingStaff({...editingStaff, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"/></div>
                                   <div className="grid grid-cols-2 gap-4">
                                       <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Date of Birth</label><input type="date" value={editingStaff.dob} onChange={e => setEditingStaff({...editingStaff, dob: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"/></div>
                                       <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Gender</label><select value={editingStaff.gender} onChange={e => setEditingStaff({...editingStaff, gender: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"><option>Male</option><option>Female</option><option>Other</option></select></div>
                                   </div>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                   <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Nationality</label><input type="text" value={editingStaff.nationality} onChange={e => setEditingStaff({...editingStaff, nationality: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"/></div>
                                   <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Phone Number</label><input type="tel" value={editingStaff.phone} onChange={e => setEditingStaff({...editingStaff, phone: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"/></div>
                               </div>
                               <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Email Address</label><input type="email" value={editingStaff.email} onChange={e => setEditingStaff({...editingStaff, email: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"/></div>
                               <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Residential Address</label><input type="text" value={editingStaff.address} onChange={e => setEditingStaff({...editingStaff, address: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"/></div>
                           </div>
                       )}

                       {editModalTab === 'employment' && (
                           <div className="space-y-6">
                               <h3 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Employment & Role</h3>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                   <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Job Title</label><input type="text" value={editingStaff.jobTitle} onChange={e => setEditingStaff({...editingStaff, jobTitle: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"/></div>
                                   <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Department</label><input type="text" value={editingStaff.department} onChange={e => setEditingStaff({...editingStaff, department: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"/></div>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                   <div><label className="text-[10px] font-black uppercase text-slate-500 ml-2 mb-1 block">System Role</label><select value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: e.target.value})} className="w-full bg-white shadow-sm p-4 rounded-xl font-bold border-none outline-none"><option>Guide</option><option>Driver</option><option>Operations</option><option>Finance</option><option>CEO</option><option>PROADMIN</option></select></div>
                                   <div><label className="text-[10px] font-black uppercase text-slate-500 ml-2 mb-1 block">Contract Type</label><select value={editingStaff.employmentType} onChange={e => setEditingStaff({...editingStaff, employmentType: e.target.value})} className="w-full bg-white shadow-sm p-4 rounded-xl font-bold border-none outline-none"><option>Full-Time</option><option>Part-Time</option><option>Contract</option><option>Freelance</option></select></div>
                                   <div><label className="text-[10px] font-black uppercase text-slate-500 ml-2 mb-1 block">Start Date</label><input type="date" value={editingStaff.startDate} onChange={e => setEditingStaff({...editingStaff, startDate: e.target.value})} className="w-full bg-white shadow-sm p-4 rounded-xl font-bold border-none outline-none"/></div>
                               </div>
                               
                               <h4 className="text-sm font-black text-slate-800 mb-4 pt-4 border-t">Compliance & Licensing</h4>
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                   <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Document Type</label><select value={editingStaff.licenseType} onChange={e => setEditingStaff({...editingStaff, licenseType: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"><option>None</option><option>Driver's License</option><option>Tour Guide License</option><option>National ID</option></select></div>
                                   <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">ID / License Number</label><input type="text" value={editingStaff.licenseNumber} onChange={e => setEditingStaff({...editingStaff, licenseNumber: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none font-mono"/></div>
                                   <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Expiry Date</label><input type="date" value={editingStaff.licenseExpiry} onChange={e => setEditingStaff({...editingStaff, licenseExpiry: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none"/></div>
                               </div>
                           </div>
                       )}

                       {editModalTab === 'payroll' && (
                           <div className="space-y-6">
                               <h3 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Compensation & Banking</h3>
                               <div className="p-8 rounded-[2.5rem] border" style={{ backgroundColor: `${APP_COLOR}10`, borderColor: `${APP_COLOR}20` }}>
                                  <label className="text-[10px] font-black uppercase ml-2 mb-1 block" style={{ color: APP_COLOR }}>Base Salary / Hourly Rate ({BASE_CURRENCY})</label>
                                  <input type="number" value={editingStaff.baseSalary} onChange={e => setEditingStaff({...editingStaff, baseSalary: e.target.value})} className="w-full bg-white shadow-sm p-5 rounded-2xl font-black text-2xl border-none outline-none" style={{ color: APP_COLOR }} placeholder="0.00"/>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                   <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Bank Name / Provider</label><input type="text" value={editingStaff.bankName} onChange={e => setEditingStaff({...editingStaff, bankName: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none outline-none" placeholder="e.g. Ecobank or MTN MoMo"/></div>
                                   <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Account / Wallet Number</label><input type="text" value={editingStaff.accountNumber} onChange={e => setEditingStaff({...editingStaff, accountNumber: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold font-mono border-none outline-none"/></div>
                               </div>
                           </div>
                       )}

                       {editModalTab === 'emergency' && (
                           <div className="space-y-6">
                               <h3 className="text-xl font-black text-red-600 mb-6 border-b border-red-100 pb-2 flex items-center gap-2"><HeartPulse size={20}/> Emergency Contact</h3>
                               <div className="bg-red-50/30 p-8 rounded-[2.5rem] border border-red-100 space-y-6">
                                   <div><label className="text-[10px] font-black uppercase text-red-500 ml-2 mb-1 block">Primary Contact Name</label><input type="text" value={editingStaff.emergencyName} onChange={e => setEditingStaff({...editingStaff, emergencyName: e.target.value})} className="w-full bg-white shadow-sm p-4 rounded-xl font-bold border-none outline-none focus:ring-2 ring-red-200"/></div>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                       <div><label className="text-[10px] font-black uppercase text-red-500 ml-2 mb-1 block">Phone Number</label><input type="tel" value={editingStaff.emergencyPhone} onChange={e => setEditingStaff({...editingStaff, emergencyPhone: e.target.value})} className="w-full bg-white shadow-sm p-4 rounded-xl font-bold border-none outline-none focus:ring-2 ring-red-200"/></div>
                                       <div><label className="text-[10px] font-black uppercase text-red-500 ml-2 mb-1 block">Relationship</label><input type="text" value={editingStaff.emergencyRelation} onChange={e => setEditingStaff({...editingStaff, emergencyRelation: e.target.value})} placeholder="e.g. Spouse, Parent" className="w-full bg-white shadow-sm p-4 rounded-xl font-bold border-none outline-none focus:ring-2 ring-red-200"/></div>
                                   </div>
                               </div>
                           </div>
                       )}

                   </div>
               </div>

               <div className="p-6 border-t bg-slate-50 flex justify-end">
                   <button onClick={handleUpdateProfile} className="text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:brightness-110 transition-all flex items-center gap-2" style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}>
                       <Save size={20}/> Save HR Profile
                   </button>
               </div>
            </div>
         </div>
      )}

      {securityStaff && (
         <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95 duration-200">
               <div className="flex justify-between items-center mb-8">
                   <div className="flex items-center gap-3">
                       <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl"><Shield size={24}/></div>
                       <div>
                         <h2 className="text-2xl font-black text-slate-800">Security Access</h2>
                         <p className="text-slate-400 text-xs font-bold mt-1">{securityStaff.name}</p>
                       </div>
                   </div>
                   <button onClick={() => { setSecurityStaff(null); setUsernameError(null); }} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400"><X/></button>
               </div>

               <div className="space-y-6">
                   <div className="bg-slate-900 p-6 rounded-[2rem] shadow-inner border border-slate-800">
                       <label className="text-[10px] font-black uppercase mb-2 block tracking-widest" style={{ color: APP_COLOR }}>System Username</label>
                       <div className={`flex items-stretch rounded-xl overflow-hidden border ${usernameError ? 'border-red-500' : 'border-slate-700'}`}>
                           <div className="bg-slate-800 px-4 py-4 flex items-center text-slate-400 font-bold border-r border-slate-700 text-sm">
                               {`${companyPrefix}-${getRolePrefix(securityStaff.role)}-`}
                           </div>
                           <input type="text" value={newUsernameSuffix} onChange={(e) => { setNewUsernameSuffix(e.target.value.replace(/[^a-zA-Z0-9]/g, '')); setUsernameError(null); }} className="w-full bg-slate-900 px-4 outline-none font-mono font-bold text-white uppercase text-lg" maxLength={10}/>
                           <button onClick={() => handleCopy(`${companyPrefix}-${getRolePrefix(securityStaff.role)}-${newUsernameSuffix.toUpperCase()}`, 'sec-username')} className="px-4 bg-slate-800 text-slate-400 hover:text-white transition-colors border-l border-slate-700 flex items-center justify-center">
                               {copiedId === 'sec-username' ? <Check size={18} className="text-green-500"/> : <Copy size={18}/>}
                           </button>
                       </div>
                       {usernameError && <div className="text-red-400 text-[10px] font-bold uppercase tracking-widest mt-3 animate-pulse flex items-center gap-1"><AlertCircle size={12}/> {usernameError}</div>}
                   </div>

                   <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                       <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Force Password Reset</label>
                       <div className="relative">
                           <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                           <input type="text" placeholder="Type new password here..." value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border border-slate-200 outline-none font-mono font-bold text-slate-800 shadow-sm focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}/>
                       </div>
                   </div>

                   <button onClick={handleSecurityUpdate} disabled={isCheckingUsername} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-2">
                       {isCheckingUsername ? <RefreshCw size={20} className="animate-spin"/> : <Lock size={20}/>}
                       {isCheckingUsername ? 'Verifying...' : 'Execute Security Update'}
                   </button>
               </div>
            </div>
         </div>
      )}

      {isWizardOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsWizardOpen(false)}></div>
          
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex flex-col shrink-0 relative">
              <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-2xl font-black text-slate-800">HR Onboarding</h2><p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: APP_COLOR }}>Step {step} of 6</p></div>
                <button onClick={() => { setIsWizardOpen(false); setUsernameError(null); setStep(1); }} className="p-2 bg-white rounded-full text-slate-400 hover:text-red-500 shadow-sm border border-slate-200"><X size={20} /></button>
              </div>
              <div className="flex items-center justify-between relative px-2">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 z-0 rounded-full"></div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 z-0 rounded-full transition-all duration-500" style={{ width: `${((step - 1) / 5) * 100}%`, backgroundColor: APP_COLOR }}></div>
                {[1, 2, 3, 4, 5, 6].map((stepNumber) => (
                  <div key={stepNumber} className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${step >= stepNumber ? 'text-white shadow-md' : 'bg-white text-slate-400 border-2 border-slate-200'}`} style={step >= stepNumber ? { backgroundColor: APP_COLOR } : {}}>{step > stepNumber ? <CheckCircle size={14} /> : stepNumber}</div>
                ))}
              </div>
            </div>

            <div className="p-8 overflow-y-auto h-[500px]">
              
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-xl font-black text-slate-800 mb-4">Personal Data</h3>
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Full Legal Name</label>
                    <input type="text" placeholder="e.g. Samuel Asare" value={newStaff.name} onChange={(e) => setNewStaff({...newStaff, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-bold text-slate-800 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Date of Birth</label><input type="date" value={newStaff.dob} onChange={(e) => setNewStaff({...newStaff, dob: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-medium text-slate-700 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                      <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Gender</label><select value={newStaff.gender} onChange={(e) => setNewStaff({...newStaff, gender: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-medium text-slate-700 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}><option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Nationality</label><input type="text" placeholder="e.g. Ghanaian" value={newStaff.nationality} onChange={(e) => setNewStaff({...newStaff, nationality: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-medium text-slate-700 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Languages</label><input type="text" placeholder="e.g. Twi, English" value={newStaff.languages} onChange={(e) => setNewStaff({...newStaff, languages: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 font-medium text-slate-700 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                    </div>
                </div>
              )}
              
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                   <h3 className="text-xl font-black text-slate-800 mb-4">Contact & Emergency</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input type="tel" placeholder="Phone" value={newStaff.phone} onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /><input type="email" placeholder="Email" value={newStaff.email} onChange={(e) => setNewStaff({...newStaff, email: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                   <input type="text" placeholder="Full Residential Address" value={newStaff.address} onChange={(e) => setNewStaff({...newStaff, address: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} />
                   
                   <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 mt-4">
                       <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-4 flex items-center gap-2"><HeartPulse size={14}/> Emergency Contact</p>
                       <div className="grid grid-cols-1 gap-3">
                           <input type="text" placeholder="Name" value={newStaff.emergencyName} onChange={(e) => setNewStaff({...newStaff, emergencyName: e.target.value})} className="w-full bg-white border border-red-100 p-3 rounded-xl outline-none focus:border-red-400" />
                           <div className="grid grid-cols-2 gap-3">
                               <input type="tel" placeholder="Phone" value={newStaff.emergencyPhone} onChange={(e) => setNewStaff({...newStaff, emergencyPhone: e.target.value})} className="w-full bg-white border border-red-100 p-3 rounded-xl outline-none focus:border-red-400" />
                               <input type="text" placeholder="Relationship" value={newStaff.emergencyRelation} onChange={(e) => setNewStaff({...newStaff, emergencyRelation: e.target.value})} className="w-full bg-white border border-red-100 p-3 rounded-xl outline-none focus:border-red-400" />
                           </div>
                       </div>
                   </div>
                </div>
              )}
              
              {step === 3 && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-xl font-black text-slate-800">Employment & Payroll</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Job Title</label><input type="text" placeholder="e.g. Senior Safari Guide" value={newStaff.jobTitle} onChange={(e) => setNewStaff({...newStaff, jobTitle: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Department</label><input type="text" placeholder="e.g. Field Operations" value={newStaff.department} onChange={(e) => setNewStaff({...newStaff, department: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Contract Type</label><select value={newStaff.employmentType} onChange={(e) => setNewStaff({...newStaff, employmentType: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}><option value="Full-Time">Full-Time</option><option value="Part-Time">Part-Time</option><option value="Contract">Contract</option><option value="Freelance">Freelance</option></select></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-2 block mb-1">Start Date</label><input type="date" value={newStaff.startDate} onChange={(e) => setNewStaff({...newStaff, startDate: e.target.value})} className="w-full bg-slate-50 border p-4 rounded-xl text-slate-700 outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any} /></div>
                    </div>
                    <div className="p-4 rounded-2xl border" style={{ backgroundColor: `${APP_COLOR}10`, borderColor: `${APP_COLOR}30` }}>
                        <p className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: APP_COLOR }}><Wallet size={14}/> Base Compensation</p>
                        <input type="number" placeholder={`Base Salary (${BASE_CURRENCY})`} value={newStaff.baseSalary} onChange={(e) => setNewStaff({...newStaff, baseSalary: e.target.value})} className="w-full bg-white border p-3 rounded-xl font-bold mb-3 outline-none" style={{ color: APP_COLOR, borderColor: `${APP_COLOR}30` }} />
                        <div className="grid grid-cols-2 gap-3">
                            <input type="text" placeholder="Bank Name" value={newStaff.bankName} onChange={(e) => setNewStaff({...newStaff, bankName: e.target.value})} className="w-full bg-white border p-3 rounded-xl text-sm outline-none" style={{ borderColor: `${APP_COLOR}30` }} />
                            <input type="text" placeholder="Account Number" value={newStaff.accountNumber} onChange={(e) => setNewStaff({...newStaff, accountNumber: e.target.value})} className="w-full bg-white border p-3 rounded-xl text-sm font-mono outline-none" style={{ borderColor: `${APP_COLOR}30` }} />
                        </div>
                    </div>
                 </div>
              )}
              
              {step === 4 && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-xl font-black text-slate-800">Compliance & System Role</h3>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                        <label className="text-xs font-black uppercase text-slate-800 block flex items-center gap-2"><Shield size={14} style={{ color: APP_COLOR }}/> Identity & Access Level</label>
                        <select value={newStaff.role} onChange={(e) => setNewStaff({...newStaff, role: e.target.value})} className="w-full bg-white p-4 rounded-xl font-black text-slate-800 shadow-sm border-none outline-none focus:ring-2 transition-all" style={{ '--tw-ring-color': APP_COLOR } as any}>
                          <option value="Guide">Tour Guide (Mobile App)</option>
                          <option value="Driver">Driver (Mobile App)</option>
                          <option value="Operations">Operations Manager (HQ Access)</option>
                          <option value="Finance">Finance Officer (HQ Access)</option>
                          <option value="CEO">CEO (Full Access)</option>
                          <option value="PROADMIN">PROADMIN (God Mode)</option>
                        </select>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium mt-2">This determines what data they can see when they log in to Pronomad.</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                        <label className="text-xs font-black uppercase text-slate-600 block flex items-center gap-2"><FileCheck size={14}/> License Data</label>
                        <select value={newStaff.licenseType} onChange={(e) => setNewStaff({...newStaff, licenseType: e.target.value})} className="w-full bg-white p-3 rounded-xl mb-3 border border-slate-200 outline-none focus:border-slate-400"><option value="None">No License</option><option value="Driver's License">Driver's License</option><option value="Tour Guide License">Tour Guide License</option><option value="National ID">National ID</option></select>
                        {newStaff.licenseType !== 'None' && <div className="grid grid-cols-2 gap-4"><input type="text" placeholder="ID Number" value={newStaff.licenseNumber} onChange={e => setNewStaff({...newStaff, licenseNumber: e.target.value})} className="p-3 rounded-xl border border-slate-200 font-mono text-sm outline-none focus:border-slate-400"/><input type="date" value={newStaff.licenseExpiry} onChange={e => setNewStaff({...newStaff, licenseExpiry: e.target.value})} className="p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400"/></div>}
                    </div>
                 </div>
              )}

              {step === 5 && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    <h3 className="text-xl font-black text-slate-800">Generate Login Credentials</h3>
                    <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl space-y-6">
                        <div>
                            <div className={`flex items-stretch rounded-xl overflow-hidden border-2 ${usernameError ? 'border-red-500' : 'border-slate-700'}`}>
                                <div className="bg-slate-800 px-4 flex items-center text-slate-400 font-bold border-r border-slate-700">{lockedPrefix}</div>
                                <input type="text" placeholder="SARAH" value={customSuffix} onChange={(e) => { setCustomSuffix(e.target.value.replace(/[^a-zA-Z0-9]/g, '')); setUsernameError(null); }} className="w-full bg-slate-900 p-4 outline-none font-mono font-bold text-white uppercase text-xl tracking-widest" maxLength={10}/>
                            </div>
                            {usernameError && <div className="text-red-400 text-[10px] font-bold uppercase tracking-widest mt-3 flex items-center gap-1 animate-pulse"><AlertCircle size={12}/> {usernameError}</div>}
                        </div>
                        <input type="password" placeholder="Set Initial Password" value={newStaff.password} onChange={(e) => setNewStaff({...newStaff, password: e.target.value})} className="w-full bg-slate-900 border-2 border-slate-700 p-4 rounded-xl outline-none font-mono text-white text-lg focus:border-teal-500 transition-colors" style={{ '--tw-ring-color': APP_COLOR } as any}/>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium">Password must be at least 6 characters.</p>
                    </div>
                 </div>
              )}

              {step === 6 && (
                 <div className="text-center animate-in zoom-in-95 duration-300 py-10">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: `${APP_COLOR}20`, color: APP_COLOR }}><CheckCircle size={40}/></div>
                    <h3 className="text-3xl font-black text-slate-800">Review & Provision</h3>
                    <p className="text-slate-500 mt-2">You are about to onboard <strong>{newStaff.name}</strong> as a <strong>{newStaff.jobTitle}</strong>.</p>
                    <div className="bg-slate-50 w-full p-6 rounded-3xl border border-slate-200 text-left mt-8 inline-block max-w-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Generated Username</p>
                        <p className="font-mono font-black text-2xl tracking-widest" style={{ color: APP_COLOR }}>{fullUsername}</p>
                    </div>
                 </div>
              )}
            </div>

            <div className="bg-white border-t border-slate-100 p-6 flex justify-between items-center shrink-0 rounded-b-[2.5rem]">
              <button onClick={() => { setStep(step - 1); setUsernameError(null); }} disabled={step === 1 || isSubmitting} className={`font-bold px-6 py-3 rounded-xl transition-colors flex items-center gap-2 ${step === 1 ? 'opacity-0 cursor-default' : 'text-slate-500 hover:bg-slate-100'}`}><ChevronRight size={18} className="rotate-180"/> Back</button>
              {step < 6 ? (
                <button onClick={handleNextStep} disabled={
                    (step === 1 && (!newStaff.name || !newStaff.dob)) ||
                    (step === 2 && (!newStaff.phone || !newStaff.emergencyName)) ||
                    (step === 3 && (!newStaff.jobTitle || !newStaff.baseSalary)) ||
                    (step === 5 && (!customSuffix || newStaff.password.length < 6)) ||
                    isCheckingUsername
                } className="text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 hover:brightness-110" style={{ backgroundColor: APP_COLOR, boxShadow: `0 4px 14px -2px ${APP_COLOR}40` }}>
                    {isCheckingUsername ? <RefreshCw size={18} className="animate-spin"/> : 'Continue'} <ChevronRight size={18}/>
                </button>
              ) : (
                <button onClick={handleIssueCredentials} disabled={isSubmitting} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"><Key size={20}/> {isSubmitting ? 'Provisioning Profile...' : 'Provision Account'}</button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StaffManagement;