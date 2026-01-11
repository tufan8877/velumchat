import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/lib/i18n";
import { Settings, Plus, Search, KeyRound, Shield, Clock, LogOut } from "lucide-react";
import type { User, Chat } from "@shared/schema";
import logoPath from "@assets/whispergram Logo_1752171096580.jpg";
import ChatContextMenu from "./chat-context-menu";

interface SidebarProps {
  currentUser: User;
  chats: Array<Chat & { otherUser: User; lastMessage?: any }>;
  selectedChat: Chat & { otherUser: User } | null;
  onSelectChat: (chat: Chat & { otherUser: User }) => void;
  onOpenSettings: () => void;
  isConnected: boolean;
  isLoading: boolean;
  isPersistentMode?: boolean; // New prop for persistent chat mode
  unreadCounts?: Map<number, number>; // WhatsApp-style unread message counts
  onRefreshChats?: () => void; // Callback to refresh chat list
}

export default function Sidebar({
  currentUser,
  chats,
  selectedChat,
  onSelectChat,
  onOpenSettings,
  isConnected,
  isLoading,
  unreadCounts = new Map(),
  onRefreshChats,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const { data: searchResults } = useQuery({
    queryKey: ["search-users", searchQuery, currentUser.id],
    enabled: searchQuery.length > 2,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/search-users?q=${encodeURIComponent(searchQuery)}&excludeId=${currentUser.id}`);
      return response.json();
    },
  });

  const handleStartChat = async (user: User) => {
    try {
      console.log("🚀 Starting SEPARATE 1:1 chat with user:", user.username, "ID:", user.id);
      console.log("🔍 Current user ID:", currentUser.id);
      
      // First check if chat already exists between these specific users
      const existingChat = chats.find(chat => 
        chat.otherUser.id === user.id
      );
      
      if (existingChat) {
        console.log('💬 Found existing 1:1 chat:', existingChat.id, 'between', currentUser.id, 'and', user.id);
        onSelectChat(existingChat);
        setShowNewChatDialog(false);
        setSearchQuery("");
        return;
      }
      
      // Create new SEPARATED chat for these specific users  
      console.log('💬 Creating NEW 1:1 chat between users:', currentUser.id, 'and', user.id);
      const response = await apiRequest("POST", "/api/chats", {
        participant1Id: currentUser.id,
        participant2Id: user.id,
      });
      const chat = await response.json();
      console.log("✅ NEW 1:1 chat created with ID:", chat.id, 'for users', currentUser.id, 'and', user.id);
      
      const chatWithUser = { ...chat, otherUser: user };
      onSelectChat(chatWithUser);
      setShowNewChatDialog(false);
      setSearchQuery("");
      
      console.log("✅ 1:1 Chat selected:", chatWithUser.id);
    } catch (error) {
      console.error("❌ Failed to start 1:1 chat:", error);
    }
  };

  const handleLogout = () => {
    // WICKR-ME-STYLE: Never delete user data, preserve profile permanently
    console.log("🚫 WICKR-ME-LOGOUT: Preserving user profile, only ending session");
    setLocation("/");
  };

  const formatLastMessageTime = (date: string | Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return messageDate.toLocaleDateString();
  };

  return (
    <>
      <div className="w-full md:w-80 bg-surface border-r md:border-r border-b md:border-b-0 border-border flex flex-col h-48 md:h-screen flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center overflow-hidden">
                <img 
                  src="/attached_assets/whispergram Logo_1752171096580.jpg" 
                  alt="Whispergram Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="font-semibold text-text-primary">{currentUser.username}</h2>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent' : 'bg-destructive'}`} />
                  <span className="text-xs text-accent">{isConnected ? t('online') : 'Connecting...'}</span>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSettings}
                className="text-muted-foreground hover:text-foreground"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewChatDialog(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-muted z-10 pointer-events-none" />
            <Input
              placeholder={t('searchUsers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-3 bg-gray-800 border-border text-white placeholder:text-gray-400 h-12 text-sm"
              style={{ textIndent: '8px' }}
            />
          </div>
        </div>

        {/* Active Chats */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-text-muted text-sm">Loading...</p>
            </div>
          ) : !chats || chats.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-text-muted text-sm">No chats yet</p>
              <p className="text-text-muted text-xs mt-1">{t('startChat')}</p>
            </div>
          ) : (
            (chats || []).map((chat) => (
              <div
                key={chat.id}
                className={`chat-item ${selectedChat?.id === chat.id ? 'bg-muted/50' : ''}`}
                onClick={() => onSelectChat(chat)}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                      <KeyRound className="w-5 h-5 text-muted-foreground" />
                    </div>
                    {chat.otherUser.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-surface" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-text-primary truncate">
                        {chat.otherUser.username}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {chat.lastMessage && (
                          <span className="text-xs text-text-muted">
                            {formatLastMessageTime(chat.lastMessage.createdAt)}
                          </span>
                        )}
                        <ChatContextMenu
                          currentUser={currentUser}
                          chat={chat}
                          onChatDeleted={() => {
                            // Refresh the chat list after deletion
                            if (onRefreshChats) {
                              onRefreshChats();
                            }
                            // If this was the selected chat, clear selection
                            if (selectedChat?.id === chat.id) {
                              // Reset selection by passing null
                              const nullChat = null as any;
                              onSelectChat(nullChat);
                            }
                          }}
                          onUserBlocked={() => {
                            // Refresh the chat list after blocking
                            if (onRefreshChats) {
                              onRefreshChats();
                            }
                            // If this was the selected chat, clear selection
                            if (selectedChat?.id === chat.id) {
                              const nullChat = null as any;
                              onSelectChat(nullChat);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-text-muted truncate">
                        {chat.lastMessage ? (
                          chat.lastMessage.messageType === "text" ? (
                            chat.lastMessage.content
                          ) : chat.lastMessage.messageType === "image" ? (
                            <span className="flex items-center">
                              <span>📷 Photo</span>
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <span>📎 File</span>
                            </span>
                          )
                        ) : (
                          "Start a conversation..."
                        )}
                      </p>
                      <div className="flex items-center space-x-2">
                        {/* WhatsApp-style unread message count */}
                        {unreadCounts.has(chat.id) && unreadCounts.get(chat.id)! > 0 && (
                          <Badge 
                            variant="default" 
                            className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium"
                          >
                            {unreadCounts.get(chat.id)}
                          </Badge>
                        )}
                        {chat.lastMessage && (
                          <Clock className="w-3 h-3 text-text-muted" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Connection Status */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-2 text-sm">
            <Shield className="w-4 h-4 text-accent" />
            <span className="text-text-muted">Encrypted • </span>
            <span className={isConnected ? "text-accent" : "text-destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* New Chat Dialog */}
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent className="bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Start New Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search users by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-800 border-border text-white placeholder:text-gray-400"
            />
            {searchResults && searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((user: User) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-bg-dark hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleStartChat(user)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <KeyRound className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.username}</p>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-accent' : 'bg-muted-foreground'}`} />
                          <span className="text-xs text-muted-foreground">
                            {user.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Chat
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length > 2 && (!searchResults || searchResults.length === 0) && (
              <p className="text-muted-foreground text-sm text-center py-4">
                No users found with that username
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
