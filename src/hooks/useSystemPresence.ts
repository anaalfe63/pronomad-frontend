import { useEffect } from 'react';
import { supabase } from '../lib/supabase'; 

const useSystemPresence = (subscriberId: string | null) => {
  useEffect(() => {
    // If nobody is logged in, do nothing
    if (!subscriberId) return;

    const broadcastPresence = async () => {
      try {
        // 🛑 TEMPORARILY DISABLED: The 'updated_at' column does not exist in the 'subscribers' table.
        // Once you add an 'updated_at' (Timestamp) column to your Supabase subscribers table,
        // you can uncomment this code to enable live presence tracking.
        
        /*
        const { error } = await supabase
          .from('subscribers') 
          .update({ updated_at: new Date().toISOString() }) 
          .eq('subscriber_id', subscriberId); 

        if (error) console.error("Presence Error:", error.message);
        */
        
        // Silent success for now
        return;
      } catch (err) {
        console.error("Fatal:", err);
      }
    };

    // 1. Send immediate ping on login/page load
    broadcastPresence();

    // 2. Keep sending a ping every 5 minutes (300,000 milliseconds)
    const interval = setInterval(() => {
      broadcastPresence();
    }, 300000);

    // Cleanup the loop if they log out or close the tab
    return () => clearInterval(interval);
  }, [subscriberId]);
};

export default useSystemPresence;