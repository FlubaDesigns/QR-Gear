import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('resend', () => ({ Resend: class { emails = { send }; } }));
import { sendOrderConfirmation, sendShippingNotification, sendActivationEmail } from '../email';
function database(templates: any[] = []) {
  const add = vi.fn().mockResolvedValue({ id: 'log' });
  const get = vi.fn().mockResolvedValue({ size: templates.length, docs: templates.map((data, i) => ({ id: String(i), data: () => data })) });
  const collection = vi.fn((name: string) => name === 'email_templates' ? { where: vi.fn(() => ({ get })) } : { add });
  return { db: { collection } as unknown as Firestore, add };
}
const confirm = (db: Firestore, resend = false) => sendOrderConfirmation(db, 'order12345', 'customer@example.com', '<Dave>', [{ productName: 'Tee & QR', quantity: 2, price: '12.00' }], '24.00', undefined, { resend });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('QR_RESEND_API_KEY', 're_test_not_real');
  send.mockResolvedValue({ data: { id: 'accepted' }, error: null });
});
describe('transactional email', () => {
  it('sends an escaped default confirmation and records the existing log schema', async () => {
    const { db, add } = database();
    expect(await confirm(db)).toEqual({ success: true });
    expect(send.mock.calls[0][0].html).toContain('&lt;Dave&gt;');
    expect(send.mock.calls[0][0].text).toContain('Tee & QR × 2 — $12.00');
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'order_confirmation', recipientEmail: 'customer@example.com', status: 'sent', resendId: 'accepted', orderId: 'order12345' }));
  });
  it('renders the Email page template with escaped HTML variables', async () => {
    const { db } = database([{ subject: 'Order {{orderNumber}}', htmlContent: '<p>{{customerName}}: {{items}}</p>', textContent: '{{customerName}}', isEnabled: true }]);
    await confirm(db);
    expect(send.mock.calls[0][0]).toMatchObject({ subject: 'Order ORDER123', html: '<p>&lt;Dave&gt;: Tee &amp; QR × 2 — $12.00</p>', text: '<Dave>' });
  });
  it.each([[{ isEnabled: false }, 'disabled'], [{ subject: '{{unknown}}', htmlContent: 'x' }, 'Unknown email template variable']])('honors disabled templates and rejects invalid variables', async (template, reason) => {
    const { db, add } = database([template]);
    expect(await confirm(db)).toMatchObject({ success: false, reason: expect.stringContaining(reason) });
    expect(send).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
  it('rejects ambiguous templates', async () => {
    const { db } = database([{}, {}]);
    expect(await confirm(db)).toMatchObject({ success: false, reason: expect.stringContaining('Multiple templates') });
    expect(send).not.toHaveBeenCalled();
  });
  it('reports provider errors and missing configuration', async () => {
    const { db, add } = database(); send.mockResolvedValue({ data: null, error: { message: 'Rejected' } });
    expect(await confirm(db)).toEqual({ success: false, reason: 'Rejected' });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', errorMessage: 'Rejected' }));
    vi.stubEnv('QR_RESEND_API_KEY', '');
    expect(await confirm(db)).toEqual({ success: false, reason: 'Resend is not configured' });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('protects automatic sends while allowing explicit resends', async () => {
    const { db } = database(); await confirm(db); await confirm(db); await confirm(db, true); await confirm(db, true);
    const keys = send.mock.calls.map(call => call[1].idempotencyKey);
    expect(keys[0]).toBe(keys[1]); expect(keys[2]).not.toBe(keys[0]); expect(keys[3]).not.toBe(keys[2]);
  });
  it('includes shipping details without unsafe tracking links', async () => {
    const { db } = database();
    expect(await sendShippingNotification(db, 'order1', 'customer@example.com', 'Dave', 'track1', 'UPS', 'javascript:alert(1)')).toEqual({ success: true });
    expect(send.mock.calls[0][0].text).toContain('Tracking: track1'); expect(send.mock.calls[0][0].html).not.toContain('javascript:');
  });
  it('keeps an accepted email successful even when logging fails', async () => {
    const { db, add } = database(); add.mockRejectedValue(new Error('offline'));
    expect(await confirm(db)).toEqual({ success: true }); expect(send).toHaveBeenCalledTimes(1);
  });
  it('does not report activation errors as success', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'Rejected' } });
    expect(await sendActivationEmail({ customerEmail: 'customer@example.com', customerName: 'Dave', activationCode: 'test', productName: 'Tee', orderId: 'order1' })).toBe(false);
  });
});
