const mongoose = require('mongoose');

// Set default returnDocument to resolve findOneAndUpdate deprecation warnings
mongoose.set('returnDocument', 'after');

const connectDB = async () => {
  try {
    console.log(process.env.MONGODB_URI,"-----------------")
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local';
    const uri = isDev ? (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI) : process.env.MONGODB_URI;
    console.log(uri,"-----------------")
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
