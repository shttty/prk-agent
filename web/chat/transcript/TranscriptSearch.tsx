import { Group } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Text } from "@mantine/core";
import { Button } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import type { TranscriptSearchModel } from "./use-transcript-search.ts";
import { IconX } from "@tabler/icons-react";
export function TranscriptSearch({ model }: { model: TranscriptSearchModel }) {
  const { searchOpen, searchStatus, searchMatches, closeSearch, searchText, setSearchText, selectSearchMatch, searchIndex, searchError } = model;
  return (
    searchOpen ? <Group className="pi-transcript-search" gap={4} role="search" aria-label="查找当前页" data-scope="loaded" data-status={searchStatus} data-count={searchMatches.length} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeSearch(); } }}>
            <TextInput id="transcript-search" size="xs" value={searchText} onChange={(event) => { const value = event.currentTarget.value; setSearchText(value); void selectSearchMatch(value); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); void selectSearchMatch(searchText, searchIndex + (event.shiftKey ? -1 : 1)); } }} placeholder="查找当前页" aria-label="查找当前页" />
            <Text className="pi-search-scope" size="xs" c="dimmed" data-search-scope="loaded">只搜已加载的部分</Text>
            <Text size="xs" c="dimmed">{searchStatus === "loading" ? "正在加载…" : searchError || (searchText ? `${searchMatches.length ? searchIndex + 1 : 0}/${searchMatches.length}` : "")}</Text>
            <Button type="button" size="compact-xs" variant="subtle" onClick={() => void selectSearchMatch(searchText, searchIndex - 1)} disabled={!searchMatches.length}>上一个</Button>
            <Button type="button" size="compact-xs" variant="subtle" onClick={() => void selectSearchMatch(searchText, searchIndex + 1)} disabled={!searchMatches.length}>下一个</Button>
            <ActionIcon type="button" variant="subtle" onClick={closeSearch} aria-label="关闭查找"><IconX size={16} /></ActionIcon>
          </Group> : null
  );
}
