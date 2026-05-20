import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const to = searchParams.get('to') || 'test@example.com';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Proquoment <noreply@proquoment.in>',
        to: [to],
        subject: 'Proquoment — Email Test',
        html: '<h2>Email is working!</h2><p>Your Resend integration with Proquoment is configured correctly.</p>',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ success: false, status: res.status, error: data }, { status: 200 });
    }

    return NextResponse.json({ success: true, message: `Email sent to ${to}`, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
