import CountrySelect from '@/components/profile/CountrySelect';

const NewProfileFields = ({ form, onChange, disabled = false }) => (
  <div className="nf-form nf-skin">
    <label htmlFor="first_name">First name</label>
    <input id="first_name" name="first_name" value={form.first_name} onChange={onChange} required disabled={disabled} />
    <label htmlFor="last_name">Last name</label>
    <input id="last_name" name="last_name" value={form.last_name} onChange={onChange} required disabled={disabled} />
    <label htmlFor="email">Email</label>
    <input id="email" name="email" value={form.email} readOnly />
    <label htmlFor="phone">Phone</label>
    <input id="phone" name="phone" type="tel" value={form.phone} onChange={onChange} disabled={disabled} />
    <label htmlFor="date_of_birth">Date of birth (optional)</label>
    <input id="date_of_birth" name="date_of_birth" type="date" max={new Date().toISOString().slice(0, 10)} value={form.date_of_birth || ''} onChange={onChange} disabled={disabled} />
    <label htmlFor="address">Street address</label>
    <input id="address" name="address" value={form.address} onChange={onChange} disabled={disabled} />
    <label htmlFor="postal_code">Postal code</label>
    <input id="postal_code" name="postal_code" value={form.postal_code} onChange={onChange} disabled={disabled} />
    <label htmlFor="city">City</label>
    <input id="city" name="city" value={form.city} onChange={onChange} disabled={disabled} />
    <CountrySelect value={form.country_code} onChange={onChange} required />
    <label htmlFor="role">Role</label>
    <input id="role" value={form.role || ''} readOnly />
    <label htmlFor="profile_status">Status</label>
    <input id="profile_status" value={form.is_active ? 'Active' : 'Inactive'} readOnly />
  </div>
);

export default NewProfileFields;
