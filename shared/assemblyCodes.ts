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
  return ASM_ID_REGEX.test(id);
}

/** Returns the numeric sequence embedded in an assembly ID, or null if malformed. */
export function parseAssemblyId(id: string): { sequence: number } | null {
  if (!isValidAssemblyId(id)) return null;
  return { sequence: parseInt(id.slice(4), 10) };
}

export type MappingType = 'txt' | 'img' | 'qrc' | 'act' | 'vid' | 'doc';

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

const VALID_TYPES = new Set<MappingType>(['txt', 'img', 'qrc', 'act', 'vid', 'doc']);

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
  if (mappings.length === 0)    return 'mappings must contain at least one entry';

  for (const m of mappings) {
    if (!m.seq || !/^\d{2}$/.test(m.seq)) {
      return `seq must be a 2-digit string (e.g. "01") — got: ${JSON.stringify(m.seq)}`;
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

  const seqs = mappings.map((m) => m.seq);
  if (new Set(seqs).size !== seqs.length) {
    return 'seq values must be unique within an assembly';
  }

  // Cross-validate required BLD slots when provided
  if (bldSlots) {
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
