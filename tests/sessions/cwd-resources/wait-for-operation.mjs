export async function waitForOperation(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 30000);
    })]);
  } finally { clearTimeout(timer); }
}
