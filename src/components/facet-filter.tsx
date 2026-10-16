import Link from "next/link";
import { cn } from "@/lib/utils";
import type { FacetKey } from "@/lib/facets";
import type { FacetGroup } from "@/lib/patterns-query";
import {
  buildQuery,
  clearSelection,
  hrefWith,
  toggleValue,
  type SelectedFacets,
} from "@/lib/facet-url";

/**
 * 六组分面筛选器（服务端组件）。
 *
 * 每个选项就是一个 `<Link>`，点它 = 跳到"选中状态被切换后"的 URL。
 * 没有客户端状态 —— 于是刷新、后退、分享链接、禁用 JS 全都自然正确。
 *
 * 切换时**故意丢掉 page 参数**：筛完之后结果变少，还停在第 3 页就会是空白页。
 * 但 `search` 要带上，否则点个筛选就把搜索词弄丢了。
 */

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background group-hover:border-ring",
      )}
    >
      {checked ? (
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

interface FacetFilterProps {
  groups: FacetGroup[];
  selected: SelectedFacets;
  /** 当前的搜索词 —— 切换筛选时要带上，别弄丢 */
  search?: string;
  /** 筛选器所在的页面路径，用于拼链接 */
  path?: string;
}

export function FacetFilter({ groups, selected, search = "", path = "/" }: FacetFilterProps) {
  // 切换筛选时保留搜索词；不传 page，让它回到第 1 页
  const extra = search ? { search } : {};

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const key = g.key as FacetKey;
        const chosen = selected[key] ?? [];

        return (
          <section key={g.key} data-testid="facet-group" data-facet={g.key}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">{g.label}</h3>
              {chosen.length > 0 ? (
                <Link
                  href={hrefWith(path, buildQuery(clearSelection(selected, key), extra))}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  清除
                </Link>
              ) : null}
            </div>

            <ul className="space-y-0.5">
              {g.values.map((v) => {
                const checked = chosen.includes(v.id);
                // 已发布纹饰数为 0 的选项置灰 —— 避免"点了没结果"的空选项。
                // 已选中的例外：即便它变成 0 条也要能点掉。
                const empty = !checked && v.count === 0;

                const body = (
                  <>
                    <CheckBox checked={checked} />
                    <span className="flex-1 text-left">{v.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{v.count}</span>
                  </>
                );

                // data-* 是给 ET 用的锚点：靠中文文案定位的话，改个标签就全断
                if (empty) {
                  return (
                    <li key={v.id}>
                      <span
                        data-testid="facet-option"
                        data-facet={key}
                        data-value-id={v.id}
                        data-count={v.count}
                        data-checked="false"
                        data-empty="true"
                        className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-muted-foreground/50"
                        title={v.description ?? undefined}
                      >
                        {body}
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={v.id}>
                    <Link
                      href={hrefWith(path, buildQuery(toggleValue(selected, key, v.id), extra))}
                      data-testid="facet-option"
                      data-facet={key}
                      data-value-id={v.id}
                      data-count={v.count}
                      data-checked={checked ? "true" : "false"}
                      title={v.description ?? undefined}
                      className={cn(
                        "group flex items-center gap-2 rounded px-1.5 py-1 text-sm transition-colors hover:bg-muted",
                        checked && "font-medium",
                      )}
                    >
                      {body}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
