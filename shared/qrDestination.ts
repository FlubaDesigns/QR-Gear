/** Basic and Plus encode content directly; hosted tiers resolve a published experience. */
export function isHostedQrType(type: string | null | undefined) {
  return ['qr_canvas', 'qr_play', 'qr_compose'].includes(type || '');
}
export function buildQrDestination(type: string | null, content: string, hostedUrl: string) {
  const value = (isHostedQrType(type) ? hostedUrl : content).trim();
  if (!value) throw new Error('Enter the QR destination or text before creating graphics.');
  return value;
}
