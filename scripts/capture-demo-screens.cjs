const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "https://cronogym.vercel.app";
const OUT_DIR = "C:\\Users\\yayog\\cronos-gym-dem\\public\\screens";
const EMAIL = process.env.E2E_TEST_EMAIL || "michnsqk07@gmail.com";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "michel11cdmx";

async function waitQuiet(page, ms = 1400) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/inicio`, { waitUntil: "domcontentloaded" });
  await waitQuiet(page, 1600);

  const emailBtn = page.getByRole("button", { name: /iniciar con correo electrónico/i });
  if (await emailBtn.isVisible().catch(() => false)) {
    await emailBtn.click();
    await page.waitForTimeout(400);
    await page.locator('input[type="email"], input[placeholder*="correo" i]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión|entrar/i }).first().click();
    await page.getByText(/cargando…/i).waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
    await waitQuiet(page, 2000);
  }

  // Click "Iniciar entreno" on /inicio
  const startBtn = page.getByRole("button", { name: /iniciar entreno/i }).first();
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click();
    await waitQuiet(page, 2200);
  }

  // If still on /entrenar preview, click "Iniciar Entrenamiento"
  const startLive = page.getByRole("button", { name: /iniciar entrenamiento/i }).first();
  if (await startLive.isVisible().catch(() => false)) {
    await startLive.click();
    await waitQuiet(page, 2200);
  }

  console.log("Captured workout-live.png from", page.url());
  await page.screenshot({ path: path.join(OUT_DIR, "workout-live.png") });
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
