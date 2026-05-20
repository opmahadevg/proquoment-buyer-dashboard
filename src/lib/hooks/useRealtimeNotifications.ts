'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface UseRealtimeNotificationsProps {
  organizationId?: string | null;
  enabled?: boolean;
}

/**
 * Hook that subscribes to real-time Supabase changes for:
 * - New quotes (quote_steps table changes)
 * - New product updates / action required (product_updates table)
 * - New activity feed items
 *
 * Shows toast notifications on new events.
 */
export function useRealtimeNotifications({
  organizationId,
  enabled = true,
}: UseRealtimeNotificationsProps) {
  const supabase = createClient();

  const handleQuoteChange = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      const step = payload.new;
      if (step?.step_status === 'active' || step?.step_status === 'completed') {
        toast.info('Quote update received', {
          description: `${step.label} — ${step.supplier_count ?? 0} suppliers`,
          duration: 5000,
        });
      }
    }
  }, []);

  const handleUpdateChange = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT') {
      const update = payload.new;
      if (update?.update_type === 'Action') {
        toast.warning('Action Required', {
          description: update.title,
          duration: 6000,
        });
      } else {
        toast.info('New Update', {
          description: update?.title,
          duration: 5000,
        });
      }
    }
  }, []);

  const handleActivityChange = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT') {
      const activity = payload.new;
      if (activity?.activity_type === 'quote') {
        toast.success('New quote received', {
          description: activity.description,
          duration: 5000,
        });
      } else if (activity?.activity_type === 'action') {
        toast.warning('Action required', {
          description: activity.description,
          duration: 6000,
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Subscribe to quote_steps changes
    const quoteChannel = supabase
      .channel('realtime_quote_steps')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quote_steps' },
        handleQuoteChange
      )
      .subscribe();

    // Subscribe to product_updates changes
    const updatesChannel = supabase
      .channel('realtime_product_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'product_updates' },
        handleUpdateChange
      )
      .subscribe();

    // Subscribe to activity_feed changes (org-filtered if possible)
    const activityChannel = supabase
      .channel('realtime_activity_feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          ...(organizationId ? { filter: `organization_id=eq.${organizationId}` } : {}),
        },
        handleActivityChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(quoteChannel);
      supabase.removeChannel(updatesChannel);
      supabase.removeChannel(activityChannel);
    };
  }, [enabled, organizationId, handleQuoteChange, handleUpdateChange, handleActivityChange]);
}
