import { readDisclosure } from "./read-disclosure.js";

export function isPresentationOpen(openedTools, key, toolCallId) {
  return readDisclosure(openedTools, key, toolCallId) === true;
}
