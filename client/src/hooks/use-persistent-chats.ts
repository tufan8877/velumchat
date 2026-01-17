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

function toMs(dateLike: any): number {
  const t = new Date(dateLike).getTime();
  return Number.isFinite(t) ? t : 0;
}

// ✅ Abortable fetch helper (verhindert “endlos laden”)
async function authedFetch(url: string, init?: RequestInit, timeoutMs = 15000) {
  const token = getAuthToken();
  if (!token) throw new Error("Missing token");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
}

// ✅ Upload helper
async function uploadFile(file: File, timeoutMs = 30000): Promise<{
  ok: boolean;
  url: string;
  filename?: string;
  originalName?: string;
  size?: number;
  mimetype?: string;
}> {
  const token = getAuthToken();
  if (!token) throw new Error("Missing token");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    const text = await res.text().catch(() => "");
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}

    if (!res.ok) throw new Error(json?.message || `Upload failed (HTTP ${res.status})`);
    if (!json?.ok || !json?.url) throw new Error("Upload failed (invalid response)");

    return json;
  } finally {
    clearTimeout(timer);
  }
}

export function usePersistentChats(userId?: number, socket?: any) {
  const [persistentContacts, setPersistentContacts] = useState<
    Array<Chat & { otherUser: User; unreadCount?: number }>
  >([]);
  const [activeMessages, setActiveMessages] = useState<Map<number, Message[]>>(new Map());
  const [selectedChat, setSelectedChat] = useState<(Chat & { otherUser: User }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ Unread badge state (chatId -> count)
  const [unreadCounts, setUnreadCounts] = useState<Map<number, number>>(new Map());

  // ✅ Typing
  const [typingByChat, setTypingByChat] = useState<Map<number, boolean>>(new Map());
  const typingTimeoutsRef = useRef<Map<number, any>>(new Map());

  const deletionTimersRef = useRef<Map<number, any>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cutoffsRef = useRef<Record<string, string>>({});

  // --------------------------
  // Typing helpers
  // --------------------------
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
  // Load messages (nur wenn Chat geöffnet wird)
  // --------------------------
  const loadActiveMessages = useCallback(
    async (chatId: number) => {
      try {
        const msgsRaw = await authedFetch(`/api/chats/${chatId}/messages`, undefined, 15000);
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
  // Load contacts (OHNE Messages Prefetch) + Unread MERGE
  // --------------------------
  const loadPersistentContacts = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const contacts = await authedFetch(`/api/chats/${userId}`, undefined, 15000);

      const serverUnread = new Map<number, number>();
      (contacts || []).forEach((c: any) => {
        let unread = 0;
        if (userId === c.participant1Id) unread = c.unreadCount1 || 0;
        else if (userId === c.participant2Id) unread = c.unreadCount2 || 0;

        c.unreadCount = unread;
        if (unread > 0) serverUnread.set(c.id, unread);
      });

      // ✅ MERGE: lokal nicht mit 0 überschreiben
      setUnreadCounts((prev) => {
        const next = new Map(prev);
        for (const [chatId, cnt] of serverUnread.entries()) {
          const cur = next.get(chatId) || 0;
          next.set(chatId, Math.max(cur, cnt));
        }
        return next;
      });

      const sorted = (contacts || []).sort((a: any, b: any) => {
        const aTime = a.lastMessage?.createdAt || a.lastMessageTimestamp || a.createdAt;
        const bTime = b.lastMessage?.createdAt || b.lastMessageTimestamp || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setPersistentContacts(sorted);
    } catch (e) {
      console.error("❌ loadPersistentContacts:", e);
      setPersistentContacts([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // --------------------------
  // Select chat
  // --------------------------
  const selectChat = useCallback(
    async (chat: (Chat & { otherUser: User }) | null) => {
      setSelectedChat(chat);
      if (!chat || !userId) return;

      try {
        await authedFetch(
          `/api/chats/${chat.id}/mark-read`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
          15000
        );
      } catch {}

      // clear badge
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

      setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.delete(chatId);
        return next;
      });

      try {
        await authedFetch(`/api/chats/${chatId}/delete`, { method: "POST" }, 15000);
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
  // Send message (upload if file)
  // --------------------------
  const sendMessage = useCallback(
    async (content: string, type: string = "text", destructTimerSec: number, file?: File) => {
      if (!selectedChat || !userId) return;
      if (!socket?.send) return;

      const secs = Math.max(Number(destructTimerSec) || 0, 5);
      const tempId = Date.now();

      const optimisticContent =
        type === "image" && file ? URL.createObjectURL(file) : type === "file" && file ? file.name : content;

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
        destructTimer: secs,
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

      try {
        if (file) {
          const up = await uploadFile(file);
          finalContent = up.url;
          fileName = up.originalName || file.name;
          fileSize = up.size || file.size;

          setActiveMessages((prev) => {
            const next = new Map(prev);
            const arr = next.get(selectedChat.id) || [];
            next.set(
              selectedChat.id,
              arr.map((m: any) => (m.id === tempId ? { ...m, content: finalContent, fileName, fileSize } : m))
            );
            return next;
          });
        } else {
          finalContent = content;
        }
      } catch (e) {
        console.error("❌ Upload failed:", e);
        setActiveMessages((prev) => {
          const next = new Map(prev);
          const arr = next.get(selectedChat.id) || [];
          next.set(selectedChat.id, arr.filter((m: any) => m.id !== tempId));
          return next;
        });
        return;
      }

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

      socket.send(wsPayload);
    },
    [selectedChat, userId, socket, scheduleMessageDeletion]
  );

  // --------------------------
  // ✅ Presence update helper (user_status)
  // --------------------------
  const applyPresenceToState = useCallback((uid: number, isOnline: boolean) => {
    const lastSeenIso = new Date().toISOString();

    setPersistentContacts((prev) =>
      prev.map((c: any) => {
        if (c?.otherUser?.id !== uid) return c;
        return {
          ...c,
          otherUser: {
            ...c.otherUser,
            isOnline,
            lastSeen: isOnline ? c.otherUser?.lastSeen : lastSeenIso,
          },
        };
      })
    );

    setSelectedChat((prev) => {
      if (!prev?.otherUser?.id) return prev;
      if (prev.otherUser.id !== uid) return prev;
      return {
        ...prev,
        otherUser: {
          ...prev.otherUser,
          isOnline,
          lastSeen: isOnline ? prev.otherUser?.lastSeen : lastSeenIso,
        },
      };
    });
  }, []);

  // --------------------------
  // Incoming WS
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

    const onUserStatus = (data: any) => {
      if (data?.type !== "user_status") return;
      const uid = Number(data.userId) || 0;
      if (!uid) return;
      applyPresenceToState(uid, Boolean(data.isOnline));
    };

    const onMsg = (data: any) => {
      // handle specific types that sometimes arrive on "message"
      if (data?.type === "typing") return onTyping(data);
      if (data?.type === "user_status") return onUserStatus(data);

      if (data?.type !== "new_message" || !data.message) return;
      const m: any = data.message;

      if (m.receiverId !== userId) return;

      const cutoff = getCutoffMs(m.chatId);
      if (cutoff) {
        const created = toMs(m.createdAt);
        if (created && created <= cutoff) return;
      }

      setActiveMessages((prev) => {
        const next = new Map(prev);
        const arr = next.get(m.chatId) || [];
        if (!arr.some((x: any) => x.id === m.id)) next.set(m.chatId, [...arr, m]);
        return next;
      });

      scheduleMessageDeletion(m);

      // ✅ Badge erhöhen wenn Chat nicht offen
      if (!selectedChat || selectedChat.id !== m.chatId) {
        setUnreadCounts((prev) => {
          const next = new Map(prev);
          const c = next.get(m.chatId) || 0;
          next.set(m.chatId, c + 1);
          return next;
        });
      }

      setTimeout(() => loadPersistentContacts(), 200);
    };

    socket.on("typing", onTyping);
    socket.on("user_status", onUserStatus);
    socket.on("message", onMsg);

    return () => {
      socket.off?.("typing", onTyping);
      socket.off?.("user_status", onUserStatus);
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
    applyPresenceToState,
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
