import { useId } from 'react';

const LanguageFlag = ({ code }) => {
  const clipId = useId();
  if (code === 'ES') {
    return (
      <svg viewBox="0 0 24 16" className="w-6 h-4 rounded-sm" aria-hidden="true">
        <rect width="24" height="16" fill="#c60b1e" />
        <rect y="4" width="24" height="8" fill="#ffc400" />
      </svg>
    );
  }
  if (code === 'DE') {
    return (
      <svg viewBox="0 0 24 16" className="w-6 h-4 rounded-sm" aria-hidden="true">
        <rect width="24" height="16" fill="#ffce00" />
        <rect width="24" height="10.67" fill="#dd0000" />
        <rect width="24" height="5.33" fill="#000" />
      </svg>
    );
  }
  if (code === 'FR') {
    return (
      <svg viewBox="0 0 24 16" className="w-6 h-4 rounded-sm" aria-hidden="true">
        <rect width="24" height="16" fill="#ed2939" />
        <rect width="16" height="16" fill="#fff" />
        <rect width="8" height="16" fill="#002395" />
      </svg>
    );
  }
  if (code === 'IT') {
    return (
      <svg viewBox="0 0 24 16" className="w-6 h-4 rounded-sm" aria-hidden="true">
        <rect width="24" height="16" fill="#ce2b37" />
        <rect width="16" height="16" fill="#fff" />
        <rect width="8" height="16" fill="#009246" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 30" className="w-6 h-4 rounded-sm" aria-hidden="true">
      <clipPath id={clipId}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clipId})`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
};

export default LanguageFlag;
