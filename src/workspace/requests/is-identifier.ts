
export const identifier = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0
  && value.length <= max && value !== "." && value !== ".." && !/[\\/\p{Cc}]/u.test(value);
