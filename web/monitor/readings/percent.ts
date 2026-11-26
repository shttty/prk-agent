export const percent = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null);
