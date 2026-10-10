import { db, QR_GEAR_BRANDED_TAG_URL } from '../core';
import { MEMBER_PACKETS_COLLECTION } from '../constants';
import { memberCatalogProducts } from './catalog-tier-products';
import { catalogSaleVariants, selectCatalogSaleVariant } from './catalog-sale-variants';
import { requireFulfillmentProvider } from '../../../shared/fulfillmentSettings';
import { requireBuilderSnapshot, packetBuildFields, buildPacketMockupRequest } from '../../../shared/builderSnapshot';
import { isValidMasterCatalogDocId } from '../../../shared/qrgCodes';
import { priceNewPacket } from './pricing';
import { registerGrfAsset, registerPacketGrfAssets, registerMockupGrfAssets } from './grf-registrar';
import { generateMockupFromPrintful } from './mockup-generator';
import { GRF_PACKET_SLOTS } from '../../../shared/GRF_engine';
import { decodeLibraryImage } from './image-validation';
import { writeBldDefinition, writeAutoAssembly } from './bld-builder';
import { allocateQrgInstance } from './qrg-instance-allocator';
import { validatePacketComposition } from './assembly-store';
import { resolveRuntimeConfig } from '../runtime-config';

function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
const modes: Record<string, string> = { 'qr-basic': 'qr_basics', 'qr-plus': 'qr_plus', 'qr-canvas': 'qr_canvas', 'qr-play': 'qr_play', 'qr-compose': 'qr_compose' };

export async function ownedMemberBuild(memberId: string, id: string) {
  if (!id || id.includes('/')) fail('Choose a saved member build.');
  const ref = db.collection('productPackets').doc(id), doc = await ref.get();
  if (!doc.exists) fail('Member build not found.', 404);
  const packet = doc.data()!;
  if (packet.ownerType !== 'member' || packet.memberId !== memberId) fail('This build belongs to another account.', 403);
  return { ref, packet };
}

/** Translate the member editor once; QRG, pricing, BLD, GRF and Assembly remain shared. */
export async function prepareMemberBuild(memberId: string, input: any) {
  const sourceMasterId = input.boundProduct?.canonicalBlankKey;
  if (!isValidMasterCatalogDocId(sourceMasterId)) fail('Select a QRG product again before building.');
  const choices = await memberCatalogProducts(db);
  const product = choices.find((p: any) => p.canonicalBlankKey === sourceMasterId);
  if (!product) fail('This product is not enabled in the member catalog.');
  const provider = requireFulfillmentProvider(product.fulfillmentProvider);
  const master = (await db.collection('master_catalog').doc(sourceMasterId).get()).data()!;
  const variant = selectCatalogSaleVariant({ enabledColors: product.availableColors, enabledSizes: product.availableSizes }, master, provider, input.selectedShirtSize, input.selectedColor);
  const channel = input.channelId ? await db.collection('channels').doc(input.channelId).get() : null;
  if (!channel?.exists || channel.data()?.ownerId !== memberId) fail('Choose one of your channels.');
  const mode = modes[input.packetType];
  if (!mode) fail('Choose a QR product type.');
  if (input.packetType === 'qr-compose') fail('QR Compose needs its saved content sequence connected before member publishing.');
  const selected = input.selectedPlacements;
  if (!Array.isArray(selected) || !selected.length || selected.some((p: any) => typeof p !== 'string')) fail('Choose a print placement.');
  const locations = master.qrgPrintSpecs?.[provider]?.locations || [];
  const providerLayouts: Record<string, any> = {};
  for (const placement of selected) {
    const spec = locations.find((p: any) => p.id === placement && p.provider === provider);
    if (!spec?.dimensions?.widthPx || !spec?.dimensions?.heightPx || !spec.verifiedVariantIds?.includes(Number(variant.mapping.variantId))) fail(`Refresh the QRG print area for ${placement} before building this selection.`);
    providerLayouts[placement] = spec;
  }
  const title = String(input.title || '').trim();
  if (!title) fail('Give your product a title.');
  if (input.packetType === 'qr-canvas' && !input.background) fail('Choose your QR Canvas background.');
  if (input.packetType === 'qr-play' && !input.videoUrl) fail('Choose your QR Play video.');
  const label = locations.find((p: any) => p.id === 'label_inside');
  if (!label?.verifiedVariantIds?.includes(Number(variant.mapping.variantId))) fail('This variant does not support the required inside label.');
  const placementSizes = Object.fromEntries(selected.map((placement: string) => {
    const size = input.perPlacementSizes?.[placement] || input.graphicSize || 'medium';
    if (!['small', 'medium', 'large'].includes(size)) fail('Choose a valid graphic size.');
    return [placement, size];
  }));
  const rawSnapshot = requireBuilderSnapshot({ title, description: String(input.description || ''),
    graphics: { loadedBackground: input.background ? { url: input.background } : null, content: {
      headerStyle: input.headerStyle, footerStyle: input.footerStyle, areaImageUrl: input.areaImageUrl || '',
      graphicLayoutMode: input.graphicLayoutMode || 'zone', qrPositionX: input.qrPositionX ?? 50,
      qrPositionY: input.qrPositionY ?? 50, qrSizePercent: input.qrSizePercent ?? 75,
      hostingTierCode: input.hostingTierCode || '1_year', playMediaUrl: input.videoUrl || '', qrBasicInputType: input.qrBasicInputType || 'url', areaImageMode: input.areaImageMode || 'cover',
    } },
    qrConfig: { qrProductState: mode, selectedColor: product.availableColors.find((c: any) => c.name === variant.color) },
    layoutConfig: { selectedPlacements: selected, providerLayouts, placementSizes },
    metadata: { selectedProductDocId: sourceMasterId, fulfillmentProvider: provider, selectedRole: 'member' },
  });
  const priced = await priceNewPacket(db, rawSnapshot, QR_GEAR_BRANDED_TAG_URL);
  if (input.existingPacketId && (typeof input.existingPacketId !== 'string' || input.existingPacketId.includes('/'))) fail('Invalid member product.');
  const memberPacketId = input.existingPacketId || db.collection(MEMBER_PACKETS_COLLECTION).doc().id;
  const previous = await db.collection(MEMBER_PACKETS_COLLECTION).doc(memberPacketId).get();
  if (previous.exists && previous.data()?.memberId !== memberId) fail('This product belongs to another member.', 403);
  const ref = db.collection('productPackets').doc();
  const origin = resolveRuntimeConfig().origin;
  const hosted = ['qr-canvas', 'qr-play', 'qr-compose'].includes(input.packetType);
  const landingPageSlug = `member-${ref.id}`;
  const qrContent = hosted ? `${origin}/m/${landingPageSlug}` : String(input.qrBasicContent || input.qrDestination || '').trim();
  if (!qrContent) fail('Enter the content for your QR code.');
  const now = new Date().toISOString();
  const packet = { ...packetBuildFields(priced.builderSnapshot), ownerType: 'member', memberId, memberPacketId,
    sourceMasterId, qrgBlankId: master.qrgBlankId, fulfillmentProvider: provider,
    storeId: null, channelId: null, memberChannelId: input.channelId,
    title, description: String(input.description || ''), packetType: input.packetType, qrContent,
    selectedColor: variant.color, selectedShirtSize: variant.size, selectedVariantKey: variant.key,
    boundProduct: { canonicalBlankKey: sourceMasterId, title: product.title, imageUrl: product.imageUrl,
      fulfillmentProvider: provider, providerProductId: Number(variant.mapping.productId) },
    landingPageSlug, landingPageTitle: title, landingPageDescription: String(input.description || ''),
    landingPageBackgroundUrl: input.background || null, playMediaUrl: input.videoUrl || null,
    pricing: priced.pricing, placementGraphicUrls: priced.placementGraphicUrls,
    status: 'building', createdAt: now, updatedAt: now };
  await ref.create(packet);
  return { packetId: ref.id, memberPacketId, builderSnapshot: priced.builderSnapshot, qrContent, pricing: priced.pricing };
}

export async function saveMemberArtwork(memberId: string, id: string, placement: string, data: string) {
  const { ref, packet } = await ownedMemberBuild(memberId, id);
  if (packet.status !== 'building') fail('Generate a new build before changing published artwork.');
  const snapshot = requireBuilderSnapshot(packet.builderSnapshot);
  if (!snapshot.layoutConfig.selectedPlacements.includes(placement) || placement === 'label_inside') fail('Choose a placement in this build.');
  const image = decodeLibraryImage(data, 'image/png'), bytes = Buffer.from(image.imageData, 'base64');
  const dims = snapshot.layoutConfig.providerLayouts[placement]?.dimensions;
  if (bytes.length < 24 || bytes.readUInt32BE(16) !== dims?.widthPx || bytes.readUInt32BE(20) !== dims?.heightPx) fail('Rendered artwork dimensions do not match the saved QRG print area.');
  const asset = await registerGrfAsset({ ...image, ...GRF_PACKET_SLOTS.qrComposite, packetId: id, createdBy: memberId });
  await ref.update({ [`placementGraphicUrls.${placement}`]: asset.publicUrl, updatedAt: new Date().toISOString() });
  return { publicUrl: asset.publicUrl };
}

export async function commitMemberBuild(memberId: string, id: string) {
  const { ref, packet } = await ownedMemberBuild(memberId, id);
  if (packet.status === 'published') return { id: packet.memberPacketId, ...await memberBuildProjection(packet.memberPacketId) };
  if (packet.status !== 'building') fail('This build is not ready to publish.');
  const snapshot = requireBuilderSnapshot(packet.builderSnapshot);
  for (const placement of snapshot.layoutConfig.selectedPlacements) if (!packet.placementGraphicUrls?.[placement]) fail(`Generate the ${placement} artwork before publishing.`);
  const primary = snapshot.layoutConfig.selectedPlacements.find((p: string) => p !== 'label_inside');
  const compositeUrl = packet.placementGraphicUrls[primary];
  await ref.update({ compositeUrl, productGraphicUrl: compositeUrl });
  const grfs = await registerPacketGrfAssets({ ...packet, compositeUrl }, null, id);
  const master = (await db.collection('master_catalog').doc(packet.sourceMasterId).get()).data()!;
  const mapping = master.qrgVariants?.[packet.selectedVariantKey]?.providerVariants?.printful;
  if (packet.fulfillmentProvider !== 'printful' || !mapping) fail('This saved build needs its QRG Printful mockup mapping.');
  const mockup = await generateMockupFromPrintful({
    ...buildPacketMockupRequest(packet, master, primary), printfulVariantId: Number(mapping.variantId),
  });
  const placementMockupUrls = { [primary]: mockup.mockupUrl };
  const mockupGrfs = await registerMockupGrfAssets(id, mockup.lifestyleMockupUrl || null, placementMockupUrls);
  await ref.update({ mockupUrl: mockup.mockupUrl, lifestyleMockupUrl: mockup.lifestyleMockupUrl || null,
    placementMockupUrls, ...mockupGrfs });
  const bld = await writeBldDefinition({ working: snapshot, packetId: id });
  await writeAutoAssembly({ working: snapshot, qrgId: packet.qrgBlankId, bldId: bld.bldId, sourceSessionId: null, packetId: id, grfIds: { ...grfs, ...mockupGrfs } });
  const built = (await ref.get()).data()!;
  await validatePacketComposition(db, id, built);
  const identity = built.qrgBaseCode ? {} : await allocateQrgInstance({ qrgBlankId: packet.qrgBlankId, context: 'M' });
  const memberRef = db.collection(MEMBER_PACKETS_COLLECTION).doc(packet.memberPacketId);
  const now = new Date().toISOString();
  await db.runTransaction(async tx => {
    const old = await tx.get(memberRef);
    if (old.exists && old.data()?.memberId !== memberId) fail('This product belongs to another member.', 403);
    tx.update(ref, { ...identity, status: 'published', updatedAt: now });
    // The member record is an ownership/listing reference; production data is read from its packet.
    tx.set(memberRef, { memberId, id: memberRef.id, packetId: memberRef.id, productionPacketId: id,
      channelId: packet.memberChannelId, packetType: packet.packetType, status: 'published',
      createdAt: old.data()?.createdAt || now, updatedAt: now });
  });
  return { id: memberRef.id, ...await memberBuildProjection(memberRef.id) };
}

export async function memberBuildProjection(id: string): Promise<Record<string, any>> {
  const member = (await db.collection(MEMBER_PACKETS_COLLECTION).doc(id).get()).data();
  if (!member) fail('Member product not found.', 404);
  if (!member.productionPacketId) return { ...member, id };
  const packet = (await db.collection('productPackets').doc(member.productionPacketId).get()).data();
  if (!packet || packet.memberId !== member.memberId || packet.memberPacketId !== id) fail('Member product is not connected to its production packet.');
  const price = packet.pricing?.customerPrice;
  const master = (await db.collection('master_catalog').doc(packet.sourceMasterId).get()).data();
  const sizes = Object.values(master?.qrgVariants || {}).map((v: any) => v.sizeLabel);
  const availableSizes = catalogSaleVariants({ enabledColors: [packet.selectedColor], enabledSizes: sizes }, master, packet.fulfillmentProvider).map(v => v.size);
  return { ...packet, ...member, id, availableSizes, name: packet.title, price, retailPrice: price,
    qrGraphic: packet.qrOnlyUrl, productGraphic: packet.compositeUrl, urlGraphic: packet.landingPageBackgroundUrl,
    background: packet.landingPageBackgroundUrl, videoUrl: packet.playMediaUrl,
    destinationUrl: packet.qrContent, itemImage: packet.mockupUrl || packet.compositeUrl,
    thumbnailUrl: packet.mockupUrl || packet.compositeUrl,
    socialPacket: { title: packet.title, description: packet.description, retailPrice: price,
      itemImage: packet.mockupUrl || packet.compositeUrl, shareUrl: `${resolveRuntimeConfig().origin}/p/${id}` } };
}
