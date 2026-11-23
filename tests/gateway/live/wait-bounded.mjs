
export async function bounded(promise, description, ms = 30_000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out: ${description}`)), ms);
  })]); } finally { clearTimeout(timer); }
}
