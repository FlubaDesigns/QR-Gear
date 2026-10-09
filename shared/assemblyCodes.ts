import { BLD_VEHICLES, type BldInstanceType } from './bldCodes';
import { isValidGrfId, parseGrfId } from './GRF_engine';
/**
 * Assembly ID utilities — shared between frontend and backend.
 *
 * ID format: ASM-NNNNNN  (6-digit zero-padded sequence)
 * Example:   ASM-000001
 * Regex:     ^ASM-\d{6}$
 *
 * Minted atomically from Firestore counter: asm_counters/global { count: N }
 */

export const ASM_COUNTER_KEY = 'global';
export const ASM_ID_REGEX    = /^ASM-\d{6}$/;

/** Returns true when id matches the canonical ASM-NNNNNN format. */
export function isValidAssemblyId(id: string): boolean {
  return ASM_ID_REGEX.test(id) && Number(id.slice(4)) > 0;
}

/** Returns the numeric sequence embedded in an assembly ID, or null if malformed. */
export function parseAssemblyId(id: string): { sequence: number } | null {
  if (!isValidAssemblyId(id)) return null;
  return { sequence: parseInt(id.slice(4), 10) };
}

export type MappingType = BldInstanceType;

export interface AssemblyMapping {
  seq:    string;          // two-digit zero-padded: "01"–"99"
  type:   MappingType;
  grfId?: string;          // asset slots: img, qrc, vid, doc
  value?: string;          // text slots: txt, act  (also vid/doc when external URL)
  color?: string;          // optional text color override (hex)
}

export interface BldSlot {
  seq:       string;
  type:      string;
  required?: boolean;
}

const VALID_TYPES = new Set<string>(Object.keys(BLD_VEHICLES));

/**
 * Validate an assembly mappings array.
 * Pass bldSlots to cross-validate completeness against a BLD definition.
 * Returns a human-readable error string, or null if valid.
 */
export function validateAssemblyMappings(
  mappings: AssemblyMapping[],
  bldSlots?: BldSlot[],
): string | null {
  if (!Array.isArray(mappings)) return 'mappings must be an array';

  for (const m of mappings) {
    if (!m || typeof m !== 'object') return 'mapping must be an object';
    for (const key of Object.keys(m)) if (!['seq', 'type', 'value', 'color', 'grfId'].includes(key)) return `mapping field ${key} is not allowed`;
    if (!m.seq || !/^0[1-9]$/.test(m.seq)) {
      return `seq must match a BLD slot from "01" to "09" — got: ${JSON.stringify(m.seq)}`;
    }
    if (!m.type || !VALID_TYPES.has(m.type)) {
      return `type must be one of: txt, img, qrc, act, vid, doc — got: ${JSON.stringify(m.type)}`;
    }
    if ((m.type === 'txt' || m.type === 'act') && !m.value) {
      return `seq ${m.seq} type "${m.type}" requires a non-empty value`;
    }
    if ((m.type === 'img' || m.type === 'qrc') && !m.grfId) {
      return `seq ${m.seq} type "${m.type}" requires a grfId`;
    }
    if ((m.type === 'vid' || m.type === 'doc') && !m.grfId && !m.value) {
      return `seq ${m.seq} type "${m.type}" requires either grfId or value (URL)`;
    }
  }

  for (const m of mappings) {
    if (m.grfId) {
      if (!isValidGrfId(m.grfId)) return `slot ${m.seq}: invalid GRF ID`;
      const p = parseGrfId(m.grfId);
      if (['img', 'qrc'].includes(m.type) && p.mediaType !== '1') return `slot ${m.seq} requires an image GRF`;
      if (m.type === 'qrc' && !(p.assetClass === '2' && p.channel === '1' && p.purpose === '2')) return `slot ${m.seq} requires a standalone QR GRF`;
      if (m.type === 'img' && !['1:1','2:1','2:2','2:3','3:2','4:1','4:2','4:3','4:4'].includes(`${p.channel}:${p.purpose}`)) return `slot ${m.seq}: incompatible image GRF`;
      if (m.type === 'vid' && p.mediaType !== '2') return `slot ${m.seq} requires a video GRF`;
      if (m.type === 'doc' && p.mediaType !== '3') return `slot ${m.seq} requires a document GRF`;
      if (['txt','act'].includes(m.type)) return `slot ${m.seq}: text cannot bind a GRF`;
    }
    if (m.color !== undefined && (typeof m.color !== 'string' || !/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(m.color))) return `slot ${m.seq}: color must be a hex color`;
    if (['vid','doc'].includes(m.type) && m.grfId && m.value) return `slot ${m.seq}: choose a GRF or an external URL, not both`;
    if (m.value !== undefined && (typeof m.value !== 'string' || !m.value.trim())) return `slot ${m.seq}: value must be nonempty text`;
    if (['img','qrc'].includes(m.type) && m.value !== undefined) return `slot ${m.seq}: image content belongs in GRF`;
    if (['vid','doc'].includes(m.type) && m.value && !/^https:\/\//.test(m.value)) return `slot ${m.seq}: external media requires an HTTPS URL`;
  }
  const seqs = mappings.map((m) => m.seq);
  if (new Set(seqs).size !== seqs.length) {
    return 'seq values must be unique within an assembly';
  }

  // Cross-validate required BLD slots when provided
  if (seqs.some((s, i) => i > 0 && s <= seqs[i - 1])) return 'mappings must follow BLD sequence order';
  if (bldSlots) {
    for (const m of mappings) {
      const slot = bldSlots.find(s => s.seq === m.seq);
      if (!slot) return `mapping ${m.seq} has no BLD slot`;
      if (slot.type !== m.type) return `mapping ${m.seq} type does not match BLD slot ${slot.type}`;
    }
    for (const slot of bldSlots) {
      if (slot.required !== false) {
        const filled = mappings.some((m) => m.seq === slot.seq);
        if (!filled) {
          return `required BLD slot ${slot.seq} (${slot.type}) has no mapping`;
        }
      }
    }
  }

  return null;
}
