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
  if (path === '/claude' || path === '/intelligence/claude') moduleName = 'Intelligence-Claude Chat';
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

    const getModulePerms = () => {
      if (!user?.permissions) return null;
      if (user.permissions[moduleName]) return user.permissions[moduleName];
      if (moduleName === 'Workspace-Task Management') {
        return (
          user.permissions['Workspace-Task Management'] ||
          user.permissions['General-Tasks'] ||
          user.permissions['Workspace-Tasks'] ||
          user.permissions['Tasks']
        );
      }
      if (moduleName === 'Workspace-CRM & Leads') {
        return (
          user.permissions['Workspace-CRM & Leads'] ||
          user.permissions['Workspace-CRM'] ||
          user.permissions['CRM & Leads']
        );
      }
      if (moduleName === 'Workspace-Websites') {
        return (
          user.permissions['Workspace-Websites'] ||
          user.permissions['Workspace-Website Builder'] ||
          user.permissions['Websites']
        );
      }
      if (moduleName === 'Workspace-SEO / AEO / GEO') {
        return (
          user.permissions['Workspace-SEO / AEO / GEO'] ||
          user.permissions['Workspace-SEO'] ||
          user.permissions['SEO']
        );
      }
      return null;
    };

    // If the user is assigned a custom role with permissions, STRICTLY ENFORCE IT
    if (hasCustomPermissions) {
      const permissions = getModulePerms();
      if (!permissions) {
        // Default allow tasks module view/create for users if not explicitly blocked
        if (moduleName === 'Workspace-Task Management') return true;
        return false;
      }
      if (permissions[actionKey] !== undefined) return !!permissions[actionKey];
      if (permissions.All !== undefined) return !!permissions.All;
      if (permissions.Write !== undefined && (actionKey === 'Create' || actionKey === 'Edit')) return !!permissions.Write;
      if (actionKey === 'View' && (permissions.Read || permissions.View || permissions.Create || permissions.Edit)) return true;
      if (actionKey === 'Create' && moduleName === 'Workspace-Task Management') return true;
      return false;
    }

    // Fallback for standard roles without custom permissions
    if (['agency_manager', 'admin', 'brand_manager', 'agency_client', 'client'].includes(role)) {
      return true;
    }

    // Default for 'user' or employee-type roles with NO custom permissions:
    // Allow Tasks create/edit/view by default, allow View for assigned modules
    if (['user'].includes(role)) {
      if (moduleName === 'Workspace-Task Management') return true;
      if (actionKey === 'View') return true;
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