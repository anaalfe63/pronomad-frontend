import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { Sparkles, PiggyBank, Route, TrendingUp, Target, MessageSquare } from 'lucide-react';

const AIHub: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useTenant();
    const APP_COLOR = user?.themeColor || '#8b5cf6'; // Purple theme for AI

    const [activeFeature, setActiveFeature] = useState<string>('default');

    const contentMap: Record<string, { title: string, desc1: string, desc2: string }> = {
        default: {
            title: "Intelligence Suite",
            desc1: "Predictive algorithms and autonomous communications.",
            desc2: "Anticipate passenger needs before they even ask."
        },
        smartsave: {
            title: "SmartSave Vault",
            desc1: "Manage flexible layaway plans and installment payments.",
            desc2: "The system autonomously tracks progress and alerts users."
        },
        smartyield: {
            title: "SmartYield Engine",
            desc1: "Dynamic AI pricing algorithm for your travel packages.",
            desc2: "Automatically surges or drops ticket prices based on demand."
        },
        smartmatch: {
            title: "SmartMatch CRM",
            desc1: "Predictive marketing using historical booking data.",
            desc2: "Identifies past clients most likely to buy your new trips."
        },
        comms: {
            title: "Auto-Comms",
            desc1: "Automated SMS & WhatsApp communication gateway.",
            desc2: "Blast itineraries and digital boarding passes instantly."
        },
        smartroute: {
            title: "SmartRoute (Beta)",
            desc1: "Algorithmic route optimization for your live fleet.",
            desc2: "Predicts travel delays based on traffic and weather data."
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

                    {/* 5 Connecting Lines for AI */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        <line x1="50%" y1="85%" x2="15%" y2="60%" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="50%" y1="85%" x2="30%" y2="25%" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="50%" y1="85%" x2="50%" y2="15%" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="50%" y1="85%" x2="70%" y2="25%" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="50%" y1="85%" x2="85%" y2="60%" stroke="#e2e8f0" strokeWidth="1.5" />
                    </svg>

                    {/* NODE 1: SmartSave */}
                    <div 
                        onMouseEnter={() => setActiveFeature('smartsave')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/smartsave')}
                        className="absolute left-[15%] top-[60%] -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <PiggyBank size={20} className="text-pink-500" />
                    </div>

                    {/* NODE 2: SmartYield */}
                    <div 
                        onMouseEnter={() => setActiveFeature('smartyield')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/smartyield')}
                        className="absolute left-[30%] top-[25%] -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <TrendingUp size={20} className="text-emerald-500" />
                    </div>

                    {/* NODE 3: SmartRoute */}
                    <div 
                        onMouseEnter={() => setActiveFeature('smartroute')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/smartroute')}
                        className="absolute left-[50%] top-[15%] -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <Route size={20} className="text-blue-500" />
                    </div>

                    {/* NODE 4: SmartMatch */}
                    <div 
                        onMouseEnter={() => setActiveFeature('smartmatch')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/smartmatch')}
                        className="absolute left-[70%] top-[25%] -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <Target size={20} className="text-amber-500" />
                    </div>

                    {/* NODE 5: Auto-Comms */}
                    <div 
                        onMouseEnter={() => setActiveFeature('comms')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/communications')}
                        className="absolute left-[85%] top-[60%] -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <MessageSquare size={20} className="text-green-500" />
                    </div>

                    {/* CENTRAL PILL BUTTON */}
                    <div className="absolute left-[50%] top-[85%] -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
                        <div className="absolute w-[160%] h-[160%] rounded-full border border-blue-200/50 pointer-events-none" style={{ borderColor: `${APP_COLOR}40` }}></div>
                        <div className="absolute w-[120%] h-[120%] rounded-full bg-blue-50/50 pointer-events-none blur-sm" style={{ backgroundColor: `${APP_COLOR}20` }}></div>
                        
                        <button 
                            className="relative px-6 py-2.5 rounded-full text-white font-medium text-sm tracking-wide shadow-lg cursor-default flex items-center gap-2"
                            style={{ backgroundColor: APP_COLOR, boxShadow: `0 8px 20px -6px ${APP_COLOR}80`, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                        >
                            <Sparkles size={16} /> Nomad AI
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

export default AIHub;