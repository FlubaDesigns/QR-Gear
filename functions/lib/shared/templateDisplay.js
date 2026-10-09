"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectTemplateDisplay = projectTemplateDisplay;
function projectTemplateDisplay(data) {
    const packet = data.packet || {};
    const previewImages = [];
    const add = (url, label) => {
        if (typeof url === 'string' && url.trim() && !previewImages.some(image => image.url === url)) {
            previewImages.push({ url, label });
        }
    };
    add(data.priorityMockupUrl || packet.priorityMockupUrl, 'Mockup');
    add(data.compositeUrl || data.artworkUrl || packet.compositeUrl, 'Graphic');
    add(data.qrOnlyUrl || packet.qrOnlyUrl, 'QR Code');
    add(data.landingPageSnapshotUrl || packet.landingPageSnapshotUrl, 'Landing Page');
    if (!previewImages.length)
        add(data.thumbnailUrl, 'Preview');
    const rawPrice = data.pricing?.customerPrice ?? data.customerPrice;
    const price = typeof rawPrice === 'number' ? rawPrice : typeof rawPrice === 'string' && rawPrice.trim() ? Number(rawPrice) : NaN;
    return {
        previewTitle: data.productName || data.name || packet.productName || 'Untitled Template',
        previewImageUrl: previewImages[0]?.url ?? null,
        previewPrice: Number.isFinite(price) && price >= 0 ? price : null,
        previewImages,
    };
}
//# sourceMappingURL=templateDisplay.js.map