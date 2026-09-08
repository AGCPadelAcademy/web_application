/**
 * Camp confirmation email (F1.25 US7).
 * Contract: specs/features/010-padel-camps/contracts/camp-billing.md
 */

import type { CampRegistrationExtraRow } from './camp-mapper.ts';

export const CAMP_CONFIRMATION_SUBJECT_PREFIX = 'Camp confirmation / Camp-Bestätigung';

export interface CampConfirmationInput {
  to: string;
  parentName: string | null;
  childFirstName: string;
  childLastName: string;
  campName: string;
  startDate: string;
  endDate: string;
  scheduleText: string | null;
  total: number;
  currency: 'CHF';
  extras: CampRegistrationExtraRow[];
  practicalInfo: string | null;
}

export function campConfirmationSubject(campName: string): string {
  return `${CAMP_CONFIRMATION_SUBJECT_PREFIX}: ${campName}`;
}

export function campConfirmationHtml(input: CampConfirmationInput): string {
  const parent = input.parentName?.trim() || '';
  const helloEn = parent ? `Hello ${parent},` : 'Hello,';
  const helloDe = parent ? `Hallo ${parent},` : 'Hallo,';
  const child = `${input.childFirstName} ${input.childLastName}`.trim();
  const amount = `${Number(input.total).toFixed(2)} ${input.currency}`;
  const extras = input.extras.length
    ? input.extras.map((e) => `${e.name} (${Number(e.price_amount).toFixed(2)} ${input.currency})`).join(', ')
    : 'None';
  const schedule = input.scheduleText?.trim() || 'See camp details';
  const practical = input.practicalInfo?.trim() || 'The academy will share any extra practical notes separately.';

  return `<p>${helloEn}</p>
<p>Payment for <strong>${child}</strong> at <strong>${input.campName}</strong> (${input.startDate} → ${input.endDate}) is confirmed.</p>
<p>Schedule: ${schedule}<br/>Total paid: <strong>${amount}</strong><br/>Extras: ${extras}</p>
<p>${practical}</p>
<p>Thank you,<br/>AGC Padel Academy</p>
<hr />
<p>${helloDe}</p>
<p>Die Zahlung für <strong>${child}</strong> beim <strong>${input.campName}</strong> (${input.startDate} → ${input.endDate}) ist bestätigt.</p>
<p>Zeitplan: ${schedule}<br/>Bezahlt: <strong>${amount}</strong><br/>Extras: ${extras}</p>
<p>${practical}</p>
<p>Vielen Dank,<br/>AGC Padel Academy</p>`;
}

export interface NotificationLookup {
  alreadySent(subject: string): Promise<boolean>;
}

export async function shouldSendCampConfirmation(
  lookup: NotificationLookup,
  campName: string,
): Promise<boolean> {
  const subject = campConfirmationSubject(campName);
  return !(await lookup.alreadySent(subject));
}
