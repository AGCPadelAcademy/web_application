import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'token' } } })) },
    functions: { invoke: vi.fn(async () => ({ data: { method: 'qr_invoice' }, error: null })) },
  },
}));

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import {
  COLLECTION_COPY,
  FORBIDDEN_COLLECTION_PHRASES,
  requestNewMandate,
  setCollectionMethod,
} from '@/lib/membershipCollection';

beforeEach(() => vi.clearAllMocks());

describe('membership collection copy', () => {
  it('does not use forbidden phrases', () => {
    const copy = Object.values(COLLECTION_COPY).join(' ');
    for (const phrase of FORBIDDEN_COLLECTION_PHRASES) {
      expect(copy).not.toContain(phrase);
    }
  });

  it('posts the collection method and a new mandate request', async () => {
    await setCollectionMethod('subject-1', 'qr_invoice');
    await requestNewMandate('subject-1');
    expect(mockSupabase.functions.invoke).toHaveBeenNthCalledWith(
      1,
      'membership-set-collection-method',
      expect.objectContaining({ body: { subject_id: 'subject-1', method: 'qr_invoice' } }),
    );
    expect(mockSupabase.functions.invoke).toHaveBeenNthCalledWith(
      2,
      'membership-request-mandate',
      expect.objectContaining({ body: { subject_id: 'subject-1' } }),
    );
  });
});
