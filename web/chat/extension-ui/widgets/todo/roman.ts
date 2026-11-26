import { ROMAN } from "./parse-todo-constants.ts";

export const roman = (n: number): string => ROMAN.reduce<[number, string]>(([rest, out], [value, symbol]) => [rest % value, out + symbol.repeat(Math.floor(rest / value))], [n, ""])[1];
