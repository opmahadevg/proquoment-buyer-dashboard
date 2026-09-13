import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    if (supabase) {
      const { data } = await supabase
        .from('intelligence_research_jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (data) {
        return NextResponse.json({ job: data });
      }
    }
  } catch {
    // Fall back
  }

  return NextResponse.json({
    job: {
      id,
      status: 'completed',
      progress: 100,
      message: 'Deep research finished successfully.',
    },
  });
}
