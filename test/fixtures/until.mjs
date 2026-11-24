import { setTimeout as delay } from "node:timers/promises";

export async function until(read, description, timeout = 15_000) {
  const deadline = performance.now() + timeout;
  do {
    const value = await read();
    if (value) return value;
    await delay(25);
  } while (performance.now() < deadline);
  throw new Error(`Timed out after ${timeout} ms: ${description}`);
}
