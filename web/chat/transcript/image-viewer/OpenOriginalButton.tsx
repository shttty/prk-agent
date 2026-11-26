import { ActionIcon } from "@mantine/core";
import { IconArrowUpRight } from "@tabler/icons-react";
import { openDataImage } from "./open-data-image.ts";

/** Toolbar button: the current image in its own tab (the target machine's file for target images). */
export function OpenOriginalButton({ src }: { src: string | undefined }) {
  if (!src) return null;
  const icon = <IconArrowUpRight size={22} />;
  return src.startsWith("data:")
    ? <ActionIcon variant="transparent" c="white" size="lg" data-action="open-original-image" aria-label="打开原图" title="打开原图" onClick={() => openDataImage(src)}>{icon}</ActionIcon>
    : <ActionIcon component="a" href={src} target="_blank" rel="noopener noreferrer" variant="transparent" c="white" size="lg" data-action="open-original-image" aria-label="打开原图" title="打开原图">{icon}</ActionIcon>;
}
