import "@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ALLOWED_ORIGINS = [
  "https://matchmakersusa.com",
  "https://www.matchmakersusa.com",
  "http://localhost:3000",
  "http://localhost:8000",
  "http://127.0.0.1:5500",
];

// Rate limiting: track messages per session
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const DAILY_LIMIT = 50;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 40;

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-session-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function checkRateLimit(sessionId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimits.get(sessionId);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(sessionId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers = corsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers,
    });
  }

  try {
    const body = await req.json();
    const { messages, system } = body;
    const sessionId = req.headers.get("x-session-id") || "anonymous";

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
        headers,
      });
    }

    // Rate limit check
    const rateCheck = checkRateLimit(sessionId);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Daily message limit reached. You can send up to 50 messages per day. Your limit resets in 24 hours.",
          limit_reached: true,
        }),
        { status: 429, headers }
      );
    }

    // Truncate message history to prevent abuse
    const trimmedMessages = messages.slice(-MAX_HISTORY_LENGTH).map(
      (msg: { role: string; content: string }) => ({
        role: msg.role,
        content:
          typeof msg.content === "string"
            ? msg.content.slice(0, MAX_MESSAGE_LENGTH)
            : msg.content,
      })
    );

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: system || "",
        messages: trimmedMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }),
        { status: 502, headers }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        content: data.content,
        remaining_messages: rateCheck.remaining,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers }
    );
  }
});
