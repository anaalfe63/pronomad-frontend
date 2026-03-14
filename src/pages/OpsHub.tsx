import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { BookOpen, Map, Compass, Building2, Layers } from 'lucide-react';

const OpsHub: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useTenant();
    // Defaulting to a clean, vibrant blue similar to the image's "Services" button
    const APP_COLOR = user?.themeColor || '#4f46e5'; 

    // Dynamic state for the bottom explanation text
    const [activeFeature, setActiveFeature] = useState<string>('default');

    const contentMap: Record<string, { title: string, desc1: string, desc2: string }> = {
        default: {
            title: "All in 1 booking engine",
            desc1: "Comprehensive operational control without borders",
            desc2: "All your logistics and services - in one place"
        },
        booking: {
            title: "Booking Engine",
            desc1: "Capture new reservations and process exact trip payments.",
            desc2: "Seamlessly routes partial deposits to the SmartSave vault."
        },
        operations: {
            title: "Trips & Operations",
            desc1: "Generate daily manifests and track upcoming schedules.",
            desc2: "Assign drivers to vehicles and manage passenger itineraries."
        },
        fleet: {
            title: "Live Fleet Intelligence",
            desc1: "Real-time GPS tracking for your entire active fleet.",
            desc2: "Monitor driver speed, fuel levels, and safety incidents."
        },
        suppliers: {
            title: "Supplier CRM",
            desc1: "Maintain a directory of partner hotels, airlines, and guides.",
            desc2: "Track performance metrics and streamline vendor communications."
        }
    };

    const displayContent = contentMap[activeFeature];

    return (
        <div className="relative min-h-[85vh] bg-[#fffff] overflow-hidden flex flex-col items-center justify-center p-4 py-20 md:py-0 font-sans">
            
            {/* MAIN CARD CONTAINER */}
            <div className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                
                {/* TOP HALF: VISUAL ARC & NODES */}
                <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-[#fafafc] overflow-hidden border-b border-slate-50 flex-shrink-0">
                    
                    {/* Subtle Dot Pattern Background */}
                    <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                    
                    {/* Concentric Background Arcs */}
                    <div className="absolute w-[200%] h-[200%] left-[-50%] bottom-[-130%] rounded-full border border-slate-200/60 pointer-events-none"></div>
                    <div className="absolute w-[140%] h-[140%] left-[-20%] bottom-[-80%] rounded-full border border-slate-200/80 pointer-events-none"></div>
                    <div className="absolute w-[80%] h-[80%] left-[10%] bottom-[-30%] rounded-full border border-slate-200 pointer-events-none"></div>

                    {/* SVG Connecting Lines */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        {/* Lines drawn from center-bottom to node coordinates */}
                        <line x1="50%" y1="85%" x2="20%" y2="55%" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="50%" y1="85%" x2="38%" y2="28%" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="50%" y1="85%" x2="62%" y2="28%" stroke="#e2e8f0" strokeWidth="1.5" />
                        <line x1="50%" y1="85%" x2="80%" y2="55%" stroke="#e2e8f0" strokeWidth="1.5" />
                    </svg>

                    {/* NODE 1: Booking */}
                    <div 
                        onMouseEnter={() => setActiveFeature('booking')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/booking')}
                        className="absolute left-[20%] top-[55%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <BookOpen size={24} className="text-[#ea4335]" /> {/* Google Red vibe */}
                    </div>

                    {/* NODE 2: Trips & Ops */}
                    <div 
                        onMouseEnter={() => setActiveFeature('operations')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/operations')}
                        className="absolute left-[38%] top-[28%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <Map size={24} className="text-[#34a853]" /> {/* Google Green vibe */}
                    </div>

                    {/* NODE 3: Live Fleet */}
                    <div 
                        onMouseEnter={() => setActiveFeature('fleet')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/fleet')}
                        className="absolute left-[62%] top-[28%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <Compass size={24} className="text-[#4285f4]" /> {/* Google Blue vibe */}
                    </div>

                    {/* NODE 4: Suppliers */}
                    <div 
                        onMouseEnter={() => setActiveFeature('suppliers')} onMouseLeave={() => setActiveFeature('default')} onClick={() => navigate('/suppliers')}
                        className="absolute left-[80%] top-[55%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.08)] hover:scale-110 transition-all duration-300 z-10 border border-white"
                    >
                        <Building2 size={24} className="text-[#111827]" /> {/* Notion Black vibe */}
                    </div>

                    {/* CENTRAL PILL BUTTON ("Services" equivalent) */}
                    <div className="absolute left-[50%] top-[85%] -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
                        {/* Outer glowing rings */}
                        <div className="absolute w-[160%] h-[160%] rounded-full border border-blue-200/50 pointer-events-none" style={{ borderColor: `${APP_COLOR}40` }}></div>
                        <div className="absolute w-[120%] h-[120%] rounded-full bg-blue-50/50 pointer-events-none blur-sm" style={{ backgroundColor: `${APP_COLOR}20` }}></div>
                        
                        <button 
                            onClick={() => navigate('/booking')} // Routes to booking as the central action
                            className="relative px-6 py-2.5 rounded-full text-white font-medium text-sm tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                            style={{ 
                                backgroundColor: APP_COLOR,
                                boxShadow: `0 8px 20px -6px ${APP_COLOR}80, inset 0 2px 4px rgba(255,255,255,0.3)`
                            }}
                        >
                            <Layers size={16} /> Operations
                        </button>
                    </div>

                    {/* Fade to white gradient at the bottom edge */}
                    <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white to-transparent z-10"></div>
                </div>

                {/* BOTTOM HALF: DYNAMIC TEXT AREA */}
                <div className="p-8 sm:p-10 bg-white h-[200px] flex flex-col justify-center">
                    {/* Using a key to trigger a subtle fade animation when text changes */}
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

export default OpsHub;