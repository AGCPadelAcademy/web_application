/**
 * Sales-tax selection for lesson invoices (spec clarification 2026-08-29).
 *
 * Go-live VAT is 0%. Discovery and issuance must not fall back to the first
 * active Bexio sales tax (that was 8.1% on the demo company).
 */

export interface BexioSalesTax {
  id: number;
  value: number | string;
  name?: string;
}

export function isZeroPercentTax(tax: { value: number | string } | null | undefined): boolean {
  if (tax == null) return false;
  const n = Number(tax.value);
  return Number.isFinite(n) && n === 0;
}

export function pickZeroPercentSalesTax<T extends BexioSalesTax>(
  taxes: T[] | null | undefined,
): T | null {
  if (!taxes?.length) return null;
  return taxes.find((t) => isZeroPercentTax(t)) ?? null;
}

/** Invoice `tax_id`: 0% from the discovered list, else the stored config id. */
export function resolveSalesTaxId(config: {
  tax_id_sales: number;
  taxes_sales?: BexioSalesTax[] | null;
}): number {
  return pickZeroPercentSalesTax(config.taxes_sales)?.id ?? config.tax_id_sales;
}
