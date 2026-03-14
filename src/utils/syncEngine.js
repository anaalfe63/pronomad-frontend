// src/utils/syncEngine.js

// 1. Add an action to the local queue
export const addToSyncQueue = (endpoint, payload, subscriberId) => {
    const currentQueue = JSON.parse(localStorage.getItem('pronomad_sync_queue') || '[]');
    
    const newAction = {
        id: `action-${Date.now()}`,
        endpoint,
        payload,
        subscriberId,
        timestamp: new Date().toISOString()
    };

    currentQueue.push(newAction);
    localStorage.setItem('pronomad_sync_queue', JSON.stringify(currentQueue));
    console.log(`📦 Saved offline! Action added to queue. Total pending: ${currentQueue.length}`);
};

// 2. Process the queue (Upload to PostgreSQL)
export const processSyncQueue = async () => {
    if (!navigator.onLine) {
        console.log("📴 Still offline. Waiting to sync...");
        return;
    }

    const currentQueue = JSON.parse(localStorage.getItem('pronomad_sync_queue') || '[]');
    if (currentQueue.length === 0) return; // Nothing to sync

    console.log(`🚀 Internet restored! Syncing ${currentQueue.length} items to database...`);
    const remainingQueue = [];

    for (let action of currentQueue) {
        try {
            const response = await fetch(action.endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-subscriber-id': action.subscriberId 
                },
                body: JSON.stringify(action.payload)
            });

            if (!response.ok) {
                throw new Error('Server rejected sync');
            }
            console.log(`✅ Synced action: ${action.id}`);
        } catch (error) {
            console.error(`❌ Failed to sync ${action.id}, keeping in queue.`, error);
            remainingQueue.push(action); // Keep it in the queue to try again later
        }
    }

    // Update the queue with whatever failed (or empty it if all succeeded)
    localStorage.setItem('pronomad_sync_queue', JSON.stringify(remainingQueue));
};