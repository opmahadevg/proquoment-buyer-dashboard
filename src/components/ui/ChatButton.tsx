'use client';
import React from 'react';
import { MessageCircle } from 'lucide-react';

export default function ChatButton() {
  return (
    <button className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-[#2e29c4] hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5 hover:scale-105 active:scale-95 active:translate-y-0 transition-all duration-200 ease-out z-50">
      <MessageCircle size={22} />
    </button>
  );
}
