import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      single: vi.fn(() => chain),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  return { mockSupabase: { from: vi.fn() }, makeChain };
});

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import {
  createClub,
  listClubs,
  listClubsForNewUse,
  mapClubError,
  setClubActive,
  updateClub,
} from '@/lib/clubs';

beforeEach(() => vi.clearAllMocks());

describe('club catalogue', () => {
  it('lists every club by name then id', async () => {
    const chain = makeChain({ data: [{ id: 'c1', name: 'Norte' }], error: null });
    mockSupabase.from.mockReturnValue(chain);
    const clubs = await listClubs();
    expect(mockSupabase.from).toHaveBeenCalledWith('clubs');
    expect(chain.select).toHaveBeenCalledWith('id,name,location,phone,email,is_active,updated_at');
    expect(chain.order).toHaveBeenNthCalledWith(1, 'name', { ascending: true });
    expect(chain.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    expect(clubs).toEqual([{ id: 'c1', name: 'Norte' }]);
  });

  it('creates a club with only name, place, and contact', async () => {
    const chain = makeChain({ data: { id: 'c2', name: 'Norte' }, error: null });
    mockSupabase.from.mockReturnValue(chain);
    await createClub({
      name: ' Norte ',
      location: ' Hall ',
      phone: '',
      email: ' desk@example.com ',
      id: 'nope',
      is_active: false,
      created_at: 'yesterday',
    });
    expect(chain.insert).toHaveBeenCalledWith({
      name: 'Norte',
      location: 'Hall',
      phone: null,
      email: 'desk@example.com',
    });
  });

  it('updates the same detail fields and no status', async () => {
    const chain = makeChain({ data: { id: 'c2' }, error: null });
    mockSupabase.from.mockReturnValue(chain);
    await updateClub('c2', { name: 'Sur', location: '', phone: '1', email: '', is_active: false });
    expect(chain.update).toHaveBeenCalledWith({
      name: 'Sur',
      location: null,
      phone: '1',
      email: null,
    });
    expect(chain.eq).toHaveBeenCalledWith('id', 'c2');
  });

  it('refuses a blank name before sending a request', async () => {
    await expect(createClub({ name: '   ' })).rejects.toThrow('name is required');
    await expect(updateClub('c2', { name: '' })).rejects.toThrow('name is required');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('maps a duplicate name and a permission failure', () => {
    expect(mapClubError({ code: '23505', message: 'duplicate key clubs_name_lower_unique' }).message)
      .toMatch(/already exists/);
    expect(mapClubError({ code: '42501', message: 'row-level security policy' }).message)
      .toMatch(/not allowed/);
    expect(mapClubError({ code: '23514', message: 'club name is required' }).message)
      .toMatch(/name is required/);
  });

  it('does not export a delete operation', async () => {
    const module = await import('@/lib/clubs');
    expect(module.deleteClub).toBeUndefined();
    expect(Object.keys(module)).not.toContain('deleteClub');
  });
});

describe('club activation', () => {
  it('sends only is_active when activating or deactivating', async () => {
    const chain = makeChain({ data: { id: 'c2', is_active: false }, error: null });
    mockSupabase.from.mockReturnValue(chain);
    await setClubActive('c2', false);
    expect(chain.update).toHaveBeenCalledWith({ is_active: false });
    await setClubActive('c2', true);
    expect(chain.update).toHaveBeenLastCalledWith({ is_active: true });
    expect(chain.update.mock.calls.every(([payload]) => Object.keys(payload).length === 1)).toBe(true);
  });

  it('reports a non-admin status change as not allowed', async () => {
    const chain = makeChain({
      data: null,
      error: { code: '42501', message: 'new row violates row-level security policy' },
    });
    mockSupabase.from.mockReturnValue(chain);
    await expect(setClubActive('c2', false)).rejects.toThrow('not allowed');
  });
});

describe('clubs offered for new use', () => {
  it('reads only id, name, and location from the active-club view', async () => {
    const chain = makeChain({ data: [{ id: 'c1', name: 'Norte', location: null }], error: null });
    mockSupabase.from.mockReturnValue(chain);
    const clubs = await listClubsForNewUse();
    expect(mockSupabase.from).toHaveBeenCalledWith('clubs_for_new_use');
    expect(chain.select).toHaveBeenCalledWith('id,name,location');
    expect(clubs).toHaveLength(1);
  });

  it('does not query people, bookings, lessons, camps, or the private predicate', () => {
    const source = readFileSync(new URL('./clubs.js', import.meta.url), 'utf8');
    for (const table of ['profiles', 'bookings', 'lessons', 'camps']) {
      expect(source).not.toContain(`from('${table}')`);
    }
    expect(source).not.toContain('club_is_selectable_for_new_use');
    expect(source).not.toContain('deleteClub');
  });
});
