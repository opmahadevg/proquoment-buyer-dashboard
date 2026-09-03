'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { generateGoogleNonce } from '@/lib/auth/googleNonce';
import { Loader2 } from 'lucide-react';

interface GoogleSignInButtonProps {
  text?: string;
  next?: string;
  disabled?: boolean;
  className?: string;
  onLoadingChange?: (loading: boolean) => void;
}

export default function GoogleSignInButton({
  text = 'Sign in with Google',
  next = '/',
  disabled = false,
  className = '',
  onLoadingChange,
}: GoogleSignInButtonProps) {
  const btnRef = useRef<HTMLDivElement>(null);
  const [isGisReady, setIsGisReady] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const { user, signInWithGoogleIdToken, signInWithGoogleOAuth } = useAuth();
  const router = useRouter();
  const rawNonceRef = useRef<string>('');

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      if (!response?.credential) return;

      setAuthenticating(true);
      if (onLoadingChange) onLoadingChange(true);
      toast.loading('Signing in with Google…', { id: 'google-gis-auth' });

      try {
        await signInWithGoogleIdToken(response.credential, rawNonceRef.current);
        toast.success('Welcome to Proquoment! 🎉', { id: 'google-gis-auth' });
        router.push(next);
        router.refresh();
      } catch (err: any) {
        console.error('Google Sign-In error:', err);
        toast.error(err?.message || 'Google authentication failed', { id: 'google-gis-auth' });
      } finally {
        setAuthenticating(false);
        if (onLoadingChange) onLoadingChange(false);
      }
    },
    [signInWithGoogleIdToken, next, router, onLoadingChange]
  );

  useEffect(() => {
    if (!clientId || user) return;

    let interval: NodeJS.Timeout;
    const renderGoogleBtn = async () => {
      if (typeof window === 'undefined' || !window.google?.accounts?.id || !btnRef.current) {
        return false;
      }

      try {
        const { nonce, hashedNonce } = await generateGoogleNonce();
        rawNonceRef.current = nonce;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          nonce: hashedNonce,
          use_fedcm_for_prompt: true,
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
          context: 'signin',
        });

        if (btnRef.current) {
          btnRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(btnRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: text === 'Sign up with Google' ? 'signup_with' : 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 380,
          });
        }

        setIsGisReady(true);
        return true;
      } catch (err) {
        console.warn('Failed to render Google button:', err);
        return false;
      }
    };

    renderGoogleBtn().then((rendered) => {
      if (!rendered) {
        let attempts = 0;
        interval = setInterval(async () => {
          attempts++;
          const done = await renderGoogleBtn();
          if (done || attempts > 25) {
            clearInterval(interval);
          }
        }, 200);
      }
    });

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [clientId, user, text, handleCredentialResponse]);

  const handleFallbackClick = async () => {
    if (authenticating || disabled) return;
    setAuthenticating(true);
    if (onLoadingChange) onLoadingChange(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
      await signInWithGoogleOAuth(callbackUrl);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to initialize Google Sign-In.');
      setAuthenticating(false);
      if (onLoadingChange) onLoadingChange(false);
    }
  };

  return (
    <div className={`w-full flex justify-center ${className}`}>
      {authenticating && (
        <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-gray-500">
          <Loader2 size={18} className="animate-spin text-primary" />
          <span>Signing in with Google…</span>
        </div>
      )}

      {/* Native Google Identity Services Button Container */}
      <div
        ref={btnRef}
        className={`w-full flex justify-center min-h-[44px] ${authenticating ? 'hidden' : ''} ${
          !isGisReady ? 'hidden' : ''
        }`}
      />

      {/* Fallback/Loading button while GIS loads */}
      {!isGisReady && !authenticating && (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white hover:bg-gray-50/80 active:bg-gray-100 text-sm font-semibold text-gray-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.33 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
            />
          </svg>
          <span>{text}</span>
        </button>
      )}
    </div>
  );
}
