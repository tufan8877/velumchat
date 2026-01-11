import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { Search, Users } from "lucide-react";
import type { User, Chat } from "@shared/schema";

type NewChatModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  onChatCreated: (chat: Chat & { otherUser: User }) => void;
  onRefreshChats?: () => void;
};

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

export default function NewChatModal({
  open,
  onOpenChange,
  currentUser,
  onChatCreated,
  onRefreshChats,
}: NewChatModalProps) {
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [creating, setCreating] = useState<number | null>(null);

  const canSearch = useMemo(() => searchQuery.trim().length > 0, [searchQuery]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      setSearchLoading(false);
      setCreating(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!canSearch) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const q = searchQuery.trim();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-users?q=${encodeURIComponent(q)}`, {
          method: "GET",
          headers: authHeaders(),
          credentials: "include",
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error("❌ search-users failed:", res.status, txt);
          setSearchResults([]);
          return;
        }

        const users = await res.json();
        const filtered = Array.isArray(users)
          ? users.filter((u: any) => u?.id !== currentUser.id)
          : [];

        setSearchResults(filtered);
      } catch (err) {
        console.error("❌ Search error:", err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, canSearch, open, currentUser.id]);

  const handleStartChat = async (user: User) => {
    try {
      setCreating(user.id);

      const res = await fetch("/api/chats", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          participant1Id: currentUser.id,
          participant2Id: user.id,
        }),
      });

      const txt = await res.text();
      let json: any = null;
      try {
        json = txt ? JSON.parse(txt) : null;
      } catch {}

      if (!res.ok) {
        console.error("❌ create chat failed:", res.status, txt);
        alert(t("chatCreateError"));
        return;
      }

      const chatObj = json?.chat || json;
      if (!chatObj?.id) {
        console.error("❌ invalid chat response:", json);
        alert(t("chatCreateError"));
        return;
      }

      const chatWithUser = { ...chatObj, otherUser: user };

      onOpenChange(false);
      onRefreshChats?.();
      onChatCreated(chatWithUser);
    } catch (err) {
      console.error("❌ Start chat error:", err);
      alert(t("connectionError"));
    } finally {
      setCreating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t("newChat")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
            <Input
              placeholder={t("searchUsers")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-3 bg-white dark:bg-gray-800 text-black dark:text-white placeholder:text-gray-500 h-12 text-sm"
              style={{ textIndent: "8px" }}
              autoFocus
            />
          </div>

          {searchLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleStartChat(user)}
                  className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  disabled={creating !== null}
                >
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-primary font-medium">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1">
                    <p className="font-medium text-foreground">{user.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("tapToStartChat") ?? "Tippen um Chat zu starten"}
                    </p>
                  </div>

                  <div>
                    <Button size="sm" className="gap-2" disabled={creating !== null}>
                      {creating === user.id ? (t("loading") ?? "Lädt...") : (t("start") ?? "Start")}
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          ) : canSearch ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {t("noUsersFound") ?? "Keine Benutzer gefunden"}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {t("typeToSearch") ?? "Tippe um zu suchen"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
