import type { ReactNode } from "react";
import { Flex } from "@mantine/core";

type SectionTitleProps = { children: ReactNode; flush?: boolean };

/** A monitor section's heading; `flush` drops the gap below it when nothing follows. */
export function SectionTitle({ children, flush = false }: SectionTitleProps) {
  return <Flex component="h3" align="center" gap={8} mb={flush ? 0 : 6} className="pi-monitor-section-title">{children}</Flex>;
}
