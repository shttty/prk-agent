import { TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import InlineAlert from "../../../design-system/inline-alert/InlineAlert.jsx";
import { Loader } from "@mantine/core";
import { categoryOf } from "../provider-categories.js";
import { CATEGORY_LABEL } from "../provider-categories.js";
import { splitGroupName } from "../split-group-name.js";
import { ProviderName } from "../ProviderName.jsx";
import { ProviderPolicyAlert } from "../../provider-policy/ProviderPolicyAlert.jsx";
import { Text } from "@mantine/core";
export function ProviderList({ ctx }) {
  const { hidePeek, mobile, setSheet, setSelected, rootRef, kind, query, setQuery, pending, entries, providers, session, refreshing, loading, saving, load, data, error, listRef, visible, targets, hits, counts, current, needle, catalog } = ctx;
  const choose = (id) => {
    hidePeek();
    if (mobile) setSheet({ id, open: true });
    else {
      setSelected(id);
      const box = document.querySelector('.capability-detail[data-scroll="detail"]');
      const target = box?.querySelector(`[data-provider-section="${CSS.escape(id)}"]`);
      if (target) box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top;
    }
  };
  let lastCategory = null;
  return <section className="capability-providers">
    <div className="capability-providers-top">
      <TextInput id={`${kind}-search`} className="capability-search" type="search" size="xs" placeholder="搜索" leftSection={<IconSearch size={14} />} value={query} onChange={(event) => { setQuery(event.currentTarget.value); hidePeek(); }} />
      <div className="capability-providers-stat">
        {pending ? <span /> : <span data-count={entries.length}>{providers.length} 个来源 · {entries.length} 项</span>}
        {!session ? <Button data-action="refresh-capabilities" aria-busy={refreshing} size="compact-xs" variant="subtle" leftSection={<IconRefresh size={13} />} loading={refreshing} disabled={loading || saving} onClick={() => void load(true)}>刷新{kind === "skills" ? " Skills " : "工具"}列表</Button> : null}
      </div>
      {data?.instanceError ? <InlineAlert id="instance-error">{data.instanceError}</InlineAlert> : null}
      {error ? <InlineAlert id="capabilities-error">{error}</InlineAlert> : null}
      {kind === "tools" ? (catalog?.providerErrors || []).map((item, index) => <ProviderPolicyAlert key={`${item.providerId}-${item.operation}-${item.path}-${index}`} item={item} />) : null}
    </div>
    <div className="capability-provider-list" id={`${kind}-sources`} ref={listRef} role="listbox" aria-label="来源" aria-busy={loading || saving}>
      {pending ? <div className="capability-loading" data-status="loading"><Loader size="sm" color="gray" /></div> : null}
      {visible.map((item) => {
        const category = item.instance && categoryOf(item.id) === "remote" ? `remote:${item.instance}` : categoryOf(item.id);
        const label = category.startsWith("remote:") ? `${targets?.find((target) => target.id === item.instance)?.label ?? item.instance} ${CATEGORY_LABEL.remote}` : CATEGORY_LABEL[category];
        const head = category !== lastCategory ? <div key={`category:${category}`} className="capability-category" data-category={category}>{label}</div> : null;
        lastCategory = category;
        const match = hits(item), parts = splitGroupName(item);
        return [head, <div key={item.id} role="option" tabIndex={0} className="capability-provider" data-provider={item.id} data-count={counts.get(item.id) ?? 0} data-enabled={String(item.enabled === true)}
          aria-selected={!mobile && current?.id === item.id} onClick={() => choose(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(item.id); } }}>
          <ProviderName item={item} parts={parts} />
          <span className="capability-count" data-hit={String(!match.all)}>{match.all ? counts.get(item.id) ?? 0 : match.rows.length}</span>
        </div>];
      })}
      {!loading && !visible.length ? <Text size="sm" c="dimmed" id={`${kind}-empty`}>{needle ? "无匹配" : "暂无内容"}</Text> : null}
    </div>
  </section>;
}
