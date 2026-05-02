"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CF_PREVIEW_QR_SIZE = exports.CF_PREVIEW_WIDTH = exports.CF_PREVIEW_CONTAINER_WIDTH = exports.CF_FONT_MAP = exports.CF_PLACEMENT_DIMENSIONS = void 0;
exports.getCanvas = getCanvas;
exports.getQRCode = getQRCode;
exports.cfGenerateCompositeImage = cfGenerateCompositeImage;
exports.cfGeneratePrintifyComposite = cfGeneratePrintifyComposite;
exports.cfUploadBufferToStorage = cfUploadBufferToStorage;
exports.cfGetPreviewFontSize = cfGetPreviewFontSize;
exports.cfWrapText = cfWrapText;
const core_1 = require("../core");
const https = __importStar(require("https"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ============ COMPOSITE IMAGE GENERATOR (Inlined from server/lib/composite-image-generator.ts) ============
let _canvas = null;
let _qrcode = null;
function getCanvas() {
    if (!_canvas) {
        try {
            _canvas = require('canvas');
        }
        catch (e) {
            console.error('[Canvas] Failed to load canvas module:', e.message);
            throw new Error('Canvas module not available - ensure canvas is installed');
        }
    }
    return _canvas;
}
function getQRCode() {
    if (!_qrcode) {
        try {
            _qrcode = require('qrcode');
        }
        catch (e) {
            console.error('[QRCode] Failed to load qrcode module:', e.message);
            throw new Error('QRCode module not available');
        }
    }
    return _qrcode;
}
// Track fonts already registered in this Cloud Function instance
const CF_REGISTERED_FONTS = new Set([
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana',
    'Courier New', 'Impact', 'Comic Sans MS', 'Trebuchet MS', 'Palatino Linotype',
]);
async function cfFetchUrl(url, headers, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            headers: { ...(headers || {}), 'Accept-Encoding': 'identity' },
        };
        https.get(options, (res) => {
            // Follow redirects
            if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308)
                && res.headers.location && maxRedirects > 0) {
                res.resume();
                const redirectUrl = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : `https://${parsed.hostname}${res.headers.location}`;
                cfFetchUrl(redirectUrl, headers, maxRedirects - 1).then(resolve).catch(reject);
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}
// Resolve a Google Font TTF URL via GitHub's google/fonts repo.
// Returns null if the font is not found.
async function cfResolveFontUrlFromGitHub(fontName) {
    const slug = fontName.replace(/\s+/g, '').toLowerCase();
    // Licenses where Google Fonts stores fonts (ofl is most common, apache and ufl are others)
    const licenses = ['ofl', 'apache', 'ufl'];
    const GH_API = 'https://api.github.com';
    for (const license of licenses) {
        try {
            const listBuf = await cfFetchUrl(`${GH_API}/repos/google/fonts/contents/${license}/${slug}`, {
                'User-Agent': 'qrgear-cf/1.0',
            });
            const files = JSON.parse(listBuf.toString('utf8'));
            if (!Array.isArray(files))
                continue;
            // Prefer variable font (has brackets), then Regular, then Bold
            const ttfFiles = files.filter(f => f.name.endsWith('.ttf'));
            const pick = ttfFiles.find(f => f.name.includes('['))
                || ttfFiles.find(f => f.name.includes('Regular'))
                || ttfFiles.find(f => f.name.includes('Bold'))
                || ttfFiles[0];
            if (pick) {
                console.log(`[CF Fonts] GitHub resolved "${fontName}" → ${pick.name} (${license})`);
                return pick.download_url;
            }
        }
        catch { /* try next license */ }
    }
    return null;
}
async function cfEnsureFont(fontName) {
    if (CF_REGISTERED_FONTS.has(fontName))
        return fontName;
    const safeKey = fontName.replace(/[^a-zA-Z0-9]/g, '_');
    const tmpPath = path.join('/tmp', `gfont_${safeKey}.ttf`);
    try {
        const VALID_MAGIC = ['00010000', '4f54544f', '74727565', '74797031'];
        // If cached file exists, validate it before using
        if (fs.existsSync(tmpPath)) {
            const existing = fs.readFileSync(tmpPath);
            const existingMagic = existing.slice(0, 4).toString('hex');
            if (!VALID_MAGIC.includes(existingMagic)) {
                console.warn(`[CF Fonts] Cached file for "${fontName}" is invalid (magic: ${existingMagic}), re-downloading`);
                fs.unlinkSync(tmpPath);
            }
        }
        if (!fs.existsSync(tmpPath)) {
            // Primary: download from GitHub google/fonts (guaranteed valid TTF/variable-TTF)
            const fontUrl = await cfResolveFontUrlFromGitHub(fontName);
            if (!fontUrl) {
                console.warn(`[CF Fonts] Font "${fontName}" not found on GitHub google/fonts`);
                CF_REGISTERED_FONTS.add(fontName);
                return 'Arial';
            }
            console.log(`[CF Fonts] Fetching "${fontName}" from:`, fontUrl);
            const fontBuffer = await cfFetchUrl(fontUrl, { 'User-Agent': 'qrgear-cf/1.0' });
            const magic = fontBuffer.slice(0, 4).toString('hex');
            if (!VALID_MAGIC.includes(magic)) {
                console.warn(`[CF Fonts] Unexpected magic for "${fontName}": ${magic} (${fontBuffer.length} bytes)`);
                CF_REGISTERED_FONTS.add(fontName);
                return 'Arial';
            }
            fs.writeFileSync(tmpPath, fontBuffer);
            console.log(`[CF Fonts] Saved "${fontName}" → ${tmpPath} (${fontBuffer.length} bytes)`);
        }
        getCanvas().registerFont(tmpPath, { family: fontName });
        CF_REGISTERED_FONTS.add(fontName);
        console.log(`[CF Fonts] Registered: "${fontName}"`);
        return fontName;
    }
    catch (e) {
        console.warn(`[CF Fonts] Failed to register "${fontName}":`, e?.message);
        CF_REGISTERED_FONTS.add(fontName);
        return 'Arial';
    }
}
const CF_PLACEMENT_DIMENSIONS = {
    "front": { width: 3600, height: 4800 },
    "front_large": { width: 3600, height: 4800 },
    "back": { width: 3600, height: 4200 },
    "front_small": { width: 2400, height: 1800 },
    "pocket": { width: 1200, height: 1200 },
    "left_sleeve": { width: 1200, height: 1500 },
    "right_sleeve": { width: 1200, height: 1500 },
};
exports.CF_PLACEMENT_DIMENSIONS = CF_PLACEMENT_DIMENSIONS;
// System fonts that don't need downloading
const CF_FONT_MAP = {
    "Arial": "Arial", "Helvetica": "Helvetica", "Times New Roman": "Times New Roman",
    "Georgia": "Georgia", "Verdana": "Verdana", "Courier New": "Courier New",
    "Impact": "Impact", "Comic Sans MS": "Comic Sans MS", "Trebuchet MS": "Trebuchet MS",
    "Palatino Linotype": "Palatino Linotype",
};
exports.CF_FONT_MAP = CF_FONT_MAP;
function cfGetPreviewFontSize(fontSize) {
    const num = parseInt(fontSize, 10);
    if (!isNaN(num) && num > 0)
        return num;
    if (fontSize === 'sm')
        return 10;
    if (fontSize === 'lg')
        return 16;
    if (fontSize === 'xl')
        return 22;
    return 12;
}
const CF_PREVIEW_CONTAINER_WIDTH = 160;
exports.CF_PREVIEW_CONTAINER_WIDTH = CF_PREVIEW_CONTAINER_WIDTH;
function cfWrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        }
        else {
            currentLine = testLine;
        }
    }
    if (currentLine)
        lines.push(currentLine);
    return lines;
}
async function cfGenerateCompositeImage(options) {
    const { width = 1200, height = 1800, backgroundColor = "#FFFFFF", qrSize = 600, topText, bottomText, qrUrl, qrColor = 'black', graphicLayoutMode = 'zone', qrSizePercent = 75, subBottomEnabled = false, subBottomText = 'Scan Me', subBottomColor = '#666666', subBottomFontSize = '14', } = options;
    const { createCanvas: cc, loadImage: li } = getCanvas();
    const canvas = cc(width, height);
    const ctx = canvas.getContext("2d");
    if (backgroundColor && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
    }
    const textColor = "#000000";
    const scaleFactor = width / CF_PREVIEW_CONTAINER_WIDTH;
    const BLEED_SAFE_PX = 75;
    const safeX = BLEED_SAFE_PX;
    const safeY = BLEED_SAFE_PX;
    const safeW = Math.max(1, width - 2 * BLEED_SAFE_PX);
    const safeH = Math.max(1, height - 2 * BLEED_SAFE_PX);
    let headerZoneTop, headerZoneHeight;
    let qrZoneTop, qrZoneHeight;
    let footerZoneTop, footerZoneHeight;
    let subBottomZoneTop, subBottomZoneHeight;
    let zoneX;
    let zoneW;
    const subBottomActive = subBottomEnabled && subBottomText?.trim();
    if (graphicLayoutMode === 'freeform') {
        zoneX = safeX;
        zoneW = safeW;
        headerZoneTop = safeY;
        headerZoneHeight = safeH;
        qrZoneTop = safeY;
        qrZoneHeight = safeH;
        footerZoneTop = safeY;
        footerZoneHeight = safeH;
        subBottomZoneTop = safeY;
        subBottomZoneHeight = 0;
    }
    else {
        // Zone mode: QR-anchored — QR is always at canvas center, zones hug outward
        zoneX = safeX;
        zoneW = safeW;
        const bgPaddingZone = 20;
        // QR content size: driven by qrSizePercent / 2 to match client-side graphicLayout.ts
        // Default 75 → 37.5% of safe width; same formula as frontend zone mode.
        const zoneQrPct = Math.min(Math.max(qrSizePercent / 2, 15), 55);
        const qrContentSizeZone = Math.round(safeW * (zoneQrPct / 100));
        const qrBgSizeZone = qrContentSizeZone + bgPaddingZone * 2;
        // QR background box centered on canvas
        const qrBgTopZone = Math.round(safeY + safeH / 2 - qrBgSizeZone / 2);
        const qrBgBottomZone = qrBgTopZone + qrBgSizeZone;
        // Fixed gap between QR box and header/footer content (print-safe, minimal)
        const zonePaddingZone = 20;
        const subBottomHeightZone = subBottomActive
            ? Math.max(24, Math.round(qrBgSizeZone * 0.12))
            : 0;
        headerZoneTop = safeY;
        headerZoneHeight = Math.max(0, qrBgTopZone - safeY - zonePaddingZone);
        qrZoneTop = qrBgTopZone;
        qrZoneHeight = qrBgSizeZone; // = full background box size
        subBottomZoneTop = qrBgBottomZone;
        subBottomZoneHeight = subBottomHeightZone;
        const footerPadZone = zonePaddingZone;
        footerZoneTop = qrBgBottomZone + subBottomHeightZone + footerPadZone;
        footerZoneHeight = Math.max(0, (safeY + safeH) - footerZoneTop);
    }
    const cfDrawImageInZone = async (imgUrl, zoneX, zoneY, zoneW, zoneH, _padding = 0, offsetX = 50, offsetY = 50, scale = 100) => {
        try {
            if (!imgUrl.startsWith("data:") && !imgUrl.startsWith("https://firebasestorage.googleapis.com/") && !imgUrl.startsWith("https://storage.googleapis.com/")) {
                console.warn("[cf-composite] Rejected non-allowed image URL scheme");
                return;
            }
            const { loadImage: li2 } = getCanvas();
            const img = await li2(imgUrl);
            const imgAspect = img.width / img.height;
            const zoneAspect = zoneW / zoneH;
            let baseW, baseH;
            if (imgAspect > zoneAspect) {
                baseW = zoneW;
                baseH = zoneW / imgAspect;
            }
            else {
                baseH = zoneH;
                baseW = zoneH * imgAspect;
            }
            const sf = scale / 100;
            let drawW = baseW * sf;
            let drawH = baseH * sf;
            if (drawW > zoneW || drawH > zoneH) {
                const fitScale = Math.min(zoneW / drawW, zoneH / drawH);
                drawW *= fitScale;
                drawH *= fitScale;
            }
            const cx = Math.max(0, Math.min(100, offsetX));
            const cy = Math.max(0, Math.min(100, offsetY));
            const drawX = zoneX + (cx / 100) * Math.max(0, zoneW - drawW);
            const drawY = zoneY + (cy / 100) * Math.max(0, zoneH - drawH);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }
        catch (e) {
            console.warn("[cf-composite] Image load failed:", e?.message);
        }
    };
    const topIsImage = topText?.mode === "image" && topText?.imageUrl;
    if (topIsImage) {
        await cfDrawImageInZone(topText.imageUrl, zoneX, headerZoneTop, zoneW, headerZoneHeight, 0, graphicLayoutMode === 'zone' ? 50 : (topText.horizontalOffset ?? 50), graphicLayoutMode === 'zone' ? 50 : (topText.verticalOffset ?? 50), topText.imageScale ?? 100);
    }
    else if (topText && topText.text) {
        const previewFontSize = cfGetPreviewFontSize(topText.fontSize);
        const fontSize = previewFontSize * scaleFactor;
        const fontFamily = CF_FONT_MAP[topText.fontFamily] || await cfEnsureFont(topText.fontFamily);
        const fillColor = topText.color || textColor;
        ctx.font = `bold ${fontSize}px "${fontFamily}"`;
        ctx.fillStyle = fillColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        if (topText.strokeColor && topText.strokeWidth && topText.strokeWidth > 0) {
            ctx.strokeStyle = topText.strokeColor;
            ctx.lineWidth = topText.strokeWidth * scaleFactor;
        }
        const lines = cfWrapText(ctx, topText.text, zoneW - 20);
        const totalTextHeight = lines.length * fontSize * 1.3;
        let currentY = headerZoneTop + Math.max(0, (headerZoneHeight - totalTextHeight) / 2);
        const textX = zoneX + zoneW / 2;
        for (const line of lines) {
            if (topText.strokeColor && topText.strokeWidth && topText.strokeWidth > 0) {
                ctx.strokeText(line, textX, currentY);
            }
            ctx.fillText(line, textX, currentY);
            currentY += fontSize * 1.3;
        }
    }
    const qrDark = qrColor === 'white' ? "#FFFFFF" : "#000000";
    const qrLight = qrColor === 'white' ? "#000000" : "#FFFFFF";
    const bgPadding = 20;
    const bgRadius = 16;
    let qrBgX, qrBgY, qrBgDrawW, qrBgDrawH;
    let qrX, qrY, qrContentWidth, qrContentHeight;
    if (graphicLayoutMode !== 'freeform') {
        // Zone mode: qrZoneHeight IS the background box size (content + 2 * bgPadding)
        qrContentWidth = qrZoneHeight - bgPadding * 2;
        qrContentHeight = qrContentWidth;
        qrBgDrawW = qrZoneHeight;
        qrBgDrawH = qrZoneHeight;
        qrBgX = zoneX + (zoneW - qrBgDrawW) / 2;
        qrBgY = qrZoneTop;
        qrX = qrBgX + bgPadding;
        qrY = qrBgY + bgPadding;
    }
    else {
        // Freeform mode: scale QR to 80% of zone height
        const qrAreaHeight = qrZoneHeight * 0.80;
        qrContentHeight = qrAreaHeight - bgPadding * 2;
        qrContentWidth = qrContentHeight;
        qrBgDrawW = qrContentWidth + bgPadding * 2;
        qrBgDrawH = qrAreaHeight;
        qrBgX = zoneX + (zoneW - qrBgDrawW) / 2;
        qrBgY = qrZoneTop + (qrZoneHeight - qrAreaHeight) / 2;
        qrX = zoneX + (zoneW - qrContentWidth) / 2;
        qrY = qrBgY + bgPadding;
    }
    const qrDataUrl = await getQRCode().toDataURL(qrUrl, {
        width: qrContentWidth, margin: 2,
        color: { dark: qrDark, light: qrLight },
    });
    const qrImage = await li(qrDataUrl);
    ctx.fillStyle = qrLight;
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(qrBgX, qrBgY, qrBgDrawW, qrBgDrawH, bgRadius);
    }
    else {
        ctx.rect(qrBgX, qrBgY, qrBgDrawW, qrBgDrawH);
    }
    ctx.fill();
    ctx.drawImage(qrImage, qrX, qrY, qrContentWidth, qrContentHeight);
    const bottomIsImage = bottomText?.mode === "image" && bottomText?.imageUrl;
    if (bottomIsImage) {
        await cfDrawImageInZone(bottomText.imageUrl, zoneX, footerZoneTop, zoneW, footerZoneHeight, 0, graphicLayoutMode === 'zone' ? 50 : (bottomText.horizontalOffset ?? 50), graphicLayoutMode === 'zone' ? 50 : (bottomText.verticalOffset ?? 50), bottomText.imageScale ?? 100);
    }
    else if (bottomText && bottomText.text) {
        const previewFontSize = cfGetPreviewFontSize(bottomText.fontSize);
        const fontSize = previewFontSize * scaleFactor;
        const fontFamily = CF_FONT_MAP[bottomText.fontFamily] || await cfEnsureFont(bottomText.fontFamily);
        const fillColor = bottomText.color || textColor;
        ctx.font = `bold ${fontSize}px "${fontFamily}"`;
        ctx.fillStyle = fillColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
            ctx.strokeStyle = bottomText.strokeColor;
            ctx.lineWidth = bottomText.strokeWidth * scaleFactor;
        }
        const lines = cfWrapText(ctx, bottomText.text, zoneW - 20);
        const totalTextHeight = lines.length * fontSize * 1.3;
        let currentY = footerZoneTop + Math.max(0, (footerZoneHeight - totalTextHeight) / 2);
        const textX = zoneX + zoneW / 2;
        for (const line of lines) {
            if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
                ctx.strokeText(line, textX, currentY);
            }
            ctx.fillText(line, textX, currentY);
            currentY += fontSize * 1.3;
        }
    }
    if (subBottomActive && subBottomZoneHeight > 0) {
        const sbFontSize = cfGetPreviewFontSize(subBottomFontSize) * scaleFactor;
        ctx.fillStyle = subBottomColor || '#666666';
        ctx.font = `${sbFontSize}px "Arial"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(subBottomText.trim(), zoneX + zoneW / 2, subBottomZoneTop + subBottomZoneHeight / 2);
    }
    return canvas.toDataURL("image/png");
}
const CF_PREVIEW_WIDTH = 160;
exports.CF_PREVIEW_WIDTH = CF_PREVIEW_WIDTH;
const CF_PREVIEW_QR_SIZE = 36;
exports.CF_PREVIEW_QR_SIZE = CF_PREVIEW_QR_SIZE;
async function cfGeneratePrintifyComposite(qrUrl, topText, bottomText, printWidth = 1200, printHeight = 1800, qrColor = 'black', placement, graphicLayoutMode, qrSizePercent = 75) {
    let finalWidth = printWidth;
    let finalHeight = printHeight;
    if (placement && CF_PLACEMENT_DIMENSIONS[placement]) {
        finalWidth = CF_PLACEMENT_DIMENSIONS[placement].width;
        finalHeight = CF_PLACEMENT_DIMENSIONS[placement].height;
    }
    const scaleFactor = finalWidth / CF_PREVIEW_WIDTH;
    const qrSize = CF_PREVIEW_QR_SIZE * scaleFactor;
    return cfGenerateCompositeImage({
        width: finalWidth, height: finalHeight, backgroundColor: "transparent",
        qrSize, topText, bottomText, qrUrl, qrColor, placement, graphicLayoutMode, qrSizePercent,
    });
}
async function cfUploadBufferToStorage(buffer, mimeType, folder = 'member-graphics') {
    const crypto = require('crypto');
    const extension = mimeType.split('/')[1] || 'png';
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const objectName = `${folder}/${uniqueId}.${extension}`;
    const bucket = core_1.storage.bucket();
    const file = bucket.file(objectName);
    await file.save(buffer, { metadata: { contentType: mimeType }, public: true });
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectName}`;
    console.log(`[CF Storage] Uploaded: ${objectName} (${buffer.length} bytes)`);
    return { publicUrl, storagePath: objectName };
}
//# sourceMappingURL=composite-image.js.map