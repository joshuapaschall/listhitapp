"use client";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
import { Menu } from "lucide-react";
import React from "react";

interface QuickActionsProps {
  children: React.ReactNode;
}

export default function QuickActions({ children }: QuickActionsProps) {
  return (
    <div className="h-full">
      <div className="hidden lg:block border-l p-2 overflow-y-auto lg:min-w-[250px]">
        {children}
      </div>
      <Drawer>
        <DrawerTrigger
          asChild
          className="lg:hidden absolute top-2 right-2 z-10"
        >
          <Button variant="outline" size="icon">
            <Menu className="h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="p-4 space-y-2">{children}</DrawerContent>
      </Drawer>
    </div>
  );
}
