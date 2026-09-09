import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PHONE_PREFIXES } from '@/lib/phonePrefixes';
import {
  assembleEmergencyPhone,
  dobInputToIso,
  dobIsoToInput,
  splitEmergencyPhone,
  validateChildAvatarFile,
} from '@/lib/children';

const inputClass = 'bg-gray-950 border-gray-700 text-white';

/**
 * Child create/edit form. Create mode omits padel level (decision 2026-09-09:
 * level is maintained on the child profile-management view instead).
 */
const ChildForm = ({
  mode = 'create',
  initial = null,
  submitting = false,
  submitLabel,
  onSubmit,
}) => {
  const [firstName, setFirstName] = useState(initial?.first_name ?? '');
  const [lastName, setLastName] = useState(initial?.last_name ?? '');
  const [dob, setDob] = useState(dobIsoToInput(initial?.date_of_birth));
  const [level, setLevel] = useState(initial?.padel_level ?? '');
  const [allergies, setAllergies] = useState(initial?.allergies ?? '');
  const [emName, setEmName] = useState(initial?.emergency_contact_name ?? '');
  const initialPhone = splitEmergencyPhone(initial?.emergency_contact_phone);
  const [emPrefix, setEmPrefix] = useState(initialPhone.prefix);
  const [emNational, setEmNational] = useState(initialPhone.national);
  const [avatarFile, setAvatarFile] = useState(null);
  const [errors, setErrors] = useState({});

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!firstName.trim()) nextErrors.first_name = 'Required';
    if (!lastName.trim()) nextErrors.last_name = 'Required';
    const dobIso = dobInputToIso(dob);
    if (dob.trim() && !dobIso) nextErrors.date_of_birth = 'Use the DD.MM.YYYY format';
    const phone = assembleEmergencyPhone(emPrefix, emNational);
    if (phone === null) nextErrors.emergency_contact_phone = 'Check the prefix and number';
    const avatarProblem = validateChildAvatarFile(avatarFile);
    if (avatarProblem) nextErrors.avatar = avatarProblem;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const values = {
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dobIso,
      allergies,
      emergency_contact_name: emName,
      emergency_contact_phone: phone || null,
    };
    if (mode !== 'create') values.padel_level = level;
    onSubmit(values, avatarFile);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="child-first-name">First name</Label>
          <Input
            id="child-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
          />
          {errors.first_name && <p className="text-xs text-red-400 mt-1">{errors.first_name}</p>}
        </div>
        <div>
          <Label htmlFor="child-last-name">Last name</Label>
          <Input
            id="child-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
          />
          {errors.last_name && <p className="text-xs text-red-400 mt-1">{errors.last_name}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="child-dob">Date of birth</Label>
        <Input
          id="child-dob"
          inputMode="numeric"
          placeholder="DD.MM.YYYY"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className={inputClass}
        />
        {errors.date_of_birth && <p className="text-xs text-red-400 mt-1">{errors.date_of_birth}</p>}
      </div>

      {mode !== 'create' && (
        <div>
          <Label htmlFor="child-level">Padel level</Label>
          <Input
            id="child-level"
            placeholder="e.g. beginner, intermediate, advanced"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      <div>
        <Label htmlFor="child-allergies">Allergies / important information</Label>
        <Input
          id="child-allergies"
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <Label htmlFor="child-em-name">Emergency contact name</Label>
        <Input
          id="child-em-name"
          value={emName}
          onChange={(e) => setEmName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <Label htmlFor="child-em-national">Emergency contact phone</Label>
        <div className="flex gap-2">
          <div className="w-32 shrink-0">
            <Label htmlFor="child-em-prefix" className="sr-only">Country prefix</Label>
            <Input
              id="child-em-prefix"
              list="child-phone-prefixes"
              inputMode="tel"
              value={emPrefix}
              onChange={(e) => setEmPrefix(e.target.value)}
              className={inputClass}
            />
            <datalist id="child-phone-prefixes">
              {PHONE_PREFIXES.map((prefix) => (
                <option key={prefix} value={prefix} />
              ))}
            </datalist>
          </div>
          <Input
            id="child-em-national"
            inputMode="tel"
            placeholder="76 611 40 61"
            value={emNational}
            onChange={(e) => setEmNational(e.target.value)}
            className={inputClass}
          />
        </div>
        {errors.emergency_contact_phone && (
          <p className="text-xs text-red-400 mt-1">{errors.emergency_contact_phone}</p>
        )}
      </div>

      {mode === 'create' && (
        <div>
          <Label htmlFor="child-avatar">Profile image (optional)</Label>
          <Input
            id="child-avatar"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-gray-800 file:px-3 file:py-1 file:text-sm file:text-gray-200`}
          />
          {errors.avatar && <p className="text-xs text-red-400 mt-1">{errors.avatar}</p>}
        </div>
      )}

      <Button type="submit" disabled={submitting} className="bg-green-500 text-black font-bold w-full">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (submitLabel ?? 'Save child')}
      </Button>
    </form>
  );
};

export default ChildForm;
