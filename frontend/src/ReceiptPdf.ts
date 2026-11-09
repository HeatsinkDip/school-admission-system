import { StudentProfile } from './types';

export interface PrintablePaymentRecord {
  id?: number;
  receiptNo: string;
  studentId: string;
  className: string;
  grossAmount: number;
  discountAmount?: number;
  discountReason?: string | null;
  netAmount: number;
  paidAt: string;
  status?: string;
  gateway?: string;
  holdId?: string;
  classId?: string;
}

export function generateAndDownloadPdfReceipt(
  payment: PrintablePaymentRecord,
  profile?: StudentProfile | null,
  schoolName = 'ONNOROKOM PROJUKTI SCHOOL',
) {
  const printWindow = window.open('', '_blank', 'width=850,height=1000');
  if (!printWindow) {
    alert('Please allow popups to download and print your official admission receipt.');
    return;
  }

  const studentName = profile?.fullNameEn || payment.studentId;
  const studentNameBn = profile?.fullNameBn || '';
  const dob = profile?.dob || 'Verified upon Admission';
  const guardianName = profile?.fatherName || profile?.motherName || 'Verified Guardian';
  const guardianPhone = profile?.guardianPhone || 'N/A';
  const paidDate = new Date(payment.paidAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Admission Receipt — ${payment.receiptNo} — ${schoolName}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
    }
    .receipt-container {
      width: 100%;
      max-width: 800px;
      background: #ffffff;
      border: 2px solid #cbd5e1;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      position: relative;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 80px;
      font-weight: 900;
      color: rgba(22, 101, 52, 0.04);
      white-space: nowrap;
      pointer-events: none;
      text-transform: uppercase;
      user-select: none;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .school-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #1e1b4b;
      margin: 0;
      text-transform: uppercase;
    }
    .school-sub {
      font-size: 13px;
      color: #475569;
      margin-top: 4px;
      font-weight: 500;
    }
    .voucher-badge {
      display: inline-block;
      background: #ecfdf5;
      border: 1px solid #10b981;
      color: #065f46;
      padding: 6px 14px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.5px;
    }
    .receipt-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 24px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 2px;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .fee-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .fee-table th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 10px 14px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .fee-table td {
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
    }
    .fee-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .summary-box {
      float: right;
      width: 320px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 30px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 14px;
      font-size: 14px;
    }
    .summary-row.total {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      font-size: 16px;
    }
    .discount-val {
      color: #16a34a;
      font-weight: 600;
    }
    .clear {
      clear: both;
    }
    .guarantee-banner {
      background: #f0fdf4;
      border: 1px dashed #22c55e;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .guarantee-text {
      font-size: 13px;
      color: #166534;
      line-height: 1.5;
    }
    .signatures-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 40px;
      border-top: 1px dashed #cbd5e1;
    }
    .signature-block {
      text-align: center;
      width: 200px;
    }
    .signature-line {
      border-top: 1px solid #475569;
      margin-bottom: 6px;
    }
    .signature-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
    }
    .seal-circle {
      width: 90px;
      height: 90px;
      border: 2px dashed #0284c7;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #0284c7;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      text-align: center;
      line-height: 1.2;
    }
    .no-print-bar {
      margin-bottom: 20px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn-print {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    .btn-close {
      background: #e2e8f0;
      color: #1e293b;
      border: none;
      padding: 10px 18px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .receipt-container {
        border: none;
        box-shadow: none;
        padding: 0;
      }
      .no-print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div style="width: 100%; max-width: 800px;">
    <div class="no-print-bar">
      <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button class="btn-close" onclick="window.close()">Close Window</button>
    </div>

    <div class="receipt-container">
      <div class="watermark">ADMISSION CONFIRMED</div>

      <table class="header-table">
        <tr>
          <td style="vertical-align: middle;">
            <h1 class="school-title">${schoolName}</h1>
            <div class="school-sub">Academic Session 2027 • Official Online Admission Confirmation</div>
            <div class="school-sub">Campus: Mirpur-10, Dhaka-1216 | Phone: +880 1700-000000 | Web: admission.onnorokom.edu.bd</div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div class="voucher-badge">SEAT CONFIRMED</div>
            <div style="margin-top: 8px; font-size: 12px; color: #64748b; font-weight: 600;">
              Receipt No: <span class="mono" style="color: #0f172a;">${payment.receiptNo}</span>
            </div>
          </td>
        </tr>
      </table>

      <div class="receipt-meta-grid">
        <div class="meta-item">
          <span class="meta-label">Student Full Name</span>
          <span class="meta-value">${studentName} ${studentNameBn ? `(${studentNameBn})` : ''}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">17-Digit Birth Registration No (Primary Key)</span>
          <span class="meta-value mono" style="color: #4338ca;">${payment.studentId}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Enrolled Class & Shift</span>
          <span class="meta-value" style="color: #0f172a;">${payment.className}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Date of Birth</span>
          <span class="meta-value">${dob}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Guardian Details</span>
          <span class="meta-value">${guardianName} (${guardianPhone})</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Payment Date & Time</span>
          <span class="meta-value mono">${paidDate}</span>
        </div>
      </div>

      <table class="fee-table">
        <thead>
          <tr>
            <th style="width: 60%;">Fee Description / Head</th>
            <th style="text-align: right; width: 40%;">Amount (BDT)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Admission Fee & Enrollment Processing</td>
            <td style="text-align: right;" class="mono">৳15,000</td>
          </tr>
          <tr>
            <td>Annual Session Charge (Curriculum & Facilities)</td>
            <td style="text-align: right;" class="mono">৳8,000</td>
          </tr>
          <tr>
            <td>Campus Development & Technology Lab Fund</td>
            <td style="text-align: right;" class="mono">৳10,000</td>
          </tr>
          <tr>
            <td>First Month Tuition Fee</td>
            <td style="text-align: right;" class="mono">৳6,000</td>
          </tr>
          <tr>
            <td>Refundable Security Deposit</td>
            <td style="text-align: right;" class="mono">৳5,000</td>
          </tr>
          <tr>
            <td>Semester Examination & STEM Lab Access</td>
            <td style="text-align: right;" class="mono">৳2,000</td>
          </tr>
        </tbody>
      </table>

      <div class="summary-box">
        <div class="summary-row">
          <span>Gross Total Payable:</span>
          <span class="mono">৳${payment.grossAmount.toLocaleString()}</span>
        </div>
        ${
          (payment.discountAmount ?? 0) > 0
            ? `
        <div class="summary-row">
          <span>Concession / Sibling Discount${payment.discountReason ? ` (${payment.discountReason})` : ''}:</span>
          <span class="mono discount-val">-৳${(payment.discountAmount ?? 0).toLocaleString()}</span>
        </div>
        `
            : ''
        }
        <div class="summary-row total">
          <span>Total Net Paid:</span>
          <span class="mono">৳${payment.netAmount.toLocaleString()}</span>
        </div>
      </div>

      <div class="clear"></div>

      <div class="guarantee-banner">
        <div style="font-size: 24px;">🛡️</div>
        <div class="guarantee-text">
          <strong>Official Admission Guarantee:</strong> This payment officially confirms and guarantees your child's permanent seat in <strong>${payment.className}</strong>. Admission review status: <strong>ELIGIBILITY VERIFIED</strong>. Please bring this receipt and original documents to the school office for orientation.
        </div>
      </div>

      <div class="signatures-row">
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-label">Guardian's Signature</div>
        </div>

        <div class="seal-circle">
          <span>ONNOROKOM</span>
          <span>OFFICIAL</span>
          <span>SEAL 2027</span>
        </div>

        <div class="signature-block">
          <div style="font-family: cursive; font-size: 16px; color: #1e3a8a; margin-bottom: 2px;">Dr. M. Rahman</div>
          <div class="signature-line"></div>
          <div class="signature-label">Registrar & Admission Officer</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

