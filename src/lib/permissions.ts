import type { Role } from "@/db/schema";

export type Permission =
  | "dashboard:view"
  | "calendar:view"
  | "appointments:manage"
  | "customers:view"
  | "customers:manage"
  | "services:manage"
  | "staff:manage"
  | "analytics:view"
  | "settings:manage"
  | "team:manage";

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    "dashboard:view", "calendar:view", "appointments:manage", "customers:view", "customers:manage",
    "services:manage", "staff:manage", "analytics:view", "settings:manage", "team:manage",
  ],
  admin: [
    "dashboard:view", "calendar:view", "appointments:manage", "customers:view", "customers:manage",
    "services:manage", "staff:manage", "analytics:view", "settings:manage",
  ],
  staff: ["calendar:view", "appointments:manage", "customers:view", "customers:manage"],
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}
