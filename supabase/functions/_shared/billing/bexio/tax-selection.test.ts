import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  isZeroPercentTax,
  pickZeroPercentSalesTax,
  resolveSalesTaxId,
} from './tax-selection.ts';

const TAX_81 = { id: 14, value: 8.1, name: 'MWST 8.1%' };
const TAX_0 = { id: 21, value: 0, name: 'MWST 0%' };
const TAX_0_STRING = { id: 22, value: '0.00', name: '0%' };

Deno.test('isZeroPercentTax accepts numeric and string zero', () => {
  assertEquals(isZeroPercentTax(TAX_0), true);
  assertEquals(isZeroPercentTax(TAX_0_STRING), true);
  assertEquals(isZeroPercentTax(TAX_81), false);
  assertEquals(isZeroPercentTax(null), false);
});

Deno.test('pickZeroPercentSalesTax prefers 0% over 8.1% and does not use taxes[0]', () => {
  assertEquals(pickZeroPercentSalesTax([TAX_81, TAX_0]), TAX_0);
  assertEquals(pickZeroPercentSalesTax([TAX_81]), null);
  assertEquals(pickZeroPercentSalesTax([]), null);
  assertEquals(pickZeroPercentSalesTax(undefined), null);
});

Deno.test('resolveSalesTaxId uses 0% from the list even when tax_id_sales is 8.1%', () => {
  assertEquals(resolveSalesTaxId({ tax_id_sales: 14, taxes_sales: [TAX_81, TAX_0] }), 21);
  assertEquals(resolveSalesTaxId({ tax_id_sales: 14 }), 14);
  assertEquals(resolveSalesTaxId({ tax_id_sales: 14, taxes_sales: [TAX_81] }), 14);
});
