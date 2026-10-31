import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { issueInvoiceForMembershipPeriod, type MembershipInvoiceRepo } from './financial-service.ts';
import type { AccountingProvider, ExternalInvoice } from './accounting-provider.ts';
import type { MembershipPeriodIntentRow } from './membership-mapper.ts';

const INTENT: MembershipPeriodIntentRow = {
  id: 'intent-1',
  subject_id: 'subject-1',
  client_id: 'client-1',
  membership_ref: 'membership-1',
  period_key: '2026-08',
  claim_kind: 'month',
  charge_intent_id: 'charge-1',
  display_label: 'Tuesday Adults',
  amount: 200,
  currency: 'CHF',
  status: 'pending',
};

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

function invoice(): ExternalInvoice {
  return {
    externalId: 'inv-1',
    documentNr: 'RE-1',
    status: 'issued',
    total: 200,
    received: 0,
    remaining: 200,
    hasQrPaymentPart: true,
  };
}

Deno.test('a second issue does not create a second document and does not mark paid', async () => {
  let creates = 0;
  let paid = false;
  const repo: MembershipInvoiceRepo = {
    findDocumentByIntent: async () => creates === 0 ? null : {
      id: 'doc-1',
      membership_period_intent_id: 'intent-1',
      provider: 'bexio',
      external_id: 'inv-1',
      document_nr: 'RE-1',
      api_reference: 'agc:membership-period:intent-1',
      status: 'issued',
      total: 200,
      currency: 'CHF',
    },
    findOperation: async () => null,
    getIntent: async () => INTENT,
    getProfile: async () => ({
      id: 'client-1',
      email: 'a@example.com',
      full_name: 'A',
      first_name: 'A',
      last_name: 'B',
      phone: null,
      address: null,
      postal_code: null,
      city: null,
      country_code: 'CH',
    }),
    findContactByUser: async () => ({ external_id: 'contact-1', email_snapshot: 'a@example.com' }),
    upsertContact: async () => {},
    upsertMembershipDocument: async (row) => {
      creates += 1;
      return { ...row, id: 'doc-1' };
    },
    upsertOperation: async () => {},
    insertEvent: async () => {},
    markIntentInvoiced: async () => {
      paid = false;
    },
  };
  const provider = {
    name: 'bexio',
    findInvoiceByApiReference: async () => null,
    createInvoice: async () => ({ externalId: 'inv-1' }),
    issueInvoice: async () => invoice(),
    findContactByEmail: async () => null,
    createContact: async () => ({ externalId: 'contact-1' }),
    updateContact: async () => {},
  } as unknown as AccountingProvider;

  const first = await issueInvoiceForMembershipPeriod({ provider, repo, config: CONFIG }, 'intent-1');
  const second = await issueInvoiceForMembershipPeriod({ provider, repo, config: CONFIG }, 'intent-1');
  assertEquals(first.reused, false);
  assertEquals(second.reused, true);
  assertEquals(creates, 1);
  assertEquals(paid, false);
  assertEquals(second.document.status, 'issued');
});
