import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      range: vi.fn(() => chain),
      single: vi.fn(() => chain),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  return { mockSupabase: { from: vi.fn() }, makeChain };
});

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import {
  activateMembership,
  cancelMembership,
  cancelMyMembership,
  createMembership,
  expireMembership,
  mapMembershipError,
  pauseMembership,
} from '@/lib/memberships';

beforeEach(() => vi.clearAllMocks());

describe('createMembership', () => {
  it('sends the client, group, and monthly price', async () => {
    const chain = makeChain({ data: { id: 'm1', status: 'pending_payment' }, error: null });
    mockSupabase.from.mockReturnValue(chain);
    await createMembership({ clientId: 'c1', groupId: 'g1', monthlyPriceAmount: '200' });
    expect(chain.insert).toHaveBeenCalledWith({
      user_id: 'c1',
      group_id: 'g1',
      monthly_price_amount: '200.00',
      status: 'pending_payment',
    });
  });

  it('refuses a missing group or a non-positive price before the request', async () => {
    await expect(createMembership({ clientId: 'c1', groupId: '', monthlyPriceAmount: 10 })).rejects.toThrow('group');
    await expect(createMembership({ clientId: 'c1', groupId: 'g1', monthlyPriceAmount: 0 })).rejects.toThrow('price');
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('maps a duplicate live place', () => {
    expect(mapMembershipError({ code: '23505', message: 'memberships_one_live_per_client_group' }).message)
      .toMatch(/live membership/);
  });

  it('maps an inactive group and an RLS denial', () => {
    expect(mapMembershipError({ message: 'group is inactive' }).message).toMatch(/not active/);
    expect(mapMembershipError({ code: '42501', message: 'membership create is not permitted' }).message)
      .toMatch(/cannot change/);
  });
});

describe('lifecycle updates', () => {
  it('activate, pause, and expire send only the status', async () => {
    const chain = makeChain({ data: { id: 'm1' }, error: null });
    mockSupabase.from.mockReturnValue(chain);
    await activateMembership('m1');
    await pauseMembership('m1');
    await expireMembership('m1');
    expect(chain.update).toHaveBeenNthCalledWith(1, { status: 'active' });
    expect(chain.update).toHaveBeenNthCalledWith(2, { status: 'paused' });
    expect(chain.update).toHaveBeenNthCalledWith(3, { status: 'expired' });
  });

  it('cancel and cancelMyMembership send cancelled', async () => {
    const chain = makeChain({ data: { id: 'm1', status: 'cancelled' }, error: null });
    mockSupabase.from.mockReturnValue(chain);
    await cancelMembership('m1');
    await cancelMyMembership('m1');
    expect(chain.update).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'm1');
  });

  it('maps an invalid transition', async () => {
    const chain = makeChain({ data: null, error: { message: 'membership transition is not allowed' } });
    mockSupabase.from.mockReturnValue(chain);
    await expect(activateMembership('m1')).rejects.toThrow('not allowed');
  });
});
