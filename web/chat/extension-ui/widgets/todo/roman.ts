import { ROMAN } from "./parse-todo-constants.ts";

export const roman = (n: number): string => ROMAN.reduce(([rest, out], [value, symbol]) => [rest % value, out + symbol.repeat(Math.floor(rest / value))] as [number, string], [n, ""] as [number, string])[1];
