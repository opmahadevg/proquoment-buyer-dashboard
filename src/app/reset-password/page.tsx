'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface ResetForm {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetForm>();

  const router = useRouter();
  const password = watch('password');

  useEffect(() => {
    // Supabase PKCE flow: session is already established by /auth/callback
    // Just verify we have a valid session
    const supabase = createClient();
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setSessionError('Reset link expired or already used. Request a new one.');
      }
    });
  }, []);

  const handleReset = async (data: ResetForm) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw error;
      setDone(true);
      toast.success('Password updated! Redirecting to sign in…');
      setTimeout(() => router.push('/sign-up-login'), 2500);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <Toaster position="bottom-right" richColors />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden">
            <img src="/proquoment-logo.png" alt="Proquoment" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-lg text-[var(--foreground)] tracking-tight">Proquoment</span>
        </div>

        {sessionError ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <XCircle size={48} className="text-red-500" />
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Link expired</h1>
            <p className="text-sm text-[var(--muted-foreground)]">{sessionError}</p>
            <button
              onClick={() => router.push('/sign-up-login')}
              className="mt-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] transition-all"
            >
              Back to sign in
            </button>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 size={48} className="text-green-500" />
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Password updated!</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Redirecting you to sign in…
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">Set new password</h1>
            <p className="text-sm text-[var(--muted-foreground)] mb-7">
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit(handleReset)} className="space-y-4">
              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 8, message: 'Minimum 8 characters' },
                    })}
                    className="w-full px-3.5 py-2.5 border border-[var(--input)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat your password"
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (v) => v === password || 'Passwords do not match',
                    })}
                    className="w-full px-3.5 py-2.5 border border-[var(--input)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] disabled:opacity-60 transition-all"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                {isLoading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
