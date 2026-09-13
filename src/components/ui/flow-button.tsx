'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, LucideIcon } from 'lucide-react';

export interface FlowButtonProps {
  text?: string;
  href?: string;
  active?: boolean;
  collapsed?: boolean;
  icon?: LucideIcon;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function FlowButton({
  text = 'Modern Button',
  href,
  active = false,
  collapsed = false,
  icon: Icon = ArrowRight,
  className = '',
  onClick,
}: FlowButtonProps) {
  if (collapsed) {
    const collapsedContent = (
      <>
        <span className="relative z-[1] transition-transform duration-[400ms] group-hover:scale-110">
          <Icon className="w-4 h-4 stroke-current fill-none transition-colors duration-[400ms]" />
        </span>
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#111111] dark:bg-zinc-800 rounded-full opacity-0 group-hover:w-16 group-hover:h-16 group-hover:opacity-100 transition-all duration-[600ms] ease-[cubic-bezier(0.19,1,0.22,1)] pointer-events-none" />
        <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--foreground)] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150 shadow-md">
          {text}
        </div>
      </>
    );

    const collapsedClasses = `group relative flex items-center justify-center w-10 h-10 mx-auto overflow-hidden rounded-full border-[1.5px] cursor-pointer transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-transparent hover:text-white hover:rounded-[10px] active:scale-[0.95] ${
      active
        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
        : 'border-[#333333]/40 dark:border-zinc-700/60 bg-transparent text-[#111111] dark:text-zinc-100'
    } ${className}`;

    if (href) {
      return (
        <Link href={href} className={collapsedClasses} onClick={onClick}>
          {collapsedContent}
        </Link>
      );
    }

    return (
      <button className={collapsedClasses} onClick={onClick}>
        {collapsedContent}
      </button>
    );
  }

  const baseClasses = `group relative flex items-center justify-center gap-1 overflow-hidden rounded-[100px] border-[1.5px] bg-transparent px-8 py-2.5 text-sm font-semibold cursor-pointer transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-transparent hover:text-white hover:rounded-[12px] active:scale-[0.95] ${
    active
      ? 'border-indigo-600 text-indigo-600 bg-indigo-50/40 dark:border-indigo-500 dark:text-indigo-400 dark:bg-indigo-950/20'
      : 'border-[#333333]/40 text-[#111111] dark:border-zinc-700/60 dark:text-zinc-100'
  } ${className}`;

  const innerContent = (
    <>
      {/* Left arrow (arr-2) */}
      <ArrowRight 
        className="absolute w-4 h-4 left-[-25%] stroke-current fill-none z-[9] group-hover:left-4 group-hover:stroke-white transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]" 
      />

      {/* Text */}
      <span className="relative z-[1] -translate-x-3 group-hover:translate-x-3 transition-all duration-[800ms] ease-out whitespace-nowrap">
        {text}
      </span>

      {/* Circle */}
      <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 ${
        active ? 'bg-indigo-600' : 'bg-[#111111] dark:bg-zinc-800'
      } rounded-[50%] opacity-0 group-hover:w-[320px] group-hover:h-[320px] group-hover:opacity-100 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] pointer-events-none`}></span>

      {/* Right arrow (arr-1) */}
      <ArrowRight 
        className="absolute w-4 h-4 right-4 stroke-current fill-none z-[9] group-hover:right-[-25%] group-hover:stroke-white transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]" 
      />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseClasses} onClick={onClick}>
        {innerContent}
      </Link>
    );
  }

  return (
    <button className={baseClasses} onClick={onClick}>
      {innerContent}
    </button>
  );
}

export function FlowButtonDemo() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <FlowButton text="Flow Button" />
    </div>
  );
}

export default FlowButton;
