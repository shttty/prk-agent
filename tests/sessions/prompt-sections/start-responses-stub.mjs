import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

export async function startResponsesStub() {
  const requests = [], wireRequests = [], failures = [];
  // Pi 1.4.0's native faux never calls onPayload. This approved HTTP fixture leaves
  // Pi's original openai-responses serialization and public request hook intact.
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/v1/responses");
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString("utf8");
      wireRequests.push(body);
      const payload = JSON.parse(body);
      requests.push(payload);
      const last = payload.input.at(-1);
      const text = last?.role === "user" ? last.content.map((part) => part.text ?? "").join("\n") : "";
      const command = /^PROMPT_OPERATION (\{.*\})$/su.exec(text);
      const id = randomUUID().replaceAll("-", "");
      const item = command ? (() => {
        const { tool, args } = JSON.parse(command[1]);
        return { type: "function_call", id: `fc_${id}`, call_id: `call_${id}`, name: tool, arguments: JSON.stringify(args), status: "completed" };
      })() : {
        type: "message", id: `msg_${id}`, role: "assistant", status: "completed",
        content: [{ type: "output_text", text: "Prompt request observed; awaiting explicit instructions.", annotations: [] }],
      };
      const events = [
        { type: "response.created", response: { id: `resp_${id}`, status: "in_progress", output: [] } },
        { type: "response.output_item.added", output_index: 0, item: { ...item, ...(command ? { arguments: "" } : { content: [] }) } },
        { type: "response.output_item.done", output_index: 0, item },
        { type: "response.completed", response: { id: `resp_${id}`, status: "completed", output: [item],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } },
      ];
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const event of events) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      response.end();
    } catch (error) {
      failures.push(error);
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: error.message } }));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { url: `http://127.0.0.1:${server.address().port}/v1`, requests, wireRequests, failures,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}
