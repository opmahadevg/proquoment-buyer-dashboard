/**
 * POST /api/ai/isolate-product
 *
 * Strips commercial noise from buyer text and returns ONLY the product
 * identity + design specifications suitable for image reference search.
 *
 * Used by:
 *  - Frontend NewProductFlow when buyer enters mixed text on intro screen
 *  - Can also be called post-extraction to refine the product+design query
 *
 * Body: { text: string, rfqData?: any }
 * Returns: { designQuery, productName, designAttributes }
 */

import { NextRequest, NextResponse } from 'next/server';
import { isolateProductDesign } from '@/lib/services/productIsolator';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { text?: string; rfqData?: any };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = (body.text || '').trim();
  if (!text) {
    return NextResponse.json({ error: 'Missing required field: text' }, { status: 400 });
  }

  try {
    const result = await isolateProductDesign(text, body.rfqData);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[isolate-product] Failed:', msg);
    return NextResponse.json({ error: 'Product isolation failed', details: msg }, { status: 500 });
  }
}