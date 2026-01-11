import { useState, useEffect, useRef, useCallback } from "react";

// Direct WebSocket implementation that bypasses Vite proxy issues
export function useWebSocketDirect(userId?: number) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const eventHandlersRef = useRef<Map<string, Function[]>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const emit = useCallback((event: string, data?: any) => {
    const handlers = eventHandlersRef.current.get(event) || [];
    handlers.forEach(handler => handler(data));
  }, []);

  useEffect(() => {
    if (!userId) return;

    const connect = () => {
      try {
        // Try multiple WebSocket connection strategies for Replit
        const strategies = [
          // Strategy 1: Use window location with current port (most likely to work in Replit)
          () => {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            const host = window.location.host;
            console.log(`Trying: ${protocol}//${host}/ws`);
            return new WebSocket(`${protocol}//${host}/ws`);
          },
          // Strategy 2: Use hostname with explicit port 5000
          () => {
            const host = window.location.hostname;
            const url = `ws://${host}:5000/ws`;
            console.log(`Trying: ${url}`);
            return new WebSocket(url);
          },
          // Strategy 3: Direct localhost fallback
          () => {
            console.log('Trying: ws://localhost:5000/ws');
            return new WebSocket('ws://localhost:5000/ws');
          }
        ];

        let strategyIndex = 0;
        
        const tryConnect = () => {
          if (strategyIndex >= strategies.length) {
            console.error("All WebSocket connection strategies failed");
            return;
          }

          console.log(`Trying WebSocket strategy ${strategyIndex + 1}...`);
          
          try {
            const ws = strategies[strategyIndex]();
            
            const timeout = setTimeout(() => {
              if (ws.readyState === WebSocket.CONNECTING) {
                console.log(`Strategy ${strategyIndex + 1} timed out, trying next...`);
                ws.close();
                strategyIndex++;
                tryConnect();
              }
            }, 3000);

            ws.onopen = () => {
              clearTimeout(timeout);
              console.log(`✅ WebSocket connected via strategy ${strategyIndex + 1}`);
              wsRef.current = ws;
              setIsConnected(true);
              ws.send(JSON.stringify({ type: "join", userId }));
              emit("connected");
            };
            
            ws.onmessage = (event) => {
              const data = JSON.parse(event.data);
              console.log("WebSocket message:", data.type);
              emit(data.type, data);
              emit("message", data);
            };
            
            ws.onclose = () => {
              clearTimeout(timeout);
              if (wsRef.current === ws) {
                console.log("WebSocket disconnected");
                setIsConnected(false);
                emit("disconnected");
                reconnectTimeoutRef.current = setTimeout(connect, 3000);
              }
            };
            
            ws.onerror = (error) => {
              clearTimeout(timeout);
              console.log(`Strategy ${strategyIndex + 1} failed:`, error);
              strategyIndex++;
              setTimeout(tryConnect, 1000);
            };
            
          } catch (error) {
            console.log(`Strategy ${strategyIndex + 1} threw error:`, error);
            strategyIndex++;
            setTimeout(tryConnect, 1000);
          }
        };

        tryConnect();

      } catch (error) {
        console.error("Failed to initialize WebSocket:", error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
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