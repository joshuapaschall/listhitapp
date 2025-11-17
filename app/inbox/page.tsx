"use client";

import { useState } from "react";
import { ThreadWithBuyer } from "@/services/message-service";
import MainLayout from "@/components/layout/main-layout";
import { ListPane, ConversationPane, QuickActions } from "@/components/inbox";

export default function InboxPage() {
  const [thread, setThread] = useState<ThreadWithBuyer | null>(null);

  return (
    <MainLayout>
      <div className="grid h-[calc(100dvh-4rem)] overflow-hidden grid-cols-[minmax(20rem,22rem)_1fr_auto]">
        <div className="border-r">
          <ListPane onSelect={setThread} selectedId={thread?.id} />
        </div>
        <div className="min-w-0 h-full flex flex-col min-h-0">
          <ConversationPane thread={thread} />
        </div>
        <QuickActions>{/* placeholder for quick actions */}</QuickActions>
      </div>
    </MainLayout>
  );
}
