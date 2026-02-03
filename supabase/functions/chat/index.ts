import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = language === 'hi' 
      ? `आप GovCare अस्पताल का AI सहायक हैं। आप मरीजों की मदद करते हैं:
- अपॉइंटमेंट बुक करना
- टोकन/क्यू स्टेटस देखना
- अस्पताल के समय और सेवाओं की जानकारी
- विभागों और डॉक्टरों की जानकारी

अस्पताल का समय: सोम-शनि, सुबह 9 बजे से शाम 5 बजे तक। इमरजेंसी 24/7 उपलब्ध है।
संक्षिप्त और सहायक उत्तर दें।`
      : `You are the GovCare Hospital AI Assistant. Help patients with:
- Booking appointments (direct them to /book-appointment)
- Checking queue/token status (direct to /queue-status)
- Hospital timings and services information
- Department and doctor information

Hospital hours: Mon-Sat, 9 AM - 5 PM. Emergency services available 24/7.
OPD departments: General Medicine, Pediatrics, Orthopedics, Cardiology, Dermatology, ENT, Ophthalmology, Gynecology, Neurology, Dental.

Keep responses concise and helpful. For appointment booking, guide users to use the booking feature in the app.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
