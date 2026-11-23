import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function loadFirefox() {
  if (!process.env.PI_TEST_FIREFOX) return null;
  const { firefox } = await import(pathToFileURL(resolve(process.env.PI_TEST_PLAYWRIGHT)).href);
  return firefox.launch({ channel: "moz-firefox", executablePath: process.env.PI_TEST_FIREFOX, headless: true });
}

