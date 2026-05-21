'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  Bell,
  CheckCheck,
  Trash2,
  Circle,
  ExternalLink,
  FileText,
  Info,
  ShieldAlert,
  Package,
  MessageSquare,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

function cn(...classes: (string | undefined | null | boolean)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (ts?: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'rfq_assigned':
      case 'rfq_status_change':
        return <Package size={16} className="text-blue-500" />;
      case 'quote_received':
      case 'rfq_quoted':
        return <FileText size={16} className="text-emerald-500" />;
      case 'order_stage_change':
      case 'order_shipped':
        return <Package size={16} className="text-indigo-500" />;
      case 'message_received':
        return <MessageSquare size={16} className="text-purple-500" />;
      case 'profile_verified':
        return <CheckCheck size={16} className="text-green-500" />;
      case 'profile_rejected':
        return <ShieldAlert size={16} className="text-rose-500" />;
      default:
        return <Info size={16} className="text-gray-500" />;
    }
  };

  const handleNotificationClick = async (n: any) => {
    if (!n.read) {
      await markAsRead(n.id);
    }
    setIsOpen(false);
    if (n.actionUrl) {
      router.push(n.actionUrl);
    }
  };

  return (
    <div className="relative animate-in fade-in duration-200" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none"
        aria-label="Notifications"
      >
        <Bell size={20} className={isOpen ? 'text-gray-800' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden transform origin-top-left transition-all duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-gray-400">
                <Bell size={28} className="stroke-1 mb-2 opacity-50" />
                <p className="text-xs">All caught up! No notifications yet.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'flex gap-3 px-4 py-3 cursor-pointer transition-colors duration-150',
                    n.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/20 hover:bg-blue-50/40'
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={cn('p-1.5 rounded-lg', n.read ? 'bg-gray-100' : 'bg-blue-50')}>
                      {getNotificationIcon(n.type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-1 mb-0.5">
                      <p
                        className={cn(
                          'text-xs text-gray-800 truncate',
                          n.read ? 'font-medium' : 'font-semibold'
                        )}
                      >
                        {n.title}
                      </p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatTime(n.createdAt)}
                      </span>
                    </div>
                    {n.message && (
                      <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                    )}
                    {n.actionUrl && (
                      <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] font-semibold text-blue-600">
                        View Details
                        <ExternalLink size={10} />
                      </span>
                    )}
                  </div>
                  {!n.read && (
                    <div className="flex-shrink-0 self-center">
                      <Circle size={6} className="fill-blue-500 stroke-none" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
