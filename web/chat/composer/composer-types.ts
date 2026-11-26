import type { Dispatch, SetStateAction } from "react";
import type { ChatAttachment, ChatReference } from "../thread/chat-state-types.ts";

// Shapes the composer reads from the native catalog (the Gateway's capability list) and its own menus.
export type CommandArgument = { name: string; required?: boolean; description?: string; candidates?: { value: string; available?: boolean }[] };
export type NativeCommand = { name: string; description?: string; source?: string; hidden?: boolean; availability?: { enabled?: boolean }; arguments?: CommandArgument[] };
export type CommandHelp = { usage: string[]; body: string[]; notes: string[] };
/** A command as the "/" menu lists it. */
export type ComposerCommand = NativeCommand & { summary: string; help: CommandHelp | null | undefined; prefix?: string };
export type AttachmentLimits = {
  enabled?: boolean; maxItems?: number; maxDecodedBytesTotal?: number; maxDecodedBytesPerItem?: number; maxItemBytes?: number;
  maxAugmentedMessageBytes?: number; imageMimeTypes?: string[]; textMimeTypes?: string[];
};
export type CatalogModel = { value: string; label: string; provider: string; thinkingLevels?: string[] };
export type NativeCatalogValue = { commands?: NativeCommand[]; actions?: { name: string; enabled?: boolean }[]; attachments?: AttachmentLimits };
export type ExtensionCompletionItem = { value: string; label?: string; description?: string };
export type ExtensionCompletion = { prefix: string; items?: ExtensionCompletionItem[] };
export type QueueMode = "steer" | "followUp";
export type ReferenceCandidateView = ChatReference & { navigable?: boolean; selectable?: boolean };
export type Setter<T> = Dispatch<SetStateAction<T>>;
export type { ChatAttachment, ChatReference };
