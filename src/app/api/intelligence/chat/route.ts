import { NextRequest, NextResponse } from 'next/server';
import { intelligenceEngine } from '@/lib/intelligence/engine';
import { ExecutionEvent } from '@/lib/intelligence/engine/research-executor';
import { extractTextFromPdf, convertPdfPagesToImages } from '@/lib/services/pdfExtractor';
import { extractWithVision, getMimeType, ImageInput } from '@/lib/services/visionExtractor';
import { extractRfqFromText } from '@/lib/services/textExtractor';
import { AttachmentAnalysisSummary } from '@/lib/intelligence/core/attachment-analysis';

function mergeRfqData(textData: any, visionData: any): any {
  if (!textData) return visionData;
  if (!visionData) return textData;
  const merged: any = { ...textData };
  for (const key of Object.keys(visionData)) {
    if (!textData[key]) {
      merged[key] = visionData[key];
    } else if (typeof visionData[key] === 'object' && !Array.isArray(visionData[key])) {
      merged[key] = { ...textData[key], ...visionData[key] };
    } else {
      merged[key] = visionData[key];
    }
  }
  return merged;
}

function parseRfqDataToSpecs(rfqData: any): AttachmentAnalysisSummary['extractedSpecs'] {
  if (!rfqData) return {};

  const p = rfqData.product || {};
  const productName = (typeof p.name === 'object' ? p.name?.value : p.name) || undefined;
  const category = (typeof p.classification === 'object' ? p.classification?.broad_category : p.classification) || undefined;
  const description = (typeof p.description === 'object' ? p.description?.value : p.description) || undefined;
  const intendedUse = (typeof p.intended_use === 'object' ? p.intended_use?.value : p.intended_use) || undefined;

  let quantity: number | undefined;
  let unit: string | undefined;
  const rawQ = (typeof rfqData.quantity?.value === 'object' ? rfqData.quantity?.value?.value : rfqData.quantity?.value) || rfqData.quantity;
  if (rawQ) {
    const qStr = String(rawQ);
    const m = qStr.match(/([\d,.]+)\s*([a-zA-Z]+)?/);
    if (m) {
      quantity = Number(m[1].replace(/,/g, ''));
      unit = m[2] || undefined;
    }
  }

  const specs = rfqData.specifications || {};
  let dimensions: string | undefined;
  let materialGrade: string | undefined;
  const certs: string[] = [];
  const additionalSpecs: Record<string, string> = {};

  for (const [key, val] of Object.entries(specs)) {
    const valStr = typeof val === 'object' && val !== null ? (val as any).value || JSON.stringify(val) : String(val);
    if (!valStr || valStr === 'undefined') continue;

    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('dimension') || lowerKey.includes('size') || lowerKey.includes('measurement')) {
      dimensions = valStr;
    } else if (lowerKey.includes('material') || lowerKey.includes('grade') || lowerKey.includes('composition')) {
      materialGrade = valStr;
    } else if (lowerKey.includes('cert') || lowerKey.includes('standard') || lowerKey.includes('compliance')) {
      certs.push(...valStr.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean));
    } else {
      additionalSpecs[key] = valStr;
    }
  }

  const packagingVal = rfqData.packaging
    ? (typeof rfqData.packaging === 'object'
        ? rfqData.packaging.type?.value || rfqData.packaging.description?.value || JSON.stringify(rfqData.packaging)
        : String(rfqData.packaging))
    : undefined;

  return {
    productName,
    category,
    description,
    intendedUse,
    quantity,
    unit,
    dimensions,
    materialGrade,
    packaging: packagingVal,
    certifications: certs.length > 0 ? Array.from(new Set(certs)) : undefined,
    additionalSpecs: Object.keys(additionalSpecs).length > 0 ? additionalSpecs : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, sessionId, buyerId, workspaceId, conversationHistory, elicitationState, attachments } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    let authUserId: string | undefined;
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) authUserId = user.id;
    } catch {}

    const effectiveBuyerId = authUserId || buyerId || 'buyer_anon_01';
    const effectiveSessionId = sessionId || `sess_${Date.now()}`;

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const sendEvent = (eventType: string, payload: any) => {
          controller.enqueue(
            encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        };

        try {
          sendEvent('session_started', {
            sessionId: effectiveSessionId,
            buyerId: effectiveBuyerId,
            timestamp: new Date().toISOString(),
          });

          // Parse and extract context from attached documents (PDFs & Images)
          let attachmentContext = '';
          let attachmentAnalysisSummary: AttachmentAnalysisSummary | undefined;
          const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

          if (hasAttachments) {
            const visionImages: ImageInput[] = [];
            const textChunks: string[] = [];
            const filesProcessed: string[] = [];
            let usedTextExtraction = false;
            let usedVision = false;

            sendEvent('research_status', {
              state: 'understanding',
              progressPercent: 12,
              message: `Reading specifications from ${attachments.map((a: any) => a.name).join(', ')}...`,
            });

            for (const att of attachments) {
              filesProcessed.push(att.name);
              const isPdf = att.type === 'application/pdf' || att.name.toLowerCase().endsWith('.pdf');
              const isImage = att.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name);

              if (att.dataUrl) {
                try {
                  const base64Content = att.dataUrl.includes('base64,')
                    ? att.dataUrl.split('base64,')[1]
                    : att.dataUrl;
                  const buffer = Buffer.from(base64Content, 'base64');

                  if (isPdf) {
                    const pdfRes = await extractTextFromPdf(buffer);
                    if (!pdfRes.needsOcr && pdfRes.text.length > 0) {
                      textChunks.push(`[ATTACHED PDF: "${att.name}" (${pdfRes.pageCount} pages)]\n${pdfRes.text}`);
                      usedTextExtraction = true;
                    } else {
                      if (pdfRes.text.length > 0) {
                        textChunks.push(`[Partial text from: "${att.name}"]\n${pdfRes.text}`);
                      }
                      const pageImages = await convertPdfPagesToImages(buffer, 5);
                      if (pageImages.length > 0) {
                        for (const pi of pageImages) {
                          visionImages.push({
                            buffer: pi.buffer,
                            filename: `${att.name}_page${pi.page}`,
                            mimeType: pi.mimeType,
                          });
                        }
                        usedVision = true;
                      } else {
                        textChunks.push(`[Attached PDF: "${att.name}" (Visual/scanned specification drawing)]`);
                      }
                    }
                  } else if (isImage) {
                    const mimeType = getMimeType(att.name) || att.type || 'image/png';
                    visionImages.push({
                      buffer,
                      filename: att.name,
                      mimeType,
                    });
                    usedVision = true;
                  }
                } catch (attErr) {
                  console.error(`Error processing attachment ${att.name}:`, attErr);
                  textChunks.push(`[Attached file: ${att.name}]`);
                }
              }
            }

            let rfqData: any = null;
            let extractedObservations: string[] = [];
            let extractedDesignAttrs: string[] = [];
            let productDesignQuery = '';
            let rawVisionText = '';

            try {
              if (visionImages.length > 0) {
                sendEvent('research_status', {
                  state: 'understanding',
                  progressPercent: 16,
                  message: `Analyzing visual product specifications and drawings with multimodal AI vision...`,
                });
                const visionResult = await extractWithVision(visionImages, textChunks.join('\n\n') || undefined);
                rfqData = visionResult.rfqData;
                extractedObservations = visionResult.observations || [];
                extractedDesignAttrs = visionResult.designAttributes || [];
                productDesignQuery = visionResult.productDesignQuery || '';
                rawVisionText = visionResult.extractedText || '';
              }

              if (textChunks.length > 0 && (!rfqData || usedTextExtraction)) {
                sendEvent('research_status', {
                  state: 'understanding',
                  progressPercent: 18,
                  message: 'Extracting product specification tables and certifications...',
                });
                const textRfqData = await extractRfqFromText(textChunks.join('\n\n'));
                if (rfqData) {
                  rfqData = mergeRfqData(textRfqData, rfqData);
                } else {
                  rfqData = textRfqData;
                }
              }
            } catch (aiErr) {
              console.warn('[intelligence/chat] Vision/text extraction encountered an error:', aiErr);
            }

            const parsedSpecs = parseRfqDataToSpecs(rfqData);

            attachmentAnalysisSummary = {
              filesProcessed,
              extractionMethod: usedTextExtraction && usedVision ? 'mixed' : (usedVision ? 'vision' : 'text'),
              productDesignQuery,
              designAttributes: extractedDesignAttrs,
              observations: extractedObservations,
              extractedSpecs: parsedSpecs,
              rawExtractedText: rawVisionText || textChunks.join('\n\n'),
              confidence: 'high',
            };

            // Stream attachment analysis event so client UI can render observation pills immediately
            sendEvent('attachment_analysis', attachmentAnalysisSummary);

            // Construct enriched text prompt for downstream intelligence engine
            attachmentContext += `\n\n[ATTACHED MULTIMODAL SPECIFICATION ANALYSIS]:`;
            attachmentContext += `\n- Files Analyzed: ${filesProcessed.join(', ')}`;
            if (extractedObservations.length > 0) {
              attachmentContext += `\n- Visual Observations: ${extractedObservations.join('; ')}`;
            }
            if (parsedSpecs.productName) attachmentContext += `\n- Product Identified: ${parsedSpecs.productName}`;
            if (parsedSpecs.description) attachmentContext += `\n- Technical Product Description & Brief: ${parsedSpecs.description}`;
            if (parsedSpecs.materialGrade) attachmentContext += `\n- Material / Grade: ${parsedSpecs.materialGrade}`;
            if (parsedSpecs.dimensions) attachmentContext += `\n- Dimensions / Form Factor: ${parsedSpecs.dimensions}`;
            if (parsedSpecs.quantity) attachmentContext += `\n- Order Quantity Identified: ${parsedSpecs.quantity} ${parsedSpecs.unit || 'units'}`;
            if (parsedSpecs.packaging) attachmentContext += `\n- Packaging: ${parsedSpecs.packaging}`;
            if (parsedSpecs.certifications && parsedSpecs.certifications.length > 0) {
              attachmentContext += `\n- Required Standards / Certifications: ${parsedSpecs.certifications.join(', ')}`;
            }
            if (rawVisionText) {
              attachmentContext += `\n\nEXTRACTED SPECIFICATIONS & OCR TEXT:\n"""\n${rawVisionText.slice(0, 6000)}\n"""`;
            } else if (textChunks.length > 0) {
              attachmentContext += `\n\nDOCUMENT TEXT CONTENT:\n"""\n${textChunks.join('\n\n').slice(0, 6000)}\n"""`;
            }
            attachmentContext += `\n[END MULTIMODAL ATTACHMENT ANALYSIS]\n`;
          }

          const enrichedQuery = attachmentContext
            ? `${query}\n\nBuyer attached the following specification documents:${attachmentContext}`
            : query;

          const result = await intelligenceEngine.process({
            query: enrichedQuery,
            sessionId: effectiveSessionId,
            buyerId: effectiveBuyerId,
            workspaceId,
            conversationHistory,
            elicitationState,
            attachmentAnalysis: attachmentAnalysisSummary,
            onProgress: (event: ExecutionEvent) => {
              if (event.type === 'research_status') {
                sendEvent('research_status', {
                  state: event.state,
                  progressPercent: event.progressPercent,
                  message: event.message,
                });
              } else if (event.type === 'tool_started') {
                sendEvent('tool_started', {
                  tool: event.toolName,
                  description: event.stepDescription,
                  progressPercent: event.progressPercent,
                });
              } else if (event.type === 'tool_completed') {
                sendEvent('tool_completed', {
                  tool: event.toolName,
                  description: event.stepDescription,
                });
              } else if (event.type === 'calculation_completed') {
                sendEvent('calculation_completed', {
                  calculation: event.data,
                });
              } else if (event.type === 'evidence_added') {
                sendEvent('evidence_added', {
                  evidence: event.data,
                });
              }
            },
          });

          // Stream final content chunk
          sendEvent('assistant_chunk', {
            content: result.content,
          });

          // Stream structured cards
          if (result.cards && result.cards.length > 0) {
            sendEvent('structured_data', {
              cards: result.cards,
            });
          }

          // Stream suggested actions
          if (result.suggestedActions) {
            sendEvent('suggested_actions', {
              actions: result.suggestedActions,
            });
          }

          // Stream RFQ readiness
          if (result.rfqReadiness) {
            sendEvent('rfq_readiness', {
              readiness: result.rfqReadiness,
            });
          }

          // Stream next elicitation state for client persistence
          if ((result as any).nextElicitationState) {
            sendEvent('elicitation_state', (result as any).nextElicitationState);
          }

          // Persist session, messages & workspace to Supabase for authenticated buyer
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveBuyerId);
          if (isValidUUID) {
            try {
              const { createClient } = await import('@/lib/supabase/server');
              const supabase = await createClient();

              const briefingCard = (result.cards || []).find((c: any) => c.type === 'sourcing_briefing');
              const specCard = (result.cards || []).find((c: any) => c.type === 'spec_clarification');
              const derivedProduct = briefingCard?.data?.productProfile?.name || specCard?.data?.inferredProduct || query.slice(0, 40);
              const derivedDestination = briefingCard?.data?.marketSnapshot?.destinationCountry || '';
              const derivedTitle = derivedDestination ? `${derivedProduct} → ${derivedDestination}` : derivedProduct;

              // 1. Upsert Session
              await supabase.from('intelligence_sessions').upsert({
                id: effectiveSessionId,
                buyer_id: effectiveBuyerId,
                title: derivedTitle,
                workspace_id: workspaceId || null,
                status: 'active',
                updated_at: new Date().toISOString(),
              });

              // 2. Insert User Message
              await supabase.from('intelligence_messages').insert({
                session_id: effectiveSessionId,
                role: 'user',
                content: query,
                metadata: { attachments: attachments || [] },
                created_at: new Date().toISOString(),
              });

              // 3. Insert Assistant Message
              await supabase.from('intelligence_messages').insert({
                id: result.messageId || undefined,
                session_id: effectiveSessionId,
                role: 'assistant',
                content: result.content,
                structured_data: result.cards || [],
                suggested_actions: result.suggestedActions || [],
                research_state: 'completed',
                created_at: new Date().toISOString(),
              });

              // 4. If briefing produced, upsert Active Workspace
              if (briefingCard) {
                const pProfile = briefingCard.data?.productProfile;
                const mSnapshot = briefingCard.data?.marketSnapshot;
                const fIndex = briefingCard.data?.feasibilityIndex;
                const wsId = workspaceId || `ws_${effectiveSessionId.replace(/^sess_/, '')}`;

                await supabase.from('intelligence_workspaces').upsert({
                  id: wsId,
                  buyer_id: effectiveBuyerId,
                  product_name: pProfile?.name || derivedProduct,
                  hs_code: pProfile?.hsCode || null,
                  destination_country: mSnapshot?.destinationCountry || 'Global',
                  destination_country_name: mSnapshot?.destinationCountry || 'Global',
                  origin_countries: mSnapshot?.benchmarkOrigins || ['India', 'China'],
                  status: 'active',
                  sourcing_score: fIndex?.overallScore || 85,
                  updated_at: new Date().toISOString(),
                });

                const soId = `so_${wsId}`;
                await supabase.from('intelligence_sourcing_objects').upsert({
                  id: soId,
                  workspace_id: wsId,
                  product: pProfile || {},
                  market: mSnapshot || {},
                  supply: { benchmarkOrigins: mSnapshot?.benchmarkOrigins || [] },
                  economics: briefingCard.data?.landedCostTable || {},
                  compliance: { checklist: briefingCard.data?.complianceChecklist || [] },
                  decision: {
                    sourcingScore: fIndex?.overallScore || 85,
                    rfqReadyScore: briefingCard.data?.rfqReadyScore || 90,
                    recommendedOrigins: briefingCard.data?.recommendedOrigins || [],
                    nextSteps: briefingCard.data?.nextSteps || [],
                  },
                  updated_at: new Date().toISOString(),
                });

                await supabase.from('intelligence_sessions').update({
                  workspace_id: wsId,
                }).eq('id', effectiveSessionId);
              }
            } catch (persistErr) {
              console.error('Failed to persist intelligence session to Supabase:', persistErr);
            }
          }

          sendEvent('done', {
            sessionId: effectiveSessionId,
            messageId: result.messageId,
          });

          controller.close();
        } catch (err: any) {
          sendEvent('error', {
            message: err?.message || 'Intelligence processing error',
            recoverable: true,
          });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Bad Request' }, { status: 500 });
  }
}
