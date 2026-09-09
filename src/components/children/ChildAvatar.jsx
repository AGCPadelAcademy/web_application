import { useEffect, useState } from 'react';
import { childAvatarSignedUrl } from '@/lib/children';

const SIZES = {
  sm: 'w-10 h-10 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-24 h-24 text-2xl',
};

/** Child profile image from the private bucket, or a default initials avatar. */
const ChildAvatar = ({ child, size = 'md' }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (child?.avatar_path) {
      childAvatarSignedUrl(child.avatar_path).then((signed) => {
        if (!cancelled) setUrl(signed);
      });
    } else {
      setUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [child?.avatar_path]);

  const dims = SIZES[size] ?? SIZES.md;
  const name = [child?.first_name, child?.last_name].filter(Boolean).join(' ') || 'Child';

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${dims} rounded-full object-cover border border-gray-700 shrink-0`}
      />
    );
  }

  const initials = `${child?.first_name?.[0] ?? ''}${child?.last_name?.[0] ?? ''}`.toUpperCase() || '?';
  return (
    <div
      aria-label={`${name} default avatar`}
      className={`${dims} rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center text-green-400 font-bold shrink-0`}
    >
      {initials}
    </div>
  );
};

export default ChildAvatar;
