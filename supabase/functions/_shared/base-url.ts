// Minimal helper (Deno Edge Functions)
export type AppEnv = "landing" | "auth" | "app";

export function getBaseUrl(kind: AppEnv): string {
  const app = Deno.env.get("APP_BASE_URL")?.trim();
  const landing = Deno.env.get("LANDING_BASE_URL")?.trim();
  const auth = Deno.env.get("AUTH_BASE_URL")?.trim();
  const nodeEnv = Deno.env.get("NODE_ENV")?.trim().toLowerCase();

  if (kind === "landing" && landing) return landing;
  if (kind === "auth" && auth) return auth;
  if (app) return app;

  if (nodeEnv == "development") {
    if (kind === "landing") return "http://localhost:8080";
    if (kind === "auth") return "http://localhost:8081";
    return "http://localhost:8080";
  }

  throw new Error(
    `Missing base URL env for kind=${kind}. Configure APP_BASE_URL/LANDING_BASE_URL/AUTH_BASE_URL`,
  );
}
