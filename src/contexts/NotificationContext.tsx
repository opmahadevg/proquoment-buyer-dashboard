'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BuyerNotification } from '@/lib/types/notificationTypes';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: BuyerNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<BuyerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { user } = useAuth();

  const refreshNotifications = useCallback(async () => {
    // Never fetch without a known user — prevents cross-buyer data leaks
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Fetch ONLY this buyer's notifications (buyer_id = user.id).
      // Also include admin_announcement broadcasts that have no specific buyer_id.
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('target_dashboard', 'buyer')
        .or(`buyer_id.eq.${user.id},type.eq.admin_announcement`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(
        (data || []).map((n: any) => ({
          id: n.id,
          targetDashboard: n.target_dashboard,
          orderId: n.order_id,
          type: n.type,
          title: n.title,
          message: n.message,
          read: n.read ?? false,
          actionUrl: n.action_url,
          createdAt: n.created_at,
        }))
      );
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    refreshNotifications();

    // Realtime subscription — filtered to THIS buyer's rows only
    const channel = supabase
      .channel(`buyer-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          // Server-side filter: only rows where buyer_id matches current user
          filter: `buyer_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new;
            if (newRow.target_dashboard === 'buyer') {
              const mapped: BuyerNotification = {
                id: newRow.id,
                targetDashboard: newRow.target_dashboard,
                orderId: newRow.order_id,
                type: newRow.type,
                title: newRow.title,
                message: newRow.message,
                read: newRow.read ?? false,
                actionUrl: newRow.action_url,
                createdAt: newRow.created_at,
              };
              setNotifications((prev) => {
                if (prev.some((n) => n.id === mapped.id)) return prev;
                return [mapped, ...prev];
              });
              toast.info(mapped.title, {
                description: mapped.message,
                duration: 5000,
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const newRow = payload.new;
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === newRow.id
                  ? {
                      ...n,
                      read: newRow.read ?? false,
                      title: newRow.title,
                      message: newRow.message,
                    }
                  : n
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshNotifications, supabase]);

  const markAsRead = async (id: number) => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('buyer_id', user!.id); // Scoped to own rows only
      if (error) throw error;
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      refreshNotifications();
    }
  };

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('target_dashboard', 'buyer')
        .eq('buyer_id', user!.id) // Scoped to own rows only
        .eq('read', false);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      refreshNotifications();
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
