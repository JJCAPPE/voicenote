const appUrl = Deno.env.get("APP_URL");
const secret = Deno.env.get("JOB_WORKER_SECRET");

Deno.serve(async (request) => {
  if (!appUrl || !secret) {
    return new Response("Missing worker configuration.", { status: 500 });
  }

  const body = await request.text();
  const response = await fetch(new URL("/api/internal/process-jobs", appUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: body || JSON.stringify({ limit: 5 }),
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
});
