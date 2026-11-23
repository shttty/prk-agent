async function readControl() {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let line = "";
  let bytes = 0;
  let lastId = 0;
  for await (const chunk of createReadStream(null, { fd: input, highWaterMark: 64 * 1024 })) {
    for (let start = 0; start < chunk.length;) {
      const newline = chunk.indexOf(10, start);
      const end = newline < 0 ? chunk.length : newline + 1;
      bytes += end - start;
      if (bytes > maxFrameBytes) throw new Error("Bun command exceeds process frame budget.");
      line += decoder.decode(chunk.subarray(start, end), { stream: newline < 0 });
      start = end;
      if (newline < 0) continue;
      const message = JSON.parse(line);
      line = "";
      bytes = 0;
      if (!message || message.generation !== generation || typeof message.cellId !== "string" || !message.cellId
          || !Number.isSafeInteger(message.id) || message.id <= lastId) throw new Error("Invalid Bun command identity.");
      lastId = message.id;
      dispatch(message);
    }
  }
  if (bytes) throw new Error("Unterminated Bun command.");
}

function dispatch({ kind, generation: _, cellId, id, ...payload }) {
  const ack = () => emit({ kind: "ack", cellId, re: id });
  const reject = (code) => emit({ kind: "rejected", cellId, re: id, code });
  const count = Object.keys(payload).length;
  if (kind === "cancel" && count === 0) {
    cancel(live.get(cellId));
    ack();
  } else if (kind === "callback_reply_chunk" && count === 3 && Number.isSafeInteger(payload.requestId) && payload.requestId > 0
      && typeof payload.final === "boolean" && typeof payload.data === "string" && payload.data.length <= 4 * Math.ceil(blockBytes / 3)
      && payload.data.length % 4 === 0 && !/[^A-Za-z0-9+/=]|=[^=]|={3}/u.test(payload.data)) {
    receiveReply(live.get(cellId), payload);
    ack();
  } else if (kind === "execute" && count === 2 && typeof payload.code === "string" && typeof payload.title === "string") {
    if (live.size >= maxActiveCells || live.has(cellId)) reject("BUSY");
    else void executeCell({ cellId, id, code: payload.code });
  } else if ((kind === "clear" && count === 0) || (kind === "delete" && count === 1 && typeof payload.name === "string")) {
    if (live.size) reject("BUSY");
    else maintainGlobals({ kind, name: payload.name, cellId, id });
  } else if (kind === "library" && count === 1 && Array.isArray(payload.entries)) reject("UNSUPPORTED");
  else throw new Error("Invalid or unsupported Bun command.");
}
