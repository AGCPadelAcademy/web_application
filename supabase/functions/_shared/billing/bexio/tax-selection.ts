/**
 * Sales-tax selection for lesson invoices.
 *
 * Production (2026-08-29): Bexio tax code VIM. Discovery must not use
 * taxes[0] (8.1% on the demo/production sales-tax list). The active
 * `sales_tax` filter only returns 8.1% / 2.6% on this company — VIM is
 * a separate Bexio tax code and is selected by `code`, not by rate 0.
 */

export const PREFERRED_SALES_TAX_CODE = 'VIM';

export interface BexioSalesTax {
  id: number;
  value: number | string;
  name?: string;
  code?: string;
}

export function isZeroPercentTax(tax: { value: number | string } | null | undefined): boolean {
  if (tax == null) return false;
  const n = Number(tax.value);
  return Number.isFinite(n) && n === 0;
}

export function taxCodeEquals(
  tax: { code?: string; name?: string } | null | undefined,
  code: string,
): boolean {
  if (tax == null) return false;
  const want = code.trim().toUpperCase();
  if (!want) return false;
  if ((tax.code ?? '').trim().toUpperCase() === want) return true;
  // Bexio sometimes returns i18n keys or display names that embed the code.
  const name = (tax.name ?? '').toUpperCase();
  return name === want || name.split(/[^A-Z0-9]+/).includes(want);
}

export function pickZeroPercentSalesTax<T extends BexioSalesTax>(
  taxes: T[] | null | undefined,
): T | null {
  if (!taxes?.length) return null;
  return taxes.find((t) => isZeroPercentTax(t)) ?? null;
}

/** Prefer Bexio code VIM, then a 0% rate. Never taxes[0]. */
export function pickPreferredSalesTax<T extends BexioSalesTax>(
  taxes: T[] | null | undefined,
): T | null {
  if (!taxes?.length) return null;
  return taxes.find((t) => taxCodeEquals(t, PREFERRED_SALES_TAX_CODE))
    ?? pickZeroPercentSalesTax(taxes);
}

/** Invoice `tax_id`: VIM / 0% from the discovered list, else the stored config id. */
export function resolveSalesTaxId(config: {
  tax_id_sales: number;
  taxes_sales?: BexioSalesTax[] | null;
}): number {
  return pickPreferredSalesTax(config.taxes_sales)?.id ?? config.tax_id_sales;
}
