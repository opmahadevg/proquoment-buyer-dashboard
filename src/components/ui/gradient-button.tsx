'use client';

import React, { type HTMLAttributes } from 'react';
import Link from 'next/link';

export interface GradientButtonProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  width?: string;
  height?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const GradientButton = ({
  children,
  width = '600px',
  height = '100px',
  className = '',
  href,
  onClick,
  disabled = false,
  ...props
}: GradientButtonProps) => {
  const isCompact = typeof height === 'string' && parseInt(height, 10) > 0 && parseInt(height, 10) <= 50;
  const insetClass = isCompact
    ? 'after:inset-[2.5px] after:rounded-[47px]'
    : 'after:inset-[5px] after:rounded-[45px]';

  const commonGradientStyles = `
    relative rounded-[50px] cursor-pointer
    after:content-[""] after:block after:absolute after:bg-[var(--color-background,#ffffff)] dark:after:bg-zinc-900
    ${insetClass} after:z-[1]
    after:transition-opacity after:duration-300 after:ease-linear
    flex items-center justify-center
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  const inner = (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={`
        ${commonGradientStyles}
        rotatingGradient
        ${className}
      `}
      style={{
        '--r': '0deg',
        minWidth: width,
        height: height
      } as React.CSSProperties}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      aria-disabled={disabled}
      {...props}
    >
      <span className="relative z-10 text-[var(--color-text,#0f0f1a)] dark:text-zinc-100 flex items-center justify-center label w-full px-3">
        {children}
      </span>
    </div>
  );

  return (
    <div className="text-[#eee] text-center w-full">
      {href && !disabled ? (
        <Link href={href} className="block w-full">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
};

export default GradientButton;
export { GradientButton };
