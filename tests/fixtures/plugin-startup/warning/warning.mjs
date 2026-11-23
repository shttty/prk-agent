export default function activate(pi) {
  pi.registerTool({ name: "plugstart_warning", label: "Warning fixture", description: "Available despite a startup warning.",
    parameters: { type: "object", properties: {} },
    async execute() { return { content: [{ type: "text", text: "warning fixture ran" }], details: {} }; },
  });
  pi.on("session_start", async (_event, ctx) => {
    await Promise.resolve();
    ctx.ui.notify("Startup warning from fixture A", "warning");
  });
}
