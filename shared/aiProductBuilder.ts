/** AI proposes edits to the existing build snapshot; never a second product. */
/** One rulebook feeds both the admin Rules tab and every AI build prompt. */
export const AI_BUILD_RULES = [
  'Customer-facing shirt titles and descriptions must use QR Gear branding. Do not advertise the blank manufacturer (including Bella + Canvas) or its model number in customer copy. Keep exact supplier identities and model numbers in the internal QRG and fulfillment configuration.',
  'For QR Play, verify the saved video appears in the product gallery destination slot as a playable video or a visible still with a play control. An empty landing-page snapshot is not a valid video preview. Keep model photos, shirt artwork and the standalone QR in their existing order, and verify the phone preview separately.',
  'Operate the existing Products build system. Read its current implementation and trace the saved build through preview, Generate, provider handoff and store display before proposing code changes. Reuse existing calculations and schema services; do not invent a second sizing formula, renderer, product record or build path.',
  'Resume the existing saved build when continuing work. The same captured build inputs must drive preview and generated print artwork. Product dimensions and variant mappings come from QRG; layout belongs to BLD, assets to GRF, bindings to Assembly, and the completed offer to the packet. Keep those responsibilities intact.',
  'For a new product based on a completed reference, use the existing Save as New action and resume that separate draft. Preserve the reference product. Verify the destination role, store, channel and collection after cloning or resuming. A draft name is not the store title: update and verify the product title, description and subject-specific content separately before Generate. Save before changing catalog browsing context or leaving the builder.',
  'QRG tables are the only source for product blanks, colors, sizes, blank images and product specifications.',
  'Never read Printify or Printful tables or query their APIs to select or describe a blank, including as a fallback.',
  'If a required value is missing, request it through QRG table logic. Only that logic may import from provider tables. Read and use the resulting value from QRG; never bypass QRG or invent a value.',
  'Use only actual color and size combinations recorded in QRG. Keep the existing QRG identity and the canonical BLD, GRF and Assembly records.',
  'For every build type, verify physical print size before calling a design print-ready. Read the exact blank, print method, placement and offered size variants through QRG. Record printable width and height in inches, file pixels and required DPI, including any smaller-size restrictions. Cached, generic or fallback placement dimensions are not proof of provider support. Refresh missing specifications through QRG table logic and leave the build as a draft if they remain unverified; never query provider catalogs directly.',
  'Compare the generated artwork dimensions and actual placed width and height with the verified QRG print area and safe area, then confirm the saved provider handoff uses those same dimensions. A large screen preview, an upscaled raster, a nominal DPI label or a returned mockup alone does not establish print quality or support for every offered shirt size. Recheck the real QR at the smallest supported physical output size, preserving its clear border, and report any unverified physical scan check honestly.',
  'Use the Layout design-size control to scale the entire shirt composition, including its QR, quote and signature, rather than shrinking only the background image. Medium uses five-sixths of the verified print-area dimensions (10 by 13.33 inches inside a 12 by 16 inch area); Small uses two-thirds and Large uses the full available area. Prefer Medium for this quote series unless the owner asks otherwise. The exported file retains full print-area dimensions with transparent margins; do not apply another reduction at provider handoff. Keep biography-page sizing independent.',
  'Find existing artwork in Library, including its Cropped tab, and visually identify the asset rather than guessing from a GRF number. Verify it exists in the target environment; a Main asset is not automatically available in sandbox. If the user supplies a missing image, upload it through the existing Library source/crop flow, preserve the complete subject and title inside the crop, and select the resulting GRF asset. Check actual file format if upload reports a format mismatch; do not recreate or alter the image merely to correct its filename extension.',
  'Treat supplied font sizes, weights, spacing, scales and position percentages as starting suggestions unless the admin explicitly locks a value. Adapt them to the actual subject, artwork, background and available space; never hard-code one subject\'s final adjustments as defaults for other builds.',
  'Keep text readable and within its background or print area. Adjust size, line breaks, spacing and position to avoid clipping, collisions, and covering important artwork such as a seal, logo, face or emblem. Preserve the intended wording and visual hierarchy; explain material adjustments.',
  'For Armed Forces builds, use this content methodology in order: EST. MONTH DAY, YEAR; UNITED STATES / BRANCH NAME; MOTTO; TRANSLATION OR MEANING; ROLE / PURPOSE; LEGACY. This is reusable build guidance, not text to insert into an individual page. Fill the outline with the subject-specific supplied or verified facts, adapt layout to the actual artwork, and never publish the placeholder labels as finished content.',
  'For Founding Fathers quote builds, make a recognizable historical portrait of the quoted person the primary subject of the shirt; keep symbolic artwork such as trees or scales faintly behind the QR biography instead. Use Palette artwork with a small USA 250 emblem at upper left, a verified quotation in readable calligraphy, and a dash followed by a reproduction of the historical signature at lower right. Use a 25% Palette QR as the starting proportion for this quote series, preserve its clear border, and verify that the finished graphic decodes to the intended biography; increase the QR size when needed for readability. Reserve clear space for the actual generated QR. The QR page should identify the person, birth and death dates, key accomplishments, and the quotation source. Adapt each layout to its content rather than copying fixed positions.',
  'For the quote-series biography, use the approved symbolic background (for example, Jefferson’s tree or Franklin’s scales) faintly behind high-contrast text. Include the person\'s role, birth and death dates and places, and several specific, verified achievements with useful dates and quotation attribution. Use the owner\'s approved patriotic, achievement-focused presentation while preserving historical accuracy. Remove all copied reference names, signatures, dates, sources and biography text. Keep enough space below the quote for the separate historical signature and real QR when adjusting its position.',
  'Inline uploaded builder layers must be decoded and registered as GRF image bytes before catalog commit; never query Firestore with a base64 data URL. If artifacts exist but catalog registration fails, fix the registration path and retry the same packet rather than creating duplicate products.',
  'When adapting a reference, replace every subject-specific text block and remove stale reference copy. Do not invent missing blurbs or duplicate titles already baked into the background. Rebalance spacing for the supplied copy instead of reserving empty blocks from the previous subject.',
  'Inspect the actual rendered shirt graphic and QR landing-page previews separately. Confirm fit at phone viewing size and keep the QR clear and scannable before using the existing Products Generate workflow for the store output. Do not claim visual fit from numeric settings alone; if a preview cannot be inspected, state that limitation.',
  'When an existing product is named as the reference, open and inspect its actual shirt and URL images before adapting the build. Keep the shirt print canvas, shirt mockup and URL canvas distinct; never infer one canvas size or layout from another.',
  'Run the existing Products Generate action to produce the store artifacts. Send that saved placement artwork through the provider mockup handoff using the saved QRG color, placement and print dimensions, including in the sandbox. A real provider mockup must return and be attached to the same packet before the shirt preview is complete. Artwork on a colored rectangle, a blank catalog photo, a queued job, or a saved packet is not a completed shirt mockup.',
  'Verify the returned shirt mockup against the saved build and verify the store reads that packet. Report provider failures exactly and leave the mockup step incomplete. Never claim a handoff succeeded without the returned result. If your available tools cannot inspect code, operate Generate or verify a mockup, say which step remains unverified rather than improvising another build.',
  'Completion includes the full generated gallery: returned mockups for the saved QRG color, shirt artwork, standalone QR and landing-page proof. Confirm each generated image remains accessible after mockups arrive, the QR opens this new product\'s landing URL, and the store title and QR product type match the saved build. Share verified store and landing links. Add discovered workflow gaps to this same rulebook so the next build follows the corrected process.',
] as const;
export const AI_PRODUCT_FIELDS = {
  title: { label: 'Product title', path: ['title'], max: 140 },
  description: { label: 'Product description', path: ['description'], max: 5000 },
  headerText: { label: 'Graphic header', path: ['graphics', 'content', 'headerStyle', 'text'], max: 200 },
  footerText: { label: 'Graphic footer', path: ['graphics', 'content', 'footerStyle', 'text'], max: 200 },
  graphicLayoutMode: { label: 'Graphic layout', path: ['graphics', 'content', 'graphicLayoutMode'], values: ['zone', 'freeform'] },
} as const;
export type AiProductField = keyof typeof AI_PRODUCT_FIELDS;
export interface AiProductProposal { message: string; changes: Partial<Record<AiProductField, string>>; }
export interface AiProductRequest {
  idempotencyKey: string; prompt: string; brainPrompt: string; base: string;
  requestId?: string; status: 'submitting' | 'pending' | 'ready' | 'failed';
  proposal?: AiProductProposal; error?: string;
}
export function aiProductValues(working: any): Record<AiProductField, string> {
  return Object.fromEntries(Object.entries(AI_PRODUCT_FIELDS).map(([key, field]) => [key,
    field.path.reduce((value: any, segment) => value?.[segment], working) ?? '',
  ])) as Record<AiProductField, string>;
}
export function aiProductContext(working: any): string {
  return JSON.stringify({ product: working.metadata?.selectedProductDocId ?? null,
    provider: working.metadata?.fulfillmentProvider ?? null, qrType: working.qrConfig?.qrProductState ?? null,
    color: working.qrConfig?.selectedColor?.name ?? null, placements: working.layoutConfig?.selectedPlacements ?? [],
    ...aiProductValues(working) });
}
export function validateAiProductProposal(input: any): AiProductProposal {
  if (typeof input === 'string') {
    if (input.length > 14000) throw new Error('AI response is too large.');
    input = JSON.parse(input.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
  }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['message', 'changes'].includes(key)) ||
      typeof input.message !== 'string' || !input.message.trim() || input.message.length > 3000 ||
      !input.changes || typeof input.changes !== 'object' || Array.isArray(input.changes)) throw new Error('AI returned an invalid product proposal.');
  const changes: AiProductProposal['changes'] = {};
  for (const [key, value] of Object.entries(input.changes)) {
    if (!Object.prototype.hasOwnProperty.call(AI_PRODUCT_FIELDS, key)) throw new Error(`AI cannot change ${key}.`);
    const field = AI_PRODUCT_FIELDS[key as AiProductField];
    if (typeof value !== 'string' || ('max' in field && value.length > field.max) || ('values' in field && !(field.values as readonly string[]).includes(value))) throw new Error(`Invalid AI value for ${field.label}.`);
    changes[key as AiProductField] = value;
  }
  return { message: input.message, changes };
}
export function applyAiProductProposal(working: any, proposal: AiProductProposal, base: string) {
  if (aiProductContext(working) !== base) throw new Error('This build changed after the AI request. Ask again using the current build.');
  const checked = validateAiProductProposal(proposal);
  const next = JSON.parse(JSON.stringify(working));
  for (const [key, value] of Object.entries(checked.changes)) {
    const path = AI_PRODUCT_FIELDS[key as AiProductField].path;
    let target = next;
    for (const part of path.slice(0, -1)) target = target[part] ||= {};
    target[path[path.length - 1]] = value;
    if (key === 'headerText' || key === 'footerText') { target.enabled = !!value; target.mode = 'text'; }
  }
  if (checked.changes.title !== undefined) next.titleSource = 'manual';
  if (checked.changes.description !== undefined) { next.descriptionSource = 'manual'; next.adminCatalogDescription = next.description; }
  return next;
}
export function aiProductPrompt(prompt: string, working: any, previous?: AiProductProposal): string {
  return `Help the admin create a QR Gear product. Mandatory build rules: ${JSON.stringify(AI_BUILD_RULES)}. Return only JSON matching {"message":"explanation or a clarifying question","changes":{}}. Allowed changes and limits: ${JSON.stringify(AI_PRODUCT_FIELDS)}. Omit fields that should remain unchanged. Ask a question with empty changes if details are missing. Do not invent product facts, prices, IDs, media, URLs or provider capabilities. Do not publish or execute code. The admin reviews changes before applying them to the existing draft. Product context: ${aiProductContext(working)}. Previous suggestion: ${JSON.stringify(previous ?? null)}. Admin request: ${prompt}`;
}
