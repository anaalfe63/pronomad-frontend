import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { supabase } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext';

const CEOHeatmap: React.FC = () => {
    const { user } = useTenant();
    const APP_COLOR = user?.themeColor || '#10b981';
    const [locations, setLocations] = useState<any[]>([]);

    useEffect(() => {
        const fetchHeatmapData = async () => {
            if (!user?.subscriberId) return;
            const { data } = await supabase.from('trips').select('title, logistics').eq('subscriber_id', user.subscriberId);
            if (data) setLocations(data);
        };
        fetchHeatmapData();
    }, [user]);

    // Default to Accra if no trips exist
    const center: [number, number] = locations.length > 0 ? [locations[0].lat, locations[0].lng] : [5.6037, -0.1870];

    return (
        <div className="w-full h-80 rounded-3xl overflow-hidden border border-slate-100 shadow-lg relative z-0">
            <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-sm border border-slate-100 pointer-events-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operations Heatmap</p>
                <p className="font-bold text-slate-800 text-sm">Active Trip Density</p>
            </div>
            
            <MapContainer center={center} zoom={11} className="h-full w-full">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="grayscale opacity-70" />
                
                {locations.map((loc, i) => (
                    <CircleMarker 
                        key={i} 
                        center={[loc.lat, loc.lng]} 
                        radius={30} 
                        fillColor={APP_COLOR} 
                        color="transparent" 
                        fillOpacity={0.3}
                    >
                        <Popup>{loc.title}</Popup>
                    </CircleMarker>
                ))}
                
                {/* Overlay smaller, solid dots for precise points */}
                {locations.map((loc, i) => (
                    <CircleMarker key={`core-${i}`} center={[loc.lat, loc.lng]} radius={4} fillColor={APP_COLOR} color="white" weight={2} fillOpacity={1} />
                ))}
            </MapContainer>
        </div>
    );
};

export default CEOHeatmap;