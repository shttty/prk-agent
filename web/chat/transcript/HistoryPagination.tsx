import { Button } from "@mantine/core";
import { Group } from "@mantine/core";
import { Text } from "@mantine/core";

type HistoryPaginationProps = { page: { loading: boolean; error: string }; loadMore: () => Promise<void> };

export function HistoryPagination({ page, loadMore }: HistoryPaginationProps) {
  return <Group id="history-pagination" className="pi-history-pagination" justify="center" gap="xs" wrap="nowrap" data-status={page.loading ? "loading" : page.error ? "error" : "ready"}>
    {page.error ? <Text size="xs" c="red" role="alert" truncate title={page.error}>{page.error}</Text> : null}
    <Button data-action="load-history" size="compact-xs" variant="subtle" loading={page.loading} onClick={() => void loadMore()}>加载更早的消息</Button>
  </Group>;
}
