const mongoose = require('mongoose');
const Domain = require('./domain.model');
const Website = require('../websites/website.model');


const dns = require('dns').promises;
const crypto = require('crypto');

// Connect Domain
exports.connectDomain = async (req, res, next) => {
  try {
    const { customDomain, propertyType, property } = req.body;
    const workspaceId = req.workspaceId;

    if (!customDomain || !propertyType || !property) {
      return res.status(400).json({ success: false, error: 'All fields (customDomain, propertyType, property) are required' });
    }

    let domainName = customDomain.trim().toLowerCase();
    domainName = domainName.replace(/^https?:\/\//, '');
    domainName = domainName.split('/')[0];
    domainName = domainName.split(':')[0];

    // Reserved hostname check
    if (domainName.includes('tunepath.askeva.io') || domainName.includes('m1.workforce.themilabs.com')) {
      return res.status(400).json({ success: false, error: 'That hostname is reserved for this application.' });
    }

    // Clean up any legacy soft-deleted records for this domain name to prevent duplicate key constraint issues
    await Domain.deleteMany({ domain: domainName, isDeleted: true });

    // Check if domain is already connected
    const domainExists = await Domain.findOne({ domain: domainName });
    if (domainExists) {
      return res.status(400).json({ success: false, error: 'This domain name is already connected to a project' });
    }

    // Find the associated property (Website)
    // Supports matching by ID or by name
    let propertyEntity = null;
    if (propertyType === 'Website') {
      propertyEntity = await Website.findOne({ 
        $or: [{ _id: mongoose.Types.ObjectId.isValid(property) ? property : new mongoose.Types.ObjectId() }, { name: property }],
        workspaceId,
        isDeleted: false
      });


    }

    // Fallback: If no property found, auto-create/lookup a fallback to ensure user isn't blocked
    if (!propertyEntity) {
      if (propertyType === 'Website') {
        propertyEntity = await Website.findOne({ workspaceId, isDeleted: false });


      }
    }

    if (!propertyEntity) {
      return res.status(400).json({ success: false, error: `No active ${propertyType} found to bind this domain.` });
    }

    // Generate random TXT verification challenge token
    const txtToken = crypto.randomBytes(24).toString('hex');

    const domain = new Domain({
      workspaceId,
      domain: domainName,
      propertyType,
      propertyId: propertyEntity._id,
      status: 'Pending',
      txtVerificationToken: txtToken,
      createdBy: req.user?._id,
      updatedBy: req.user?._id
    });

    const saved = await domain.save();

    // Bind domainId to entity
    propertyEntity.domainId = saved._id;
    await propertyEntity.save();

    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    next(error);
  }
};

// List Domains
exports.getDomains = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const { search } = req.query;

    const query = { workspaceId, isDeleted: { $ne: true } };
    if (search) {
      query.domain = { $regex: search, $options: 'i' };
    }

    const domains = await Domain.find(query).sort({ createdAt: -1 });

    const data = await Promise.all(domains.map(async (d) => {
      let connectedName = "";
      if (d.propertyType === 'Website') {
        const web = await Website.findById(d.propertyId);
        connectedName = web ? `Website · ${web.name}` : 'Website · Unknown';


      }

      return {
        ...d.toObject(),
        connectedTo: connectedName
      };
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// Get details
exports.getDomainDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const domain = await Domain.findOne({ _id: id, workspaceId: req.workspaceId, isDeleted: { $ne: true } });
    if (!domain) {
      return res.status(404).json({ success: false, error: 'Domain connection not found' });
    }
    res.json({ success: true, data: domain });
  } catch (error) {
    next(error);
  }
};

// Disconnect / Delete Domain
exports.disconnectDomain = async (req, res, next) => {
  try {
    const { id } = req.params;
    const domain = await Domain.findOne({ _id: id, workspaceId: req.workspaceId });
    if (!domain) {
      return res.status(404).json({ success: false, error: 'Domain connection not found' });
    }

    // Clear domain references in the connected property
    if (domain.propertyType === 'Website') {
      await Website.updateOne({ _id: domain.propertyId }, { $unset: { domainId: "" } });
      await Website.updateMany({ domainId: domain._id }, { $unset: { domainId: "" } });
    }

    // Permanently delete the domain document from DB
    await Domain.deleteOne({ _id: domain._id });

    res.json({ success: true, message: 'Domain disconnected successfully' });
  } catch (error) {
    next(error);
  }
};

// Verify DNS Records & Activate
exports.verifyDNS = async (req, res, next) => {
  try {
    const { id } = req.params;
    const domain = await Domain.findOne({ _id: id, workspaceId: req.workspaceId, isDeleted: { $ne: true } });
    if (!domain) {
      return res.status(404).json({ success: false, error: 'Domain connection not found' });
    }

    let isVerified = false;

    // Auto-verify local dev domains (.local, .localhost, or NODE_ENV === 'local')
    if (
      domain.domain.endsWith('.local') ||
      domain.domain.endsWith('.localhost') ||
      domain.domain.includes('localhost') ||
      process.env.NODE_ENV === 'local' ||
      process.env.NODE_ENV === 'development'
    ) {
      isVerified = true;
    }

    if (!isVerified) {
      try {
        // 1. Perform CNAME lookup verification
        const cnameRecords = await dns.resolveCname(domain.domain);
        if (cnameRecords.some(r => r.includes('tunepath.askeva.io') || r.includes('m1.workforce.themilabs.com'))) {
          isVerified = true;
        }
      } catch (e) {
        // ignore check to fall back to TXT check
      }
    }

    if (!isVerified) {
      try {
        // 2. Perform TXT verification lookup
        const host = `_bcc-verify.${domain.domain}`;
        const txtRecordsList = await dns.resolveTxt(host);
        // txtRecordsList is array of arrays: [['token...']]
        for (const recordArr of txtRecordsList) {
          if (recordArr.includes(domain.txtVerificationToken)) {
            isVerified = true;
            break;
          }
        }
      } catch (e) {
        // ignore txt lookup error
      }
    }



    if (isVerified) {
      domain.status = 'Connected';
      await domain.save();
      res.json({ success: true, message: 'Domain verification successful. Domain is now active.', data: domain });
    } else {
      res.status(400).json({ success: false, error: 'DNS verification failed. Please check records and try again later.' });
    }
  } catch (error) {
    next(error);
  }
};
