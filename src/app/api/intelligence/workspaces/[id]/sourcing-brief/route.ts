import { NextRequest, NextResponse } from 'next/server';
import { generateSourcingBrief } from '@/lib/intelligence/sourcing-brief';
import { SourcingObject } from '@/lib/intelligence/core';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let sourcingObj: SourcingObject | null = null;

  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    if (supabase) {
      const { data } = await supabase
        .from('intelligence_sourcing_objects')
        .select('*')
        .eq('workspace_id', id)
        .maybeSingle();

      if (data) {
        sourcingObj = {
          id: data.id,
          workspaceId: data.workspace_id,
          buyerId: 'buyer_anon_01',
          product: data.product || {},
          market: data.market || {},
          supply: data.supply || {},
          economics: data.economics || {},
          compliance: data.compliance || {},
          logistics: data.logistics || {},
          decision: data.decision,
          assumptions: data.assumptions || [],
          dataGaps: [],
          evidenceIds: [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    }
  } catch {
    // Fall back
  }

  if (!sourcingObj) {
    sourcingObj = {
      id: `so_${id}`,
      workspaceId: id,
      buyerId: 'buyer_anon_01',
      product: {
        canonicalName: 'Sodium Benzoate',
        primaryHSCode: '2916.31',
        category: 'Food Additives',
      },
      market: {
        destinationCountry: 'Indonesia',
      },
      supply: {
        originCountries: ['India', 'China'],
      },
      economics: {
        observedTradeUnitValues: {
          low: 1180,
          high: 1220,
          unit: 'USD/MT',
          classification: 'observed',
          evidenceIds: [],
        },
      },
      compliance: {
        requiredCertifications: ['BPOM Distribution Permit', 'Halal BPJPH', 'CoA per batch'],
      },
      logistics: {
        recommendedIncoterms: ['CIF Jakarta', 'FOB Nhava Sheva'],
      },
      assumptions: [],
      dataGaps: [],
      evidenceIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const brief = generateSourcingBrief(sourcingObj);

  return NextResponse.json({ sourcingBrief: brief });
}
