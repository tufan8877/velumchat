import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { encryptMessage, decryptMessage } from '@/lib/crypto';
import type { User, Chat, Message } from '@shared/schema';

export function useChatReliable(userId?: number, socket?: any) {
  const [selectedChat, setSelectedChat] = useState<(Chat & { otherUser: User }) | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const selectedChatId = selectedChat?.id;

  // Fetch chats with aggressive mobile updates
  const { data: chats = [], isLoading } = useQuery({
    queryKey: [`/api/chats/${userId}`],
    enabled: !!userId,
    refetchInterval: 2000, // Faster updates for mobile - every 2 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: true, // Continue polling even when tab inactive
    staleTime: 0, // Always consider data stale for immediate updates
  });

  // Fetch messages for selected chat
  const { data: rawMessages = [] } = useQuery({
    queryKey: [`/api/chats/${selectedChatId}/messages`],
    enabled: !!selectedChatId,
  });

  // Decrypt and set messages
  useEffect(() => {
    const processMessages = async () => {
      if (!rawMessages.length || !selectedChatId) {
        setMessages([]);
        return;
      }

      console.log('🔄 Processing messages for chat:', selectedChatId, 'Count:', rawMessages.length);
      
      const userData = localStorage.getItem("user");
      if (!userData) return;

      const currentUser = JSON.parse(userData);
      const decryptedMessages: Message[] = [];

      for (const message of rawMessages) {
        let decryptedContent = message.content;

        if (currentUser.privateKey && message.content) {
          try {
            console.log('🔓 Attempting to decrypt message ID:', message.id);
            console.log('🔍 Message content preview:', message.content.substring(0, 50) + '...');
            
            // Check if message is encrypted before attempting decryption
            const isEncrypted = message.content.length > 100 && /^[A-Za-z0-9+/=]+$/.test(message.content);
            
            if (isEncrypted) {
              decryptedContent = await decryptMessage(message.content, currentUser.privateKey);
              console.log('✅ Historical message decrypted successfully');
            } else {
              decryptedContent = message.content;
              console.log('📝 Historical message is plain text');
            }
          } catch (error) {
            console.error('❌ Failed to decrypt message:', error);
            console.log('⚠️ Using original content as fallback');
            decryptedContent = message.content; // Use original content instead of error message
          }
        }

        decryptedMessages.push({
          ...message,
          content: decryptedContent
        });
      }

      setMessages(decryptedMessages);
      console.log('✅ Messages processed and decrypted:', decryptedMessages.length);
    };

    processMessages();
  }, [rawMessages, selectedChatId]);

  // WebSocket message handler
  useEffect(() => {
    if (!socket) {
      console.log('⚠️ No socket available for message handler');
      return;
    }

    const handleMessage = async (data: any) => {
      console.log('🎧 RELIABLE CHAT - Message received:', data.type, data);
      
      if (data.type === 'new_message' && data.message) {
        const newMessage = data.message;
        console.log('📬 New message details:', {
          messageId: newMessage.id,
          chatId: newMessage.chatId,
          senderId: newMessage.senderId,
          currentChatId: selectedChatId,
          content: newMessage.content
        });
        
        // CRITICAL: Aggressive mobile chat list refresh
        console.log('📱 MOBILE FIX: Implementing aggressive chat list refresh...');
        
        // Immediate invalidation
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${userId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/chats/${newMessage.senderId}`] });
        
        // Force immediate refetch
        queryClient.refetchQueries({ queryKey: [`/api/chats/${userId}`] });
        queryClient.refetchQueries({ queryKey: [`/api/chats/${newMessage.senderId}`] });
        
        // Multiple timed refreshes for stubborn mobile browsers
        const refreshTimes = [100, 300, 500, 1000, 2000];
        refreshTimes.forEach(delay => {
          setTimeout(() => {
            console.log(`📱 Mobile refresh attempt at ${delay}ms`);
            queryClient.invalidateQueries({ queryKey: [`/api/chats/${userId}`] });
            queryClient.refetchQueries({ queryKey: [`/api/chats/${userId}`] });
          }, delay);
        });
        
        // Add message to current chat if it's the active chat
        if (newMessage.chatId === selectedChatId) {
          const userData = localStorage.getItem("user");
          if (userData) {
            const currentUser = JSON.parse(userData);
            
            console.log('📨 Processing message for current chat. SenderId:', newMessage.senderId, 'CurrentUserId:', currentUser.id);
            
            // Skip messages from current user (already added optimistically)
            if (newMessage.senderId === currentUser.id) {
              console.log('📝 Skipping own message - already displayed optimistically');
              return;
            }
            
            // Only process received messages (from other users)
            let decryptedContent = newMessage.content;
            
            // Check if message is encrypted (base64 format, longer than 100 chars)
            const isEncrypted = newMessage.content.length > 100 && /^[A-Za-z0-9+/=]+$/.test(newMessage.content);
            
            if (currentUser.privateKey && isEncrypted) {
              try {
                console.log('🔓 Decrypting encrypted message...');
                console.log('📝 Encrypted length:', newMessage.content.length);
                
                decryptedContent = await decryptMessage(newMessage.content, currentUser.privateKey);
                console.log('✅ Message decrypted:', decryptedContent.substring(0, 30) + '...');
              } catch (error) {
                console.error('❌ Decryption failed:', error);
                decryptedContent = "[Entschlüsselung fehlgeschlagen]";
              }
            } else if (!isEncrypted) {
              console.log('📝 Message is plain text, using as-is');
              decryptedContent = newMessage.content;
            } else {
              console.log('⚠️ No private key for encrypted message');
              decryptedContent = "[Verschlüsselte Nachricht - Schlüssel fehlt]";
            }

            const displayMessage = { ...newMessage, content: decryptedContent };
            
            // Schedule message deletion
            scheduleMessageDeletion(displayMessage);
            
            // Check if message already exists to avoid duplicates
            setMessages(prev => {
              const exists = prev.some(m => m.id === newMessage.id);
              if (exists) {
                console.log('📝 Message already exists, updating with decrypted content');
                // Update existing message with decrypted content
                return prev.map(m => m.id === newMessage.id ? displayMessage : m);
              }
              console.log('📝 Adding new message to chat');
              return [...prev, displayMessage];
            });
          }
        }
      }
    };

    console.log('🔗 Setting up message handler for socket');
    socket.on('message', handleMessage);
    
    return () => {
      console.log('🔌 Cleaning up message handler');
      socket.off('message', handleMessage);
    };
  }, [socket, selectedChatId, userId, queryClient]);

  // MOBILE CRITICAL: Auto-activate chat when receiving messages
  useEffect(() => {
    if (!socket || !userId) return;

    const handleIncomingMessage = (data: any) => {
      console.log('📱 MOBILE HANDLER: Incoming message detected', data);
      
      if (data.type === 'new_message' && data.message) {
        const message = data.message;
        
        // Only handle messages TO this user (not from this user)
        if (message.receiverId === userId && message.senderId !== userId) {
          console.log('📱 MOBILE: Message is FOR this user, auto-activating 1:1 chat');
          console.log('📱 MOBILE: Looking for chat with sender ID:', message.senderId);
          
          // Find the SPECIFIC 1:1 chat with this sender
          const senderChat = chats.find(chat => 
            (chat.participant1Id === message.senderId && chat.participant2Id === userId) ||
            (chat.participant1Id === userId && chat.participant2Id === message.senderId)
          );
          
          if (senderChat && (!selectedChat || selectedChat.id !== senderChat.id)) {
            console.log('📱 MOBILE: Auto-activating 1:1 chat from sender:', senderChat.otherUser?.username, 'Chat ID:', senderChat.id);
            setSelectedChat(senderChat);
            
            // Force refresh messages for this specific chat
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: [`/api/chats/${senderChat.id}/messages`] });
              queryClient.refetchQueries({ queryKey: [`/api/chats/${senderChat.id}/messages`] });
            }, 100);
          } else if (!senderChat) {
            console.log('📱 MOBILE: No existing 1:1 chat found, will auto-refresh chat list to get new chat');
          }
          
          // Force chat list refresh multiple times for mobile
          const refreshIntervals = [50, 200, 500, 1000];
          refreshIntervals.forEach(delay => {
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: [`/api/chats/${userId}`] });
              queryClient.refetchQueries({ queryKey: [`/api/chats/${userId}`] });
            }, delay);
          });
        }
      }
    };

    console.log('📱 MOBILE: Setting up auto-activation handler');
    socket.on('message', handleIncomingMessage);
    
    return () => {
      console.log('📱 MOBILE: Removing auto-activation handler');
      socket.off('message', handleIncomingMessage);
    };
  }, [socket, userId, chats, selectedChat, queryClient]);

  // Schedule message deletion function
  const scheduleMessageDeletion = useCallback((message: Message) => {
    const deleteTime = new Date(message.expiresAt).getTime();
    const now = Date.now();
    const timeUntilDelete = deleteTime - now;
    
    if (timeUntilDelete > 0) {
      console.log(`⏰ Scheduling message deletion in ${Math.round(timeUntilDelete / 1000)}s`);
      setTimeout(() => {
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== message.id);
          console.log(`🗑️ Message ${message.id} deleted from UI`);
          return filtered;
        });
      }, timeUntilDelete);
    }
  }, []);

  // Send message function
  const sendMessage = useCallback(async (
    content: string,
    type: string = "text",
    destructTimer: number = 86400000, // 24 hours in milliseconds
    receiverId?: number,
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
      console.log("📤 Sending message:", { content: content.substring(0, 20), type, chatId: selectedChatId });

      // Get current user data
      const userData = localStorage.getItem("user");
      if (!userData) throw new Error("User not logged in");
      
      const currentUser = JSON.parse(userData);
      
      // Get receiver's public key from selectedChat (it's already available)
      const receiver = selectedChat.otherUser;
      console.log("📋 Receiver info:", { id: receiver.id, username: receiver.username, hasPublicKey: !!receiver.publicKey });
      
      // Check if we have receiver data
      if (!receiver) {
        throw new Error("Receiver information not available");
      }

      // Encrypt message if we have the receiver's public key
      let encryptedContent = content;
      if (receiver.publicKey && type === "text") {
        try {
          encryptedContent = await encryptMessage(content, receiver.publicKey);
          console.log("🔒 Message encrypted for receiver");
        } catch (error) {
          console.error("Failed to encrypt message:", error);
          throw new Error("Encryption failed - Message cannot be sent unencrypted");
        }
      } else {
        console.log("⚠️ No public key available for receiver - sending unencrypted");
      }

      // Add optimistic message immediately
      const optimisticMessage: Message = {
        id: Date.now(), // Temporary ID
        chatId: selectedChatId,
        senderId: currentUser.id,
        receiverId: selectedChat.otherUser.id,
        content: content, // Show unencrypted content to sender
        messageType: type,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + destructTimer).toISOString(),
      };

      setMessages(prev => [...prev, optimisticMessage]);
      console.log("✅ Optimistic message added");
      
      // Schedule deletion for sender's message too
      scheduleMessageDeletion(optimisticMessage);

      // Send via WebSocket
      const wsMessage = {
        type: 'message',
        chatId: selectedChatId,
        senderId: currentUser.id,
        receiverId: selectedChat.otherUser.id,
        content: encryptedContent,
        messageType: type,
        destructTimer: destructTimer
      };

      if (socket && socket.send(wsMessage)) {
        console.log("📤 Message sent via WebSocket");
      } else {
        throw new Error("WebSocket not available");
      }

    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [selectedChat, selectedChatId, userId, socket, toast]);

  // Select chat function
  const selectChat = useCallback((chat: Chat & { otherUser: User }) => {
    console.log("📂 Selecting chat:", chat.id, "with user:", chat.otherUser.username);
    setSelectedChat(chat);
  }, []);

  return {
    chats,
    messages,
    sendMessage,
    selectChat,
    selectedChat,
    selectedChatId,
    isLoading
  };
}