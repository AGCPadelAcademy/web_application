export interface ProfileAccess {
  role: string;
  isActive: boolean;
  exists: boolean;
}

export function parseProfileAccess(
  row: { role?: unknown; is_active?: unknown } | null | undefined,
): ProfileAccess {
  return {
    role: typeof row?.role === "string" ? row.role : "student",
    isActive: row?.is_active === true,
    exists: Boolean(row),
  };
}

export function canAdminister(profile: ProfileAccess): boolean {
  return profile.exists && profile.isActive && profile.role === "admin";
}

export function canMutateOwnedResource(profile: ProfileAccess, isOwner: boolean): boolean {
  return profile.exists && profile.isActive && (isOwner || profile.role === "admin");
}

export function canReadOwnedResource(profile: ProfileAccess, isOwner: boolean): boolean {
  return profile.exists && (isOwner || canAdminister(profile));
}

export async function fetchProfileAccess(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{
            data: { role?: unknown; is_active?: unknown } | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  },
  userId: string,
): Promise<ProfileAccess> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Profile authorization check failed");
  return parseProfileAccess(data);
}
