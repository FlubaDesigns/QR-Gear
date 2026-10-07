import type { QueryClient } from "@tanstack/react-query";
import {
  GRF_FILTER_ORIGINALS,
  GRF_FILTER_CROPPED,
  GRF_FILTER_BACKGROUNDS,
  GRF_FILTER_TEMPLATES,
} from '@shared/GRF_engine';

export const ORIGINALS_QK   = ['admin', 'graphics', GRF_FILTER_ORIGINALS.channel,   GRF_FILTER_ORIGINALS.purpose]   as const;
export const CROPPED_QK     = ['admin', 'graphics', GRF_FILTER_CROPPED.channel,     GRF_FILTER_CROPPED.purpose]     as const;
export const BACKGROUNDS_QK = ['admin', 'graphics', GRF_FILTER_BACKGROUNDS.channel, GRF_FILTER_BACKGROUNDS.purpose] as const;
export const TEMPLATES_QK   = ['admin', 'graphics', GRF_FILTER_TEMPLATES.channel,   GRF_FILTER_TEMPLATES.purpose]   as const;

export const GRAPHICS_QK = ["library", "/api/admin", "assets", "grf"] as const;

/** A server commit can register printed images, a BLD and an Assembly together. */
export function refreshBuildLibrary(client: QueryClient) {
  return Promise.all([
    GRAPHICS_QK, ORIGINALS_QK, CROPPED_QK, BACKGROUNDS_QK, TEMPLATES_QK,
    ['/api/admin/bld'], ['/api/admin/assemblies'],
  ].map(queryKey => client.invalidateQueries({ queryKey })));
}
