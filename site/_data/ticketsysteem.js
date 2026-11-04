// Where the ticket system (Supabase edge functions) can be reached.
// Set FUNCTIES_URL in the Cloudflare Pages settings, for example
// https://abcdefgh.supabase.co/functions/v1 . Without it, the local test
// environment is used (npx supabase start).
export default function () {
  const functiesUrl = (process.env.FUNCTIES_URL || "http://127.0.0.1:54321/functions/v1").replace(/\/$/, "");
  return {
    functiesUrl,
    herkomst: new URL(functiesUrl).origin,
    evenement: process.env.EVENEMENT || "jongerenzang-2027",
  };
}
