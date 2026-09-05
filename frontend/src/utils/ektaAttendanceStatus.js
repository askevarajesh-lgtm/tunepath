/**
 * ektaAttendanceStatus utility
 * Helpers related to the Ekta HR integration attendance statuses.
 * (Ekta is not connected in the new project — these are safe stubs.)
 */

const PRESENT_STATUSES = [
  'present', 'work_from_home', 'wfh', 'half_day', 'late',
  'punched_in', 'punch_in', 'login', 'logged_in', 'in', 'working',
  'check_in', 'checked_in', 'clocked_in', 'clock_in', 'p'
];

/**
 * Returns true if the given attendance status or record counts as "present".
 * As soon as the employee punches in in the morning (has a punchIn timestamp or punch status),
 * it shows as Present.
 * @param {string|object} statusOrRecord
 * @param {object} [record]
 */
export function isPresentAttendanceStatus(statusOrRecord, record) {
  const rec = typeof statusOrRecord === 'object' && statusOrRecord !== null ? statusOrRecord : record;
  const status = typeof statusOrRecord === 'string' ? statusOrRecord : rec?.status;

  // 1. If record contains any morning punch-in / log-in timestamp, employee is Present!
  if (rec) {
    const hasPunchIn = Boolean(
      rec.punchIn || rec.punch_in || rec.logIn || rec.login || rec.log_in ||
      rec.checkIn || rec.check_in || rec.inTime || rec.in_time || rec.timeIn ||
      rec.punchInTime || rec.firstPunch || rec.first_punch || rec.clockIn || rec.clock_in
    );
    if (hasPunchIn) return true;
  }

  if (!status) return false;
  const lower = String(status).toLowerCase().trim();

  // 2. Explicit absence/leave check
  if (lower === 'absent' || lower === 'leave' || lower === 'on_leave' || lower === 'holiday' || lower === 'a') {
    return false;
  }

  // 3. Match against present/punch-in statuses or keywords
  if (
    PRESENT_STATUSES.includes(lower) ||
    lower.includes('present') ||
    lower.includes('punch') ||
    lower.includes('in') ||
    lower.includes('login') ||
    lower.includes('clock') ||
    lower.includes('work')
  ) {
    return true;
  }

  // 4. Fallback: If record has punchOut / logOut / work hours data, they were present
  if (rec && (rec.punchOut || rec.punch_out || rec.logOut || rec.logout || rec.outTime || rec.hours || rec.totalHours)) {
    return true;
  }

  return false;
}

/**
 * Returns a human-readable label for an attendance status.
 * @param {string} status
 */
export function getAttendanceStatusLabel(status) {
  const labels = {
    present: 'Present',
    punched_in: 'Present (Punched In)',
    punch_in: 'Present (Punched In)',
    clocked_in: 'Present (Clocked In)',
    work_from_home: 'Work From Home',
    wfh: 'WFH',
    half_day: 'Half Day',
    late: 'Late',
    absent: 'Absent',
    leave: 'On Leave',
    holiday: 'Holiday',
  };
  return labels[(status || '').toLowerCase().trim()] || status || 'Present';
}

export default { isPresentAttendanceStatus, getAttendanceStatusLabel };
