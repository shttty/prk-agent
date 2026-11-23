export async function boundLiveOperation(promise, description, ms = 60000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${description}; nothing was replayed.`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}
