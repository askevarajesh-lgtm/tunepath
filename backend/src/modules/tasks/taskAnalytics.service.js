const mongoose = require("mongoose");
const Task = require("../tasks/task.model");

exports.getTaskAnalytics = async (tenantCompanyId, reqQuery = {}, userRole = null, userId = null, taskFilter = {}) => {
  // Aggregate using the provided taskFilter (which encapsulates all visibility rules already computed by getAllTasks or similar)
  
  const aggResult = await Task.aggregate([
    { $match: taskFilter },
    {
      $facet: {
        total: [{ $count: "count" }],
        completed: [
          { $match: { status: { $regex: /^(review|completed|complete|validated|approved|done|in_review|reviewing)$/i } } },
          { $count: "count" }
        ],
        inProgress: [
          { $match: { status: { $regex: /^(in_progress|submitted)$/i } } },
          { $count: "count" }
        ],
        pending: [
          { $match: { status: { $not: { $regex: /^(review|completed|complete|validated|approved|done|in_review|reviewing|in_progress|submitted)$/i } } } },
          { $count: "count" }
        ],
        corrections: [
          { $match: { taskCategory: { $in: ["Correction", "Internal Correction", "Client Correction", "Hosting"] } } },
          { $count: "count" }
        ],
        redesigns: [
          { $match: { taskCategory: "Redesign" } },
          { $count: "count" }
        ]
      }
    }
  ]);

  return {
    total: aggResult[0]?.total[0]?.count || 0,
    completed: aggResult[0]?.completed[0]?.count || 0,
    inProgress: aggResult[0]?.inProgress[0]?.count || 0,
    pending: aggResult[0]?.pending[0]?.count || 0,
    corrections: aggResult[0]?.corrections[0]?.count || 0,
    redesigns: aggResult[0]?.redesigns[0]?.count || 0,
  };
};
