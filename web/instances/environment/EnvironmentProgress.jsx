import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import { Text } from "@mantine/core";
import { Progress } from "@mantine/core";
import { Loader } from "@mantine/core";
import { Button } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { formatBytes } from "../../monitor/readings/format-bytes.js";
const TITLES = { idle: "远端环境尚未下发", checking: "正在检查远端环境", transferring: "正在更新远端环境", ready: "远端环境已就绪", failed: "远端环境下发失败" };

/** One instance's remote environment as the Gateway reports it (`TargetEnvironmentSnapshot`): checking shows no bar (its
 * 0/0 is not progress); transferring shows the Gateway's real transferred/total bytes, percent and ACK rate. `failure`
 * is this page's own reason to stop waiting (link lost, Gateway restarted, a create whose deployment failed); it wins over the snapshot.
 * `onDeploy` starts or retries the deploy (the one explicit operation); it waits for `linked` (the Gateway event stream
 * is open), since progress could not be observed otherwise. */
export function EnvironmentProgress({ environment, failure, onDeploy, deploying, linked }) {
  // After a task the Gateway returns to idle within milliseconds; on the same stream its outcome (`settled`) is the state.
  const shown = environment?.status === "idle" && environment.settled ? environment.settled : environment;
  const status = failure ? "failed" : shown?.status ?? "idle";
  const error = failure ?? shown?.error;
  const reason = typeof error?.details?.reason === "string" ? error.details.reason : undefined;
  const canDeploy = onDeploy && (status === "failed" || status === "idle");
  return <Stack gap={6} className="environment-progress" data-environment-status={status} data-failure={failure?.kind} data-target={environment?.target} data-stream={environment?.streamId}
    data-revision={environment?.revision} data-transferred={shown?.transferredBytes} data-total={shown?.totalBytes} data-percent={shown?.percent} data-rate={shown?.bytesPerSecond}>
    <Group gap="xs" wrap="nowrap">
      {status === "checking" || (status === "transferring" && !environment.totalBytes) ? <Loader size="xs" /> : null}
      <Text size="sm" fw={500}>{TITLES[status]}</Text>
    </Group>
    {/* Real compressed bytes only; a zero-byte transfer (everything cached) has no progress to draw. */}
    {status === "transferring" && environment.totalBytes > 0 ? <>
      <Progress value={environment.percent} size="md" aria-label={TITLES.transferring} />
      <Text size="xs" c="dimmed" className="environment-progress-figures">
        {formatBytes(environment.transferredBytes)} / {formatBytes(environment.totalBytes)} · {Math.floor(environment.percent)}% · {formatBytes(environment.bytesPerSecond)}/s
      </Text>
    </> : null}
    {status === "failed" && error ? <InlineAlert size="sm" data-code={error.code || undefined} data-reason={reason}>
      {error.message}{error.code ? <Text component="span" size="xs" ml={6}><code>{[error.code, reason].filter(Boolean).join(" · ")}</code></Text> : null}
    </InlineAlert> : null}
    {canDeploy ? <Group justify="flex-end"><Button data-action="retry-environment" size="compact-sm" variant="default" loading={deploying} disabled={!linked} onClick={onDeploy}>{status === "failed" ? "重试" : "下发"}</Button></Group> : null}
  </Stack>;
}
