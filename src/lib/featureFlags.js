/**
 * Product switches. The pages stay in the repo either way.
 * Set TOURNAMENTS_ENABLED to true to show the nav, footer, and home
 * links again and to serve /tournaments.
 */
export const TOURNAMENTS_ENABLED = false;

/** Navbar “Book Now” control. Set to true to show it again. */
export const NAV_BOOK_NOW_ENABLED = false;

export function publicNavLinks(links) {
  if (TOURNAMENTS_ENABLED) return links;
  return links.filter((link) => link.to !== '/tournaments');
}
