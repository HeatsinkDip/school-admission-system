namespace SchoolAdmission.Api.Contracts;

// --- Admin Authentication ---

public sealed record AdminLoginRequest(string? Username, string Password);

public sealed record AdminSessionResponse(
    string Token,
    string Username,
    string Role,
    string FullName,
    string ExpiresAt);

// --- Parent Portal: Child & Guardian Profile ---

public sealed record DocumentItemDto(
    string Type,
    string Label,
    string FileName,
    long FileSize,
    string UploadedAt,
    string Status,
    string ReviewerComment);

public sealed record StudentProfileDto(
    string StudentId,
    string FullNameEn,
    string FullNameBn,
    string Dob,
    string Gender,
    string Nationality,
    string Religion,
    string BloodGroup,
    string PresentAddress,
    string PermanentAddress,
    string PreviousSchool,
    string LastClassPassed,
    string LastResult,
    string HealthNotes,
    bool HasSibling,
    string SiblingName,
    string SiblingClass,
    string SiblingStudentId,
    string FatherName,
    string FatherNid,
    string FatherOccupation,
    string FatherEmployer,
    string FatherPhone,
    string FatherEmail,
    string MotherName,
    string MotherNid,
    string MotherOccupation,
    string MotherEmployer,
    string MotherPhone,
    string MotherEmail,
    string GuardianName,
    string GuardianRelation,
    string GuardianPhone,
    string EmergencyContact,
    decimal MonthlyIncome,
    string IncomeBracket,
    string IncomeSource,
    int Dependents,
    bool ConcessionRequested,
    string ConcessionStatus,
    int ConcessionPercent,
    string ConcessionNote,
    IReadOnlyList<DocumentItemDto> Documents,
    string ApplicationStatus,
    string ReviewerNote,
    string AssignedSection,
    string EnrolledStudentNo,
    int CompletenessPercent,
    string UpdatedAt);

public sealed record SaveStudentProfileRequest(
    string? FullNameEn,
    string? FullNameBn,
    string? Dob,
    string? Gender,
    string? Nationality,
    string? Religion,
    string? BloodGroup,
    string? PresentAddress,
    string? PermanentAddress,
    string? PreviousSchool,
    string? LastClassPassed,
    string? LastResult,
    string? HealthNotes,
    bool? HasSibling,
    string? SiblingName,
    string? SiblingClass,
    string? SiblingStudentId,
    string? FatherName,
    string? FatherNid,
    string? FatherOccupation,
    string? FatherEmployer,
    string? FatherPhone,
    string? FatherEmail,
    string? MotherName,
    string? MotherNid,
    string? MotherOccupation,
    string? MotherEmployer,
    string? MotherPhone,
    string? MotherEmail,
    string? GuardianName,
    string? GuardianRelation,
    string? GuardianPhone,
    string? EmergencyContact,
    decimal? MonthlyIncome,
    string? IncomeBracket,
    string? IncomeSource,
    int? Dependents,
    bool? ConcessionRequested,
    bool? SubmitForReview);

public sealed record UploadDocumentRequest(
    string Type,
    string? Label,
    string FileName,
    long FileSize);

// --- Billing & Fee Structure ---

public sealed record FeeLineItemDto(
    string Head,
    string Frequency,
    decimal Amount,
    bool Refundable,
    bool PayableAtAdmission);

public sealed record ClassFeeBreakdownDto(
    string ClassId,
    string ClassName,
    string Shift,
    string AcademicYear,
    IReadOnlyList<FeeLineItemDto> Heads,
    decimal GrossPayableAtAdmission,
    decimal SiblingDiscountAmount,
    string? DiscountReason,
    decimal NetPayableAtAdmission,
    decimal RecurringMonthlyTotal);

public sealed record PaymentRecordDto(
    long Id,
    string HoldId,
    string ClassId,
    string ClassName,
    string StudentId,
    string StudentName,
    string ReceiptNo,
    decimal GrossAmount,
    decimal DiscountAmount,
    string DiscountReason,
    decimal NetAmount,
    string Gateway,
    string Status,
    decimal RefundedAmount,
    string RefundReason,
    string PaidAt);

// --- Waitlist ---

public sealed record WaitlistEntryDto(
    long Id,
    string ClassId,
    string ClassName,
    string StudentId,
    string StudentName,
    int Position,
    string CreatedAt);

// --- Admin Console ---

public sealed record AdminClassDetailDto(
    string Id,
    string Name,
    string Shift,
    string AcademicYear,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats,
    int? MinAge,
    int? MaxAge,
    string Status,
    decimal AdmissionFee,
    decimal SessionCharge,
    decimal DevelopmentFee,
    decimal SecurityDeposit,
    decimal FirstMonthTuition,
    decimal MonthlyTuition,
    decimal ExamFee,
    decimal LabFee,
    decimal PayableAtAdmissionTotal);

public sealed record UpsertAdminClassRequest(
    string Name,
    string? Shift,
    string? AcademicYear,
    int TotalSeats,
    int? MinAge,
    int? MaxAge,
    string? Status,
    decimal? AdmissionFee,
    decimal? SessionCharge,
    decimal? DevelopmentFee,
    decimal? SecurityDeposit,
    decimal? FirstMonthTuition,
    decimal? MonthlyTuition,
    decimal? ExamFee,
    decimal? LabFee);

public sealed record SchoolSettingsDto(
    string AcademicYear,
    string AdmissionOpensAt,
    string AdmissionClosesAt,
    int HoldDurationSeconds,
    int PaperworkDeadlineDays,
    bool WaitlistEnabled,
    int SiblingDiscountPercent);

public sealed record UpdateSchoolSettingsRequest(
    string? AcademicYear,
    string? AdmissionOpensAt,
    string? AdmissionClosesAt,
    int? PaperworkDeadlineDays,
    bool? WaitlistEnabled,
    int? SiblingDiscountPercent);

public sealed record AdminDashboardDto(
    IReadOnlyList<AdminClassDetailDto> Classes,
    int TotalSeats,
    int TotalHeld,
    int TotalConfirmed,
    int TotalAvailable,
    int TotalApplications,
    int PendingReviews,
    int PendingConcessions,
    int TotalWaitlisted,
    decimal TotalRevenueBdt,
    decimal TotalRefundedBdt,
    SchoolSettingsDto Settings);

public sealed record AdminApplicationSummaryDto(
    string HoldId,
    string ClassId,
    string ClassName,
    string Shift,
    string StudentId,
    string FullNameEn,
    string FullNameBn,
    string FatherName,
    string FatherPhone,
    string HoldStatus,
    string ExpiresAt,
    string? ConfirmedAt,
    string ApplicationStatus,
    bool ConcessionRequested,
    string ConcessionStatus,
    int ConcessionPercent,
    int CompletenessPercent,
    string? ReceiptNo,
    decimal? NetPaidAmount,
    string? AssignedSection,
    string? EnrolledStudentNo,
    string ReviewerNote,
    string CreatedAt);

public sealed record AdminApplicationDetailDto(
    StudentProfileDto Profile,
    IReadOnlyList<HoldResponse> Holds,
    IReadOnlyList<PaymentRecordDto> Payments);

public sealed record AdminReviewDecisionRequest(
    string Action,
    string? Note,
    string? AssignedSection,
    string? EnrolledStudentNo);

public sealed record AdminVerifyDocumentRequest(
    string Type,
    string Status,
    string? Comment);

public sealed record AdminConcessionDecisionRequest(
    string Status,
    int Percent,
    string? Note);

public sealed record AdminRefundRequest(
    decimal Amount,
    string Reason);

public sealed record AuditLogDto(
    long Id,
    string Actor,
    string Role,
    string Action,
    string Entity,
    string EntityId,
    string Details,
    string CreatedAt);
