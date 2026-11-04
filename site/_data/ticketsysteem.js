// Where the ticket system (Supabase) can be reached. Set these in the
// Cloudflare Pages settings (docs/ticketsysteem.md):
//   FUNCTIES_URL                 https://<project-ref>.supabase.co/functions/v1
//   SUPABASE_PUBLIEKE_SLEUTEL    the "publishable" key (sb_publishable_...);
//                                public by design: it only allows logging in
// Without them, the local test environment is used (npm run db:start).
export default function () {
  const functiesUrl = (process.env.FUNCTIES_URL || "http://127.0.0.1:54321/functions/v1").replace(/\/$/, "");
  const herkomst = new URL(functiesUrl).origin;
  return {
    functiesUrl,
    herkomst,
    authUrl: `${herkomst}/auth/v1`,
    // Local default key of every Supabase CLI install (not a secret).
    publiekeSleutel: process.env.SUPABASE_PUBLIEKE_SLEUTEL || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
    evenement: process.env.EVENEMENT || "jongerenzang-2027",
  };
}
