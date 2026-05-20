'use client';
import React, { useState, useEffect } from 'react';
import { Package, FileText, CheckCircle, AlertTriangle, MessageSquare, Loader2 } from 'lucide-react';
import { activityService, DbActivityItem } from '@/lib/services/dbService';
import Icon from '@/components/ui/AppIcon';


const ICON_MAP: Record<string, { icon: any; iconBg: string; iconColor: string }> = {
  quote: { icon: FileText, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
  action: { icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-500' },
  order: { icon: CheckCircle, iconBg: 'bg-green-50', iconColor: 'text-green-600' },
  message: { icon: MessageSquare, iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
  product: { icon: Package, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<DbActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await activityService.getRecent(10);
        setActivities(data);
      } catch (err) {
        console.error('Failed to load activity:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-[var(--muted-foreground)]">
        No recent activity.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities?.map((item) => {
        const config = ICON_MAP[item?.activityType] || ICON_MAP['product'];
        const Icon = config?.icon;
        return (
          <div
            key={item?.id}
            className="flex items-start gap-3 py-3.5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/40 px-1 rounded transition-colors cursor-pointer"
          >
            <div className={`w-8 h-8 rounded-lg ${config?.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <Icon size={15} className={config?.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">{item?.title}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">{item?.description}</p>
            </div>
            <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0 mt-0.5">
              {timeAgo(item?.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}