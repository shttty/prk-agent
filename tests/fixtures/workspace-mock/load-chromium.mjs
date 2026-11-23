import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function loadChromium() {
  for (const name of ["PI_TEST_PLAYWRIGHT", "PI_TEST_CHROMIUM"]) if (!process.env[name]) throw new Error(`${name} is required for browser tests`);
  const { chromium } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  return chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, headless: true, args: ["--no-sandbox"] });
}

