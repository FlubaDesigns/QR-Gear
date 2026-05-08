import {
  GRF_FILTER_ORIGINALS,
  GRF_FILTER_CROPPED,
  GRF_FILTER_BACKGROUNDS,
} from "./GRF_engine";

export const ORIGINALS_QK   = ["admin-graphics", "channel", GRF_FILTER_ORIGINALS.channel,   "purpose", GRF_FILTER_ORIGINALS.purpose];
export const CROPPED_QK     = ["admin-graphics", "channel", GRF_FILTER_CROPPED.channel,     "purpose", GRF_FILTER_CROPPED.purpose];
export const BACKGROUNDS_QK = ["admin-graphics", "channel", GRF_FILTER_BACKGROUNDS.channel, "purpose", GRF_FILTER_BACKGROUNDS.purpose];

export function invalidateGrfQueries(invalidateFn: (qk: string[]) => void) {
  invalidateFn(ORIGINALS_QK);
  invalidateFn(CROPPED_QK);
  invalidateFn(BACKGROUNDS_QK);
}
