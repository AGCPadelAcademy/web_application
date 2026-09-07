import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canAdminister,
  canMutateOwnedResource,
  canReadOwnedResource,
  parseProfileAccess,
} from "./profile-access.ts";

Deno.test("active owner and active admin may mutate owned resources", () => {
  assertEquals(
    canMutateOwnedResource(parseProfileAccess({ role: "student", is_active: true }), true),
    true,
  );
  assertEquals(
    canMutateOwnedResource(parseProfileAccess({ role: "admin", is_active: true }), false),
    true,
  );
});

Deno.test("inactive owner and inactive admin may not mutate", () => {
  assertEquals(
    canMutateOwnedResource(parseProfileAccess({ role: "student", is_active: false }), true),
    false,
  );
  assertEquals(
    canMutateOwnedResource(parseProfileAccess({ role: "admin", is_active: false }), false),
    false,
  );
  assertEquals(canAdminister(parseProfileAccess({ role: "admin", is_active: false })), false);
});

Deno.test("missing profile fails closed", () => {
  assertEquals(canMutateOwnedResource(parseProfileAccess(null), true), false);
  assertEquals(canReadOwnedResource(parseProfileAccess(null), true), false);
  assertEquals(canAdminister(parseProfileAccess(null)), false);
});

Deno.test("inactive owner keeps read access while inactive admin loses broad access", () => {
  const inactiveStudent = parseProfileAccess({ role: "student", is_active: false });
  const inactiveAdmin = parseProfileAccess({ role: "admin", is_active: false });
  assertEquals(canReadOwnedResource(inactiveStudent, true), true);
  assertEquals(canReadOwnedResource(inactiveAdmin, false), false);
});
