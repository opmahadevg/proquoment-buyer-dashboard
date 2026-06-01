'use client';
import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevKey = useRef(`${pathname}?${searchParams}`);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startProgress = () => {
    setProgress(0);
    setVisible(true);
    let p = 0;
    timerRef.current = setInterval(() => {
      // Accelerate to 80% quickly, then slow down
      p = p < 30 ? p + 8 : p < 60 ? p + 4 : p < 80 ? p + 1.5 : p + 0.3;
      if (p >= 90) {
        clearInterval(timerRef.current!);
        p = 90;
      }
      setProgress(p);
    }, 30);
  };

  const finishProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  };

  useEffect(() => {
    const key = `${pathname}?${searchParams}`;
    if (prevKey.current !== key) {
      prevKey.current = key;
      startProgress();
      // Finish after a short delay (page settled)
      const t = setTimeout(finishProgress, 400);
      return () => {
        clearTimeout(t);
        if (timerRef.current) clearInterval(timerRef.current);
        if (hideRef.current) clearTimeout(hideRef.current);
      };
    }
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '2px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'var(--primary)',
          boxShadow: '0 0 8px var(--primary)',
          transition: progress === 100
            ? 'width 150ms ease-out, opacity 250ms ease 200ms'
            : 'width 80ms linear',
          opacity: progress === 100 ? 0 : 1,
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
  );
}
