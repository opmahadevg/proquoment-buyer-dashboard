import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  let next = searchParams.get('next') ?? '/';

  // Ensure next is a safe relative path to prevent open-redirect vulnerabilities
  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/';
  }

  // Handle reverse proxies / custom headers on Netlify or Vercel
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const redirectOrigin = isLocalEnv || !forwardedHost ? origin : `https://${forwardedHost}`;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Safety net: ensure buyer_profiles entry exists
      if (data?.user) {
        try {
          const meta = data.user.user_metadata || {};
          await supabase
            .from('buyer_profiles')
            .upsert(
              {
                id: data.user.id,
                email: data.user.email,
                verification_status: 'pending',
                organization_name: meta.company || meta.organization_name || '',
                login_email: data.user.email,
              },
              { onConflict: 'id', ignoreDuplicates: true }
            );
        } catch {
          // Non-fatal
        }
      }

      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${redirectOrigin}/sign-up-login?error=auth_failed`);
}
