const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SlaRecord = require('./src/modules/sla/sla.model');
const Task = require('./src/modules/tasks/task.model');

async function cleanUnnecessaryTaskSlas() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tunepath';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const now = new Date();
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    // Delete all Normal status task SLAs
    const normalTaskSlaResult = await SlaRecord.deleteMany({
      entityType: 'Task',
      status: 'Normal'
    });
    console.log('Deleted Normal status task SLAs:', normalTaskSlaResult.deletedCount);

    // Also check pending tasks whose due date has not passed 11:59 PM and are not within 2 days
    const pendingTasks = await Task.find({
      status: { $nin: ['completed', 'complete', 'validated', 'done', 'rejected'] }
    });

    let removedCount = 0;
    for (const task of pendingTasks) {
      if (!task.dueDate) {
        const res = await SlaRecord.deleteOne({ entityId: task._id, entityType: 'Task' });
        if (res.deletedCount > 0) removedCount++;
        continue;
      }

      const dueDate = new Date(task.dueDate);
      dueDate.setHours(23, 59, 59, 999);

      if (now <= dueDate && dueDate > twoDaysFromNow) {
        const res = await SlaRecord.deleteOne({ entityId: task._id, entityType: 'Task' });
        if (res.deletedCount > 0) removedCount++;
      }
    }

    console.log('Cleaned unbreached task SLAs for tasks within active schedule:', removedCount);
    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
}

cleanUnnecessaryTaskSlas();
