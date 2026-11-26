import { createServer, request as forward } from "node:http";

/**
 * Minimal HTTP proxy on 127.0.0.1 that records and forwards absolute-URI requests. undici tunnels
 * only https:// targets through CONNECT; http:// targets use this forwarding form.
 */
export async function startHttpProxy(t) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ target: request.url, authorization: request.headers["proxy-authorization"] });
    const { ["proxy-authorization"]: _, ...headers } = request.headers;
    const upstream = forward(request.url, { method: request.method, headers }, (reply) => {
      response.writeHead(reply.statusCode, reply.headers);
      reply.pipe(response);
    });
    upstream.on("error", () => response.destroy());
    request.pipe(upstream);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return { origin: `http://127.0.0.1:${server.address().port}`, requests };
}
