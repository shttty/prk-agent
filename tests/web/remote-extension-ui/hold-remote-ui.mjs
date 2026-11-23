export async function holdRemoteUi({ holdMs, signal, provider, fauxAssistantMessage, fauxToolCall }) {
  if (holdMs > 0 && !signal.aborted) {
    // Parent can open this owned Vite URL in its browser tool; no production service is involved.
    provider.setResponses(Array.from({ length: 100 }, () => (context) => {
      if (context.messages.at(-1)?.role === "toolResult") return fauxAssistantMessage("REMOTE_UI_MANUAL_DONE");
      const message = context.messages.findLast((item) => item.role === "user");
      const text = typeof message?.content === "string" ? message.content : (message?.content || []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
      const command = /^REMOTE_UI (\{.*\})$/s.exec(text);
      return command ? fauxAssistantMessage(fauxToolCall("remote_ui", JSON.parse(command[1])), { stopReason: "toolUse" }) : fauxAssistantMessage("REMOTE_UI_CONTROLLED_PROVIDER");
    }));
    await new Promise((done) => {
      const timer = setTimeout(finishHold, holdMs);
      function finishHold() { clearTimeout(timer); signal.removeEventListener("abort", finishHold); done(); }
      signal.addEventListener("abort", finishHold, { once: true });
    });
  }
}
