import { useMantineColorScheme } from "@mantine/core";
import { useEffectEvent } from "react";
import { useLayoutEffect } from "react";
export function ThemeScheme({ mode }) {
  const { setColorScheme } = useMantineColorScheme();
  const apply = useEffectEvent(setColorScheme);
  useLayoutEffect(() => { if (mode) apply(mode); }, [mode]);
  return null;
}

