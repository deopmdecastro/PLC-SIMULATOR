import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface PLCRow {
  id: number;
  run: boolean;
  sf: boolean;
  bf: boolean;
  inputs: { bits: boolean[] };
  outputs: { bits: boolean[] };
  memory_bits: Record<string, boolean>;
  mw100: number;
  cycles: number;
  auto_mode: boolean;
  start_pressed: boolean;
  stop_held: boolean;
  latch: boolean;
  relay_k1: boolean;
  relay_k2: boolean;
  source: string;
  updated_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1\/tia-bridge\/?/, "");

  try {
    // GET /state — read current PLC state (TIA Portal polls this)
    if ((req.method === "GET" || req.method === "POST") && (path === "state" || path === "")) {
      const { data, error } = await supabase
        .from("plc_state")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify(data ?? {}),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // PUT /state — write PLC state from TIA Portal
    if (req.method === "PUT" || req.method === "POST") {
      if (path === "update" || path === "write" || path === "state") {
        const body = await req.json();
        const update: Partial<PLCRow> = {
          source: "tia-portal",
          updated_at: new Date().toISOString(),
        };

        const allowedKeys: (keyof PLCRow)[] = [
          "run", "sf", "bf", "inputs", "outputs", "memory_bits",
          "mw100", "cycles", "auto_mode", "start_pressed", "stop_held",
          "latch", "relay_k1", "relay_k2",
        ];

        for (const key of allowedKeys) {
          if (key in body) {
            // @ts-expect-error dynamic assignment
            update[key] = body[key];
          }
        }

        const { error } = await supabase
          .from("plc_state")
          .update(update)
          .eq("id", 1);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Log the event
        await supabase.from("plc_events").insert({
          event_type: "state_change",
          source: "tia-portal",
          payload: body,
        });

        return new Response(
          JSON.stringify({ success: true, message: "PLC state updated by TIA Portal" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // GET /events — read recent event log
    if (req.method === "GET" && path === "events") {
      const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
      const { data, error } = await supabase
        .from("plc_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify(data ?? []),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // GET /health — connection check
    if (req.method === "GET" && path === "health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "tia-bridge", timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Not found",
        endpoints: {
          "GET /state": "Read current PLC state",
          "PUT /update": "Write PLC state from TIA Portal",
          "GET /events?limit=20": "Read recent event log",
          "GET /health": "Health check",
        },
      }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
