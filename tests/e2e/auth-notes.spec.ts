import { expect, test } from "@playwright/test";

import { admin } from "./helpers";

test("login success/failure, route protection, and note CRUD", async ({
  page,
}) => {
  const dashboardRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/dashboard") {
      dashboardRequests.push(request.resourceType());
    }
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid credentials.")).toBeVisible();

  dashboardRequests.length = 0;
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForTimeout(1_000);
  expect(dashboardRequests).toEqual([]);
  await page.keyboard.press("Control+/");
  await expect(
    page.getByRole("heading", { name: "Keyboard shortcuts" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const title = `E2E CRUD ${crypto.randomUUID()}`;
  await page.getByRole("button", { name: "Create note" }).click();
  const createDialog = page.locator("dialog[open]");
  await createDialog.getByLabel("Title", { exact: true }).fill(title);
  await createDialog
    .getByLabel("Description", { exact: true })
    .fill("Created through the dashboard");
  await createDialog
    .getByRole("combobox", { name: "Type" })
    .selectOption("project");
  await createDialog.getByRole("button", { name: "Save note" }).click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/);

  const noteId = page.url().split("/").at(-1);
  expect(noteId).toBeTruthy();

  await page.getByText("Edit details", { exact: true }).click();
  const details = page.locator(".note-settings");
  await details.getByLabel("Title").fill(`${title} updated`);
  await details.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `${title} updated`,
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const { data } = await admin
    .from("notes")
    .select("id")
    .eq("id", noteId!)
    .maybeSingle();
  expect(data).toBeNull();
});

test("quick capture creates an untitled note and starts recording", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}
      start() {}
      stop() {
        this.ondataavailable?.({
          data: new Blob(["audio"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() {} }],
        }),
      },
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });
  });

  await page.goto("/login");
  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Record new note" }).click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/);
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Untitled recording" })).toBeVisible();

  const noteId = page.url().split("/").at(-1);
  expect(noteId).toBeTruthy();
  if (noteId) {
    const { error } = await admin.from("notes").delete().eq("id", noteId);
    if (error) throw error;
  }
});
