"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import EmojiPicker from "emoji-picker-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TemplateService } from "@/services/template-service";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Mic,
  Image as ImageIcon,
  Tag,
  Clipboard,
  Smile,
  Clock,
  X,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { insertText, cn, renderTemplate } from "@/lib/utils";
import { calculateSmsSegments } from "@/lib/sms-utils";
import { formatPhoneE164, normalizePhone } from "@/lib/dedup-utils";
import {
  supabase,
  type MessageThread,
  type Message,
  type Buyer,
  type TemplateRecord,
} from "@/lib/supabase";
import EditBuyerModal from "@/components/buyers/edit-buyer-modal";
import AddBuyerModal from "@/components/buyers/add-buyer-modal";
import { toast } from "sonner";
import useHotkeys from "@/hooks/use-hotkeys";
import CampaignService from "@/services/campaign-service";
import { BuyerService } from "@/services/buyer-service";
import { type ThreadWithBuyer } from "@/services/message-service";
import {
  ALLOWED_MMS_EXTENSIONS,
  MAX_MMS_SIZE,
  uploadMediaFile,
} from "@/utils/uploadMedia";
import VoiceRecorder from "@/components/voice/VoiceRecorder";
import UploadModal from "./upload-modal";
import QuickReplyModal from "./quick-reply-modal";

const mergeTags = [
  { label: "Contact's First Name", value: "{{first_name}}" },
  { label: "Contact's Last Name", value: "{{last_name}}" },
  { label: "Contact's Phone Number", value: "{{phone}}" },
  { label: "Contact's Email", value: "{{email}}" },
  { label: "Contact Form Link", value: "{{contact_form_link}}" },
  { label: "My First Name", value: "{{my_first_name}}" },
  { label: "My Last Name", value: "{{my_last_name}}" },
];

function parseMedia(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const arr = JSON.parse(val);
      if (Array.isArray(arr)) return arr;
    } catch {}
    const cleaned = val.replace(/[{}\"]/g, "");
    if (!cleaned) return [];
    return cleaned.split(/,\s*/);
  }
  return [];
}

function isPlayableAudioUrl(u: string) {
  try {
    const base = u.split("?")[0].toLowerCase()
    return /(\.mp3|\.m4a|\.wav|\.ogg|\.opus|\.oga|\.webm|\.weba|\.amr)(\?.*)?$/.test(base)
  } catch {
    return false
  }
}

function parseAudioUrl(val: any): string | null {
  if (!val) return null
  const tryUrl = (u: string) => (isPlayableAudioUrl(u) ? u : null)
  if (Array.isArray(val)) {
    for (const entry of val) {
      const candidate = typeof entry === "string" ? entry.trim() : ""
      const playable = tryUrl(candidate)
      if (playable) return playable
    }
    return null
  }
  if (typeof val === "string") {
    const trimmed = val.trim()
    if (!trimmed) return null
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const arr = JSON.parse(trimmed)
        if (Array.isArray(arr)) {
          for (const entry of arr) {
            const playable = tryUrl(typeof entry === "string" ? entry.trim() : "")
            if (playable) return playable
          }
        }
      } catch {}
    }
    return tryUrl(trimmed)
  }
  return null
}

const normalizeDid = (val?: string | null) => normalizePhone(val) || null

const formatDidE164 = (val?: string | null) => {
  const norm = normalizeDid(val)
  if (!norm) return null
  return formatPhoneE164(norm) || null
}

const formatDidDisplay = (val?: string | null) => {
  const norm = normalizeDid(val)
  if (!norm) return val || ""
  if (norm.length === 10) {
    return `(${norm.slice(0, 3)}) ${norm.slice(3, 6)}-${norm.slice(6)}`
  }
  return `+${norm}`
}

function MediaAttachment({ url }: { url: string }) {
  const [src, setSrc] = useState(url)
  const [error, setError] = useState<string | null>(null)
  const isImage = /(\.jpg|\.jpeg|\.png|\.gif|\.bmp|\.webp)$/i.test(src)
  const isVideo = /(\.mp4|\.webm|\.3gp)$/i.test(src)
  const isAudio = isPlayableAudioUrl(src)
  const needsConvert = /(\.amr|\.webm|\.weba|\.3gp|\.wav|\.ogg|\.opus|\.oga)(\?.*)?$/i.test(src)

  useEffect(() => {
    const convert = async () => {
      try {
        const res = await fetch("/api/media/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, direction: "incoming" }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.url) setSrc(data.url)
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error || "Media conversion failed")
        }
      } catch (err) {
        console.error(err)
        setError("Media conversion failed")
        toast.error("Media conversion failed")
      }
    }
    if (needsConvert) convert()
  }, [needsConvert, url])

  let content
  if (isImage) {
    content = (
      <Image
        src={src}
        alt="attachment"
        width={300}
        height={300}
        loading="lazy"
        className="rounded-md max-w-[300px]"
      />
    )
  } else if (isVideo) {
    content = (
      <video controls src={src} className="w-full mt-2" crossOrigin="anonymous" />
    )
  } else if (isAudio) {
    content = (
      <audio
        controls
        src={src}
        preload="none"
        style={{ maxWidth: "100%" }}
        className="rounded-xl w-full bg-white shadow"
      />
    )
  } else {
    content = (
      <a href={src} target="_blank" rel="noopener noreferrer">
        Download
      </a>
    )
  }

  return (
    <div>
      {content}
      {error && (
        <div
          data-testid="convert-error"
          className="mt-1 flex items-center gap-1 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

interface ConversationPaneProps {
  thread: MessageThread | null;
}

interface LocalMessage extends Message {
  status?: "sending" | "failed";
  localId?: string;
  error?: string;
  subject?: string | null;
  type?: "sms" | "email" | "event" | string;
}

export default function ConversationPane({ thread }: ConversationPaneProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [agentDetails, setAgentDetails] = useState<{
    firstName?: string;
    lastName?: string;
    displayName?: string;
  }>({});
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const oversizedNonImages = attachments.filter(
    (f) => f.size > MAX_MMS_SIZE && !f.type.startsWith("image/"),
  );
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [scheduleTime, setScheduleTime] = useState("");
  const [schedulePicker, setSchedulePicker] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<"photo" | "video" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [selectedDid, setSelectedDid] = useState<string | null>(
    normalizeDid(thread?.preferred_from_number),
  );
  const [ownedDids, setOwnedDids] = useState<string[]>([]);
  const [preferredFrom, setPreferredFrom] = useState<string | null>(
    normalizeDid(thread?.preferred_from_number),
  );
  const [bannerDid, setBannerDid] = useState<string | null>(null);
  const manualDidRef = useRef(false);
  const dismissedBannerIdRef = useRef<string | null>(null);
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);

  const loadQuickReplies = useCallback(async () => {
    try {
      const list = await TemplateService.listTemplates("quick_reply");
      setTemplates(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load quick replies");
    }
  }, []);

  useEffect(() => {
    void loadQuickReplies();
  }, [loadQuickReplies]);

  useEffect(() => {
    const loadAgent = async () => {
      try {
        const res = await fetch("/api/agents/me");
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const display = typeof data.display_name === "string" ? data.display_name : "";
        const parts = display.trim().split(/\s+/).filter(Boolean);
        setAgentDetails({
          displayName: display,
          firstName:
            data.first_name || (parts.length ? parts[0] : ""),
          lastName:
            data.last_name || (parts.length > 1 ? parts.slice(1).join(" ") : ""),
        });
      } catch (err) {
        console.error("Failed to load agent details", err);
      }
    };
    loadAgent();
  }, []);

  useEffect(() => {
    const loadVoiceNumbers = async () => {
      try {
        const res = await fetch("/api/voice-numbers");
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.numbers)) {
          setOwnedDids(
            data.numbers
              .map((num: string) => normalizeDid(num))
              .filter((num): num is string => Boolean(num)),
          );
        }
      } catch (err) {
        console.error("Failed to load voice numbers", err);
      }
    };
    loadVoiceNumbers();
  }, []);

  useEffect(() => {
    if (!thread) {
      setBuyer(null);
      return;
    }
    const loadBuyer = async () => {
      const { data, error } = await supabase
        .from("buyers")
        .select(
          "id,fname,lname,full_name,can_receive_sms,status,email,phone,phone2,phone3,website",
        )
        .eq("id", thread.buyer_id);
      if (!error && data && data[0]) setBuyer(data[0] as Buyer);
    };
    loadBuyer();
  }, [thread]);

  useEffect(() => {
    if (!thread) {
      setPreferredFrom(null);
      setSelectedDid(null);
      setBannerDid(null);
      manualDidRef.current = false;
      return;
    }
    const normalized = normalizeDid(thread.preferred_from_number);
    setPreferredFrom(normalized);
    if (!manualDidRef.current) {
      setSelectedDid(normalized);
    }
    setBannerDid(null);
    manualDidRef.current = false;
  }, [thread?.id, thread?.preferred_from_number]);

  useEffect(() => {
    if (!thread || !thread.unread) return;
    supabase
      .from("message_threads")
      .update({ unread: false })
      .eq("id", thread.id)
      .then(() => {
        const tabs = ["inbox", "unread", "starred", "sent", "autosent"];
        tabs.forEach((t) => {
          queryClient.setQueryData<ThreadWithBuyer[]>(
            ["message-threads", t],
            (old) =>
              old
                ? old.map((th) =>
                    th.id === thread.id ? { ...th, unread: false } : th,
                  )
                : old,
          );
        });
        queryClient.invalidateQueries({ queryKey: ["message-threads"] });
      });
  }, [thread, queryClient]);

  useEffect(() => {
    if (!thread) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", thread.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      let msgs: LocalMessage[] = [];
      if (!error) msgs = data as LocalMessage[];

      const { data: emails } = await supabase
        .from("email_messages")
        .select("id,thread_id,buyer_id,subject,preview,sent_at")
        .eq("buyer_id", thread.buyer_id)
        .order("sent_at", { ascending: true });
      const emailMsgs = (emails || []).map((e) => ({
        id: e.id,
        thread_id: thread.id,
        buyer_id: e.buyer_id,
        direction: "email",
        from_number: null,
        to_number: null,
        body: e.preview,
        provider_id: null,
        is_bulk: false,
        filtered: false,
        created_at: e.sent_at,
        deleted_at: null,
        subject: e.subject,
        type: "email",
      })) as LocalMessage[];

      const all = [...msgs, ...emailMsgs]
        .map((m) => ({ ...m, media_urls: parseMedia((m as any).media_urls) }))
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime(),
        );

      if (
        thread.campaign_id &&
        all.length &&
        all[0].direction === "inbound" &&
        !all.some((m) => m.is_bulk)
      ) {
        const nums = [thread.phone_number];
        if (thread.phone_number.length === 10)
          nums.push(`+1${thread.phone_number}`);
        else nums.push(`+${thread.phone_number}`);

        const { data: bulk } = await supabase
          .from("messages")
          .select("*")
          .eq("buyer_id", thread.buyer_id)
          .eq("is_bulk", true)
          .in("to_number", nums)
          .lt("created_at", all[0].created_at)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (bulk && !all.find((m) => m.id === bulk.id)) {
          all.unshift(bulk as LocalMessage);
        }
      }

      setMessages(all);
    };
    load();

    const channel = supabase
      .channel(`thread-${thread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          const parsed: LocalMessage = {
            ...(msg as Message),
            media_urls: parseMedia((msg as any).media_urls),
          };

          setMessages((prev) => {
            // 1) If we already have this DB id, just update it in place
            const byId = prev.findIndex((m) => m.id === msg.id);
            if (byId >= 0) {
              const arr = [...prev];
              const old = arr[byId];
              arr[byId] = {
                ...parsed,
                // keep any localId we were using for optimistic updates
                localId: old.localId,
              };
              return arr;
            }

            // 2) Normal path: match by provider_id (after sendMessage sets it)
            if (msg.provider_id) {
              const byProvider = prev.findIndex(
                (m) => m.provider_id === msg.provider_id,
              );
              if (byProvider >= 0) {
                const arr = [...prev];
                const old = arr[byProvider];
                arr[byProvider] = {
                  ...parsed,
                  localId: old.localId,
                };
                return arr;
              }
            }

            // 3) Fallback: match any outbound "sending" message with same to_number + body
            const msgTo = normalizeDid(msg.to_number);
            const byPending = prev.findIndex((m) => {
              if (m.status !== "sending" || m.direction !== "outbound") return false;
              if (m.provider_id) return false;
              const pendingTo = normalizeDid(m.to_number);
              return pendingTo === msgTo && (m.body || "") === (msg.body || "");
            });
            if (byPending >= 0) {
              const arr = [...prev];
              const old = arr[byPending];
              arr[byPending] = {
                ...parsed,
                localId: old.localId,
              };
              return arr;
            }

            // 4) If somehow it's already there, don't duplicate
            if (prev.some((m) => m.id === msg.id)) {
              return prev;
            }

            // 5) Otherwise append (covers inbound messages, etc.)
            return [...prev, parsed];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [thread]);

  const lastInbound = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.direction === "inbound" && msg.to_number) {
        const did = normalizeDid(msg.to_number);
        if (did) return { id: msg.id, did };
      }
    }
    return { id: null as string | null, did: null as string | null };
  }, [messages]);

  const mergeContext = useMemo(
    () => {
      const fname = buyer?.fname || thread?.buyers?.fname || "";
      const lname = buyer?.lname || thread?.buyers?.lname || "";
      const primaryPhone =
        buyer?.phone ||
        buyer?.phone2 ||
        buyer?.phone3 ||
        thread?.phone_number ||
        "";
      const email = buyer?.email || "";
      const contactFormLink =
        (buyer as any)?.contact_form_link ||
        (buyer as any)?.form_link ||
        buyer?.website ||
        "";
      const myFirstName =
        agentDetails.firstName ||
        (agentDetails.displayName
          ? agentDetails.displayName.split(" ")[0] || ""
          : "");
      const myLastName =
        agentDetails.lastName ||
        (agentDetails.displayName
          ? agentDetails.displayName
              .split(" ")
              .slice(1)
              .join(" ") || ""
          : "");

      return {
        buyer: {
          fname,
          lname,
          phone: primaryPhone,
          email,
          contact_form_link: contactFormLink,
        },
        agent: { myFirstName, myLastName },
      };
    },
    [
      agentDetails.displayName,
      agentDetails.firstName,
      agentDetails.lastName,
      buyer,
      thread,
    ],
  );

  useEffect(() => {
    if (!thread) return;
    const inboundDid = lastInbound.did;
    const sticky = preferredFrom;
    if (inboundDid && sticky && inboundDid !== sticky) {
      if (dismissedBannerIdRef.current === lastInbound.id) {
        setBannerDid(null);
        return;
      }
      setBannerDid(inboundDid);
      if (!manualDidRef.current || selectedDid === sticky) {
        setSelectedDid(inboundDid);
      }
      return;
    }
    dismissedBannerIdRef.current = null;
    if (!manualDidRef.current) {
      if (inboundDid) setSelectedDid(inboundDid);
      else if (sticky) setSelectedDid(sticky);
    }
    if (!inboundDid || inboundDid === sticky) {
      setBannerDid(null);
    }
  }, [thread?.id, preferredFrom, lastInbound.did, lastInbound.id, selectedDid]);

  useEffect(() => {
    if (
      !thread ||
      selectedDid ||
      preferredFrom ||
      lastInbound.did ||
      ownedDids.length === 0
    ) {
      return;
    }
    setSelectedDid(ownedDids[0]);
  }, [thread, selectedDid, preferredFrom, lastInbound.did, ownedDids]);

  const didOptions = useMemo(() => {
    const set = new Set<string>();
    ownedDids.forEach((num) => num && set.add(num));
    if (preferredFrom) set.add(preferredFrom);
    if (selectedDid) set.add(selectedDid);
    if (bannerDid) set.add(bannerDid);
    return Array.from(set);
  }, [ownedDids, preferredFrom, selectedDid, bannerDid]);

  const bannerDidLabel = useMemo(
    () => (bannerDid ? formatDidDisplay(bannerDid) : null),
    [bannerDid],
  );

  const stickyDidLabel = useMemo(
    () => (preferredFrom ? formatDidDisplay(preferredFrom) : null),
    [preferredFrom],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const insertPlaceholder = (text: string) => {
    if (!textareaRef.current) return;
    const { value, position } = insertText(
      input,
      text,
      textareaRef.current.selectionStart,
      textareaRef.current.selectionEnd,
    );
    setInput(value);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(position, position);
      textareaRef.current?.focus();
    });
  };


  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const persistPreferredDid = useCallback(
    async (did: string | null) => {
      if (!thread) return false;
      const formatted = did ? formatDidE164(did) || did : null;
      const { error } = await supabase
        .from("message_threads")
        .update({
          preferred_from_number: formatted,
          updated_at: new Date().toISOString(),
        })
        .eq("id", thread.id);
      if (error) {
        console.error("Failed to update preferred DID", error);
        toast.error("Failed to update number");
        return false;
      }
      setPreferredFrom(did);
      queryClient.invalidateQueries({ queryKey: ["message-threads"] });
      return true;
    },
    [thread, queryClient],
  );

  const handleDidChange = useCallback(
    async (value: string) => {
      const normalized = normalizeDid(value);
      if (!normalized) return;
      setSelectedDid(normalized);
      manualDidRef.current = true;
      setBannerDid(null);
      if (normalized !== preferredFrom) {
        const success = await persistPreferredDid(normalized);
        if (!success) {
          setSelectedDid(preferredFrom);
        }
      }
    },
    [preferredFrom, persistPreferredDid],
  );

  const handleBannerSwitch = useCallback(async () => {
    if (!bannerDid) return;
    const success = await persistPreferredDid(bannerDid);
    if (success) {
      dismissedBannerIdRef.current = null;
      setSelectedDid(bannerDid);
      setBannerDid(null);
      manualDidRef.current = true;
    }
  }, [bannerDid, persistPreferredDid]);

  const handleBannerKeep = useCallback(() => {
    manualDidRef.current = true;
    dismissedBannerIdRef.current = lastInbound.id;
    if (preferredFrom) {
      setSelectedDid(preferredFrom);
    }
    setBannerDid(null);
  }, [lastInbound.id, preferredFrom]);

  const compressImageIfNeeded = useCallback(
    async (file: File): Promise<File> => {
      if (!file.type.startsWith("image/") || file.size <= MAX_MMS_SIZE) {
        return file;
      }

      return await new Promise<File>((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = () => {
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                reject(new Error("Canvas not supported"));
                return;
              }

              const scale = Math.sqrt(MAX_MMS_SIZE / file.size);
              const targetScale =
                isFinite(scale) && scale > 0 && scale < 1 ? scale : 1;

              canvas.width = img.width * targetScale;
              canvas.height = img.height * targetScale;
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    reject(new Error("Failed to compress image"));
                    return;
                  }
                  if (blob.size > MAX_MMS_SIZE) {
                    reject(
                      new Error(
                        `Image is still too large after compression (${Math.round(
                          blob.size / 1024,
                        )}KB). Try a smaller image.`,
                      ),
                    );
                    return;
                  }
                  const compressed = new File(
                    [blob],
                    file.name.replace(/\.[^.]+$/, ".jpg"),
                    { type: "image/jpeg" },
                  );
                  resolve(compressed);
                },
                "image/jpeg",
                0.8,
              );
            } catch (err) {
              reject(err as Error);
            }
          };
          img.onerror = () =>
            reject(new Error("Failed to load image for compression"));
          img.src = reader.result as string;
        };

        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(file);
      });
    },
    [],
  );

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!thread || (!trimmedInput && attachments.length === 0)) return;
    const sendableFiles: File[] = []
    const linkOnlyFiles: File[] = []

    for (const file of attachments) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_MMS_EXTENSIONS.includes(ext)) {
        toast.error(`Unsupported file type: ${file.name}`);
        return;
      }

      if (file.size > MAX_MMS_SIZE && !file.type.startsWith("image/")) {
        linkOnlyFiles.push(file)
        continue
      }

      sendableFiles.push(file)
    }

    const uploadFiles = async (list: File[], asLinksOnly = false) => {
      const urls: string[] = []
      const linkOnlyFallbacks: { url: string; name: string }[] = []

      for (const original of list) {
        const file =
          original.type.startsWith("image/") && original.size > MAX_MMS_SIZE
            ? await compressImageIfNeeded(original)
            : original

        let url = await uploadMediaFile(file, "outgoing")
        const lower = file.name.toLowerCase()
        const needsConvert =
          !asLinksOnly &&
          /(\.amr|\.webm|\.weba|\.3gp|\.wav|\.ogg|\.opus|\.oga|\.m4a)$/.test(
            lower,
          )

        if (needsConvert) {
          try {
            const res = await fetch("/api/media/convert", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url, direction: "outgoing" }),
            })
            if (res.ok) {
              const data = await res.json()
              if (data.url) url = data.url
            } else {
              const data = await res.json().catch(() => ({}))
              const errMsg =
                data.error ||
                "This audio format could not be processed; please try a different format."
              toast.error(errMsg)
              linkOnlyFallbacks.push({ url, name: file.name })
              continue
            }
          } catch (err) {
            console.error("convert failed", err)
            toast.error(
              "This audio format could not be processed; it will be sent as a download link instead.",
            )
            linkOnlyFallbacks.push({ url, name: file.name })
            continue
          }
        }

        urls.push(url)
      }

      return { urls, linkOnlyFallbacks }
    }

    const currentFrom = selectedDid || preferredFrom || null;

    const renderedBody = renderTemplate(
      trimmedInput,
      mergeContext.buyer,
      mergeContext.agent,
    );

    if (linkOnlyFiles.length) {
      toast.info(
        `${linkOnlyFiles.length} file${linkOnlyFiles.length > 1 ? "s" : ""} will send as download link${
          linkOnlyFiles.length > 1 ? "s" : ""
        } due to the 1MB MMS limit.`,
      )
    }

    const uploadAndBuildBody = async () => {
      let mediaUrls: string[] = []
      const linkEntries: { url: string; name: string; reason?: string }[] = []

      try {
        const mediaResult = await uploadFiles(sendableFiles)
        mediaUrls = mediaResult.urls
        linkEntries.push(
          ...mediaResult.linkOnlyFallbacks.map((item) => ({
            ...item,
            reason: "conversion-failed" as const,
          })),
        )

        const linkResult = linkOnlyFiles.length
          ? await uploadFiles(linkOnlyFiles, true)
          : { urls: [], linkOnlyFallbacks: [] as { url: string; name: string }[] }

        linkEntries.push(
          ...linkResult.urls.map((url, idx) => ({
            url,
            name: linkOnlyFiles[idx]?.name || "Attachment",
            reason: "over-limit" as const,
          })),
          ...linkResult.linkOnlyFallbacks.map((item) => ({
            ...item,
            reason: "conversion-failed" as const,
          })),
        )
      } catch (err) {
        console.error("Media upload failed", err)
        toast.error(
          (err as any)?.message ||
            "Failed to upload attachments. Please try different files.",
        )
        return { mediaUrls: [], body: renderedBody, failed: true }
      }

      const hasOverLimitLinks = linkEntries.some((item) => item.reason === "over-limit")

      const finalBody = linkEntries.length
        ? `${renderedBody ? `${renderedBody}\n\n` : ""}Download link${
            linkEntries.length > 1 ? "s" : ""
          }${hasOverLimitLinks ? " (over 1MB)" : ""}:\n${linkEntries
            .map((item) => `• ${item.name || "Attachment"}: ${item.url}`)
            .join("\n")}`
        : renderedBody

      return { mediaUrls, body: finalBody, failed: false }
    }

    if (scheduleDate) {
      const { mediaUrls, body, failed } = await uploadAndBuildBody()
      if (failed) return
      try {
        const name =
          buyer?.full_name ||
          `${buyer?.fname || ""} ${buyer?.lname || ""}`.trim() ||
          "Unnamed";
        const campaign = await CampaignService.createCampaign({
          name: `SMS to ${name}`,
          channel: "sms",
          message: body,
          mediaUrls,
          buyerIds: [thread.buyer_id],
          groupIds: [],
          sendToAllNumbers: true,
        });
        const dtString = `${scheduleDate
          .toISOString()
          .split("T")[0]}T${scheduleTime || "00:00"}:00`;
        await CampaignService.schedule(
          campaign.id,
          new Date(dtString).toISOString(),
        );
        toast.success("Message scheduled");
        setInput("");
        setAttachments([]);
        setScheduleDate(null);
        setScheduleTime("");
      } catch (err) {
        console.error(err);
        toast.error("Failed to schedule message");
      }
      return;
    }

    const { mediaUrls, body, failed } = await uploadAndBuildBody()
    if (failed) return

    const tempId = `temp-${Date.now()}`;
    const pending: LocalMessage = {
      id: tempId,
      localId: tempId,
      thread_id: thread.id,
      buyer_id: thread.buyer_id,
      direction: "outbound",
      from_number: currentFrom ? formatDidE164(currentFrom) : null,
      to_number: thread.phone_number,
      body,
      provider_id: null,
      is_bulk: false,
      filtered: false,
      created_at: new Date().toISOString(),
      status: "sending",
      media_urls: mediaUrls.length ? mediaUrls : null,
    };
    setMessages((prev) => [...prev, pending]);
    setInput("");
    setAttachments([]);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: thread.buyer_id,
          threadId: thread.id,
          to: thread.phone_number,
          from: currentFrom || undefined,
          body: pending.body,
          mediaUrls,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setMessages((prev) =>
        prev.map((m) =>
          m.localId === tempId ? { ...m, provider_id: data.sid } : m,
        ),
      );
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.localId === tempId
            ? { ...m, status: "failed", error: (err as Error).message }
            : m,
        ),
      );
    }
  }, [
    thread,
    input,
    scheduleDate,
    scheduleTime,
    buyer,
    attachments,
    selectedDid,
    preferredFrom,
    mergeContext,
    compressImageIfNeeded,
  ]);

  const retryMessage = async (msg: LocalMessage) => {
    if (!thread) return;
    const retryFrom =
      normalizeDid(msg.from_number) || selectedDid || preferredFrom || null;
    const formattedRetryFrom = retryFrom ? formatDidE164(retryFrom) : null;
    setMessages((prev) =>
      prev.map((m) =>
        m.localId === msg.localId
          ? {
              ...m,
              status: "sending",
              from_number: formattedRetryFrom || m.from_number,
            }
          : m,
      ),
    );
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: thread.buyer_id,
          threadId: thread.id,
          to: thread.phone_number,
          from: retryFrom || undefined,
          body: msg.body,
          mediaUrls: msg.media_urls || [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setMessages((prev) =>
        prev.map((m) =>
          m.localId === msg.localId ? { ...m, provider_id: data.sid } : m,
        ),
      );
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.localId === msg.localId
            ? { ...m, status: "failed", error: (err as Error).message }
            : m,
        ),
      );
      toast.error((err as Error).message || "Failed to send message");
    }
  };

  useHotkeys("mod+enter", () => sendMessage(), [sendMessage]);

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a conversation
      </div>
    );
  }

  const name = buyer
    ? buyer.full_name || `${buyer.fname || ""} ${buyer.lname || ""}`.trim() || "Unnamed"
    : thread.phone_number;
  const { segments: smsSegments, remaining } = calculateSmsSegments(input);
  const selectValue = selectedDid || preferredFrom || undefined;

  const handleBlock = async () => {
    if (!thread || !thread.buyer_id) return;
    const { error } = await supabase
      .from("buyers")
      .update({ status: "blocked" })
      .eq("id", thread.buyer_id);
    if (error) {
      console.error(error);
      toast.error("Failed to block buyer");
    } else {
      setBuyer((b) => (b ? { ...b, status: "blocked" } : b));
      toast.success("Buyer blocked");
    }
  };

  const handleUnsubscribe = async () => {
    if (!thread || !thread.buyer_id) return;
    try {
      await BuyerService.unsubscribeBuyer(thread.buyer_id);
      setBuyer((b) =>
        b ? { ...b, can_receive_sms: false, can_receive_email: false } : b,
      );
      toast.success("Buyer unsubscribed");
    } catch (err) {
      console.error(err);
      toast.error("Failed to unsubscribe");
    }
  };

  const handleDelete = async () => {
    if (!thread) return;
    const ts = new Date().toISOString();
    const { error: msgErr } = await supabase
      .from("messages")
      .update({ deleted_at: ts })
      .eq("thread_id", thread.id);
    const { error: threadErr } = await supabase
      .from("message_threads")
      .update({ deleted_at: ts })
      .eq("id", thread.id);
    if (msgErr || threadErr) {
      console.error(msgErr || threadErr);
      toast.error("Failed to delete conversation");
    } else {
      setMessages([]);
      toast.success("Conversation deleted");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b p-2 flex items-center justify-between sticky top-0 bg-background z-10">
        <span className="font-medium">{name}</span>
        <div className="flex items-center gap-2">
          {buyer ? (
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              Info
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
              Add Buyer
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <span className="sr-only">Actions</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 7a2 2 0 110-4 2 2 0 010 4zm0 2a2 2 0 100 4 2 2 0 000-4zm0 6a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleBlock}>Block</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleUnsubscribe}>
                Unsubscribe
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/20"
                onSelect={handleDelete}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => {
          if (m.direction === "event") {
            const upper = m.body.toUpperCase();
            let eventText = m.body;
            if (upper.startsWith("UNSUBSCRIBED")) {
              eventText = `${name} unsubscribed`;
            } else if (upper.startsWith("MISSED CALL")) {
              eventText = `Missed call from ${name}`;
            } else if (upper.startsWith("CALL")) {
              const match = m.body.match(/\(([^)]+)\)/);
              const dur = match ? match[1] : "";
              eventText = `${name} called you${dur ? ` (${dur})` : ""}`;
            }
            return (
              <div
                key={m.id}
                className="mx-auto flex w-fit max-w-[75%] flex-col items-center rounded-md bg-muted px-2 py-1"
              >
                <span className="text-[10px] uppercase text-muted-foreground">{eventText}</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </div>
            );
          }
          if (m.direction === "email") {
            return (
              <div
                key={m.id}
                className="mx-auto flex w-fit max-w-[75%] flex-col items-center rounded-md bg-muted px-2 py-1"
              >
                <span className="text-[10px] uppercase text-muted-foreground">EMAIL SENT</span>
                {m.subject && <span className="text-xs font-medium">{m.subject}</span>}
                {m.body && (
                  <span className="text-xs text-muted-foreground">{m.body}</span>
                )}
                <span className="mt-1 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </div>
            );
          }
          const isOutbound = m.direction === "outbound";
          const time = new Date(m.created_at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });
          const prefix = isOutbound ? "You" : buyer?.fname || name.split(" ")[0];
          const bubbleClass = cn(
            "w-fit max-w-[75%] break-words rounded-xl px-3 py-2 text-sm",
            isOutbound
              ? m.status === "failed"
                ? "ml-auto bg-red-200 text-red-900"
                : "ml-auto bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          );
          const audioSrc = parseAudioUrl((m as any).audioUrl || (m as any).audio_url)
          const Status = (
            <>
              {m.status === "sending" && (
                <span className="ml-2 text-xs text-muted-foreground">Sending...</span>
              )}
              {m.status === "failed" && (
                <button
                  className="ml-2 text-xs underline"
                  onClick={() => retryMessage(m)}
                >
                  Retry
                </button>
              )}
              {m.error && (
                <div className="mt-1 text-xs text-red-700">{m.error}</div>
              )}
            </>
          );
          const didLabel = isOutbound
            ? formatDidDisplay(m.from_number)
            : formatDidDisplay(m.to_number);
          const pillLabel = didLabel
            ? `${isOutbound ? "From" : "To"}: ${didLabel}`
            : null;
          return (
            <div key={m.id} className="flex flex-col">
              <div
                className={cn(
                  "relative flex flex-col gap-1 pt-3",
                  isOutbound ? "items-end" : "items-start",
                )}
              >
                {pillLabel && (
                  <span
                    className={cn(
                      "absolute -top-1 rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm",
                      isOutbound ? "right-0" : "left-0",
                    )}
                  >
                    {pillLabel}
                  </span>
                )}
                {(m.media_urls && m.media_urls.length > 0) || audioSrc ? (
                  <div className={bubbleClass}>
                    <div className="space-y-1">
                      {audioSrc && (
                        <audio controls className="rounded-xl w-full max-w-xs bg-white shadow">
                          <source src={audioSrc} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                      )}
                      {m.media_urls?.map((url, idx) => (
                        <MediaAttachment key={idx} url={url} />
                      ))}
                    </div>
                    {!m.body && Status}
                  </div>
                ) : null}
                {m.body && (
                  <div className={cn(bubbleClass, m.media_urls?.length ? "mt-1" : "")}>
                    <span>{m.body}</span>
                    {Status}
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "mt-1 text-xs text-muted-foreground",
                  isOutbound && "text-right",
                )}
              >
                {prefix} • {time}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t p-2 space-y-2 sticky bottom-0 bg-background">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          className="w-full min-h-[96px]"
        />
        <div className="border-t pt-2 flex gap-2 flex-wrap">
          <DropdownMenu open={showEmoji} onOpenChange={setShowEmoji}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                title="Insert emoji"
                aria-label="Insert emoji"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="p-0">
              <EmojiPicker
                onEmojiClick={(e) => insertPlaceholder(e.emoji)}
                width="100%"
                height={300}
                searchDisabled
                lazyLoadEmojis
              />
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                title="Insert template"
                aria-label="Insert template"
              >
                <Clipboard className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {templates.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() => setInput(t.message)}
                >
                  {t.name}
                </DropdownMenuItem>
              ))}
              {templates.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => setShowQuickReplyModal(true)}>
                New quick reply…
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/templates/quick_reply">Manage templates…</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                title="Insert merge tag"
                aria-label="Insert merge tag"
              >
                <Tag className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {mergeTags.map((tag) => (
                <DropdownMenuItem
                  key={tag.value}
                  onSelect={() => insertPlaceholder(tag.value)}
                >
                  {tag.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Add media"
                title="Add media"
                variant="outline"
                size="icon"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={() => {
                  setUploadType("photo")
                  setShowUpload(true)
                }}
              >
                Photo
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setUploadType("video")
                  setShowUpload(true)
                }}
              >
                Video
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            aria-label="Record voice"
            title="Record voice note"
            variant="outline"
            size="icon"
            onClick={() => setShowRecorder(true)}
          >
            <Mic className="h-4 w-4" />
          </Button>
          <Popover open={schedulePicker} onOpenChange={setSchedulePicker}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                title="Schedule message"
                aria-label="Schedule message"
              >
                <Clock className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-2">
              <Calendar
                mode="single"
                selected={scheduleDate ?? undefined}
                onSelect={setScheduleDate}
              />
              <Input
                id="schedule-time"
                name="schedule-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </PopoverContent>
          </Popover>
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
          {attachments.map((file, idx) => {
            const lower = file.name.toLowerCase();
            const isImg =
              file.type.startsWith("image/") || /(jpg|jpeg|png|gif|bmp|webp)$/.test(lower);
            const isVideo =
              file.type.startsWith("video/") ||
              (!file.type.startsWith("audio/") && /(mp4|webm|3gp)$/.test(lower));
            // use isPlayableAudioUrl so webm recordings preview correctly
            const isPlayableAudio = isPlayableAudioUrl(lower);
            const isAudio =
              file.type.startsWith("audio/") ||
              isPlayableAudio;
            const url = URL.createObjectURL(file);
            return (
              <div key={idx} className="relative inline-block">
                {isImg ? (
                  <Image
                    src={url}
                    alt="preview"
                    width={128}
                    height={128}
                    className="max-h-32 rounded-md"
                  />
                ) : isVideo ? (
                  <video controls className="max-h-32" src={url} crossOrigin="anonymous" />
                ) : isPlayableAudio ? (
                  <audio controls className="max-h-32" src={url} crossOrigin="anonymous" />
                ) : isAudio ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs underline"
                  >
                    {file.name}
                  </a>
                ) : (
                  <span className="block text-xs">{file.name}</span>
                )}
                <X
                  className="h-4 w-4 absolute -right-2 -top-2 bg-white dark:bg-gray-800 rounded-full cursor-pointer"
                  onClick={() => removeAttachment(idx)}
                />
              </div>
            );
          })}
          </div>
        )}
        {bannerDid && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>
              {thread.campaign_id && preferredFrom
                ? `Campaign sticky is ${formatDidDisplay(preferredFrom)}. `
                : ""}
              They texted your other line {bannerDidLabel}. We switched your reply to
              {" "}
              {bannerDidLabel}. Prefer to use {stickyDidLabel ?? "your saved number"}?
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={handleBannerSwitch}>
                Stay on {bannerDidLabel}
              </Button>
              <Button size="sm" variant="outline" onClick={handleBannerKeep}>
                Use {stickyDidLabel ?? "saved number"}
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs uppercase text-muted-foreground">From</span>
            <Select
              value={selectValue}
              onValueChange={(value) => {
                void handleDidChange(value)
              }}
              disabled={didOptions.length === 0}
            >
              <SelectTrigger className="h-8 min-w-[160px] text-xs">
                <SelectValue placeholder={didOptions.length ? "Select number" : "No numbers"} />
              </SelectTrigger>
              <SelectContent>
                {didOptions.map((num) => (
                  <SelectItem key={num} value={num}>
                    {formatDidDisplay(num)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
            <div
              className={`text-xs text-right ${smsSegments > 1 ? "text-red-600" : "text-muted-foreground"}`}
            >
              {remaining} characters remaining · {smsSegments} segment
              {smsSegments > 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-2">
              {oversizedNonImages.length > 0 && (
                <span className="text-xs text-amber-600 mr-2">
                  Files over 1MB will send as download links instead of MMS.
                </span>
              )}
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={!input.trim() && attachments.length === 0}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
      <EditBuyerModal
        open={showEdit}
        onOpenChange={setShowEdit}
        buyer={buyer}
        onSuccess={() => {
          if (buyer) setBuyer(buyer);
        }}
      />
      <AddBuyerModal
        open={showAdd}
        onOpenChange={setShowAdd}
        initialPhone={thread.phone_number}
        onSuccessAction={async (b) => {
          if (!thread) return;
          await supabase
            .from("message_threads")
            .update({ buyer_id: b.id })
            .eq("id", thread.id);
          setBuyer(b);
          queryClient.invalidateQueries({ queryKey: ["message-threads"] });
        }}
      />
      <VoiceRecorder
        open={showRecorder}
        onOpenChange={setShowRecorder}
        onSave={(file) =>
          setAttachments((prev) => [...prev, file])
        }
      />
      <UploadModal
        open={showUpload}
        onOpenChange={(open) => {
          setShowUpload(open)
          if (!open) setUploadType(null)
        }}
        uploadType={uploadType}
        onAddFiles={(files) =>
          setAttachments((prev) => [...prev, ...files])
        }
      />
      <QuickReplyModal
        open={showQuickReplyModal}
        onOpenChange={setShowQuickReplyModal}
        onCreated={(tpl) => {
          setTemplates((prev) => [tpl, ...prev])
          void loadQuickReplies()
        }}
        mergeTags={mergeTags}
      />
    </div>
  );
}
