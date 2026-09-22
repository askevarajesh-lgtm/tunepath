const seoService = require("./seo.service");
const { sendSuccess, sendError } = require("../../utils/response");

// Get all SEO entries (admin/coordinators see all; SEO role sees only their own)
const getAllSEO = async (req, res) => {
  try {
    const result = await seoService.getAllSEO(
      req.companyId,
      req.query,
      req.user,
    );
    return sendSuccess(res, "SEO entries retrieved successfully", result);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Get SEO by ID
const getSEOById = async (req, res) => {
  try {
    const seo = await seoService.getSEOById(req.params.id, req.companyId);
    return sendSuccess(res, "SEO entry retrieved successfully", { seo });
  } catch (error) {
    return sendError(
      res,
      error.message === "SEO entry not found" ? 404 : 500,
      error.message,
    );
  }
};

// Get SEO Timeline
const getSEOTimeline = async (req, res) => {
  try {
    const timelineEvents = await seoService.getSEOTimeline(
      req.params.id,
      req.companyId,
    );
    return sendSuccess(res, "SEO timeline retrieved successfully", {
      timelineEvents,
    });
  } catch (error) {
    return sendError(
      res,
      error.message === "SEO entry not found" ? 404 : 500,
      error.message,
    );
  }
};

// Create SEO entry
const createSEO = async (req, res) => {
  try {
    // Handle file uploads from Cloudinary
    const seoData = { ...req.body };

    // Remove file fields from body (they come from FormData but are not the actual file data)
    // The actual file URLs will come from req.cloudinaryResults
    delete seoData.websiteAuditScreenshot;
    delete seoData.credentialsFile;

    // Handle Cloudinary uploads
    if (req.files) {
      if (req.files.websiteAuditScreenshot && req.files.websiteAuditScreenshot.length > 0) {
        seoData.websiteAuditScreenshot = req.files.websiteAuditScreenshot[0].path;
      }
      if (req.files.credentialsFile && req.files.credentialsFile.length > 0) {
        seoData.credentialsFile = req.files.credentialsFile[0].path;
        seoData.credentialsFileName = req.files.credentialsFile[0].originalname;
      }
    }

    // Parse googleSheetLinks - handle double-encoded JSON
    if (seoData.googleSheetLinks) {
      if (typeof seoData.googleSheetLinks === "string") {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(seoData.googleSheetLinks);
          // Check if it's an array
          if (Array.isArray(parsed)) {
            // Check if the array contains JSON strings (double-encoded)
            seoData.googleSheetLinks = parsed
              .map((item) => {
                if (typeof item === "string") {
                  try {
                    const innerParsed = JSON.parse(item);
                    // If inner parse succeeds and is an array, flatten it
                    return Array.isArray(innerParsed) ? innerParsed : item;
                  } catch {
                    return item;
                  }
                }
                return item;
              })
              .flat()
              .filter(
                (link) => link && typeof link === "string" && link.trim(),
              );
          } else {
            seoData.googleSheetLinks = [parsed];
          }
        } catch (e) {
          // If not JSON, treat as comma-separated string
          seoData.googleSheetLinks = seoData.googleSheetLinks
            .split(",")
            .map((link) => link.trim())
            .filter((link) => link);
        }
      } else if (Array.isArray(seoData.googleSheetLinks)) {
        // Already an array, but check for double-encoded strings
        seoData.googleSheetLinks = seoData.googleSheetLinks
          .map((item) => {
            if (typeof item === "string") {
              try {
                const parsed = JSON.parse(item);
                return Array.isArray(parsed) ? parsed : item;
              } catch {
                return item;
              }
            }
            return item;
          })
          .flat()
          .filter((link) => link && typeof link === "string" && link.trim());
      }
    }

    // Parse googleSheetLinksWeeklyReports - handle double-encoded JSON
    if (seoData.googleSheetLinksWeeklyReports) {
      if (typeof seoData.googleSheetLinksWeeklyReports === "string") {
        try {
          const parsed = JSON.parse(seoData.googleSheetLinksWeeklyReports);
          if (Array.isArray(parsed)) {
            seoData.googleSheetLinksWeeklyReports = parsed
              .map((item) => {
                if (typeof item === "string") {
                  try {
                    const innerParsed = JSON.parse(item);
                    return Array.isArray(innerParsed) ? innerParsed : item;
                  } catch {
                    return item;
                  }
                }
                return item;
              })
              .flat()
              .filter(
                (link) => link && typeof link === "string" && link.trim(),
              );
          } else {
            seoData.googleSheetLinksWeeklyReports = [parsed];
          }
        } catch (e) {
          seoData.googleSheetLinksWeeklyReports =
            seoData.googleSheetLinksWeeklyReports
              .split(",")
              .map((link) => link.trim())
              .filter((link) => link);
        }
      } else if (Array.isArray(seoData.googleSheetLinksWeeklyReports)) {
        seoData.googleSheetLinksWeeklyReports =
          seoData.googleSheetLinksWeeklyReports
            .map((item) => {
              if (typeof item === "string") {
                try {
                  const parsed = JSON.parse(item);
                  return Array.isArray(parsed) ? parsed : item;
                } catch {
                  return item;
                }
              }
              return item;
            })
            .flat()
            .filter((link) => link && typeof link === "string" && link.trim());
      }
    }

    // Parse boolean fields
    const booleanFields = [
      "contentWork",
      "onpageSeo",
      "technicalSeo",
      "localSeo",
      "keywordResearch",
      "offPageSeo",
    ];
    booleanFields.forEach((field) => {
      if (seoData[field] !== undefined) {
        seoData[field] = seoData[field] === "true" || seoData[field] === true;
      }
    });

    // Parse counts
    if (seoData.offPageSeoCount !== undefined) {
      seoData.offPageSeoCount = parseInt(seoData.offPageSeoCount) || 0;
    }
    if (seoData.weeklyReportsSeoCount !== undefined) {
      seoData.weeklyReportsSeoCount =
        parseInt(seoData.weeklyReportsSeoCount) || 0;
    }

    const seo = await seoService.createSEO(
      seoData,
      req.companyId,
      req.user._id,
    );
    return sendSuccess(res, "SEO entry created successfully", { seo }, 201);
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

// Update SEO entry
const updateSEO = async (req, res) => {
  try {
    // Handle file uploads from Cloudinary
    const seoData = { ...req.body };
    console.log(
      "Update SEO - req.files:",
      req.files ? Object.keys(req.files) : "No files",
    );

    // Remove file fields from body (they come from FormData but are not the actual file data)
    // The actual file URLs will come from req.files if new files are uploaded
    delete seoData.websiteAuditScreenshot;
    delete seoData.credentialsFile;

    // Only update file fields if new files were uploaded
    if (req.files && Object.keys(req.files).length > 0) {
      if (req.files.websiteAuditScreenshot && req.files.websiteAuditScreenshot.length > 0) {
        seoData.websiteAuditScreenshot = req.files.websiteAuditScreenshot[0].path;
        console.log("Set websiteAuditScreenshot URL:", seoData.websiteAuditScreenshot);
      }
      if (req.files.credentialsFile && req.files.credentialsFile.length > 0) {
        seoData.credentialsFile = req.files.credentialsFile[0].path;
        seoData.credentialsFileName = req.files.credentialsFile[0].originalname;
        console.log("Set credentialsFile URL:", seoData.credentialsFile);
        console.log("Set credentialsFileName:", seoData.credentialsFileName);
      }
    } else {
      // If no new files uploaded, don't include file fields in seoData
      // This preserves existing files
      console.log("No new files uploaded, preserving existing files");
    }

    // Parse googleSheetLinks - handle double-encoded JSON
    if (seoData.googleSheetLinks) {
      if (typeof seoData.googleSheetLinks === "string") {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(seoData.googleSheetLinks);
          // Check if it's an array
          if (Array.isArray(parsed)) {
            // Check if the array contains JSON strings (double-encoded)
            seoData.googleSheetLinks = parsed
              .map((item) => {
                if (typeof item === "string") {
                  try {
                    const innerParsed = JSON.parse(item);
                    // If inner parse succeeds and is an array, flatten it
                    return Array.isArray(innerParsed) ? innerParsed : item;
                  } catch {
                    return item;
                  }
                }
                return item;
              })
              .flat()
              .filter(
                (link) => link && typeof link === "string" && link.trim(),
              );
          } else {
            seoData.googleSheetLinks = [parsed];
          }
        } catch (e) {
          // If not JSON, treat as comma-separated string
          seoData.googleSheetLinks = seoData.googleSheetLinks
            .split(",")
            .map((link) => link.trim())
            .filter((link) => link);
        }
      } else if (Array.isArray(seoData.googleSheetLinks)) {
        // Already an array, but check for double-encoded strings
        seoData.googleSheetLinks = seoData.googleSheetLinks
          .map((item) => {
            if (typeof item === "string") {
              try {
                const parsed = JSON.parse(item);
                return Array.isArray(parsed) ? parsed : item;
              } catch {
                return item;
              }
            }
            return item;
          })
          .flat()
          .filter((link) => link && typeof link === "string" && link.trim());
      }
    }

    // Parse googleSheetLinksWeeklyReports - handle double-encoded JSON
    if (seoData.googleSheetLinksWeeklyReports) {
      if (typeof seoData.googleSheetLinksWeeklyReports === "string") {
        try {
          const parsed = JSON.parse(seoData.googleSheetLinksWeeklyReports);
          if (Array.isArray(parsed)) {
            seoData.googleSheetLinksWeeklyReports = parsed
              .map((item) => {
                if (typeof item === "string") {
                  try {
                    const innerParsed = JSON.parse(item);
                    return Array.isArray(innerParsed) ? innerParsed : item;
                  } catch {
                    return item;
                  }
                }
                return item;
              })
              .flat()
              .filter(
                (link) => link && typeof link === "string" && link.trim(),
              );
          } else {
            seoData.googleSheetLinksWeeklyReports = [parsed];
          }
        } catch (e) {
          seoData.googleSheetLinksWeeklyReports =
            seoData.googleSheetLinksWeeklyReports
              .split(",")
              .map((link) => link.trim())
              .filter((link) => link);
        }
      } else if (Array.isArray(seoData.googleSheetLinksWeeklyReports)) {
        seoData.googleSheetLinksWeeklyReports =
          seoData.googleSheetLinksWeeklyReports
            .map((item) => {
              if (typeof item === "string") {
                try {
                  const parsed = JSON.parse(item);
                  return Array.isArray(parsed) ? parsed : item;
                } catch {
                  return item;
                }
              }
              return item;
            })
            .flat()
            .filter((link) => link && typeof link === "string" && link.trim());
      }
    }

    // Parse boolean fields
    const booleanFields = [
      "contentWork",
      "onpageSeo",
      "technicalSeo",
      "localSeo",
      "keywordResearch",
      "offPageSeo",
    ];
    booleanFields.forEach((field) => {
      if (seoData[field] !== undefined) {
        seoData[field] = seoData[field] === "true" || seoData[field] === true;
      }
    });

    // Parse counts
    if (seoData.offPageSeoCount !== undefined) {
      seoData.offPageSeoCount = parseInt(seoData.offPageSeoCount) || 0;
    }
    if (seoData.weeklyReportsSeoCount !== undefined) {
      seoData.weeklyReportsSeoCount =
        parseInt(seoData.weeklyReportsSeoCount) || 0;
    }

    const seo = await seoService.updateSEO(
      req.params.id,
      seoData,
      req.companyId,
      req.user._id,
    );
    return sendSuccess(res, "SEO entry updated successfully", { seo });
  } catch (error) {
    return sendError(
      res,
      error.message === "SEO entry not found" ? 404 : 400,
      error.message,
    );
  }
};

// Delete SEO entry
const deleteSEO = async (req, res) => {
  try {
    const seo = await seoService.deleteSEO(
      req.params.id,
      req.companyId,
      req.user._id,
    );
    return sendSuccess(res, "SEO entry deleted successfully", { seo });
  } catch (error) {
    return sendError(
      res,
      error.message === "SEO entry not found" ? 404 : 500,
      error.message,
    );
  }
};

// Get SEO Dashboard Statistics
const getSEODashboardStats = async (req, res) => {
  try {
    // For admin and coordinators, show all stats. For SEO users, show only their stats.
    const userId =
      req.user.role === "admin" ||
      req.user.role === "digital_marketing_coordinator" ||
      req.user.role === "website_coordinator"
        ? null
        : req.user._id;
    const stats = await seoService.getSEODashboardStats(req.companyId, userId);
    return sendSuccess(res, "SEO dashboard statistics retrieved successfully", {
      stats,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Add work update to SEO entry
const addWorkUpdate = async (req, res) => {
  try {
    const { completedWork, workType } = req.body;

    if (!workType) {
      return sendError(res, 400, "Work type is required");
    }

    const validWorkTypes = [
      "contentWork",
      "onpageSeo",
      "technicalSeo",
      "localSeo",
      "keywordResearch",
      "offPageSeo",
    ];
    if (!validWorkTypes.includes(workType)) {
      return sendError(res, 400, "Invalid work type");
    }

    if (!completedWork || !completedWork.trim()) {
      return sendError(res, 400, "Completed work description is required");
    }

    // Handle screenshot/proof file uploads from Cloudinary
    const screenshots = [];
    if (req.files && req.files.screenshots) {
      screenshots.push(
        ...req.files.screenshots.map((file) => ({
          url: file.path,
          fileName: file.originalname || `proof-${Date.now()}`,
        }))
      );
    }

    // Parse offPageBacklinkCount if provided
    let offPageBacklinkCount = null;
    if (
      req.body.offPageBacklinkCount !== undefined &&
      req.body.offPageBacklinkCount !== null &&
      req.body.offPageBacklinkCount !== ""
    ) {
      offPageBacklinkCount = parseInt(req.body.offPageBacklinkCount);
      if (isNaN(offPageBacklinkCount) || offPageBacklinkCount < 0) {
        return sendError(
          res,
          400,
          "Off-page backlink count must be a valid non-negative number",
        );
      }
    }

    const workUpdateData = {
      workType: workType,
      completedWork: completedWork.trim(),
      screenshots: screenshots,
      ...(offPageBacklinkCount !== null && { offPageBacklinkCount }),
    };

    const seo = await seoService.addWorkUpdate(
      req.params.id,
      workUpdateData,
      req.companyId,
      req.user._id,
    );
    return sendSuccess(res, "Work update added successfully", { seo });
  } catch (error) {
    return sendError(
      res,
      error.message === "SEO entry not found" ? 404 : 400,
      error.message,
    );
  }
};

// Get Client-wise and User-wise SEO Work Report
const getSEOClientUserReport = async (req, res) => {
  try {
    const { clientCompanyId, userId, startDate, endDate, includeNoClient } =
      req.query;

    const filters = {
      ...(clientCompanyId && { clientCompanyId }),
      ...(userId && { userId }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(includeNoClient === "true" && { includeNoClient: true }),
    };

    const report = await seoService.getSEOClientUserReport(
      req.companyId,
      filters,
    );
    return sendSuccess(
      res,
      "SEO client-user report retrieved successfully",
      report,
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

// Get unique websites with aggregated stats
const getSEOUniqueWebsites = async (req, res) => {
  try {
    const result = await seoService.getSEOUniqueWebsites(req.companyId);
    return sendSuccess(res, "Unique websites retrieved successfully", result);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getAllSEO,
  getSEOById,
  getSEOTimeline,
  createSEO,
  updateSEO,
  deleteSEO,
  getSEODashboardStats,
  addWorkUpdate,
  getSEOClientUserReport,
  getSEOUniqueWebsites,
};
