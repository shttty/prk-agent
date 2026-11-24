import { USER_WAIT_CALLBACK } from "../../../codemode/kernel-protocol/kernel-protocol-schema.ts";

const DESCRIPTION = "Ask the user only when a material tradeoff requires their decision; otherwise pick the conservative standard choice and state it. Batch 2–5 options per question; omit 'Other'—UI has free-text and discuss-first.";

export const ASK_TOOL_METADATA = { name: USER_WAIT_CALLBACK, description: DESCRIPTION };
