import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      single: vi.fn(() => chain),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  return { mockSupabase: { from: vi.fn() }, makeChain };
});

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import {
  EDITABLE_PROFILE_FIELDS,
  formDataToProfilePayload,
  getOrCreateProfile,
  mapProfileError,
  profileToFormData,
} from '@/lib/profileService';

beforeEach(() => vi.clearAllMocks());

describe('profile form contract', () => {
  it('maps DOB and academy-controlled fields as read-only values', () => {
    expect(profileToFormData({
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      date_of_birth: '1990-01-02',
      role: 'coach',
      is_active: false,
    })).toMatchObject({
      date_of_birth: '1990-01-02',
      role: 'coach',
      is_active: false,
    });
  });

  it('allow-lists owner fields and omits email, role, and status', () => {
    const payload = formDataToProfilePayload({
      first_name: ' Jane ',
      last_name: ' Doe ',
      email: 'changed@example.com',
      role: 'admin',
      is_active: false,
      date_of_birth: '1990-01-02',
    });
    expect(Object.keys(payload).sort()).toEqual([...EDITABLE_PROFILE_FIELDS].sort());
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('role');
    expect(payload).not.toHaveProperty('is_active');
  });
});

describe('getOrCreateProfile', () => {
  it('inserts a missing profile from signed Auth identity', async () => {
    const missing = makeChain({ data: null, error: { code: 'PGRST116' } });
    const created = makeChain({ data: { id: 'u1', email: 'signed@example.com' }, error: null });
    mockSupabase.from.mockReturnValueOnce(missing).mockReturnValueOnce(created);

    await expect(getOrCreateProfile({
      id: 'u1',
      email: 'signed@example.com',
      user_metadata: { full_name: 'Signed User' },
    })).resolves.toMatchObject({ id: 'u1', email: 'signed@example.com' });
    expect(created.insert).toHaveBeenCalledWith([{
      id: 'u1',
      full_name: 'Signed User',
      email: 'signed@example.com',
    }]);
  });

  it('synchronizes only a mismatched signed Auth email', async () => {
    const existing = makeChain({
      data: { id: 'u1', email: 'old@example.com', phone: '123', role: 'student', is_active: true },
      error: null,
    });
    const synced = makeChain({
      data: { id: 'u1', email: 'signed@example.com', phone: '123', role: 'student', is_active: true },
      error: null,
    });
    mockSupabase.from.mockReturnValueOnce(existing).mockReturnValueOnce(synced);

    await getOrCreateProfile({ id: 'u1', email: 'signed@example.com', user_metadata: { phone: '999' } });
    expect(synced.update).toHaveBeenCalledWith(expect.objectContaining({ email: 'signed@example.com' }));
    expect(synced.update.mock.calls[0][0]).not.toHaveProperty('phone');
    expect(synced.update.mock.calls[0][0]).not.toHaveProperty('role');
    expect(synced.update.mock.calls[0][0]).not.toHaveProperty('is_active');
  });

  it('does not write when the exact signed email already matches', async () => {
    const existing = makeChain({ data: { id: 'u1', email: 'signed@example.com' }, error: null });
    mockSupabase.from.mockReturnValue(existing);
    await getOrCreateProfile({ id: 'u1', email: 'signed@example.com' });
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });
});

describe('profile error semantics', () => {
  it.each([
    ['client profile is inactive', 'This client profile is inactive. Contact the academy.'],
    ['profile email is managed by authentication', 'You are not allowed to change this field.'],
    ['date of birth cannot be in the future', 'Date of birth cannot be in the future.'],
  ])('maps %s', (message, expected) => {
    expect(mapProfileError({ message }).message).toBe(expected);
  });
});
