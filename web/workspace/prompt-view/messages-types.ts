import type { MessageOutline } from "../../../src/gateway/wire/web-types.ts";

/** The part of the request's conversation read so far: entries `first` on, to the end of the request. */
export type LoadedMessages = {
  first: number;
  messages: readonly unknown[];
  outline: readonly MessageOutline[];
  /** Entries opened when the list first appears: the last user turn. */
  opened: ReadonlySet<number>;
};
export type MessagesState = { status: "loading" } | { status: "ok"; loaded: LoadedMessages } | { status: "error"; message: string };
