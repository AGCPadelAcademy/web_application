/**
 * Unit tests for camp confirmation email (T044).
 * Run with: deno test --allow-env --allow-net=none
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  campConfirmationHtml,
  campConfirmationSubject,
  shouldSendCampConfirmation,
} from './camp-confirmation.ts';

const INPUT = {
  to: 'parent@example.com',
  parentName: 'Alex Parent',
  childFirstName: 'Mia',
  childLastName: 'Parent',
  campName: 'Junior Camp',
  startDate: '2026-10-12',
  endDate: '2026-10-16',
  scheduleText: '09:00–16:00',
  total: 374,
  currency: 'CHF' as const,
  extras: [{ name: 'Lunch', price_amount: 25 }],
  practicalInfo: 'Bring a racket and water bottle.',
};

Deno.test('subject and html include child, camp, dates, schedule, total, extras, practical info', () => {
  const subject = campConfirmationSubject(INPUT.campName);
  const html = campConfirmationHtml(INPUT);
  assertEquals(subject, 'Camp confirmation / Camp-Bestätigung: Junior Camp');
  assert(html.includes('Mia Parent'));
  assert(html.includes('Junior Camp'));
  assert(html.includes('2026-10-12'));
  assert(html.includes('2026-10-16'));
  assert(html.includes('09:00–16:00'));
  assert(html.includes('374.00 CHF'));
  assert(html.includes('Lunch'));
  assert(html.includes('Bring a racket and water bottle.'));
});

Deno.test('skips send when a sent notification already exists', async () => {
  const send = await shouldSendCampConfirmation(
    { alreadySent: () => Promise.resolve(true) },
    INPUT.campName,
  );
  assertEquals(send, false);
});

Deno.test('sends when no sent notification exists', async () => {
  const send = await shouldSendCampConfirmation(
    { alreadySent: () => Promise.resolve(false) },
    INPUT.campName,
  );
  assertEquals(send, true);
});
