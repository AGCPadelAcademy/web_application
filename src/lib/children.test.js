import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabase, makeChain } = vi.hoisted(() => {
  const makeChain = (result) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      order: vi.fn(() => chain),
      single: vi.fn(() => chain),
      maybeSingle: vi.fn(() => chain),
      then: (resolve) => Promise.resolve(result).then(resolve),
    };
    return chain;
  };
  const mockSupabase = { from: vi.fn(), storage: { from: vi.fn() } };
  return { mockSupabase, makeChain };
});

vi.mock('@/lib/customSupabaseClient', () => ({ supabase: mockSupabase }));

import {
  archiveChild,
  assembleEmergencyPhone,
  childPayload,
  createChild,
  dobInputToIso,
  dobIsoToInput,
  removeChild,
  splitEmergencyPhone,
  uploadChildAvatar,
  validateChildAvatarFile,
} from '@/lib/children';

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

describe('date of birth manual entry', () => {
  it('parses DD.MM.YYYY and passes ISO through', () => {
    expect(dobInputToIso('5.3.2017')).toBe('2017-03-05');
    expect(dobInputToIso('05.03.2017')).toBe('2017-03-05');
    expect(dobInputToIso('2017-03-05')).toBe('2017-03-05');
  });

  it('rejects impossible or malformed dates', () => {
    expect(dobInputToIso('31.02.2017')).toBeNull();
    expect(dobInputToIso('32.01.2017')).toBeNull();
    expect(dobInputToIso('abc')).toBeNull();
    expect(dobInputToIso('')).toBeNull();
  });

  it('formats ISO back to DD.MM.YYYY for the field', () => {
    expect(dobIsoToInput('2017-03-05')).toBe('05.03.2017');
    expect(dobIsoToInput(null)).toBe('');
  });
});

describe('emergency phone split and assembly', () => {
  it('assembles E.164 from prefix and national number', () => {
    expect(assembleEmergencyPhone('+41', '76 611 40 61')).toBe('+41766114061');
    expect(assembleEmergencyPhone('+41', '076 611 40 61')).toBe('+41766114061');
    expect(assembleEmergencyPhone('+49', '151 234')).toBe('+49151234');
  });

  it('returns empty only when both parts are empty and null when invalid', () => {
    expect(assembleEmergencyPhone('', '')).toBe('');
    expect(assembleEmergencyPhone('+41', '')).toBeNull();
    expect(assembleEmergencyPhone('abc', '76')).toBeNull();
  });

  it('splits stored values back into prefix and national', () => {
    expect(splitEmergencyPhone('+41766114061')).toEqual({ prefix: '+41', national: '766114061' });
    expect(splitEmergencyPhone('+423661234')).toEqual({ prefix: '+423', national: '661234' });
    expect(splitEmergencyPhone('')).toEqual({ prefix: '+41', national: '' });
  });
});

describe('avatar file validation', () => {
  it('accepts allowed image types within the size limit', () => {
    expect(validateChildAvatarFile(null)).toBeNull();
    expect(validateChildAvatarFile({ type: 'image/png', size: 1000, name: 'a.png' })).toBeNull();
  });

  it('rejects non-images and oversize files', () => {
    expect(validateChildAvatarFile({ type: 'application/pdf', size: 1000, name: 'a.pdf' })).toMatch(/PNG, JPEG, or WebP/);
    expect(validateChildAvatarFile({ type: 'image/png', size: 6 * 1024 * 1024, name: 'a.png' })).toMatch(/5 MB/);
  });

  it('does not touch storage when the file is invalid', async () => {
    await expect(uploadChildAvatar('c1', 'p1', { type: 'text/plain', size: 10, name: 'a.txt' }))
      .rejects.toThrow(/PNG, JPEG, or WebP/);
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
  });
});

describe('archive vs delete', () => {
  it('archives with archived_at and never calls delete', async () => {
    const chain = makeChain({ data: { id: 'k1', archived_at: 'now' }, error: null });
    mockSupabase.from.mockReturnValue(chain);
    await archiveChild('k1');
    expect(mockSupabase.from).toHaveBeenCalledWith('children');
    expect(chain.update).toHaveBeenCalled();
  });

  it('removeChild issues a delete and expects a deleted row back', async () => {
    const chain = makeChain({ data: [{ id: 'k1' }], error: null });
    mockSupabase.from.mockReturnValue(chain);
    await removeChild('k1');
    expect(chain.delete).toHaveBeenCalled();
  });

  it('removeChild fails when RLS permits no row', async () => {
    const chain = makeChain({ data: [], error: null });
    mockSupabase.from.mockReturnValue(chain);
    await expect(removeChild('k1')).rejects.toThrow(/not found or not permitted/);
  });

  it('removeChild maps the history FK refusal to an explanation', async () => {
    const chain = makeChain({
      data: null,
      error: { code: '23503', message: 'update or delete violates foreign key constraint' },
    });
    mockSupabase.from.mockReturnValue(chain);
    await expect(removeChild('k1')).rejects.toThrow(/registrations or invoices/);
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
