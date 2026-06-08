import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WhatsAppPayload {
  phone: string;
  message: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, message } = (await req.json()) as WhatsAppPayload;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "Phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number - remove spaces, dashes, etc. Add country code if missing
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
    if (!cleanPhone.startsWith("+") && !cleanPhone.startsWith("91")) {
      // Default to India country code
      cleanPhone = "91" + cleanPhone;
    }
    if (cleanPhone.startsWith("+")) {
      cleanPhone = cleanPhone.substring(1);
    }

    // Using WhatsApp Business API (or fallback to wa.me link)
    // Option 1: If WHATSAPP_API_KEY is configured, use the official API
    const apiKey = Deno.env.get("WHATSAPP_API_KEY");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

    if (apiKey && phoneNumberId) {
      // Use WhatsApp Cloud API
      const response = await fetch(
        `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "text",
            text: { body: message },
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: "WhatsApp API error", details: result }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Option 2: Fallback - generate a wa.me link for manual sending
    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return new Response(
      JSON.stringify({
        success: true,
        method: "link",
        link: waLink,
        message: "WhatsApp API not configured. Opening WhatsApp Web link instead.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
