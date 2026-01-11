import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  publicKey: text("public_key").notNull(),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"), // text, image, file
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  destructTimer: integer("destruct_timer").notNull().default(86400), // seconds
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  participant1Id: integer("participant1_id").notNull(),
  participant2Id: integer("participant2_id").notNull(),
  lastMessageId: integer("last_message_id"),
  lastMessageTimestamp: timestamp("last_message_timestamp").defaultNow(),
  unreadCount1: integer("unread_count_1").notNull().default(0),
  unreadCount2: integer("unread_count_2").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blockedUsers = pgTable("blocked_users", {
  id: serial("id").primaryKey(),
  blockerId: integer("blocker_id").notNull(),
  blockedId: integer("blocked_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deletedChats = pgTable("deleted_chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  chatId: integer("chat_id").notNull(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(), // ✅ cutoff time
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  passwordHash: true,
  publicKey: true,
});

export const loginUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  chatId: true,
  senderId: true,
  receiverId: true,
  content: true,
  messageType: true,
  fileName: true,
  fileSize: true,
  destructTimer: true,
  isRead: true,
});

export const insertChatSchema = createInsertSchema(chats).pick({
  participant1Id: true,
  participant2Id: true,
  unreadCount1: true,
  unreadCount2: true,
  lastMessageTimestamp: true,
});

export const insertBlockedUserSchema = createInsertSchema(blockedUsers).pick({
  blockerId: true,
  blockedId: true,
});

export const insertDeletedChatSchema = createInsertSchema(deletedChats).pick({
  userId: true,
  chatId: true,
  deletedAt: true, // ✅ wichtig
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type BlockedUser = typeof blockedUsers.$inferSelect;
export type InsertBlockedUser = z.infer<typeof insertBlockedUserSchema>;
export type DeletedChat = typeof deletedChats.$inferSelect;
export type InsertDeletedChat = z.infer<typeof insertDeletedChatSchema>;

/**
 * ✅ WebSocket message types
 * WICHTIG: join ist jetzt token-basiert (dein Server erwartet token)
 */
export const wsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    token: z.string().min(1),
  }),
  z.object({
    type: z.literal("message"),
    chatId: z.number().nullable(),
    senderId: z.number(),
    receiverId: z.number(),
    content: z.string(),
    messageType: z.enum(["text", "image", "file"]),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    destructTimer: z.number(),
  }),
  z.object({
    type: z.literal("typing"),
    chatId: z.number(),
    senderId: z.number(),
    receiverId: z.number(),
    isTyping: z.boolean(),
  }),
  z.object({
    type: z.literal("read_receipt"),
    messageId: z.number(),
    userId: z.number(),
  }),
]);

export type WSMessage = z.infer<typeof wsMessageSchema>;
