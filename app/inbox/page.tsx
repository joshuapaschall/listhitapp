// @ts-nocheck
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getThreadByBuyer, ThreadWithBuyer } from "@/services/message-service";
import { useToast } from "@/components/ui/use-toast";
import MainLayout from "@/components/layout/main-layout";
import { ListPane, ConversationPane, QuickActions } from "@/components/inbox";

function InboxPageContent() {
  const [thread, setThread] = useState<ThreadWithBuyer | null>(null);
  const searchParams = useSearchParams();
  const buyerId = searchParams.get("buyerId");
  const { toast } = useToast();

  useEffect(() => {
    const loadThread = async () => {
      if (!buyerId) return;
      const foundThread = await getThreadByBuyer(buyerId);
      if (foundThread) {
        setThread(foundThread);
        return;
      }
      toast({
        title: "No conversation yet",
        description: "This buyer doesn't have an SMS conversation.",
      });
    };

    loadThread();
  }, [buyerId, toast]);

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

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageContent />
    </Suspense>
  );
}
