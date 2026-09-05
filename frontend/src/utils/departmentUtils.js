/**
 * Utility to reliably resolve a user's department slug across all roles,
 * dynamic departments, display names, and user attributes.
 * Handles both new dynamic slugs (digital-marketing, projects, seo) and legacy aliases (dm, project).
 */
export const resolveUserDepartmentSlug = (user, departments = [], roles = []) => {
  if (!user) return null;

  // 1. Helper to match input string against fetched departments array or known fallback aliases
  const findMatch = (str) => {
    if (!str) return null;
    const norm = String(str).trim().toLowerCase();
    if (!norm) return null;

    const normSanitized = norm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    // Try finding exact, sanitized, or group alias match in fetched departments list first
    if (Array.isArray(departments) && departments.length > 0) {
      // Step A: Exact or sanitized slug / name / ID match
      const exactMatch = departments.find((d) => {
        if (!d) return false;
        const dId = String(d._id || "");
        const dSlug = (d.slug || "").toLowerCase();
        const dName = (d.name || "").toLowerCase();
        const dSlugSanitized = dSlug.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const dNameSanitized = dName.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

        return (
          dId === str ||
          dSlug === norm ||
          dName === norm ||
          dSlugSanitized === norm ||
          dSlugSanitized === normSanitized ||
          dNameSanitized === normSanitized
        );
      });
      if (exactMatch?.slug) return exactMatch.slug;

      // Step B: Match by group aliases against active fetched departments
      // SEO group
      const isSeoTerm = ["seo", "seo_specialist", "seo_manager", "seo_lead", "seo_executive", "seo_analyst"].includes(normSanitized) || normSanitized.includes("seo");
      if (isSeoTerm) {
        const seoDept = departments.find(d => (d.slug || "").toLowerCase().includes("seo") || (d.name || "").toLowerCase().includes("seo"));
        if (seoDept?.slug) return seoDept.slug;
      }

      // Digital Marketing / Creative / Design group
      const isDmTerm = ["dm", "digital-marketing", "digital_marketing", "designer", "design", "graphic-designer", "ui-ux", "video-editor", "content-writer", "copywriter", "marketing"].some(
        (alias) => normSanitized.includes(alias)
      );
      if (isDmTerm) {
        const dmDept = departments.find(d => {
          const s = (d.slug || "").toLowerCase();
          const n = (d.name || "").toLowerCase();
          return s === "digital-marketing" || s === "dm" || n.includes("digital marketing") || n.includes("marketing") || n.includes("design");
        });
        if (dmDept?.slug) return dmDept.slug;
      }

      // Project / Development group
      const isProjTerm = ["project", "projects", "developer", "dev", "software-engineer", "deployment", "deployer", "fullstack", "frontend", "backend"].some(
        (alias) => normSanitized.includes(alias)
      );
      if (isProjTerm) {
        const projDept = departments.find(d => {
          const s = (d.slug || "").toLowerCase();
          const n = (d.name || "").toLowerCase();
          return s === "projects" || s === "project" || n.includes("project") || n.includes("dev");
        });
        if (projDept?.slug) return projDept.slug;
      }
    }

    // Step C: Known fallback default slugs if departments array is not loaded yet
    if (["seo", "seo_specialist", "seo_manager", "seo_lead", "seo_executive", "seo_analyst"].includes(normSanitized) || normSanitized.includes("seo")) {
      return "seo";
    }
    if (
      ["dm", "digital-marketing", "digital_marketing", "designer", "graphic-designer", "ui-ux", "video-editor", "content-writer", "copywriter", "marketing"].some(
        (alias) => normSanitized.includes(alias)
      )
    ) {
      return "digital-marketing";
    }
    if (
      ["project", "projects", "developer", "dev", "software-engineer", "deployment", "deployer", "fullstack", "frontend", "backend"].some(
        (alias) => normSanitized.includes(alias)
      )
    ) {
      return "projects";
    }

    return null;
  };

  // 2. Direct user departmentId (object with slug, _id, or id string)
  if (user.departmentId) {
    if (typeof user.departmentId === "object") {
      if (user.departmentId.slug) {
        const match = findMatch(user.departmentId.slug);
        if (match) return match;
      }
      if (user.departmentId._id) {
        const match = findMatch(user.departmentId._id);
        if (match) return match;
      }
    } else {
      const match = findMatch(user.departmentId);
      if (match) return match;
    }
  }

  // 3. User role object lookup in dynamic system roles (roles)
  if (user.role && Array.isArray(roles) && roles.length > 0) {
    const userRoleObj = roles.find(
      (r) =>
        r.roleKey === user.role ||
        r._id === user.role ||
        (r.roleName && r.roleName.toLowerCase() === user.role.toLowerCase())
    );
    if (userRoleObj && userRoleObj.departmentId) {
      const match = findMatch(userRoleObj.departmentId);
      if (match) return match;
    }
  }

  // 4. Extract parenthesized department/role from user name (e.g. "Revanth M (Designer)", "Louis Muthusamy (Developer)", "Abirami (Seo)")
  const fullName = String(user.name || user.fullName || user.displayName || "");
  const matchBracket = fullName.match(/\(([^)]+)\)/);
  if (matchBracket && matchBracket[1]) {
    const bracketValue = matchBracket[1].trim();
    const match = findMatch(bracketValue);
    if (match) return match;
  }

  // 5. Explicit user string properties
  for (const val of [
    user.departmentName,
    user.department,
    user.team,
    user.roleName,
    user.designation,
    user.title,
    user.role,
  ]) {
    const match = findMatch(val);
    if (match) return match;
  }

  // 6. Comprehensive Role key to Department mapping
  const roleSlugMap = {
    // SEO
    seo: "seo",
    seo_specialist: "seo",
    seo_manager: "seo",
    seo_lead: "seo",
    seo_executive: "seo",
    seo_analyst: "seo",

    // Digital Marketing / Design
    designer: "digital-marketing",
    graphic_designer: "digital-marketing",
    ui_ux_designer: "digital-marketing",
    ui_designer: "digital-marketing",
    ux_designer: "digital-marketing",
    creative_designer: "digital-marketing",
    video_editor: "digital-marketing",
    video_editing: "digital-marketing",
    content_writer: "digital-marketing",
    copywriter: "digital-marketing",
    digital_marketing: "digital-marketing",
    digital_marketing_coordinator: "digital-marketing",
    digital_marketing_manager: "digital-marketing",
    digital_marketing_executive: "digital-marketing",
    social_media_manager: "digital-marketing",

    // Projects / Dev
    developer: "projects",
    dev: "projects",
    fullstack_developer: "projects",
    full_stack_developer: "projects",
    frontend_developer: "projects",
    backend_developer: "projects",
    software_engineer: "projects",
    project_manager: "projects",
    project_head: "projects",
    project_lead: "projects",
    project_coordinator: "projects",
    website_coordinator: "projects",
    deployment: "projects",
    deployer: "projects",
    deploy: "projects",
  };

  if (user.role && roleSlugMap[user.role]) {
    const targetSlug = roleSlugMap[user.role];
    const match = findMatch(targetSlug);
    if (match) return match;
    return targetSlug;
  }

  // 7. Fallback search by full name
  if (fullName && Array.isArray(departments) && departments.length > 0) {
    const match = departments.find((d) => {
      if (!d?.name) return false;
      return fullName.toLowerCase().includes(d.name.toLowerCase());
    });
    if (match?.slug) return match.slug;
  }

  return null;
};
