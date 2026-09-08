import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      order: vi.fn(() => chain),
      single: vi.fn(() => chain),
      then: (resolve) => Promise.resolve(result).then(resolve),
    };
    return chain;
  };
  const mockSupabase = { from: vi.fn() };
  return { mockSupabase, makeChain };
});

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import { archiveChild, childPayload, createChild } from '@/lib/children';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('childPayload allow-list', () => {
  it('keeps only child personal fields', () => {
    expect(childPayload({
      first_name: 'Mia',
      last_name: 'Parent',
      date_of_birth: '2017-01-01',
      padel_level: 'beginner',
      allergies: 'nuts',
      emergency_contact_name: 'Alex',
      emergency_contact_phone: '+41',
      parent_id: 'should-not-copy',
      role: 'admin',
    })).toEqual({
      first_name: 'Mia',
      last_name: 'Parent',
      date_of_birth: '2017-01-01',
      padel_level: 'beginner',
      allergies: 'nuts',
      emergency_contact_name: 'Alex',
      emergency_contact_phone: '+41',
    });
  });
});

describe('archive vs delete', () => {
  it('archives with archived_at and never calls delete', async () => {
    const chain = makeChain({ data: { id: 'k1', archived_at: 'now' }, error: null });
    mockSupabase.from.mockReturnValue(chain);
    await archiveChild('k1');
    expect(mockSupabase.from).toHaveBeenCalledWith('children');
    expect(chain.update).toHaveBeenCalled();
    expect(chain.delete).toBeUndefined();
  });
});

describe('error mapping', () => {
  it('maps inactive parent writes', async () => {
    const chain = makeChain({ data: null, error: { message: 'inactive profile' } });
    mockSupabase.from.mockReturnValue(chain);
    await expect(createChild({ first_name: 'Mia', last_name: 'P' }, 'p1'))
      .rejects.toThrow('This client profile is inactive. Contact the academy.');
  });
});
