import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Chat, Message, User } from "@shared/schema";

export function useChatDebug(userId?: number) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  console.log("🔄 CRITICAL: useChatDebug initialized with userId:", userId);

  // Fetch user's chats
  const { data: chats = [], isLoading, error: chatsError } = useQuery({
    queryKey: [`/api/chats/${userId}`],
    enabled: !!userId,
    refetchInterval: 5000,
  });

  console.log("📋 CRITICAL: Chats query result:", {
    chatsLength: chats.length,
    isLoading,
    error: chatsError,
    userId
  });

  // Fetch messages for selected chat
  const { data: chatMessages = [], error: messagesError } = useQuery({
    queryKey: [`/api/chats/${selectedChatId}/messages`],
    enabled: !!selectedChatId,
    refetchInterval: 2000,
  });

  console.log("💬 CRITICAL: Messages query result:", {
    messagesLength: chatMessages.length,
    selectedChatId,
    error: messagesError
  });

  useEffect(() => {
    console.log("📋 CRITICAL: Setting messages from query:", chatMessages.length);
    if (Array.isArray(chatMessages)) {
      setMessages(chatMessages);
      console.log("✅ CRITICAL: Messages set successfully:", chatMessages.length);
    } else {
      console.log("❌ CRITICAL: Invalid messages data:", chatMessages);
      setMessages([]);
    }
  }, [chatMessages]);

  const sendMessage = useCallback(async (
    content: string,
    type: string,
    destructTimer: number
  ) => {
    console.log("📤 CRITICAL: sendMessage called with:", {
      content: content.substring(0, 30),
      type,
      destructTimer,
      userId,
      selectedChatId,
      chatsLength: chats.length
    });

    if (!userId || !selectedChatId) {
      console.log("❌ CRITICAL: Missing requirements for send");
      return false;
    }

    try {
      // Find receiver
      const chat = chats.find(c => c.id === selectedChatId);
      if (!chat) {
        console.log("❌ CRITICAL: Chat not found for ID:", selectedChatId);
        return false;
      }

      const receiverId = chat.participant1Id === userId ? chat.participant2Id : chat.participant1Id;
      console.log("📧 CRITICAL: Determined receiver:", receiverId);

      // Send via HTTP API
      console.log("🌐 CRITICAL: Sending HTTP request to /api/messages");
      const response = await apiRequest("POST", "/api/messages", {
        chatId: selectedChatId,
        senderId: userId,
        receiverId,
        content,
        messageType: type,
        destructTimer
      });

      console.log("📡 CRITICAL: HTTP response status:", response.status);

      if (response.ok) {
        const sentMessage = await response.json();
        console.log("✅ CRITICAL: Message sent successfully:", {
          messageId: sentMessage.id,
          chatId: sentMessage.chatId,
          content: sentMessage.content.substring(0, 30)
        });
        
        // Force immediate UI update
        setMessages(prev => {
          console.log("🔄 CRITICAL: Adding message to UI, prev length:", prev.length);
          const newMessages = [...prev, sentMessage];
          console.log("✅ CRITICAL: New messages length:", newMessages.length);
          return newMessages;
        });
        
        // Force query refresh
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${userId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${selectedChatId}/messages`] });
        
        toast({
          title: "Message sent",
          description: "Your message has been delivered",
        });
        
        return true;
      } else {
        console.log("❌ CRITICAL: HTTP request failed with status:", response.status);
        return false;
      }
    } catch (error) {
      console.error("❌ CRITICAL: Send message error:", error);
      toast({
        title: "Send failed",
        description: "Could not send message",
        variant: "destructive",
      });
      return false;
    }
  }, [userId, selectedChatId, chats, queryClient, toast]);

  const selectChat = useCallback((chat: Chat & { otherUser: User }) => {
    console.log("📋 CRITICAL: Selecting chat:", {
      chatId: chat.id,
      otherUser: chat.otherUser.username
    });
    setSelectedChatId(chat.id);
  }, []);

  const selectedChat = chats.find(c => c.id === selectedChatId);

  console.log("🎯 CRITICAL: Final hook state:", {
    chatsLength: chats.length,
    messagesLength: messages.length,
    selectedChatId,
    selectedChatExists: !!selectedChat,
    isLoading
  });

  return {
    chats,
    messages,
    sendMessage,
    selectChat,
    isLoading,
    selectedChat,
    selectedChatId
  };
}