export function formatCost(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(value > 0 && value < 1 ? 4 : 2)}`;
}
