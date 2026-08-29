/**
 * Sales-tax selection for lesson invoices.
 *
 * Production (2026-08-29): Bexio tax code UEX (export/exempt, 0%).
 * Discovery must not use taxes[0] (8.1% on the sales-tax list). The
 * `types=sales_tax` filter only returns UN81 / UR26 on this company —
 * UEX is `not_taxable_turnover` and is selected by `code`. Do not use
 * VIM on invoices: it is `pre_tax_material` (import) and Bexio rejects
 * it on quote/order/invoice positions.
 */

export const PREFERRED_SALES_TAX_CODE = 'UEX';

/** Bexio often returns i18n keys instead of the short Swiss VAT code. */
const TAX_CODE_I18N_ALIASES: Record<string, string[]> = {
  UEX: ['sales_export'],
  ULA: ['sales_abroad'],
  UNO: ['sales_not_optimized'],
  U00: ['sales_0'],
  VIM: ['import_tax_mat_exempt'],
};

export interface BexioSalesTax {
  id: number;
  value: number | string;
  name?: string;
  code?: string;
  digit?: string;
  display_name?: string;
  type?: string;
}

export function isZeroPercentTax(tax: { value: number | string } | null | undefined): boolean {
  if (tax == null) return false;
  const n = Number(tax.value);
  return Number.isFinite(n) && n === 0;
}

function fieldEqualsCode(value: string | undefined, want: string): boolean {
  const raw = (value ?? '').trim().toUpperCase();
  if (!raw) return false;
  return raw === want || raw.split(/[^A-Z0-9]+/).includes(want);
}

export function taxCodeEquals(
  tax: { code?: string; name?: string; digit?: string; display_name?: string } | null | undefined,
  code: string,
): boolean {
  if (tax == null) return false;
  const want = code.trim().toUpperCase();
  if (!want) return false;
  if (
    fieldEqualsCode(tax.code, want)
    || fieldEqualsCode(tax.digit, want)
    || fieldEqualsCode(tax.name, want)
    || fieldEqualsCode(tax.display_name, want)
  ) {
    return true;
  }
  const haystack = `${tax.code ?? ''} ${tax.name ?? ''} ${tax.display_name ?? ''}`.toLowerCase();
  return (TAX_CODE_I18N_ALIASES[want] ?? []).some((alias) => haystack.includes(alias));
}

export function pickZeroPercentSalesTax<T extends BexioSalesTax>(
  taxes: T[] | null | undefined,
): T | null {
  if (!taxes?.length) return null;
  return taxes.find((t) => isZeroPercentTax(t)) ?? null;
}

/** Prefer Bexio code UEX, then a 0% rate. Never taxes[0]. */
export function pickPreferredSalesTax<T extends BexioSalesTax>(
  taxes: T[] | null | undefined,
): T | null {
  if (!taxes?.length) return null;
  return taxes.find((t) => taxCodeEquals(t, PREFERRED_SALES_TAX_CODE))
    ?? pickZeroPercentSalesTax(taxes);
}

/** Invoice `tax_id`: UEX / 0% from the discovered list, else the stored config id. */
export function resolveSalesTaxId(config: {
  tax_id_sales: number;
  taxes_sales?: BexioSalesTax[] | null;
}): number {
  return pickPreferredSalesTax(config.taxes_sales)?.id ?? config.tax_id_sales;
}
