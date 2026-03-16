import React, { useState, FormEvent } from 'react';
import { useTenant } from '../contexts/TenantContext'; 
import { Lock, User, ArrowRight, Plane, MapPin, Compass, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import bgImage from '../assets/images/login-bg.jpg';
import sideImage from '../assets/images/side-panel.jpg';

const Login: React.FC = () => {
  const { login } = useTenant(); 
  const navigate = useNavigate();
  
  // State
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    // 🟢 PURE SECURITY: No backdoors. No hardcoded passwords. 
    // It only queries the Supabase database.
    try {
        await login({
            loginName: formData.username.trim(),
            loginPin: formData.password
        });
        
        // 🟢 THE FIX: Force the old TenantContext to wake up and read the new tokens
        window.location.href = '/'; 
    } catch (err: any) {
        setError(err.message || 'Invalid credentials');
        setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      
      {/* ================= BACKGROUND LAYER ================= */}
      <div 
        className="absolute inset-0 z-0"
        style={{ 
            backgroundImage: `url(${bgImage})`, 
            backgroundSize: 'cover', 
            backgroundPosition: 'center' 
        }}
      ></div>
      
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-teal-900/70 via-teal-800/60 to-blue-900/10 backdrop-blur-[0px]"></div>

      {/* ================= MAIN CARD ================= */}
      <div className="bg-white/95 backdrop-blur-xl w-full max-w-5xl h-auto md:h-[600px] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row relative z-10 m-4 border border-white/20 animate-in fade-in zoom-in-95 duration-500">
        
        {/* --- LEFT SIDE: BRAND & TRAVEL VIBE --- */}
        <div className="md:w-1/2 bg-cover bg-center relative p-12 text-white flex flex-col justify-between overflow-hidden group"
             style={{ backgroundImage: `url(${sideImage})` }}>
          
          <div className="absolute inset-0 bg-gradient-to-t from-teal-900/90 via-transparent to-teal-900/40 group-hover:scale-105 transition-transform duration-1000"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30">
                    <Plane size={20} className="text-white -rotate-45" strokeWidth={3} />
                </div>
                <span className="font-black text-2xl tracking-tight text-white drop-shadow-md">Pronomad.</span>
            </div>
            <div className="h-1 w-12 bg-teal-400 rounded-full"></div>
          </div>

          <div className="relative z-10 space-y-6">
            <h2 className="text-4xl md:text-5xl font-black leading-tight drop-shadow-lg">
              Manage <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-blue-100">Without Limits.</span>
            </h2>
            <p className="text-teal-50 font-medium text-sm md:text-base max-w-xs leading-relaxed drop-shadow-md">
              The enterprise operating system for modern travel agencies. Manage fleets, bookings, and staff in one unified command center.
            </p>
            
            <div className="flex gap-4 pt-4 opacity-80">
                <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><Compass size={16}/> Explore</div>
                <div className="w-px h-4 bg-white/50"></div>
                <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><MapPin size={16}/> Locate</div>
                <div className="w-px h-4 bg-white/50"></div>
                <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest"><ShieldCheck size={16}/> Secure</div>
            </div>
          </div>
        </div>

        {/* --- RIGHT SIDE: LOGIN FORM --- */}
        <div className="md:w-1/2 p-8 md:p-14 flex flex-col justify-center bg-white relative">
          
          <div className="absolute top-0 right-0 p-6 opacity-5">
             <Plane size={120} className="text-teal-900"/>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-800 mb-2">Welcome Aboard</h2>
            <p className="text-slate-500 font-medium">Enter your credentials to access the workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Username Input */}
            <div className="group">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block group-focus-within:text-teal-600 transition-colors">Username / ID</label>
              <div className="flex items-center border-2 border-slate-100 bg-slate-50 rounded-2xl px-4 py-3.5 focus-within:border-teal-500 focus-within:bg-white focus-within:shadow-lg focus-within:shadow-teal-500/10 transition-all">
                <User size={20} className="text-slate-400 mr-3 group-focus-within:text-teal-500"/>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. PN-GD-KWAME"
                  className="bg-transparent outline-none w-full font-bold text-slate-700 placeholder:font-medium placeholder:text-slate-300"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="group">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block group-focus-within:text-teal-600 transition-colors">Password</label>
              <div className="flex items-center border-2 border-slate-100 bg-slate-50 rounded-2xl px-4 py-3.5 focus-within:border-teal-500 focus-within:bg-white focus-within:shadow-lg focus-within:shadow-teal-500/10 transition-all">
                <Lock size={20} className="text-slate-400 mr-3 group-focus-within:text-teal-500"/>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  placeholder="••••••••"
                  className="bg-transparent outline-none w-full font-bold text-slate-700 placeholder:text-slate-300"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-teal-500 transition-colors focus:outline-none ml-2"
                  tabIndex={-1} 
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
                <div className="w-2 h-2 bg-red-500 rounded-full shrink-0"></div> {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {isLoggingIn ? 'Authenticating...' : 'Access Workspace'} 
              {!isLoggingIn && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>}
            </button>

            <div className="text-center pt-2">
                <p className="text-xs text-slate-400 font-medium">Protected by Enterprise Security</p>
            </div>
          </form>
        </div>

      </div>
      
      {/* 🟢 Removed all hints of Dev Access */}
      <div className="absolute bottom-4 text-white/20 text-[10px] font-mono">
        Photography by @ato_aikins | ProApps Connected
      </div>
    </div>
  );
};

export default Login;