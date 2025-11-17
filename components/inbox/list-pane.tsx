"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConversationRow from "./conversation-row";
import AutosentRow from "./autosent-row";
import {
  listInboxThreads,
  listSentThreads,
  listAutosentMessages,
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

  /* ---------- data ---------- */
  const { data } = useQuery({
    queryKey: ["message-threads", tab],
    queryFn: async () => {
      switch (tab) {
        case "unread":
          return listInboxThreads({ unread: true });
        case "starred":
          return listInboxThreads({ starred: true });
        case "sent":
          return listSentThreads({ auto: false });
        case "autosent":
          return listAutosentMessages();
        default:
          return listInboxThreads();
      }
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.toLowerCase();
    return (data as (ThreadWithBuyer | AutosentMessage)[]).filter((t) => {
      const buyer = (t as any).buyers;
      const name = buyer
        ? buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim()
        : "";
      const phone = (t as any).phone_number || (t as any).message_threads?.phone_number || "";
      return name.toLowerCase().includes(term) || phone.toLowerCase().includes(term);
    });
  }, [data, search]);

  /* ---------- virtual list ---------- */
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
  });

  /* ---------- realtime invalidate ---------- */
  useEffect(() => {
    const channel = supabase
      .channel("thread-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => queryClient.invalidateQueries({ queryKey: ["message-threads"] }),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [queryClient]);

  /* ---------- render ---------- */
  return (
    <div className="sticky top-0 h-[calc(100vh-4rem)] flex flex-col border-r">
      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="px-2 pt-2">
        <TabsList
          /* flex-wrap on very small screens, single line otherwise */
          className="flex flex-wrap gap-2 border-b overflow-x-hidden sm:flex-nowrap"
        >
          {[
            ["inbox", "Inbox"],
            ["unread", "Unread"],
            ["starred", "Starred"],
            ["sent", "Sent"],
            ["autosent", "Autosent"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="relative pb-2 px-1 text-sm min-w-fit
                data-[state=active]:font-semibold
                data-[state=active]:after:absolute
                data-[state=active]:after:bottom-0
                data-[state=active]:after:left-0
                data-[state=active]:after:h-[2px]
                data-[state=active]:after:w-full
                data-[state=active]:after:bg-primary"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="px-2 py-2">
        <Input
          id="thread-search"
          name="thread-search"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Thread rows */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        <div style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = filtered[virtualRow.index] as any;
            const key = tab === "autosent" ? (item as AutosentMessage).id : (item as ThreadWithBuyer).id;
            return (
              <div
                key={key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
              >
                {tab === "autosent" ? (
                  <AutosentRow
                    message={item as AutosentMessage}
                    selected={selectedId === (item as AutosentMessage).message_threads?.id}
                    onSelect={onSelect}
                  />
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
      </div>
    </div>
  );
}
