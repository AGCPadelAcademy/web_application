
export function isProfileComplete(profile) {
  if (!profile) return false;
  
  const requiredFields = ['full_name', 'phone', 'address', 'postal_code', 'city', 'country'];
  
  for (const field of requiredFields) {
    if (!profile[field] || typeof profile[field] !== 'string' || profile[field].trim() === '') {
      return false;
    }
  }
  
  return true;
}

export function getProfileCompletionStatus(profile) {
  if (!profile) return { isComplete: false, missingFields: ['all'] };

  const requiredFields = ['full_name', 'phone', 'address', 'postal_code', 'city', 'country'];
  const missingFields = requiredFields.filter(
    field => !profile[field] || typeof profile[field] !== 'string' || profile[field].trim() === ''
  );

  return {
    isComplete: missingFields.length === 0,
    missingFields
  };
}
