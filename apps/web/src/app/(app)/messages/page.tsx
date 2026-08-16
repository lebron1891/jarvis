"use client";

import { CheckCheck, FileText, Image as ImageIcon, Mic, Paperclip, Send, Smile, Square } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageLoader } from "@/components/ui/spinner";
import { apiGet, apiPost, uploadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import type { Conversation, Message, MessageReaction } from "@/lib/types";
import { cn, formatTime, timeAgo } from "@/lib/utils";

const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🙏", "🔥"];

function MessagesInner() {
  const { user } = useAuth();
  const params = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(params.get("c"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerReadAt, setPeerReadAt] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiGet<{ conversations: Conversation[] }>("/api/conversations");
      setConversations(data.conversations);
      if (!activeId && data.conversations[0]) setActiveId(data.conversations[0].id);
    } catch {
      setConversations([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for the active conversation and join its socket room.
  useEffect(() => {
    if (!activeId) return;
    setLoadingMessages(true);
    setPeerTyping(false);
    setPeerReadAt(null);
    apiGet<{ messages: Message[] }>(`/api/conversations/${activeId}/messages`)
      .then((d) => setMessages(d.messages))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
    apiPost(`/api/conversations/${activeId}/read`).catch(() => undefined);

    const socket = getSocket();
    socket?.emit("conversation:join", activeId);
    return () => {
      socket?.emit("conversation:leave", activeId);
    };
  }, [activeId]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;
    const onMessage = (m: Message) => {
      if (m.conversationId === activeId) {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.senderId !== user.id) {
          apiPost(`/api/conversations/${activeId}/read`).catch(() => undefined);
        }
      }
      loadConversations();
    };
    const onTyping = (p: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (p.conversationId === activeId && p.userId !== user.id) setPeerTyping(p.isTyping);
    };
    const onReactions = (p: { messageId: string; reactions: MessageReaction[] }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === p.messageId ? { ...m, reactions: p.reactions } : m)),
      );
    };
    const onRead = (p: { conversationId: string; userId: string; at: string }) => {
      if (p.conversationId === activeId && p.userId !== user.id) setPeerReadAt(p.at);
    };
    socket.on("message:new", onMessage);
    socket.on("typing", onTyping);
    socket.on("message:reactions", onReactions);
    socket.on("conversation:read", onRead);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("typing", onTyping);
      socket.off("message:reactions", onReactions);
      socket.off("conversation:read", onRead);
    };
  }, [activeId, user, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  const emitTyping = (isTyping: boolean) => {
    if (!activeId) return;
    getSocket()?.emit("typing", { conversationId: activeId, isTyping });
  };

  function onTextChange(value: string) {
    setText(value);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1500);
  }

  async function sendText(e?: React.FormEvent) {
    e?.preventDefault();
    if (!activeId || !text.trim()) return;
    const body = text.trim();
    setText("");
    emitTyping(false);
    try {
      const { message } = await apiPost<{ message: Message }>(
        `/api/conversations/${activeId}/messages`,
        { type: "TEXT", body },
      );
      setMessages((prev) => (prev.some((x) => x.id === message.id) ? prev : [...prev, message]));
      loadConversations();
    } catch {
      setText(body);
    }
  }

  async function sendFile(file: File) {
    if (!activeId) return;
    const uploaded = await uploadFile(file);
    const type = file.type.startsWith("image/") ? "IMAGE" : "FILE";
    const { message } = await apiPost<{ message: Message }>(
      `/api/conversations/${activeId}/messages`,
      { type, fileUrl: uploaded.url, fileName: uploaded.fileName },
    );
    setMessages((prev) => (prev.some((x) => x.id === message.id) ? prev : [...prev, message]));
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (blob.size < 1000 || !activeId) return;
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        const uploaded = await uploadFile(file);
        const { message } = await apiPost<{ message: Message }>(
          `/api/conversations/${activeId}/messages`,
          { type: "VOICE", fileUrl: uploaded.url, fileName: uploaded.fileName },
        );
        setMessages((prev) => [...prev, message]);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      /* microphone denied */
    }
  }

  async function react(messageId: string, emoji: string) {
    setEmojiFor(null);
    await apiPost(`/api/conversations/messages/${messageId}/reactions`, { emoji }).catch(
      () => undefined,
    );
  }

  if (!user) return null;
  const active = conversations?.find((c) => c.id === activeId);
  const peer = active?.participants.find((p) => p.id !== user.id);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4 animate-fade-in">
      {/* Conversation list */}
      <aside
        className={cn(
          "card w-full shrink-0 overflow-y-auto sm:w-72",
          activeId && "hidden sm:block",
        )}
      >
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h1 className="font-semibold">Messages</h1>
        </div>
        {conversations === null ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-400">
            No conversations yet. Message a teacher from their profile!
          </p>
        ) : (
          conversations.map((c) => {
            const other = c.participants.find((p) => p.id !== user.id);
            if (!other) return null;
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                  c.id === activeId && "bg-brand-50/60 dark:bg-brand-500/10",
                )}
              >
                <Avatar name={other.name} src={other.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium">{other.name}</p>
                    {c.lastMessage && (
                      <span className="text-[11px] text-zinc-400">{timeAgo(c.lastMessage.createdAt)}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-zinc-500">
                    {c.lastMessage
                      ? c.lastMessage.type === "TEXT"
                        ? c.lastMessage.body
                        : `📎 ${c.lastMessage.type.toLowerCase()}`
                      : "Say hi 👋"}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
                    {c.unread}
                  </span>
                )}
              </button>
            );
          })
        )}
      </aside>

      {/* Chat pane */}
      <section className={cn("card flex min-w-0 flex-1 flex-col", !activeId && "hidden sm:flex")}>
        {!active || !peer ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState title="Select a conversation" />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <button className="sm:hidden text-sm text-brand-600" onClick={() => setActiveId(null)}>
                ←
              </button>
              <Avatar name={peer.name} src={peer.avatarUrl} size="sm" />
              <div>
                <p className="text-sm font-medium">{peer.name}</p>
                <p className="text-xs text-zinc-400">
                  {peerTyping ? (
                    <span className="text-brand-500">typing…</span>
                  ) : (
                    `@${peer.username}`
                  )}
                </p>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {loadingMessages ? (
                <PageLoader />
              ) : (
                messages.map((m, i) => {
                  const mine = m.senderId === user.id;
                  const isLastMine = mine && i === messages.length - 1;
                  const seen =
                    isLastMine && peerReadAt && new Date(peerReadAt) >= new Date(m.createdAt);
                  return (
                    <div key={m.id} className={cn("group flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn("relative max-w-[75%]")}>
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                            mine
                              ? "rounded-br-md bg-brand-600 text-white"
                              : "rounded-bl-md bg-zinc-100 dark:bg-zinc-800",
                          )}
                        >
                          {m.deletedAt ? (
                            <em className="opacity-60">Message removed</em>
                          ) : m.type === "IMAGE" && m.fileUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.fileUrl} alt={m.fileName ?? "image"} className="max-h-64 rounded-lg" />
                          ) : m.type === "VOICE" && m.fileUrl ? (
                            <audio controls src={m.fileUrl} className="max-w-full" />
                          ) : m.type === "FILE" && m.fileUrl ? (
                            <a
                              href={m.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 underline underline-offset-2"
                            >
                              <FileText className="h-4 w-4" />
                              {m.fileName ?? "Attachment"}
                            </a>
                          ) : (
                            m.body
                          )}
                          <span className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", mine ? "text-white/60" : "text-zinc-400")}>
                            {formatTime(m.createdAt)}
                            {seen && <CheckCheck className="h-3 w-3" />}
                          </span>
                        </div>
                        {m.reactions.length > 0 && (
                          <div className={cn("absolute -bottom-3 flex gap-0.5", mine ? "right-2" : "left-2")}>
                            {Object.entries(
                              m.reactions.reduce<Record<string, number>>((acc, r) => {
                                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                                return acc;
                              }, {}),
                            ).map(([emoji, count]) => (
                              <button
                                key={emoji}
                                onClick={() => react(m.id, emoji)}
                                className="rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                              >
                                {emoji}
                                {count > 1 && <span className="ml-0.5 text-[10px]">{count}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* React trigger */}
                        {!m.deletedAt && (
                          <button
                            onClick={() => setEmojiFor(emojiFor === m.id ? null : m.id)}
                            className={cn(
                              "absolute top-1 hidden rounded-full bg-white p-1 text-zinc-400 shadow group-hover:block dark:bg-zinc-800",
                              mine ? "-left-8" : "-right-8",
                            )}
                            aria-label="React"
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {emojiFor === m.id && (
                          <div
                            className={cn(
                              "absolute z-10 flex gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 shadow-lift dark:border-zinc-700 dark:bg-zinc-900",
                              mine ? "right-0 -top-9" : "left-0 -top-9",
                            )}
                          >
                            {QUICK_EMOJI.map((e) => (
                              <button key={e} onClick={() => react(m.id, e)} className="text-lg transition hover:scale-125">
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {peerTyping && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={sendText}
              className="flex items-center gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) sendFile(f).catch(() => undefined);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                aria-label="Attach a file"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hidden rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 sm:block"
                aria-label="Send an image"
              >
                <ImageIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={toggleRecording}
                className={cn(
                  "rounded-xl p-2 transition",
                  recording
                    ? "animate-pulse bg-red-100 text-red-600 dark:bg-red-500/20"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800",
                )}
                aria-label={recording ? "Stop recording" : "Record a voice message"}
              >
                {recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <input
                className="input flex-1"
                placeholder={`Message ${peer.name.split(" ")[0]}…`}
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="rounded-xl bg-brand-600 p-2.5 text-white transition hover:bg-brand-500 disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <MessagesInner />
    </Suspense>
  );
}
