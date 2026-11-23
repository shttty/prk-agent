export default function remoteProviderPolicy(pi) {
  let hooks = 0;
  const providers = () => {
    for (const id of ["gateway-owned", "unowned"]) {
      pi.registerProvider(id, {
        api: "openai-completions", models: [],
        streamSimple() { throw new Error("Provider stream must never execute or cross the target boundary"); },
      });
      pi.unregisterProvider(id);
    }
  };
  providers();
  pi.registerCommand("provider_policy_command", { description: "Retained provider policy command", handler: async () => { hooks += 100; } });
  pi.on("session_start", () => { hooks++; providers(); });
  pi.registerTool({
    name: "remote_provider_policy", label: "Provider policy", description: "Observe retained target registrations",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      providers();
      return { content: [{ type: "text", text: "REMOTE_PROVIDER_POLICY_TOOL" }], details: { hooks, pid: process.pid } };
    },
  });
}
