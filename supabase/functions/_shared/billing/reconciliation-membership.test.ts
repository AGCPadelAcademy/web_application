import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { AccountingProvider, ExternalInvoice } from './accounting-provider.ts';
import type { BillingRepo } from './financial-service.ts';
import {
  runReconciliation,
  type ReconcileRepo,
} from './reconciliation-service.ts';
import type { MembershipMoneyDecision } from './membership-collection-policy.ts';

const NOW = new Date('2026-09-01T12:00:00.000Z');
const CONFIG = {
  bexio_user_id: 1,
  currency_id: 1,
  bank_account_id: 2,
  payment_type_id: 3,
  sales_account_id: 9,
  tax_id_sales: 14,
  unit_id: 5,
  mwst_type: 0,
  mwst_is_net: false,
  payment_term_days: 10,
};

function invoice(status: ExternalInvoice['status']): ExternalInvoice {
  return {
    externalId: 'inv-m',
    documentNr: 'RE-M-1',
    status,
    total: 200,
    received: status === 'paid' ? 200 : 0,
    remaining: status === 'paid' ? 0 : 200,
    hasQrPaymentPart: true,
  };
}

Deno.test('paying the month records one signal and does not mark the fee', async () => {
  const applied: Array<{ intentId: string; decision: MembershipMoneyDecision }> = [];
  const fee = { status: 'invoiced', paid: false };
  let monthStatus = 'invoiced';
  let monthSignal = false;
  const repo: ReconcileRepo = {
    listOpenDocuments: async () => [{
      id: 'doc-month',
      booking_id: null,
      camp_registration_id: null,
      membership_period_intent_id: 'intent-month',
      provider: 'bexio',
      external_id: 'inv-m',
      document_nr: 'RE-M-1',
      api_reference: 'agc:membership-period:intent-month',
      status: 'issued',
      total: 200,
      currency: 'CHF',
    }],
    getDocument: async () => null,
    updateDocument: async () => {},
    getBooking: async () => null,
    confirmBookingIfPending: async () => false,
    confirmCampRegistrationIfPending: async () => false,
    hasEvent: async () => false,
    hasCampEvent: async () => false,
    insertEvent: async () => {},
    listDueOperations: async () => [],
    upsertOperation: async () => {},
    updateIntegration: async () => {},
  };
  const provider = {
    getInvoice: async () => invoice('paid'),
  } as unknown as AccountingProvider;

  await runReconciliation({
    provider,
    repo,
    billingRepo: {} as BillingRepo,
    config: CONFIG,
    now: () => NOW,
    loadMembershipIntent: async (intentId) => {
      if (intentId !== 'intent-month') return null;
      return {
        status: monthStatus,
        chargeIntentId: 'charge-month',
        subjectId: 'subject-1',
        clientId: 'client-1',
        hasConfirmedSignal: monthSignal,
        hasReversedSignal: false,
        confirmedSource: monthSignal ? 'accounting_reconciliation' : null,
      };
    },
    applyMembershipDecision: async (input) => {
      applied.push({ intentId: input.intentId, decision: input.decision });
      if (input.decision.setPaidAt) {
        monthStatus = 'paid';
        monthSignal = true;
      }
      if (input.intentId === 'intent-fee') fee.paid = true;
    },
  });

  assertEquals(applied.length, 1);
  assertEquals(applied[0].intentId, 'intent-month');
  assertEquals(applied[0].decision.signal, 'payment_confirmed');
  assertEquals(applied[0].decision.setPaidAt, true);
  assertEquals(fee.paid, false);
  assertEquals(fee.status, 'invoiced');

  applied.length = 0;
  await runReconciliation({
    provider,
    repo,
    billingRepo: {} as BillingRepo,
    config: CONFIG,
    now: () => NOW,
    loadMembershipIntent: async () => ({
      status: 'paid',
      chargeIntentId: 'charge-month',
      subjectId: 'subject-1',
      clientId: 'client-1',
      hasConfirmedSignal: true,
      hasReversedSignal: false,
      confirmedSource: 'accounting_reconciliation',
    }),
    applyMembershipDecision: async (input) => {
      applied.push({ intentId: input.intentId, decision: input.decision });
    },
  });
  assertEquals(applied[0].decision.duplicateReceipt, false);
  assertEquals(applied[0].decision.signal, null);

  applied.length = 0;
  await runReconciliation({
    provider: { getInvoice: async () => invoice('cancelled') } as unknown as AccountingProvider,
    repo,
    billingRepo: {} as BillingRepo,
    config: CONFIG,
    now: () => NOW,
    loadMembershipIntent: async () => ({
      status: 'paid',
      chargeIntentId: 'charge-month',
      subjectId: 'subject-1',
      clientId: 'client-1',
      hasConfirmedSignal: true,
      hasReversedSignal: false,
      confirmedSource: 'accounting_reconciliation',
    }),
    applyMembershipDecision: async (input) => {
      applied.push({ intentId: input.intentId, decision: input.decision });
    },
  });
  assertEquals(applied[0].decision.intentStatus, 'reversed');
  assertEquals(applied[0].decision.signal, 'payment_reversed');
  assertEquals(applied[0].decision.clearPaidAt, true);
});
