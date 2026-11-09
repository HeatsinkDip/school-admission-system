export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CORRECTION'
  | 'APPROVED'
  | 'REJECTED'
  | 'ENROLLED';

export interface SchoolClass {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}

export interface CreateClassResponse {
  id: string;
  name: string;
  totalSeats: number;
}

export interface HoldItem {
  holdId: string;
  classId: string;
  className?: string;
  studentId?: string;
  status: HoldStatus;
  expiresAt: string;
  serverTime?: string;
}

export interface ConfirmHoldResponse {
  holdId: string;
  status: HoldStatus;
  classId?: string;
  expiresAt?: string;
  confirmedAt?: string | null;
  serverTime?: string;
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
}

// --- Admin Auth ---

export interface AdminSession {
  token: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMISSION_OFFICER' | 'ACCOUNTANT' | string;
  fullName: string;
  expiresAt: string;
}

// --- Parent Portal: Student & Guardian Profile ---

export interface DocumentItem {
  type: string;
  label: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  status: 'NOT_UPLOADED' | 'PENDING' | 'APPROVED' | 'CORRECTION_NEEDED' | string;
  reviewerComment: string;
}

export interface StudentProfile {
  studentId: string;
  fullNameEn: string;
  fullNameBn: string;
  dob: string;
  gender: string;
  nationality: string;
  religion: string;
  bloodGroup: string;
  presentAddress: string;
  permanentAddress: string;
  previousSchool: string;
  lastClassPassed: string;
  lastResult: string;
  healthNotes: string;
  hasSibling: boolean;
  siblingName: string;
  siblingClass: string;
  siblingStudentId: string;
  fatherName: string;
  fatherNid: string;
  fatherOccupation: string;
  fatherEmployer: string;
  fatherPhone: string;
  fatherEmail: string;
  motherName: string;
  motherNid: string;
  motherOccupation: string;
  motherEmployer: string;
  motherPhone: string;
  motherEmail: string;
  guardianName: string;
  guardianRelation: string;
  guardianPhone: string;
  emergencyContact: string;
  monthlyIncome: number;
  incomeBracket: string;
  incomeSource: string;
  dependents: number;
  concessionRequested: boolean;
  concessionStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'DECLINED' | string;
  concessionPercent: number;
  concessionNote: string;
  documents: DocumentItem[];
  applicationStatus: ApplicationStatus | string;
  reviewerNote: string;
  assignedSection: string;
  enrolledStudentNo: string;
  completenessPercent: number;
  updatedAt: string;
}

export interface SaveStudentProfilePayload {
  fullNameEn?: string;
  fullNameBn?: string;
  dob?: string;
  gender?: string;
  nationality?: string;
  religion?: string;
  bloodGroup?: string;
  presentAddress?: string;
  permanentAddress?: string;
  previousSchool?: string;
  lastClassPassed?: string;
  lastResult?: string;
  healthNotes?: string;
  hasSibling?: boolean;
  siblingName?: string;
  siblingClass?: string;
  siblingStudentId?: string;
  fatherName?: string;
  fatherNid?: string;
  fatherOccupation?: string;
  fatherEmployer?: string;
  fatherPhone?: string;
  fatherEmail?: string;
  motherName?: string;
  motherNid?: string;
  motherOccupation?: string;
  motherEmployer?: string;
  motherPhone?: string;
  motherEmail?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
  emergencyContact?: string;
  monthlyIncome?: number;
  incomeBracket?: string;
  incomeSource?: string;
  dependents?: number;
  concessionRequested?: boolean;
  submitForReview?: boolean;
}

// --- Billing & Fees ---

export interface FeeLineItem {
  head: string;
  frequency: string;
  amount: number;
  refundable: boolean;
  payableAtAdmission: boolean;
}

export interface ClassFeeBreakdown {
  classId: string;
  className: string;
  shift: string;
  academicYear: string;
  heads: FeeLineItem[];
  grossPayableAtAdmission: number;
  siblingDiscountAmount: number;
  discountReason?: string | null;
  netPayableAtAdmission: number;
  recurringMonthlyTotal: number;
}

export interface PaymentRecord {
  id: number;
  holdId: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  receiptNo: string;
  grossAmount: number;
  discountAmount: number;
  discountReason: string;
  netAmount: number;
  gateway: string;
  status: 'SUCCESS' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | string;
  refundedAmount: number;
  refundReason: string;
  paidAt: string;
}

export interface WaitlistEntry {
  id: number;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  position: number;
  createdAt: string;
}

// --- Admin Console ---

export interface AdminClassDetail {
  id: string;
  name: string;
  shift: string;
  academicYear: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
  minAge?: number | null;
  maxAge?: number | null;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | string;
  admissionFee: number;
  sessionCharge: number;
  developmentFee: number;
  securityDeposit: number;
  firstMonthTuition: number;
  monthlyTuition: number;
  examFee: number;
  labFee: number;
  payableAtAdmissionTotal: number;
}

export interface UpsertAdminClassPayload {
  name: string;
  shift?: string;
  academicYear?: string;
  totalSeats: number;
  minAge?: number | null;
  maxAge?: number | null;
  status?: string;
  admissionFee?: number;
  sessionCharge?: number;
  developmentFee?: number;
  securityDeposit?: number;
  firstMonthTuition?: number;
  monthlyTuition?: number;
  examFee?: number;
  labFee?: number;
}

export interface SchoolSettings {
  academicYear: string;
  admissionOpensAt: string;
  admissionClosesAt: string;
  holdDurationSeconds: number;
  paperworkDeadlineDays: number;
  waitlistEnabled: boolean;
  siblingDiscountPercent: number;
}

export interface AdminDashboard {
  classes: AdminClassDetail[];
  totalSeats: number;
  totalHeld: number;
  totalConfirmed: number;
  totalAvailable: number;
  totalApplications: number;
  pendingReviews: number;
  pendingConcessions: number;
  totalWaitlisted: number;
  totalRevenueBdt: number;
  totalRefundedBdt: number;
  settings: SchoolSettings;
}

export interface AdminApplicationSummary {
  holdId: string;
  classId: string;
  className: string;
  shift: string;
  studentId: string;
  fullNameEn: string;
  fullNameBn: string;
  fatherName: string;
  fatherPhone: string;
  holdStatus: HoldStatus;
  expiresAt: string;
  confirmedAt?: string | null;
  applicationStatus: ApplicationStatus | string;
  concessionRequested: boolean;
  concessionStatus: string;
  concessionPercent: number;
  completenessPercent: number;
  receiptNo?: string | null;
  netPaidAmount?: number | null;
  assignedSection?: string | null;
  enrolledStudentNo?: string | null;
  reviewerNote: string;
  createdAt: string;
}

export interface AdminApplicationDetail {
  profile: StudentProfile;
  holds: HoldItem[];
  payments: PaymentRecord[];
}

export interface AuditLogEntry {
  id: number;
  actor: string;
  role: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';

export interface AppNotification {
  id: number;
  recipientType: string;
  recipientId?: string | null;
  category: string;
  severity: NotificationSeverity | string;
  title: string;
  message: string;
  actor: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationSummary {
  unreadCount: number;
  notifications: AppNotification[];
}

// --- Class Routine (Timetable) ---

export interface RoutinePeriod {
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher?: string;
  room?: string;
}

export interface ClassRoutine {
  classId: string;
  className: string;
  shift: string;
  startTime: string;
  endTime: string;
  days: string[];
  periods: RoutinePeriod[];
  isDefault: boolean;
}


