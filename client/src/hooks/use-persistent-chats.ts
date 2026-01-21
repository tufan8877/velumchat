import { useState, useEffect, useCallback, useRef } from "react";
import type { User, Chat, Message } from "@shared/schema";

/**
 * ============================
 * Helpers
 * ============================
 */

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

function toMs(v: any): number {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function toBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return false;
}

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

/**
 * ============================
 * Deleted chat cutoffs
 * ============================
 */

function cutoffsKey(userId: number) {
  return `chat_cutoffs_v3_${userId}`;
}

function loadCutoffs(userId: number): Record<string, string> {
  try {
    const raw = localStorage.getItem(cutoffsKey(userId));
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
    localStorage.setItem(cutoffsKey(userId), JSON.stringify(data));
  } catch {}
}

function filterByCutoff(chatId: number, msgs: any[], cutoffIso?: string) {
  if (!cutoffIso) return msgs || [];
  const cutoff = toMs(cutoffIso);
  if (!cutoff) return msgs || [];
  return (msgs || []).filter((m: any) => toMs(m.createdAt) > cutoff);
}

/**
 * ============================
 * Hook
 * ============================
 */

export function usePersistentChats(userId?: number, socket?: any) {
  const [persistentContacts, setPersistentContacts] = useState<
    Array<Chat & { otherUser: User; lastMessage?: any; unreadCount?: number }>
  >([]);
  const [activeMessages, setActiveMessages] = useState<Map<number, any[]>>(new Map());
  const [selectedChat, setSelectedChat] = useState<(Chat & { otherUser: User }) | null>(null);

  // ✅ IMPORTANT: isLoading only for FIRST load / manual refresh (NOT for background updates)
  const [isLoading, setIsLoading] = useState(false);
  const firstLoadDoneRef = useRef(false);

  // chatId -> count
  const [unreadCounts, setUnreadCounts] = useState<Map<number, number>>(new Map());

  // chatId -> typing (other user)
  const [typingByChat, setTypingByChat] = useState<Map<number, boolean>>(new Map());
  const typingTimeoutsRef = useRef<Map<number, any>>(new Map());

  // message self-destruction timers
  const deletionTimersRef = useRef<Map<number, any>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // cutoffs: chatId -> ISO
  const cutoffsRef = useRef<Record<string, string>>({});

  // presence cache: userId -> online
  const presenceRef = useRef<Map<number, boolean>>(new Map());

  /**
   * ============================
   * Timers
   * ============================
   */

  const clearTimer = (messageId: number) => {
    const t = deletionTimersRef.current.get(messageId);
    if (t) clearTimeout(t);
    deletionTimersRef.current.delete(messageId);
  };

  const scheduleMessageDeletion = useCallback((message: any) => {
    try {
      const expMs = toMs(message?.expiresAt || message?.expires_at);
      if (!expMs) return;

      const ms = Math.max(expMs - Date.now(), 200);
      clearTimer(message.id);

      const timer = setTimeout(() => {
        setActiveMessages((prev) => {
          const next = new Map(prev);
          const arr = next.get(message.chatId) || [];
          next.set(message.chatId, arr.filter((m: any) => m.id !== message.id));
          return next;
        });
        clearTimer(message.id);
      }, ms);

      deletionTimersRef.current.set(message.id, timer);
    } catch {}
  }, []);

  /**
   * ============================
   * Presence apply helpers
   * ============================
   */

  const applyPresence = useCallback((uid: number, online: boolean) => {
    if (!uid) return;
    presenceRef.current.set(uid, online);

    setPersistentContacts((prev) =>
      prev.map((c: any) => {
        if (Number(c?.otherUser?.id) !== uid) return c;
        return { ...c, otherUser: { ...c.otherUser, isOnline: online } };
      })
    );

    setSelectedChat((prev) => {
      if (!prev) return prev;
      if (Number(prev?.otherUser?.id) !== uid) return prev;
      return { ...prev, otherUser: { ...prev.otherUser, isOnline: online } };
    });
  }, []);

  const setAllOffline = useCallback(() => {
    presenceRef.current.clear();
    setPersistentContacts((prev) =>
      prev.map((c: any) => ({ ...c, otherUser: { ...c.otherUser, isOnline: false } }))
    );
    setSelectedChat((prev) => {
      if (!prev) return prev;
      return { ...prev, otherUser: { ...prev.otherUser, isOnline: false } };
    });
  }, []);

  useEffect(() => {
    if (!socket?.isConnected) setAllOffline();
  }, [socket?.isConnected, setAllOffline]);

  /**
   * ============================
   * Chat list local update (FAST)
   * ============================
   */

  const bumpChatToTopAndUpdateLast = useCallback(
    (chatId: number, lastMessage: any) => {
      setPersistentContacts((prev) => {
        const idx = prev.findIndex((c: any) => c.id === chatId);
        if (idx === -1) return prev;

        const current = prev[idx];
        const updated = {
          ...current,
          lastMessage,
          lastMessageTimestamp: lastMessage?.createdAt || new Date().toISOString(),
        };

        // move to top
        const next = [updated, ...prev.filter((_, i) => i !== idx)];
        return next;
      });
    },
    []
  );

  /**
   * ============================
   * Load Contacts (FIRST load shows spinner; background refresh silent)
   * ============================
   */

  const fetchContacts = useCallback(
    async (showSpinner: boolean) => {
      if (!userId) return;

      if (showSpinner) setIsLoading(true);

      try {
        const contacts = await authedFetch(`/api/chats/${userId}`, undefined, 15000);

        // unread from server (optional)
        const serverUnread = new Map<number, number>();
        (contacts || []).forEach((c: any) => {
          let unread = 0;
          if (userId === c.participant1Id) unread = c.unreadCount1 || 0;
          else if (userId === c.participant2Id) unread = c.unreadCount2 || 0;
          c.unreadCount = unread;
          if (unread > 0) serverUnread.set(c.id, unread);
        });

        // merge unread: never overwrite local with 0
        setUnreadCounts((prev) => {
          const next = new Map(prev);
          for (const [chatId, cnt] of serverUnread.entries()) {
            const cur = next.get(chatId) || 0;
            next.set(chatId, Math.max(cur, cnt));
          }
          return next;
        });

        // sort
        const sorted = (contacts || []).sort((a: any, b: any) => {
          const aTime = a.lastMessage?.createdAt || a.lastMessageTimestamp || a.createdAt;
          const bTime = b.lastMessage?.createdAt || b.lastMessageTimestamp || b.createdAt;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

        // apply presence from ref; default offline
        const withPresence = (sorted || []).map((c: any) => {
          const oid = Number(c?.otherUser?.id) || 0;
          const online = oid ? Boolean(presenceRef.current.get(oid)) : false;
          return { ...c, otherUser: { ...c.otherUser, isOnline: online } };
        });

        setPersistentContacts(withPresence);
      } catch (e) {
        console.error("❌ fetchContacts:", e);
        if (showSpinner) setPersistentContacts([]);
      } finally {
        if (showSpinner) setIsLoading(false);
        firstLoadDoneRef.current = true;
      }
    },
    [userId]
  );

  const loadPersistentContacts = useCallback(async () => {
    // show spinner only first load or manual refresh
    const showSpinner = !firstLoadDoneRef.current;
    await fetchContacts(showSpinner);
  }, [fetchContacts]);

  const refreshContactsSilently = useCallback(async () => {
    // never show spinner (prevents "Lade Chats..." while typing)
    await fetchContacts(false);
  }, [fetchContacts]);

  /**
   * ============================
   * Load Messages (only when opening chat)
   * ============================
   */

  const loadActiveMessages = useCallback(
    async (chatId: number) => {
      try {
        const msgsRaw = await authedFetch(`/api/chats/${chatId}/messages`, undefined, 15000);
        const cutoffIso = cutoffsRef.current[String(chatId)];
        const msgs = filterByCutoff(chatId, Array.isArray(msgsRaw) ? msgsRaw : [], cutoffIso);

        setActiveMessages((prev) => {
          const next = new Map(prev);
          next.set(chatId, msgs);
          return next;
        });

        msgs.forEach((m: any) => scheduleMessageDeletion(m));
      } catch (e) {
        console.error(`❌ loadActiveMessages chat=${chatId}:`, e);
        setActiveMessages((prev) => {
          const next = new Map(prev);
          next.set(chatId, []);
          return next;
        });
      }
    },
    [scheduleMessageDeletion]
  );

  /**
   * ============================
   * Select Chat
   * ============================
   */

  const selectChat = useCallback(
    async (chat: (Chat & { otherUser: User }) | null) => {
      setSelectedChat(chat);
      if (!chat || !userId) return;

      // mark read
      try {
        await authedFetch(
          `/api/chats/${chat.id}/mark-read`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
          15000
        );
      } catch {}

      // clear badge
      setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.delete(chat.id);
        return next;
      });

      // also clear server badge display
      setPersistentContacts((prev) => prev.map((c: any) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)));

      await loadActiveMessages(chat.id);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    },
    [userId, loadActiveMessages]
  );

  /**
   * ============================
   * Delete Chat (FAST + silent refresh)
   * ============================
   */

  const deleteChat = useCallback(
    async (chatId: number) => {
      if (!userId) return;

      // local cutoff now
      const nowIso = new Date().toISOString();
      cutoffsRef.current[String(chatId)] = nowIso;
      saveCutoffs(userId, cutoffsRef.current);

      // remove from UI immediately (FAST)
      setPersistentContacts((prev) => prev.filter((c: any) => c.id !== chatId));

      // clear local messages
      setActiveMessages((prev) => {
        const next = new Map(prev);
        next.delete(chatId);
        return next;
      });

      // close if open
      setSelectedChat((prev) => (prev?.id === chatId ? null : prev));

      // clear badge
      setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.delete(chatId);
        return next;
      });

      // server hide (no spinner!)
      try {
        await authedFetch(`/api/chats/${chatId}/delete`, { method: "POST" }, 15000);
      } catch (e) {
        console.error("deleteChat server failed:", e);
      }

      // sync silently
      setTimeout(() => {
        refreshContactsSilently();
      }, 150);
    },
    [userId, refreshContactsSilently]
  );

  /**
   * ============================
   * Typing send
   * ============================
   */

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

  /**
   * ============================
   * Send Message (FAST: no reload spinner)
   * ============================
   */

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

      // append locally immediately
      setActiveMessages((prev) => {
        const next = new Map(prev);
        const arr = next.get(selectedChat.id) || [];
        next.set(selectedChat.id, [...arr, optimistic]);
        return next;
      });
      scheduleMessageDeletion(optimistic);

      // update chat list preview instantly (FAST)
      bumpChatToTopAndUpdateLast(selectedChat.id, {
        id: tempId,
        content: type === "image" ? "📷 Photo" : type === "file" ? "📎 File" : content,
        createdAt: optimistic.createdAt,
      });

      let finalContent = content;
      let fileName: string | undefined;
      let fileSize: number | undefined;

      try {
        if (file) {
          const up = await uploadFile(file);
          finalContent = up.url;
          fileName = up.originalName || file.name;
          fileSize = up.size || file.size;

          // update optimistic to real URL
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
        // remove optimistic
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

      const ok = socket.send(wsPayload);
      if (!ok) console.warn("⚠️ WS not open -> queued");
    },
    [selectedChat, userId, socket, scheduleMessageDeletion, bumpChatToTopAndUpdateLast]
  );

  /**
   * ============================
   * Incoming WS handling
   * ============================
   */

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

  const handleWSData = useCallback(
    (data: any) => {
      if (!data || typeof data !== "object") return;

      // online list
      if (data.type === "online_users") {
        const ids: number[] = Array.isArray(data.userIds) ? data.userIds.map((x: any) => Number(x)).filter(Boolean) : [];
        ids.forEach((uid) => {
          if (uid && uid !== userId) applyPresence(uid, true);
        });
        return;
      }

      // presence
      if (data.type === "user_status") {
        const uid = Number(data.userId) || 0;
        if (!uid) return;
        applyPresence(uid, toBool(data.isOnline));
        return;
      }

      // username updates
      if (data.type === "profile_updated") {
        const uid = Number(data.userId) || 0;
        const username = String(data.username || "").trim();
        if (!uid || !username) return;

        setPersistentContacts((prev) =>
          prev.map((c: any) => {
            if (Number(c?.otherUser?.id) !== uid) return c;
            return { ...c, otherUser: { ...c.otherUser, username } };
          })
        );

        setSelectedChat((prev) => {
          if (!prev) return prev;
          if (Number(prev?.otherUser?.id) !== uid) return prev;
          return { ...prev, otherUser: { ...prev.otherUser, username } };
        });

        return;
      }

      // typing
      if (data.type === "typing") {
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
        return;
      }

      // new message
      if (data.type === "new_message" && data.message) {
        const m: any = data.message;

        // receiver only
        if (m.receiverId !== userId) return;

        // cutoff
        const cutoffIso = cutoffsRef.current[String(m.chatId)];
        if (cutoffIso) {
          const cutoffMs = toMs(cutoffIso);
          const createdMs = toMs(m.createdAt);
          if (cutoffMs && createdMs && createdMs <= cutoffMs) return;
        }

        setActiveMessages((prev) => {
          const next = new Map(prev);
          const arr = next.get(m.chatId) || [];
          if (!arr.some((x: any) => x.id === m.id)) next.set(m.chatId, [...arr, m]);
          return next;
        });

        scheduleMessageDeletion(m);

        // update list instantly
        bumpChatToTopAndUpdateLast(m.chatId, {
          id: m.id,
          content:
            m.messageType === "image" ? "📷 Photo" : m.messageType === "file" ? "📎 File" : String(m.content || ""),
          createdAt: m.createdAt || new Date().toISOString(),
        });

        // badge increase if chat not open
        if (!selectedChat || selectedChat.id !== m.chatId) {
          setUnreadCounts((prev) => {
            const next = new Map(prev);
            const c = next.get(m.chatId) || 0;
            next.set(m.chatId, c + 1);
            return next;
          });
        }

        return;
      }
    },
    [
      userId,
      selectedChat,
      applyPresence,
      clearTypingTimer,
      setTypingState,
      scheduleMessageDeletion,
      bumpChatToTopAndUpdateLast,
    ]
  );

  useEffect(() => {
    if (!socket?.on || !userId) return;

    const handler = (d: any) => handleWSData(d);

    socket.on("online_users", handler);
    socket.on("user_status", handler);
    socket.on("profile_updated", handler);
    socket.on("typing", handler);
    socket.on("message", handler);

    return () => {
      socket.off?.("online_users", handler);
      socket.off?.("user_status", handler);
      socket.off?.("profile_updated", handler);
      socket.off?.("typing", handler);
      socket.off?.("message", handler);
    };
  }, [socket, userId, handleWSData]);

  // initial load
  useEffect(() => {
    if (!userId) return;
    cutoffsRef.current = loadCutoffs(userId);
    loadPersistentContacts();
  }, [userId, loadPersistentContacts]);

  // cleanup
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
