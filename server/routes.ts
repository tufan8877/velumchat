import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { wsMessageSchema, loginUserSchema, type WSMessage } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ============================
// Uploads
// ============================
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

interface ConnectedClient {
  ws: WebSocket;
  userId: number;
}

function toInt(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeJson(res: any, status: number, payload: any) {
  return res.status(status).json(payload);
}

function normalizeDestructTimerSeconds(raw: any) {
  let t = toInt(raw, 86400);

  // falls mal ms geliefert wird
  if (t > 100000) t = Math.floor(t / 1000);

  if (t < 5) t = 5;
  const max = 7 * 24 * 60 * 60; // 1 week
  if (t > max) t = max;
  return t;
}

// ============================
// JWT helpers
// ============================
const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  console.warn("⚠️ JWT_SECRET is not set. Set it in Render -> Environment.");
}

type JwtPayload = { userId: number; username: string };

function signToken(payload: JwtPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

function getBearerToken(req: any): string | null {
  const h = req.headers?.authorization || "";
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}

// REST auth middleware
function requireAuth(req: any, res: any, next: any) {
  try {
    const token = getBearerToken(req);
    if (!token) return safeJson(res, 401, { ok: false, message: "Missing token" });
    const payload = verifyToken(token);
    req.auth = payload;
    next();
  } catch {
    return safeJson(res, 401, { ok: false, message: "Invalid token" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const connectedClients = new Map<number, ConnectedClient>();

  function broadcast(message: any, excludeUserId?: number) {
    for (const client of connectedClients.values()) {
      if (excludeUserId && client.userId === excludeUserId) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }

  // ============================
  // REST API
  // ============================

  app.get("/api/health", (_req, res) => {
    return res.json({ ok: true, service: "whisper3", time: new Date().toISOString() });
  });

  // Register (returns JWT)
  app.post("/api/register", async (req, res) => {
    try {
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");
      const publicKey = String(req.body?.publicKey || "");

      if (!username || !password || !publicKey) {
        return safeJson(res, 400, {
          ok: false,
          message: "Username, password, and publicKey are required",
        });
      }
      if (password.length < 6) {
        return safeJson(res, 400, { ok: false, message: "Password too short (min 6)" });
      }

      const existing = await storage.getUserByUsername(username);
      if (existing) return safeJson(res, 409, { ok: false, message: "Username already exists" });

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await storage.createUser({
        username,
        passwordHash,
        publicKey,
      } as any);

      await storage.updateUserOnlineStatus(user.id, true);

      const token = signToken({ userId: user.id, username: user.username });

      return res.json({
        ok: true,
        token,
        user: { id: user.id, username: user.username, publicKey: user.publicKey },
      });
    } catch (err: any) {
      console.error("REGISTRATION ERROR:", err);
      return safeJson(res, 500, { ok: false, message: err?.message || "Registration failed" });
    }
  });

  // Login (returns JWT)
  app.post("/api/login", async (req, res) => {
    try {
      const parsed = loginUserSchema.parse(req.body);
      const username = String(parsed.username || "").trim();
      const password = String(parsed.password || "");

      const user = await storage.getUserByUsername(username);
      if (!user) return safeJson(res, 401, { ok: false, message: "Invalid username or password" });

      const ok = await bcrypt.compare(password, (user as any).passwordHash);
      if (!ok) return safeJson(res, 401, { ok: false, message: "Invalid username or password" });

      await storage.updateUserOnlineStatus(user.id, true);

      const token = signToken({ userId: user.id, username: user.username });

      return res.json({
        ok: true,
        token,
        user: { id: user.id, username: user.username, publicKey: user.publicKey },
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return safeJson(res, 400, { ok: false, message: "Invalid input", errors: err.errors });
      }
      console.error("LOGIN ERROR:", err);
      return safeJson(res, 500, { ok: false, message: err?.message || "Login failed" });
    }
  });

  // ---- Protected endpoints (requireAuth) ----

  app.get("/api/search-users", requireAuth, async (req: any, res) => {
    try {
      const q = String(req.query?.q || "").trim();
      const excludeId = req.auth?.userId ?? 0;
      if (!q) return res.json([]);
      const users = await storage.searchUsers(q, excludeId);
      return res.json(users);
    } catch (err) {
      console.error("Search users error:", err);
      return safeJson(res, 500, { ok: false, message: "Failed to search users" });
    }
  });

  app.post("/api/chats", requireAuth, async (req: any, res) => {
    try {
      const participant1Id = toInt(req.body?.participant1Id, 0);
      const participant2Id = toInt(req.body?.participant2Id, 0);

      // ✅ only allow the logged-in user to be participant1
      if (participant1Id !== req.auth.userId) {
        return safeJson(res, 403, { ok: false, message: "Forbidden" });
      }

      if (!participant1Id || !participant2Id) {
        return safeJson(res, 400, {
          ok: false,
          message: "participant1Id and participant2Id are required",
        });
      }

      const chat = await storage.getOrCreateChatByParticipants(participant1Id, participant2Id);

      // OPTIONAL: wenn er vorher gelöscht war, wieder sichtbar machen
      try {
        const wasDeleted = await storage.isChatDeletedForUser(participant1Id, chat.id);
        if (wasDeleted) await storage.reactivateChatForUser(participant1Id, chat.id);
      } catch {}

      return res.json({ ok: true, chat });
    } catch (err) {
      console.error("Create chat error:", err);
      return safeJson(res, 500, { ok: false, message: "Failed to create chat" });
    }
  });

  app.get("/api/chats/:userId", requireAuth, async (req: any, res) => {
    try {
      const userId = toInt(req.params.userId, 0);
      if (userId !== req.auth.userId) {
        return safeJson(res, 403, { ok: false, message: "Forbidden" });
      }
      const chats = await storage.getChatsByUserId(userId);
      return res.json(chats);
    } catch (err) {
      console.error("Get chats error:", err);
      return safeJson(res, 500, { ok: false, message: "Failed to fetch chats" });
    }
  });

  /**
   * ✅ FIX: Wenn User Chat gelöscht hat (deletedAt),
   * dürfen alte Nachrichten NIE wieder erscheinen.
   * Wir filtern serverseitig: createdAt > deletedAt
   */
  app.get("/api/chats/:chatId/messages", requireAuth, async (req: any, res) => {
    try {
      const chatId = toInt(req.params.chatId, 0);
      if (!chatId) return safeJson(res, 400, { ok: false, message: "Invalid chatId" });

      const userId = req.auth.userId;

      const deletedAt = await storage.getDeletedAtForUserChat(userId, chatId);
      const msgs = await storage.getMessagesByChat(chatId);

      const filtered = deletedAt
        ? msgs.filter((m: any) => new Date(m.createdAt).getTime() > new Date(deletedAt).getTime())
        : msgs;

      return res.json(filtered);
    } catch (err) {
      console.error("Get messages error:", err);
      return safeJson(res, 500, { ok: false, message: "Failed to fetch messages" });
    }
  });

  app.post("/api/chats/:chatId/mark-read", requireAuth, async (req: any, res) => {
    try {
      const chatId = toInt(req.params.chatId, 0);
      const userId = req.auth.userId;
      if (!chatId) return safeJson(res, 400, { ok: false, message: "chatId required" });

      await storage.resetUnreadCount(chatId, userId);
      return res.json({ ok: true, success: true });
    } catch (err) {
      console.error("Mark read error:", err);
      return safeJson(res, 500, { ok: false, message: "Failed to mark chat as read" });
    }
  });

  app.post("/api/chats/:chatId/delete", requireAuth, async (req: any, res) => {
    try {
      const chatId = toInt(req.params.chatId, 0);
      const userId = req.auth.userId;
      if (!chatId) return safeJson(res, 400, { ok: false, message: "chatId required" });

      await storage.deleteChatForUser(userId, chatId);
      return res.json({ ok: true, success: true });
    } catch (err) {
      console.error("Delete chat error:", err);
      return safeJson(res, 500, { ok: false, message: "Failed to delete chat" });
    }
  });

  app.post("/api/users/:userId/block", requireAuth, async (req: any, res) => {
    try {
      const blockedUserId = toInt(req.params.userId, 0);
      const blockerId = req.auth.userId;
      if (!blockedUserId) return safeJson(res, 400, { ok: false, message: "blocked userId required" });

      await storage.blockUser(blockerId, blockedUserId);
      return res.json({ ok: true, success: true });
    } catch (err) {
      console.error("Block user error:", err);
      return safeJson(res, 500, { ok: false, message: "Failed to block user" });
    }
  });

  app.post("/api/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return safeJson(res, 400, { ok: false, message: "No file uploaded" });

      return res.json({
        ok: true,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: `/uploads/${req.file.filename}`,
      });
    } catch (err) {
      console.error("Upload error:", err);
      return safeJson(res, 500, { ok: false, message: "Failed to upload file" });
    }
  });

  app.use("/uploads", express.static(uploadDir));

  // ============================
  // WebSocket
  // ============================
  const ipConnCount = new Map<string, number>();
  const MAX_CONNS_PER_IP = 10;

  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    maxPayload: 32 * 1024,
    perMessageDeflate: false,
  });

  // heartbeat
  setInterval(() => {
    wss.clients.forEach((client: any) => {
      if (client.isAlive === false) return client.terminate();
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  // cleanup expired messages
  setInterval(async () => {
    try {
      const deletedCount = await storage.deleteExpiredMessages();
      if (deletedCount > 0) console.log(`🧹 Cleaned up ${deletedCount} expired messages`);
    } catch (err) {
      console.error("❌ Error during message cleanup:", err);
    }
  }, 300000);

  wss.on("connection", (ws: any, req: any) => {
    // ✅ FIX: Origin-Check so, dass Render-Domain automatisch erlaubt ist
    const origin = req.headers.origin as string | undefined;

    const allowedOrigins = new Set<string>([
      "https://whisper3.onrender.com",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);

    const extra = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const o of extra) allowedOrigins.add(o);

    const forwardedHost =
      (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host;

    let sameHost = false;
    if (origin && forwardedHost) {
      try {
        const o = new URL(origin);
        sameHost = o.host === forwardedHost;
      } catch {
        sameHost = false;
      }
    }

    // Wenn origin fehlt (manche Clients/Tools), nicht blocken.
    if (origin && !(sameHost || allowedOrigins.has(origin))) {
      ws.close(1008, "Origin not allowed");
      return;
    }

    const xff = req.headers["x-forwarded-for"];
    const ip =
      typeof xff === "string" && xff.length > 0
        ? xff.split(",")[0].trim()
        : req.socket?.remoteAddress || "unknown";

    const curr = ipConnCount.get(ip) ?? 0;
    if (curr >= MAX_CONNS_PER_IP) {
      ws.close(1013, "Too many connections");
      return;
    }
    ipConnCount.set(ip, curr + 1);

    ws.on("close", () => {
      const now = (ipConnCount.get(ip) ?? 1) - 1;
      if (now <= 0) ipConnCount.delete(ip);
      else ipConnCount.set(ip, now);
    });

    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));

    let joinedUserId: number | null = null;

    ws.send(JSON.stringify({ type: "connection_established", ok: true }));

    ws.on("message", async (data: any) => {
      try {
        const raw = data.toString();
        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
          return;
        }

        // ✅ JOIN requires token
        if (parsed?.type === "join") {
          const token = String(parsed?.token || "");
          if (!token) {
            ws.send(JSON.stringify({ type: "error", message: "Missing token" }));
            return;
          }

          let payload: JwtPayload;
          try {
            payload = verifyToken(token);
          } catch {
            ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
            return;
          }

          joinedUserId = payload.userId;
          connectedClients.set(joinedUserId, { ws, userId: joinedUserId });
          await storage.updateUserOnlineStatus(joinedUserId, true);

          ws.send(JSON.stringify({ type: "join_confirmed", ok: true, userId: joinedUserId }));
          broadcast({ type: "user_status", userId: joinedUserId, isOnline: true }, joinedUserId);
          return;
        }

        // typing
        if (parsed?.type === "typing") {
          if (!joinedUserId) return;

          const receiverId = toInt(parsed.receiverId, 0);
          const senderId = toInt(parsed.senderId, 0);
          const chatId = toInt(parsed.chatId, 0);
          const isTyping = Boolean(parsed.isTyping);

          if (senderId !== joinedUserId) return;

          const receiverClient = connectedClients.get(receiverId);
          if (receiverClient?.ws?.readyState === WebSocket.OPEN) {
            receiverClient.ws.send(
              JSON.stringify({ type: "typing", chatId, senderId, receiverId, isTyping })
            );
          }
          return;
        }

        let validatedMessage: WSMessage;

        if (parsed.type === "message") {
          const msgData = parsed.message || parsed;
          validatedMessage = {
            type: "message",
            chatId: msgData.chatId || null,
            senderId: msgData.senderId,
            receiverId: msgData.receiverId,
            content: msgData.content,
            messageType: msgData.messageType || "text",
            fileName: msgData.fileName,
            fileSize: msgData.fileSize,
            destructTimer: msgData.destructTimer || 86400,
          } as any;
        } else {
          validatedMessage = wsMessageSchema.parse(parsed);
        }

        switch (validatedMessage.type) {
          case "message": {
            if (!joinedUserId) {
              ws.send(JSON.stringify({ type: "error", message: "Not joined" }));
              return;
            }

            const senderId = toInt((validatedMessage as any).senderId, 0);
            const receiverId = toInt((validatedMessage as any).receiverId, 0);

            if (!senderId || senderId !== joinedUserId) {
              ws.send(JSON.stringify({ type: "error", message: "Sender mismatch" }));
              return;
            }
            if (!receiverId) {
              ws.send(JSON.stringify({ type: "error", message: "Missing receiverId" }));
              return;
            }

            const chat = await storage.getOrCreateChatByParticipants(senderId, receiverId);

            // ✅ FIX: re-activate deleted chat for receiver AND sender if needed
            const wasDeletedReceiver = await storage.isChatDeletedForUser(receiverId, chat.id);
            if (wasDeletedReceiver) await storage.reactivateChatForUser(receiverId, chat.id);

            const wasDeletedSender = await storage.isChatDeletedForUser(senderId, chat.id);
            if (wasDeletedSender) await storage.reactivateChatForUser(senderId, chat.id);

            const destructTimerSec = normalizeDestructTimerSeconds((validatedMessage as any).destructTimer);
            const expiresAt = new Date(Date.now() + destructTimerSec * 1000);

            const newMessage = await storage.createMessage({
              chatId: chat.id,
              senderId,
              receiverId,
              content: (validatedMessage as any).content,
              messageType: (validatedMessage as any).messageType,
              fileName: (validatedMessage as any).fileName,
              fileSize: (validatedMessage as any).fileSize,
              destructTimer: destructTimerSec as any,
              isRead: false as any,
              expiresAt,
            } as any);

            await storage.updateChatLastMessage(chat.id, (newMessage as any).id);

            ws.send(
              JSON.stringify({
                type: "message_sent",
                ok: true,
                messageId: (newMessage as any).id,
                chatId: chat.id,
              })
            );

            const payload = { type: "new_message", message: newMessage };

            const senderClient = connectedClients.get(senderId);
            if (senderClient?.ws?.readyState === WebSocket.OPEN) senderClient.ws.send(JSON.stringify(payload));

            const receiverClient = connectedClients.get(receiverId);
            if (receiverClient?.ws?.readyState === WebSocket.OPEN) receiverClient.ws.send(JSON.stringify(payload));

            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
        try {
          ws.send(JSON.stringify({ type: "error", message: "WebSocket processing error" }));
        } catch {}
      }
    });

    ws.on("close", async () => {
      if (joinedUserId) {
        connectedClients.delete(joinedUserId);
        await storage.updateUserOnlineStatus(joinedUserId, false);
        broadcast({ type: "user_status", userId: joinedUserId, isOnline: false }, joinedUserId);
      }
    });

    ws.on("error", (err: any) => console.error("❌ WEBSOCKET ERROR:", err));
  });

  return httpServer;
}
