/** What the last provider requests of one session runtime looked like; memory only, never persisted. */

/** The model fields of the request that the projection needs. */
export interface RequestModel { readonly provider: string; readonly id: string; readonly api: string }
export type RequestShape = "chat" | "responses" | "anthropic" | "google" | "bedrock";

/** What the projection reads out of one provider payload; `null` marks a field the payload does not hold in a known place. */
export interface RequestFields {
  readonly system: string | null;
  readonly tools: readonly { name: string; description: string; parameters: unknown; declaration: unknown }[] | null;
  /** Conversation entries without the leading system or developer entry. */
  readonly messages: readonly unknown[] | null;
}

export interface SizedTool { readonly name: string; readonly descriptionChars: number; readonly parametersChars: number }
export interface SizedSection { readonly key: string; readonly chars: number }
/** A section's place in `system.text`: it spans `start` to `start + chars`. */
export interface PlacedSection extends SizedSection { readonly start: number }

export interface CapturedRequest {
  /** This request's place among every request the runtime has sent, identical replays included; counted from 1. */
  readonly seq: number;
  readonly at: string;
  readonly provider: string;
  readonly model: string;
  readonly api: string;
  /** `null`: the API's payload shape is not projected, so only its size and top-level key names are known. */
  readonly shape: RequestShape | null;
  readonly payloadKeys: readonly string[];
  readonly payloadChars: number;
  readonly system: {
    readonly text: string;
    readonly chars: number;
    /** Present only when the payload's system text equals the text rendered from the same turn's `context_with_system` result. */
    readonly sections: { readonly baseChars: number; readonly entries: readonly PlacedSection[] } | null;
  } | null;
  readonly tools: readonly SizedTool[] | null;
  /** Conversation entries after the leading system prompt. */
  readonly messages: { readonly count: number; readonly chars: number } | null;
  /** Identical requests seen since this one (cache-warming replays, retries); they do not displace it. */
  repeats: number;
}

/** Hashes that let two requests be compared without keeping their bodies. */
export interface RequestDigest {
  readonly system: string | null;
  readonly sections: Readonly<Record<string, string>> | null;
  readonly tools: Readonly<Record<string, string>> | null;
  readonly toolOrder: readonly string[];
  readonly messages: readonly string[] | null;
}

export interface RecordedRequest {
  readonly request: CapturedRequest;
  readonly digest: RequestDigest;
  /** The conversation entries of `payload`, for the next request's comparison. */
  readonly bodies: readonly unknown[] | null;
  /** The provider payload as sent, minus base64 media (see `redactImages`); headers, keys and URL never reach this code. */
  readonly payload: unknown;
}

/** The latest request's whole body, as the read endpoints serve it. */
export interface CapturedBody { readonly seq: number; readonly at: string; readonly shape: RequestShape | null; readonly payload: unknown }

/** A message of the request without its text: kinds of block, size, cache marker, and whether it starts a user turn (a user input, not a tool result). */
export interface MessageOutline { readonly role: string; readonly kinds: readonly string[]; readonly chars: number; readonly cache: boolean; readonly turn: boolean }

export interface PromptToolsPart { readonly seq: number; readonly at: string; readonly shape: RequestShape | null; readonly tools: readonly { readonly name: string; readonly exposure: string | null; readonly declaration: unknown }[] }
export interface PromptMessagesPart {
  readonly seq: number; readonly at: string; readonly shape: RequestShape | null;
  readonly total: number; readonly offset: number;
  /** First message of the last user turn; `null` when no message is a user input. */
  readonly turnStart: number | null;
  readonly messages: readonly unknown[]; readonly outline: readonly MessageOutline[];
}

export interface Change { readonly key: string; readonly before: number; readonly after: number }
export interface Delta {
  readonly added: readonly SizedSection[];
  readonly removed: readonly SizedSection[];
  readonly changed: readonly Change[];
}

/** One side of a changed message: its pretty-printed JSON from `MessageChange.offset` on, at most a window long. */
export interface MessageText { readonly chars: number; readonly text: string }
/** The first message that is not the same in both requests; `null` on a side that has no message at `index`. */
export interface MessageChange { readonly index: number; readonly offset: number; readonly before: MessageText | null; readonly after: MessageText | null }

export interface PromptDiff {
  readonly modelChanged: boolean;
  readonly system: { readonly changed: boolean; readonly chars: { readonly before: number; readonly after: number } } | null;
  readonly sections: Delta | null;
  readonly tools: (Delta & { readonly reordered: boolean }) | null;
  /** `prefixStable`: every earlier message is still in place, the condition for a prompt-cache hit on the transcript. `firstChange` is `null` then. */
  readonly messages: { readonly before: number; readonly after: number; readonly commonPrefix: number; readonly prefixStable: boolean; readonly firstChange: MessageChange | null } | null;
}

export interface PromptReport {
  readonly latest: CapturedRequest | null;
  readonly previousAt: string | null;
  readonly diff: PromptDiff | null;
}

export interface RenderedSystem {
  readonly text: string;
  readonly base: string;
  readonly sections: Readonly<Record<string, string>>;
}
export type PromptPartName = "tools" | "messages" | "raw";
/** `limit` is one page of `messages`: at most `PROMPT_PAGE_MAX`; both are ignored by the other parts. */
export interface PromptPartRequest { readonly part: PromptPartName; readonly offset?: number; readonly limit?: number }
