import { useQuery } from "@tanstack/react-query";

const DEFAULT_FONTS = [
  "Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana",
  "Courier New", "Impact", "Comic Sans MS", "Trebuchet MS", "Palatino Linotype",
];

export function useFonts() {
  const { data, isLoading } = useQuery<{ fonts: string[] }>({
    queryKey: ["/api/fonts"],
    staleTime: 5 * 60 * 1000,
  });

  return {
    fonts: data?.fonts || DEFAULT_FONTS,
    isLoading,
  };
}

export function loadGoogleFont(fontName: string) {
  const id = `gf-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

export function loadGoogleFonts(fonts: string[]) {
  const systemFonts = new Set([
    "Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana",
    "Courier New", "Impact", "Comic Sans MS", "Trebuchet MS",
    "Palatino Linotype", "Tahoma", "Lucida Console", "monospace",
    "serif", "sans-serif",
  ]);
  const googleFonts = fonts.filter(f => !systemFonts.has(f));
  if (googleFonts.length === 0) return;
  const families = googleFonts.map(f => `family=${encodeURIComponent(f)}:wght@400;700`).join("&");
  const id = "gf-bulk-load";
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (link) {
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  } else {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
  }
}
