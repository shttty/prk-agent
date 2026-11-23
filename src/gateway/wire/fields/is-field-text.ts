import { text } from "./is-text.ts";

export const fieldText = (value: unknown, max: number): value is string => text(value, max) && !/\p{Cc}/u.test(value);
