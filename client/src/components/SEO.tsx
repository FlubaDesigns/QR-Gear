import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
}

export default function SEO({
  title = "QR Gear - Custom QR Code Merchandise",
  description = "Create custom QR code merchandise with QR Gear. USA-made apparel, hats, mugs, and more featuring your personalized QR codes.",
  keywords = "QR code merchandise, custom promotional products, USA made merchandise",
  ogImage = "/og-image.png",
  ogType = "website",
  canonical,
}: SEOProps) {
  useEffect(() => {
    document.title = title.includes("QR Gear") ? title : `${title} | QR Gear`;
    
    const updateMeta = (name: string, content: string) => {
      let element = document.querySelector(`meta[name="${name}"]`);
      if (element) {
        element.setAttribute("content", content);
      } else {
        element = document.createElement("meta");
        element.setAttribute("name", name);
        element.setAttribute("content", content);
        document.head.appendChild(element);
      }
    };

    const updateOGMeta = (property: string, content: string) => {
      let element = document.querySelector(`meta[property="${property}"]`);
      if (element) {
        element.setAttribute("content", content);
      } else {
        element = document.createElement("meta");
        element.setAttribute("property", property);
        element.setAttribute("content", content);
        document.head.appendChild(element);
      }
    };

    updateMeta("description", description);
    updateMeta("keywords", keywords);
    updateOGMeta("og:title", title);
    updateOGMeta("og:description", description);
    updateOGMeta("og:image", ogImage);
    updateOGMeta("og:type", ogType);
    
    updateMeta("twitter:title", title);
    updateMeta("twitter:description", description);
    updateMeta("twitter:image", ogImage);

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (link) {
        link.setAttribute("href", canonical);
      } else {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        link.setAttribute("href", canonical);
        document.head.appendChild(link);
      }
    }
  }, [title, description, keywords, ogImage, ogType, canonical]);

  return null;
}
