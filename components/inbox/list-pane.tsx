"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConversationRow from "./conversation-row";
import AutosentRow from "./autosent-row";
import {
  listInboxThreads,
  listSentThreads,
  listAutosentMessages,
  listFilteredThreads,
  restoreFilteredThread,
  type ThreadCursor,
  type ThreadPage,
  type AutosentPage,
  type ThreadWithBuyer,
  type AutosentMessage,
} from "@/services/message-service";
import { supabase } from "@/lib/supabase";

interface ListPaneProps {
  onSelect: (thread: ThreadWithBuyer) => void;
  selectedId?: string;
}

/**
 * Thread-list / left column of the SMS inbox.
 * – No horizontal scroll whatsoever.
 * – Tabs stay on one line on ≥ sm, wrap on xs if the column gets too narrow.
 */
export default function ListPane({ onSelect, selectedId }: ListPaneProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("inbox");
  const parentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  /* ---------- data (keyset-paginated, one page per scroll) ---------- */
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["message-threads", tab],
    initialPageParam: null as ThreadCursor | null,
    queryFn: ({ pageParam }) => {
      switch (tab) {
        case "unread":
          return listInboxThreads({ unread: true, cursor: pageParam });
        case "starred":
          return listInboxThreads({ starred: true, cursor: pageParam });
        case "sent":
          return listSentThreads({ cursor: pageParam });
        case "autosent":
          return listAutosentMessages({ cursor: pageParam });
        case "filtered":
          return listFilteredThreads({ cursor: pageParam });
        default:
          return listInboxThreads({ cursor: pageParam });
      }
    },
    getNextPageParam: (lastPage: ThreadPage | AutosentPage) => lastPage.nextCursor ?? undefined,
  });

  const rows = useMemo(
    () => (data?.pages.flatMap((p) => p.rows) ?? []) as (ThreadWithBuyer | AutosentMessage)[],
    [data],
  );

  // NOTE: search currently matches loaded pages only; server-side search is a follow-up.
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return rows;
    return rows.filter((t) => {
      const buyer = (t as any).buyers;
      const name = buyer
        ? buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim()
        : "";
      const phone = (t as any).phone_number || (t as any).message_threads?.phone_number || "";
      return name.toLowerCase().includes(term) || phone.toLowerCase().includes(term);
    });
  }, [rows, search]);

  /* ---------- virtual list ---------- */
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastItemIndex = virtualItems.length ? virtualItems[virtualItems.length - 1].index : -1;

  /* ---------- load the next page as the user nears the end ---------- */
  useEffect(() => {
    if (lastItemIndex < 0) return;
    if (lastItemIndex >= filtered.length - 10 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [lastItemIndex, filtered.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRestore = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await restoreFilteredThread(threadId);
      queryClient.invalidateQueries({ queryKey: ["message-threads"] });
    } catch (err) {
      console.error("Failed to restore filtered thread", err);
    }
  };

  /* ---------- realtime invalidate ---------- */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("thread-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["message-threads"] });
          }, 2000);
        },
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  /* ---------- render ---------- */
  return (
    <div className="sticky top-0 h-[calc(100vh-4rem)] flex flex-col border-r">
      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="px-2 pt-2">
        <TabsList className="inline-flex w-full rounded-lg bg-muted p-0.5">
          {[
            ["inbox", "Inbox"],
            ["unread", "Unread"],
            ["starred", "Starred"],
            ["sent", "Sent"],
            ["autosent", "Autosent"],
            ["filtered", "Filtered"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 whitespace-nowrap rounded-md px-1.5 py-1 text-[11px] text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="px-2 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="thread-search"
            name="thread-search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Thread rows */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load messages.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-md px-3 py-1 text-sm font-medium text-foreground hover:bg-muted"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center">
            <p className="text-sm text-muted-foreground">No messages here yet.</p>
          </div>
        ) : (
          <>
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
              {virtualItems.map((virtualRow) => {
                const item = filtered[virtualRow.index] as any;
                const key = tab === "autosent" ? (item as AutosentMessage).id : (item as ThreadWithBuyer).id;
                return (
                  <div
                    key={key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {tab === "autosent" ? (
                      <AutosentRow
                        message={item as AutosentMessage}
                        selected={selectedId === (item as AutosentMessage).message_threads?.id}
                        onSelect={onSelect}
                      />
                    ) : tab === "filtered" ? (
                      <div>
                        <ConversationRow
                          thread={item as ThreadWithBuyer}
                          selected={selectedId === (item as ThreadWithBuyer).id}
                          onSelect={onSelect}
                        />
                        <div className="flex items-center justify-between gap-2 px-3 pb-2 -mt-1">
                          <span className="inline-flex max-w-[60%] truncate rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                            {(item as ThreadWithBuyer).filtered_keyword || "Filtered"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleRestore((item as ThreadWithBuyer).id, e)}
                            className="rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    ) : (
                      <ConversationRow
                        thread={item as ThreadWithBuyer}
                        selected={selectedId === (item as ThreadWithBuyer).id}
                        onSelect={onSelect}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {isFetchingNextPage && (
              <div className="py-3 text-center text-xs text-muted-foreground">Loading more…</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
