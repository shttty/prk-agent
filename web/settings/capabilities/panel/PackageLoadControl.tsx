import type { CapabilityCtx, CapabilityGroup } from "../capability-types.ts";
import { Text } from "@mantine/core";
import { PackageLoadSwitch } from "../../plugins/PackageLoadSwitch.tsx";
import { OverrideControl } from "./OverrideControl.tsx";

/** 加载 switch beside a tools or Skills group that comes from a plugin package, at the layer this page edits (global, instance or session). */
export function PackageLoadControl({ ctx, group }: { ctx: CapabilityCtx; group: CapabilityGroup }) {
  const pkg = ctx.data?.catalog?.packages?.find((entry) => entry.source === group.package);
  if (!pkg) return null;
  return <span className="capability-pair" data-package-load={pkg.source}>
    <Text size="xs" c="dimmed">加载</Text>
    <OverrideControl ctx={ctx} id={pkg.load.id} overridden={pkg.load.overridden} />
    <PackageLoadSwitch pkg={pkg} disabled={ctx.saving} onChange={(enabled) => void ctx.change(pkg.load.id, enabled)} />
  </span>;
}
