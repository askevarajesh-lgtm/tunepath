/**
 * Resolves the destination route URL based on notification payload, user role, and metadata.
 *
 * @param {Object} notification - Notification object from backend
 * @param {string} role - Current active user role
 * @param {Object} user - Current user object
 * @returns {string} Target path to navigate to
 */
export const getNotificationRoute = (notification, role = '', user = null) => {
  if (!notification) return '/dashboard';

  const type = (notification.type || '').toLowerCase();
  const normRole = (role || user?.role || '').toLowerCase();
  
  const isAgency = ['agency_super_admin', 'agency_manager', 'agency'].includes(normRole);
  const isClient = ['agency_client', 'brand_super_admin', 'brand_manager', 'brand_admin', 'brand_team_user', 'client'].includes(normRole) || Boolean(user?.brandId);
  const isUser = normRole === 'user';

  // 1. Lead & CRM Reminders
  if (type === 'lead_reminder' || notification.leadId || type.includes('lead')) {
    if (isAgency) return '/agency/crm';
    if (isClient) return '/client/leads';
    if (isUser) return '/user/workspace/crm';
    return '/workspace/crm';
  }

  // 2. Tasks & Task Assignments, Status Changes, Reminders, Comments, Attachments
  if (
    notification.taskId ||
    type.startsWith('task_') ||
    type.includes('task')
  ) {
    if (isAgency) return '/agency/workspace/tasks';
    if (isClient) return '/client/workspace/tasks';
    if (isUser) return '/user/workspace/tasks';
    return '/workspace/tasks';
  }

  // 3. SLA Triggered / Assigned / Escalated / Status Changed
  if (type.startsWith('sla_') || notification.slaRecordId) {
    if (isAgency) return '/agency/sla';
    if (isClient) return '/client/clients/sla';
    if (isUser) return '/user/sla';
    return '/clients/sla';
  }

  // 4. Meetings / Calendar Reminders
  if (
    notification.meetingId ||
    type.startsWith('meeting_') ||
    type.includes('meeting') ||
    type.includes('calendar')
  ) {
    if (isAgency) return '/agency/meetings';
    if (isClient) return '/client/meetings';
    if (isUser) return '/user/workspace/meetings';
    return '/ops/meetings';
  }

  // 5. Performance Reviews & HRMS
  if (
    type.startsWith('performance_') ||
    type.includes('performance') ||
    type.includes('scorecard')
  ) {
    if (isAgency) return '/agency/hrms/performance';
    if (isClient) return '/client/hrms/performance';
    if (isUser) return '/user/hrms/performance';
    return '/hrms/performance';
  }

  // 6. Daily Reports & Daily Notes
  if (type.startsWith('daily_') || type.includes('daily_report')) {
    if (isAgency) return '/agency/hrms/daily-reports';
    if (isClient) return '/client/hrms/daily-reports';
    if (isUser) return '/user/hrms/daily-reports';
    return '/hrms/daily-reports';
  }

  // 7. Website Forms & Form Submissions
  if (type === 'form_submission' || type.includes('form')) {
    let basePath = '/workspace/website/forms';
    if (isAgency) basePath = '/agency/website/forms';
    else if (isClient) basePath = '/client/website/forms';
    else if (isUser) basePath = '/user/workspace/website/forms';

    const formId = notification.metadata?.formId;
    const submissionId = notification.metadata?.submissionId;
    const queryParams = new URLSearchParams();
    queryParams.set('tab', 'submissions');
    if (formId) queryParams.set('formId', formId);
    if (submissionId) queryParams.set('submissionId', submissionId);
    return `${basePath}?${queryParams.toString()}`;
  }

  // 8. Campaigns & Social
  if (type.includes('campaign')) {
    if (isAgency) return '/agency/social-media';
    if (isClient) return '/client/workspace/social';
    if (isUser) return '/user/workspace/social';
    return '/workspace/social';
  }

  // 9. Client Onboarding
  if (type === 'client_onboarded') {
    if (isAgency) return '/agency/clients';
    return '/clients/accounts';
  }

  // Fallback routes based on role
  if (isAgency) return '/agency/overview';
  if (isClient) return '/client/dashboard';
  if (isUser) return '/user/dashboard';
  return '/dashboard';
};
