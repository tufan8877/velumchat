import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import WhatsAppSidebar from "@/components/chat/whatsapp-sidebar";
import ChatView from "@/components/chat/chat-view";
import SettingsModal from "@/components/chat/settings-modal";
import { Toaster } from "@/components/ui/toaster";
import { useWebSocketReliable } from "@/hooks/use-websocket-reliable";
import { usePersistentChats } from "@/hooks/use-persistent-chats";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export default function ChatPage() {
  const [, setLocation] = useLocation();
  const [showSettings, setShowSettings] = useState(false);

  const [currentUser, setCurrentUser] = useState<(User & { privateKey: string }) | null>(null);

  useEffect(() => {
    const initializeUser = async () => {
      let userData = localStorage.getItem("user");

      if (!userData) {
        console.log("🔍 WICKR-ME-RECOVERY: Searching for profile in backup locations...");
        const { profileProtection } = await import("@/lib/profile-protection");
        const recovered = profileProtection.retrieveProfile();
        if (recovered) {
          setCurrentUser(recovered);
          console.log("✅ Profile recovered from backup storage:", recovered.username);
          return;
        }
        console.log("⚠️ No user profile found, redirecting to login");
        setLocation("/");
        return;
      }

      try {
        const user = JSON.parse(userData);
        console.log("👤 Loaded user from localStorage:", user.username, "ID:", user.id);
        setCurrentUser(user);
      } catch (error) {
        console.error("Failed to parse user data:", error);
        setLocation("/");
      }
    };

    initializeUser();
  }, [setLocation]);

  const socket = useWebSocketReliable(currentUser?.id);

  const {
    persistentContacts: chats,
    messages,
    sendMessage,
    selectChat,
    isLoading,
    selectedChat,
    loadPersistentContacts,
    unreadCounts,
    deleteChat, // ✅ NEW
  } = usePersistentChats(currentUser?.id, socket);

  useEffect(() => {
    console.log("Chat status:", {
      user: currentUser?.username,
      connected: socket?.isConnected,
    });
  }, [currentUser, socket]);

  // ✅ destructTimer in SEKUNDEN
  const handleSendMessage = (content: string, type: string, destructTimer: number, file?: File) => {
    if (!currentUser?.id) {
      setLocation("/");
      return;
    }
    if (!selectedChat?.otherUser?.id) return;

    const destructTimerSec = Math.max(Number(destructTimer) || 0, 5);
    sendMessage(content, type, destructTimerSec, file);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center overflow-x-hidden">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-muted">Loading your secure session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col md:flex-row bg-background chat-container">
      <div className={`${selectedChat ? "hidden md:flex" : "flex"} md:flex w-full md:w-[380px] min-w-0 max-w-full overflow-x-hidden`}>
        <WhatsAppSidebar
          currentUser={currentUser}
          chats={chats as any}
          selectedChat={selectedChat}
          onSelectChat={(chat: any) => selectChat(chat)}
          onOpenSettings={() => setShowSettings(true)}
          isConnected={socket?.isConnected || false}
          isLoading={isLoading}
          unreadCounts={unreadCounts}
          onRefreshChats={() => loadPersistentContacts()}
          onDeleteChat={async (chatId) => {
            await deleteChat(chatId); // ✅ Cutoff delete
          }}
        />
      </div>

      <div className={`${selectedChat ? "flex" : "hidden md:flex"} flex-1 min-w-0 w-full max-w-full overflow-x-hidden chat-safe`}>
        <ChatView
          currentUser={currentUser}
          selectedChat={selectedChat}
          messages={messages}
          onSendMessage={handleSendMessage}
          isConnected={socket?.isConnected || false}
          onBackToList={() => selectChat(null as any)}
        />
      </div>

      {showSettings && currentUser && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setShowSettings(false)}
          onUpdateUser={(user) => {
            localStorage.setItem("user", JSON.stringify(user));
          }}
        />
      )}

      <Toaster />
    </div>
  );
}
