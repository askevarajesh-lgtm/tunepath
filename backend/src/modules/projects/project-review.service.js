const Project = require("./project.model");
const Task = require("../tasks/task.model");
const Correction = require("./shimCorrectionModel");
const User = require("./shimUserModel");
const Invoice = require("../invoices/invoice.model");
const { logAudit } = require("./shimAuditHelper");
const { createTimelineEvent } = require("./shimTimelineHelper");
const { sendWorkflowEmail } = require("./shimEmailService");

/**
 * Submit project for client review
 * @param {String} projectId - Project ID
 * @param {String} userId - User ID who submitted
 */
const submitForClientReview = async (projectId, userId) => {
  const project = await Project.findById(projectId).populate("masterItemId");

  if (!project) {
    throw new Error("Project not found");
  }

  // Validate ALL tasks are completed before submitting for final review
  const incompleteTasks = await Task.find({
    projectId,
    status: { $ne: "completed" },
    // Exclude deleted tasks
  });

  if (incompleteTasks.length > 0) {
    const incompleteTaskTitles = incompleteTasks.map((t) => t.title).join(", ");
    throw new Error(
      `All tasks must be completed before submitting for final client review. ${incompleteTasks.length} task(s) still incomplete: ${incompleteTaskTitles}`,
    );
  }

  // Ensure project is in 'in_progress' status before submitting for review
  if (project.status !== "in_progress") {
    throw new Error(
      `Project must be in 'in_progress' status to submit for final review. Current status: ${project.status}`,
    );
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;
  const previousStatus = project.status;

  // Update project status
  project.status = "sent_for_client_review";
  project.clientReview.status = "pending";
  await project.save();

  // Update client review tasks
  await Task.updateMany(
    {
      projectId,
      requiresClientReview: true,
    },
    {
      clientReviewStatus: "pending",
    },
  );

  // Create timeline event for sent for client review
  try {
    await createTimelineEvent({
      eventType: "project_sent_for_client_review",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: userId,
      description: `Project "${project.name}" sent for client review`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        previousStatus: previousStatus,
        currentStatus: "sent_for_client_review",
        sentForReviewAt: new Date(),
        sentForReviewBy: userId.toString(),
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "project_sent_for_client_review",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: userId,
      description: `Project "${project.name}" sent for your review`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        sentForReviewAt: new Date(),
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Review] Failed to create timeline event:",
      timelineError,
    );
    // Don't throw - timeline failure shouldn't break the flow
  }

  // Log audit
  await logAudit({
    userId,
    action: "project_sent_for_client_review",
    details: { projectId },
  });

  return project;
};

/**
 * Client approves project
 * @param {String} projectId - Project ID
 * @param {String} clientUserId - Client user ID
 * @param {String} reviewNotes - Optional review notes
 */
const clientApprove = async (projectId, clientUserId, reviewNotes = "") => {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.status !== "sent_for_client_review") {
    throw new Error("Project is not in client review status");
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;
  const previousStatus = project.status;

  project.clientReview.status = "approved";
  project.clientReview.reviewedAt = new Date();
  project.clientReview.reviewedBy = clientUserId;
  project.clientReview.reviewNotes = reviewNotes;
  project.status = "approved";
  await project.save();

  // Update client review tasks
  await Task.updateMany(
    {
      projectId,
      requiresClientReview: true,
    },
    {
      clientReviewStatus: "approved",
    },
  );

  // Create timeline event for client approval
  try {
    await createTimelineEvent({
      eventType: "project_client_review_approved",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: clientUserId,
      description: `Project "${project.name}" approved by client`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        previousStatus: previousStatus,
        currentStatus: "approved",
        reviewedAt: project.clientReview.reviewedAt,
        reviewedBy: clientUserId.toString(),
        reviewNotes: reviewNotes || null,
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "project_client_review_approved",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: clientUserId,
      description: `You approved project "${project.name}"`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        reviewedAt: project.clientReview.reviewedAt,
        reviewNotes: reviewNotes || null,
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Review] Failed to create timeline event:",
      timelineError,
    );
    // Don't throw - timeline failure shouldn't break the flow
  }

  // Enable posting tasks
  await enablePostingTasks(projectId);

  // Log audit
  await logAudit({
    userId: clientUserId,
    action: "project_client_approved",
    details: { projectId, reviewNotes },
  });

  return project;
};

/**
 * Request correction from client or coordinator
 * @param {String} projectId - Project ID
 * @param {Object} correctionData - Correction data
 * @param {String} userId - User ID who requested the correction
 * @param {String} requestedByType - 'client' or 'coordinator'
 */
const requestCorrection = async (
  projectId,
  correctionData,
  userId,
  requestedByType = "client",
) => {
  const project = await Project.findById(projectId).populate("masterItemId");

  if (!project) {
    throw new Error("Project not found");
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;
  const previousStatus = project.status;

  // Only count client corrections against the allowed limit
  // Coordinator corrections don't count against the limit
  let newCorrectionCount = (project.correctionCount || 0);
  let clientCorrectionCount = project.clientCorrectionCount || 0;

  if (requestedByType === "client") {
    clientCorrectionCount += 1;
    newCorrectionCount = clientCorrectionCount;
  } else {
    newCorrectionCount = newCorrectionCount + 1;
  }

  const notesText = correctionData.notes || correctionData.correctionNotes || '';

  // Create correction record
  const correction = await Correction.create({
    projectId,
    taskId: correctionData.taskId || null,
    companyId: tenantCompanyId,
    correctionRound: newCorrectionCount,
    mistakeBy: correctionData.mistakeBy || 'internal_team', // 'client' or 'internal_team'
    category: correctionData.category || correctionData.taskType || 'general',
    notes: notesText,
    attachments: correctionData.attachments || [],
    requestedBy: userId,
    requestedByType: requestedByType, // 'client' or 'coordinator'
    status: "pending",
  });

  // Update project
  project.correctionCount = newCorrectionCount;
  if (requestedByType === "client") {
    project.clientCorrectionCount = clientCorrectionCount;
  }
  project.clientReview.status = "correction_requested";
  project.status = "in_progress"; // Back to in progress
  await project.save();

  // Create timeline event for correction request
  try {
    await createTimelineEvent({
      eventType: "project_client_review_correction_requested",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: userId,
      description: `Correction requested by ${requestedByType === "client" ? "Client" : "Coordinator"} for project "${project.name}" - Round ${newCorrectionCount} (${correctionData.mistakeBy === "client" ? "Client Mistake" : "Internal Team Mistake"})`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        correctionId: correction._id.toString(),
        correctionRound: newCorrectionCount,
        mistakeBy: correctionData.mistakeBy,
        requestedByType: requestedByType,
        category: correctionData.category || correctionData.taskType || 'general',
        notes: notesText,
        taskId: correctionData.taskId ? correctionData.taskId.toString() : null,
        previousStatus: previousStatus,
        currentStatus: "in_progress",
        correctionCount: newCorrectionCount,
        clientCorrectionCount: clientCorrectionCount,
        maxAllowedCorrections: project.maxAllowedCorrections,
        correctionExceeded: project.correctionExceeded,
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "project_client_review_correction_requested",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: userId,
      description: `Correction requested by ${requestedByType === "client" ? "Client" : "Coordinator"} for project "${project.name}" - Round ${newCorrectionCount}`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        correctionId: correction._id.toString(),
        correctionRound: newCorrectionCount,
        requestedByType: requestedByType,
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Review] Failed to create timeline event:",
      timelineError,
    );
    // Don't throw - timeline failure shouldn't break the flow
  }

  // Reopen affected tasks or create new ones
  if (
    correctionData.category === "Redesign" ||
    correctionData.category === "Correction"
  ) {
    let taskTitle = `${correctionData.category}: ${project.name}`;
    let taskDepartment = project.departments?.[0] || "website-designing";

    if (correctionData.taskId) {
      const originalTask = await Task.findById(correctionData.taskId);
      if (originalTask) {
        taskTitle = `${correctionData.category}: ${originalTask.title}`;
        taskDepartment = originalTask.department || taskDepartment;
      }
    }

    // Create a new task entry for the correction/redesign
    const newTask = await Task.create({
      title: taskTitle,
      description: correctionData.notes,
      department: taskDepartment,
      projectId: project._id,
      companyId: project.clientId,
      tenantCompanyId: project.companyId,
      assignedTo: correctionData.assignedPerson,
      assignedBy: userId,
      createdBy: userId,
      startDate: correctionData.assignedDate
        ? new Date(correctionData.assignedDate)
        : new Date(),
      dueDate: new Date(
        (correctionData.assignedDate
          ? new Date(correctionData.assignedDate).getTime()
          : Date.now()) +
          2 * 24 * 60 * 60 * 1000,
      ), // Default 2 days from assigned date
      taskCategory: correctionData.category,
      status: "assigned",
      priority: "high",
      taskType: "creative_design",
    });

    // Fill correction's taskId if it was for redesign/correction
    correction.taskId = newTask._id;
    await correction.save();
  } else if (correctionData.taskId) {
    const task = await Task.findById(correctionData.taskId);
    if (task) {
      task.status = "assigned";
      task.assignedTo = correctionData.assignedPerson || task.assignedTo;
      task.clientReviewStatus = "correction_requested";
      task.taskCategory = "Correction";
      await task.save();
    }
  } else {
    // Reopen all design/creative tasks if no specific task and not specific category
    await Task.updateMany(
      {
        projectId,
        taskType: { $in: ["creative_design", "content_upload"] },
      },
      {
        status: "assigned",
        assignedTo: correctionData.assignedPerson,
        clientReviewStatus: "correction_requested",
        taskCategory: "Correction",
      },
    );
  }

  // Calculate cost impact if internal mistake
  if (correctionData.mistakeBy === "internal_team") {
    const costImpact = await calculateCorrectionCost(correction);
    correction.costImpact = costImpact;
    await correction.save();
  }

  // Log audit
  await logAudit({
    userId: userId,
    action: "correction_requested",
    details: {
      projectId,
      correctionId: correction._id,
      correctionRound: newCorrectionCount,
      mistakeBy: correctionData.mistakeBy,
      requestedByType: requestedByType,
    },
  });

  return correction;
};

/**
 * Resubmit project for client review after correction is resolved
 * @param {String} projectId - Project ID
 * @param {String} userId - User ID who resubmitted
 */
const resubmitForClientReview = async (projectId, userId) => {
  const project = await Project.findById(projectId).populate("masterItemId");

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.status !== "in_progress") {
    throw new Error(
      "Project must be in progress status to resubmit for review",
    );
  }

  if (project.clientReview.status !== "correction_requested") {
    throw new Error(
      "Project must have correction requested status to resubmit",
    );
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;
  const previousStatus = project.status;

  // Update project status
  project.status = "sent_for_client_review";
  project.clientReview.status = "pending";
  await project.save();

  // Update client review tasks
  await Task.updateMany(
    {
      projectId,
      requiresClientReview: true,
    },
    {
      clientReviewStatus: "pending",
    },
  );

  // Create timeline event for resubmission
  try {
    await createTimelineEvent({
      eventType: "project_resubmitted_for_review",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: userId,
      description: `Project "${project.name}" resubmitted for client review after correction resolution`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        previousStatus: previousStatus,
        currentStatus: "sent_for_client_review",
        correctionCount: project.correctionCount || 0,
        clientReviewStatus: "pending",
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "project_resubmitted_for_review",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: userId,
      description: `Project "${project.name}" resubmitted for your review`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        correctionCount: project.correctionCount || 0,
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Review] Failed to create timeline event:",
      timelineError,
    );
    // Don't throw - timeline failure shouldn't break the flow
  }

  // Log audit
  await logAudit({
    userId,
    action: "project_resubmitted_for_review",
    details: { projectId, correctionCount: project.correctionCount },
  });

  return project;
};

/**
 * Send workflow to client for approval (before tasks are created)
 * @param {String} projectId - Project ID
 * @param {Object} workflowData - Workflow definition
 * @param {String} userId - User ID who sent the workflow
 */
const sendWorkflow = async (projectId, workflowData, userId) => {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  // Allow sending workflow when status is 'created' or 'workflow_revision_requested'
  if (
    project.status !== "created" &&
    project.status !== "workflow_revision_requested"
  ) {
    throw new Error(
      "Project must be in created or workflow_revision_requested status to send workflow",
    );
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;
  const previousStatus = project.status;
  const isResending = project.status === "workflow_revision_requested";

  // Update project
  project.workflow = workflowData;
  project.workflowSentAt = new Date();
  project.workflowSentBy = userId;
  project.status = "workflow_sent";

  // Clear revision fields if resending after revision
  if (isResending) {
    project.workflowRevisionRequestedAt = null;
    project.workflowRevisionRequestedBy = null;
    project.workflowRevisionRequestedByType = undefined;
    project.workflowRevisionRequested = undefined;
  }

  await project.save();

  // Create timeline event for workflow sent
  try {
    const description = isResending
      ? `Workflow resent to client for project "${project.name}" after revision`
      : `Workflow sent to client for project "${project.name}"`;

    await createTimelineEvent({
      eventType: "project_workflow_sent",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: userId,
      description: description,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        previousStatus: previousStatus,
        currentStatus: "workflow_sent",
        workflowSentAt: project.workflowSentAt,
        workflowSentBy: userId.toString(),
        isResending: isResending,
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "project_workflow_sent",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: userId,
      description: isResending
        ? `Workflow resent for your approval - project "${project.name}"`
        : `Workflow sent for your approval - project "${project.name}"`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        workflowSentAt: project.workflowSentAt,
        isResending: isResending,
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Service] Failed to create timeline event:",
      timelineError,
    );
    // Don't throw - timeline failure shouldn't break the flow
  }

  // Send email to client - DISABLED: Send workflow to client functionality has been removed
  // Email sending for workflow has been disabled
  // try {
  //   const populatedProject = await Project.findById(projectId)
  //     .populate('clientId', 'name email phone')
  //     .populate('companyId', 'name email phone companyLogo')
  //     .populate('workflowSentBy', 'name email');
  //
  //   if (populatedProject.clientId?.email) {
  //     await sendWorkflowEmail(
  //       populatedProject,
  //       populatedProject.clientId.email,
  //       populatedProject.companyId?.name || 'Our Company',
  //       populatedProject.companyId?.companyLogo || null
  //     );
  //   }
  // } catch (emailError) {
  //   console.error('[Project Review] Failed to send workflow email:', emailError);
  //   // Don't throw - email failure shouldn't break the flow
  // }

  // Log audit
  await logAudit({
    userId,
    action: "project_workflow_sent",
    details: { projectId },
  });

  return project;
};

/**
 * Request workflow revision (client or coordinator can request changes)
 * @param {String} projectId - Project ID
 * @param {String} revisionRequested - Revision request details/notes
 * @param {String} userId - User ID who requested revision
 * @param {String} requestedByType - 'client' or 'coordinator'
 */
const requestWorkflowRevision = async (
  projectId,
  revisionRequested,
  userId,
  requestedByType = "client",
) => {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.status !== "workflow_sent") {
    throw new Error("Project workflow must be sent before requesting revision");
  }

  // Validate requestedByType
  if (!["client", "coordinator"].includes(requestedByType)) {
    throw new Error(
      'Invalid requestedByType. Must be "client" or "coordinator"',
    );
  }

  // Get user to determine their role
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // If coordinator is requesting revision, ensure requestedByType is 'coordinator'
  // If client is requesting revision, ensure requestedByType is 'client'
  if (user.role === "coordinator" || user.role === "admin") {
    // Coordinator/Admin can request revision on behalf of client or themselves
    // Use the provided requestedByType
  } else if (user.role === "client") {
    // Client can only request revision as 'client'
    requestedByType = "client";
  } else {
    throw new Error(
      "Only clients, coordinators, or admins can request workflow revision",
    );
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;
  const previousStatus = project.status;

  // Update project
  project.status = "workflow_revision_requested";
  project.workflowRevisionRequestedAt = new Date();
  project.workflowRevisionRequestedBy = userId;
  project.workflowRevisionRequestedByType = requestedByType;
  project.workflowRevisionRequested = revisionRequested;
  await project.save();

  const requesterLabel =
    requestedByType === "client" ? "client" : "coordinator";
  const description =
    requestedByType === "client"
      ? `Client requested workflow revision for project "${project.name}"`
      : `Coordinator requested workflow revision for project "${project.name}"`;

  // Create timeline event
  try {
    await createTimelineEvent({
      eventType: "project_workflow_revision_requested",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: userId,
      description: description,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        revisionRequested,
        revisionRequestedAt: project.workflowRevisionRequestedAt,
        revisionRequestedBy: userId.toString(),
        requestedByType: requestedByType,
        previousStatus: previousStatus,
        currentStatus: "workflow_revision_requested",
        workflowSentAt: project.workflowSentAt,
        workflowSentBy: project.workflowSentBy?.toString() || null,
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "project_workflow_revision_requested",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: userId,
      description:
        requestedByType === "client"
          ? `You requested workflow revision for project "${project.name}"`
          : `Workflow revision requested by coordinator for project "${project.name}"`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        revisionRequested,
        requestedByType: requestedByType,
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Review] Failed to create timeline event:",
      timelineError,
    );
    // Don't throw - timeline failure shouldn't break the flow
  }

  // Log audit
  await logAudit({
    userId,
    action: "project_workflow_revision_requested",
    details: {
      projectId,
      revisionRequested,
      requestedByType,
    },
  });

  return project;
};

/**
 * Enable posting tasks after approval
 * @param {String} projectId - Project ID
 */
const enablePostingTasks = async (projectId) => {
  await Task.updateMany(
    {
      projectId,
      taskType: "posting",
    },
    {
      status: "assigned",
    },
  );
};

/**
 * Calculate correction cost (if internal mistake)
 * @param {Object} correction - Correction document
 * @returns {Number} Cost impact
 */
const calculateCorrectionCost = async (correction) => {
  // Simple calculation: fixed cost per correction
  // Can be enhanced with actual time tracking
  const baseCorrectionCost = 500; // Base cost in currency units
  return baseCorrectionCost;
};

/**
 * Resolve correction
 * @param {String} correctionId - Correction ID
 * @param {String} userId - User ID who resolved
 */
const resolveCorrection = async (correctionId, userId) => {
  const correction =
    await Correction.findById(correctionId).populate("projectId");

  if (!correction) {
    throw new Error("Correction not found");
  }

  const project = await Project.findById(correction.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;

  correction.status = "resolved";
  correction.resolvedAt = new Date();
  correction.resolvedBy = userId;
  await correction.save();

  // Update project status back to 'in_progress' after correction is resolved
  // This allows the team to continue working and resubmit for review
  if (
    project.status === "sent_for_client_review" ||
    project.status === "approved"
  ) {
    project.status = "in_progress";
    await project.save();

    // Create timeline event for correction resolution
    try {
      await createTimelineEvent({
        eventType: "project_correction_resolved",
        entityType: "Project",
        entityId: project._id,
        performedByUserId: userId,
        description: `Correction resolved for project "${project.name}" - Project set back to in progress`,
        metadata: {
          projectId: project._id.toString(),
          projectName: project.name,
          correctionId: correction._id.toString(),
          correctionCategory: correction.category,
          resolvedAt: correction.resolvedAt,
          previousStatus: project.status,
          currentStatus: "in_progress",
        },
        companyId: tenantCompanyId,
      });

      // Also create timeline event on client
      await createTimelineEvent({
        eventType: "project_correction_resolved",
        entityType: "clientCompany",
        entityId: project.clientId,
        performedByUserId: userId,
        description: `Correction resolved for project "${project.name}"`,
        metadata: {
          projectId: project._id.toString(),
          projectName: project.name,
          correctionCategory: correction.category,
        },
        companyId: tenantCompanyId,
      });
    } catch (timelineError) {
      console.error(
        "[Project Review] Failed to create timeline event for correction resolution:",
        timelineError,
      );
    }
  }

  // Log audit
  await logAudit({
    userId,
    action: "correction_resolved",
    details: { correctionId, projectId: correction.projectId },
  });

  return correction;
};

/**
 * Upload posting proof
 * @param {String} projectId - Project ID
 * @param {Object} postingData - Posting proof data
 * @param {String} userId - User ID who uploaded
 */
const uploadPostingProof = async (projectId, postingData, userId) => {
  const project = await Project.findById(projectId).populate("masterItemId");

  if (!project) {
    throw new Error("Project not found");
  }

  // Allow posting proof upload when project is approved or in_progress
  if (project.status !== "approved" && project.status !== "in_progress") {
    throw new Error("Project must be approved and in progress before posting");
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;

  // Add posting proof
  const postingProofEntry = {
    platform: postingData.platform,
    url: postingData.url,
    screenshot: postingData.screenshot || null,
    postedAt: new Date(),
    postedBy: userId,
  };

  project.postingProof.push(postingProofEntry);

  // Check if all required platforms are posted (for metadata only, not auto-completion)
  const masterItem = project.masterItemId;
  const requiredPlatforms = masterItem?.postingPlatforms || [];
  let allPlatformsPosted = false;

  if (requiredPlatforms.length > 0) {
    const postedPlatforms = project.postingProof.map((p) => p.platform);
    allPlatformsPosted = requiredPlatforms.every((platform) =>
      postedPlatforms.includes(platform),
    );
  }

  await project.save();

  // Update posting task
  await Task.updateOne(
    {
      projectId,
      taskType: "posting",
      postingPlatform: postingData.platform,
    },
    {
      status: "completed",
      postingProof: {
        url: postingData.url,
        screenshot: postingData.screenshot || null,
        postedAt: new Date(),
      },
    },
  );

  // Create timeline event for posting proof upload
  try {
    await createTimelineEvent({
      eventType: "posting_proof_uploaded",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: userId,
      description: `Posting proof uploaded for ${postingData.platform}`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        platform: postingData.platform,
        url: postingData.url,
        screenshot: postingData.screenshot || null,
        postedAt: postingProofEntry.postedAt,
        totalPostingProofs: project.postingProof.length,
        requiredPlatforms: requiredPlatforms,
        allPlatformsPosted: allPlatformsPosted,
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "posting_proof_uploaded",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: userId,
      description: `Posting proof uploaded for ${postingData.platform} - Project "${project.name}"`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        platform: postingData.platform,
        url: postingData.url,
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Review] Failed to create timeline event for posting proof:",
      timelineError,
    );
  }

  // Log audit
  await logAudit({
    userId,
    action: "posting_proof_uploaded",
    details: {
      projectId,
      platform: postingData.platform,
      url: postingData.url,
      allPlatformsPosted,
    },
  });

  return project;
};

/**
 * Manually complete a project (Admin only)
 * @param {String} projectId - Project ID
 * @param {String} userId - User ID who completed
 */
const completeProject = async (projectId, userId) => {
  const project = await Project.findById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.status === "completed") {
    throw new Error("Project is already completed");
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;
  const previousStatus = project.status;

  // Update project status
  project.status = "completed";
  project.completedAt = new Date();
  project.completedBy = userId;
  await project.save();

  // Create timeline event for project completion
  try {
    await createTimelineEvent({
      eventType: "project_completed",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: userId,
      description: `Project "${project.name}" marked as completed`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        completedAt: project.completedAt,
        completedBy: userId.toString(),
        previousStatus: previousStatus,
        currentStatus: "completed",
        postingProofs: project.postingProof.map((p) => ({
          platform: p.platform,
          url: p.url,
          postedAt: p.postedAt,
        })),
        totalPostingProofs: project.postingProof.length,
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "project_completed",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: userId,
      description: `Project "${project.name}" marked as completed`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        completedAt: project.completedAt,
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Review] Failed to create timeline event for project completion:",
      timelineError,
    );
  }

  // Log audit
  await logAudit({
    userId,
    action: "project_completed",
    details: { projectId, previousStatus },
  });

  // Auto-Renewal Logic for Retainer Invoices
  try {
    if (project.invoiceId) {
      const currentInvoice = await Invoice.findById(project.invoiceId);
      if (currentInvoice && currentInvoice.invoiceType === 'Retainer') {
        // Calculate new dates based on retainerDuration
        const durationStr = currentInvoice.retainerDuration || '1 Month';
        const match = durationStr.match(/(\d+)/);
        const durationMonths = match ? Number(match[1]) : 1;

        const newInvoiceDate = new Date();
        const newDueDate = new Date();
        newDueDate.setMonth(newDueDate.getMonth() + durationMonths);

        // Generate a new invoice
        const newInvoiceData = {
          invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Will be overridden by pre-validate hook if not set, but good to have unique
          proposalId: currentInvoice.proposalId,
          clientId: currentInvoice.clientId,
          amount: currentInvoice.amount,
          tax: currentInvoice.tax,
          discount: currentInvoice.discount,
          grandTotal: currentInvoice.grandTotal,
          paymentStatus: 'Pending',
          invoiceStatus: 'Sent', // Auto-send to client's dashboard
          invoiceDate: newInvoiceDate,
          dueDate: newDueDate,
          paymentMode: currentInvoice.paymentMode,
          invoiceType: 'Retainer',
          retainerDuration: currentInvoice.retainerDuration,
          parentInvoiceId: currentInvoice._id,
          adminId: currentInvoice.adminId,
          agencyId: currentInvoice.agencyId,
          brandId: currentInvoice.brandId,
          createdBy: userId,
        };
        
        // Remove manual invoiceNumber so pre-validate hook generates it
        delete newInvoiceData.invoiceNumber;
        
        const newInvoice = await Invoice.create(newInvoiceData);
        
        // Auto-create new project (similar to renewProject but linked to the new invoice)
        const newStartDate = project.renewalDate ? new Date(project.renewalDate) : new Date();
        const newEndDate = new Date(newStartDate);
        newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

        const newRenewalDate = new Date(newEndDate);
        newRenewalDate.setDate(newRenewalDate.getDate() + 1);

        const newProjectData = {
          name: project.name,
          description: project.description,
          clientId: project.clientId,
          companyId: project.companyId,
          createdBy: userId,
          status: "created",
          isActive: true,
          startDate: newStartDate,
          endDate: newEndDate,
          renewalDate: newRenewalDate,
          departments: project.departments,
          invoiceId: newInvoice._id,
          invoiceItemId: project.invoiceItemId,
          masterItemId: project.masterItemId?._id || project.masterItemId,
          masterItemIds: project.masterItemIds || [],
          packageName: project.packageName,
          planId: project.planId,
          billingType: project.billingType,
          invoiceType: "final",
          invoiceDate: newInvoice.invoiceDate,
          maxAllowedCorrections: project.maxAllowedCorrections,
          numberOfPosters: project.numberOfPosters,
          numberOfVideos: project.numberOfVideos,
          numberOfShoots: project.numberOfShoots,
          remainingPosters: project.numberOfPosters,
          remainingVideos: project.numberOfVideos,
          remainingShoots: project.numberOfShoots,
          milestoneWorkflowType: project.milestoneWorkflowType,
          selectedCategories: (project.selectedCategories || []).map((cat) => ({
            name: cat.name,
            categoryName: cat.categoryName,
            quantity: cat.quantity,
            remaining: cat.quantity,
            cost: cat.cost,
          })),
        };

        const newProject = await Project.create(newProjectData);
        
        await logAudit({
          userId,
          action: "auto_project_renewed",
          details: { oldProjectId: project._id, newProjectId: newProject._id, newInvoiceId: newInvoice._id },
        });
      }
    }
  } catch (renewalError) {
    console.error("[Project Review] Failed to auto-renew project and invoice:", renewalError);
  }

  return project;
};

/**
 * Reopen a completed project (Admin only)
 * @param {String} projectId - Project ID
 * @param {String} userId - User ID who reopened
 */
const reopenProject = async (projectId, reopenData, userId) => {
  const Task = require("../tasks/task.model");
  const project = await Project.findById(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.status !== "completed") {
    throw new Error("Only completed projects can be reopened");
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;
  const previousStatus = project.status;

  // Update project status (from reopenData or default based on tasks)
  let newStatus = reopenData?.status;

  // If status not provided, determine based on tasks
  if (!newStatus) {
    const incompleteTasks = await Task.find({
      projectId,
      status: { $ne: "completed" },
    });
    newStatus = incompleteTasks.length > 0 ? "in_progress" : "approved";
  }

  // Validate status
  const validStatuses = [
    "created",
    "workflow_sent",
    "workflow_approved",
    "in_progress",
    "sent_for_client_review",
    "approved",
    "on_hold",
  ];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status for reopening: ${newStatus}`);
  }

  // Update project
  project.status = newStatus;
  project.completedAt = null;
  project.completedBy = null;

  // Handle additional payment details if provided
  if (reopenData?.additionalPayment) {
    project.additionalPayment = {
      amount: reopenData.additionalPayment.amount || 0,
      reason: reopenData.additionalPayment.reason || "",
      addedAt: new Date(),
      addedBy: userId,
      carriedForwardToInvoice: false,
      invoiceId: null,
    };
  }

  await project.save();

  // Update related task assignment status if provided
  if (reopenData?.updateTaskStatus && reopenData?.taskStatus) {
    await Task.updateMany(
      {
        projectId,
      },
      {
        $set: {
          status: reopenData.taskStatus,
        },
      },
    );
  }

  // Create timeline event for project reopening
  try {
    await createTimelineEvent({
      eventType: "project_reopened",
      entityType: "Project",
      entityId: project._id,
      performedByUserId: userId,
      description: `Project "${project.name}" reopened`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        previousStatus: previousStatus,
        currentStatus: project.status,
        reopenedAt: new Date(),
        reopenedBy: userId.toString(),
        additionalPayment: project.additionalPayment?.amount || 0,
        additionalPaymentReason: project.additionalPayment?.reason || null,
        taskStatusUpdated: reopenData?.updateTaskStatus || false,
        newTaskStatus: reopenData?.taskStatus || null,
      },
      companyId: tenantCompanyId,
    });

    // Also create timeline event on client
    await createTimelineEvent({
      eventType: "project_reopened",
      entityType: "clientCompany",
      entityId: project.clientId,
      performedByUserId: userId,
      description: `Project "${project.name}" reopened`,
      metadata: {
        projectId: project._id.toString(),
        projectName: project.name,
        currentStatus: project.status,
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Review] Failed to create timeline event for project reopening:",
      timelineError,
    );
  }

  // Log audit
  await logAudit({
    userId,
    action: "project_reopened",
    details: { projectId, previousStatus, newStatus: project.status },
  });

  return project;
};

/**
 * Add multiple posting proofs at once
 * @param {String} projectId - Project ID
 * @param {Object} bulkData - Object containing platforms array with { platform, url }
 * @param {String} userId - User ID who uploaded
 */
const addBulkPostingProofs = async (projectId, bulkData, userId) => {
  const project = await Project.findById(projectId).populate("masterItemId");

  if (!project) {
    throw new Error("Project not found");
  }

  // Allow posting proof upload when project is approved or in_progress
  if (project.status !== "approved" && project.status !== "in_progress") {
    throw new Error(
      "Project must be approved or in progress to add posting proof",
    );
  }

  // Get tenant company ID from project
  const tenantCompanyId = project.companyId;

  // Use raw body platforms if it's already an array (JSON request) or parse it if it's from FormData
  let platforms = bulkData.platforms;
  if (typeof platforms === "string") {
    try {
      platforms = JSON.parse(platforms);
    } catch (e) {
      throw new Error("Invalid platforms data");
    }
  }

  if (!platforms || !Array.isArray(platforms)) {
    throw new Error("Platforms array is required");
  }

  const screenshot = bulkData.screenshot || null;
  const newProofs = [];

  for (const proofData of platforms) {
    if (!proofData.platform || !proofData.url) {
      continue;
    }

    const postingProofEntry = {
      platform: proofData.platform,
      url: proofData.url,
      screenshot: screenshot, // Apply same screenshot to all selected platforms
      postedAt: new Date(),
      postedBy: userId,
    };

    project.postingProof.push(postingProofEntry);
    newProofs.push(postingProofEntry);

    // Update posting task if exists
    await Task.updateOne(
      {
        projectId,
        taskType: "posting",
        $or: [
          { postingPlatform: proofData.platform },
          { platform: proofData.platform },
        ],
      },
      {
        status: "completed",
        postingProof: {
          url: proofData.url,
          screenshot: screenshot,
          postedAt: postingProofEntry.postedAt,
        },
      },
    );

    // Create timeline event for each posting proof
    try {
      await createTimelineEvent({
        eventType: "posting_proof_uploaded",
        entityType: "Project",
        entityId: project._id,
        performedByUserId: userId,
        description: `Posting proof uploaded for ${proofData.platform}`,
        metadata: {
          projectId: project._id.toString(),
          projectName: project.name,
          platform: proofData.platform,
          url: proofData.url,
          screenshot: screenshot,
          postedAt: postingProofEntry.postedAt,
        },
        companyId: tenantCompanyId,
      });

      // Also create timeline event on client
      await createTimelineEvent({
        eventType: "posting_proof_uploaded",
        entityType: "clientCompany",
        entityId: project.clientId,
        performedByUserId: userId,
        description: `Posting proof uploaded for ${proofData.platform} - Project "${project.name}"`,
        metadata: {
          projectId: project._id.toString(),
          projectName: project.name,
          platform: proofData.platform,
          url: proofData.url,
        },
        companyId: tenantCompanyId,
      });
    } catch (timelineError) {
      console.error(
        "[Project Review] Failed to create timeline event for posting proof:",
        timelineError,
      );
    }
  }

  await project.save();

  // Log audit
  await logAudit({
    userId,
    action: "bulk_posting_proof_uploaded",
    details: {
      projectId,
      platforms: platforms.map((p) => p.platform),
      hasScreenshot: !!screenshot,
    },
  });

  return project;
};

/**
 * Update a posting proof entry
 * @param {String} projectId - Project ID
 * @param {String} proofId - Proof ID (subdocument ID)
 * @param {Object} updateData - Data to update (url, screenshot)
 * @param {String} userId - User ID who updated
 */
const updatePostingProof = async (projectId, proofId, updateData, userId) => {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  const proof = project.postingProof.id(proofId);
  if (!proof) throw new Error("Posting proof not found");

  // Update fields
  if (updateData.url) proof.url = updateData.url;
  if (updateData.screenshot !== undefined)
    proof.screenshot = updateData.screenshot;
  if (updateData.platform) proof.platform = updateData.platform;

  await project.save();

  // Update task if exists
  await Task.updateOne(
    {
      projectId,
      taskType: "posting",
      $or: [{ postingPlatform: proof.platform }, { platform: proof.platform }],
    },
    {
      postingProof: {
        url: proof.url,
        screenshot: proof.screenshot,
        postedAt: proof.postedAt,
      },
    },
  );

  await logAudit({
    userId,
    action: "posting_proof_updated",
    details: { projectId, proofId, platform: proof.platform },
  });

  return project;
};

/**
 * Delete a posting proof entry
 * @param {String} projectId - Project ID
 * @param {String} proofId - Proof ID (subdocument ID)
 * @param {String} userId - User ID who deleted
 */
const deletePostingProof = async (projectId, proofId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");

  const proof = project.postingProof.id(proofId);
  if (!proof) throw new Error("Posting proof not found");

  const platform = proof.platform;
  project.postingProof.pull(proofId);
  await project.save();

  // Optional: Reset task status if needed
  await Task.updateOne(
    {
      projectId,
      taskType: "posting",
      $or: [{ postingPlatform: platform }, { platform: platform }],
    },
    {
      status: "assigned",
      $unset: { postingProof: "" },
    },
  );

  await logAudit({
    userId,
    action: "posting_proof_deleted",
    details: { projectId, proofId, platform },
  });

  return project;
};

/**
 * Delete a correction request and its associated task if any
 * @param {String} correctionId - Correction ID
 * @param {String} userId - User ID who deleted
 */
const deleteCorrection = async (correctionId, userId) => {
  const correction = await Correction.findById(correctionId);
  if (!correction) {
    throw new Error("Correction not found");
  }

  const projectId = correction.projectId;
  const project = await Project.findById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  // If there's an associated task, handle it
  if (correction.taskId) {
    const task = await Task.findById(correction.taskId);
    if (task) {
      // If the task was created for this correction (Checking taskCategory)
      if (
        task.taskCategory === "Redesign" ||
        task.taskCategory === "Correction"
      ) {
        // Delete the newly created task
        await Task.findByIdAndDelete(correction.taskId);
      }
    }
  }

  // Delete the correction record
  await Correction.findByIdAndDelete(correctionId);

  // Log audit
  await logAudit({
    userId: userId,
    action: "correction_deleted",
    details: {
      projectId,
      correctionId,
      correctionRound: correction.correctionRound,
    },
  });

  return { success: true };
};

/**
 * Renew a completed project into a new cycle
 * @param {String} projectId - Current Project ID
 * @param {String} userId - User ID who renewed
 */
const renewProject = async (projectId, userId) => {
  const project = await Project.findById(projectId).populate("masterItemId");
  if (!project) throw new Error("Project not found");

  const tenantCompanyId = project.companyId;

  // Calculate new dates
  // New Start Date = Current Renewal Date (if exists) or Tomorrow
  const newStartDate = project.renewalDate
    ? new Date(project.renewalDate)
    : new Date();

  // Calculate duration from previous project to maintain consistency
  let durationMonths = 1;
  if (project.startDate && project.endDate) {
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    durationMonths =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    if (durationMonths <= 0) durationMonths = 1;
  } else if (project.masterItemId?.handlingDuration) {
    // Fallback to master item duration
    const match = String(project.masterItemId.handlingDuration).match(/(\d+)/);
    durationMonths = match ? Number(match[1]) : 1;
  }

  const newEndDate = new Date(newStartDate);
  newEndDate.setMonth(newEndDate.getMonth() + Number(durationMonths));

  const newRenewalDate = new Date(newEndDate);
  newRenewalDate.setDate(newRenewalDate.getDate() + 1);

  // Create NEW project object (Cloning settings)
  const newProjectData = {
    name: project.name,
    description: project.description,
    clientId: project.clientId,
    companyId: project.companyId,
    createdBy: userId,
    status: "created",
    isActive: true,
    startDate: newStartDate,
    endDate: newEndDate,
    renewalDate: newRenewalDate,
    departments: project.departments,
    invoiceId: project.invoiceId,
    invoiceItemId: project.invoiceItemId,
    masterItemId: project.masterItemId._id || project.masterItemId,
    packageName: project.packageName,
    planId: project.planId,
    billingType: project.billingType,
    invoiceType: project.invoiceType,
    invoiceDate: project.invoiceDate,
    maxAllowedCorrections: project.maxAllowedCorrections,
    numberOfPosters: project.numberOfPosters,
    numberOfVideos: project.numberOfVideos,
    numberOfShoots: project.numberOfShoots,
    remainingPosters: project.numberOfPosters,
    remainingVideos: project.numberOfVideos,
    remainingShoots: project.numberOfShoots,
    milestoneWorkflowType: project.milestoneWorkflowType,
    selectedCategories: (project.selectedCategories || []).map((cat) => ({
      name: cat.name,
      categoryName: cat.categoryName,
      quantity: cat.quantity,
      remaining: cat.quantity,
      cost: cat.cost,
    })),
  };

  const newProject = await Project.create(newProjectData);

  // Create timeline event for renewal
  try {
    await createTimelineEvent({
      eventType: "project_renewed",
      entityType: "Project",
      entityId: newProject._id,
      performedByUserId: userId,
      description: `Project "${newProject.name}" renewed from previous project cycle`,
      metadata: {
        previousProjectId: projectId,
        newProjectId: newProject._id.toString(),
        startDate: newStartDate,
        endDate: newEndDate,
      },
      companyId: tenantCompanyId,
    });
  } catch (timelineError) {
    console.error(
      "[Project Review] Failed to create timeline event for project renewal:",
      timelineError,
    );
  }

  // Log audit
  await logAudit({
    userId,
    action: "project_renewed",
    details: { oldProjectId: projectId, newProjectId: newProject._id },
  });

  return newProject;
};

module.exports = {
  submitForClientReview,
  clientApprove,
  requestCorrection,
  resolveCorrection,
  uploadPostingProof,
  addBulkPostingProofs,
  updatePostingProof,
  deletePostingProof,
  sendWorkflow,
  requestWorkflowRevision,
  completeProject,
  reopenProject,
  deleteCorrection,
  renewProject,
};
