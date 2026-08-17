"use client"

import { cn } from "@/lib/utils"

/**
 * Turns a pasted video link into something playable inline. YouTube and Vimeo
 * links become an embedded player; any other URL is treated as a direct video
 * file (mp4/webm) and played with the native <video> controls.
 */
function toEmbedSrc(url: string): string | null {
  const u = url.trim()
  const yt = u.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/,
  )
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}

export function VideoPlayer({
  url,
  className,
  fit = "contain",
}: {
  url: string
  className?: string
  /** "cover" fills the parent (crops the far edges, no letterbox bars); the
   *  default "contain" keeps a self-contained 16:9 card. */
  fit?: "contain" | "cover"
}) {
  if (!url?.trim()) return null
  const embed = toEmbedSrc(url)
  const cover = fit === "cover"
  if (embed) {
    return (
      <div
        className={cn(
          cover
            ? "relative h-full w-full overflow-hidden bg-black"
            : "aspect-video w-full overflow-hidden rounded-2xl border bg-black",
          className,
        )}
      >
        <iframe
          src={embed}
          title="فيديو المنتج"
          className={cn(
            cover
              ? // Fill the height, let width grow to keep 16:9, clip the overflow.
                "absolute left-1/2 top-1/2 aspect-video h-full w-auto max-w-none -translate-x-1/2 -translate-y-1/2"
              : "h-full w-full",
          )}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }
  return (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      className={cn(
        cover
          ? "h-full w-full bg-black object-cover"
          : "aspect-video w-full rounded-2xl border bg-black object-contain",
        className,
      )}
    />
  )
}
