'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Copy, CheckCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

type AuthMode = 'login' | 'signup';

interface LoginForm {
  email: string;
  password: string;
  remember: boolean;
}

interface SignupForm {
  name: string;
  orgName: string;
  email: string;
  password: string;
  terms: boolean;
}

const DEMO_CREDENTIALS = [
  { role: 'Buyer', email: 'maya.chen@honeysorg.com', password: 'buyer@Proquo26' },
  { role: 'Admin', email: 'rajiv.admin@honeysorg.com', password: 'admin@Proquo26' },
  { role: 'Viewer', email: 'priya.view@honeysorg.com', password: 'viewer@Proquo26' },
];

interface CredentialBoxProps {
  onUse: (email: string, password: string) => void;
}

function CredentialBox({ onUse }: CredentialBoxProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="mt-5 border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--muted)]/40">
      <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide px-4 py-2.5 border-b border-[var(--border)] bg-white">
        Demo Accounts
      </p>
      <div>
        <div className="grid grid-cols-[80px_1fr_1fr_80px] px-4 py-2 border-b border-[var(--border)] bg-white">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Role</span>
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Email</span>
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Password</span>
          <span></span>
        </div>
        {DEMO_CREDENTIALS.map((cred) => (
          <div
            key={`cred-${cred.role}`}
            className="grid grid-cols-[80px_1fr_1fr_80px] px-4 py-2.5 border-b border-[var(--border)] last:border-0 hover:bg-white/60 transition-colors items-center"
          >
            <span className="text-xs font-semibold text-[var(--foreground)]">{cred.role}</span>
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-xs text-[var(--muted-foreground)] truncate">{cred.email}</span>
              <button
                onClick={() => handleCopy(cred.email, `email-${cred.role}`)}
                className="flex-shrink-0 p-1 rounded hover:bg-[var(--muted)] transition-colors"
              >
                {copiedField === `email-${cred.role}` ? (
                  <CheckCheck size={11} className="text-green-600" />
                ) : (
                  <Copy size={11} className="text-[var(--muted-foreground)]" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-xs text-[var(--muted-foreground)] font-mono truncate">{cred.password}</span>
              <button
                onClick={() => handleCopy(cred.password, `pass-${cred.role}`)}
                className="flex-shrink-0 p-1 rounded hover:bg-[var(--muted)] transition-colors"
              >
                {copiedField === `pass-${cred.role}` ? (
                  <CheckCheck size={11} className="text-green-600" />
                ) : (
                  <Copy size={11} className="text-[var(--muted-foreground)]" />
                )}
              </button>
            </div>
            <button
              onClick={() => onUse(cred.email, cred.password)}
              className="text-xs font-semibold text-primary hover:text-[#2e29c4] transition-colors"
            >
              Use →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthContent() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const loginForm = useForm<LoginForm>({ defaultValues: { remember: false } });
  const signupForm = useForm<SignupForm>({ defaultValues: { terms: false } });

  const handleLogin = async (data: LoginForm) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      toast.success('Welcome back! Signed in successfully.');
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setAuthError(err?.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupForm) => {
    setIsLoading(true);
    try {
      await signUp(data.email, data.password, { fullName: data.name });
      toast.success('Account created! You are now signed in.');
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setAuthError(err?.message || 'Sign up failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const autofillCredentials = (email: string, password: string) => {
    loginForm.setValue('email', email);
    loginForm.setValue('password', password);
    setAuthError(null);
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
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="text-white font-bold text-xl">Proquoment</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Source smarter.<br />Buy with confidence.
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-xs">
            Submit RFQs, compare supplier quotes, and manage bulk orders — all from one unified procurement dashboard.
          </p>
        </div>

        <div className="relative z-10 bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
          <p className="text-white/90 text-sm leading-relaxed mb-3">
            &ldquo;Proquoment cut our sourcing time by 60%. We went from 3-week quote cycles to getting competitive quotes within 5 days.&rdquo;
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
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-bold text-lg text-[var(--foreground)]">Proquoment</span>
          </div>

          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mb-7">
            {mode === 'login' ?'Enter your credentials to access your sourcing dashboard.' :'Start sourcing smarter with Proquoment.'}
          </p>

          {authError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {authError}
            </div>
          )}

          {/* Login form */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="maya.chen@honeysorg.com"
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
                  <button type="button" className="text-xs text-primary hover:underline font-medium">
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
                  onClick={() => { setMode('signup'); setAuthError(null); }}
                  className="text-primary font-semibold hover:underline"
                >
                  Sign up
                </button>
              </p>

              <CredentialBox onUse={autofillCredentials} />
            </form>
          )}

          {/* Signup form */}
          {mode === 'signup' && (
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Maya Chen"
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
                  placeholder="Honey's Org"
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
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...signupForm.register('password', {
                      required: 'Password is required',
                      minLength: { value: 8, message: 'Password must be at least 8 characters' },
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
                  onClick={() => { setMode('login'); setAuthError(null); }}
                  className="text-primary font-semibold hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}