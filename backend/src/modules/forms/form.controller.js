const Form = require('./form.model');
const FormSubmission = require('./form-submission.model');
const mongoose = require('mongoose');

function buildAssetAuthQuery(req, baseQuery = {}) {
  const query = { ...baseQuery, isDeleted: false };
  const workspaceId = req.workspaceId;

  const isClientRole = req.isClientRole || (req.user && ['client', 'agency_client', 'brand_super_admin', 'brand_manager', 'client_user', 'brand_team_user'].includes(req.user.role));

  if (isClientRole) {
    const clientUserId = req.clientUserId || req.user?._id;
    query.$or = [
      { brandId: clientUserId },
      { createdBy: clientUserId },
      { updatedBy: clientUserId }
    ];
  } else if (req.user && req.user.role !== 'commander_admin') {
    if (req.user.agencyId) {
      query.agencyId = req.user.agencyId;
    } else if (workspaceId) {
      query.workspaceId = workspaceId;
    }
  } else if (workspaceId) {
    query.workspaceId = workspaceId;
  }
  return query;
}

// Create Form
exports.createForm = async (req, res, next) => {
  try {
    const { name, type, fields, settings } = req.body;
    const workspaceId = req.workspaceId;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Form name is required' });
    }

    let initialFields = [];
    if (fields && Array.isArray(fields) && fields.length > 0) {
      initialFields = fields;
    } else if (type === 'template' || type === 'templates') {
      initialFields.push(
        { label: 'First Name', type: 'text', required: true, placeholder: 'Jane', order: 0 },
        { label: 'Last Name', type: 'text', required: true, placeholder: 'Doe', order: 1 },
        { label: 'Phone', type: 'text', required: true, placeholder: 'Phone', order: 2 },
        { label: 'Email', type: 'text', required: true, placeholder: 'you@example.com', order: 3 }
      );
    }

    const form = new Form({
      workspaceId,
      agencyId: req.user?.agencyId || null,
      brandId: req.isClientRole ? (req.clientUserId || req.user?._id) : (req.user?.brandId || req.user?._id),
      name,
      status: 'Published',
      fields: initialFields,
      settings: settings || {},
      createdBy: req.user?._id,
      updatedBy: req.user?._id
    });

    const saved = await form.save();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    next(error);
  }
};

// List Forms
exports.getForms = async (req, res, next) => {
  try {
    const { search } = req.query;
    const baseQuery = {};
    if (search) {
      baseQuery.name = { $regex: search, $options: 'i' };
    }

    const query = buildAssetAuthQuery(req, baseQuery);
    const forms = await Form.find(query).sort({ updatedAt: -1 });
    res.json({ success: true, data: forms });
  } catch (error) {
    next(error);
  }
};

// Get Form Details
exports.getFormDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = buildAssetAuthQuery(req, { _id: id });
    const form = await Form.findOne(query);
    if (!form) {
      return res.status(404).json({ success: false, error: 'Form not found' });
    }
    res.json({ success: true, data: form });
  } catch (error) {
    next(error);
  }
};


// Get Public Form Details (for Embed)
exports.getPublicForm = async (req, res, next) => {
  try {
    const { id } = req.params;
    // We only check if the form exists and is not deleted. We do not check workspaceId because this is public.
    const form = await Form.findOne({ _id: id, isDeleted: false, status: 'Published' });
    if (!form) {
      return res.status(404).json({ success: false, error: 'Form not found or not published' });
    }
    // Return only necessary public data (exclude sensitive IDs like createdBy if any, though it's relatively safe)
    res.json({ 
      success: true, 
      data: {
        _id: form._id,
        name: form.name,
        fields: form.fields,
        settings: form.settings
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update Form Structure / Fields / Settings
exports.updateForm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, status, fields, settings } = req.body;

    const form = await Form.findOne({ _id: id, workspaceId: req.workspaceId, isDeleted: false });
    if (!form) {
      return res.status(404).json({ success: false, error: 'Form not found' });
    }

    if (name) form.name = name;
    if (status) form.status = status;
    if (fields) form.fields = fields;
    if (settings) {
      form.settings = { ...form.settings, ...settings };
    }
    form.updatedBy = req.user?._id;

    const saved = await form.save();
    res.json({ success: true, data: saved });
  } catch (error) {
    next(error);
  }
};

// Delete Form
exports.deleteForm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const form = await Form.findOne({ _id: id, workspaceId: req.workspaceId, isDeleted: false });
    if (!form) {
      return res.status(404).json({ success: false, error: 'Form not found' });
    }

    form.isDeleted = true;
    form.updatedBy = req.user?._id;
    await form.save();

    res.json({ success: true, message: 'Form deleted' });
  } catch (error) {
    next(error);
  }
};

// Public Submit Form Endpoint
exports.submitForm = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = req.body; // e.g. { "first name": "Jane", "email": "..." }

    const form = await Form.findOne({ _id: id, isDeleted: false });
    if (!form) {
      return res.status(404).json({ success: false, error: 'Form not found or disabled' });
    }

    // Dynamic field validation
    const submissionDetails = {};
    let email = "";
    let phone = "";
    let name = "";
    let firstName = "";

    for (const field of form.fields) {
      // Find matching value from payload (case-insensitive keys)
      const fieldKey = Object.keys(payload).find(
        key => key.toLowerCase() === field.label.toLowerCase()
      );
      const val = fieldKey ? payload[fieldKey] : undefined;

      if (field.required && (!val || val.toString().trim() === "")) {
        return res.status(400).json({ success: false, error: `Field '${field.label}' is required` });
      }

      if (val !== undefined) {
        submissionDetails[field.label] = val.toString();
        
        // Populate standard compatibility variables
        const labelLower = field.label.toLowerCase();
        if (labelLower === 'email') {
          email = val.toString();
        } else if (labelLower === 'phone') {
          phone = val.toString();
        } else if (labelLower === 'first name' || labelLower === 'firstname') {
          firstName = val.toString();
        } else if (labelLower === 'last name' || labelLower === 'lastname') {
          // append/handle name
        } else if (labelLower === 'name') {
          name = val.toString();
        }
      }
    }

    if (!name && firstName) {
      name = firstName;
      const lastNameKey = Object.keys(payload).find(k => k.toLowerCase() === 'last name' || k.toLowerCase() === 'lastname');
      if (lastNameKey) name += " " + payload[lastNameKey];
    }

    const submission = new FormSubmission({
      formId: id,
      name,
      email,
      firstName,
      phone,
      details: submissionDetails
    });

    const saved = await submission.save();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    next(error);
  }
};

// List Form Submissions
exports.getSubmissions = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const { formId, startDate, endDate, search } = req.query;

    // Find all forms in workspace to restrict scoped visibility
    const workspaceForms = await Form.find({ workspaceId, isDeleted: false });
    const formIds = workspaceForms.map(f => f._id);

    const query = { isDeleted: false };
    
    if (formId && formId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(formId)) {
        query.formId = new mongoose.Types.ObjectId(formId);
      }
    } else {
      query.formId = { $in: formIds };
    }

    // Date filters
    if (startDate || endDate) {
      query.submittedAt = {};
      if (startDate) {
        query.submittedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.submittedAt.$lte = new Date(endDate);
      }
    }

    // Search filters (matches name, email, or phone)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const submissions = await FormSubmission.find(query)
      .populate('formId', 'name')
      .sort({ submittedAt: -1 });

    res.json({ success: true, data: submissions });
  } catch (error) {
    next(error);
  }
};

// Analytics details
exports.getFormAnalytics = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const workspaceForms = await Form.find({ workspaceId, isDeleted: false });
    const formIds = workspaceForms.map(f => f._id);

    const totalSubmissions = await FormSubmission.countDocuments({
      formId: { $in: formIds },
      isDeleted: false
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSubmissions = await FormSubmission.countDocuments({
      formId: { $in: formIds },
      submittedAt: { $gte: thirtyDaysAgo },
      isDeleted: false
    });

    // Submissions aggregated per-form
    const submissionsPerForm = await Promise.all(workspaceForms.map(async (form) => {
      const count = await FormSubmission.countDocuments({ formId: form._id, isDeleted: false });
      return {
        form: form.name,
        submissions: count
      };
    }));

    res.json({
      success: true,
      data: {
        totalSubmissions,
        recentSubmissions,
        formsCount: workspaceForms.length,
        submissionsPerForm
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteSubmission = async (req, res, next) => {
  try {
    const FormSubmission = require('./form-submission.model');
    await FormSubmission.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};