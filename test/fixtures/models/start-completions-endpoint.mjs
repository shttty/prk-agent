import { createServer } from "node:http";

/** OpenAI Chat Completions endpoint on 127.0.0.1 that streams a reply, counts requests and keeps what it was sent. `reply` is a string, or a function of the request body returning a string or `{ name, args }` for a tool call. */
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
      const answer = typeof reply === "function" ? reply(bodies.at(-1)) : reply;
      const call = typeof answer === "string" ? undefined : [{ index: 0, id: "call_1", type: "function", function: { name: answer.name, arguments: JSON.stringify(answer.args) } }];
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(`${chunk({ role: "assistant", ...(call ? { tool_calls: call } : { content: answer }) }, null)}${chunk({}, call ? "tool_calls" : "stop")}data: [DONE]\n\n`);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, apiKey, requests, bodies };
}
