import type { ComponentProps } from "react";
import type { PluginRejection } from "./plugin-types.ts";
import { Text } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { ProviderPolicyAlert } from "../provider-policy/ProviderPolicyAlert.tsx";
// What an unsupported cross-process member means for the user, keyed by the structured `details.member`.
const MEMBER_HINTS: Record<string, string> = { "tool.prepareArguments": "同步 prepareArguments 不能跨进程，请放在 Gateway。" };

/** A plugin failure from the Gateway: a rejected request's error envelope (`code`, `details`) or a listed package's
 * `error`/`errorCode`/`errorDetails`. Structured provider diagnostics replace the message (they already hold the
 * reason); otherwise the message is shown with its code and, when given, the unsupported member. */
type PluginFailureProps = ComponentProps<"div"> & { failure: Omit<PluginRejection, "source"> };

export function PluginFailure({ failure: { message, code, details }, ...props }: PluginFailureProps) {
  const providerErrors = details?.providerErrors ?? [];
  const member = typeof details?.member === "string" ? details.member : undefined;
  return <div className="plugin-rejection" data-code={code} data-member={member} {...props}>
    {providerErrors.length
      ? providerErrors.map((item, index) => <ProviderPolicyAlert key={`${item.providerId}-${item.operation}-${index}`} item={item} />)
      : <InlineAlert size="sm">
        {code === "PLUGIN_STARTUP_FAILED" ? <Text size="sm" fw={500}>不可用</Text> : null}
        {member && MEMBER_HINTS[member] ? <Text size="sm" fw={500}>{member ? MEMBER_HINTS[member] : null}</Text> : null}
        <Text size="sm" className="plugin-failure-message">{message}</Text>
        {code ? <Text size="xs" className="plugin-failure-code"><code>{[code, member].filter(Boolean).join(" · ")}</code></Text> : null}
      </InlineAlert>}
  </div>;
}
