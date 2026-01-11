import { useState, useEffect, useRef } from "react";

export function useWebSocket(userId?: number) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Function[]>>(new Map());
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  


  useEffect(() => {
    if (!userId) {
      console.log("🚫 useWebSocket: No userId provided");
      return;
    }

    console.log("🔄 useWebSocket: Creating DIRECT WebSocket for user:", userId);
    
    const connect = () => {
      // Direct connection to correct port - Replit serves on 5000
      const wsUrl = `ws://${window.location.hostname}:5000/ws`;
      
      console.log("🔌 Connecting to WebSocket:", wsUrl);
      setConnectionAttempts(prev => prev + 1);
      
      try {
        wsRef.current = new WebSocket(wsUrl);
      
        wsRef.current.onopen = () => {
          console.log("✅ WebSocket connected for user:", userId);
          setIsConnected(true);
          
          // Send join message immediately
          const joinMessage = { type: "join", userId };
          wsRef.current?.send(JSON.stringify(joinMessage));
          
          // Emit connected event
          emit("connected");
        };
      
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("📥 Received:", data.type);
            
            // Emit specific event type
            if (data.type) {
              emit(data.type, data);
            }
            
            // Also emit general message event
            emit("message", data);
          } catch (error) {
            console.error("❌ Failed to parse message:", error);
          }
        };
      
        wsRef.current.onclose = (event) => {
          console.log("❌ WebSocket disconnected");
          setIsConnected(false);
          emit("disconnected");
          
          // Auto-reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("🔄 Reconnecting...");
            connect();
          }, 3000);
        };
      
        wsRef.current.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          setIsConnected(false);
          emit("error", error);
        };
      } catch (error) {
        console.error("❌ Failed to create WebSocket:", error);
        setIsConnected(false);
      }
    };
    
    connect();

    return () => {
      console.log("🧹 DIRECT: Cleaning up WebSocket");
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      eventHandlersRef.current.clear();
    };
  }, [userId]);

  const emit = (event: string, data?: any) => {
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  };

  const send = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("📤 DIRECT: Sending message:", message);
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.error("❌ DIRECT: Cannot send - WebSocket not connected");
      return false;
    }
  };

  const on = (event: string, handler: Function) => {
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, []);
    }
    eventHandlersRef.current.get(event)!.push(handler);
  };

  const off = (event: string, handler?: Function) => {
    if (!handler) {
      eventHandlersRef.current.delete(event);
      return;
    }
    
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  };

  const socket = {
    send,
    on,
    off,
    isConnected: () => wsRef.current?.readyState === WebSocket.OPEN
  };

  return { socket, isConnected };
}
