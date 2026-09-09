import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import {
  campPaymentTitle,
  documentOf,
  mergePaymentItems,
  paymentCardDate,
  paymentInvoiceState,
} from '@/lib/payments';

describe('mergePaymentItems', () => {
  it('lists camp registrations alongside lesson bookings, newest first', () => {
    const items = mergePaymentItems(
      [{ id: 'b1', created_at: '2026-09-01T10:00:00Z', lesson_name: 'Adult' }],
      [{ id: 'c1', created_at: '2026-09-08T10:00:00Z', camp_name: 'Mini Week 1' }],
    );
    expect(items.map((item) => item.kind)).toEqual(['camp', 'lesson']);
    expect(items[0].id).toBe('c1');
    expect(items[1].id).toBe('b1');
  });

  it('does not drop lesson rows when camps are empty', () => {
    const items = mergePaymentItems([{ id: 'b1', created_at: '2026-09-01T10:00:00Z' }], []);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('lesson');
  });
});

describe('paymentInvoiceState', () => {
  it('treats camp pending_payment as awaiting payment and confirmed as paid', () => {
    expect(paymentInvoiceState({ status: 'pending_payment', payment_status: 'pending' })).toBe('pending');
    expect(paymentInvoiceState({ status: 'confirmed', payment_status: 'confirmed' })).toBe('paid');
    expect(paymentInvoiceState({ status: 'cancelled', payment_status: 'cancelled' })).toBe('cancelled');
  });
});

describe('campPaymentTitle', () => {
  it('keeps the invoice associated with the camp and child', () => {
    expect(campPaymentTitle({
      camp_name: 'Mini Week 1',
      child_first_name: 'Mia',
      child_last_name: 'Parent',
    })).toBe('Mini Week 1 · Mia Parent');
  });
});

describe('documentOf', () => {
  it('reads the first nested billing document', () => {
    expect(documentOf({ billing_documents: [{ document_nr: 'RE-1' }] }).document_nr).toBe('RE-1');
  });
});

describe('paymentCardDate', () => {
  it('formats created_at when booking_date is null and does not render N/A', () => {
    const created = '2026-09-06T10:00:00Z';
    const label = paymentCardDate({ created_at: created, booking_date: null });
    expect(label).toBe(format(new Date(created), 'dd MMM yyyy'));
    expect(label).not.toBe('N/A');
  });

  it('uses created_at for Camp rows instead of camp_start_date', () => {
    const created = '2026-09-08T10:00:00Z';
    expect(paymentCardDate({
      created_at: created,
      camp_start_date: '2026-10-05',
    })).toBe(format(new Date(created), 'dd MMM yyyy'));
  });

  it('returns N/A only when created_at is missing', () => {
    expect(paymentCardDate({ booking_date: '2026-09-01' })).toBe('N/A');
  });
});
