import { createContext, useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { pageImages } from "@/data/pageImages";

export const SEOCollector = createContext<((metadata: Record<string, string>) => void) | null>(null);

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;
  canonical?: string;
}

export default function SEO({
  title = "QR Gear - Custom QR Code Merchandise",
  description = "Create custom QR code merchandise with QR Gear. Apparel, hats, mugs, and more featuring your personalized QR codes. USA-made options available.",
  keywords = "QR code merchandise, custom promotional products, QR gear",
  ogImage,
  ogType = "website",
  ogUrl,
  canonical,
}: SEOProps) {
  const [location] = useLocation();
  canonical = canonical || `https://qrgear.com${location === "/" ? "/" : location.replace(/\/$/, "")}`;
  ogUrl = ogUrl || canonical;
  ogImage = new URL(ogImage || pageImages[location]?.src || "/og-image.png", "https://qrgear.com").href;
  const fullTitle = title.includes("QR Gear") ? title : `${title} | QR Gear`;
  const collect = useContext(SEOCollector);
  collect?.({ title: fullTitle, description, keywords, ogImage, ogType, ogUrl, canonical });
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

    let structured = document.getElementById("page-structured-data");
    if (!structured) {
      structured = document.createElement("script");
      structured.id = "page-structured-data";
      structured.setAttribute("type", "application/ld+json");
      document.head.appendChild(structured);
    }
    structured.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: fullTitle, description, url: canonical, isPartOf: { "@type": "WebSite", name: "QR Gear", url: "https://qrgear.com/" }, primaryImageOfPage: { "@type": "ImageObject", url: ogImage } });
    updateMeta("robots", "index, follow, max-image-preview:large");
    updateMeta("description", description);
    updateMeta("keywords", keywords);
    updateOGMeta("og:title", title);
    updateOGMeta("og:description", description);
    updateOGMeta("og:image", ogImage);
    updateOGMeta("og:type", ogType);
    if (ogUrl) {
      updateOGMeta("og:url", ogUrl);
    }
    
    updateMeta("twitter:card", "summary_large_image");
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
  }, [title, description, keywords, ogImage, ogType, ogUrl, canonical]);

  return null;
}
