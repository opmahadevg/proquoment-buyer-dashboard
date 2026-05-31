import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  // ✅ CORS preflight
  if (req?.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const { type, to, productName, supplierName, actionDescription } = await req?.json();

    const RESEND_API_KEY = (globalThis as any).Deno?.env?.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    let subject = "";
    let html = "";

    if (type === "quote_received") {
      subject = `New Quote Received — ${productName}`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #3730a3; padding: 20px 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Proquoment</h1>
          </div>
          <div style="background: #f8f8ff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; font-size: 18px; margin-top: 0;">New Quote Received</h2>
            <p style="color: #4b5563;">A new quote has arrived for your sourcing request.</p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Product:</strong> ${productName}</p>
              <p style="margin: 0;"><strong>Supplier:</strong> ${supplierName || "Unknown Supplier"}</p>
            </div>
            <a href="https://proquoment4416.builtwithrocket.new" style="display: inline-block; background: #3730a3; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 8px;">
              View Quote →
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You received this email because you have an active sourcing request on Proquoment.</p>
          </div>
        </div>
      `;
    } else if (type === "action_required") {
      subject = `Action Required — ${productName}`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #3730a3; padding: 20px 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Proquoment</h1>
          </div>
          <div style="background: #fff7f7; padding: 24px; border: 1px solid #fecaca; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #dc2626; font-size: 18px; margin-top: 0;">⚠️ Action Required</h2>
            <p style="color: #4b5563;">Your attention is needed on a sourcing request.</p>
            <div style="background: white; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Product:</strong> ${productName}</p>
              <p style="margin: 0;"><strong>Action needed:</strong> ${actionDescription || "Please review the latest update."}</p>
            </div>
            <a href="https://proquoment4416.builtwithrocket.new" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 8px;">
              Take Action →
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">You received this email because you have an active sourcing request on Proquoment.</p>
          </div>
        </div>
      `;
    } else {
      throw new Error(`Unknown email type: ${type}`);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Proquoment <noreply@proquoment.in>",
        to: [to],
        subject,
        html,
      }),
    });

    const result = await response?.json();

    if (!response?.ok) {
      throw new Error(result.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
