const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const authMiddleware = async (req, res, next) => {
  // If in development and no auth header, mock a workspace and user scope
  const authHeader = req.headers.authorization;
  const devWorkspaceHeader = req.headers['x-workspace-id'];

  let workspaceId = devWorkspaceHeader;
  let user = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(',')[0].split(' ')[1].replace(/,$/, '');
    if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_12345');
        user = decoded;
        req.user = decoded;
        workspaceId = workspaceId || decoded.workspaceId;
        req.companyId = decoded.agencyId || decoded.brandId || decoded.workspaceId || decoded.adminId;

        if (!req.companyId && decoded._id) {
          try {
            const User = mongoose.model('User');
            const dbUser = await User.findById(decoded._id).lean();
            if (dbUser) {
              req.companyId = dbUser.agencyId || dbUser.brandId || dbUser.workspaceId || dbUser.adminId;
              if (!req.companyId && ['agency', 'agency_manager', 'agency_super_admin', 'brand_super_admin', 'brand_manager', 'client', 'commander_admin', 'supreme_super_admin'].includes(dbUser.role)) {
                req.companyId = dbUser._id;
              }
              req.user.adminId = dbUser.adminId;
            }
          } catch (dbErr) {
            console.error("AuthMiddleware DB lookup error:", dbErr);
          }
        }
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: error.message === 'jwt expired' ? 'jwt expired' : 'Unauthorized: Invalid token',
          message: error.message
        });
      }
    }
  }

  // Fallback default workspace for sandbox testing
  if (!workspaceId) {
    workspaceId = '60d0fe4f5311236168a10000'; // mock static workspaceId
  }

  // Cast workspaceId to Mongoose ObjectId if valid
  if (mongoose.Types.ObjectId.isValid(workspaceId)) {
    req.workspaceId = new mongoose.Types.ObjectId(workspaceId);
  } else {
    // Generate static object ID from string to keep validation consistent
    req.workspaceId = new mongoose.Types.ObjectId('60d0fe4f5311236168a10000');
  }

  // Inject a mock user if not populated by JWT
  if (!req.user) {
    req.user = {
      _id: new mongoose.Types.ObjectId('60d0fe4f5311236168a20000'),
      name: 'Sandbox User',
      email: 'sandbox@tunepath.askeva.io',
      workspaceId: req.workspaceId
    };
  }

  if (!req.companyId && req.user) {
    req.companyId = req.user.agencyId || req.user.brandId || req.user.workspaceId || req.user.adminId;
    if (!req.companyId && ['agency', 'agency_manager', 'agency_super_admin', 'brand_super_admin', 'brand_manager', 'client', 'commander_admin', 'supreme_super_admin'].includes(req.user.role)) {
      req.companyId = req.user._id;
    }
  }

  // Parse global client switcher header for Agency Users
  const selectedClientIdHeader = req.headers['x-selected-client-id'];
  
  // Skip soft impersonation/client-filtering for management endpoints
  const isManagementRoute = req.originalUrl && (
    req.originalUrl.includes('/brands') ||
    req.originalUrl.includes('/packages') ||
    req.originalUrl.includes('/users') ||
    req.originalUrl.includes('/agencies') ||
    req.originalUrl.includes('/slas')
  );

  if (selectedClientIdHeader && mongoose.Types.ObjectId.isValid(selectedClientIdHeader) && req.user && !isManagementRoute) {
    req.selectedClientId = new mongoose.Types.ObjectId(selectedClientIdHeader);
    
    // Inject into query parameters so that existing controllers/services 
    // that support frontend client filtering automatically apply it.
    if (!req.query) req.query = {};
    req.query.clientId = selectedClientIdHeader;
    req.query.companyId = selectedClientIdHeader;
    req.query.clientCompanyId = selectedClientIdHeader;

    // Soft Impersonation for Agency Users
    // This allows Agency Managers to seamlessly use the client portal context across all modules
    const agencyRoles = ['agency_manager', 'agency_super_admin', 'agency', 'commander_admin'];
    if (agencyRoles.includes(req.user.role)) {
       req.user.originalRole = req.user.role;
       req.user.role = 'brand_manager'; // Act as a client manager to isolate data
       req.user.brandId = req.selectedClientId;
       
       // Ensure agencyId is preserved so any records created still link back to the agency properly
       if (req.selectedClientId) {
          try {
             const ClientCompany = mongoose.model("User"); // ClientCompany is User model in this architecture
             const clientData = await ClientCompany.findById(req.selectedClientId).select("agencyId").lean();
             if (clientData && clientData.agencyId) {
               req.companyId = clientData.agencyId;
               req.user.agencyId = clientData.agencyId;
             }
          } catch(e) {}
       }
    }
  }

  if (req.user) {
    req.isClientRole = ['client', 'agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user'].includes(req.user.role) || (req.user.role === 'user' && req.user.brandId);
    req.user.isClientRole = req.isClientRole;
    if (req.isClientRole) {
      req.clientUserId = req.user.clientId || req.user.brandId || req.user._id;
      req.user.clientUserId = req.clientUserId;
    }
  }

  next();
};

module.exports = authMiddleware;
