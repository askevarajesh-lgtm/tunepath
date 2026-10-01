/**
 * Utility functions to cleanly separate user panel routing and layout detection.
 * 
 * Rules:
 * 1. Agency Client flow (Primary Agency Client AND Team Members created under an Agency Client):
 *    - MUST ALWAYS route to the Agency Client panel (/client/...)
 *    - MUST NOT route to /user/... (Personal Workspace / Employee panel)
 *    - MUST NOT have Task Management, Performance, HRMS, or other employee modules.
 *    - Only default Agency Client modules (Dashboard, Monthly Reports, Meetings, Calendar, Deliverables, Support, Settings)
 *      PLUS whichever modules/integrations were enabled for that team member at creation.
 * 
 * 2. Brand Admin & Brand Manager flow:
 *    - Brand Admin (brand_super_admin) & Brand Manager (brand_manager) route to /client/...
 *    - Employees created under Brand Admin / Brand Manager (isDirect: true, e.g. Team Lead, Coordinator)
 *      route to /user/... (Personal Workspace with Task Management, HRMS, etc.).
 */

export const isAgencyClientUser = (user, role) => {
  const currentRole = (role || user?.role || '').toLowerCase();
  
  // Primary Agency Client
  if (currentRole === 'agency_client' || currentRole === 'client') {
    return true;
  }

  // Agency Client Team Member:
  // Created under an agency client (has brandId, isDirect is false, and agencyId is present)
  if (user?.brandId) {
    const isDirect = user.isDirect === true || (typeof user.brandId === 'object' && user.brandId?.isDirect === true);
    const hasAgency = Boolean(user.agencyId || (typeof user.brandId === 'object' && user.brandId?.agencyId));
    if (!isDirect && hasAgency) {
      return true;
    }
  }

  return false;
};

export const isDirectBrandExecutive = (user, role) => {
  const currentRole = (role || user?.role || '').toLowerCase();
  return ['brand_super_admin', 'brand_manager', 'brand_admin'].includes(currentRole);
};

export const isClientPanelUser = (user, role) => {
  return isAgencyClientUser(user, role) || isDirectBrandExecutive(user, role);
};

export const getDashboardRouteForUser = (user, role) => {
  const currentRole = (role || user?.role || '').toLowerCase();

  if (['supreme_super_admin', 'superadmin'].includes(currentRole)) {
    return '/superadmin/dashboard';
  }
  if (currentRole === 'commander_admin') {
    return '/dashboard';
  }
  if (['agency_super_admin'].includes(currentRole)) {
    return '/agency/admin-overview';
  }
  if (['agency_manager', 'agency'].includes(currentRole)) {
    return '/agency/overview';
  }
  if (isClientPanelUser(user, currentRole)) {
    return '/client/dashboard';
  }
  return '/user/dashboard';
};
