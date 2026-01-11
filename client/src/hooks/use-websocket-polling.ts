import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

// Fallback polling system if WebSocket fails
export function useWebSocketPolling(userId?: number) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const eventHandlersRef = useRef<Map<string, Function[]>>(new Map());
  const pollingRef = useRef<NodeJS.Timeout>();
  const lastMessageId = useRef<number>(0);

  const emit = useCallback((event: string, data?: any) => {
    const handlers = eventHandlersRef.current.get(event) || [];
    handlers.forEach(handler => handler(data));
  }, []);

  useEffect(() => {
    if (!userId) return;

    console.log("Starting polling fallback for user:", userId);
    setIsConnected(true);
    emit("connected");

    // Poll for new messages every 2 seconds
    const poll = async () => {
      try {
        // Check for new messages across all chats
        const response = await apiRequest("GET", `/api/users/${userId}/messages/since/${lastMessageId.current}`);
        const newMessages = await response.json();
        
        if (newMessages.length > 0) {
          newMessages.forEach((message: any) => {
            console.log("Polling received new message:", message.content?.substring(0, 20));
            emit("new_message", { message });
            lastMessageId.current = Math.max(lastMessageId.current, message.id);
          });
        }
      } catch (error) {
        console.log("Polling error:", error);
      }
    };

    // Start polling
    pollingRef.current = setInterval(poll, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      setIsConnected(false);
    };
  }, [userId, emit]);

  const send = useCallback(async (message: any) => {
    try {
      console.log("Sending via HTTP API:", message.type);
      
      // Send message via HTTP API instead of WebSocket
      const response = await apiRequest("POST", "/api/messages", {
        chatId: message.chatId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        messageType: message.messageType || "text",
        destructTimer: message.destructTimer || 10
      });

      if (response.ok) {
        console.log("Message sent successfully via HTTP");
        const sentMessage = await response.json();
        
        // Emit events to simulate WebSocket behavior
        emit("message_sent", { message: sentMessage });
        emit("new_message", { message: sentMessage });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to send message via HTTP:", error);
      return false;
    }
  }, [emit]);

  const on = useCallback((event: string, handler: Function) => {
    const handlers = eventHandlersRef.current.get(event) || [];
    handlers.push(handler);
    eventHandlersRef.current.set(event, handlers);
  }, []);

  const off = useCallback((event: string, handler?: Function) => {
    if (!handler) {
      eventHandlersRef.current.delete(event);
      return;
    }
    const handlers = eventHandlersRef.current.get(event) || [];
    const filtered = handlers.filter(h => h !== handler);
    eventHandlersRef.current.set(event, filtered);
  }, []);

  return {
    isConnected,
    send,
    on,
    off
  };
}