import { describe, it, expect } from 'vitest';
import { isProfileComplete, getProfileCompletionStatus } from '@/lib/profileValidation';

const completeProfile = {
  full_name: 'Jane Doe',
  phone: '+41791234567',
  address: 'Rue du Lac 1',
  postal_code: '1000',
  city: 'Lausanne',
  country: 'Switzerland',
};

describe('isProfileComplete', () => {
  it('returns true when all required fields are non-empty strings', () => {
    expect(isProfileComplete(completeProfile)).toBe(true);
  });

  it('returns false for null or undefined profiles', () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });

  it.each(['full_name', 'phone', 'address', 'postal_code', 'city', 'country'])(
    'returns false when %s is missing',
    (field) => {
      const profile = { ...completeProfile };
      delete profile[field];
      expect(isProfileComplete(profile)).toBe(false);
    }
  );

  it('returns false when a field is empty or whitespace-only', () => {
    expect(isProfileComplete({ ...completeProfile, phone: '' })).toBe(false);
    expect(isProfileComplete({ ...completeProfile, city: '   ' })).toBe(false);
  });

  it('returns false when a field is not a string', () => {
    expect(isProfileComplete({ ...completeProfile, postal_code: 1000 })).toBe(false);
  });
});

describe('getProfileCompletionStatus', () => {
  it('reports completion with no missing fields', () => {
    expect(getProfileCompletionStatus(completeProfile)).toEqual({ isComplete: true, missingFields: [] });
  });

  it('lists every missing field', () => {
    const { isComplete, missingFields } = getProfileCompletionStatus({
      ...completeProfile,
      phone: '',
      country: undefined,
    });
    expect(isComplete).toBe(false);
    expect(missingFields).toEqual(['phone', 'country']);
  });

  it('reports ["all"] for a null profile', () => {
    expect(getProfileCompletionStatus(null)).toEqual({ isComplete: false, missingFields: ['all'] });
  });
});
