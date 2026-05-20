'use client';
import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from './Sidebar';
import AnnouncementBanner from './AnnouncementBanner';
import PageTransition from './PageTransition';
import { Toaster } from 'sonner';
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications';
import { userProfileService } from '@/lib/services/dbService';
import { LayoutDashboard, Package, Building2, Settings, Sparkles, Menu, X } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

const BOTTOM_NAV = [
  { href: '/', icon: LayoutDashboard, label: 'Overview' },
  { href: '/products-list', icon: Package, label: 'Products' },
  { href: '/new-product', icon: Sparkles, label: 'New', primary: true },
  { href: '/organization', icon: Building2, label: 'Org' },
  { href: '/account', icon: Settings, label: 'Account' },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === '/new-product') setSidebarOpen(false);
    setMobileSidebarOpen(false);
  }, [pathname]);

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

  useRealtimeNotifications({ organizationId, enabled: true });

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Toaster position="bottom-right" richColors />

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 h-full bg-white shadow-xl">
            <Sidebar open={true} onToggle={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        className="flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ marginLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? (sidebarOpen ? '240px' : '64px') : 0 }}
      >
        {/* Mobile Top Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[var(--border)] sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              <img src="/proquoment-logo.png" alt="Proquoment" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-sm text-[var(--foreground)] tracking-tight">Proquoment</span>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            <Menu size={20} className="text-[var(--foreground)]" />
          </button>
        </div>

        <AnnouncementBanner message="Labor Day Notice: Asia production pauses May 1–6. Expect slower responses in this period." />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <PageTransition>
            {children}
          </PageTransition>
        </main>

        {/* Mobile Bottom Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[var(--border)] safe-area-pb">
          <div className="flex items-center justify-around px-2 py-2">
            {BOTTOM_NAV.map(({ href, icon: Icon, label, primary }) => {
              const active = isActive(href);
              if (primary) {
                return (
                  <Link key={href} href={href} className="flex flex-col items-center gap-0.5">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-md">
                      <Icon size={18} className="text-white" />
                    </div>
                    <span className="text-[10px] font-medium text-primary">{label}</span>
                  </Link>
                );
              }
              return (
                <Link key={href} href={href} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg">
                  <Icon size={20} className={active ? 'text-primary' : 'text-[var(--muted-foreground)]'} />
                  <span className={`text-[10px] font-medium ${active ? 'text-primary' : 'text-[var(--muted-foreground)]'}`}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
