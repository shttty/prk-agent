import { useLocalStorage } from "@mantine/hooks";
import { TERMINAL_FONT_SIZE } from "../terminal-constants.ts";

const { initial, min, max, key } = TERMINAL_FONT_SIZE;
const deserialize = (text: string | undefined) => { const size = Number(text); return Number.isInteger(size) && size >= min && size <= max ? size : initial; };

/** The saved terminal font size `[size, setSize]` (px, shared by every shell and the settings field; invalid → default). */
export function useTerminalFontSize() {
  const [size, setSize] = useLocalStorage<number>({ key, defaultValue: initial, getInitialValueInEffect: false, serialize: String, deserialize });
  return [size, setSize] as const;
}
