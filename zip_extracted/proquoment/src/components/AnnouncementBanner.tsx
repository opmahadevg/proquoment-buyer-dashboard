import React from 'react';
import { Megaphone } from 'lucide-react';

interface AnnouncementBannerProps {
  message: string;
}

export default function AnnouncementBanner({ message }: AnnouncementBannerProps) {
  return (
    <div className="bg-primary text-white text-sm font-medium px-6 py-2.5 flex items-center gap-2.5 flex-shrink-0">
      <Megaphone size={15} className="flex-shrink-0 opacity-80" />
      <span>{message}</span>
    </div>
  );
}