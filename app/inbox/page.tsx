"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getThreadByBuyer, ThreadWithBuyer } from "@/services/message-service";
import { useToast } from "@/components/ui/use-toast";
import MainLayout from "@/components/layout/main-layout";
import { usePermissions } from "@/hooks/use-permissions";
import { ListPane, ConversationPane } from "@/components/inbox";

function InboxPageContent() {
  const [thread, setThread] = useState<ThreadWithBuyer | null>(null);
  const searchParams = useSearchParams();
  const buyerId = searchParams.get("buyerId");
  const { toast } = useToast();
  const { can, loading: permissionsLoading } = usePermissions();

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

  if (permissionsLoading) {
    return (
      <MainLayout>
        <div className="p-6 text-sm text-muted-foreground">Checking inbox permissions...</div>
      </MainLayout>
    );
  }

  if (!can("inbox.view")) {
    return (
      <MainLayout>
        <div className="space-y-2 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">You do not have permission to view the inbox.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="grid h-[calc(100dvh-4rem)] overflow-hidden grid-cols-[minmax(20rem,22rem)_1fr]">
        <div className="border-r">
          <ListPane onSelect={setThread} selectedId={thread?.id} />
        </div>
        <div className="min-w-0 h-full flex flex-col min-h-0">
          <ConversationPane thread={thread} />
        </div>
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
