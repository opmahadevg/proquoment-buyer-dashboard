'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  FileText,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { activityService, DbActivityItem } from '@/lib/services/dbService';
import { getStoredProducts } from '@/lib/productStore';
import { useAuth } from '@/contexts/AuthContext';

const ICON_MAP: Record<string, { icon: any; iconBg: string; iconColor: string }> = {
  quote: { icon: FileText, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
  action: { icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-500' },
  order: { icon: CheckCircle, iconBg: 'bg-green-50', iconColor: 'text-green-600' },
  message: { icon: MessageSquare, iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
  product: { icon: Package, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
};

const STATIC_FALLBACK: DbActivityItem[] = [
  {
    id: 'static-1',
    activityType: 'quote',
    title: 'Quote received: Ceramic Plate 26cm',
    description:
      '3 suppliers responded to your RFQ. Best price: $1.85/unit from Shenzhen Ceramics Co.',
    productId: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
  },
  {
    id: 'static-2',
    activityType: 'action',
    title: 'Action required: Cotton T-Shirt MOQ review',
    description: 'Supplier has updated their MOQ to 500 units. Confirm or request renegotiation.',
    productId: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'static-3',
    activityType: 'order',
    title: 'Order confirmed: Kraft Packaging Boxes',
    description: 'PO #4821 confirmed with Shenzhen PackPro. Estimated delivery: May 28, 2026.',
    productId: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'static-4',
    activityType: 'product',
    title: 'RFQ submitted: Bamboo Cutting Board',
    description: 'Your RFQ has been sent to 8 matching suppliers in Guangdong and Zhejiang.',
    productId: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
  },
  {
    id: 'static-5',
    activityType: 'message',
    title: 'Supplier message: Stainless Steel Bottle',
    description: 'Hangzhou MetalWorks sent an update on your sampling request. 2 images attached.',
    productId: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
  },
];

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface ActivityFeedProps {
  limit?: number;
  isDemo?: boolean;
}

export default function ActivityFeed({ limit = 10, isDemo = false }: ActivityFeedProps) {
  const router = useRouter();
  const [activities, setActivities] = useState<DbActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch both product-based activities and live admin notifications
        const [dbData, { fetchBuyerNotifications }] = await Promise.all([
          activityService.getRecent(limit),
          import('@/lib/services/procurementApi'),
        ]);

        const notifications = await fetchBuyerNotifications();

        // Map notifications to activity items
        const notifActivities: DbActivityItem[] = notifications
          .filter((n: any) => !n.read)
          .slice(0, 5)
          .map((n: any) => ({
            id: `notif-${n.id}`,
            activityType:
              n.type === 'quote_accepted' || n.type === 'quote_sent'
                ? 'quote'
                : n.type === 'stage_update'
                  ? 'order'
                  : n.type === 'qc_update'
                    ? 'action'
                    : n.type === 'message_received'
                      ? 'message'
                      : 'product',
            title: n.title,
            description: n.message,
            productId: null,
            createdAt: n.createdAt,
          }));

        if (dbData.length > 0 || notifActivities.length > 0) {
          const merged = [...notifActivities, ...dbData].slice(0, limit);
          setActivities(merged);
        } else {
          const localProducts = getStoredProducts(user?.id);
          const localActivities: DbActivityItem[] = localProducts.slice(0, 3).map((p, i) => ({
            id: `local-${p.id}`,
            activityType: i === 0 ? 'product' : i === 1 ? 'quote' : 'action',
            title:
              i === 0
                ? `RFQ submitted: ${p.name}`
                : i === 1
                  ? `Quotes incoming: ${p.name}`
                  : `Review required: ${p.name}`,
            description:
              i === 0
                ? `Your RFQ has been sent to matching suppliers.`
                : i === 1
                  ? `Suppliers are preparing quotes. Check back soon.`
                  : `Supplier response needs your review before proceeding.`,
            productId: p.id,
            createdAt: p.updated || new Date().toISOString(),
          }));

          const combined = isDemo ? [...localActivities, ...STATIC_FALLBACK] : localActivities;
          setActivities(combined.slice(0, limit));
        }
      } catch (err) {
        setActivities(isDemo ? STATIC_FALLBACK.slice(0, limit) : []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [limit, isDemo, user?.id]);

  const handleItemClick = (item: DbActivityItem) => {
    // Notification items have id starting with 'notif-'
    if (item.id?.startsWith('notif-')) {
      const type = item.activityType;
      if (type === 'quote') router.push('/quotes');
      else if (type === 'order') router.push('/orders');
      else if (type === 'message') router.push('/messages');
      else router.push('/rfq');
      return;
    }
    if (item.productId) {
      router.push(`/product-detail?id=${item.productId}`);
    } else {
      router.push('/products-list');
    }
  };

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
      {activities.map((item) => {
        const config = ICON_MAP[item?.activityType] || ICON_MAP['product'];
        const Icon = config?.icon;
        return (
          <div
            key={item?.id}
            onClick={() => handleItemClick(item)}
            className="flex items-start gap-3 py-3.5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/40 px-1 rounded transition-colors cursor-pointer"
          >
            <div
              className={`w-8 h-8 rounded-lg ${config?.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}
            >
              <Icon size={15} className={config?.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">{item?.title}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
                {item?.description}
              </p>
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
