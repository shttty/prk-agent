import { useLocalStorage } from "@mantine/hooks";

const immediate = { getInitialValueInEffect: false };

export function useTranscriptEffects() {
  return {
    showThinking: useLocalStorage({ ...immediate, key: "pi-show-thinking", defaultValue: true }),
    expandTools: useLocalStorage({ ...immediate, key: "pi-expand-tools", defaultValue: false }),
    expandThinking: useLocalStorage({ ...immediate, key: "pi-expand-thinking", defaultValue: false }),
    streamOutput: useLocalStorage({ ...immediate, key: "pi-stream-output", defaultValue: true }),
  };
}
