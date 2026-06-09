import { expect, test } from "@playwright/test";

import { admin } from "./helpers";

test("login success/failure, route protection, and note CRUD", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid credentials.")).toBeVisible();

  await page.getByLabel("Password").fill("e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const title = `E2E CRUD ${crypto.randomUUID()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Created through the dashboard");
  await page.getByLabel("Type").selectOption("project");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/);

  const noteId = page.url().split("/").at(-1);
  expect(noteId).toBeTruthy();

  const details = page
    .getByRole("heading", { name: "Note details" })
    .locator("..");
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
