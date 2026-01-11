import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { decryptMessage } from "@/lib/crypto";
import type { Chat, Message, User } from "@shared/schema";
import { WebSocketClient } from "@/lib/websocket";

export function useChatWorking(userId?: number) {
  const [messages, setMessages] = useState<Message[]>([]);
  const messageTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ✅ 1 dauerhafte WebSocket Verbindung pro User
  const wsRef = useRef<WebSocketClient | null>(null);

  // Auto-delete expired messages from UI
  const scheduleMessageDeletion = useCallback((message: Message) => {
    if (!message?.expiresAt) return;

    const timeUntilExpiry = new Date(message.expiresAt).getTime() - Date.now();

    if (timeUntilExpiry > 0) {
      const timer = setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== message.id));
        messageTimers.current.delete(message.id);
      }, timeUntilExpiry);

      messageTimers.current.set(message.id, timer);
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
    }
  }, []);

  // Fetch user's chats
  const { data: rawChats, isLoading, error: chatsError } = useQuery({
    queryKey: [`/api/chats/${userId}`],
    enabled: !!userId,
    retry: 3,
    refetchInterval: 5000, // ok für chatliste
  });

  const chats = Array.isArray(rawChats) ? rawChats : [];

  // Fetch messages for selected chat
  const { data: rawMessages, error: messagesError } = useQuery({
    queryKey: [`/api/chats/${selectedChatId}/messages`],
    enabled: !!selectedChatId,
    retry: 3,
    // ✅ optional: polling aus, weil WS jetzt live ist
    refetchInterval: false,
  });

  // Load + decrypt messages when chat changes / messages fetched
  useEffect(() => {
    const processMessages = async () => {
      const processedMessages = Array.isArray(rawMessages) ? rawMessages : [];

      const userData = localStorage.getItem("user");
      if (!userData) {
        setMessages(processedMessages);
        return;
      }

      const currentUser = JSON.parse(userData);
      const privateKey = currentUser.privateKey;

      if (!privateKey) {
        setMessages(processedMessages);
        return;
      }

      const decryptedMessages = await Promise.all(
        processedMessages.map(async (msg) => {
          try {
            // Heuristik: "sieht verschlüsselt aus"
            if (msg.content && msg.content.length > 100 && !msg.content.includes(" ")) {
              const decryptedContent = await decryptMessage(msg.content, privateKey);
              if (decryptedContent.startsWith("[Decryption failed")) {
                return { ...msg, content: "[Nachricht konnte nicht entschlüsselt werden]" };
              }
              return { ...msg, content: decryptedContent };
            }
            return msg;
          } catch {
            return { ...msg, content: "[Verschlüsselte Nachricht - Entschlüsselung fehlgeschlagen]" };
          }
        })
      );

      setMessages(decryptedMessages);

      // Timer für Selbstzerstörung setzen
      decryptedMessages.forEach((m) => {
        if (m?.id && !messageTimers.current.has(m.id)) {
          scheduleMessageDeletion(m);
        }
      });
    };

    processMessages();
  }, [rawMessages, scheduleMessageDeletion]);

  // ✅ WebSocket: verbinden + live UI updates
  useEffect(() => {
    if (!userId) return;

    // Verbindung nur einmal aufbauen
    if (!wsRef.current) {
      wsRef.current = new WebSocketClient(userId);
    }

    const ws = wsRef.current;

    const onIncoming = async (payload: any) => {
      // Dein WebSocketClient emittet immer auch "message"
      // payload kann z.B. {type:"message", chatId, ...} sein
      if (!payload) return;

      // Wenn dein Server die Nachricht als type "message" sendet:
      const type = payload.type;
      if (type !== "message" && type !== "new_message") return;

      // Nur in den offenen Chat pushen
      if (selectedChatId && payload.chatId !== selectedChatId) {
        // optional: Chatliste aktualisieren (Badges etc.)
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${userId}`] });
        return;
      }

      // Optional: entschlüsseln
      let content = payload.content;
      try {
        const userData = localStorage.getItem("user");
        if (userData) {
          const currentUser = JSON.parse(userData);
          const privateKey = currentUser.privateKey;

          if (privateKey && content && content.length > 100 && !String(content).includes(" ")) {
            const decrypted = await decryptMessage(content, privateKey);
            content = decrypted.startsWith("[Decryption failed")
              ? "[Nachricht konnte nicht entschlüsselt werden]"
              : decrypted;
          }
        }
      } catch {}

      const incoming: any = {
        ...payload,
        content,
        createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
        expiresAt: payload.expiresAt
          ? new Date(payload.expiresAt)
          : payload.destructTimer
            ? new Date(Date.now() + payload.destructTimer * 1000)
            : undefined,
      };

      setMessages((prev) => {
        // doppelte vermeiden
        if (incoming?.id && prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });

      if (incoming?.expiresAt && incoming?.id && !messageTimers.current.has(incoming.id)) {
        scheduleMessageDeletion(incoming);
      }
    };

    ws.on("message", onIncoming);

    return () => {
      ws.off("message", onIncoming);
    };
  }, [userId, selectedChatId, queryClient, scheduleMessageDeletion]);

  const sendMessage = useCallback(
    async (content: string, type: string, destructTimer: number, receiverId?: number, file?: File) => {
      if (!userId || !selectedChatId) return false;

      // receiver bestimmen
      let targetReceiverId = receiverId;
      if (!targetReceiverId) {
        const chat = chats.find((c) => c.id === selectedChatId);
        if (!chat) return false;
        targetReceiverId = chat.participant1Id === userId ? chat.participant2Id : chat.participant1Id;
      }

      const ws = wsRef.current;
      if (!ws || !ws.isConnected()) {
        toast({
          title: "Nicht verbunden",
          description: "WebSocket ist (noch) nicht verbunden. Bitte kurz warten oder Seite neu laden.",
          variant: "destructive",
        });
        return false;
      }

      // ✅ über bestehende WS Verbindung senden
      const ok = ws.send({
        type: "message",
        chatId: selectedChatId,
        senderId: userId,
        receiverId: targetReceiverId,
        content,
        messageType: type,
        destructTimer,
      });

      if (!ok) {
        toast({
          title: "Send failed",
          description: "WebSocket konnte nicht senden.",
          variant: "destructive",
        });
        return false;
      }

      // ✅ Optimistisch sofort anzeigen (live UI)
      const tempMessage: any = {
        id: Date.now(),
        chatId: selectedChatId,
        senderId: userId,
        receiverId: targetReceiverId,
        content,
        messageType: type,
        destructTimer,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + destructTimer * 1000),
        isEncrypted: false,
      };

      setMessages((prev) => [...prev, tempMessage]);
      scheduleMessageDeletion(tempMessage);

      return true;
    },
    [userId, selectedChatId, chats, toast, scheduleMessageDeletion]
  );

  const selectChat = useCallback((chat: Chat & { otherUser: User }) => {
    setSelectedChatId(chat.id);
  }, []);

  const selectedChat = chats.find((c) => c.id === selectedChatId);

  return {
    chats,
    messages,
    sendMessage,
    selectChat,
    isLoading,
    selectedChat,
    selectedChatId,
    chatsError: (chatsError as any)?.message,
    messagesError: (messagesError as any)?.message,
  };
}
