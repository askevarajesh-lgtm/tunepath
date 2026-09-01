const cron = require('node-cron');
const SlaRecord = require('./sla.model');
const Task = require('../tasks/task.model');
const Invoice = require('../invoices/invoice.model');
const Project = require('../projects/project.model');
const { dispatchSystemNotification } = require('../tasks/notification.service');

// Run every hour
const startSlaScheduler = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('Running SLA Scheduler...');
    try {
      const now = new Date();
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

      // 1. Check Due Dates for Tasks
      const pendingTasks = await Task.find({ 
        status: { $nin: ['completed', 'complete', 'validated', 'done', 'rejected'] } 
      });

      for (const task of pendingTasks) {
        if (!task.dueDate) continue;

        // A task should remain active for the entire day it was created without triggering an SLA
        const taskCreatedAt = new Date(task.createdAt || task._id.getTimestamp());
        const isSameDayCreated = 
          taskCreatedAt.getFullYear() === now.getFullYear() &&
          taskCreatedAt.getMonth() === now.getMonth() &&
          taskCreatedAt.getDate() === now.getDate();

        if (isSameDayCreated) {
          // Clean up any mistakenly created SLAs on day 1
          await SlaRecord.deleteOne({ entityId: task._id, entityType: 'Task' });
          continue;
        }

        let status = 'Normal';
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(23, 59, 59, 999);

        if (now > dueDate) {
          status = 'Breached';
        } else if (dueDate <= twoDaysFromNow) {
          status = 'At Risk';
        }

        // Check existing status to determine if we should send a notification
        const existingSla = await SlaRecord.findOne({ entityId: task._id, entityType: 'Task' });
        const oldStatus = existingSla ? existingSla.status : 'Normal';

        // Upsert SLA Record
        const updatedSla = await SlaRecord.findOneAndUpdate(
          { entityId: task._id, entityType: 'Task' },
          {
            slaId: existingSla ? existingSla.slaId : `SLA-TSK-${task._id.toString().substring(0, 8).toUpperCase()}`,
            clientId: task.companyId,
            agencyId: task.tenantCompanyId,
            clientType: task.taskType === 'own_brand' ? 'Agency' : 'Direct User Client',
            triggerType: 'Due Date',
            entityId: task._id,
            entityType: 'Task',
            title: `Task: ${task.title}`,
            description: `Due Date Monitoring for Task ${task.title}`,
            dueDate: task.dueDate,
            priority: task.priority === 'high' || task.priority === 'critical' ? task.priority : (status === 'Breached' ? 'High' : 'Medium'),
            status,
            assignedTo: task.assignedTo
          },
          { upsert: true, returnDocument: 'after' }
        );

        // Dispatch notification if status escalated to At Risk or Breached
        if (updatedSla && (status === 'At Risk' || status === 'Breached') && status !== oldStatus) {
          await dispatchSystemNotification(
            task.tenantCompanyId,
            status === 'Breached' ? 'sla_breached' : 'sla_at_risk',
            'SLA Trigger',
            `SLA ${status}: ${updatedSla.title}`,
            `The SLA for ${updatedSla.title} is now ${status}.`,
            { slaId: updatedSla._id, entityId: task._id, entityType: 'Task' }
          );
        }
      }

      // 2. Check Due Dates for Projects
      const pendingProjects = await Project.find({
        status: { $nin: ['completed', 'cancelled'] }
      });

      for (const project of pendingProjects) {
        if (!project.endDate) continue;

        let status = 'Normal';
        const dueDate = new Date(project.endDate);
        dueDate.setHours(23, 59, 59, 999);

        if (now > dueDate) {
          status = 'Breached';
        } else if (dueDate <= twoDaysFromNow) {
          status = 'At Risk';
        }

        let totalDeliverables = (project.numberOfPosters || 0) + (project.numberOfVideos || 0) + (project.numberOfShoots || 0);
        let completedDeliverables = (project.completedPosters || 0) + (project.completedVideos || 0) + (project.completedShoots || 0);
        let remainingServices = [];

        if (project.remainingPosters > 0) remainingServices.push(`${project.remainingPosters} Posters`);
        if (project.remainingVideos > 0) remainingServices.push(`${project.remainingVideos} Videos`);
        if (project.remainingShoots > 0) remainingServices.push(`${project.remainingShoots} Shoots`);
        
        if (project.selectedCategories && Array.isArray(project.selectedCategories)) {
          project.selectedCategories.forEach(cat => {
            const rawName = cat.name || cat.categoryName || "";
            const isStandard = ["poster", "video", "shoot"].some(k => rawName.toLowerCase().includes(k));
            if (!isStandard) {
              const qty = cat.quantity || 0;
              const completed = cat.completed || 0;
              totalDeliverables += qty;
              completedDeliverables += completed;
              
              const pendingCount = cat.remaining !== undefined ? cat.remaining : (qty > completed ? qty - completed : 0);
              if (pendingCount > 0) {
                remainingServices.push(`${pendingCount} ${rawName}`);
              }
            }
          });
        }
        
        let completionPercentage = 0;
        if (totalDeliverables > 0) {
          completionPercentage = Math.round((completedDeliverables / totalDeliverables) * 100);
        } else if (remainingServices.length === 0) {
          completionPercentage = 100;
        }
        let remainingPercentage = 100 - completionPercentage;
        
        let triggerType = 'Completion';
        let description = `Project is ${completionPercentage}% complete. Remaining completion is ${remainingPercentage}%. Pending: ${remainingServices.length > 0 ? remainingServices.join(', ') : 'None'}`;
        
        if (status === 'At Risk' || status === 'Breached') {
          triggerType = 'Due Date & Completion';
          description = `Project Near Due Date. ${completionPercentage}% complete. Remaining: ${remainingPercentage}%. Pending: ${remainingServices.length > 0 ? remainingServices.join(', ') : 'None'}`;
          
          if (project.status !== 'project_near_due_date') {
            project.status = 'project_near_due_date';
            await project.save();
          }
        }

        // Check existing status to determine if we should send a notification
        const existingSla = await SlaRecord.findOne({ entityId: project._id, entityType: 'Project' });
        const oldStatus = existingSla ? existingSla.status : 'Normal';

        const updatedSla = await SlaRecord.findOneAndUpdate(
          { entityId: project._id, entityType: 'Project' },
          {
            slaId: existingSla ? existingSla.slaId : `SLA-PRJ-${project._id.toString().substring(0, 8).toUpperCase()}`,
            clientId: project.clientId,
            agencyId: project.companyId,
            clientType: 'Direct User Client',
            triggerType: triggerType,
            entityId: project._id,
            entityType: 'Project',
            title: `Project: ${project.name}`,
            description,
            dueDate: project.endDate,
            priority: status === 'Breached' ? 'High' : 'Medium',
            status
          },
          { upsert: true, returnDocument: 'after' }
        );

        // Dispatch notification if status escalated to At Risk or Breached
        if (updatedSla && (status === 'At Risk' || status === 'Breached') && status !== oldStatus) {
          await dispatchSystemNotification(
            project.companyId,
            status === 'Breached' ? 'sla_breached' : 'sla_at_risk',
            'SLA Trigger',
            `SLA ${status}: ${updatedSla.title}`,
            `The SLA for ${updatedSla.title} is now ${status}.`,
            { slaId: updatedSla._id, entityId: project._id, entityType: 'Project' }
          );
        }
      }

      // 3. Check Payments for Invoices
      const unpaidInvoices = await Invoice.find({
        status: { $nin: ['paid', 'cancelled'] }
      });

      for (const invoice of unpaidInvoices) {
        if (!invoice.dueDate) continue;

        let status = 'Normal';
        const dueDate = new Date(invoice.dueDate);
        dueDate.setHours(23, 59, 59, 999);

        if (now > dueDate) {
          status = 'Breached';
        } else if (dueDate <= twoDaysFromNow) {
          status = 'At Risk';
        }
        
        if (invoice.status === 'failed') {
          status = 'Breached';
        }

        await SlaRecord.findOneAndUpdate(
          { entityId: invoice._id, entityType: 'Invoice' },
          {
            slaId: `SLA-INV-${invoice._id.toString().substring(0, 8).toUpperCase()}`,
            clientId: invoice.companyId,
            agencyId: invoice.tenantCompanyId,
            clientType: 'Direct User Client',
            triggerType: 'Payment',
            entityId: invoice._id,
            entityType: 'Invoice',
            title: `Invoice: ${invoice.invoiceNumber || invoice._id}`,
            description: `Payment Monitoring for Invoice`,
            dueDate: invoice.dueDate,
            paymentStatus: invoice.status,
            priority: status === 'Breached' ? 'Critical' : 'Medium',
            status
          },
          { upsert: true, returnDocument: 'after' }
        );
      }

      console.log('SLA Scheduler completed successfully.');
    } catch (error) {
      console.error('Error running SLA Scheduler:', error);
    }
  });
};

module.exports = startSlaScheduler;
