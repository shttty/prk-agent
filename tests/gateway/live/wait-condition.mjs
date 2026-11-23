const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function until(predicate, description, signal, deadline = Date.now() + 30_000) {
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    if (await predicate()) return;
    await sleep(25);
  }
  throw new Error(`Timed out: ${description}; no side effects will be replayed.`);
}
