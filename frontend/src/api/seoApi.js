import { createQueryHook, createMutationHook } from "./baseApi";

export const useGetSEOQuery = createQueryHook((params) => ({
  url: "/seo-panel",
  params,
}));

export const useGetSEOByIdQuery = createQueryHook((id) => `/seo-panel/${id}`);

export const useGetSEOTimelineQuery = createQueryHook((id) => `/seo-panel/${id}/timeline`);

export const useCreateSEOMutation = createMutationHook((data) => {
  const formData = new FormData();

  // Append all fields to FormData
  Object.keys(data).forEach((key) => {
    if (key === "websiteAuditScreenshot" || key === "credentialsFile") {
      // Files are handled separately
      if (data[key]) {
        formData.append(key, data[key]);
      }
    } else if (
      (key === "googleSheetLinks" ||
        key === "googleSheetLinksWeeklyReports") &&
      Array.isArray(data[key])
    ) {
      // Convert array to JSON string for FormData
      formData.append(key, JSON.stringify(data[key]));
    } else if (data[key] !== null && data[key] !== undefined) {
      formData.append(key, data[key]);
    }
  });

  return {
    url: "/seo-panel",
    method: "POST",
    body: formData,
  };
});

export const useUpdateSEOMutation = createMutationHook(({ id, ...data }) => {
  const formData = new FormData();

  // Append all fields to FormData
  Object.keys(data).forEach((key) => {
    if (key === "websiteAuditScreenshot" || key === "credentialsFile") {
      // Files are handled separately
      if (data[key]) {
        formData.append(key, data[key]);
      }
    } else if (
      (key === "googleSheetLinks" ||
        key === "googleSheetLinksWeeklyReports") &&
      Array.isArray(data[key])
    ) {
      // Convert array to JSON string for FormData
      formData.append(key, JSON.stringify(data[key]));
    } else if (data[key] !== null && data[key] !== undefined) {
      formData.append(key, data[key]);
    }
  });

  return {
    url: `/seo-panel/${id}`,
    method: "PUT",
    body: formData,
  };
});

export const useDeleteSEOMutation = createMutationHook((id) => ({
  url: `/seo-panel/${id}`,
  method: "DELETE",
}));

export const useGetSEODashboardStatsQuery = createQueryHook(() => "/seo-panel/dashboard/stats");

export const useAddWorkUpdateMutation = createMutationHook(({
  id,
  workType,
  completedWork,
  screenshots,
  offPageBacklinkCount,
}) => {
  const formData = new FormData();
  formData.append("workType", workType);
  formData.append("completedWork", completedWork);

  // Append offPageBacklinkCount if provided
  if (
    offPageBacklinkCount !== undefined &&
    offPageBacklinkCount !== null
  ) {
    formData.append(
      "offPageBacklinkCount",
      offPageBacklinkCount.toString(),
    );
  }

  // Append proof files (screenshots) if provided
  if (screenshots && screenshots.length > 0) {
    screenshots.forEach((file) => {
      formData.append("screenshots", file);
    });
  }

  return {
    url: `/seo-panel/${id}/work-updates`,
    method: "POST",
    body: formData,
  };
});

export const useGetSEOClientUserReportQuery = createQueryHook((params) => ({
  url: "/seo-panel/reports/client-user",
  params,
}));

export const useGetSEOUniqueWebsitesQuery = createQueryHook(() => "/seo-panel/websites");
