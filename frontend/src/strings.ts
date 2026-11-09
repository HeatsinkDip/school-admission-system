/**
 * All user-facing strings in one file so they can be translated to Bangla easily.
 */
export const STRINGS = {
  appTitle: 'Online School Admission System',
  appSubtitle: 'Parent Portal — Child Profile, Fast-Lane Seat Reservation & Fee Confirmation',
  adminPortalTitle: 'School Admission Admin Console',
  adminPortalSubtitle: 'Staff & Principal Portal — Class Setup, Live Seat Monitoring, Application Verification & Finance',

  // Navigation
  navGoToAdmin: 'Admin Console (/admin)',
  navBackToParent: '← Parent Portal (/)',

  // Student ID bar
  studentIdLabel: 'Child Birth Registration Number (17 digits)',
  studentIdPlaceholder: 'e.g. 20152691234567890',
  studentIdSaveButton: 'Set Student ID',
  studentIdChangeButton: 'Change',
  studentIdClearButton: 'Clear',
  applyingAsPrefix: 'Applying as:',
  studentIdRequiredHint: 'Enter your child’s 17-digit Birth Registration Number above to fill out child information, apply for a seat, or track admission status.',
  studentIdValidationError: 'Registration number must be exactly 17 digits (0–9 only).',

  // Parent Portal: Child Information Form
  childInfoTitle: 'Child Information, Guardians, Income & Documents',
  childInfoSubtitle: 'Pre-fill or complete your child’s admission dossier. Fast-lane seat booking only requires the 17-digit Birth Registration Number.',
  profileCompletenessLabel: 'Dossier Completeness',
  saveDraftButton: 'Save Child Information (Draft)',
  savingDraftButton: 'Saving...',
  submitForReviewButton: 'Submit Complete Dossier for Verification',
  profileSavedSuccess: 'Child profile and guardian details saved.',
  profileSubmittedSuccess: 'Child admission dossier submitted for officer verification.',
  documentUploadedSuccess: (label: string) => `Uploaded "${label}" for verification.`,
  waitlistJoinedSuccess: (className: string, pos: number) =>
    `Added to waitlist for "${className}" (Queue Position #${pos}).`,

  // Create Class (School Admin)
  adminSectionTitle: 'Create Class / Shift (School Admin)',
  classNameLabel: 'Class & Shift Name',
  classNamePlaceholder: 'e.g. Class 6 - Morning Shift',
  totalSeatsLabel: 'Total Seats',
  totalSeatsPlaceholder: 'e.g. 120',
  createClassButton: 'Create Class',
  creatingClassButton: 'Creating...',
  createClassNameError: 'Please enter a class and shift name.',
  createClassSeatsError: 'Total seats must be a positive whole number (at least 1).',
  createClassSuccess: (name: string, totalSeats: number) =>
    `Created "${name}" with ${totalSeats} seats.`,

  // Class List
  classesSectionTitle: 'Available Classes & Shifts (Fast-Lane Seat Booking)',
  classesAutoRefreshNote: 'Seat counts update automatically every few seconds.',
  noClassesYet: 'No classes have been published yet. Please check back when the admission window opens.',
  colClassName: 'Class / Shift',
  colTotalSeats: 'Total',
  colHeldSeats: 'Held',
  colConfirmedSeats: 'Confirmed',
  colAvailableSeats: 'Available',
  colAction: 'Action',
  applyButton: 'Apply',
  applyingButton: 'Applying...',
  joinWaitlistButton: 'Join Waitlist',
  applyDisabledNoStudent: 'Enter 17-digit Student ID above to apply',
  applyDisabledFull: 'No seats available',
  applyDisabledAlreadyActive: 'Already applied in this class',

  // Active Application / Hold Details
  activeApplicationTitle: 'Current Application & Fee Payment',
  myApplicationsTitle: 'My Applications & Receipts',
  noApplicationsYet: 'You have no applications for this Student ID yet.',
  holdIdLabel: 'Application ID',
  classLabel: 'Class / Shift',
  statusLabel: 'Seat Status',
  reviewStatusLabel: 'Verification Status',
  timeRemainingLabel: 'Time Remaining',
  payFeeButton: 'Pay admission fee',
  payingFeeButton: 'Processing...',
  cancelHoldButton: 'Cancel',
  cancellingHoldButton: 'Cancelling...',
  dismissButton: 'Close',

  // Status labels
  statusHeld: 'HELD (Seat Reserved)',
  statusConfirmed: 'CONFIRMED (Admission Fee Paid)',
  statusExpired: 'EXPIRED (Seat Released)',
  statusCancelled: 'CANCELLED',

  // Countdown messages
  expiredNotice: 'Hold time has expired. The seat has been released automatically.',
  confirmedNotice: 'Admission fee paid! Your seat is confirmed. Please complete the Child Information & Documents dossier for final enrollment verification.',
  cancelledNotice: 'This application was cancelled.',

  // Feedback banners
  holdCreatedSuccess: (className: string) =>
    `Seat temporarily held in "${className}". Pay the admission fee before the timer runs out to confirm your admission.`,
  holdConfirmedSuccess: 'Admission fee received! Your seat is now CONFIRMED and your official payment receipt has been generated.',
  holdCancelledSuccess: 'Your application has been cancelled and the seat was released.',

  // Error boundary
  errorBoundaryTitle: 'Something went wrong in the page',
  errorBoundaryMessage: 'Please click Reload below to continue. Your saved Student ID and applications are safe.',
  errorBoundaryReload: 'Reload View',

  // Friendly error messages mapped from backend error codes
  errors: {
    SEATS_FULL: 'All seats in this class are currently taken or held. If an unpaid hold expires, the seat will open automatically, or you may join the waitlist.',
    ALREADY_APPLIED: 'You already have an active hold or a confirmed admission in this class.',
    ALREADY_ADMITTED_ELSEWHERE: 'This student already has an active hold or is already admitted to another class or shift. Under school regulations, a student cannot hold morning and day shifts or attend two different classes at the same time.',
    HOLD_EXPIRED: 'The hold time for this application has expired and the seat was released. Please apply again if seats are available.',
    HOLD_CANCELLED: 'This application has already been cancelled and cannot be confirmed.',
    ALREADY_CONFIRMED: 'This admission is already confirmed and cannot be cancelled online (contact the school office for refunds).',
    CLASS_CLOSED: 'Admissions for this class-shift are currently closed by the school administration.',
    SEAT_REDUCTION_CONFLICT: 'Cannot reduce total seats below the number of seats already held or confirmed.',
    UNAUTHORIZED: 'Please sign in with your Admin password to access the Admin Console.',
    INVALID_CREDENTIALS: 'Invalid admin username or password. Please try again.',
    NOT_OWNER: 'This application belongs to a different Student ID. Please check the 17-digit Student ID at the top of the page.',
    NOT_FOUND: 'The requested class or application could not be found.',
    VALIDATION_ERROR: 'Please check your input and try again (Student ID must be 17 digits and seat count must be positive).',
    SERVICE_UNAVAILABLE: 'The admission server is temporarily busy. Please wait a moment and try again.',
    NETWORK_ERROR: 'Could not reach the admission server. Please check that the server is running and try again.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  } as Record<string, string>,
};

export function mapApiErrorToFriendlyMessage(code?: string, fallbackMessage?: string): string {
  if (code && STRINGS.errors[code]) {
    return STRINGS.errors[code];
  }
  if (fallbackMessage && fallbackMessage.trim().length > 0) {
    return fallbackMessage;
  }
  return STRINGS.errors.UNKNOWN_ERROR;
}
