'use client';
import React, { useState } from 'react';
import { Megaphone, X } from 'lucide-react';

interface AnnouncementBannerProps {
  message: string;
}

export default function AnnouncementBanner({ message }: AnnouncementBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-primary text-white text-sm font-medium px-6 py-2.5 flex items-center gap-2.5 flex-shrink-0">
      <Megaphone size={15} className="flex-shrink-0 opacity-80" />
      <span className="flex-1">{message}</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  );
}
