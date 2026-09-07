import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      update: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      range: vi.fn(() => chain),
      or: vi.fn(() => chain),
      single: vi.fn(() => chain),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  return { mockSupabase: { from: vi.fn() }, makeChain };
});

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import {
  ASSIGNABLE_ROLES,
  listClients,
  mapClientManagementError,
  updateClientPersonalFields,
  updateClientRole,
  updateClientStatus,
} from '@/lib/clientManagement';

beforeEach(() => vi.clearAllMocks());

describe('client directory', () => {
  it('uses bounded server-side search, filters, and stable ordering', async () => {
    const chain = makeChain({ data: [{ id: 'u1' }], error: null, count: 1 });
    mockSupabase.from.mockReturnValue(chain);
    const result = await listClients({ search: 'Jane', role: 'student', status: 'active', page: 2, pageSize: 500 });
    expect(chain.or).toHaveBeenCalledWith('full_name.ilike.%Jane%,email.ilike.%Jane%');
    expect(chain.eq).toHaveBeenCalledWith('role', 'student');
    expect(chain.eq).toHaveBeenCalledWith('is_active', true);
    expect(chain.range).toHaveBeenCalledWith(100, 199);
    expect(chain.order).toHaveBeenNthCalledWith(1, 'full_name', { ascending: true });
    expect(chain.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    expect(result).toEqual({ clients: [{ id: 'u1' }], count: 1, page: 2, pageSize: 100 });
  });
});

describe('admin updates', () => {
  it('sends only explicit personal fields', async () => {
    const chain = makeChain({ data: { id: 'u2' }, error: null });
    mockSupabase.from.mockReturnValue(chain);
    await updateClientPersonalFields('u2', {
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'forbidden@example.com',
      role: 'admin',
      is_active: false,
      date_of_birth: '1990-01-01',
    });
    const payload = chain.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('role');
    expect(payload).not.toHaveProperty('is_active');
    expect(payload.date_of_birth).toBe('1990-01-01');
  });

  it('exposes only supported assignable roles', () => {
    expect(ASSIGNABLE_ROLES).toEqual(['student', 'coach', 'admin']);
  });

  it('refuses own-role and accounting assignments before the request', async () => {
    await expect(updateClientRole('self', 'coach', 'self')).rejects.toThrow('own role');
    await expect(updateClientRole('u2', 'accounting', 'self')).rejects.toThrow('Bexio');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('refuses administrator self-deactivation before the request', async () => {
    await expect(updateClientStatus('self', false, 'self')).rejects.toThrow('own administrator');
  });
});

describe('admin error semantics', () => {
  it.each([
    ['own role', 'You cannot change your own role.'],
    ['deactivate their own', 'You cannot deactivate your own administrator profile.'],
    ['accounting is managed', 'Accounting is managed in Bexio and cannot be assigned here.'],
    ['at least one active administrator', 'At least one active administrator is required.'],
  ])('maps %s', (message, expected) => {
    expect(mapClientManagementError({ message }).message).toBe(expected);
  });
});
