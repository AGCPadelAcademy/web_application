import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      update: vi.fn(() => chain),
      single: vi.fn(() => chain),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  const mockSupabase = { from: vi.fn() };
  return { mockSupabase, makeChain };
});

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import {
  listCoachProfiles,
  listBookingsForAssignment,
  updateBookingCoachId,
  coachAssignmentErrorMessage,
  isCoachAssignmentAvailable,
  isMissingCoachAssignmentSchema,
} from '@/lib/coachAssignments';

describe('listCoachProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists profiles with role coach', async () => {
    const coaches = [{ id: 'coach-c', full_name: 'Coach C' }];
    const chain = makeChain({ data: coaches, error: null });
    mockSupabase.from.mockReturnValue(chain);

    await expect(listCoachProfiles()).resolves.toEqual(coaches);

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(chain.select).toHaveBeenCalledWith('id, full_name');
    expect(chain.eq).toHaveBeenCalledWith('role', 'coach');
    expect(chain.eq).toHaveBeenCalledWith('is_active', true);
  });
});

describe('listBookingsForAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads bookings then participant names', async () => {
    const bookingsChain = makeChain({
      data: [
        {
          id: 'booking-a',
          booking_date: '2026-09-01',
          start_time: '10:00:00',
          end_time: '11:00:00',
          lesson_name: 'Individual Session 60',
          coach_id: null,
          user_id: 'student-a',
        },
      ],
      error: null,
    });
    const profilesChain = makeChain({
      data: [{ id: 'student-a', full_name: 'Student A' }],
      error: null,
    });
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'bookings') return bookingsChain;
      if (table === 'profiles') return profilesChain;
      throw new Error(`unexpected table ${table}`);
    });

    await expect(listBookingsForAssignment()).resolves.toEqual([
      expect.objectContaining({
        id: 'booking-a',
        participant_full_name: 'Student A',
      }),
    ]);

    expect(mockSupabase.from).toHaveBeenCalledWith('bookings');
    expect(bookingsChain.select).toHaveBeenCalledWith(
      'id, booking_date, start_time, end_time, lesson_name, coach_id, user_id'
    );
    expect(profilesChain.in).toHaveBeenCalledWith('id', ['student-a']);
  });

  it('keeps the current coach name when that coach is inactive', async () => {
    const bookingsChain = makeChain({
      data: [
        {
          id: 'booking-b',
          booking_date: '2026-09-02',
          start_time: '12:00:00',
          end_time: '13:00:00',
          lesson_name: 'Group Session',
          coach_id: 'coach-d',
          user_id: 'student-b',
        },
      ],
      error: null,
    });
    const profilesChain = makeChain({
      data: [
        { id: 'student-b', full_name: 'Student B', is_active: true },
        { id: 'coach-d', full_name: 'Coach D', is_active: false },
      ],
      error: null,
    });
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'bookings') return bookingsChain;
      if (table === 'profiles') return profilesChain;
      throw new Error(`unexpected table ${table}`);
    });

    await expect(listBookingsForAssignment()).resolves.toEqual([
      expect.objectContaining({
        id: 'booking-b',
        participant_full_name: 'Student B',
        coach_full_name: 'Coach D',
        coach_is_active: false,
      }),
    ]);
    expect(profilesChain.in).toHaveBeenCalledWith('id', ['student-b', 'coach-d']);
  });
});

describe('updateBookingCoachId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates bookings.coach_id', async () => {
    const chain = makeChain({ data: { id: 'booking-a', coach_id: 'coach-c' }, error: null });
    mockSupabase.from.mockReturnValue(chain);

    await expect(updateBookingCoachId('booking-a', 'coach-c')).resolves.toEqual({
      id: 'booking-a',
      coach_id: 'coach-c',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('bookings');
    expect(chain.update).toHaveBeenCalledWith({ coach_id: 'coach-c' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'booking-a');
  });

  it('clears coach_id to null', async () => {
    const chain = makeChain({ data: { id: 'booking-a', coach_id: null }, error: null });
    mockSupabase.from.mockReturnValue(chain);

    await expect(updateBookingCoachId('booking-a', null)).resolves.toEqual({
      id: 'booking-a',
      coach_id: null,
    });

    expect(chain.update).toHaveBeenCalledWith({ coach_id: null });
  });
});

describe('isCoachAssignmentAvailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when bookings.coach_id can be selected', async () => {
    const chain = makeChain({ data: [], error: null });
    mockSupabase.from.mockReturnValue(chain);

    await expect(isCoachAssignmentAvailable()).resolves.toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('bookings');
    expect(chain.select).toHaveBeenCalledWith('coach_id');
  });

  it('returns false when PostgREST has not cached coach_id yet', async () => {
    const chain = makeChain({
      data: null,
      error: { code: 'PGRST204', message: "Could not find the 'coach_id' column of 'bookings' in the schema cache" },
    });
    mockSupabase.from.mockReturnValue(chain);

    await expect(isCoachAssignmentAvailable()).resolves.toBe(false);
  });
});

describe('isMissingCoachAssignmentSchema', () => {
  it('detects missing-column errors', () => {
    expect(isMissingCoachAssignmentSchema({ code: '42703', message: 'column coach_id does not exist' })).toBe(true);
    expect(isMissingCoachAssignmentSchema({ message: 'permission denied' })).toBe(false);
  });
});

describe('coachAssignmentErrorMessage', () => {
  it('maps trigger errors without echoing identifiers', () => {
    expect(
      coachAssignmentErrorMessage({ message: 'only an administrator can change coach assignment' })
    ).toBe('Only an administrator can change coach assignment.');
    expect(
      coachAssignmentErrorMessage({
        message: 'coach_id must reference a profile with role coach',
      })
    ).toBe('That profile is not a coach. Choose a coach or clear the assignment.');
    expect(
      coachAssignmentErrorMessage({
        message: 'coach_id must reference an active coach',
      })
    ).toBe('That coach is inactive. Choose an active coach or clear the assignment.');
    expect(coachAssignmentErrorMessage({ message: 'PGRST116 on 11111111-2222-3333-4444-555555555555' })).toBe(
      'Could not update the coach assignment.'
    );
  });
});
