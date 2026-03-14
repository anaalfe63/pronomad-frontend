import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { ShieldCheck, Users, CreditCard, Briefcase, Settings } from 'lucide-react';

const AdminHub: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useTenant();
    const APP_COLOR = user?.themeColor || '#c92525'; // Red theme for Admin/Security

    const [activeFeature, setActiveFeature] = useState<string>('default');

    const contentMap: Record<string, { title: string, desc1: string, desc2: string }> = {
        default: {
            title: "Administration Hub",
            desc1: "Executive oversight and platform security.",
            desc2: "Manage your workforce and configure global variables."
        },
        staff: {
            title: "Enterprise HR",
            desc1: "Onboard employees and manage system access roles.",
            desc2: "Securely track driver licenses and compliance documents."
        },
        audit: {
            title: "Flight Recorder",
            desc1: "The system's immutable security black box.",
            desc2: "Track every action, deletion, and login attempt in real-time."
        },
        settings: {
            title: "System Core",
            desc1: "Configure global platform rules and branding.",
            desc2: "Enforce MFA, IP whitelists, and tax configurations."
        },
        billing: {
            title: "SaaS Billing",
            desc1: "Manage your Pronomad Enterprise subscription.",
            desc2: "View payment history and upgrade system capacity."
        }
    };

    const displayContent = contentMap[activeFeature];

    return (
        <div className="relative min-h-[85vh] bg-[#fffff] overflow-hidden flex flex-col items-center justify-center p-4 py-20 md:py-0 font-sans">
            
            <div className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                
                {/* TOP HALF: VISUAL ARC & NODES */}
                <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-[#fafafc] overflow-hidden border-b border-slate-50 flex-shrink-0">
                    
                    <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                    
                    <div className="absolute w-[200%] h-[200%] left-[-50%] bottom-[-130%] rounded-full border border-slate-200/60 pointer-events-none"></div>
                    <div className="absolute w-[140%] h-[140%] left-[-20%] bottom-[-80%] rounded-full border border-slate-200/80 pointer-events-none"></div>
                    <div className="absolute w-[80%] h-[80%] left-[10%] bottom-[-30%] rounded-full border border-slate-200 pointer-events-none"></div>

                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        <line x1="50%" y1="85%" x2="20%" y2="55%" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="50%" y1="85%" x2="38%" y2="28%" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="50%" y1="85%" x2="62%" y2="28%" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="50%" y1="85%" x2="80%" y2="55%" stroke="#e2e8f0" strokeWidth="1.5" />
                    </svg>

                    {/* NODE 1: Enterprise HR */}
                    <div 
                        onMouseEnter={() => setActiveFeature('staff')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/staff')}
                        className="absolute left-[20%] top-[55%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <Users size={24} className="text-blue-600" />
                    </div>

                    {/* NODE 2: Audit Recorder */}
                    <div 
                        onMouseEnter={() => setActiveFeature('audit')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/auditlog')}
                        className="absolute left-[38%] top-[28%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <Briefcase size={24} className="text-slate-700" />
                    </div>

                    {/* NODE 3: System Core */}
                    <div 
                        onMouseEnter={() => setActiveFeature('settings')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/settings')}
                        className="absolute left-[62%] top-[28%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <Settings size={24} className="text-purple-600" />
                    </div>

                    {/* NODE 4: Billing */}
                    <div 
                        onMouseEnter={() => setActiveFeature('billing')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/subscription')}
                        className="absolute left-[80%] top-[55%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <CreditCard size={24} className="text-emerald-600" />
                    </div>

                    {/* CENTRAL PILL BUTTON */}
                    <div className="absolute left-[50%] top-[85%] -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
                        <div className="absolute w-[160%] h-[160%] rounded-full border border-blue-200/50 pointer-events-none" style={{ borderColor: `${APP_COLOR}40` }}></div>
                        <div className="absolute w-[120%] h-[120%] rounded-full bg-blue-50/50 pointer-events-none blur-sm" style={{ backgroundColor: `${APP_COLOR}20` }}></div>
                        
                        <button 
                            onClick={() => navigate('/settings')}
                            className="relative px-6 py-2.5 rounded-full text-white font-medium text-sm tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                            style={{ backgroundColor: APP_COLOR, boxShadow: `0 8px 20px -6px ${APP_COLOR}80`, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                        >
                            <ShieldCheck size={16} /> Security
                        </button>
                    </div>

                    <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white to-transparent z-10"></div>
                </div>

                {/* BOTTOM HALF: DYNAMIC TEXT AREA */}
                <div className="p-8 sm:p-10 bg-white h-[200px] flex flex-col justify-center">
                    <div key={activeFeature} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h2 className="text-2xl sm:text-3xl font-medium text-slate-900 tracking-tight mb-3">
                            {displayContent.title}
                        </h2>
                        <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">
                            {displayContent.desc1} <br/>
                            {displayContent.desc2}
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminHub;