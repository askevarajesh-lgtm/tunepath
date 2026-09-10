const cloudinary = require('../config/cloudinary');

async function uploadAnyFileToCloudinary(filePath, folder = "general", options = {}, extra = {}, retries = 2) {
  let resource_type = "auto";
  if (extra && extra.mimetype && extra.mimetype.startsWith("video/")) {
    resource_type = "video";
  }

  const uploadOptions = { resource_type, folder, timeout: 120000, ...(options || {}) };
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await cloudinary.uploader.upload(filePath, uploadOptions);
    } catch (err) {
      lastError = err;
      console.warn(`[Cloudinary] Upload attempt ${attempt}/${retries} failed:`, err?.message || err?.error?.message || err);
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }
  throw lastError;
}

async function uploadBufferToCloudinary(buffer, folder = "general", publicId, extra = {}) {
  let resource_type = "auto";
  if (extra && extra.mimetype && extra.mimetype.startsWith("video/")) {
    resource_type = "video";
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type, folder, public_id: publicId, timeout: 120000 },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

module.exports = {
  uploadAnyFileToCloudinary,
  uploadBufferToCloudinary
};
