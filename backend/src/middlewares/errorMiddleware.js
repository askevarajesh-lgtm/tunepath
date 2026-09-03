const fs = require('fs');

const errorMiddleware = (err, req, res, next) => {
  console.error(err.stack);
  try {
    fs.appendFileSync('backend_error.log', new Date().toISOString() + '\\n' + err.stack + '\\n\\n');
  } catch(e) {}


  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    let fieldName = 'field';
    if (field === 'phone') fieldName = 'phone number';
    else if (field === 'email') fieldName = 'email address';
    else fieldName = field;
    message = `An account with that ${fieldName} already exists. Please use a different ${fieldName}.`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    message: message,
  });
};

module.exports = errorMiddleware;
