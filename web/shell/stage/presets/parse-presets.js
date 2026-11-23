import { WORK_KINDS } from "./preset-kinds.js";

const isSize = (size) => size === null || (typeof size === "number" && Number.isFinite(size) && size >= 0);

const count = (node, test) => (node.type === "leaf" ? (test(node) ? 1 : 0) : node.data.reduce((sum, child) => sum + count(child, test), 0));

const countChat = (node) => count(node, (leaf) => leaf.kinds.includes("chat"));

function validNode(node) {
  if (!node || !isSize(node.size)) return false;
  if (node.type === "leaf") return (node.main === undefined || node.main === true) && Array.isArray(node.kinds) && node.kinds.length > 0 && (node.kinds.join() === "chat" || node.kinds.every((kind) => WORK_KINDS.includes(kind)));
  return node.type === "branch" && Array.isArray(node.data) && node.data.length > 0 && node.data.every(validNode);
}

/** A layout this module wrote: a split tree with exactly one chat group and at most one main area (none: the chat). */
export const validLayout = (layout) => Boolean(layout) && ["HORIZONTAL", "VERTICAL"].includes(layout.orientation) && typeof layout.workspaceOpen === "boolean"
  && layout.root?.type === "branch" && validNode(layout.root) && countChat(layout.root) === 1 && count(layout.root, (leaf) => leaf.main === true) <= 1;

/** The saved layouts as stored (`[{ name, layout }]`, oldest first); entries this module did not write are skipped. */
export const parsePresets = (saved) => (Array.isArray(saved) ? saved.filter((entry) => typeof entry?.name === "string" && entry.name.trim() && validLayout(entry.layout)) : []);
