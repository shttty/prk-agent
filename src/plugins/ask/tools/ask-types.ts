import type { Static } from "typebox";
import type { askSchema } from "./question-schema.ts";
import type { HostedExtensionUI } from "../../../sessions/extension-ui/ui-types.ts";
export interface AskOption { readonly label: string; readonly description?: string; readonly preview?: string }
export interface AskQuestion {
  readonly id: string;
  readonly question: string;
  readonly header?: string;
  readonly options: readonly AskOption[];
  readonly multi?: boolean;
  readonly recommended?: number;
}
export interface AskAnswer {
  readonly id: string;
  /** Labels of the chosen options, in option order. */
  readonly selected: readonly string[];
  /** The free text the user typed as the "other" answer, and the note on a chosen option. */
  readonly custom?: string;
  readonly note?: string;
  /** The dialog timed out and this answer is the recommended (else first) option. */
  readonly autoSelected?: true;
}
export type AskOutcome = { readonly kind: "answers"; readonly answers: readonly AskAnswer[] } | { readonly kind: "chat" };
export interface AskEnvironment {
  /** The session's hosted UI; read at call time, it only exists once the session has been built. */
  readonly ui: () => HostedExtensionUI | undefined;
  readonly timeoutMs: number;
}

export type AskParameters = Static<typeof askSchema>;
