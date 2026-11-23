import { prefersReducedMotion } from "../../../../design-system/motion/motion-token.js";
import { sameCell } from "./same-cell.js";

export function revealKernelCell(event, cell, beforeReveal) {
  event.preventDefault();
  const row = document.getElementById(`kernel-cell-${cell.cellId}`);
  if (!sameCell(row?.dataset, cell)) return;
  beforeReveal?.();
  for (let node = row; node; node = node.parentElement) {
    if (node.tagName === "DETAILS") node.open = true;
  }
  (row.querySelector(":scope > summary") || row).scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}
