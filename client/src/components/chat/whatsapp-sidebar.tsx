import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Settings,
  LogOut,
  MessageCircle,
  KeyRound,
  MoreVertical,
  Trash2,
  UserX,
} from "lucide-react";
import type { User, Chat } from "@shared/schema";
import NewChatModal from "@/components/chat/new-chat-modal";

interface WhatsAppSidebarProps {
  currentUser: User;
  chats: Array<Chat & { otherUser: User; lastMessage?: any; unreadCount?: number }>;
  selectedChat: (Chat & { otherUser: User }) | null;
  onSelectChat: (chat: Chat & { otherUser: User }) => void;
  onOpenSettings: () => void;
  isConnected: boolean;
  isLoading: boolean;
  unreadCounts?: Map<number, number>;
  onRefreshChats?: () => void;
  typingByChat?: Map<number, boolean>;
  onDeleteChat: (chatId: number) => Promise<void> | void;
  onBlockUser?: (userId: number) => Promise<void> | void;
}

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.token || u?.accessToken || localStorage.getItem("token") || null;
  } catch {
    return localStorage.getItem("token");
  }
}

function authHeaders(extra?: Record<string, string>) {
  const token = getAuthToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

function toBool(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1 || v === "1") return true;
  if (v === 0 || v === "0") return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return false;
}

export default function WhatsAppSidebar({
  currentUser,
  chats,
  selectedChat,
  onSelectChat,
  onOpenSettings,
  isConnected,
  isLoading,
  unreadCounts = new Map(),
  typingByChat = new Map(),
  onRefreshChats,
  onDeleteChat,
  onBlockUser,
}: WhatsAppSidebarProps) {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);

  const handleLogout = () => {
    window.location.href = "/";
  };

  const handleMarkRead = async (chatId: number) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/mark-read`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      onRefreshChats?.();
    } catch {}
  };

  const handleBlockUser = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/block`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      onBlockUser?.(userId);
      onRefreshChats?.();
    } catch {}
  };

  const formatLastMessageTime = (date: string | Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("now");
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return messageDate.toLocaleDateString();
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    return chat.otherUser.username.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  return (
    <>
      <div className="w-full md:w-80 bg-background border-r border-border flex flex-col h-full md:h-screen">
        <div className="p-4 bg-primary/5 dark:bg-primary/10 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary/30 to-primary/50 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">
                  {currentUser.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-lg">{currentUser.username}</h2>
                <div className="flex items-center space-x-2">
                  <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} />
                  <span className="text-xs text-muted-foreground font-medium">
                    {isConnected ? t("online") : t("connecting")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex space-x-1">
              <Button variant="ghost" size="sm" onClick={() => setShowNewChatDialog(true)}>
                <Plus className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                <Settings className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="p-3 bg-background">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
            <Input
              placeholder={t("searchChats")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-3 bg-muted/30 border-border focus:bg-background text-foreground placeholder:text-muted-foreground h-12 text-sm indent-2"
              style={{ textIndent: "8px" }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
              <p className="text-muted-foreground">{t("loadingChats")}</p>
            </div>
          ) : (
            <div>
              {filteredChats.map((chat) => {
                const apiUnreadCount = chat.unreadCount || 0;
                const mapUnreadCount = unreadCounts?.get(chat.id) || 0;
                const finalUnreadCount = Math.max(apiUnreadCount, mapUnreadCount);
                const badgeText = finalUnreadCount > 9 ? "9+" : String(finalUnreadCount);

                const isTyping = Boolean(typingByChat?.get(chat.id));
                const timeText = chat.lastMessage ? formatLastMessageTime(chat.lastMessage.createdAt) : "";

                const isOnline = toBool((chat as any)?.otherUser?.isOnline);

                return (
                  <div
                    key={chat.id}
                    className={cn(
                      "relative px-4 py-4 cursor-pointer transition-all duration-200 border-l-4 border-transparent hover:bg-muted/30 group",
                      selectedChat?.id === chat.id && "bg-primary/5 border-l-primary"
                    )}
                    onClick={async () => {
                      await handleMarkRead(chat.id);
                      onSelectChat(chat);
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-14 h-14 bg-gradient-to-br from-primary/20 via-primary/30 to-primary/40 rounded-full flex items-center justify-center shadow-sm">
                          <span className="text-primary font-bold text-xl">
                            {chat.otherUser.username.charAt(0).toUpperCase()}
                          </span>
                        </div>

                        {/* ✅ EINZIGER Presence-Punkt: gruen/grau */}
                        <div
                          className={cn(
                            "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background shadow-sm",
                            isOnline ? "bg-green-500" : "bg-muted-foreground/60"
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-semibold text-base text-foreground truncate">
                            {chat.otherUser.username}
                          </h3>

                          <div className="flex flex-col items-end flex-shrink-0">
                            {!isTyping && timeText ? (
                              <span className="text-xs text-muted-foreground font-medium">{timeText}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground font-medium opacity-0">--</span>
                            )}

                            {finalUnreadCount > 0 ? (
                              <div className="mt-1 min-w-[18px] h-[18px] px-1 rounded-full bg-green-500 text-white text-[11px] font-semibold flex items-center justify-center shadow-sm">
                                {badgeText}
                              </div>
                            ) : (
                              <div className="mt-1 h-[18px] opacity-0">0</div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          {isTyping ? (
                            <div className="flex items-center text-sm truncate flex-1">
                              <div className="typing-indicator scale-75 origin-left">
                                <div className="typing-dot" />
                                <div className="typing-dot" style={{ animationDelay: "0.1s" }} />
                                <div className="typing-dot" style={{ animationDelay: "0.2s" }} />
                              </div>
                            </div>
                          ) : chat.lastMessage ? (
                            <p className="text-sm text-muted-foreground truncate flex-1">{chat.lastMessage.content}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground/70 italic flex items-center gap-1">
                              <KeyRound className="w-3 h-3" />
                              {t("encryptedChat")}
                            </p>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-70 hover:opacity-100 transition-opacity h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation();
                              await onDeleteChat(chat.id);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t("deleteChat")}
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBlockUser(chat.otherUser.id);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <UserX className="w-4 h-4 mr-2" />
                            {t("blockUser", { username: chat.otherUser.username })}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <NewChatModal
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        currentUser={currentUser}
        onRefreshChats={onRefreshChats}
        onChatCreated={(chatWithUser) => onSelectChat(chatWithUser)}
      />
    </>
  );
}
