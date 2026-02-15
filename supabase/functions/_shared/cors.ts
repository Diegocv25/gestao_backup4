// Minimal CORS helper for Supabase Edge Functions (Deno)

export type CorsOptions = {
  allowCredentials?: boolean;
  allowMethods?: string[];
  allowHeaders?: string[];
  denyMode?: "strict" | "fallback-null";
};

function parseAllowedOrigins(csv?: string): string[] {
  return (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string, allowed: string[]): boolean {
  return allowed.includes(origin);
}

export function buildCorsHeaders(req: Request, opts: CorsOptions = {}) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = parseAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));

  const allowCredentials = opts.allowCredentials ?? true;
  const allowMethods = opts.allowMethods ?? ["GET", "POST", "OPTIONS"];
  const allowHeaders = opts.allowHeaders ?? [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-supabase-client-platform",
    "x-supabase-client-platform-version",
    "x-supabase-client-runtime",
    "x-supabase-client-runtime-version",
    "x-portal-session",
  ];

  const ok = Boolean(origin) && isAllowedOrigin(origin, allowed);

  const denyMode = opts.denyMode ?? "strict";
  const allowOriginHeader = ok
    ? origin
    : (denyMode === "fallback-null" ? "null" : "");

  const base: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": allowMethods.join(","),
    "Access-Control-Allow-Headers": allowHeaders.join(","),
  };

  if (allowCredentials) base["Access-Control-Allow-Credentials"] = "true";
  if (allowOriginHeader) base["Access-Control-Allow-Origin"] = allowOriginHeader;

  return { headers: base, originAllowed: ok, origin };
}
