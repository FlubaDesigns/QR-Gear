export const VIDEO_PREVIEW_SECONDS = 15;

/** Adapt the saved QR Play source for display; never substitute another video. */
export function playMediaPreview(source: string, autoplay: boolean) {
  let url: URL;
  try { url = new URL(source); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  if (["youtube.com", "m.youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) {
    const id = host === "youtu.be" ? url.pathname.slice(1)
      : url.pathname === "/watch" ? url.searchParams.get("v")
      : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const params = new URLSearchParams({ autoplay: autoplay ? "1" : "0", mute: "1", playsinline: "1", end: String(VIDEO_PREVIEW_SECONDS), rel: "0" });
    return { kind: "embed" as const, url: `https://www.youtube.com/embed/${id}?${params}`, posterUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if (["vimeo.com", "player.vimeo.com"].includes(host)) {
    const id = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?$/);
    if (!id) return null;
    const params = new URLSearchParams({ autoplay: autoplay ? "1" : "0", muted: "1", playsinline: "1" });
    const hash = url.searchParams.get("h") || id[2];
    if (hash) params.set("h", hash);
    return { kind: "embed" as const, url: `https://player.vimeo.com/video/${id[1]}?${params}` };
  }
  return { kind: "file" as const, url: source };
}
