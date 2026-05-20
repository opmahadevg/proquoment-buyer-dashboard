'use client';
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import AnnouncementBanner from './AnnouncementBanner';
import { Toaster } from 'sonner';
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications';
import { userProfileService } from '@/lib/services/dbService';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await userProfileService.get();
        if (profile?.organizationId) {
          setOrganizationId(profile.organizationId);
        }
      } catch {
        // Silently fail
      }
    };
    loadProfile();
  }, []);

  // Enable real-time notifications for the org
  useRealtimeNotifications({ organizationId, enabled: true });

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Toaster position="bottom-right" richColors />
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div
        className="flex flex-col flex-1 overflow-hidden transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? '240px' : '64px' }}
      >
        <AnnouncementBanner message="Labor Day Notice: Asia production pauses May 1–6. Expect slower responses in this period." />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}