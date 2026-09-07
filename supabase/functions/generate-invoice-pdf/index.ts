import { corsHeaders } from './cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'https://esm.sh/pdf-lib@1.17.1';

const CO_NAME = 'CAG Padel Academy GmbH';
const CO_ADDR1 = 'Durisolstrasse 3';
const CO_ADDR2 = '5612 Villmergen';
const CO_EMAIL = 'info@agcpadel.com';
const GREEN = rgb(0.09, 0.62, 0.29);
const BLACK = rgb(0, 0, 0);
const DARK_GRAY = rgb(0.2, 0.2, 0.2);
const MID_GRAY = rgb(0.5, 0.5, 0.5);
const LIGHT_LINE = rgb(0.82, 0.82, 0.82);
const HEADER_BG = rgb(0.1, 0.1, 0.1);
const ROW_BG = rgb(0.96, 0.96, 0.96);
const WHITE = rgb(1, 1, 1);

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });

async function buildInvoicePage(
  pdfDoc: PDFDocument,
  logoImage: any,
  opts: {
    invoiceNumber: string;
    invoiceDate: string;
    customerName: string;
    customerAddress: string;
    customerCity: string;
    customerCountry: string;
    lessonName: string;
    qty: number;
    formattedAmount: string;
  },
): Promise<void> {
  const {
    invoiceNumber, invoiceDate, customerName, customerAddress, customerCity,
    customerCountry, lessonName, qty, formattedAmount,
  } = opts;
  const [W, H] = PageSizes.A4;
  const page = pdfDoc.addPage([W, H]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const M = 50;
  const CW = W - 2 * M;
  const dt = (text: string, x: number, y: number, size: number, f: any, color: any) =>
    page.drawText(String(text ?? ''), { x, y, size, font: f, color });
  const hr = (y: number, color: any = LIGHT_LINE, thickness = 0.6) =>
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness, color });
  let y = H - M;

  if (logoImage) {
    const dims = logoImage.scaleToFit(70, 70);
    page.drawImage(logoImage, { x: M, y: y - dims.height, width: dims.width, height: dims.height });
    y -= dims.height + 10;
  }
  dt(CO_NAME, M, y - 6, 18, boldFont, GREEN);
  const invLabelW = boldFont.widthOfTextAtSize('INVOICE', 26);
  dt('INVOICE', W - M - invLabelW, y - 2, 26, boldFont, BLACK);
  y -= 28;
  dt(CO_ADDR1, M, y, 9, font, MID_GRAY);
  dt(CO_ADDR2, M, y - 13, 9, font, MID_GRAY);
  dt(CO_EMAIL, M, y - 26, 9, font, MID_GRAY);
  const rx = W - M - 195;
  const metaRows: [string, string][] = [
    ['Invoice No:', invoiceNumber],
    ['Date:', invoiceDate],
    ['Due:', 'Upon receipt'],
  ];
  metaRows.forEach(([label, value], i) => {
    dt(label, rx, y - i * 13, 9, font, MID_GRAY);
    dt(value, rx + 75, y - i * 13, 9, boldFont, BLACK);
  });
  y -= 44;
  hr(y);
  y -= 26;
  dt('BILL TO', M, y, 8, boldFont, MID_GRAY);
  y -= 16;
  dt(customerName || '—', M, y, 11, boldFont, BLACK);
  y -= 15;
  if (customerAddress) { dt(customerAddress, M, y, 10, font, DARK_GRAY); y -= 13; }
  if (customerCity) { dt(customerCity, M, y, 10, font, DARK_GRAY); y -= 13; }
  if (customerCountry) { dt(customerCountry, M, y, 10, font, DARK_GRAY); y -= 13; }
  y -= 22;

  const C_DESC = M + 10;
  const C_QTY = W - M - 195;
  const C_PRICE = W - M - 115;
  const C_AMT = W - M - 10;
  const TH = 25;
  page.drawRectangle({ x: M, y: y - TH + 8, width: CW, height: TH, color: HEADER_BG });
  dt('DESCRIPTION', C_DESC, y - 8, 8.5, boldFont, WHITE);
  dt('QTY', C_QTY, y - 8, 8.5, boldFont, WHITE);
  dt('UNIT PRICE', C_PRICE - 18, y - 8, 8.5, boldFont, WHITE);
  const amountHeaderWidth = boldFont.widthOfTextAtSize('AMOUNT', 8.5);
  dt('AMOUNT', C_AMT - amountHeaderWidth, y - 8, 8.5, boldFont, WHITE);
  y -= TH + 4;
  const TD = 30;
  page.drawRectangle({ x: M, y: y - TD + 10, width: CW, height: TD, color: ROW_BG });
  dt(lessonName || 'Lesson Booking', C_DESC, y - 8, 10, font, BLACK);
  dt(String(qty || 1), C_QTY + 4, y - 8, 10, font, BLACK);
  dt(formattedAmount, C_PRICE - 18, y - 8, 10, font, DARK_GRAY);
  const amountWidth = boldFont.widthOfTextAtSize(formattedAmount, 10);
  dt(formattedAmount, C_AMT - amountWidth, y - 8, 10, boldFont, BLACK);
  y -= TD + 8;
  hr(y);
  y -= 18;
  const totalLabel = 'TOTAL DUE';
  const totalLabelWidth = boldFont.widthOfTextAtSize(totalLabel, 11);
  const totalAmountWidth = boldFont.widthOfTextAtSize(formattedAmount, 15);
  dt(totalLabel, C_AMT - totalAmountWidth - totalLabelWidth - 18, y, 11, boldFont, DARK_GRAY);
  dt(formattedAmount, C_AMT - totalAmountWidth, y, 15, boldFont, GREEN);
  y -= 12;
  hr(y, GREEN, 1.5);
  y -= 34;
  dt(`Thank you for choosing ${CO_NAME}!`, M, y, 11, boldFont, GREEN);
  hr(38);
  const footer = `${CO_NAME}  ·  ${CO_ADDR1}, ${CO_ADDR2}  ·  ${CO_EMAIL}`;
  dt(footer, (W - font.widthOfTextAtSize(footer, 8)) / 2, 26, 8, font, MID_GRAY);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const payload = await req.json();
    const {
      booking_id, invoice_number: incomingInvoiceNumber, amount, invoice_date,
      customer_fullname, customer_address, customer_postal_city,
      customer_country, lesson_name, qty = 1, invoice_id,
    } = payload;
    if (!booking_id || !amount) {
      return jsonResponse({ success: false, error: 'Missing required: booking_id, amount' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Missing Authorization header' }, 401);
    }
    const callerToken = authHeader.replace('Bearer ', '');
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser(callerToken);
    if (authError || !user) {
      console.warn('[generate-invoice-pdf] auth rejected:', authError?.message ?? 'no user');
      return jsonResponse({ success: false, error: 'Invalid or expired token' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: bookingRow, error: bookingError } = await supabase
      .from('bookings')
      .select('user_id')
      .eq('id', booking_id)
      .single();
    if (bookingError || !bookingRow) {
      return jsonResponse({ success: false, error: 'Booking not found' }, 404);
    }
    if (bookingRow.user_id !== user.id) {
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (callerProfile?.role !== 'admin') {
        return jsonResponse({ success: false, error: 'Forbidden: booking does not belong to caller' }, 403);
      }
    }

    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const formattedDate = (() => {
      if (!invoice_date) return `${day}.${month}.${year}`;
      try {
        const parts = String(invoice_date).split('T')[0].split('-');
        if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
      } catch (_) {
        // Preserve the incoming value when it is not an ISO date.
      }
      return String(invoice_date);
    })();

    let invoiceNumber = incomingInvoiceNumber as string | undefined;
    if (!invoiceNumber) {
      const dateKey = `${year}/${month}/${day}`;
      const { data: sequence, error: sequenceError } = await supabase
        .rpc('next_invoice_number', { p_date_key: dateKey });
      if (sequenceError || typeof sequence !== 'number') {
        throw new Error(`Invoice number allocation failed: ${sequenceError?.message ?? 'no sequence returned'}`);
      }
      invoiceNumber = `INV-${dateKey}-${String(sequence).padStart(2, '0')}`;
    }

    const numericAmount = parseFloat(String(amount).replace(/[^\d.-]/g, ''));
    const formattedAmount = Number.isNaN(numericAmount) ? String(amount) : `CHF ${numericAmount.toFixed(2)}`;
    const numericForDatabase = Number.isNaN(numericAmount) ? 0 : numericAmount;
    let rawLogoBytes: ArrayBuffer | null = null;
    try {
      const { data: logoBlob, error: logoError } = await supabase.storage
        .from('invoices')
        .download('assets/logo.png');
      if (!logoError && logoBlob) rawLogoBytes = await logoBlob.arrayBuffer();
    } catch (error: any) {
      console.warn('[generate-invoice-pdf] Logo download failed:', error.message);
    }

    const pdfDoc = await PDFDocument.create();
    let logoImage: any = null;
    if (rawLogoBytes) {
      try {
        logoImage = await pdfDoc.embedPng(rawLogoBytes);
      } catch (error: any) {
        console.warn('[generate-invoice-pdf] Logo embed failed:', error.message);
      }
    }
    await buildInvoicePage(pdfDoc, logoImage, {
      invoiceNumber,
      invoiceDate: formattedDate,
      customerName: String(customer_fullname || ''),
      customerAddress: String(customer_address || ''),
      customerCity: String(customer_postal_city || '').trim(),
      customerCountry: String(customer_country || '').trim(),
      lessonName: String(lesson_name || ''),
      qty: Number(qty) || 1,
      formattedAmount,
    });

    const qrFilename = `QR_${numericAmount}.pdf`;
    const { data: qrBlob, error: qrError } = await supabase.storage
      .from('qr-codes')
      .download(qrFilename);
    if (qrError) {
      console.warn('[generate-invoice-pdf] QR not found:', qrFilename);
    } else if (qrBlob) {
      try {
        const qrDocument = await PDFDocument.load(await qrBlob.arrayBuffer());
        const [qrPage] = await pdfDoc.copyPages(qrDocument, [0]);
        pdfDoc.addPage(qrPage);
      } catch (error: any) {
        console.warn('[generate-invoice-pdf] QR merge error:', error.message);
      }
    }

    const pdfBytes = await pdfDoc.save();
    const safeNumber = invoiceNumber.replace(/\//g, '-');
    const storagePath = `Pending/${year}/${month}/${day}/invoice_${safeNumber}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
    const { data: publicData } = supabase.storage.from('invoices').getPublicUrl(storagePath);
    const pdfUrl = publicData?.publicUrl ?? null;

    let invoiceRecord: any = null;
    if (invoice_id) {
      const { data } = await supabase
        .from('invoices')
        .update({ status: 'pending', pdf_url: pdfUrl, invoice_number: invoiceNumber })
        .eq('id', invoice_id)
        .select()
        .single();
      invoiceRecord = data;
    } else {
      const { data, error: insertError } = await supabase
        .from('invoices')
        .insert([{
          booking_id,
          invoice_number: invoiceNumber,
          amount: numericForDatabase,
          currency: 'CHF',
          status: 'pending',
          pdf_url: pdfUrl,
        }])
        .select()
        .single();
      if (insertError) console.error('[generate-invoice-pdf] DB insert error:', insertError.message);
      invoiceRecord = data;
    }
    if (pdfUrl) {
      await supabase.from('bookings').update({ receipt_url: pdfUrl }).eq('id', booking_id);
    }
    console.log('[generate-invoice-pdf] v22 done', { invoice_number: invoiceNumber, storagePath });
    return jsonResponse({
      success: true,
      url: pdfUrl,
      invoice_id: invoiceRecord?.id ?? null,
      invoice_number: invoiceNumber,
    }, 200);
  } catch (error: any) {
    console.error('[generate-invoice-pdf] error:', error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
});
