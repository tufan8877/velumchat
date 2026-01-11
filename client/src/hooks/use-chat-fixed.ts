import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import type { Chat, Message, User } from "@shared/schema";

export function useChatFixed(userId?: number, socket?: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [selectedChat, setSelectedChat] = useState<(Chat & { otherUser: User }) | null>(null);
  const messageTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Auto-delete expired messages from UI
  const scheduleMessageDeletion = useCallback((message: Message) => {
    const timeUntilExpiry = new Date(message.expiresAt).getTime() - Date.now();
    
    if (timeUntilExpiry > 0) {
      console.log(`⏱️ Scheduling deletion for message ${message.id} in ${timeUntilExpiry}ms`);
      
      const timer = setTimeout(() => {
        console.log(`🗑️ Auto-deleting expired message ${message.id}`);
        setMessages(prev => prev.filter(m => m.id !== message.id));
        messageTimers.current.delete(message.id);
      }, timeUntilExpiry);
      
      messageTimers.current.set(message.id, timer);
    } else {
      console.log(`⚠️ Message ${message.id} already expired, removing immediately`);
      setMessages(prev => prev.filter(m => m.id !== message.id));
    }
  }, []);

  // Fetch user's chats
  const { data: rawChats, isLoading, error: chatsError } = useQuery({
    queryKey: [`/api/chats/${userId}`],
    enabled: !!userId,
    retry: 3,
    refetchInterval: 5000,
  });

  const chats = Array.isArray(rawChats) ? rawChats : [];

  // Fetch messages for selected chat
  const { data: rawMessages, error: messagesError } = useQuery({
    queryKey: [`/api/chats/${selectedChatId}/messages`],
    enabled: !!selectedChatId,
    retry: 3,
    refetchInterval: 3000,
  });

  // Process messages and decrypt them
  useEffect(() => {
    const processMessages = async () => {
      const processedMessages = Array.isArray(rawMessages) ? rawMessages : [];
      
      // Get current user's private key for decryption
      const userData = localStorage.getItem("user");
      if (!userData) {
        setMessages(processedMessages);
        return;
      }

      const currentUser = JSON.parse(userData);
      const privateKey = currentUser.privateKey;

      if (!privateKey) {
        setMessages(processedMessages);
        return;
      }

      // Decrypt all messages
      const decryptedMessages = await Promise.all(
        processedMessages.map(async (message: Message) => {
          try {
            if (message.senderId === currentUser.id) {
              // Own message - already decrypted or unencrypted
              return message;
            } else {
              // Other's message - decrypt it
              const decryptedContent = await decryptMessage(message.content, privateKey);
              return { ...message, content: decryptedContent };
            }
          } catch (error) {
            console.error(`Failed to decrypt message ${message.id}:`, error);
            return { ...message, content: "[Decryption failed]" };
          }
        })
      );

      console.log(`📝 Processed ${decryptedMessages.length} messages for chat ${selectedChatId}`);
      setMessages(decryptedMessages);

      // Schedule deletion for all messages
      decryptedMessages.forEach(message => {
        if (message.expiresAt) {
          scheduleMessageDeletion(message);
        }
      });
    };

    if (rawMessages) {
      processMessages();
    }
  }, [rawMessages, selectedChatId, scheduleMessageDeletion]);

  // Listen for new messages via WebSocket
  useEffect(() => {
    if (!socket) {
      console.log('❌ No socket available for message listening');
      return;
    }

    const handleNewMessage = async (data: any) => {
      console.log('🎧 CHAT HOOK - WebSocket message received:', data.type, data);
      
      // Handle different message types
      if (data.type === 'new_message' && data.message) {
        const newMessage = data.message;
        console.log('📬 New message for chat:', newMessage.chatId, 'current chat:', selectedChatId);
        
        // Only add if it's for the current chat and not from current user
        const userData = localStorage.getItem("user");
        if (userData) {
          const currentUser = JSON.parse(userData);
          
          if (newMessage.chatId === selectedChatId) {
            console.log('✅ Adding message to current chat');
            
            // Only process if not from current user (avoid duplicates)
            if (newMessage.senderId !== currentUser.id) {
              console.log('📨 Processing incoming message from user:', newMessage.senderId);
              
              // Decrypt the message
              let decryptedContent = newMessage.content;
              if (currentUser.privateKey) {
                try {
                  decryptedContent = await decryptMessage(newMessage.content, currentUser.privateKey);
                  console.log('🔓 Message decrypted successfully');
                } catch (error) {
                  console.error('Failed to decrypt incoming message:', error);
                  decryptedContent = "[Decryption failed]";
                }
              }
              
              const displayMessage = {
                ...newMessage,
                content: decryptedContent
              };
              
              setMessages(prev => [...prev, displayMessage]);
              
              // Schedule deletion
              if (newMessage.expiresAt) {
                scheduleMessageDeletion(displayMessage);
              }
            } else {
              console.log('🔄 Skipping own message - already handled optimistically');
            }
          }
        }
        
        // Always refresh chats to update last message
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${userId}`] });
      }
      
      // Handle message sent confirmation
      if (data.type === 'message_sent') {
        console.log('✅ Message sent confirmation:', data.messageId);
      }
    };

    socket.on('message', handleNewMessage);
    
    return () => {
      socket.off('message', handleNewMessage);
    };
  }, [socket, selectedChatId, userId, queryClient, scheduleMessageDeletion]);

  // Send message function
  const sendMessage = useCallback(async (
    content: string, 
    type: string = "text", 
    destructTimer: number = 300, // 5 minutes default in seconds
    file?: File
  ) => {
    if (!selectedChat?.otherUser?.id || !selectedChatId || !userId) {
      console.error("❌ Missing required data for sending message");
      toast({
        title: "Error",
        description: "Cannot send message - chat not selected",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("📤 Sending message:", {
        content: content.substring(0, 20),
        type,
        chatId: selectedChatId,
        receiverId: selectedChat.otherUser.id,
        destructTimer
      });

      // Get receiver's public key for encryption
      const receiverPublicKey = selectedChat.otherUser.publicKey;
      if (!receiverPublicKey) {
        throw new Error("Receiver's public key not found");
      }

      // Encrypt the message content
      const encryptedContent = await encryptMessage(content, receiverPublicKey);
      console.log("🔐 Message encrypted successfully");

      // Calculate expiration time (destructTimer is in seconds)
      const expiresAt = new Date(Date.now() + (destructTimer * 1000));

      // Create optimistic message for immediate UI update
      const optimisticMessage = {
        id: Date.now(), // Temporary ID
        chatId: selectedChatId,
        senderId: userId,
        receiverId: selectedChat.otherUser.id,
        content: content, // Unencrypted for display
        messageType: type,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      };
      
      // Add to UI immediately
      setMessages(prev => [...prev, optimisticMessage]);
      console.log("📱 Optimistic message added to UI");

      // Send via WebSocket for real-time delivery
      if (socket && socket.isConnected) {
        const wsMessage = {
          type: "message",
          chatId: selectedChatId,
          senderId: userId,
          receiverId: selectedChat.otherUser.id,
          content: encryptedContent,
          messageType: type,
          destructTimer: Math.floor(destructTimer / 1000), // Convert to seconds
          fileName: null,
        };
        
        socket.send(JSON.stringify(wsMessage));
        console.log("📡 Message sent via WebSocket");
      } else {
        console.log("❌ WebSocket not connected, message not sent");
      }

      // Refresh chats to update last message
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${userId}`] });

    } catch (error: any) {
      console.error("❌ Failed to send message:", error);
      toast({
        title: "Error sending message",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    }
  }, [selectedChat, selectedChatId, userId, socket, queryClient, toast, scheduleMessageDeletion]);

  // Select chat function
  const selectChat = useCallback((chat: Chat & { otherUser: User }) => {
    console.log("🎯 Selecting chat:", chat.id, "with user:", chat.otherUser.username);
    
    setSelectedChatId(chat.id);
    setSelectedChat(chat);
    
    // Clear previous messages and timers
    messageTimers.current.forEach(timer => clearTimeout(timer));
    messageTimers.current.clear();
    setMessages([]);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      messageTimers.current.forEach(timer => clearTimeout(timer));
      messageTimers.current.clear();
    };
  }, []);

  return {
    chats,
    messages,
    selectedChat,
    selectedChatId,
    sendMessage,
    selectChat,
    isLoading,
  };
}