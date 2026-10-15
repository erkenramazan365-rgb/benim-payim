"use client";

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: Date | null;
}

export default function SaveIndicator({ status, lastSavedAt }: SaveIndicatorProps) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 font-medium">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        Kaydediliyor...
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 font-medium">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        Taslak kaydedildi
      </span>
    );
  }

  if (status === "unsaved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        Kaydedilmemiş değişiklikler var
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Kaydedilemedi, lütfen tekrar deneyin
      </span>
    );
  }

  return null;
}
