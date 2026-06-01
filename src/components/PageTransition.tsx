'use client';
import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<'enter' | 'entering' | 'idle'>('idle');
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;

    // Start fade-out of old content, then swap in new
    setTransitionStage('enter');
    const t = setTimeout(() => {
      setDisplayChildren(children);
      setTransitionStage('entering');
      const t2 = setTimeout(() => setTransitionStage('idle'), 300);
      return () => clearTimeout(t2);
    }, 80);
    return () => clearTimeout(t);
  }, [pathname, children]);

  // Keep children in sync when same route (data changes, no transition)
  useEffect(() => {
    if (transitionStage === 'idle') {
      setDisplayChildren(children);
    }
  }, [children, transitionStage]);

  return (
    <div
      style={{
        opacity: transitionStage === 'enter' ? 0 : 1,
        transform:
          transitionStage === 'enter'
            ? 'translateY(6px)'
            : transitionStage === 'entering'
            ? 'translateY(0)'
            : 'translateY(0)',
        transition:
          transitionStage === 'idle'
            ? 'none'
            : 'opacity 220ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1)',
        willChange: 'opacity, transform',
        minHeight: '100%',
      }}
    >
      {displayChildren}
    </div>
  );
}
