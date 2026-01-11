import { useState, useEffect, useCallback, useRef } from "react";
import type { User, Chat, Message } from "@shared/schema";

function storageKey(userId: number) {
  return `chat_cutoffs_v1_${userId}`;
}

function loadCutoffs(userId: number): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveCutoffs(userId: number, data: Record<string, string>) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(data));
  } catch {}
}

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.token || u?.accessToken || localStorage.getItem("token") || null;
  } catch {
    return localStorage.getItem("token");
  }
}

async function authedFetch(url: string, init?: RequestInit) {
  const token = getAuthToken();
  if (!token) throw new Error("Missing token");

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    const msg = json?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json;
}

function toMs(dateLike: any): number {
  const t = new Date(dateLike).getTime();
  return Number.isFinite(t) ? t : 0;
}

// ✅ Upload helper: sendet Datei zu /api/upload und liefert url zurück
async function uploadFile(file: File): Promise<{
  ok: boolean;
  url: string;
  filename?: string;
  originalName?: string;
  size?: number;
  mimetype?: string;
}> {
  const token = getAuthToken();
  if (!token) throw new Error("Missing token");

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // ⚠️ NICHT Content-Type setzen bei FormData
    },
    body: fd,
  });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    throw new Error(json?.message || `Upload failed (HTTP ${res.status})`);
  }

  if (!json?.ok || !json?.url) {
    throw new Error("Upload failed (invalid response)");
  }

  return json;
}

export function usePersistentChats(userId?: number, socket?: any) {
  const [persistentContacts, setPersistentContacts] = useState<
    Array<Chat & { otherUser: User; unreadCount?: number }>
  >([]);
  const [activeMessages, setActiveMessages] = useState<Map<number, Message[]>>(new Map());
  const [selectedChat, setSelectedChat] = useState<(Chat & { otherUser: User }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Map<number, number>>(new Map());

  // ✅ Typing: chatId -> true
  const [typingByChat, setTypingByChat] = useState<Map<number, boolean>>(new Map());
  const typingTimeoutsRef = useRef<Map<number, any>>(new Map());

  const deletionTimersRef = useRef<Map<number, any>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ Cutoff map: chatId -> deletedAt ISO
  const cutoffsRef = useRef<Record<string, string>>({});

  const clearTypingTimer = useCallback((chatId: number) => {
    const t = typingTimeoutsRef.current.get(chatId);
    if (t) clearTimeout(t);
    typingTimeoutsRef.current.delete(chatId);
  }, []);

  const setTypingState = useCallback((chatId: number, isTyping: boolean) => {
    setTypingByChat((prev) => {
      const next = new Map(prev);
      if (isTyping) next.set(chatId, true);
      else next.delete(chatId);
      return next;
    });
  }, []);

  // --------------------------
  // Self-destruct timers
  // --------------------------
  const clearTimer = (messageId: number) => {
    const t = deletionTimersRef.current.get(messageId);
    if (t) clearTimeout(t);
    deletionTimersRef.current.delete(messageId);
  };

  const scheduleMessageDeletion = useCallback((message: Message) => {
    try {
      const expiresAtMs = toMs((message as any).expiresAt);
      const now = Date.now();
      const ms = Math.max(expiresAtMs - now, 200);

      clearTimer(message.id);

      const timer = setTimeout(() => {
        setActiveMessages((prev) => {
          const next = new Map(prev);
          const arr = next.get(message.chatId) || [];
          next.set(message.chatId, arr.filter((m) => m.id !== message.id));
          return next;
        });
        clearTimer(message.id);
      }, ms);

      deletionTimersRef.current.set(message.id, timer);
    } catch (e) {
      console.error("scheduleMessageDeletion error:", e);
    }
  }, []);

  // --------------------------
  // Cutoff helpers
  // --------------------------
  const getCutoffMs = useCallback(
    (chatId: number): number => {
      if (!userId) return 0;
      const iso = cutoffsRef.current[String(chatId)];
      return iso ? toMs(iso) : 0;
    },
    [userId]
  );

  const setCutoffNow = useCallback(
    (chatId: number) => {
      if (!userId) return;
      const nowIso = new Date().toISOString();
      cutoffsRef.current[String(chatId)] = nowIso;
      saveCutoffs(userId, cutoffsRef.current);
    },
    [userId]
  );

  const filterByCutoff = useCallback(
    (chatId: number, msgs: any[]): any[] => {
      const cutoff = getCutoffMs(chatId);
      if (!cutoff) return msgs || [];
      return (msgs || []).filter((m: any) => toMs(m.createdAt) > cutoff);
    },
    [getCutoffMs]
  );

  // --------------------------
  // Load messages
  // --------------------------
  const loadActiveMessages = useCallback(
    async (chatId: number) => {
      try {
        const msgsRaw = await authedFetch(`/api/chats/${chatId}/messages`);
        const msgs = filterByCutoff(chatId, Array.isArray(msgsRaw) ? msgsRaw : []);

        setActiveMessages((prev) => {
          const next = new Map(prev);
          next.set(chatId, msgs);
          return next;
        });

        msgs.forEach((m: Message) => scheduleMessageDeletion(m));
      } catch (e) {
        console.error(`❌ loadActiveMessages chat=${chatId}:`, e);
        setActiveMessages((prev) => {
          const next = new Map(prev);
          next.set(chatId, []);
          return next;
        });
      }
    },
    [scheduleMessageDeletion, filterByCutoff]
  );

  // --------------------------
  // Load contacts
  // --------------------------
  const loadPersistentContacts = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const contacts = await authedFetch(`/api/chats/${userId}`);

      const newUnread = new Map<number, number>();
      (contacts || []).forEach((c: any) => {
        let unread = 0;
        if (userId === c.participant1Id) unread = c.unreadCount1 || 0;
        else if (userId === c.participant2Id) unread = c.unreadCount2 || 0;
        c.unreadCount = unread;
        if (unread > 0) newUnread.set(c.id, unread);
      });

      const sorted = (contacts || []).sort((a: any, b: any) => {
        const aTime = a.lastMessage?.createdAt || a.lastMessageTimestamp || a.createdAt;
        const bTime = b.lastMessage?.createdAt || b.lastMessageTimestamp || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setUnreadCounts(newUnread);
      setPersistentContacts(sorted);

      for (const c of sorted) {
        await loadActiveMessages(c.id);
      }
    } catch (e) {
      console.error("❌ loadPersistentContacts:", e);
    } finally {
      setIsLoading(false);
    }
  }, [userId, loadActiveMessages]);

  // --------------------------
  // Select chat
  // --------------------------
  const selectChat = useCallback(
    async (chat: (Chat & { otherUser: User }) | null) => {
      setSelectedChat(chat);
      if (!chat || !userId) return;

      try {
        await authedFetch(`/api/chats/${chat.id}/mark-read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch {}

      setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.delete(chat.id);
        return next;
      });
      setPersistentContacts((prev) =>
        prev.map((c: any) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c))
      );

      await loadActiveMessages(chat.id);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    },
    [userId, loadActiveMessages]
  );

  // --------------------------
  // Delete chat
  // --------------------------
  const deleteChat = useCallback(
    async (chatId: number) => {
      if (!userId) return;

      setCutoffNow(chatId);

      setActiveMessages((prev) => {
        const next = new Map(prev);
        next.set(chatId, []);
        return next;
      });

      setSelectedChat((prev) => (prev?.id === chatId ? null : prev));

      try {
        await authedFetch(`/api/chats/${chatId}/delete`, { method: "POST" });
      } catch (e) {
        console.error("deleteChat server failed:", e);
      }

      await loadPersistentContacts();
    },
    [userId, setCutoffNow, loadPersistentContacts]
  );

  // --------------------------
  // Send typing
  // --------------------------
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!selectedChat || !userId) return false;
      if (!socket?.send) return false;

      return socket.send({
        type: "typing",
        chatId: selectedChat.id,
        senderId: userId,
        receiverId: selectedChat.otherUser.id,
        isTyping: Boolean(isTyping),
      });
    },
    [selectedChat, userId, socket]
  );

  // --------------------------
  // ✅ Send message: wenn file -> upload -> WS nur URL
  // --------------------------
  const sendMessage = useCallback(
    async (content: string, type: string = "text", destructTimerSec: number, file?: File) => {
      if (!selectedChat || !userId) return;
      if (!socket?.send) return;

      const secs = Math.max(Number(destructTimerSec) || 0, 5);
      const tempId = Date.now();

      // Optimistic content:
      // - image: local preview (blob url)
      // - file: filename
      // - text: content
      const optimisticContent =
        type === "image" && file
          ? URL.createObjectURL(file)
          : type === "file" && file
          ? file.name
          : content;

      const optimistic: any = {
        id: tempId,
        chatId: selectedChat.id,
        senderId: userId,
        receiverId: selectedChat.otherUser.id,
        content: optimisticContent,
        messageType: type,
        fileName: file?.name,
        fileSize: file?.size,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + secs * 1000).toISOString(),
      };

      setActiveMessages((prev) => {
        const next = new Map(prev);
        const arr = next.get(selectedChat.id) || [];
        next.set(selectedChat.id, [...arr, optimistic]);
        return next;
      });
      scheduleMessageDeletion(optimistic);

      let finalContent = content;
      let fileName: string | undefined;
      let fileSize: number | undefined;

      // ✅ Upload wenn file vorhanden
      try {
        if (file) {
          const up = await uploadFile(file);
          finalContent = up.url; // ✅ URL in DB + WS
          fileName = up.originalName || file.name;
          fileSize = up.size || file.size;

          // optimistic update auf echte URL
          setActiveMessages((prev) => {
            const next = new Map(prev);
            const arr = next.get(selectedChat.id) || [];
            next.set(
              selectedChat.id,
              arr.map((m: any) =>
                m.id === tempId
                  ? { ...m, content: finalContent, fileName, fileSize }
                  : m
              )
            );
            return next;
          });
        }
      } catch (e) {
        console.error("❌ Upload failed:", e);
        // remove optimistic
        setActiveMessages((prev) => {
          const next = new Map(prev);
          const arr = next.get(selectedChat.id) || [];
          next.set(selectedChat.id, arr.filter((m: any) => m.id !== tempId));
          return next;
        });
        return;
      }

      // ✅ WS send NUR JSON (klein)
      const wsPayload: any = {
        type: "message",
        chatId: selectedChat.id,
        senderId: userId,
        receiverId: selectedChat.otherUser.id,
        content: finalContent,
        messageType: type,
        destructTimer: secs,
      };

      if (file) {
        wsPayload.fileName = fileName || file.name;
        wsPayload.fileSize = fileSize || file.size;
      }

      const ok = socket.send(wsPayload);
      if (!ok) console.warn("⚠️ WS not open -> queued");
    },
    [selectedChat, userId, socket, scheduleMessageDeletion]
  );

  // --------------------------
  // Incoming WS (messages + typing)
  // --------------------------
  useEffect(() => {
    if (!socket?.on || !userId) return;

    const onTyping = (data: any) => {
      if (data?.type !== "typing") return;

      const chatId = Number(data.chatId) || 0;
      const senderId = Number(data.senderId) || 0;
      const receiverId = Number(data.receiverId) || 0;
      const isTyping = Boolean(data.isTyping);

      if (!chatId || receiverId !== userId) return;
      if (senderId === userId) return;

      clearTypingTimer(chatId);
      setTypingState(chatId, isTyping);

      if (isTyping) {
        const t = setTimeout(() => {
          setTypingState(chatId, false);
          clearTypingTimer(chatId);
        }, 3000);
        typingTimeoutsRef.current.set(chatId, t);
      }
    };

    const onMsg = (data: any) => {
      if (data?.type === "typing") {
        onTyping(data);
        return;
      }

      if (data?.type !== "new_message" || !data.message) return;
      const m: any = data.message;

      if (m.receiverId !== userId) return;

      // cutoff filter
      const cutoff = getCutoffMs(m.chatId);
      if (cutoff) {
        const created = toMs(m.createdAt);
        if (created && created <= cutoff) return;
      }

      setActiveMessages((prev) => {
        const next = new Map(prev);
        const arr = next.get(m.chatId) || [];
        if (!arr.some((x: any) => x.id === m.id)) {
          next.set(m.chatId, [...arr, m]);
        }
        return next;
      });

      scheduleMessageDeletion(m);

      if (!selectedChat || selectedChat.id !== m.chatId) {
        setUnreadCounts((prev) => {
          const next = new Map(prev);
          const c = next.get(m.chatId) || 0;
          next.set(m.chatId, c + 1);
          return next;
        });
      }

      setTimeout(() => loadPersistentContacts(), 100);
    };

    socket.on("typing", onTyping);
    socket.on("message", onMsg);

    return () => {
      socket.off?.("typing", onTyping);
      socket.off?.("message", onMsg);
    };
  }, [
    socket,
    userId,
    selectedChat,
    scheduleMessageDeletion,
    loadPersistentContacts,
    getCutoffMs,
    clearTypingTimer,
    setTypingState,
  ]);

  // --------------------------
  // Initial load
  // --------------------------
  useEffect(() => {
    if (!userId) return;
    cutoffsRef.current = loadCutoffs(userId);
    loadPersistentContacts();
  }, [userId, loadPersistentContacts]);

  useEffect(() => {
    return () => {
      deletionTimersRef.current.forEach((t) => clearTimeout(t));
      deletionTimersRef.current.clear();

      typingTimeoutsRef.current.forEach((t) => clearTimeout(t));
      typingTimeoutsRef.current.clear();
    };
  }, []);

  const messages = selectedChat ? activeMessages.get(selectedChat.id) || [] : [];
  const isOtherTyping = selectedChat ? Boolean(typingByChat.get(selectedChat.id)) : false;

  return {
    persistentContacts,
    messages,
    selectedChat,
    isOtherTyping,
    typingByChat,
    isLoading,
    selectChat,
    sendMessage,
    sendTyping,
    messagesEndRef,
    loadPersistentContacts,
    unreadCounts,
    deleteChat,
  };
}
