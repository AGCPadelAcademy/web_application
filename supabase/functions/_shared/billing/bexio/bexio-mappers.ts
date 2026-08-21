/**
 * AGC ⇄ Bexio payload translation (T020; research R-04/R-05/R-14).
 *
 * Pure functions — no I/O. The adapter (bexio-adapter.ts) is the only caller.
 * All Bexio-internal IDs come from `billing_integrations.config` (R-06).
 */

import type {
  ContactInput,
  ExternalContactRef,
  InvoiceInput,
} from '../accounting-provider.ts';

/** Subset of billing_integrations.config the mappers rely on. */
export interface BexioConfig {
  bexio_user_id: number;
  currency_id: number;
  bank_account_id: number;
  payment_type_id: number;
  sales_account_id: number;
  tax_id_sales: number;
  unit_id: number;
  language_id?: number;
  country_id_ch?: number;
  mwst_type: number;
  mwst_is_net: boolean;
  payment_term_days: number;
  template_slug?: string | null;
}

export interface AgcProfileRow {
  id: string;
  full_name: string;
  email: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface AgcBookingRow {
  id: string;
  user_id: string;
  lesson_code: string | null;
  lesson_name: string;
  booking_date: string | null;
  price: string;
}

export interface AgcLessonRow {
  lesson_code: string;
  name: string;
  price_amount: number;
}

export interface BexioContactPayload {
  contact_type_id: 2;
  name_1: string;
  name_2: string;
  mail: string;
  address?: string;
  postcode?: string;
  city?: string;
  country_id?: number;
}

export interface BexioPositionCustom {
  type: 'KbPositionCustom';
  amount: string;
  unit_id: number;
  account_id: number;
  tax_id: number;
  text: string;
  unit_price: string;
}

export interface BexioInvoicePayload {
  user_id: number;
  contact_id: number;
  title: string;
  is_valid_from: string;
  is_valid_to: string;
  mwst_type: number;
  mwst_is_net: boolean;
  show_position_taxes: boolean;
  currency_id: number;
  bank_account_id: number;
  payment_type_id: number;
  api_reference: string;
  template_slug?: string;
  positions: BexioPositionCustom[];
}

/** AGC stores a single `full_name`; Bexio persons need last (name_1) / first (name_2). */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

export function profileToContactInput(profile: AgcProfileRow): ContactInput {
  const { firstName, lastName } = splitFullName(profile.full_name ?? '');
  return {
    firstName,
    lastName,
    email: profile.email ?? '',
    ...(profile.address ? { address: profile.address } : {}),
    ...(profile.postal_code ? { postcode: profile.postal_code } : {}),
    ...(profile.city ? { city: profile.city } : {}),
  };
}

export function contactToBexioPayload(input: ContactInput, config: BexioConfig): BexioContactPayload {
  return {
    contact_type_id: 2, // person (R-04)
    name_1: input.lastName,
    name_2: input.firstName,
    mail: input.email,
    ...(input.address ? { address: input.address } : {}),
    ...(input.postcode ? { postcode: input.postcode } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.countryId ?? config.country_id_ch
      ? { country_id: input.countryId ?? config.country_id_ch! }
      : {}),
  };
}

export function bookingToInvoiceInput(
  booking: AgcBookingRow,
  lesson: AgcLessonRow,
  contact: ExternalContactRef,
  config: BexioConfig,
  now: Date = new Date(),
): InvoiceInput {
  const isValidFrom = now.toISOString().slice(0, 10);
  const validTo = new Date(now);
  validTo.setUTCDate(validTo.getUTCDate() + config.payment_term_days);

  const datePart = booking.booking_date ?? 'unscheduled';
  const title = `Padel lesson — ${lesson.name} ${datePart}`;

  return {
    apiReference: `agc:booking:${booking.id}`,
    contact,
    title,
    lines: [{ text: `${lesson.name} — ${datePart}`, amount: 1, unitPrice: lesson.price_amount }],
    currency: 'CHF',
    isValidFrom,
    isValidTo: validTo.toISOString().slice(0, 10),
  };
}

export function invoiceToBexioPayload(input: InvoiceInput, config: BexioConfig): BexioInvoicePayload {
  return {
    user_id: config.bexio_user_id,
    contact_id: Number(input.contact.externalId),
    title: input.title,
    is_valid_from: input.isValidFrom,
    is_valid_to: input.isValidTo,
    mwst_type: config.mwst_type,
    mwst_is_net: config.mwst_is_net,
    show_position_taxes: false,
    currency_id: config.currency_id,
    bank_account_id: config.bank_account_id,
    payment_type_id: config.payment_type_id,
    api_reference: input.apiReference,
    ...(config.template_slug ? { template_slug: config.template_slug } : {}),
    positions: input.lines.map((line) => ({
      type: 'KbPositionCustom' as const,
      amount: String(line.amount),
      unit_id: config.unit_id,
      account_id: config.sales_account_id,
      tax_id: config.tax_id_sales,
      text: line.text,
      unit_price: line.unitPrice.toFixed(2),
    })),
  };
}
