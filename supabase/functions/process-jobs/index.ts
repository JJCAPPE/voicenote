const appUrl = Deno.env.get("APP_URL");
const secret = Deno.env.get("JOB_WORKER_SECRET");

async function processJobs(body: string): Promise<void> {
  const response = await fetch(new URL("/api/internal/process-jobs", appUrl!), {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: body || JSON.stringify({ limit: 5 }),
  });

  if (!response.ok) {
    console.error("Job processing request failed.", response.status);
  }
}

Deno.serve(async (request) => {
  if (!appUrl || !secret) {
    return new Response("Missing worker configuration.", { status: 500 });
  }

  const body = await request.text();
  EdgeRuntime.waitUntil(processJobs(body));
  return Response.json(
    { accepted: true },
    {
      status: 202,
    },
  );
});
