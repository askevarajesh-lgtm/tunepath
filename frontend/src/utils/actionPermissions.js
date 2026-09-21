/**
 * PERMISSION_ACTIONS constants
 * Maps action names to their permission keys used throughout the app.
 */
export const PERMISSION_ACTIONS = {
  // Task actions
  CREATE_TASK: 'create-task',
  EDIT_TASK: 'edit-task',
  DELETE_TASK: 'delete-task',
  VIEW_TASK: 'view-task',
  ASSIGN_TASK: 'assign-task',
  COMPLETE_TASK: 'complete-task',
  VALIDATE_TASK: 'validate-task',
  REOPEN_TASK: 'reopen-task',

  // Coordinator task actions
  CREATE_COORDINATOR_TASK: 'create-coordinator-task',
  EDIT_COORDINATOR_TASK: 'edit-coordinator-task',
  DELETE_COORDINATOR_TASK: 'delete-coordinator-task',

  // Settings
  MANAGE_SETTINGS: 'manage-settings',
  VIEW_ANALYTICS: 'view-analytics',
};

export const SENIOR_ROLES = [
  'supreme_super_admin',
  'superadmin',
  'super_admin',
  'commander_admin',
  'agency_super_admin',
  'agency_manager',
  'brand_super_admin',
  'brand_admin',
  'brand_manager',
  'brand_head',
  'admin',
  'operations_head',
];

export const isSeniorUser = (user, role) => {
  const userRole = (role || user?.role || '').toLowerCase().trim();
  const roleName = (user?.roleName || '').toLowerCase().trim();
  const designation = (user?.designation || '').toLowerCase().trim();

  if (SENIOR_ROLES.includes(userRole)) return true;

  const seniorKeywords = [
    'agency manager',
    'brand head',
    'brand manager',
    'operations head',
    'super admin',
    'commander',
    'manager',
    'head',
    'admin',
    'director',
    'lead'
  ];

  return seniorKeywords.some(
    (kw) =>
      userRole.includes(kw) ||
      roleName.includes(kw) ||
      designation.includes(kw)
  );
};

export default PERMISSION_ACTIONS;

