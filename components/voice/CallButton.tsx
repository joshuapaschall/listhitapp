"use client";

import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCall } from "@/components/voice/CallProvider";
import { formatPhoneE164 } from "@/lib/dedup-utils";

interface CallButtonProps {
  phone?: string | null;
  name?: string;
  buyerId?: string;
  fromNumber?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "ghost" | "outline" | "secondary";
}

export function CallButton({ phone, name, buyerId, fromNumber, size = "icon", variant = "ghost" }: CallButtonProps) {
  const { makeCall, status, activeCall, device, setCurrentContact } = useCall();
  const phoneE164 = formatPhoneE164(phone);
  const isBusy = status === "connecting" || status === "on-call" || Boolean(activeCall);
  const disabled = !phoneE164 || isBusy || !device || status === "error";

  const handleCall = async () => {
    if (!phoneE164) return;
    setCurrentContact({ name, number: phone || phoneE164 });
    await makeCall(phoneE164, buyerId, fromNumber);
  };

  const reason = !phoneE164 ? "No valid phone number" : !device ? "Phone is not ready" : isBusy ? "You are already on a call" : status === "error" ? "Phone is unavailable" : "";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              type="button"
              variant={variant}
              size={size}
              className="text-[var(--brand)] hover:text-[var(--brand-hover)]"
              onClick={handleCall}
              disabled={disabled}
              aria-label={name ? `Call ${name}` : "Call contact"}
            >
              <Phone className="h-4 w-4" />
            </Button>
          </span>
        </TooltipTrigger>
        {disabled ? <TooltipContent>{reason}</TooltipContent> : null}
      </Tooltip>
    </TooltipProvider>
  );
}
