"use strict";
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
const CF_FONT_MAP = {
    "Arial": "Arial", "Helvetica": "Helvetica", "Times New Roman": "Times New Roman",
    "Georgia": "Georgia", "Verdana": "Verdana", "Courier New": "Courier New",
    "Impact": "Impact", "Comic Sans MS": "Comic Sans MS", "Trebuchet MS": "Trebuchet MS",
    "Palatino Linotype": "Palatino Linotype",
};
exports.CF_FONT_MAP = CF_FONT_MAP;
function cfGetPreviewFontSize(fontSize) {
    if (fontSize === '12px' || fontSize === 'sm')
        return 10;
    if (fontSize === '24px' || fontSize === 'lg')
        return 16;
    if (fontSize === '32px' || fontSize === 'xl')
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
    const { width = 1200, height = 1800, backgroundColor = "#FFFFFF", qrSize = 600, topText, bottomText, qrUrl, qrColor = 'black', } = options;
    const { createCanvas: cc, loadImage: li } = getCanvas();
    const canvas = cc(width, height);
    const ctx = canvas.getContext("2d");
    if (backgroundColor && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
    }
    const textColor = "#000000";
    const scaleFactor = width / CF_PREVIEW_CONTAINER_WIDTH;
    const headerZoneTop = 0;
    const headerZoneHeight = height * 0.25;
    const qrZoneTop = headerZoneHeight;
    const qrZoneHeight = height * 0.50;
    const footerZoneTop = qrZoneTop + qrZoneHeight;
    const footerZoneHeight = height * 0.25;
    const cfDrawImageInZone = async (imgUrl, zoneX, zoneY, zoneW, zoneH, padding = 0.05, offsetX = 50, offsetY = 50, scale = 100) => {
        try {
            if (!imgUrl.startsWith("data:") && !imgUrl.startsWith("https://firebasestorage.googleapis.com/") && !imgUrl.startsWith("https://storage.googleapis.com/")) {
                console.warn("[cf-composite] Rejected non-allowed image URL scheme");
                return;
            }
            const { loadImage: li2 } = getCanvas();
            const img = await li2(imgUrl);
            const padX = zoneW * padding;
            const padY = zoneH * padding;
            const availW = zoneW - 2 * padX;
            const availH = zoneH - 2 * padY;
            const imgAspect = img.width / img.height;
            const zoneAspect = availW / availH;
            let baseW, baseH;
            if (imgAspect > zoneAspect) {
                baseW = availW;
                baseH = availW / imgAspect;
            }
            else {
                baseH = availH;
                baseW = availH * imgAspect;
            }
            const sf = scale / 100;
            const drawW = baseW * sf;
            const drawH = baseH * sf;
            const cx = Math.max(0, Math.min(100, offsetX));
            const cy = Math.max(0, Math.min(100, offsetY));
            const drawX = zoneX + padX + (cx / 100) * (availW - drawW);
            const drawY = zoneY + padY + (cy / 100) * (availH - drawH);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }
        catch (e) {
            console.warn("[cf-composite] Image load failed:", e?.message);
        }
    };
    const topIsImage = topText?.mode === "image" && topText?.imageUrl;
    if (topIsImage) {
        await cfDrawImageInZone(topText.imageUrl, 0, headerZoneTop, width, headerZoneHeight, 0.05, topText.imageOffsetX ?? 50, topText.imageOffsetY ?? 50, topText.imageScale ?? 100);
    }
    else if (topText && topText.text) {
        const previewFontSize = cfGetPreviewFontSize(topText.fontSize);
        const fontSize = previewFontSize * scaleFactor;
        const fontFamily = CF_FONT_MAP[topText.fontFamily] || "Arial";
        const fillColor = topText.color || textColor;
        ctx.font = `bold ${fontSize}px "${fontFamily}"`;
        ctx.fillStyle = fillColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        if (topText.strokeColor && topText.strokeWidth && topText.strokeWidth > 0) {
            ctx.strokeStyle = topText.strokeColor;
            ctx.lineWidth = topText.strokeWidth * scaleFactor;
        }
        const lines = cfWrapText(ctx, topText.text, width - 120);
        const totalTextHeight = lines.length * fontSize * 1.3;
        const vOff = topText.verticalOffset ?? 50;
        const hOff = topText.horizontalOffset ?? 50;
        const marginPct = 0.01;
        const marginY = headerZoneHeight * marginPct;
        const marginX = width * marginPct;
        const usableH = headerZoneHeight - 2 * marginY;
        const usableW = width - 2 * marginX;
        let currentY = headerZoneTop + marginY + (vOff / 100) * (usableH - totalTextHeight);
        const textX = marginX + (hOff / 100) * usableW;
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
    const qrMarginY = qrZoneHeight * 0.10;
    const qrAreaHeight = qrZoneHeight * 0.80;
    const bgPadding = 20;
    const bgRadius = 16;
    const qrContentHeight = qrAreaHeight - bgPadding * 2;
    const qrContentWidth = qrContentHeight;
    const qrDataUrl = await getQRCode().toDataURL(qrUrl, {
        width: qrContentWidth, margin: 2,
        color: { dark: qrDark, light: qrLight },
    });
    const qrImage = await li(qrDataUrl);
    const qrBgWidth = qrContentWidth + bgPadding * 2;
    const qrBgX = (width - qrBgWidth) / 2;
    const qrBgY = qrZoneTop + qrMarginY;
    const qrX = (width - qrContentWidth) / 2;
    const qrY = qrBgY + bgPadding;
    ctx.fillStyle = qrLight;
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(qrBgX, qrBgY, qrBgWidth, qrAreaHeight, bgRadius);
    }
    else {
        ctx.rect(qrBgX, qrBgY, qrBgWidth, qrAreaHeight);
    }
    ctx.fill();
    ctx.drawImage(qrImage, qrX, qrY, qrContentWidth, qrContentHeight);
    const bottomIsImage = bottomText?.mode === "image" && bottomText?.imageUrl;
    if (bottomIsImage) {
        await cfDrawImageInZone(bottomText.imageUrl, 0, footerZoneTop, width, footerZoneHeight, 0.05, bottomText.imageOffsetX ?? 50, bottomText.imageOffsetY ?? 50, bottomText.imageScale ?? 100);
    }
    else if (bottomText && bottomText.text) {
        const previewFontSize = cfGetPreviewFontSize(bottomText.fontSize);
        const fontSize = previewFontSize * scaleFactor;
        const fontFamily = CF_FONT_MAP[bottomText.fontFamily] || "Arial";
        const fillColor = bottomText.color || textColor;
        ctx.font = `bold ${fontSize}px "${fontFamily}"`;
        ctx.fillStyle = fillColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
            ctx.strokeStyle = bottomText.strokeColor;
            ctx.lineWidth = bottomText.strokeWidth * scaleFactor;
        }
        const lines = cfWrapText(ctx, bottomText.text, width - 120);
        const totalTextHeight = lines.length * fontSize * 1.3;
        const vOff = bottomText.verticalOffset ?? 50;
        const hOff = bottomText.horizontalOffset ?? 50;
        const marginPct = 0.01;
        const marginY = footerZoneHeight * marginPct;
        const marginX = width * marginPct;
        const usableH = footerZoneHeight - 2 * marginY;
        const usableW = width - 2 * marginX;
        let currentY = footerZoneTop + marginY + (vOff / 100) * (usableH - totalTextHeight);
        const textX = marginX + (hOff / 100) * usableW;
        for (const line of lines) {
            if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
                ctx.strokeText(line, textX, currentY);
            }
            ctx.fillText(line, textX, currentY);
            currentY += fontSize * 1.3;
        }
    }
    return canvas.toDataURL("image/png");
}
const CF_PREVIEW_WIDTH = 160;
exports.CF_PREVIEW_WIDTH = CF_PREVIEW_WIDTH;
const CF_PREVIEW_QR_SIZE = 36;
exports.CF_PREVIEW_QR_SIZE = CF_PREVIEW_QR_SIZE;
async function cfGeneratePrintifyComposite(qrUrl, topText, bottomText, printWidth = 1200, printHeight = 1800, qrColor = 'black', placement) {
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
        qrSize, topText, bottomText, qrUrl, qrColor, placement,
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