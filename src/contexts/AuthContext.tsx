'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clearStoredOrg } from '@/lib/orgStore';

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  // Track the previous user ID so we can clear their data on sign-out
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabaseRef.current = supabase;

    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      prevUserIdRef.current = session?.user?.id ?? null;
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        // Clear per-user localStorage cache for the user who just signed out
        if (prevUserIdRef.current) {
          clearStoredOrg(prevUserIdRef.current);
        }
        prevUserIdRef.current = null;
      } else if (session?.user) {
        prevUserIdRef.current = session.user.id;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const getSupabase = () => {
    if (!supabaseRef.current) throw new Error('Supabase client not initialized');
    return supabaseRef.current;
  };

  const signUp = async (email: string, password: string, metadata?: object) => {
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });
    if (error) throw error;

    // Bootstrap an empty buyer_profiles row immediately after signup
    // (the DB trigger also does this, but we do it here as a safety net)
    if (data?.user) {
      try {
        await getSupabase()
          .from('buyer_profiles')
          .upsert(
            {
              id: data.user.id,
              email: data.user.email,
              verification_status: 'pending',
              // Pre-fill organization_name from signup form if provided
              organization_name: (metadata as any)?.company || '',
            },
            { onConflict: 'id', ignoreDuplicates: true }
          );
      } catch {
        // Non-fatal — DB trigger handles this as fallback
      }
    }

    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
    // clearStoredOrg is also called in the onAuthStateChange SIGNED_OUT handler
  };

  const getCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await getSupabase().auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await getSupabase()
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
