import { useState, useEffect, useRef, useCallback } from "react";

export function useSimpleWebSocket(userId?: number) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function[]>>(new Map());

  const connect = useCallback(() => {
    if (!userId) return;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // Use current host and port for WebSocket connection
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log("🔌 WebSocket connecting to:", wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("✅ WebSocket connected for user:", userId);
        setIsConnected(true);
        
        // Send join message
        const joinMessage = { type: "join", userId };
        wsRef.current?.send(JSON.stringify(joinMessage));
        console.log("📤 Join message sent");
      };

      wsRef.current.onmessage = (event) => {
        console.log("📥 RAW WebSocket data received:", event.data);
        try {
          const data = JSON.parse(event.data);
          console.log("📥 PARSED WebSocket message:", data.type, data);
          
          // Emit to specific type handlers
          const handlers = eventHandlersRef.current.get(data.type) || [];
          console.log(`📡 Found ${handlers.length} handlers for event '${data.type}'`);
          handlers.forEach((handler, index) => {
            try {
              handler(data);
              console.log(`✅ Handler ${index} for '${data.type}' executed`);
            } catch (error) {
              console.error(`❌ Handler ${index} for '${data.type}' failed:`, error);
            }
          });
          
          // ALWAYS emit to general message handlers (this is critical!)
          const messageHandlers = eventHandlersRef.current.get("message") || [];
          console.log(`📡 Broadcasting to ${messageHandlers.length} general message handlers`);
          messageHandlers.forEach((handler, index) => {
            try {
              handler(data);
              console.log(`✅ General handler ${index} executed successfully`);
            } catch (error) {
              console.error(`❌ General handler ${index} failed:`, error);
            }
          });
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      wsRef.current.onclose = () => {
        console.log("❌ WebSocket disconnected");
        setIsConnected(false);
        
        // Auto-reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
    }
  }, [userId]);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (typeof message === 'string') {
        wsRef.current.send(message);
      } else {
        wsRef.current.send(JSON.stringify(message));
      }
      console.log("📤 WebSocket message sent:", typeof message === 'string' ? 'raw' : message.type);
      return true;
    } else {
      console.log("❌ WebSocket not ready, state:", wsRef.current?.readyState);
      return false;
    }
  }, []);

  const on = useCallback((event: string, handler: Function) => {
    const handlers = eventHandlersRef.current.get(event) || [];
    handlers.push(handler);
    eventHandlersRef.current.set(event, handlers);
    console.log(`🎧 Handler registered for event: ${event}`);
  }, []);

  const off = useCallback((event: string, handler?: Function) => {
    if (!handler) {
      eventHandlersRef.current.delete(event);
    } else {
      const handlers = eventHandlersRef.current.get(event) || [];
      const filtered = handlers.filter(h => h !== handler);
      eventHandlersRef.current.set(event, filtered);
    }
  }, []);

  return {
    isConnected,
    send,
    on,
    off
  };
}