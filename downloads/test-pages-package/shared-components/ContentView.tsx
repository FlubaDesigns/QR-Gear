export interface ContentViewProps {
  backgroundUrl?: string | null;
  backgroundType?: "image" | "video";
  title?: string;
  description?: string;
  overlayPosition?: "top" | "bottom" | "center";
  overlayColor?: string;
  overlayFontFamily?: string;
  aspectRatio?: "portrait" | "landscape" | "square";
  placeholder?: string;
}

export function ContentView({
  backgroundUrl,
  backgroundType = "image",
  title,
  description,
  overlayPosition = "top",
  overlayColor = "#FFFFFF",
  overlayFontFamily = "Arial",
  aspectRatio = "portrait",
  placeholder = "Enter a URL to preview content",
}: ContentViewProps) {
  const aspectClass =
    aspectRatio === "portrait"
      ? "aspect-[9/16]"
      : aspectRatio === "landscape"
      ? "aspect-[16/9]"
      : "aspect-square";

  const positionClass =
    overlayPosition === "top"
      ? "items-start pt-6"
      : overlayPosition === "bottom"
      ? "items-end pb-6"
      : "items-center";

  const hasContent = title || description;
  const hasBackground = !!backgroundUrl;

  return (
    <div
      className={`relative ${aspectClass} rounded-lg overflow-hidden border-2 border-border bg-muted`}
      data-testid="content-view-container"
    >
      {hasBackground ? (
        backgroundType === "video" ? (
          <video
            src={backgroundUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            src={backgroundUrl}
            alt="Background"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground text-center px-4">
            {placeholder}
          </p>
        </div>
      )}

      {hasContent && hasBackground && (
        <div
          className={`absolute inset-0 flex flex-col ${positionClass} px-4`}
          style={{ fontFamily: overlayFontFamily }}
        >
          <div
            className="bg-black/40 backdrop-blur-sm rounded-lg p-3 max-w-full"
            style={{ color: overlayColor }}
          >
            {title && (
              <h3 className="text-lg font-bold leading-tight">{title}</h3>
            )}
            {description && (
              <p className="text-sm mt-1 leading-snug">{description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
