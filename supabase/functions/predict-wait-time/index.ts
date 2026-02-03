import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { doctor_id, appointment_date, slot_time, is_emergency } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get doctor's avg consultation time
    const { data: doctor } = await supabase
      .from("doctors")
      .select("avg_consultation_time")
      .eq("id", doctor_id)
      .single();

    const avgTime = doctor?.avg_consultation_time || 15;

    // Get queue length for that doctor on that date
    const { count: queueLength } = await supabase
      .from("queue_tokens")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctor_id)
      .eq("queue_date", appointment_date)
      .eq("status", "waiting");

    // Simple prediction: position in queue * avg consultation time
    // Emergency patients get priority (reduce by 50%)
    let predictedWaitTime = (queueLength || 0) * avgTime;
    
    if (is_emergency) {
      predictedWaitTime = Math.round(predictedWaitTime * 0.3);
    }

    // Add some variance based on time of day
    const hour = parseInt(slot_time?.split(":")[0] || "10");
    if (hour >= 10 && hour <= 12) {
      predictedWaitTime = Math.round(predictedWaitTime * 1.2); // Peak hours
    } else if (hour >= 14 && hour <= 15) {
      predictedWaitTime = Math.round(predictedWaitTime * 0.9); // Post-lunch lull
    }

    return new Response(
      JSON.stringify({ 
        predicted_wait_time: Math.max(5, predictedWaitTime),
        queue_length: queueLength || 0,
        avg_consultation_time: avgTime
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Prediction error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, predicted_wait_time: 15 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
