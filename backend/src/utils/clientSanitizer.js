const mongoose = require('mongoose');

const sanitizeForClient = (data) => {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForClient(item));
  }
  
  if (data instanceof Date) {
    return data;
  }

  // Handle Mongoose ObjectId
  if (data instanceof mongoose.Types.ObjectId) {
    return data;
  }
  
  if (typeof data === 'object') {
    // If it's a Mongoose document
    let obj = data;
    if (typeof data.toObject === 'function') {
      obj = data.toObject({ getters: true, virtuals: false });
    } else {
      // Shallow copy plain object to avoid mutating original
      obj = { ...data };
    }
    
    // Explicitly delete sensitive fields
    delete obj.subAgencyId;
    delete obj.delegatedByUserId;
    delete obj.subAgency;
    
    // Recursively sanitize populated objects or nested structures
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
         obj[key] = sanitizeForClient(obj[key]);
      }
    }
    return obj;
  }
  
  return data;
};

const withClientSanitization = (req, data) => {
  if (req.user?.role === 'client' || req.user?.roleName === 'client') {
    return sanitizeForClient(data);
  }
  return data;
};

module.exports = {
  sanitizeForClient,
  withClientSanitization
};
