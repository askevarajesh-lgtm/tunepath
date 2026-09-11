const { validationResult } = require('express-validator');
const calendarService = require('./calendar.service');
const { sendSuccess, sendError, sendValidationError } = require('../tasks/shimResponse');

const createEvent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const event = await calendarService.createEvent(req.body, req.companyId, req.user._id);
    return sendSuccess(res, 'Event created successfully', { event });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const getAllEvents = async (req, res) => {
  try {
    const events = await calendarService.getAllEvents(
      req.companyId,
      req.query,
      req.user?.role,
      req.user?._id,
      req.user
    );
    return sendSuccess(res, 'Events retrieved successfully', { events });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

const getEventById = async (req, res) => {
  try {
    const result = await calendarService.getEventById(
      req.params.id,
      req.companyId,
      req.user?.role,
      req.user?._id
    );
    return sendSuccess(res, 'Event retrieved successfully', result);
  } catch (error) {
    return sendError(res, 404, error.message);
  }
};

const updateEvent = async (req, res) => {
  try {
    const result = await calendarService.updateEvent(
      req.params.id,
      req.body,
      req.companyId,
      req.user?._id
    );
    return sendSuccess(res, 'Event updated successfully', result);
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const deleteEvent = async (req, res) => {
  try {
    await calendarService.deleteEvent(req.params.id, req.companyId);
    return sendSuccess(res, 'Event deleted successfully');
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const updateEventStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return sendError(res, 400, 'Status is required');
    }
    const event = await calendarService.updateEventStatus(
      req.params.id,
      status,
      req.companyId,
      req.user?._id
    );
    return sendSuccess(res, 'Event status updated successfully', { event });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const addEventNote = async (req, res) => {
  try {
    const note = await calendarService.addEventNote(
      req.params.id,
      req.body,
      req.companyId,
      req.user?._id
    );
    return sendSuccess(res, 'Note added successfully', { note });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const addEventAttachment = async (req, res) => {
  try {
    const attachment = await calendarService.addEventAttachment(
      req.params.id,
      req.body,
      req.companyId,
      req.user?._id
    );
    return sendSuccess(res, 'Attachment added successfully', { attachment });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

const getCalendarAnalytics = async (req, res) => {
  try {
    const analytics = await calendarService.getCalendarAnalytics(
      req.companyId,
      req.query,
      req.user?.role,
      req.user?._id,
      req.user
    );
    return sendSuccess(res, 'Calendar analytics retrieved successfully', { analytics });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  updateEventStatus,
  addEventNote,
  addEventAttachment,
  getCalendarAnalytics
};
