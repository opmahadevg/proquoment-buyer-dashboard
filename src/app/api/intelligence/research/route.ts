import { NextRequest, NextResponse } from 'next/server';
import { intelligenceEngine } from '@/lib/intelligence/engine';

const ASYNC_JOBS = new Map<string, any>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, buyerId, workspaceId, sessionId } = body;

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const effectiveSessionId = sessionId || `sess_${Date.now()}`;

    const job = {
      id: jobId,
      sessionId: effectiveSessionId,
      workspaceId: workspaceId || null,
      buyerId: buyerId || 'buyer_anon_01',
      query,
      status: 'executing',
      progress: 10,
      events: [{ time: new Date().toISOString(), message: 'Research job initialized' }],
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
    };

    ASYNC_JOBS.set(jobId, job);

    // Launch background asynchronous research
    (async () => {
      try {
        const result = await intelligenceEngine.process({
          query,
          sessionId: effectiveSessionId,
          buyerId: job.buyerId,
          workspaceId,
          onProgress: (ev) => {
            job.progress = ev.progressPercent || job.progress;
            job.events.push({
              time: new Date().toISOString(),
              message: ev.message || ev.stepDescription || 'Working...',
            });
          },
        });

        job.status = 'completed';
        job.progress = 100;
        job.result = result;
      } catch (err: any) {
        job.status = 'failed';
        job.error = err?.message || 'Deep research failed';
      }
    })();

    return NextResponse.json({ job: { id: jobId, status: 'executing', progress: 10 } }, { status: 202 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to start research' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (jobId) {
    const job = ASYNC_JOBS.get(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    return NextResponse.json({ job });
  }

  return NextResponse.json({ jobs: Array.from(ASYNC_JOBS.values()) });
}
