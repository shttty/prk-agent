import { TextInput } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { Tooltip } from "@mantine/core";
import { Loader } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { IconRefresh } from "@tabler/icons-react";
import InlineAlert from "../../../design-system/inline-alert/InlineAlert.jsx";
import { categoryOf } from "../provider-categories.js";
import { CATEGORY_LABEL } from "../provider-categories.js";
import { splitGroupName } from "../split-group-name.js";
import { ProviderName } from "../ProviderName.jsx";
import { ProviderPolicyAlert } from "../../provider-policy/ProviderPolicyAlert.jsx";
import { ListRow } from "../../list-page/ListRow.jsx";

/** Source column of the tools and Skills pages: search and refresh, sources by category, totals at the foot. */
export function ProviderList({ ctx }) {
  const { hidePeek, mobile, setSheet, setSelected, kind, query, setQuery, pending, entries, providers, session, refreshing, loading, saving, load, data, error, listRef, visible, targets, hits, counts, current, needle, catalog } = ctx;
  const choose = (id) => {
    hidePeek();
    if (mobile) setSheet({ id, open: true });
    else setSelected(id);
  };
  const refreshLabel = kind === "skills" ? "刷新 Skills 列表" : "刷新工具列表";
  const categoryKey = (item) => item.instance && categoryOf(item.id) === "remote" ? `remote:${item.instance}` : categoryOf(item.id);
  // A single category says nothing; its heading is left out.
  const headed = new Set(visible.map(categoryKey)).size > 1;
  let lastCategory = null;
  return <section className="settings-list capability-providers">
    <div className="settings-list-top">
      <TextInput id={`${kind}-search`} className="capability-search" type="search" size="xs" placeholder="搜索" leftSection={<IconSearch size={14} />} value={query} onChange={(event) => { setQuery(event.currentTarget.value); hidePeek(); }} />
      {!session ? <Tooltip label={refreshLabel}><ActionIcon data-action="refresh-capabilities" aria-busy={refreshing} aria-label={refreshLabel} variant="subtle" color="gray" loading={refreshing} disabled={loading || saving} onClick={() => void load(true)}><IconRefresh size={15} /></ActionIcon></Tooltip> : null}
    </div>
    {data?.instanceError ? <InlineAlert id="instance-error" mx="sm">{data.instanceError}</InlineAlert> : null}
    {error ? <InlineAlert id="capabilities-error" mx="sm">{error}</InlineAlert> : null}
    {kind === "tools" ? (catalog?.providerErrors || []).map((item, index) => <ProviderPolicyAlert key={`${item.providerId}-${item.operation}-${index}`} item={item} />) : null}
    <div className="settings-list-scroll" id={`${kind}-sources`} ref={listRef} role="listbox" aria-label="来源" aria-busy={loading || saving}>
      {pending ? <div className="capability-loading" data-status="loading"><Loader size="sm" color="gray" /></div> : null}
      {visible.map((item) => {
        const category = categoryKey(item);
        const label = category.startsWith("remote:") ? `${targets?.find((target) => target.id === item.instance)?.label ?? item.instance} ${CATEGORY_LABEL.remote}` : CATEGORY_LABEL[category];
        const head = headed && category !== lastCategory ? <div key={`category:${category}`} className="settings-list-category" data-category={category}>{label}</div> : null;
        lastCategory = category;
        const match = hits(item);
        return [head, <ListRow key={item.id} data-provider={item.id} data-count={counts.get(item.id) ?? 0} data-enabled={String(item.enabled === true)}
          selected={!mobile && current?.id === item.id} onChoose={() => choose(item.id)} count={match.all ? counts.get(item.id) ?? 0 : match.rows.length}>
          <ProviderName item={item} parts={splitGroupName(item)} />
        </ListRow>];
      })}
      {!loading && !visible.length ? <Text size="sm" c="dimmed" id={`${kind}-empty`}>{needle ? "无匹配" : "暂无内容"}</Text> : null}
    </div>
    {pending ? null : <div className="settings-list-foot" data-count={entries.length}>{providers.length} 个来源 · {entries.length} 项</div>}
  </section>;
}
