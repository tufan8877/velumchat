// server/storage.ts
import {
  users,
  messages,
  chats,
  blockedUsers,
  deletedChats,
  type User,
  type InsertUser,
  type Message,
  type InsertMessage,
  type Chat,
  type InsertChat,
} from "@shared/schema";

import { db } from "./db";
import { eq, and, or, desc, asc, sql, ne, isNull } from "drizzle-orm";

/* =========================================================
   STORAGE INTERFACE
========================================================= */
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserOnlineStatus(id: number, isOnline: boolean): Promise<void>;

  // Messages
  createMessage(message: InsertMessage & { expiresAt: Date }): Promise<Message>;
  getMessagesByChat(chatId: number): Promise<Message[]>;
  deleteExpiredMessages(): Promise<number>;

  // Chats
  createChat(chat: InsertChat): Promise<Chat>;
  getChatsByUserId(
    userId: number
  ): Promise<Array<Chat & { otherUser: User; lastMessage?: Message; unreadCount: number }>>;

  getChatByParticipants(user1Id: number, user2Id: number): Promise<Chat | undefined>;
  getOrCreateChatByParticipants(user1Id: number, user2Id: number): Promise<Chat>;
  updateChatLastMessage(chatId: number, messageId: number): Promise<void>;
  incrementUnreadCount(chatId: number, userId: number): Promise<void>;
  resetUnreadCount(chatId: number, userId: number): Promise<void>;

  // Search
  searchUsers(query: string, excludeId: number): Promise<User[]>;

  // Block / Delete chat
  blockUser(blockerId: number, blockedId: number): Promise<void>;

  // ✅ Delete with timestamp (cutoff)
  deleteChatForUser(userId: number, chatId: number): Promise<void>;
  getDeletedAtForUserChat(userId: number, chatId: number): Promise<Date | null>;

  // (legacy helpers)
  isChatDeletedForUser(userId: number, chatId: number): Promise<boolean>;
  reactivateChatForUser(userId: number, chatId: number): Promise<void>;
}

/* =========================================================
   DATABASE STORAGE (Render / Postgres)
========================================================= */
class DatabaseStorage implements IStorage {
  // --------------------
  // Users
  // --------------------
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUserOnlineStatus(id: number, isOnline: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isOnline, lastSeen: new Date() } as any)
      .where(eq(users.id, id));
  }

  // --------------------
  // Messages
  // --------------------
  async createMessage(message: InsertMessage & { expiresAt: Date }): Promise<Message> {
    const [msg] = await db.insert(messages).values(message as any).returning();
    return msg;
  }

  async getMessagesByChat(chatId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt));
  }

  async deleteExpiredMessages(): Promise<number> {
    const now = new Date();
    const result: any = await db.delete(messages).where(sql`${messages.expiresAt} < ${now}`);
    return (result?.rowCount ?? result?.changes ?? 0) as number;
  }

  // --------------------
  // Chats
  // --------------------
  async createChat(chat: InsertChat): Promise<Chat> {
    const [created] = await db.insert(chats).values(chat as any).returning();
    return created;
  }

  async getChatsByUserId(
    userId: number
  ): Promise<Array<Chat & { otherUser: User; lastMessage?: Message; unreadCount: number }>> {
    const rows = await db
      .select({
        chat: chats,
        otherUser: users,
        lastMessage: messages,
        deleted: deletedChats,
      })
      .from(chats)
      .leftJoin(
        users,
        or(
          and(eq(chats.participant1Id, userId), eq(users.id, chats.participant2Id)),
          and(eq(chats.participant2Id, userId), eq(users.id, chats.participant1Id))
        )
      )
      .leftJoin(messages, eq(messages.id, chats.lastMessageId))
      .leftJoin(
        deletedChats,
        and(eq(deletedChats.chatId, chats.id), eq(deletedChats.userId, userId))
      )
      .where(
        and(
          or(eq(chats.participant1Id, userId), eq(chats.participant2Id, userId)),
          isNull(deletedChats.id) // ✅ hide deleted chats in list
        )
      )
      .orderBy(desc(chats.lastMessageTimestamp), desc(chats.createdAt));

    return rows.map((r) => ({
      ...r.chat,
      otherUser: r.otherUser!,
      lastMessage: r.lastMessage ?? undefined,
      unreadCount: r.chat.participant1Id === userId ? r.chat.unreadCount1 : r.chat.unreadCount2,
    }));
  }

  async getChatByParticipants(user1Id: number, user2Id: number): Promise<Chat | undefined> {
    const [chat] = await db
      .select()
      .from(chats)
      .where(
        or(
          and(eq(chats.participant1Id, user1Id), eq(chats.participant2Id, user2Id)),
          and(eq(chats.participant1Id, user2Id), eq(chats.participant2Id, user1Id))
        )
      );
    return chat || undefined;
  }

  async getOrCreateChatByParticipants(user1Id: number, user2Id: number): Promise<Chat> {
    let chat = await this.getChatByParticipants(user1Id, user2Id);
    if (!chat) {
      chat = await this.createChat({
        participant1Id: user1Id,
        participant2Id: user2Id,
        unreadCount1: 0,
        unreadCount2: 0,
        lastMessageTimestamp: new Date(),
      } as any);
    }
    return chat;
  }

  async updateChatLastMessage(chatId: number, messageId: number): Promise<void> {
    await db
      .update(chats)
      .set({ lastMessageId: messageId as any, lastMessageTimestamp: new Date() } as any)
      .where(eq(chats.id, chatId));
  }

  async incrementUnreadCount(chatId: number, userId: number): Promise<void> {
    const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
    if (!chat) return;

    if (chat.participant1Id === userId) {
      await db
        .update(chats)
        .set({ unreadCount1: sql`${chats.unreadCount1} + 1` } as any)
        .where(eq(chats.id, chatId));
    } else if (chat.participant2Id === userId) {
      await db
        .update(chats)
        .set({ unreadCount2: sql`${chats.unreadCount2} + 1` } as any)
        .where(eq(chats.id, chatId));
    }
  }

  async resetUnreadCount(chatId: number, userId: number): Promise<void> {
    const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
    if (!chat) return;

    if (chat.participant1Id === userId) {
      await db.update(chats).set({ unreadCount1: 0 } as any).where(eq(chats.id, chatId));
    } else if (chat.participant2Id === userId) {
      await db.update(chats).set({ unreadCount2: 0 } as any).where(eq(chats.id, chatId));
    }
  }

  // --------------------
  // Search
  // --------------------
  async searchUsers(query: string, excludeId: number): Promise<User[]> {
    const validExcludeId = Number.isFinite(excludeId) ? excludeId : 0;

    return await db
      .select()
      .from(users)
      .where(and(sql`${users.username} ILIKE ${"%" + query + "%"}`, ne(users.id, validExcludeId)))
      .limit(10);
  }

  // --------------------
  // Block / Deleted chats
  // --------------------
  async blockUser(blockerId: number, blockedId: number): Promise<void> {
    await db.insert(blockedUsers).values({ blockerId, blockedId } as any).onConflictDoNothing();
  }

  /**
   * ✅ Delete = set deletedAt cutoff
   * SAFE Version (works even if DB has no unique constraint)
   */
  async deleteChatForUser(userId: number, chatId: number): Promise<void> {
    const now = new Date();

    // 1) check if row exists
    const [existing] = await db
      .select({ id: deletedChats.id })
      .from(deletedChats)
      .where(and(eq(deletedChats.userId, userId), eq(deletedChats.chatId, chatId)));

    if (existing?.id) {
      // 2) update existing
      await db
        .update(deletedChats)
        .set({ deletedAt: now } as any)
        .where(eq(deletedChats.id, existing.id));
      return;
    }

    // 3) insert new
    await db.insert(deletedChats).values({ userId, chatId, deletedAt: now } as any);
  }

  async getDeletedAtForUserChat(userId: number, chatId: number): Promise<Date | null> {
    const [row] = await db
      .select({ deletedAt: deletedChats.deletedAt })
      .from(deletedChats)
      .where(and(eq(deletedChats.userId, userId), eq(deletedChats.chatId, chatId)));

    return row?.deletedAt ?? null;
  }

  async isChatDeletedForUser(userId: number, chatId: number): Promise<boolean> {
    const [row] = await db
      .select({ id: deletedChats.id })
      .from(deletedChats)
      .where(and(eq(deletedChats.userId, userId), eq(deletedChats.chatId, chatId)));
    return !!row?.id;
  }

  // ⚠️ Manuell möglich, wird aber NICHT mehr automatisch beim Senden gemacht.
  async reactivateChatForUser(userId: number, chatId: number): Promise<void> {
    await db
      .delete(deletedChats)
      .where(and(eq(deletedChats.userId, userId), eq(deletedChats.chatId, chatId)));
  }
}

/* =========================================================
   SINGLE EXPORT
========================================================= */
export const storage: IStorage = new DatabaseStorage();
export default storage;
