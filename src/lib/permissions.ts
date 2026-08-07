export type Permission =
  | 'dashboard:view'
  | 'receiving:view'
  | 'receiving:create'
  | 'receiving:update'
  | 'receiving:publish'
  | 'receiving:cancel'
  | 'session:start'
  | 'session:finish'
  | 'session:cancel'
  | 'sensor:view'
  | 'master_data:manage'
  | 'lines_devices:manage'
  | 'users:manage'
  | 'settings:manage'
  | 'reports:view'
  | 'audit:view';

export const ALL_PERMISSIONS: Permission[] = [
  'dashboard:view',
  'receiving:view',
  'receiving:create',
  'receiving:update',
  'receiving:publish',
  'receiving:cancel',
  'session:start',
  'session:finish',
  'session:cancel',
  'sensor:view',
  'master_data:manage',
  'lines_devices:manage',
  'users:manage',
  'settings:manage',
  'reports:view',
  'audit:view',
];

export const OPERATOR_PERMISSIONS: Permission[] = [
  'dashboard:view',
  'receiving:view',
  'session:start',
  'session:finish',
  'sensor:view',
];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OPERATOR: OPERATOR_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS,
};

export function getPermissionsForRoles(roles: string[]): Permission[] {
  const permSet = new Set<Permission>();
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role.toUpperCase()] || [];
    for (const perm of perms) {
      permSet.add(perm);
    }
  }
  return Array.from(permSet);
}

export function hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
  return userPermissions.includes(requiredPermission);
}
