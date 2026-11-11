import { buildPacketImageOrder, packetLeadColor } from '../../../shared/productImages';

/**
 * Convert a productPackets.mockupsByColor nested structure into the flat frontend format.
 *
 * Stored format in Firestore:
 *   { [colorKey]: { [placementKey]: { [sizeKey]: url, lifestyle: url } } }
 *
 * Returned format for the frontend:
 *   { [colorKey]: { lifestyle?, front?, angles?: string[] } }
 *
 * Also returns an ordered `mockupImages` array built from the first (default) color:
 *   [front, lifestyle, ...other placements]
 * and the `defaultColor` key so the API can advertise which color is pre-selected.
 */
export function extractPacketMockups(pkt: Record<string, any>): {
  mockupsByColor: Record<string, { lifestyle?: string; front?: string; angles?: string[] }> | null;
  mockupImages: string[];
  defaultColor: string | null;
} {
  const raw = pkt.mockupsByColor;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { mockupsByColor: null, mockupImages: buildPacketImageOrder(pkt), defaultColor: null };
  }

  const result: Record<string, { lifestyle?: string; front?: string; angles?: string[] }> = {};

  for (const [colorKey, placementsRaw] of Object.entries(raw)) {
    if (!placementsRaw || typeof placementsRaw !== 'object') continue;
    const placements = placementsRaw as Record<string, any>;
    const colorEntry: { lifestyle?: string; front?: string; angles: string[] } = { angles: [] };

    for (const [placementKey, sizeDataRaw] of Object.entries(placements)) {
      if (!sizeDataRaw || typeof sizeDataRaw !== 'object') continue;
      const sizeData = sizeDataRaw as Record<string, any>;

      if (sizeData.lifestyle && !colorEntry.lifestyle) {
        colorEntry.lifestyle = sizeData.lifestyle;
      }

      const mockupUrl = Object.entries(sizeData)
        .filter(([k]) => k !== 'lifestyle')
        .map(([, v]) => v as string)
        .find((v) => typeof v === 'string' && v.startsWith('http'));

      if (mockupUrl) {
        const isFront = ['front', 'front-center', 'chest', 'front_center'].includes(placementKey);
        if (isFront && !colorEntry.front) {
          colorEntry.front = mockupUrl;
        } else if (!isFront) {
          colorEntry.angles.push(mockupUrl);
        }
      }
    }

    if (colorEntry.lifestyle || colorEntry.front || colorEntry.angles.length > 0) {
      result[colorKey] = colorEntry;
    }
  }

  if (Object.keys(result).length === 0) {
    return { mockupsByColor: null, mockupImages: buildPacketImageOrder(pkt), defaultColor: null };
  }

  const savedLeadColor = packetLeadColor(pkt);
  const defaultColor = savedLeadColor && result[savedLeadColor] ? savedLeadColor : Object.keys(result)[0];
  const first = result[defaultColor];
  const mockupImages: string[] = [];
  if (first.front) mockupImages.push(first.front);
  if (first.lifestyle) mockupImages.push(first.lifestyle);
  (first.angles || []).forEach((u) => mockupImages.push(u));

  return { mockupsByColor: result, mockupImages: buildPacketImageOrder(pkt, mockupImages), defaultColor };
}

