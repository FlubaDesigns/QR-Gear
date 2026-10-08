/** AI proposes edits to the existing build snapshot; never a second product. */
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
  return `Help the admin create a QR Gear product. Return only JSON matching {"message":"explanation or a clarifying question","changes":{}}. Allowed changes and limits: ${JSON.stringify(AI_PRODUCT_FIELDS)}. Omit fields that should remain unchanged. Ask a question with empty changes if details are missing. Do not invent product facts, prices, IDs, media, URLs or provider capabilities. Do not publish or execute code. The admin reviews changes before applying them to the existing draft. Product context: ${aiProductContext(working)}. Previous suggestion: ${JSON.stringify(previous ?? null)}. Admin request: ${prompt}`;
}
