/** What the last provider requests of one session runtime looked like; memory only, never persisted. */

/** The model fields of the request that the projection needs. */
export interface RequestModel { readonly provider: string; readonly id: string; readonly api: string }
export type RequestShape = "chat" | "responses" | "anthropic" | "google" | "bedrock";

export interface SizedTool { readonly name: string; readonly descriptionChars: number; readonly parametersChars: number }
export interface SizedSection { readonly key: string; readonly chars: number }

export interface CapturedRequest {
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
    readonly sections: { readonly baseChars: number; readonly entries: readonly SizedSection[] } | null;
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

export interface RecordedRequest { readonly request: CapturedRequest; readonly digest: RequestDigest }

export interface Change { readonly key: string; readonly before: number; readonly after: number }
export interface Delta {
  readonly added: readonly SizedSection[];
  readonly removed: readonly SizedSection[];
  readonly changed: readonly Change[];
}

export interface PromptDiff {
  readonly modelChanged: boolean;
  readonly system: { readonly changed: boolean; readonly chars: { readonly before: number; readonly after: number } } | null;
  readonly sections: Delta | null;
  readonly tools: (Delta & { readonly reordered: boolean }) | null;
  /** `prefixStable`: every earlier message is still in place, the condition for a prompt-cache hit on the transcript. */
  readonly messages: { readonly before: number; readonly after: number; readonly commonPrefix: number; readonly prefixStable: boolean } | null;
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
