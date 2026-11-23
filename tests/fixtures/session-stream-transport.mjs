import { createServer, request } from "node:http";

// Byte-for-byte delay/replay at the HTTP transport only; never replaces EventSource or product state.
export async function startSessionStreamTransport(apiUrl) {
  const upstream = new URL(apiUrl);
  const frames = [];
  const connections = new Set();
  const requests = new Set();
  let gate = null;
  let nextId = 0;
  const server = createServer((incoming, outgoing) => {
    const headers = { ...incoming.headers, host: upstream.host };
    if (headers.origin) headers.origin = upstream.origin;
    const forwarded = request(new URL(incoming.url, upstream), { method: incoming.method, headers }, (response) => {
      outgoing.writeHead(response.statusCode, response.headers);
      outgoing.flushHeaders();
      if (!String(response.headers["content-type"]).startsWith("text/event-stream")) {
        response.pipe(outgoing);
        return;
      }
      const worker = /^\/api\/sessions\/([^/]+)\/events(?:\?|$)/.exec(incoming.url)?.[1];
      const connection = { sessionId: worker, outgoing };
      connections.add(connection);
      outgoing.once("close", () => { connections.delete(connection); response.destroy(); });
      let pending = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        pending += chunk;
        let end;
        while ((end = pending.indexOf("\n\n")) !== -1) {
          const raw = pending.slice(0, end + 2);
          pending = pending.slice(end + 2);
          const event = /^event: (.+)$/m.exec(raw)?.[1];
          const data = /^data: (.+)$/m.exec(raw)?.[1];
          if (!event || !data) { outgoing.write(raw); continue; }
          const frame = { id: ++nextId, sessionId: worker, event, data: JSON.parse(data), raw };
          frames.push(frame);
          if (!gate?.(frame)) outgoing.write(raw);
        }
      });
      response.once("end", () => outgoing.end(pending));
      response.once("error", () => outgoing.destroy());
    });
    requests.add(forwarded);
    forwarded.once("close", () => requests.delete(forwarded));
    forwarded.once("error", () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
    outgoing.once("close", () => forwarded.destroy());
    incoming.pipe(forwarded);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    frames,
    hold(predicate) { gate = predicate; },
    release() { gate = null; },
    replay(frame, worker = frame.sessionId) {
      if (!frames.includes(frame)) throw new Error("Only an actual recorded upstream frame may be replayed");
      const current = [...connections].filter((connection) => connection.sessionId === worker && !connection.outgoing.destroyed);
      if (!current.length) throw new Error(`No real EventSource transport for ${worker}`);
      for (const connection of current) connection.outgoing.write(frame.raw);
      return current.length;
    },
    async close() {
      for (const connection of connections) connection.outgoing.destroy();
      for (const forwarded of requests) forwarded.destroy();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
