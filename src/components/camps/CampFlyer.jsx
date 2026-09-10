import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { campFlyerSignedUrl } from '@/lib/camps';

/**
 * Camp flyer thumbnail with a signed URL from the private bucket.
 * The fallback (no flyer) is intentionally non-interactive: only real
 * flyers open the larger view. The control sizes to the image (C6 T122).
 */
const CampFlyer = ({ camp, onOpen, className = '' }) => {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (camp?.flyer_path) {
      campFlyerSignedUrl(camp.flyer_path).then((signed) => {
        if (!cancelled) setUrl(signed);
      });
    } else {
      setUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [camp?.flyer_path]);

  const initial = (camp?.name?.[0] || 'C').toUpperCase();

  if (!camp?.flyer_path) {
    return (
      <div
        aria-hidden="true"
        className={`rounded-xl bg-gray-900 flex flex-col items-center justify-center text-gray-600 gap-1 min-h-[8rem] ${className}`}
      >
        <ImageIcon className="w-6 h-6" />
        <span className="text-xs font-semibold">{initial}</span>
      </div>
    );
  }

  if (!url) {
    return <div className={`rounded-xl bg-gray-900 animate-pulse min-h-[8rem] ${className}`} />;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen?.(url, camp.name)}
      aria-label={`Enlarge the ${camp.name} flyer`}
      className={`block p-0 bg-transparent rounded-xl overflow-hidden hover:opacity-95 transition-opacity ${className}`}
    >
      <img src={url} alt={`${camp.name} flyer`} className="w-full h-auto object-contain" />
    </button>
  );
};

export default CampFlyer;
