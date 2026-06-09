const appUrl = Deno.env.get("APP_URL");
const secret = Deno.env.get("SUPABASE_SECRET_KEY");

Deno.serve(async () => {
  if (!appUrl || !secret) {
    return new Response("Missing worker configuration.", { status: 500 });
  }

  const response = await fetch(new URL("/api/internal/process-jobs", appUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
});
