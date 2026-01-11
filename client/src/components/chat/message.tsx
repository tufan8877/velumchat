import React from "react";
import type { User } from "@shared/schema";

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

  // ✅ Normalisiere URL:
  // - "/uploads/xyz" -> absolute url
  // - "http(s)://..." bleibt
  // - "blob:..." (optimistic preview) bleibt
  const src =
    raw.startsWith("http") || raw.startsWith("blob:") || raw.startsWith("data:")
      ? raw
      : raw.startsWith("/")
      ? new URL(raw, window.location.origin).toString()
      : raw;

  const bubbleClass = isOwn
    ? "bg-blue-600 text-white rounded-2xl rounded-tr-md"
    : "bg-surface text-foreground rounded-2xl rounded-tl-md";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] md:max-w-[60%] p-3 ${bubbleClass}`}>
        {type === "image" ? (
          <div className="space-y-2">
            <img
              src={src}
              alt="image"
              className="max-w-full rounded-xl"
              style={{ maxHeight: 360, objectFit: "cover" }}
              loading="lazy"
            />
          </div>
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
      </div>
    </div>
  );
}
