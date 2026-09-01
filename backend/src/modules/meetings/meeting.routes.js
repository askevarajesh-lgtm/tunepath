const express = require('express');
const { body } = require('express-validator');
const meetingController = require('./meeting.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// Validation rules
const createMeetingValidation = [
  body('title').notEmpty().withMessage('Meeting title is required').trim(),
  body('date').notEmpty().withMessage('Meeting date is required'),
  body('time').notEmpty().withMessage('Meeting time is required'),
  body('meetingType').notEmpty().withMessage('Meeting type is required'),
];

// Specific routes first
router.get('/analytics', meetingController.getMeetingAnalytics);

// CRUD routes
router.get('/', meetingController.getAllMeetings);
router.post('/', createMeetingValidation, meetingController.createMeeting);
router.get('/:id', meetingController.getMeetingById);
router.put('/:id', meetingController.updateMeeting);
router.delete('/:id', meetingController.deleteMeeting);

// Status/Detail management routes
router.put('/:id/status', meetingController.updateMeetingStatus);
// Notes routes
router.post('/:id/notes', meetingController.addMeetingNote);
router.put('/:id/notes/:noteId', meetingController.updateMeetingNote);
router.delete('/:id/notes/:noteId', meetingController.deleteMeetingNote);

// Attachments routes
router.post('/:id/attachments', meetingController.addMeetingAttachment);
router.delete('/:id/attachments/:attachmentId', meetingController.removeMeetingAttachment);

// Follow-ups routes
router.post('/:id/followups', meetingController.createFollowUp);
router.put('/:id/followups/:followUpId', meetingController.updateFollowUp);
router.put('/:id/followups/:followUpId/complete', meetingController.completeFollowUp);
router.delete('/:id/followups/:followUpId', meetingController.deleteFollowUp);

module.exports = router;
