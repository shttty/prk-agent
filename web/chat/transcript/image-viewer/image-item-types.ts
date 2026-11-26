import type { KernelCellDelivery } from "../../../../src/gateway/wire/web-types.ts";
import type { ToolCallPart } from "../../conversation/conversation-types.ts";

// One image of the conversation, as the lightbox walks them: what to show and where its bytes come from.
type ImageBase = { key: string; messageId: string; label: string };
export type ImageItem =
  | (ImageBase & { kind: "attachment"; messageNumber: number; index: number; src: string })
  | (ImageBase & { kind: "artifact"; path: string; src?: undefined })
  | (ImageBase & { kind: "markdown"; path: string; src?: undefined })
  | (ImageBase & { kind: "kernel"; toolCallId: string; cell: KernelCellDelivery; index: number; src?: undefined })
  | (ImageBase & { kind: "tool"; toolCallId: string; toolName: string; index: number; src: string | undefined; metadata: ToolCallPart["metadata"] });
