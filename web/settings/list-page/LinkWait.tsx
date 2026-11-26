import { Text } from "@mantine/core";

/** In place of a settings page's content while its load waits for the connection; the banner says what failed. */
export function LinkWait() {
  return <Text className="settings-link-wait" data-waiting="link" size="sm" c="dimmed" px="xs" py="sm">等待连接恢复…</Text>;
}
