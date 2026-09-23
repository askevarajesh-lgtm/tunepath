const cron = require("node-cron");
const Lead = require("./lead.model");
const { triggerLeadReminderNotification } = require("./leadReminder.service");

/**
 * Scan all leads for due reminders that haven't been notified yet.
 */
const checkAndTriggerLeadReminders = async () => {
  try {
    const now = new Date();

    // Query leads that have at least one reminder whose remindAt <= now and notificationSent != true
    const leadsWithDueReminders = await Lead.find({
      reminders: {
        $elemMatch: {
          remindAt: { $lte: now },
          notificationSent: { $ne: true },
        },
      },
    });

    if (!leadsWithDueReminders.length) {
      return;
    }

    for (const lead of leadsWithDueReminders) {
      let leadModified = false;
      const dueReminders = (lead.reminders || []).filter(
        (r) => r.remindAt && new Date(r.remindAt) <= now && !r.notificationSent
      );

      for (const reminder of dueReminders) {
        await triggerLeadReminderNotification(lead, reminder);
        leadModified = true;
      }
    }
  } catch (error) {
    console.error("[LeadReminderScheduler] Error running lead reminder scheduler:", error);
  }
};

/**
 * Initialize the recurring 1-minute cron job for lead reminders.
 */
const startLeadReminderScheduler = () => {
  console.log("[LeadReminderScheduler] Initializing 1-minute lead reminder notification scheduler...");

  // Run on startup
  checkAndTriggerLeadReminders().catch((err) =>
    console.error("[LeadReminderScheduler] Initial scan error:", err)
  );

  // Run every minute
  cron.schedule("* * * * *", async () => {
    await checkAndTriggerLeadReminders();
  });
};

module.exports = {
  startLeadReminderScheduler,
  checkAndTriggerLeadReminders,
};
