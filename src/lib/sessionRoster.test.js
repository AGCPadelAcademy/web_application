import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  const mockSupabase = { from: vi.fn() };
  return { mockSupabase, makeChain };
});

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import { fetchSessionRoster, SESSION_ROSTER_COLUMNS } from '@/lib/sessionRoster';

describe('fetchSessionRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects the contract columns from session_roster', async () => {
    const rows = [
      {
        booking_id: 'booking-a',
        booking_date: '2026-09-01',
        start_time: '10:00:00',
        end_time: '11:00:00',
        lesson_name: 'Individual Session 60',
        participant_full_name: 'Student A',
        coach_id: 'coach-c',
      },
    ];
    const chain = makeChain({ data: rows, error: null });
    mockSupabase.from.mockReturnValue(chain);

    await expect(fetchSessionRoster()).resolves.toEqual(rows);

    expect(mockSupabase.from).toHaveBeenCalledWith('session_roster');
    expect(chain.select).toHaveBeenCalledWith(SESSION_ROSTER_COLUMNS);
    expect(chain.order).toHaveBeenNthCalledWith(1, 'booking_date', { ascending: true });
    expect(chain.order).toHaveBeenNthCalledWith(2, 'start_time', { ascending: true });
  });

  it('returns an empty list when there are no assignments', async () => {
    const chain = makeChain({ data: [], error: null });
    mockSupabase.from.mockReturnValue(chain);

    await expect(fetchSessionRoster()).resolves.toEqual([]);
  });

  it('returns an empty list when data is null', async () => {
    const chain = makeChain({ data: null, error: null });
    mockSupabase.from.mockReturnValue(chain);

    await expect(fetchSessionRoster()).resolves.toEqual([]);
  });

  it('throws when PostgREST returns an error', async () => {
    const chain = makeChain({ data: null, error: { message: 'permission denied' } });
    mockSupabase.from.mockReturnValue(chain);

    await expect(fetchSessionRoster()).rejects.toMatchObject({ message: 'permission denied' });
  });
});
