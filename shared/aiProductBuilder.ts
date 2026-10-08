/** AI proposes edits to the existing build snapshot; never a second product. */
/** One rulebook feeds both the admin Rules tab and every AI build prompt. */
export const AI_BUILD_RULES = [
  'Operate the existing Products build system. Read its current implementation and trace the saved build through preview, Generate, provider handoff and store display before proposing code changes. Reuse existing calculations and schema services; do not invent a second sizing formula, renderer, product record or build path.',
  'Resume the existing saved build when continuing work. The same captured build inputs must drive preview and generated print artwork. Product dimensions and variant mappings come from QRG; layout belongs to BLD, assets to GRF, bindings to Assembly, and the completed offer to the packet. Keep those responsibilities intact.',
  'QRG tables are the only source for product blanks, colors, sizes, blank images and product specifications.',
  'Never read Printify or Printful tables or query their APIs to select or describe a blank, including as a fallback.',
  'If a required value is missing, request it through QRG table logic. Only that logic may import from provider tables. Read and use the resulting value from QRG; never bypass QRG or invent a value.',
  'Use only actual color and size combinations recorded in QRG. Keep the existing QRG identity and the canonical BLD, GRF and Assembly records.',
  'Treat supplied font sizes, weights, spacing, scales and position percentages as starting suggestions unless the admin explicitly locks a value. Adapt them to the actual subject, artwork, background and available space; never hard-code one subject\'s final adjustments as defaults for other builds.',
  'Keep text readable and within its background or print area. Adjust size, line breaks, spacing and position to avoid clipping, collisions, and covering important artwork such as a seal, logo, face or emblem. Preserve the intended wording and visual hierarchy; explain material adjustments.',
  'Inspect the actual rendered shirt graphic and QR landing-page previews separately. Confirm fit at phone viewing size and keep the QR clear and scannable before using the existing Products Generate workflow for the store output. Do not claim visual fit from numeric settings alone; if a preview cannot be inspected, state that limitation.',
  'When an existing product is named as the reference, open and inspect its actual shirt and URL images before adapting the build. Keep the shirt print canvas, shirt mockup and URL canvas distinct; never infer one canvas size or layout from another.',
  'Run the existing Products Generate action to produce the store artifacts. Send that saved placement artwork through the provider mockup handoff using the saved QRG color, placement and print dimensions, including in the sandbox. A real provider mockup must return and be attached to the same packet before the shirt preview is complete. Artwork on a colored rectangle, a blank catalog photo, a queued job, or a saved packet is not a completed shirt mockup.',
  'Verify the returned shirt mockup against the saved build and verify the store reads that packet. Report provider failures exactly and leave the mockup step incomplete. Never claim a handoff succeeded without the returned result. If your available tools cannot inspect code, operate Generate or verify a mockup, say which step remains unverified rather than improvising another build.',
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
