import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, Key, Shield, Save, CheckCircle } from 'lucide-react';

// Define the shape of your passwords state
interface PasswordsState {
  current: string;
  new: string;
  confirm: string;
}

const Profile: React.FC = () => {
  const { user } = useAuth();
  
  // Apply the interface to the state
  const [passwords, setPasswords] = useState<PasswordsState>({ current: '', new: '', confirm: '' });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Strongly type the event parameter
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      return alert("New passwords do not match!");
    }
    
    setIsSubmitting(true);
    setSuccessMsg('');

    try {
      const response = await fetch(`http://localhost:3000/api/staff/${user?.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentPassword: passwords.current, 
          newPassword: passwords.new 
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setSuccessMsg('Password updated successfully!');
        setPasswords({ current: '', new: '', confirm: '' }); // Clear form
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Error updating password. Check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in pb-20 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-teal-900 tracking-tight">My Profile</h1>
        <p className="text-teal-600/80 font-medium">Manage your account settings and security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* IDENTITY CARD */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-white/60 text-center flex flex-col items-center">
            <div className="w-24 h-24 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white shadow-lg mb-4">
              <UserCircle size={48} />
            </div>
            <h2 className="text-xl font-black text-slate-800">{user?.name || 'Staff Member'}</h2>
            <p className="text-sm font-bold text-teal-600 uppercase tracking-widest mt-1 mb-4">{user?.role || 'User'}</p>
            
            <div className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-left space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Shield size={14}/> Secure ID
              </p>
              <p className="font-mono font-black text-slate-700">{user?.username || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* SECURITY SETTINGS */}
        <div className="md:col-span-2">
          <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-white/60">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Key size={20} className="text-teal-500"/> Update Password
            </h3>

            {successMsg && (
              <div className="bg-green-50 text-green-700 p-4 rounded-xl mb-6 font-bold flex items-center gap-2">
                <CheckCircle size={18}/> {successMsg}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Current Password</label>
                <input 
                  type="password" required
                  value={passwords.current}
                  onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">New Password</label>
                  <input 
                    type="password" required minLength={6}
                    value={passwords.new}
                    onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Confirm New</label>
                  <input 
                    type="password" required minLength={6}
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>
              <button 
                type="submit" disabled={isSubmitting}
                className="mt-4 bg-teal-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-teal-500 transition-all w-full"
              >
                <Save size={18}/> {isSubmitting ? 'Updating Security...' : 'Save New Password'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;