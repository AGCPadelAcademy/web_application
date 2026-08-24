
export function isProfileComplete(profile) {
  if (!profile) return false;

  const requiredFields = ['first_name', 'last_name', 'phone', 'address', 'postal_code', 'city', 'country_code'];

  for (const field of requiredFields) {
    if (!profile[field] || typeof profile[field] !== 'string' || profile[field].trim() === '') {
      return false;
    }
  }

  return true;
}

export function getProfileCompletionStatus(profile) {
  if (!profile) return { isComplete: false, missingFields: ['all'] };

  const requiredFields = ['first_name', 'last_name', 'phone', 'address', 'postal_code', 'city', 'country_code'];
  const missingFields = requiredFields.filter(
    field => !profile[field] || typeof profile[field] !== 'string' || profile[field].trim() === ''
  );

  return {
    isComplete: missingFields.length === 0,
    missingFields
  };
}
