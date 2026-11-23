export default function activate(pi) {
  pi.registerTool({ name: "plugstart_load_error_sibling", label: "Broken package sibling", description: "Must not be published independently of its package.",
    parameters: { type: "object", properties: {} },
    async execute() { throw new Error("This tool must not execute"); },
  });
}
