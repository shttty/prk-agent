async function ownedFetch(owner, url, init) {
  const abort = new AbortController();
  const caller = init?.signal ?? (url instanceof Request ? url.signal : undefined);
  const signal = caller ? AbortSignal.any([abort.signal, caller]) : abort.signal;
  const done = Promise.withResolvers();
  hold(owner, done.promise, () => abort.abort());
  try {
    const response = await fetch(url, { ...init, signal, keepalive: false });
    if (!response.body) { done.resolve(); return response; }
    const reader = response.body.getReader();
    let stopped, onAbort;
    const finish = () => {
      signal.removeEventListener("abort", onAbort);
      done.resolve();
    };
    function stop(reason) {
      return stopped ??= reader.cancel(reason).catch(() => {}).then(finish);
    }
    const body = new ReadableStream({
      start(controller) {
        onAbort = () => {
          controller.error(signal.reason);
          void stop(signal.reason);
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      },
      async pull(controller) {
        try {
          const { value, done: eof } = await reader.read();
          if (signal.aborted) return;
          if (eof) { finish(); controller.close(); }
          else controller.enqueue(value);
        } catch (error) { finish(); controller.error(error); }
      },
      cancel: stop,
    });
    return responseWithBody(response, new Response(body, response));
  } catch (error) { done.resolve(); throw error; }

  // Bound methods work with the wrapper body; metadata still comes from the original response.
  function responseWithBody(original, wrapped) {
    return new Proxy(wrapped, { get(target, key) {
      if (key === "clone") return () => responseWithBody(original, target.clone());
      if (key === "url" || key === "redirected" || key === "type" || key === "headers") return original[key];
      const value = Reflect.get(target, key, target);
      return typeof value === "function" && key !== "constructor" ? value.bind(target) : value;
    } });
  }
}
