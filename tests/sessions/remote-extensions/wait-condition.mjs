const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const until = async (read, predicate, timeout = 20000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await read(); if (predicate(value)) return value; await delay(20); }
  throw new Error("Remote extension acceptance condition timed out");
};
