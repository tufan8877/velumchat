import { useState, useEffect, useRef, useCallback } from "react";

export function useWebSocketSimple(userId?: number) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const eventHandlersRef = useRef<Map<string, Function[]>>(new Map());

  const emit = useCallback((event: string, data?: any) => {
    const handlers = eventHandlersRef.current.get(event) || [];
    handlers.forEach(handler => handler(data));
  }, []);

  useEffect(() => {
    if (!userId) return;

    let reconnectTimeout: NodeJS.Timeout;
    
    const connect = () => {
      try {
        console.log("Connecting WebSocket for user:", userId);
        
        // For Replit environment, use proper WebSocket URL
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.hostname;
        // Use the same host as the web page
        const wsUrl = `${protocol}//${host}/ws`;
        
        console.log("WebSocket URL:", wsUrl);
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          console.log("WebSocket connected");
          setIsConnected(true);
          wsRef.current?.send(JSON.stringify({ type: "join", userId }));
          emit("connected");
        };
        
        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log("WebSocket message:", data.type);
          emit(data.type, data);
          emit("message", data);
        };
        
        wsRef.current.onclose = () => {
          console.log("WebSocket disconnected");
          setIsConnected(false);
          emit("disconnected");
          reconnectTimeout = setTimeout(connect, 3000);
        };
        
        wsRef.current.onerror = (error) => {
          console.error("WebSocket error:", error);
          setIsConnected(false);
        };
        
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId, emit]);

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      console.log("Sent message:", message.type);
      return true;
    }
    console.log("WebSocket not ready");
    return false;
  }, []);

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