'use client';
import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [key, setKey] = useState(pathname);
  const prev = useRef(pathname);

  useEffect(() => {
    if (prev.current !== pathname) {
      prev.current = pathname;
      setKey(pathname);
    }
  }, [pathname]);

  return (
    <div key={key} className="animate-slide-up">
      {children}
    </div>
  );
}
