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
const TAX_UEX = {
  id: 3,
  value: 0,
  name: 'lib.model.tax.ch.sales_export.name',
  code: 'UEX',
  type: 'not_taxable_turnover',
  display_name: 'UEX - Export/Exempt 0.00%',
};
const TAX_VIM = { id: 9, value: 0, name: 'Einfuhrsteuerfrei', code: 'VIM' };

Deno.test('isZeroPercentTax accepts numeric and string zero', () => {
  assertEquals(isZeroPercentTax(TAX_0), true);
  assertEquals(isZeroPercentTax(TAX_0_STRING), true);
  assertEquals(isZeroPercentTax(TAX_81), false);
  assertEquals(isZeroPercentTax(null), false);
});

Deno.test('taxCodeEquals matches Bexio code case-insensitively', () => {
  assertEquals(taxCodeEquals(TAX_UEX, 'UEX'), true);
  assertEquals(taxCodeEquals(TAX_UEX, 'uex'), true);
  assertEquals(taxCodeEquals(TAX_81, 'UEX'), false);
  assertEquals(taxCodeEquals({ name: 'Code UEX (export)' }, 'UEX'), true);
  assertEquals(taxCodeEquals({ name: 'UEXxxx' }, 'UEX'), false);
  assertEquals(taxCodeEquals({ display_name: 'UEX - Export/Exempt 0.00%' }, 'UEX'), true);
  assertEquals(taxCodeEquals({ digit: 'UEX' }, 'UEX'), true);
  assertEquals(taxCodeEquals({ code: 'lib.model.tax.ch.sales_export.code' }, 'UEX'), true);
  assertEquals(taxCodeEquals({ code: 'lib.model.tax.ch.import_tax_mat_exempt.code' }, 'UEX'), false);
});

Deno.test('pickZeroPercentSalesTax prefers 0% over 8.1% and does not use taxes[0]', () => {
  assertEquals(pickZeroPercentSalesTax([TAX_81, TAX_0]), TAX_0);
  assertEquals(pickZeroPercentSalesTax([TAX_81]), null);
  assertEquals(pickZeroPercentSalesTax([]), null);
  assertEquals(pickZeroPercentSalesTax(undefined), null);
});

Deno.test('pickPreferredSalesTax selects UEX over VIM and over 8.1%', () => {
  assertEquals(pickPreferredSalesTax([TAX_81, TAX_26, TAX_UEX]), TAX_UEX);
  assertEquals(pickPreferredSalesTax([TAX_81, TAX_VIM, TAX_UEX]), TAX_UEX);
  assertEquals(pickPreferredSalesTax([TAX_81, TAX_26]), null);
  assertEquals(pickPreferredSalesTax([TAX_81, TAX_0]), TAX_0);
});

Deno.test('resolveSalesTaxId uses UEX from the list even when tax_id_sales is 8.1%', () => {
  assertEquals(
    resolveSalesTaxId({ tax_id_sales: 14, taxes_sales: [TAX_81, TAX_26, TAX_UEX] }),
    3,
  );
  assertEquals(
    resolveSalesTaxId({ tax_id_sales: 9, taxes_sales: [TAX_VIM, TAX_UEX] }),
    3,
  );
  assertEquals(resolveSalesTaxId({ tax_id_sales: 14, taxes_sales: [TAX_81, TAX_0] }), 21);
  assertEquals(resolveSalesTaxId({ tax_id_sales: 14 }), 14);
  assertEquals(resolveSalesTaxId({ tax_id_sales: 14, taxes_sales: [TAX_81, TAX_26] }), 14);
});
