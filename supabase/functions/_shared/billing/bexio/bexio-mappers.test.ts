/**
 * Unit tests for bexio-mappers (T018). Run with: deno test --allow-env --allow-net=none
 * Pure functions — no mocks needed.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  bookingToInvoiceInput,
  contactToBexioPayload,
  invoiceToBexioPayload,
  profileToContactInput,
  resolveBexioCountryId,
  splitFullName,
} from './bexio-mappers.ts';
import type { ExternalContactRef } from '../accounting-provider.ts';

const CONFIG = {
  bexio_user_id: 1,
  currency_id: 1,
  bank_account_id: 2,
  payment_type_id: 3,
  sales_account_id: 9,
  tax_id_sales: 14,
  unit_id: 5,
  language_id: 1,
  country_id_ch: 7,
  countries: [
    { id: 7, iso: 'CH', name: 'Switzerland' },
    { id: 2, iso: 'ES', name: 'Spain' },
  ],
  mwst_type: 0,
  mwst_is_net: false,
  payment_term_days: 30,
  template_slug: null,
};

const PROFILE = {
  id: 'user-1',
  full_name: 'Josep Barbera',
  first_name: 'Josep',
  last_name: 'Barbera',
  email: 'josep@example.com',
  phone: '696588327',
  address: 'Bahnhofstrasse 1',
  postal_code: '8001',
  city: 'Zürich',
  country: 'Switzerland',
  country_code: 'CH',
};

const BOOKING = {
  id: 'b0000000-0000-4000-8000-000000000001',
  user_id: 'user-1',
  lesson_code: 'PRIV60',
  lesson_name: 'Private Lesson 60min',
  booking_date: '2026-09-01',
  price: '120 CHF',
};

const LESSON = { lesson_code: 'PRIV60', name: 'Private Lesson 60min', price_amount: 120 };

Deno.test('splitFullName: last token is the last name', () => {
  assertEquals(splitFullName('Josep Barbera'), { firstName: 'Josep', lastName: 'Barbera' });
  assertEquals(splitFullName('Anna Maria Meier'), { firstName: 'Anna Maria', lastName: 'Meier' });
  assertEquals(splitFullName('Madonna'), { firstName: '', lastName: 'Madonna' });
});

Deno.test('profileToContactInput maps profile fields', () => {
  const input = profileToContactInput(PROFILE);
  assertEquals(input, {
    firstName: 'Josep',
    lastName: 'Barbera',
    email: 'josep@example.com',
    phone: '696588327',
    address: 'Bahnhofstrasse 1',
    postcode: '8001',
    city: 'Zürich',
    countryCode: 'CH',
  });
});

Deno.test('contactToBexioPayload: person type, name_1 last / name_2 first (R-04)', () => {
  const payload = contactToBexioPayload(profileToContactInput(PROFILE), CONFIG);
  assertEquals(payload.contact_type_id, 2);
  assertEquals(payload.name_1, 'Barbera');
  assertEquals(payload.name_2, 'Josep');
  assertEquals(payload.mail, 'josep@example.com');
  assertEquals(payload.user_id, 1);
  assertEquals(payload.owner_id, 1);
  assertEquals(payload.phone_mobile, '696588327');
  assertEquals(payload.street_name, 'Bahnhofstrasse 1');
  assertEquals(payload.postcode, '8001');
  assertEquals(payload.city, 'Zürich');
  assertEquals(payload.country_id, 7);
  assertEquals(payload.language_id, 1);
});

Deno.test('resolveBexioCountryId maps any ISO country, not only Switzerland', () => {
  assertEquals(resolveBexioCountryId('ES', CONFIG.countries), 2);
  assertEquals(resolveBexioCountryId('ch', CONFIG.countries), 7);
  assertEquals(resolveBexioCountryId('US', CONFIG.countries), undefined);
});

Deno.test('bookingToInvoiceInput: api_reference format, gross CHF line, payment term (FR-016)', () => {
  const contact: ExternalContactRef = { externalId: '42' };
  const input = bookingToInvoiceInput(BOOKING, LESSON, contact, CONFIG, new Date('2026-08-21T12:00:00Z'));

  assertEquals(input.apiReference, 'agc:booking:b0000000-0000-4000-8000-000000000001');
  assertEquals(input.contact.externalId, '42');
  assertEquals(input.currency, 'CHF');
  assertEquals(input.isValidFrom, '2026-08-21');
  assertEquals(input.isValidTo, '2026-09-20'); // +30 days
  assertEquals(input.lines.length, 1);
  assertEquals(input.lines[0].amount, 1);
  assertEquals(input.lines[0].unitPrice, 120);
  assertEquals(input.title.includes('Private Lesson 60min'), true);
  assertEquals(input.title.includes('2026-09-01'), true);
  assertEquals(input.lines[0].text.includes('Private Lesson 60min'), true);
});

Deno.test('invoiceToBexioPayload: KbPositionCustom with config IDs, gross VAT mode (R-05/R-14)', () => {
  const contact: ExternalContactRef = { externalId: '42' };
  const input = bookingToInvoiceInput(BOOKING, LESSON, contact, CONFIG, new Date('2026-08-21T12:00:00Z'));
  const payload = invoiceToBexioPayload(input, CONFIG);

  assertEquals(payload.user_id, 1);
  assertEquals(payload.contact_id, 42);
  assertEquals(payload.api_reference, 'agc:booking:b0000000-0000-4000-8000-000000000001');
  assertEquals(payload.mwst_type, 0);
  assertEquals(payload.mwst_is_net, false);
  assertEquals(payload.currency_id, 1);
  assertEquals(payload.bank_account_id, 2);
  assertEquals(payload.payment_type_id, 3);
  assertEquals(payload.is_valid_from, '2026-08-21');
  assertEquals(payload.is_valid_to, '2026-09-20');
  assertEquals('template_slug' in payload, false); // null template omitted

  assertEquals(payload.positions.length, 1);
  const pos = payload.positions[0];
  assertEquals(pos.type, 'KbPositionCustom');
  assertEquals(pos.account_id, 9);
  assertEquals(pos.tax_id, 14);
  assertEquals(pos.unit_id, 5);
  assertEquals(pos.amount, '1');
  assertEquals(pos.unit_price, '120.00');
});
