import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LanguageSelector } from "@/components/ui/language-selector";

import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { X, KeyRound, Key } from "lucide-react";
import type { User } from "@shared/schema";

interface SettingsModalProps {
  currentUser: User & { privateKey: string };
  onClose: () => void;
  onUpdateUser: (user: User & { privateKey: string }) => void;
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.token || u?.accessToken || localStorage.getItem("token") || null;
  } catch {
    return localStorage.getItem("token");
  }
}

export default function SettingsModal({ currentUser, onClose, onUpdateUser }: SettingsModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [username, setUsername] = useState(currentUser.username);
  const [defaultTimer, setDefaultTimer] = useState("86400");
  const [screenLock, setScreenLock] = useState(true);
  const [incognitoKeyboard, setIncognitoKeyboard] = useState(true);
  const [readReceipts, setReadReceipts] = useState(false);
  const [typingIndicators, setTypingIndicators] = useState(true);

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      toast({ title: t("error"), description: t("usernameEmpty"), variant: "destructive" });
      return;
    }

    const token = getToken();
    if (!token) {
      toast({ title: t("error"), description: "Missing token. Please login again.", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "Failed to update username");
      }

      const updatedUser = { ...currentUser, username: username.trim() };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      onUpdateUser(updatedUser);

      toast({ title: t("success"), description: t("usernameUpdated") });
      onClose();
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error?.message || t("profileSaveError"),
        variant: "destructive",
      });
    }
  };

  const formatTimerOption = (seconds: string) => {
    const num = parseInt(seconds, 10);
    if (num < 60) return `${num} second${num > 1 ? "s" : ""}`;
    if (num < 3600) return `${num / 60} minute${num / 60 > 1 ? "s" : ""}`;
    if (num < 86400) return `${num / 3600} hour${num / 3600 > 1 ? "s" : ""}`;
    return `${num / 86400} day${num / 86400 > 1 ? "s" : ""}`;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="bg-surface border-border w-[calc(100vw-24px)] sm:max-w-2xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6"
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-2xl font-bold text-text-primary">{t("settingsTitle")}</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t("profile")}</h3>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <KeyRound className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-medium text-text-primary mb-2">{t("username")}</label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t("newUsername")}
                      className="!bg-surface !text-text-primary !border-border"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveProfile} className="w-full">
                {t("saveProfile")}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t("language")}</h3>
            <div className="flex justify-start">
              <LanguageSelector />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t("security")}</h3>

            <div className="space-y-4">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium text-text-primary">{t("defaultTimer")}</h4>
                  <p className="text-sm text-text-muted break-words whitespace-normal">{t("autoDestructTime")}</p>
                </div>

                <Select value={defaultTimer} onValueChange={setDefaultTimer}>
                  <SelectTrigger className="w-40 sm:w-44 bg-surface border-border text-text-primary flex-shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{formatTimerOption("1")}</SelectItem>
                    <SelectItem value="10">{formatTimerOption("10")}</SelectItem>
                    <SelectItem value="60">{formatTimerOption("60")}</SelectItem>
                    <SelectItem value="3600">{formatTimerOption("3600")}</SelectItem>
                    <SelectItem value="86400">{formatTimerOption("86400")}</SelectItem>
                    <SelectItem value="518400">{formatTimerOption("518400")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium text-text-primary">{t("screenLock")}</h4>
                  <p className="text-sm text-text-muted break-words whitespace-normal">{t("screenLockDesc")}</p>
                </div>
                <Switch checked={screenLock} onCheckedChange={setScreenLock} className="flex-shrink-0" />
              </div>

              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium text-text-primary">{t("incognitoKeyboard")}</h4>
                  <p className="text-sm text-text-muted break-words whitespace-normal">{t("incognitoKeyboardDesc")}</p>
                </div>
                <Switch checked={incognitoKeyboard} onCheckedChange={setIncognitoKeyboard} className="flex-shrink-0" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t("privacy")}</h3>

            <div className="space-y-4">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium text-text-primary">{t("readReceipts")}</h4>
                  <p className="text-sm text-text-muted break-words whitespace-normal">{t("readReceiptsDesc")}</p>
                </div>
                <Switch checked={readReceipts} onCheckedChange={setReadReceipts} className="flex-shrink-0" />
              </div>

              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-medium text-text-primary">{t("typingIndicators")}</h4>
                  <p className="text-sm text-text-muted break-words whitespace-normal">{t("typingIndicatorsDesc")}</p>
                </div>
                <Switch checked={typingIndicators} onCheckedChange={setTypingIndicators} className="flex-shrink-0" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">{t("about")}</h3>

            <Button variant="outline" className="w-full bg-bg-dark border-border hover:bg-muted/50 text-left h-auto p-4">
              <div className="w-full flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-text-primary">{t("exportKeys")}</h4>
                  <p className="text-sm text-text-muted break-words whitespace-normal">{t("exportKeysDesc")}</p>
                </div>
                <div className="self-end sm:self-auto flex-shrink-0">
                  <Key className="w-5 h-5 text-text-muted" />
                </div>
              </div>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
