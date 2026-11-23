export function observeMarker(stream, marker, timeoutMs, phase) {
  let pending = Buffer.alloc(0);
  let timer;
  let data;
  let ended;
  const { promise, resolve, reject } = Promise.withResolvers();
  const finish = (error, value) => {
    clearTimeout(timer);
    stream.off("data", data);
    stream.off("end", ended);
    error ? reject(error) : resolve(value);
  };
  data = (chunk) => {
    if (pending.length + chunk.length > 1024 * 1024) {
      finish(new Error(`${phase}: output exceeds 1 MiB`));
      return;
    }
    pending = Buffer.concat([pending, chunk]);
    const index = pending.indexOf(marker);
    if (index >= 0) finish(undefined, pending.subarray(0, index));
  };
  ended = () => finish(new Error(`${phase}: stdout EOF`));
  stream.on("data", data);
  stream.once("end", ended);
  timer = setTimeout(() => finish(Object.assign(new Error(`${phase}: timeout ${timeoutMs} ms`), { code: "ETIMEDOUT" })), timeoutMs);
  // A child can fail while its script is still being written.
  promise.catch(() => {});
  return promise;
}
