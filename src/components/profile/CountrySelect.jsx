import { Label } from '@/components/ui/label';
import { Globe } from 'lucide-react';
import { countriesForSelect } from '@/lib/countries';

const OPTIONS = countriesForSelect('en');

export default function CountrySelect({ id = 'country_code', value, onChange, required = false }) {
  return (
    <div className="space-y-3">
      <Label htmlFor={id} className="flex items-center gap-2 text-gray-200 text-base font-semibold">
        <Globe className="w-4 h-4 text-green-500" /> Country
      </Label>
      <select
        id={id}
        name="country_code"
        value={value || ''}
        onChange={onChange}
        required={required}
        className="flex h-12 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-base text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      >
        <option value="" disabled>
          Select country
        </option>
        {OPTIONS.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
