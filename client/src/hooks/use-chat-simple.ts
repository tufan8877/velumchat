import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Chat, Message, User } from "@shared/schema";

export function useChatSimple(userId?: number, socket?: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch user's chats
  const { data: chats = [], isLoading } = useQuery({
    queryKey: [`/api/chats/${userId}`],
    enabled: !!userId,
    refetchInterval: 5000,
  });

  // Fetch messages for selected chat
  const { data: chatMessages = [] } = useQuery({
    queryKey: [`/api/chats/${selectedChatId}/messages`],
    enabled: !!selectedChatId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    console.log("📋 CRITICAL: Messages updated from query:", chatMessages.length);
    setMessages(Array.isArray(chatMessages) ? chatMessages : []);
  }, [chatMessages]);

  // WebSocket message handler
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      console.log("📥 CRITICAL: New message received:", data);
      
      if (data.message) {
        setMessages(prev => {
          if (prev.find(m => m.id === data.message.id)) {
            return prev;
          }
          console.log("✅ CRITICAL: Adding new message to UI");
          return [...prev, data.message];
        });
        
        // Refresh queries
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${userId}`] });
        if (selectedChatId) {
          queryClient.invalidateQueries({ queryKey: [`/api/chats/${selectedChatId}/messages`] });
        }
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("message_sent", handleNewMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_sent", handleNewMessage);
    };
  }, [socket, userId, selectedChatId, queryClient]);

  const sendMessage = useCallback(async (
    content: string,
    type: string,
    destructTimer: number
  ) => {
    if (!userId || !selectedChatId) {
      console.log("❌ CRITICAL: Missing send requirements");
      return false;
    }

    try {
      console.log("📤 CRITICAL: Starting message send process");
      
      // Find receiver
      const chat = chats.find(c => c.id === selectedChatId);
      if (!chat) {
        console.log("❌ CRITICAL: Chat not found");
        return false;
      }

      const receiverId = chat.participant1Id === userId ? chat.participant2Id : chat.participant1Id;
      console.log("📧 CRITICAL: Sending to receiver:", receiverId);

      // Use HTTP API directly for reliability
      const response = await apiRequest("POST", "/api/messages", {
        chatId: selectedChatId,
        senderId: userId,
        receiverId,
        content,
        messageType: type,
        destructTimer
      });

      if (response.ok) {
        const sentMessage = await response.json();
        console.log("✅ CRITICAL: Message sent via HTTP with ID:", sentMessage.id);
        
        // Add to UI immediately
        setMessages(prev => {
          if (prev.find(m => m.id === sentMessage.id)) {
            return prev;
          }
          return [...prev, sentMessage];
        });
        
        // Refresh queries
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${userId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${selectedChatId}/messages`] });
        
        toast({
          title: "Message sent",
          description: "Your message has been delivered",
        });
        
        return true;
      }
      
      console.log("❌ CRITICAL: HTTP send failed");
      return false;
    } catch (error) {
      console.error("❌ CRITICAL: Send error:", error);
      toast({
        title: "Send failed",
        description: "Could not send message",
        variant: "destructive",
      });
      return false;
    }
  }, [userId, selectedChatId, chats, queryClient, toast]);

  const selectChat = useCallback((chat: Chat & { otherUser: User }) => {
    console.log("📋 CRITICAL: Selecting chat:", chat.id);
    setSelectedChatId(chat.id);
  }, []);

  return {
    chats,
    messages,
    sendMessage,
    selectChat,
    isLoading,
    selectedChat: chats.find(c => c.id === selectedChatId),
    selectedChatId
  };
}