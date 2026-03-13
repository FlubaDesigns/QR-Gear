import { Request } from 'express';
import { db } from '../core';
import {
  BUILDER_HOSTS_COLLECTION,
  BUILDER_PROFILES_COLLECTION,
  BUILDER_PLACEMENTS_COLLECTION,
  PRICING_POLICIES_COLLECTION,
  REVENUE_SPLITS_COLLECTION,
  SURFACES_COLLECTION,
  SURFACE_VARIANTS_COLLECTION,
} from '../constants';
import { computePricingSnapshot, checkSurfaceReadiness } from '../../../shared/surfaces';
import type { PricingSnapshot } from '../../../shared/surfaces';

interface BuilderPermissionScope {
  allowHeaderText: boolean;
  allowHeaderImage: boolean;
  allowFooterText: boolean;
  allowFooterImage: boolean;
  allowCenterGraphic: boolean;
  allowQrModeSwitch: boolean;
  allowUpload: boolean;
  allowAssetLibrary: boolean;
  allowProductChange: boolean;
  allowVariantChange: boolean;
  allowSaveDraft: boolean;
  allowBuyNow: boolean;
}

export const DEFAULT_BUILDER_PERMISSIONS: BuilderPermissionScope = {
  allowHeaderText: true,
  allowHeaderImage: false,
  allowFooterText: true,
  allowFooterImage: false,
  allowCenterGraphic: true,
  allowQrModeSwitch: false,
  allowUpload: false,
  allowAssetLibrary: true,
  allowProductChange: false,
  allowVariantChange: true,
  allowSaveDraft: false,
  allowBuyNow: true,
};

export function extractRequestDomain(req: Request): string | null {
  const origin = req.headers.origin;
  if (origin) {
    try {
      return new URL(typeof origin === 'string' ? origin : origin[0]).hostname;
    } catch { /* ignore */ }
  }
  const referer = req.headers.referer;
  if (referer) {
    try { return new URL(referer).hostname; } catch { /* ignore */ }
  }
  return null;
}

export function isDomainAllowed(requestDomain: string | null, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  if (!requestDomain) return false;
  const norm = requestDomain.toLowerCase().replace(/^www\./, '');
  return allowedDomains.some(d => {
    const allowed = d.toLowerCase().replace(/^www\./, '');
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(2);
      return norm === suffix || norm.endsWith('.' + suffix);
    }
    return norm === allowed;
  });
}

export interface EmbedValidationResult {
  valid: boolean;
  error?: string;
  placement?: any;
  host?: any;
  profile?: any;
  surface?: any;
  variants?: any[];
  pricingPolicy?: any;
  revenueSplit?: any;
  affiliateUserId?: string;
  affiliateSource?: 'placement' | 'host_owner' | 'profile' | 'none';
}

export async function validateEmbedContext(
  placementId: string,
  req: Request,
  opts: { requireSurface?: boolean; requireReadiness?: boolean } = {}
): Promise<EmbedValidationResult> {
  const placementDoc = await db.collection(BUILDER_PLACEMENTS_COLLECTION).doc(placementId).get();
  if (!placementDoc.exists) return { valid: false, error: 'Placement not found' };
  const placement = { id: placementDoc.id, ...placementDoc.data() } as any;
  if (placement.status !== 'active') return { valid: false, error: 'Placement is not active' };

  const hostDoc = await db.collection(BUILDER_HOSTS_COLLECTION).doc(placement.builderHostId).get();
  if (!hostDoc.exists) return { valid: false, error: 'Host not found' };
  const host = { id: hostDoc.id, ...hostDoc.data() } as any;
  if (host.status !== 'active') return { valid: false, error: 'Host is not active' };

  const hostHasDomainRestrictions = host.allowedDomains && host.allowedDomains.length > 0;
  const requestDomain = extractRequestDomain(req);

  if (hostHasDomainRestrictions) {
    if (!requestDomain) {
      return { valid: false, error: 'Domain could not be determined from request (missing Origin and Referer headers)' };
    }
    if (!isDomainAllowed(requestDomain, host.allowedDomains)) {
      return { valid: false, error: `Domain '${requestDomain}' is not allowed for this host` };
    }
  }

  let profile: any = null;
  const profileId = placement.builderProfileId || host.defaultBuilderProfileId;
  if (profileId) {
    const profileDoc = await db.collection(BUILDER_PROFILES_COLLECTION).doc(profileId).get();
    if (profileDoc.exists) {
      profile = { id: profileDoc.id, ...profileDoc.data() };
      if (profile.status !== 'active') return { valid: false, error: 'Profile is not active' };
    }
  }

  let surface: any = null;
  let variants: any[] = [];
  if (placement.surfaceId) {
    const surfaceDoc = await db.collection(SURFACES_COLLECTION).doc(placement.surfaceId).get();
    if (surfaceDoc.exists) {
      surface = { id: surfaceDoc.id, ...surfaceDoc.data() };
      if (surface.status === 'archived' || surface.status === 'blocked') {
        return { valid: false, error: 'Surface is not available' };
      }
    }
  }
  if (opts.requireSurface && !surface) return { valid: false, error: 'Placement has no surface configured' };

  if (surface && opts.requireReadiness) {
    const variantsSnap = await db.collection(SURFACE_VARIANTS_COLLECTION)
      .where('surfaceId', '==', surface.id).get();
    variants = variantsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const readiness = checkSurfaceReadiness(surface, variants);
    if (!readiness.ready) {
      return { valid: false, error: `Surface not ready: ${readiness.errors.join(', ')}` };
    }
  }

  let pricingPolicy: any = null;
  const policyId = placement.pricingPolicyId || host.defaultPricingPolicyId;
  if (policyId) {
    const policyDoc = await db.collection(PRICING_POLICIES_COLLECTION).doc(policyId).get();
    if (policyDoc.exists) pricingPolicy = { id: policyDoc.id, ...policyDoc.data() };
  }

  let revenueSplit: any = null;
  const splitId = placement.revenueSplitId || host.defaultRevenueSplitId;
  if (splitId) {
    const splitDoc = await db.collection(REVENUE_SPLITS_COLLECTION).doc(splitId).get();
    if (splitDoc.exists) revenueSplit = { id: splitDoc.id, ...splitDoc.data() };
  }

  let affiliateUserId = '';
  let affiliateSource: 'placement' | 'host_owner' | 'profile' | 'none' = 'none';
  if (placement.affiliateUserId) {
    affiliateUserId = placement.affiliateUserId;
    affiliateSource = 'placement';
  } else if (host.ownerUserId) {
    affiliateUserId = host.ownerUserId;
    affiliateSource = 'host_owner';
  } else if (profile?.affiliateUserId) {
    affiliateUserId = profile.affiliateUserId;
    affiliateSource = 'profile';
  }

  if (revenueSplit && revenueSplit.affiliatePercent > 0 && !affiliateUserId) {
    if (revenueSplit.requireAffiliate !== false) {
      return { valid: false, error: 'Revenue sharing is enabled but no affiliate user could be resolved (checked placement.affiliateUserId, host.ownerUserId, and profile.affiliateUserId)' };
    }
  }

  return { valid: true, placement, host, profile, surface, variants, pricingPolicy, revenueSplit, affiliateUserId, affiliateSource };
}

export function buildPricingFromContext(surface: any, pricingPolicy: any, revenueSplit: any): PricingSnapshot {
  const salePrice = surface?.retailPrice || 0;
  const productCost = surface?.baseCost || 0;
  const affiliatePercent = revenueSplit?.affiliatePercent ?? 25;
  const platformFeeAmount = pricingPolicy?.platformFeeAmount || 0;
  return computePricingSnapshot({
    salePrice, productCost, platformFeeAmount, affiliatePercent,
    currency: pricingPolicy?.currency || 'USD',
  });
}
