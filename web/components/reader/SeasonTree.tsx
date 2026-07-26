"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import { GitBranch, Star, CheckCircle2 } from "lucide-react";
import type { Episode } from "@/lib/types";

/**
 * Collapsible Season → Episodes → top-K branches (MUI TreeView).
 * Season ids are prefixed `season:` so selecting them doesn't navigate.
 */
export function SeasonTree({
  episodes,
  branchesByEpisode,
  currentId,
  seasonTitle = "Season 1",
}: {
  episodes: Episode[];
  branchesByEpisode: Record<string, Episode[]>;
  currentId: string;
  seasonTitle?: string;
}) {
  const router = useRouter();
  const SEASON = "season:1";

  // full chain of ancestor node ids to expand so the current node is visible
  // (walks arbitrarily deep sub-branches).
  const ancestorsOfCurrent = React.useMemo(() => {
    const path: string[] = [];
    const walk = (id: string, trail: string[]): boolean => {
      if (id === currentId) { path.push(...trail); return true; }
      for (const b of branchesByEpisode[id] ?? []) {
        if (walk(b.id, [...trail, id])) return true;
      }
      return false;
    };
    for (const e of episodes) if (walk(e.id, [])) break;
    return path;
  }, [episodes, branchesByEpisode, currentId]);

  const [expanded, setExpanded] = React.useState<string[]>([]);
  React.useEffect(() => {
    setExpanded((prev) => Array.from(new Set([...prev, SEASON, ...ancestorsOfCurrent])));
  }, [ancestorsOfCurrent]);

  const rowLabel = (
    left: React.ReactNode,
    right?: React.ReactNode
  ) => (
    <div className="flex items-center gap-2 py-[3px] pr-1 text-[13px]">
      <span className="min-w-0 flex-1 truncate">{left}</span>
      {right}
    </div>
  );

  // recursively render a branch node and any sub-branches (N+2 lineage)
  function renderBranch(b: Episode): React.ReactNode {
    const kids = branchesByEpisode[b.id] ?? [];
    return (
      <TreeItem
        key={b.id}
        itemId={b.id}
        label={rowLabel(
          <span
            className={
              "flex items-center gap-1.5 " +
              (b.id === currentId ? "font-semibold text-text" : "text-fork")
            }
          >
            <GitBranch className="h-3 w-3 shrink-0 text-fork" />
            {b.title}
            {b.verifiedByAuthor && <CheckCircle2 className="h-3 w-3 text-canon" />}
          </span>,
          b.avgRating ? <span className="font-mono text-[10px] text-muted">{b.avgRating}★</span> : null
        )}
      >
        {kids.map((k) => renderBranch(k))}
      </TreeItem>
    );
  }

  return (
    <SimpleTreeView
      expandedItems={expanded}
      onExpandedItemsChange={(_, ids) => setExpanded(ids)}
      selectedItems={currentId}
      onSelectedItemsChange={(_, id) => {
        if (id && !id.startsWith("season:")) router.push(`/episodes/${id}`);
      }}
      sx={{
        color: "#c9d1d9",
        "& .MuiTreeItem-content": {
          borderRadius: "6px",
          padding: "1px 4px",
          "&:hover": { backgroundColor: "#21262d" },
          "&.Mui-selected, &.Mui-selected:hover, &.Mui-focused": {
            backgroundColor: "rgba(47,129,247,0.15)",
          },
        },
        "& .MuiTreeItem-iconContainer svg": { fontSize: 18, color: "#8b949e" },
        "& .MuiTreeItem-groupTransition": {
          marginLeft: "12px",
          borderLeft: "1px solid #30363d",
          paddingLeft: "6px",
        },
      }}
    >
      <TreeItem
        itemId={SEASON}
        label={
          <div className="flex items-center gap-2 py-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
            {seasonTitle}
            <span className="ml-auto rounded-full bg-panel-2 px-1.5 text-[10px] font-normal text-muted">
              {episodes.length}
            </span>
          </div>
        }
      >
        {episodes.map((ep, i) => {
          const branches = branchesByEpisode[ep.id] ?? [];
          return (
            <TreeItem
              key={ep.id}
              itemId={ep.id}
              label={rowLabel(
                <span className={ep.id === currentId ? "font-semibold text-text" : "text-body"}>
                  <span className="mr-1.5 font-mono text-[11px] text-muted">{i + 1}</span>
                  {ep.title}
                </span>,
                ep.avgRating ? (
                  <span className="flex items-center gap-0.5 font-mono text-[10px] text-canon">
                    <Star className="h-3 w-3 fill-canon" />
                    {ep.avgRating}
                  </span>
                ) : null
              )}
            >
              {branches.map((b) => renderBranch(b))}
            </TreeItem>
          );
        })}
      </TreeItem>
    </SimpleTreeView>
  );
}
