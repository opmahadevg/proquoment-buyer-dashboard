'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Send an email notification via the Supabase edge function.
 * type: 'quote_received' | 'action_required'
 */
export async function sendEmailNotification(params: {
  type: 'quote_received' | 'action_required';
  to: string;
  productName: string;
  supplierName?: string;
  actionDescription?: string;
}): Promise<void> {
  const supabase = createClient();
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: params,
    });
    if (error) {
      console.error('Email notification failed:', error.message);
    }
  } catch (err: any) {
    console.error('Email notification error:', err.message);
  }
}
