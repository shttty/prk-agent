import { Type } from "typebox";
import { Value } from "typebox/value";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { AgentSession, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { KernelInterruptReceipt, KernelToolResult, PythonToolClient } from "../../kernel/kernel-types.ts";
import { selectImage } from "../../kernel/cell/read-cell.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { readCellResult } from "../../sessions/history/kernel-cells/read-result.ts";
import { readCellDelivery } from "../../sessions/history/kernel-cells/read-deliveries.ts";
import type { KernelCellDelivery } from "../../sessions/history/kernel-cells/delivery-types.ts";

export const KERNEL_CELL_TOOLS = { kernel_read: true, kernel_interrupt: true } as const;
const cellId = Type.String({ minLength: 1, maxLength: 36 });
const interruptParameters = Type.Object({ cell_id: cellId, restart: Type.Optional(Type.Union([
  Type.Literal("auto"), Type.Literal("never"), Type.Literal("now"),
])) }, { additionalProperties: false });

export function registerCellTools(pi: ExtensionAPI, client: PythonToolClient, session: () => AgentSession | undefined): void {
  pi.registerTool({ name: "kernel_read", label: "Read Python cell", exposure: "model-only",
    description: "Read a yielded cell's bounded output (omit yield_s for snapshot; image_index is 1-based). Completion and checkpoints wake you automatically.",
    annotations: { readOnlyHint: true },
    parameters: Type.Object({ cell_id: cellId, yield_s: Type.Optional(Type.Number()), image_index: Type.Optional(Type.Integer({ minimum: 1 })) }, { additionalProperties: false }),
    async execute(_id, args, signal): Promise<AgentToolResult<KernelToolResult["details"] | KernelCellDelivery>> {
      if (!client.asyncExecution() && !client.getSnapshot().activeCells.some(({ cellId }) => cellId === args.cell_id)) {
        throw new WireError("NOT_FOUND", `No readable active cell ${args.cell_id} in this session.`);
      }
      const current = await client.readCell(args.cell_id, args.yield_s, args.image_index, signal);
      if (current) return current;
      if (client.asyncExecution()) {
        const manager = session()?.sessionManager;
        if (manager) {
          const result = readCellResult(manager, args.cell_id);
          if (result) return args.image_index === undefined ? result : selectImage(result, args.image_index);
          const delivery = args.image_index === undefined && readCellDelivery(manager, args.cell_id);
          if (delivery && delivery.delivery === "unknown") return {
            content: [{ type: "text", text: `Cell ${args.cell_id}: ${delivery.notice}.` }], details: delivery,
          };
        }
      }
      throw new WireError("NOT_FOUND", `No readable cell ${args.cell_id} in this session.`);
    },
  });
  pi.registerTool({ name: "kernel_interrupt", label: "Interrupt Python cell", exposure: "model-only",
    description: 'Stop a yielded cell (other cells using the same subprocess or socket may be affected). restart: "never" keeps the kernel; "auto" retires after grace; "now" retires immediately, clearing variables.',
    parameters: interruptParameters,
    prepareArguments(args) {
      if (!Value.Check(interruptParameters, args)) throw new WireError("INVALID_REQUEST", "Invalid kernel_interrupt arguments.");
      return args;
    },
    async execute(_id, { cell_id, restart }): Promise<AgentToolResult<KernelToolResult["details"] | KernelInterruptReceipt>> {
      const response = await client.requestCellInterrupt(cell_id, restart);
      if ("content" in response) return response;
      return { content: [{ type: "text", text: JSON.stringify(response) }], details: response };
    },
  });
}
