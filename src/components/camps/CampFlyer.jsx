import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { campFlyerSignedUrl } from '@/lib/camps';

/**
 * Camp flyer thumbnail with a signed URL from the private bucket.
 * The fallback (no flyer) is intentionally non-interactive: only real
 * flyers open the larger view.
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
        className={`rounded-xl bg-gray-900 border border-gray-800 flex flex-col items-center justify-center text-gray-600 gap-1 ${className}`}
      >
        <ImageIcon className="w-6 h-6" />
        <span className="text-xs font-semibold">{initial}</span>
      </div>
    );
  }

  if (!url) {
    return <div className={`rounded-xl bg-gray-900 border border-gray-800 animate-pulse ${className}`} />;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen?.(url, camp.name)}
      aria-label={`Enlarge the ${camp.name} flyer`}
      className={`rounded-xl overflow-hidden border border-gray-800 hover:border-green-500/60 transition-colors ${className}`}
    >
      <img src={url} alt={`${camp.name} flyer`} className="w-full h-full object-contain bg-gray-900" />
    </button>
  );
};

export default CampFlyer;
