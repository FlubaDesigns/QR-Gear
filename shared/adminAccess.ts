/** Server-side admin policy. Never infer authorization from missing configuration. */
export function configuredAdminIds(value: string | undefined): string[] {
  return (value || '').split(',').map(id => id.trim()).filter(Boolean);
}

export function hasAdminAccess(uid: string | undefined, profile: { isAdmin?: unknown } | undefined, ownerIds: readonly string[]): boolean {
  return !!uid && (profile?.isAdmin === true || ownerIds.includes(uid));
}
