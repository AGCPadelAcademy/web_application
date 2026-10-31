import { describe, expect, it } from 'vitest';
import { TOURNAMENTS_ENABLED, publicNavLinks } from './featureFlags';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/contact', label: 'Contact' },
];

describe('publicNavLinks', () => {
  it('follows the tournaments switch', () => {
    const links = publicNavLinks(LINKS);
    if (TOURNAMENTS_ENABLED) {
      expect(links).toEqual(LINKS);
    } else {
      expect(links.map((link) => link.to)).toEqual(['/', '/contact']);
    }
  });
});
