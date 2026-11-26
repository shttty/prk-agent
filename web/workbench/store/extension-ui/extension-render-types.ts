import type { HostedExtensionUiSnapshot, HostedNode } from "../../../src/gateway/wire/web-types.ts";
import type { ExtensionMessageRender, ExtensionRenderEntry } from "../conversation/conversation-types.ts";

type SnapshotPrompt = HostedExtensionUiSnapshot["prompts"][number];

/** A plugin tool row's rendering; `shell` says who draws the frame around it. */
export type ExtensionToolRender = { shell?: "default" | "self"; call?: HostedNode; result?: HostedNode };
export type ExtensionWidget = { key: string; placement: string; node?: HostedNode };
export type OverlayOptions = NonNullable<SnapshotPrompt["overlay"]> & { focus?: boolean };
/** A secondary overlay a custom component opened over its prompt. */
export type ExtensionOverlay = { id: string; options?: OverlayOptions; hidden?: boolean; focused?: boolean; node?: HostedNode };
/** A prompt as the tray draws it: the snapshot's data, plus the rendered component once the Gateway sent one. */
export type ExtensionPrompt = Omit<SnapshotPrompt, "overlay"> & {
  overlay?: OverlayOptions; node?: HostedNode; overlays?: ExtensionOverlay[]; parentId?: string; focus?: boolean; visible?: boolean;
};

/** The Gateway's last component render for this client (`session.extensionUiRender`). */
export type ExtensionRender = {
  revision?: number;
  header?: HostedNode;
  footer?: HostedNode;
  widgets?: ExtensionWidget[];
  prompts?: ExtensionPrompt[];
  status?: readonly { key: string; text: string }[];
  rendererErrors?: { id: string; message: string }[];
  editor?: HostedExtensionUiSnapshot["editor"];
  tools?: Record<string, ExtensionToolRender | undefined>;
  toolErrors?: Record<string, { call?: string; result?: string } | undefined>;
  toolsExpanded?: boolean;
  entries?: readonly ExtensionRenderEntry[];
  messages?: Record<string, ExtensionMessageRender | undefined>;
  streaming?: { operationId?: string; text?: string };
  hiddenThinkingLabel?: string;
};

/** Sends a plugin UI action to the Gateway; resolves whether it was accepted. */
export type ExtensionAction = (args: Record<string, unknown>) => Promise<unknown>;
