const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = "https://cronogym.vercel.app";
const FLOWS_DIR = "C:\\Users\\yayog\\cronos-gym-dem\\public\\flows";
const AUTH_FILE = path.join(__dirname, ".auth-state.json");
const EMAIL = process.env.E2E_TEST_EMAIL || "michnsqk07@gmail.com";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "michel11cdmx";

async function smoothScroll(page, totalPx, steps = 28, stepMs = 35) {
  const delta = totalPx / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((y) => window.scrollBy(0, y), delta);
    await page.waitForTimeout(stepMs);
  }
}

async function createAuthState(browser) {
  console.log("0. Creating authenticated storageState...");
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/inicio`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);

  const emailBtn = page.getByRole("button", { name: /iniciar con correo electrónico/i });
  if (await emailBtn.isVisible().catch(() => false)) {
    await emailBtn.click();
    await page.waitForTimeout(400);
    await page.locator('input[type="email"], input[placeholder*="correo" i]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión|entrar/i }).first().click();
    await page.getByText(/cargando…/i).waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
  }

  await ctx.storageState({ path: AUTH_FILE });
  await ctx.close();
  console.log("   Auth state saved.");
}

async function recordFlow(browser, filename, fn) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    storageState: AUTH_FILE,
    recordVideo: {
      dir: FLOWS_DIR,
      size: { width: 390, height: 844 },
    },
  });
  const page = await ctx.newPage();
  const video = page.video();

  try {
    await fn(page);
  } finally {
    await ctx.close();
  }

  const rawPath = await video.path();
  const targetPath = path.join(FLOWS_DIR, filename);
  if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  fs.renameSync(rawPath, targetPath);
  console.log("   Saved", filename);
}

async function run() {
  fs.mkdirSync(FLOWS_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  await createAuthState(browser);

  // Flow 1: Command Center (Today)
  console.log("1. Recording flow1-today.webm...");
  await recordFlow(browser, "flow1-today.webm", async (page) => {
    await page.goto(`${BASE_URL}/inicio`, { waitUntil: "domcontentloaded" });
    await page.getByText(/cargando…/i).waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await smoothScroll(page, 420, 36, 40);
    await page.waitForTimeout(900);
    await smoothScroll(page, -420, 30, 35);
    await page.waitForTimeout(700);
  });

  // Flow 2: Routine Creation & 1,324+ Exercise Catalog
  console.log("2. Recording flow2-routines.webm...");
  await recordFlow(browser, "flow2-routines.webm", async (page) => {
    await page.goto(`${BASE_URL}/rutinas`, { waitUntil: "domcontentloaded" });
    await page.getByText(/cargando…/i).waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const newBtn = page.getByRole("button", { name: /nueva rutina/i }).first();
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(700);
    }

    const nameInput = page.getByPlaceholder(/nombre de la rutina/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.click();
      await nameInput.type("Push Hipertrofia", { delay: 65 });
      await page.waitForTimeout(500);
    }

    const addDayBtn = page.getByRole("button", { name: /añadir día/i }).first();
    if (await addDayBtn.isVisible().catch(() => false)) {
      await addDayBtn.click();
      await page.waitForTimeout(600);
    }

    const addExBtn = page.getByRole("button", { name: /añadir ejercicio/i }).first();
    if (await addExBtn.isVisible().catch(() => false)) {
      await addExBtn.click();
      await page.waitForTimeout(1000);
    }

    const searchInput = page.locator('input[placeholder*="buscar" i]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.click();
      await searchInput.type("Press", { delay: 80 });
      await page.waitForTimeout(900);
    }

    // Click first matching exercise to add/inspect
    const firstEx = page.getByRole("button", { name: /press/i }).first();
    if (await firstEx.isVisible().catch(() => false)) {
      await firstEx.click();
      await page.waitForTimeout(1200);
    }
    await smoothScroll(page, 220, 20, 35);
    await page.waitForTimeout(700);
  });

  // Flow 3: ActiveWorkout & Rest Timer
  console.log("3. Recording flow3-workout.webm...");
  await recordFlow(browser, "flow3-workout.webm", async (page) => {
    await page.goto(`${BASE_URL}/entrenar`, { waitUntil: "domcontentloaded" });
    await page.getByText(/cargando…/i).waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const startLive = page.getByRole("button", { name: /iniciar entrenamiento/i }).first();
    if (await startLive.isVisible().catch(() => false)) {
      await startLive.click();
      await page.waitForTimeout(1400);
    }

    // Try filling weight / reps or toggling first set checkbox
    const numInputs = page.locator('input[type="number"], input[inputmode="decimal"], input[inputmode="numeric"]');
    const count = await numInputs.count();
    if (count >= 2) {
      await numInputs.nth(0).fill("80");
      await page.waitForTimeout(350);
      await numInputs.nth(1).fill("10");
      await page.waitForTimeout(350);
    }

    const checkBtn = page.locator('button[aria-label*="completar" i], button[aria-label*="serie" i], input[type="checkbox"]').first();
    if (await checkBtn.isVisible().catch(() => false)) {
      await checkBtn.click();
      await page.waitForTimeout(1800);
    } else {
      await smoothScroll(page, 260, 24, 40);
      await page.waitForTimeout(1400);
    }
  });

  // Flow 4: Progress Analytics & Cronos IA
  console.log("4. Recording flow4-progress-ia.webm...");
  await recordFlow(browser, "flow4-progress-ia.webm", async (page) => {
    await page.goto(`${BASE_URL}/progreso`, { waitUntil: "domcontentloaded" });
    await page.getByText(/cargando…/i).waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await smoothScroll(page, 480, 32, 35);
    await page.waitForTimeout(900);

    // Open Cronos IA floating button if present
    const iaBtn = page.getByRole("button", { name: /cronos ia/i }).first();
    if (await iaBtn.isVisible().catch(() => false)) {
      await iaBtn.click();
      await page.waitForTimeout(1200);
      const chipBtn = page.getByRole("button", { name: /qué peso uso|crear rutina/i }).first();
      if (await chipBtn.isVisible().catch(() => false)) {
        await chipBtn.click();
        await page.waitForTimeout(2200);
      }
    }
  });

  await browser.close();
  if (fs.existsSync(AUTH_FILE)) fs.unlinkSync(AUTH_FILE);
  console.log("All 4 live flows recorded in", FLOWS_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
