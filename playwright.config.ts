import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";
import { hashSync } from "bcryptjs";

const baseURL = "http://localhost:3000";
const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const parsedSupabaseUrl = configuredSupabaseUrl
  ? new URL(configuredSupabaseUrl)
  : null;
const projectRef = parsedSupabaseUrl?.hostname.startsWith("db.")
  ? parsedSupabaseUrl.hostname.split(".")[1]
  : null;
const supabaseUrl = projectRef
  ? `https://${projectRef}.supabase.co`
  : configuredSupabaseUrl;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      APP_URL: baseURL,
      APP_PASSWORD_HASH: hashSync("e2e-password", 4).replaceAll("$", "\\$"),
      SESSION_SECRET: "e".repeat(32),
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      ASSEMBLYAI_WEBHOOK_SECRET: "e2e-assembly-webhook-secret",
      JOB_WORKER_SECRET: "e2e-job-worker-secret-value-0001",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
