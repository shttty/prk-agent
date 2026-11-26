import { createServer } from "node:http";

/** OpenAI Chat Completions endpoint on 127.0.0.1 that streams a fixed reply, counts requests and keeps what it was sent. */
export async function startCompletionsEndpoint(t, reply = "Endpoint reply.") {
  const requests = [];
  const bodies = [];
  const apiKey = "sk-fixture-secret";
  const server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk)).on("end", () => {
      bodies.push(JSON.parse(Buffer.concat(chunks).toString() || "null"));
      const chunk = (delta, finish) => `data: ${JSON.stringify({ id: "c", object: "chat.completion.chunk", created: 0, model: "relay", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(`${chunk({ role: "assistant", content: reply }, null)}${chunk({}, "stop")}data: [DONE]\n\n`);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, apiKey, requests, bodies };
}
