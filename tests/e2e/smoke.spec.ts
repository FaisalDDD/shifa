import { test, expect } from "@playwright/test";

test("landing page renders the hero", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Find the medicine you need/i }),
  ).toBeVisible();
});

test("search returns a demo product", async ({ page }) => {
  await page.goto("/search?q=paracetamol");
  await expect(page.getByText("Paracetamol", { exact: false }).first()).toBeVisible();
});

test("pharmacy detail page renders", async ({ page }) => {
  await page.goto("/pharmacies/demo-apotheke-am-markt");
  await expect(page.getByText("Apotheke am Markt", { exact: false }).first()).toBeVisible();
});

test("mobile viewport has no horizontal overflow on search", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/search?q=ibuprofen");
  await expect(page.getByText("Ibuprofen", { exact: false }).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
