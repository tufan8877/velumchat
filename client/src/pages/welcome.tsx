import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { generateKeyPair } from "@/lib/crypto";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { LanguageSelector } from "@/components/ui/language-selector";
import { profileProtection } from "@/lib/profile-protection";
import { SessionPersistence } from "@/lib/session-persistence";
import { EyeOff, Shield, Clock, Database, LogIn, UserPlus } from "lucide-react";

// ✅ Case-sensitive auf Render:
import logoPath from "@assets/VelumChat_Logo.PNG";

type ApiOk<T> = { ok: true; token: string; user: T };
type ApiErr = { ok: false; message: string; errors?: any };

function isObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

async function postJson<T>(path: string, data: any, timeoutMs = 15000): Promise<T> {
  const url = path.startsWith("/") ? path : `/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") throw new Error("Timeout: Server antwortet nicht (15s).");
    throw new Error(e?.message || "Network error (fetch failed)");
  }

  clearTimeout(timer);

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      (text && text.slice(0, 300)) ||
      res.statusText ||
      "Request failed";
    throw new Error(`${res.status}: ${msg}`);
  }

  if (json === null) {
    throw new Error(
      `Server returned non-JSON (ok=${res.ok}). Wahrscheinlich landet /api/* im Frontend. Body: ${text.slice(0, 200)}`
    );
  }

  return json as T;
}

export default function WelcomePage() {
  const [, setLocation] = useLocation();

  const [username, setUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const inFlight = useRef(false);

  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    SessionPersistence.getInstance().initialize();
  }, []);

  function showNiceError(title: string, err: any) {
    const msg =
      typeof err?.message === "string" && err.message.trim().length > 0
        ? err.message
        : "Unbekannter Fehler. Bitte neu laden.";

    toast({ title, description: msg, variant: "destructive" });
    console.error("❌ AUTH ERROR:", err);
  }

  const handleLogin = async (e?: any) => {
    e?.preventDefault?.();

    if (inFlight.current) return;
    inFlight.current = true;

    const u = loginUsername.trim();

    if (!u || !loginPassword.trim()) {
      toast({
        title: t("error"),
        description: t("enterCredentials"),
        variant: "destructive",
      });
      inFlight.current = false;
      return;
    }

    setIsLoading(true);
    try {
      const data = await postJson<ApiOk<{ id: number; username: string; publicKey: string }> | ApiErr>("/api/login", {
        username: u,
        password: loginPassword,
      });

      if (!isObject(data) || (data as any).ok !== true) {
        throw new Error((data as any)?.message || t("loginFailed"));
      }

      const existing = localStorage.getItem("user");
      let privateKey = "";

      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          if (parsed?.username === u) privateKey = parsed.privateKey || "";
        } catch {}
      }

      if (!privateKey) {
        const kp = await generateKeyPair();
        privateKey = kp.privateKey;
      }

      const token = (data as any).token;
      const userProfile = { ...(data as any).user, privateKey, token };

      profileProtection.storeProfile(userProfile);
      localStorage.setItem("user", JSON.stringify(userProfile));

      toast({ title: t("welcomeBack"), description: t("loginSuccess") });
      setLocation("/chat");
    } catch (err: any) {
      showNiceError(t("error"), err);
    } finally {
      setIsLoading(false);
      inFlight.current = false;
    }
  };

  const handleStartChatting = async (e?: any) => {
    e?.preventDefault?.();

    if (inFlight.current) return;
    inFlight.current = true;

    const finalUsername = username.trim();

    if (registerPassword.trim().length < 6) {
      toast({
        title: t("passwordTooShort"),
        description: t("passwordMinLength"),
        variant: "destructive",
      });
      inFlight.current = false;
      return;
    }

    if (finalUsername.length < 3) {
      toast({
        title: t("usernameTooShort"),
        description: t("usernameMinLength"),
        variant: "destructive",
      });
      inFlight.current = false;
      return;
    }

    setIsLoading(true);
    try {
      const { publicKey, privateKey } = await generateKeyPair();

      const data = await postJson<ApiOk<{ id: number; username: string; publicKey: string }> | ApiErr>(
        "/api/register",
        {
          username: finalUsername,
          password: registerPassword,
          publicKey,
        }
      );

      if (!isObject(data) || (data as any).ok !== true) {
        throw new Error((data as any)?.message || t("registrationFailed"));
      }

      const token = (data as any).token;
      const userProfile = { ...(data as any).user, privateKey, token };

      profileProtection.storeProfile(userProfile);
      localStorage.setItem("user", JSON.stringify(userProfile));

      toast({ title: t("welcomeToWhispergram"), description: t("accountCreated") });
      setLocation("/chat");
    } catch (err: any) {
      showNiceError(t("registrationFailed"), err);
    } finally {
      setIsLoading(false);
      inFlight.current = false;
    }
  };

  return (
    // ✅ weniger vertikaler padding -> alles rauf
    <div className="min-h-screen flex items-start justify-center px-3 py-2 sm:px-4 sm:py-6">
      {/* ✅ weniger space-y -> kompakter */}
      <div className="max-w-6xl w-full space-y-4 sm:space-y-6">
        <div className="text-center">
          {/* ✅ Logo bleibt groß, aber weniger margin-bottom */}
          <div className="mx-auto mb-2 sm:mb-4 flex items-center justify-center">
            <img
              src={logoPath}
              alt="VelumChat Logo"
              className="
                block
                w-[240px] h-[240px]
                sm:w-[220px] sm:h-[220px]
                md:w-[260px] md:h-[260px]
                object-contain
              "
            />
          </div>

          {/* ✅ weniger Abstand nach unten */}
          <p className="text-text-muted text-base sm:text-lg px-2 -mt-1">
            {t("welcomeDescription")}
          </p>
        </div>

        {/* ✅ Language Selector weniger Abstand */}
        <div className="flex justify-center -mt-1 mb-2 sm:mb-4">
          <div className="bg-surface/80 border border-border rounded-xl p-2 sm:p-3 shadow-lg backdrop-blur-sm">
            <LanguageSelector />
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="bg-surface border-border">
            <CardContent className="p-4 sm:p-6">
              <Tabs defaultValue="register" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 bg-background">
                  <TabsTrigger value="register" className="flex items-center space-x-2">
                    <UserPlus className="w-4 h-4" />
                    <span>{t("createAccount")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="login" className="flex items-center space-x-2">
                    <LogIn className="w-4 h-4" />
                    <span>{t("login")}</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="register" className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">{t("createAccount")}</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder={t("enterUsername")}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-gray-800 border-border text-white placeholder:text-gray-400"
                    />
                    <Input
                      type="password"
                      placeholder={t("enterPassword")}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="bg-gray-800 border-border text-white placeholder:text-gray-400"
                    />
                    <p className="text-sm text-muted-foreground">{t("chooseUsernameHint")}</p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleStartChatting}
                    disabled={isLoading || !registerPassword || !username.trim()}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3"
                  >
                    {isLoading ? t("createAccount") + "..." : t("createAccount")}
                  </Button>
                </TabsContent>

                <TabsContent value="login" className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">{t("login")}</h3>
                  <div className="space-y-3">
                    <Input
                      placeholder={t("enterUsername")}
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="bg-gray-800 border-border text-white placeholder:text-gray-400"
                    />
                    <Input
                      type="password"
                      placeholder={t("enterPassword")}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="bg-gray-800 border-border text-white placeholder:text-gray-400"
                    />
                    <p className="text-sm text-muted-foreground">{t("enterCredentials")}</p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleLogin}
                    disabled={isLoading || !loginUsername.trim() || !loginPassword.trim()}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3"
                  >
                    {isLoading ? t("login") + "..." : t("login")}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* ✅ Features weniger Top-Margin, damit unten mehr sichtbar ist */}
        <div className="mt-6 mb-4">
          <h3 className="text-2xl font-bold text-foreground mb-6 text-center">{t("features")}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto">
            <Card className="bg-surface/50 border-border hover:bg-surface/70 transition-colors">
              <CardContent className="p-4 sm:p-6 text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">{t("endToEndEncryption")}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">{t("encryptionEnabled")}</p>
              </CardContent>
            </Card>

            <Card className="bg-surface/50 border-border hover:bg-surface/70 transition-colors">
              <CardContent className="p-4 sm:p-6 text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <EyeOff className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">{t("anonymousAccess")}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">{t("noPhoneRequired")}</p>
              </CardContent>
            </Card>

            <Card className="bg-surface/50 border-border hover:bg-surface/70 transition-colors">
              <CardContent className="p-4 sm:p-6 text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">{t("autoDestruct")}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">{t("selfDestructing")}</p>
              </CardContent>
            </Card>

            <Card className="bg-surface/50 border-border hover:bg-surface/70 transition-colors">
              <CardContent className="p-4 sm:p-6 text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Database className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground mb-2">{t("zeroStorage")}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">{t("zeroDataRetention")}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer kompakter */}
        <div className="text-center space-y-3 pt-4 border-t border-border/50">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("messagesNotStored")}</p>
            <p className="text-sm text-muted-foreground">{t("openSourceAudited")}</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-6">
            <button
              onClick={() => setLocation("/faq")}
              className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              {t("frequentlyAskedQuestions")}
            </button>
            <div className="hidden sm:block w-1 h-1 bg-muted-foreground rounded-full"></div>
            <button
              onClick={() => setLocation("/imprint")}
              className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              {t("imprint")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}