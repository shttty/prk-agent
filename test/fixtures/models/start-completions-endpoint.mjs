import { createServer } from "node:http";

/** OpenAI Chat Completions endpoint on 127.0.0.1 that streams a fixed reply and counts requests. */
export async function startCompletionsEndpoint(t, reply = "Endpoint reply.") {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    request.resume().on("end", () => {
      const chunk = (delta, finish) => `data: ${JSON.stringify({ id: "c", object: "chat.completion.chunk", created: 0, model: "relay", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(`${chunk({ role: "assistant", content: reply }, null)}${chunk({}, "stop")}data: [DONE]\n\n`);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, requests };
}
