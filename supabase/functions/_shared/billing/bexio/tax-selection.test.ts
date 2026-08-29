import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  isZeroPercentTax,
  pickPreferredSalesTax,
  pickZeroPercentSalesTax,
  resolveSalesTaxId,
  taxCodeEquals,
} from './tax-selection.ts';

const TAX_81 = { id: 14, value: 8.1, name: 'lib.model.tax.ch.sales_tax_303.name', code: 'UN81' };
const TAX_26 = { id: 15, value: 2.6, name: 'lib.model.tax.ch.sales_tax_313.name', code: 'UR26' };
const TAX_0 = { id: 21, value: 0, name: 'MWST 0%', code: 'UNO' };
const TAX_0_STRING = { id: 22, value: '0.00', name: '0%' };
const TAX_VIM = { id: 7, value: 0, name: 'Einfuhrsteuerfrei', code: 'VIM' };
const TAX_VIM_NONZERO = { id: 8, value: 8.1, name: 'VIM 8.1%', code: 'VIM' };

Deno.test('isZeroPercentTax accepts numeric and string zero', () => {
  assertEquals(isZeroPercentTax(TAX_0), true);
  assertEquals(isZeroPercentTax(TAX_0_STRING), true);
  assertEquals(isZeroPercentTax(TAX_81), false);
  assertEquals(isZeroPercentTax(null), false);
});

Deno.test('taxCodeEquals matches Bexio code case-insensitively', () => {
  assertEquals(taxCodeEquals(TAX_VIM, 'VIM'), true);
  assertEquals(taxCodeEquals(TAX_VIM, 'vim'), true);
  assertEquals(taxCodeEquals(TAX_81, 'VIM'), false);
  assertEquals(taxCodeEquals({ name: 'Code VIM (import)' }, 'VIM'), true);
  assertEquals(taxCodeEquals({ name: 'VIMxxx' }, 'VIM'), false);
});

Deno.test('pickZeroPercentSalesTax prefers 0% over 8.1% and does not use taxes[0]', () => {
  assertEquals(pickZeroPercentSalesTax([TAX_81, TAX_0]), TAX_0);
  assertEquals(pickZeroPercentSalesTax([TAX_81]), null);
  assertEquals(pickZeroPercentSalesTax([]), null);
  assertEquals(pickZeroPercentSalesTax(undefined), null);
});

Deno.test('pickPreferredSalesTax selects VIM even when no 0% sales_tax row exists', () => {
  assertEquals(pickPreferredSalesTax([TAX_81, TAX_26, TAX_VIM]), TAX_VIM);
  assertEquals(pickPreferredSalesTax([TAX_81, TAX_26]), null);
  assertEquals(pickPreferredSalesTax([TAX_81, TAX_0]), TAX_0);
  assertEquals(pickPreferredSalesTax([TAX_81, TAX_VIM_NONZERO, TAX_0]), TAX_VIM_NONZERO);
});

Deno.test('resolveSalesTaxId uses VIM from the list even when tax_id_sales is 8.1%', () => {
  assertEquals(
    resolveSalesTaxId({ tax_id_sales: 14, taxes_sales: [TAX_81, TAX_26, TAX_VIM] }),
    7,
  );
  assertEquals(resolveSalesTaxId({ tax_id_sales: 14, taxes_sales: [TAX_81, TAX_0] }), 21);
  assertEquals(resolveSalesTaxId({ tax_id_sales: 14 }), 14);
  assertEquals(resolveSalesTaxId({ tax_id_sales: 14, taxes_sales: [TAX_81, TAX_26] }), 14);
});
