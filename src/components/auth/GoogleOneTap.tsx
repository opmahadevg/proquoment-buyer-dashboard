'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { generateGoogleNonce } from '@/lib/auth/googleNonce';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: string;
            nonce?: string;
            use_fedcm_for_prompt?: boolean;
            itp_support?: boolean;
            prompt_parent_id?: string;
          }) => void;
          prompt: (notification?: (moment: any) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, any>
          ) => void;
          disableAutoSelect: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface GoogleOneTapProps {
  next?: string;
  onAuthSuccess?: () => void;
  onError?: (err: Error) => void;
}

export default function GoogleOneTap({ next = '/', onAuthSuccess, onError }: GoogleOneTapProps) {
  const { user, loading, signInWithGoogleIdToken } = useAuth();
  const router = useRouter();
  const rawNonceRef = useRef<string>('');
  const initializedRef = useRef<boolean>(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      if (!response?.credential) {
        toast.error('No credential received from Google');
        return;
      }

      toast.loading('Signing in with Google…', { id: 'google-one-tap' });

      try {
        await signInWithGoogleIdToken(response.credential, rawNonceRef.current);
        toast.success('Welcome to Proquoment! 🎉', { id: 'google-one-tap' });

        if (onAuthSuccess) {
          onAuthSuccess();
        } else {
          router.push(next);
          router.refresh();
        }
      } catch (err: any) {
        console.error('Google One Tap error:', err);
        const message = err?.message || 'Failed to authenticate with Google';
        toast.error(message, { id: 'google-one-tap' });
        if (onError) onError(err);
      }
    },
    [signInWithGoogleIdToken, next, onAuthSuccess, onError, router]
  );

  const initializeGoogleOneTap = useCallback(async () => {
    if (!clientId) {
      if (process.env.NODE_ENV === 'development') {
        console.info(
          '[GoogleOneTap] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured. Google One Tap prompt skipped.'
        );
      }
      return;
    }

    if (user || loading) {
      return;
    }

    if (!window.google?.accounts?.id) {
      return;
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

      window.google.accounts.id.prompt((notification: any) => {
        if (notification?.isNotDisplayed?.()) {
          console.debug(
            '[GoogleOneTap] Prompt not displayed:',
            notification.getNotDisplayedReason?.()
          );
        } else if (notification?.isSkippedMoment?.()) {
          console.debug(
            '[GoogleOneTap] Prompt skipped moment:',
            notification.getSkippedReason?.()
          );
        } else if (notification?.isDismissedMoment?.()) {
          console.debug(
            '[GoogleOneTap] Prompt dismissed:',
            notification.getDismissedReason?.()
          );
        }
      });

      initializedRef.current = true;
    } catch (err) {
      console.warn('[GoogleOneTap] Initialization failed:', err);
    }
  }, [clientId, user, loading, handleCredentialResponse]);

  // Re-run if Google script is already loaded (e.g. client side navigation)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.accounts?.id && !initializedRef.current) {
      initializeGoogleOneTap();
    }
  }, [initializeGoogleOneTap]);

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onReady={initializeGoogleOneTap}
    />
  );
}
