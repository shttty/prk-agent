import type { CapturedBody, MessageOutline, PromptMessagesPart } from "./capture-types.ts";
import { describeMessage } from "./describe-message.ts";
import { readRequestFields } from "./read-request-fields.ts";

/** One page of the latest request's conversation entries, as the payload holds them, from `offset` (0 is the first entry); past the end the page is empty. */
export function pagePromptMessages(body: CapturedBody, offset: number, limit: number): PromptMessagesPart {
  const entries = body.shape && typeof body.payload === "object" && body.payload !== null ? readRequestFields(body.shape, body.payload as Record<string, unknown>).messages ?? [] : [];
  const outline = entries.map(describeMessage);
  return { seq: body.seq, at: body.at, shape: body.shape, total: entries.length, offset, turnStart: turnStart(outline), messages: entries.slice(offset, offset + limit), outline: outline.slice(offset, offset + limit) };
}

/** The user inputs closing the list (the prompt and what plugins injected beside it) start the turn the request is answering. */
function turnStart(outline: readonly MessageOutline[]): number | null {
  const last = outline.findLastIndex((message) => message.turn);
  if (last < 0) return null;
  let first = last;
  while (first > 0 && outline[first - 1]!.turn) first--;
  return first;
}
