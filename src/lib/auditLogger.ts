import { supabase } from './supabase';

export const logAudit = async (
  subscriberId: string,
  userName: string,
  userRole: string,
  action: string,
  details: string
) => {
  try {
    const { error } = await supabase.from('audit_logs').insert([{
      subscriber_id: subscriberId,
      user_name: userName,
      user_role: userRole,
      action: action,
      details: details
    }]);
    
    if (error) throw error;
  } catch (e) {
    console.error("Failed to write to audit log:", e);
  }
};