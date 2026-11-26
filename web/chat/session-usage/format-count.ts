// A missing number renders as "—": nothing in session usage is estimated.
export const formatCount = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-CN") : "—");
