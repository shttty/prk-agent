import { text } from "../../sessions/sidebar/text.js";
export function parseTags(value) {
  return [...new Set(text(value).split(",").map((tag) => tag.trim()).filter(Boolean))];
}
