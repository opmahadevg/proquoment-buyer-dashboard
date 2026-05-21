'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type AuthMode = 'login' | 'signup' | 'forgot';

interface LoginForm {
  email: string;
  password: string;
}
interface SignupForm {
  name: string;
  orgName: string;
  email: string;
  password: string;
}
interface ForgotForm {
  email: string;
}

export default function AuthContent() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const loginForm = useForm<LoginForm>();
  const signupForm = useForm<SignupForm>();
  const forgotForm = useForm<ForgotForm>();

  const next = searchParams.get('next') || '/';

  const handleLogin = async (data: LoginForm) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      toast.success('Welcome back!');
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setAuthError(err?.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupForm) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const result = await signUp(data.email, data.password, {
        fullName: data.name,
        company: data.orgName,
        type: 'Buyer',
      });
      if (result?.session) {
        toast.success('Account created! Welcome to Proquoment.');
        router.push(next);
        router.refresh();
      } else {
        toast.success('Account created! Check your email to confirm, then sign in.');
        setMode('login');
        loginForm.setValue('email', data.email);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Sign up failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (data: ForgotForm) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to send reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setAuthError(null);
    setForgotSent(false);
  };

  return (
    <div className="min-h-screen flex">
      <Toaster position="bottom-right" richColors />

      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-primary flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-40 h-40 rounded-full bg-white" />
          <div className="absolute top-60 right-5 w-24 h-24 rounded-full bg-white" />
          <div className="absolute bottom-40 left-20 w-32 h-32 rounded-full bg-white" />
          <div className="absolute bottom-10 right-10 w-16 h-16 rounded-full bg-white" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <img
                src="/proquoment-logo-dark.png"
                alt="Proquoment"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-white font-bold text-xl">Proquoment</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Source smarter.
            <br />
            Buy with confidence.
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-xs">
            Submit RFQs, compare supplier quotes, and manage bulk orders — all from one unified
            procurement dashboard.
          </p>
        </div>
        <div className="relative z-10 bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
          <p className="text-white/90 text-sm leading-relaxed mb-3">
            &ldquo;Proquoment cut our sourcing time by 60%. We went from 3-week quote cycles to
            getting competitive quotes within 5 days.&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              H
            </div>
            <div>
              <p className="text-white text-xs font-semibold">Honey Imtiaz</p>
              <p className="text-white/60 text-xs">Founder, Honey&apos;s Org</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-md">
          {/* Logo — visible on all screen sizes at top of form */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden">
              <img
                src="/proquoment-logo.png"
                alt="Proquoment"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-bold text-lg text-[var(--foreground)] tracking-tight">
              Proquoment
            </span>
          </div>

          {/* ── FORGOT PASSWORD ── */}
          {mode === 'forgot' && (
            <>
              <button
                onClick={() => switchMode('login')}
                className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6 transition-colors"
              >
                <ArrowLeft size={15} /> Back to sign in
              </button>
              <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">
                Reset your password
              </h1>
              <p className="text-sm text-[var(--muted-foreground)] mb-7">
                Enter your email and we&apos;ll send you a reset link.
              </p>
              {forgotSent ? (
                <div className="px-4 py-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm text-center">
                  <p className="font-semibold mb-1">Check your inbox</p>
                  <p>
                    A password reset link has been sent to{' '}
                    <strong>{forgotForm.getValues('email')}</strong>.
                  </p>
                </div>
              ) : (
                <form onSubmit={forgotForm.handleSubmit(handleForgot)} className="space-y-4">
                  {authError && (
                    <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                      {authError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      placeholder="you@yourorg.com"
                      {...forgotForm.register('email', { required: true, pattern: /\S+@\S+\.\S+/ })}
                      className="w-full px-3.5 py-2.5 border border-[var(--input)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] disabled:opacity-60 transition-all"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {isLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              )}
            </>
          )}

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <>
              <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">
                Sign in to your account
              </h1>
              <p className="text-sm text-[var(--muted-foreground)] mb-7">
                Enter your credentials to access your sourcing dashboard.
              </p>
              {authError && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  {authError}
                </div>
              )}
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    placeholder="you@yourorg.com"
                    {...loginForm.register('email', {
                      required: 'Email is required',
                      pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' },
                    })}
                    className="w-full px-3.5 py-2.5 border border-[var(--input)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-xs text-red-500 mt-1">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-[var(--foreground)]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      {...loginForm.register('password', { required: 'Password is required' })}
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
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-red-500 mt-1">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] disabled:opacity-60 transition-all"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </button>
                <p className="text-center text-sm text-[var(--muted-foreground)]">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              </form>

              {/* Demo accounts */}
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-xs text-[var(--muted-foreground)] font-medium">
                    Demo accounts
                  </span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Demo User', email: 'demo@proquoment.com', password: 'Demo@1234' },
                    { label: 'Buyer', email: 'buyer@proquoment.com', password: 'Buyer@1234' },
                  ].map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => {
                        loginForm.setValue('email', account.email);
                        loginForm.setValue('password', account.password);
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 hover:bg-[var(--muted)] hover:border-primary/40 transition-all group"
                    >
                      <div className="text-left">
                        <p className="text-xs font-semibold text-[var(--foreground)]">
                          {account.label}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">{account.email}</p>
                      </div>
                      <span className="text-xs text-primary font-medium group-hover:underline">
                        Use →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── SIGN UP ── */}
          {mode === 'signup' && (
            <>
              <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">
                Create your account
              </h1>
              <p className="text-sm text-[var(--muted-foreground)] mb-7">
                Start sourcing smarter with Proquoment.
              </p>
              {authError && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  {authError}
                </div>
              )}
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Your name"
                    {...signupForm.register('name', { required: 'Name is required' })}
                    className="w-full px-3.5 py-2.5 border border-[var(--input)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    placeholder="Your company name"
                    {...signupForm.register('orgName')}
                    className="w-full px-3.5 py-2.5 border border-[var(--input)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    placeholder="you@yourorg.com"
                    {...signupForm.register('email', {
                      required: 'Email is required',
                      pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' },
                    })}
                    className="w-full px-3.5 py-2.5 border border-[var(--input)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                  {signupForm.formState.errors.email && (
                    <p className="text-xs text-red-500 mt-1">
                      {signupForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      {...signupForm.register('password', {
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
                  {signupForm.formState.errors.password && (
                    <p className="text-xs text-red-500 mt-1">
                      {signupForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-[#2e29c4] disabled:opacity-60 transition-all"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {isLoading ? 'Creating account…' : 'Create account'}
                </button>
                <p className="text-center text-sm text-[var(--muted-foreground)]">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
