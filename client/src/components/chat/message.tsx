import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@shared/schema";

function toMs(v: any): number {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export default function Message({
  message,
  isOwn,
  otherUser,
}: {
  message: any;
  isOwn: boolean;
  otherUser: User;
}) {
  const type = message?.messageType || "text";
  const raw = String(message?.content || "");

  // ✅ URL normalisieren (uploads/http/blob/data)
  const src =
    raw.startsWith("http") || raw.startsWith("blob:") || raw.startsWith("data:")
      ? raw
      : raw.startsWith("/")
      ? new URL(raw, window.location.origin).toString()
      : raw;

  // ✅ Sichtbare Bubbles:
  // - own: blau
  // - other: leichtes Grau (damit es immer sichtbar ist)
  const bubbleBase = isOwn
    ? "bg-blue-600 text-white rounded-2xl rounded-tr-md"
    : "bg-muted/30 text-foreground rounded-2xl rounded-tl-md border border-border/40";

  const avatarLetter = (otherUser?.username || "U").charAt(0).toUpperCase();

  // ✅ expiresAt fallback: createdAt + destructTimer (sec)
  const expiresAtMs = useMemo(() => {
    const expRaw =
      message?.expiresAt ??
      message?.expires_at ??
      message?.expiresAtIso ??
      message?.expiresAtISO;

    const expMs = toMs(expRaw);
    if (expMs > 0) return expMs;

    const createdMs = toMs(message?.createdAt);
    if (!createdMs) return 0;

    let dt = Number(message?.destructTimer ?? message?.destruct_timer ?? 0);
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    if (dt > 100000) dt = Math.floor(dt / 1000);

    return createdMs + dt * 1000;
  }, [
    message?.expiresAt,
    message?.expires_at,
    message?.expiresAtIso,
    message?.expiresAtISO,
    message?.createdAt,
    message?.destructTimer,
    message?.destruct_timer,
  ]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAtMs) return;
    if (expiresAtMs <= Date.now()) return;

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAtMs]);

  const remainingMs = expiresAtMs ? expiresAtMs - now : 0;
  const showCountdown = expiresAtMs > 0 && remainingMs > 0;

  // ✅ Bubble padding: unten rechts Platz für Timer
  const bubblePadding =
    type === "image" ? "p-2 pb-7" : type === "file" ? "p-3 pb-7" : "p-3 pb-6";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} items-end gap-2`}>
      {/* Avatar nur bei empfangenen Nachrichten */}
      {!isOwn && (
        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-muted-foreground text-sm font-semibold">{avatarLetter}</span>
        </div>
      )}

      {/* Bubble */}
      <div className={`relative max-w-[78%] md:max-w-[60%] ${bubbleBase} ${bubblePadding}`}>
        {type === "image" ? (
          <img
            src={src}
            alt="image"
            className="max-w-full rounded-xl"
            style={{ maxHeight: 360, objectFit: "cover" }}
            loading="lazy"
          />
        ) : type === "file" ? (
          <div className="space-y-1">
            <div className="font-medium truncate">{message?.fileName || "File"}</div>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className={isOwn ? "underline text-white/90" : "underline text-primary"}
            >
              Open / Download
            </a>
            {message?.fileSize ? (
              <div className={isOwn ? "text-white/80 text-xs" : "text-muted-foreground text-xs"}>
                {Math.round((Number(message.fileSize) / 1024) * 10) / 10} KB
              </div>
            ) : null}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">{raw}</div>
        )}

        {/* Timer rechts unten */}
        {showCountdown && (
          <div
            className={`absolute bottom-1 right-2 text-[11px] leading-none ${
              isOwn ? "text-white/80" : "text-muted-foreground"
            }`}
            style={{ userSelect: "none" }}
          >
            {formatRemaining(remainingMs)}
          </div>
        )}
      </div>
    </div>
  );
}
