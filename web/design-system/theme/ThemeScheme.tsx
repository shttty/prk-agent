import { useMantineColorScheme } from "@mantine/core";
import { useEffectEvent, useLayoutEffect } from "react";

export function ThemeScheme({ mode }: { mode: "light" | "dark" | undefined }) {
  const { setColorScheme } = useMantineColorScheme();
  const apply = useEffectEvent(setColorScheme);
  useLayoutEffect(() => { if (mode) apply(mode); }, [mode]);
  return null;
}
