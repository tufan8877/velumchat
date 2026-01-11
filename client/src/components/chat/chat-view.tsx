import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";
import Message from "./message";
import { Paperclip, Send, Smile, Lock, Clock, MoreVertical, Shield, ArrowLeft } from "lucide-react";
import type { User, Chat, Message as MessageType } from "@shared/schema";

interface ChatViewProps {
  currentUser: User;
  selectedChat: (Chat & { otherUser: User }) | null;
  messages: MessageType[];
  onSendMessage: (content: string, type: string, destructTimerSeconds: number, file?: File) => void;
  onTyping: (isTyping: boolean) => void;
  isOtherTyping: boolean;
  isConnected: boolean;
  onBackToList: () => void;
}

export default function ChatView({
  currentUser,
  selectedChat,
  messages,
  onSendMessage,
  onTyping,
  isOtherTyping,
  isConnected,
  onBackToList,
}: ChatViewProps) {
  const [messageInput, setMessageInput] = useState("");
  const [destructTimer, setDestructTimer] = useState("300"); // seconds

  const localTypingRef = useRef(false);
  const typingIdleTimerRef = useRef<any>(null);
  const typingThrottleRef = useRef<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const scrollToBottom = (smooth = true) => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      [0, 80, 180].forEach((d) => setTimeout(() => scrollToBottom(d !== 0), d));
    }
  }, [messages]);

  useEffect(() => {
    if (selectedChat) setTimeout(() => scrollToBottom(false), 120);
  }, [selectedChat]);

  const getTimerSeconds = () => {
    const s = parseInt(destructTimer, 10);
    return Number.isFinite(s) ? s : 300;
  };

  const sendTypingSafe = (state: boolean) => {
    if (!isConnected) return;
    if (!selectedChat) return;
    try {
      onTyping(state);
    } catch {}
  };

  const stopTyping = () => {
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    if (localTypingRef.current) {
      localTypingRef.current = false;
      sendTypingSafe(false);
    }
  };

  const startOrRefreshTyping = () => {
    const now = Date.now();
    if (!localTypingRef.current || now - typingThrottleRef.current > 2000) {
      localTypingRef.current = true;
      typingThrottleRef.current = now;
      sendTypingSafe(true);
    }
  };

  const handleInputChange = (v: string) => {
    setMessageInput(v);

    if (!selectedChat || !isConnected) return;

    const hasText = v.trim().length > 0;
    if (!hasText) {
      stopTyping();
      return;
    }

    startOrRefreshTyping();

    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    typingIdleTimerRef.current = setTimeout(() => stopTyping(), 1200);
  };

  useEffect(() => {
    stopTyping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.id]);

  const handleSendMessage = () => {
    const text = messageInput.trim();
    if (!text || !selectedChat) return;

    if (!isConnected) {
      alert(t("notConnected"));
      return;
    }

    stopTyping();
    onSendMessage(text, "text", getTimerSeconds());
    setMessageInput("");
    setTimeout(() => scrollToBottom(true), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ✅ Dateien NICHT als Base64 über WS -> File weitergeben, Hook lädt hoch
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedChat || !isConnected) {
      alert(t("selectChatFirst"));
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(t("fileTooLarge"));
      return;
    }

    const secs = getTimerSeconds();

    if (file.type.startsWith("image/")) {
      onSendMessage("", "image", secs, file);
    } else {
      onSendMessage(file.name, "file", secs, file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCameraCapture = () => {
    if (!selectedChat || !isConnected) {
      alert(t("selectChatPhoto"));
      return;
    }
    const cameraInput = document.createElement("input");
    cameraInput.type = "file";
    cameraInput.accept = "image/*";
    // @ts-ignore
    cameraInput.capture = "environment";
    cameraInput.onchange = (ev) => {
      const f = (ev.target as HTMLInputElement).files?.[0];
      if (!f) return;
      handleFileUpload({ target: { files: [f] } } as any);
    };
    cameraInput.click();
  };

  const formatDestructTimer = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 p-8">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{t("welcome")}</h3>
            <p className="text-muted-foreground">{t("selectChatToStart")}</p>
          </div>
        </div>
      </div>
    );
  }

  const headerLetter = (selectedChat.otherUser.username || "U").charAt(0).toUpperCase();

  return (
    <div className="flex-1 flex flex-col h-[100dvh] bg-background chat-shell no-x-scroll">
      {/* Header */}
      <div className="bg-background border-b border-border p-3 md:p-4 flex-shrink-0 chat-header">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToList}
              className="md:hidden w-10 h-10 rounded-full flex-shrink-0 touch-target"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            {/* ✅ Avatar wieder als Buchstabe */}
            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0 avatar-mobile">
              <span className="text-muted-foreground font-semibold">{headerLetter}</span>
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{selectedChat.otherUser.username}</h3>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                <span className={isConnected ? "text-green-400" : "text-red-400"}>
                  {isConnected ? t("connected") : t("disconnected")}
                </span>
                <span className="text-muted-foreground">•</span>
                <Lock className="w-3 h-3 text-accent flex-shrink-0" />
                <span className="text-muted-foreground truncate">{t("realTimeChat")}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-2 py-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Select value={destructTimer} onValueChange={setDestructTimer}>
                <SelectTrigger className="border-0 bg-transparent text-foreground text-sm h-auto p-0 min-w-[62px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 sec</SelectItem>
                  <SelectItem value="30">30 sec</SelectItem>
                  <SelectItem value="60">1 min</SelectItem>
                  <SelectItem value="300">5 min</SelectItem>
                  <SelectItem value="1800">30 min</SelectItem>
                  <SelectItem value="3600">1 hour</SelectItem>
                  <SelectItem value="21600">6 hours</SelectItem>
                  <SelectItem value="86400">1 day</SelectItem>
                  <SelectItem value="604800">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full touch-target" aria-label="Menu">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="chat-messages custom-scrollbar px-3 md:px-4 py-3 space-y-3"
        style={{ paddingBottom: "calc(92px + env(safe-area-inset-bottom))" }}
      >
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-surface rounded-full px-4 py-2 text-sm text-text-muted">
            <Shield className="w-4 h-4 text-accent" />
            <span>This conversation is end-to-end encrypted</span>
          </div>
        </div>

        {messages.map((m) => (
          <Message key={m.id} message={m} isOwn={m.senderId === currentUser.id} otherUser={selectedChat.otherUser} />
        ))}

        {/* Typing bubble bleibt wie gehabt */}
        {isOtherTyping && (
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-muted-foreground text-sm font-semibold">{headerLetter}</span>
            </div>
            <div className="bg-surface rounded-2xl rounded-tl-md p-3">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" style={{ animationDelay: "0.1s" }} />
                <div className="typing-dot" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-fixed chat-input-area">
        <div className="px-2 py-2 flex items-end gap-2 flex-nowrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 rounded-full flex-shrink-0 touch-target"
            title="Upload"
          >
            <Paperclip className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCameraCapture}
            className="w-11 h-11 rounded-full flex-shrink-0 touch-target"
            title="Camera"
          >
            📷
          </Button>

          <div className="flex-1 min-w-0 relative">
            <Textarea
              placeholder={isConnected ? t("typeMessage") : t("connecting")}
              value={messageInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="chat-textarea resize-none pr-10"
              rows={1}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 bottom-1.5 w-9 h-9 rounded-full hidden md:flex"
              aria-label="Emoji"
            >
              <Smile className="w-4 h-4" />
            </Button>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !isConnected}
            className="w-11 h-11 rounded-full flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:opacity-50 text-white touch-target"
            aria-label="Send"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-3 pb-[calc(10px+env(safe-area-inset-bottom))] text-xs text-text-muted flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Lock className="w-3 h-3 text-accent flex-shrink-0" />
            <span className="truncate">{t("encryptionEnabled")}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="opacity-80">⏱️</span>
            <span className="text-destructive">{formatDestructTimer(getTimerSeconds())}</span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
      </div>
    </div>
  );
}
