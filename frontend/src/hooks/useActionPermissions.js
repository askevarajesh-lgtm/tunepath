import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Roles that always get full Create/Edit/Delete/View access without needing permissions configured
const ALWAYS_FULL_ACCESS_ROLES = [
  'supreme_super_admin', 'superadmin', 'commander_admin', 'agency_super_admin',
  'agency_manager', 'admin', 'brand_admin', 'brand_manager', 'brand_team_user', 'brand_super_admin', 'agency_client', 'client'
];

// Roles that are Employee-type (permission-controlled via their role's permission matrix)
const EMPLOYEE_ROLES = ['user'];

export function useActionPermissions(path) {
  const { user, role } = useAuth();

  let moduleName = path;
  if (path === '/projects') moduleName = 'Workspace-Projects';
  if (path === '/tasks') moduleName = 'Workspace-Task Management';
  if (path === '/coordinator-tasks' || path === '/workspace/tasks/coordinator') moduleName = 'Workspace-Coordinator Tasks';
  if (path === '/proposals') moduleName = 'Workspace-Proposals';
  if (path === '/invoices') moduleName = 'Workspace-Invoices';
  if (path === '/master-items') moduleName = 'Workspace-Master Item';
  if (path === '/strategy') moduleName = 'Workspace-Strategy';
  if (path === '/seo') moduleName = 'Workspace-SEO / AEO / GEO';
  if (path === '/content') moduleName = 'Workspace-Content';
  if (path === '/aistudio') moduleName = 'Workspace-AI Studio';
  if (path === '/social') moduleName = 'Workspace-Social Media';
  if (path === '/ads') moduleName = 'Workspace-Performance Ads';
  if (path === '/crm') moduleName = 'Workspace-CRM & Leads';
  if (path === '/automation') moduleName = 'Workspace-Automation';
  if (path === '/website') moduleName = 'Workspace-Websites';
  if (path === '/meetings') moduleName = 'Workspace-Meetings';
  if (path === '/calendar') moduleName = 'Workspace-Calendar';
  if (path === '/deliverables') moduleName = 'Workspace-Deliverables';
  
  if (path === '/salespipeline' || path === '/ops/salespipeline' || path === '/agency/salespipeline' || path === '/workspace/salespipeline') moduleName = 'Agency Ops-Sales Pipeline';

  if (path === '/analytics') moduleName = 'Intelligence-Google Analytics';
  if (path === '/mos') moduleName = 'Intelligence-MOS Score';
  if (path === '/chatgpt') moduleName = 'Intelligence-ChatGPT';
  if (path === '/canva') moduleName = 'Intelligence-Canva';
  if (path === '/agents') moduleName = 'Intelligence-AI Agent';
  if (path === '/benchmarks') moduleName = 'Intelligence-Benchmarks';
  if (path === '/reporting') moduleName = 'Intelligence-Reports';
  if (path === '/seointelligence') moduleName = 'Intelligence-SEO Intelligence';

  if (path === '/seo-panel') moduleName = 'Workspace-SEO Panel';
  if (path === '/daily-reports') moduleName = 'HRMS-Daily Reports';
  if (path === '/performance') moduleName = 'HRMS-Performance';

  const hasPermission = useCallback((action) => {
    // Supreme and core super admins always get full access
    if (['supreme_super_admin', 'superadmin', 'commander_admin', 'agency_super_admin', 'brand_super_admin'].includes(role)) {
      return true;
    }

    if (!action) return false;
    let actionKey = action.charAt(0).toUpperCase() + action.slice(1);
    
    // Map specific action strings to standard permission keys
    const actionLower = action.toLowerCase();
    if (actionLower.includes('create') || actionLower === 'add') actionKey = 'Create';
    else if (actionLower.includes('edit') || actionLower.includes('assign') || actionLower.includes('complete') || actionLower.includes('validate') || actionLower.includes('reopen') || actionLower.includes('manage')) actionKey = 'Edit';
    else if (actionLower.includes('delete')) actionKey = 'Delete';
    else if (actionLower.includes('view') || actionLower.includes('read')) actionKey = 'View';

    const hasCustomPermissions = user && user.permissions && Object.keys(user.permissions).length > 0;

    // If the user is assigned a custom role with permissions, STRICTLY ENFORCE IT
    if (hasCustomPermissions) {
      const permissions = user.permissions[moduleName];
      if (!permissions) return false; // If module isn't in permissions, deny
      return !!permissions[actionKey];
    }

    // Fallback for standard roles without custom permissions
    if (['agency_manager', 'admin', 'brand_manager', 'agency_client', 'client'].includes(role)) {
      return true;
    }

    // Default for 'user' or 'brand_team_user' with NO custom permissions: deny write, allow read/view?
    // We deny everything by default to be safe, unless it's a View action and they have no custom permissions?
    // Actually, previously it just returned true for user?.brandId. Let's return true for backward compatibility for standard users without roles, but false for Employee-type roles.
    if (['user'].includes(role)) {
      return false; 
    }

    return true;
  }, [user, role, moduleName]);

  return {
    hasPermission,
    canAdd: hasPermission('create'),
    canCreate: hasPermission('create'),
    canEdit: hasPermission('edit'),
    canDelete: hasPermission('delete'),
    canView: hasPermission('view')
  };
}

export default useActionPermissions;