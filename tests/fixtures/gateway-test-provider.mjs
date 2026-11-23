// Controlled public SDK provider, loaded only by explicit test --extension.
// The Gateway, its SDK worker sessions, the transport and Python execution are
// real; only the model responses are controlled. Every session the Gateway owns
// is a worker session with the unified kernel_code tool; the message body is
// the target Python code to execute.
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";

export default function register(pi) {
  const provider = fauxProvider({ provider: "gateway-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
  const response = (context) => {
    const last = context.messages.at(-1);
    if (last.role === "toolResult") return fauxAssistantMessage("Controlled tool completed.");
    const text = typeof last.content === "string" ? last.content : last.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    return fauxAssistantMessage(fauxToolCall("kernel_code", { code: text }), { stopReason: "toolUse" });
  };
  provider.setResponses(Array.from({ length: 100 }, () => response));
  pi.registerProvider(provider.provider);
}
