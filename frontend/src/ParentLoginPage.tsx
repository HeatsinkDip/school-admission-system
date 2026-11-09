import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Lock,
  Phone,
  Shield,
  Sparkles,
  AlertCircle,
  ChevronRight,
  MapPin,
  Home,
} from 'lucide-react';
import { STRINGS } from './strings';
import { isValidStudentId } from './ParentPortal';
import { STUDENT_ID_STORAGE_KEY } from './config';
import './ParentPortal.css';
import './LandingPage.css';

interface ParentLoginPageProps {
  onLoginSuccess: (studentId: string, parentPhone?: string, parentName?: string) => void;
  onOpenLanding: () => void;
}

export const ParentLoginPage: React.FC<ParentLoginPageProps> = ({
  onLoginSuccess,
  onOpenLanding,
}) => {
  const [studentIdInput, setStudentIdInput] = useState('');
  const [parentPhoneInput, setParentPhoneInput] = useState('');
  const [parentNameInput, setParentNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleQuickFill = () => {
    setStudentIdInput('20152691234567890');
    setParentPhoneInput('01712345678');
    setParentNameInput('Mr. Rafiqul Rahman');
    setError(null);
  };

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = studentIdInput.trim();
    if (!isValidStudentId(trimmed)) {
      setError(STRINGS.studentIdValidationError);
      return;
    }
    setError(null);
    localStorage.setItem(STUDENT_ID_STORAGE_KEY, trimmed);
    if (parentPhoneInput.trim()) {
      localStorage.setItem('school_parent_phone', parentPhoneInput.trim());
    }
    if (parentNameInput.trim()) {
      localStorage.setItem('school_parent_name', parentNameInput.trim());
    }
    onLoginSuccess(trimmed, parentPhoneInput.trim(), parentNameInput.trim());
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* =========================================================================
          TOP UTILITY BAR (Deep Green `#014d33`)
          ========================================================================= */}
      <div className="isd-top-utility-bar">
        <div className="landing-container flex items-center justify-between text-xs py-1.5 text-emerald-100">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <MapPin size={13} className="text-amber-400" />
              <span>Plot 19-21, Block D, Bashundhara R/A, Dhaka-1229</span>
            </span>
            <span className="hidden sm:inline text-emerald-400/50">|</span>
            <span className="hidden sm:flex items-center gap-1.5">
              <Phone size={13} className="text-amber-400" />
              <span>+880 2 843 1101</span>
            </span>
          </div>
          <button
            type="button"
            data-testid="nav-school-home-btn"
            onClick={onOpenLanding}
            className="flex items-center gap-1.5 text-amber-300 hover:text-white font-bold transition"
          >
            <Home size={13} />
            <span>School Home</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          MAIN INSTITUTIONAL HEADER (White & Emerald)
          ========================================================================= */}
      <header className="isd-main-header">
        <div className="landing-container flex items-center justify-between h-20">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={onOpenLanding}
            title="Return to School Home"
          >
            <div className="isd-sunburst-logo">
              <svg viewBox="0 0 44 44" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 4C23.1 4 24 4.9 24 6V10C24 11.1 23.1 12 22 12C20.9 12 20 10V6C20 4.9 20.9 4 22 4Z" fill="#10B981" />
                <path d="M22 32C23.1 32 24 32.9 24 34V38C24 39.1 23.1 40 22 40C20.9 40 20 39.1 20 38V34C20 32.9 20.9 32 22 32Z" fill="#EA580C" />
                <path d="M4 22C4 20.9 4.9 20 6 20H10C11.1 20 12 20.9 12 22C12 23.1 11.1 24 10 24H6C4.9 24 4 23.1 4 22Z" fill="#F59E0B" />
                <path d="M32 22C32 20.9 32.9 20 34 20H38C39.1 20 40 20.9 40 22C40 23.1 39.1 24 38 24H34C32.9 24 32 23.1 32 22Z" fill="#047857" />
                <path d="M9.27 9.27C10.05 8.49 11.32 8.49 12.1 9.27L14.93 12.1C15.71 12.88 15.71 14.15 14.93 14.93C14.15 15.71 12.88 15.71 12.1 14.93L9.27 12.1C8.49 11.32 8.49 10.05 9.27 9.27Z" fill="#10B981" />
                <path d="M29.07 29.07C29.85 28.29 31.12 28.29 31.9 29.07L34.73 31.9C35.51 32.68 35.51 33.95 34.73 34.73C33.95 35.51 32.68 35.51 31.9 34.73L29.07 31.9C28.29 31.12 28.29 29.85 29.07 29.07Z" fill="#F97316" />
                <path d="M9.27 34.73C8.49 33.95 8.49 32.68 9.27 31.9L12.1 29.07C12.88 28.29 14.15 28.29 14.93 29.07C15.71 29.85 15.71 31.12 14.93 31.9L12.1 34.73C11.32 35.51 10.05 35.51 9.27 34.73Z" fill="#EAB308" />
                <path d="M29.07 14.93C28.29 14.15 28.29 12.88 29.07 12.1L31.9 9.27C32.68 8.49 33.95 8.49 34.73 9.27C35.51 10.05 35.51 11.32 34.73 12.1L31.9 14.93C31.12 15.71 29.85 15.71 29.07 14.93Z" fill="#059669" />
              </svg>
            </div>
            <div>
              <div className="font-serif text-xl sm:text-2xl font-black tracking-tight text-slate-900 group-hover:text-emerald-800 transition leading-none">
                International School Dhaka
              </div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 mt-1 flex items-center gap-1.5">
                <span>Parent Portal</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span className="text-slate-500 font-semibold">Online Admission System</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenLanding}
              className="text-xs font-bold text-slate-600 hover:text-emerald-800 flex items-center gap-1 transition px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
            >
              <span>Back to Landing Page</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          LOGIN BODY (Split Layout: Informational Pillars on Left, Form Card on Right)
          ========================================================================= */}
      <main className="flex-1 py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: 3 HCI Architectural Value Cards */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-gradient-to-br from-[#014d33] to-emerald-950 text-white rounded-2xl p-6 shadow-lg border border-emerald-800/40">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-4 border border-emerald-400/30">
                <Sparkles size={12} />
                <span>Unified Family Admission</span>
              </div>
              <h2 className="font-serif text-2xl font-black text-white leading-tight">
                One Parent Account. <br /> Multiple Children.
              </h2>
              <p className="text-xs text-emerald-100/90 leading-relaxed mt-2.5">
                Manage all your children under a single verified parent mobile number. Apply for siblings, switch profiles effortlessly, and receive an automatic 10% sibling fee concession.
              </p>
            </div>

            {/* 3 Step Flow Indicators */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold text-xs shrink-0">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">Step 1: Student & Guardian Dossier</h4>
                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                    Fill out child identity, parent details, and upload documents. Unlocks live seat reservations.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-extrabold text-xs shrink-0">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">Step 2: 10-Minute Atomic Hold</h4>
                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                    First-Come, First-Served cloud lock prevents overbooking with zero lotteries or quotas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold text-xs shrink-0">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">Step 3: Pay & Download Official PDF</h4>
                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                    Complete tuition payment to confirm admission and download verified barcoded receipt.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Parent Registration & Admission Login Card */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="bg-[#014d33] text-white p-5 sm:p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-black text-lg sm:text-xl text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-400" />
                    Parent Registration & Student Admission Login
                  </h3>
                  <p className="text-xs text-emerald-100/90 mt-1">
                    Enter your child's government 17-digit Birth Registration Number and parent mobile phone to register or log in.
                  </p>
                </div>
                <div className="hidden sm:flex w-10 h-10 rounded-xl bg-white/10 items-center justify-center text-amber-300">
                  <Lock size={20} />
                </div>
              </div>

              <form onSubmit={handleLogin} className="p-5 sm:p-6 space-y-4">
                {/* 17-Digit Birth ID Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <span>Student Birth Registration Number (17 Digits)</span>
                      <span className="text-rose-600">*</span>
                    </label>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        studentIdInput.length === 17
                          ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200'
                          : 'text-slate-400'
                      }`}
                    >
                      {studentIdInput.length}/17 digits
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      data-testid="student-id-input"
                      maxLength={17}
                      placeholder="e.g. 20152691234567890"
                      value={studentIdInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 17);
                        setStudentIdInput(val);
                        if (error) setError(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm tracking-wider focus:outline-none focus:border-[#014d33] focus:ring-2 focus:ring-emerald-700/20 bg-slate-50/50"
                      autoFocus
                    />
                    {studentIdInput.length === 17 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 flex items-center gap-1 text-xs font-bold">
                        <CheckCircle2 size={16} />
                        <span>Valid</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Must be exactly 17 numeric digits from the government birth certificate.
                  </p>
                </div>

                {/* Parent Phone Field */}
                <div>
                  <label className="text-xs font-extrabold text-slate-800 block mb-1">
                    Parent / Guardian Mobile Phone <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      data-testid="parent-phone-input"
                      placeholder="e.g. 01712345678"
                      value={parentPhoneInput}
                      onChange={(e) => setParentPhoneInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#014d33] focus:ring-2 focus:ring-emerald-700/20 bg-slate-50/50"
                    />
                    <Phone size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Acts as your family account login and primary contact for admissions.
                  </p>
                </div>

                {/* Parent Full Name Field */}
                <div>
                  <label className="text-xs font-extrabold text-slate-800 block mb-1">
                    Parent / Guardian Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    data-testid="parent-name-input"
                    placeholder="e.g. Mr. Rafiqul Rahman"
                    value={parentNameInput}
                    onChange={(e) => setParentNameInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#014d33] focus:ring-2 focus:ring-emerald-700/20 bg-slate-50/50"
                  />
                </div>

                {/* Error Banner */}
                {error && (
                  <div
                    data-testid="student-id-error"
                    className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2 animate-shake"
                  >
                    <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                {/* Quick Fill Demo Credentials */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    data-testid="quick-fill-student-id-btn"
                    onClick={handleQuickFill}
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition flex items-center gap-1.5"
                  >
                    <Sparkles size={14} className="text-amber-500" />
                    <span>Quick Fill Demo Credentials</span>
                  </button>
                  <span className="text-[11px] text-slate-400">Zero lottery • FCFS</span>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    data-testid="save-student-id-btn"
                    className="w-full py-3 px-4 rounded-xl bg-[#014d33] hover:bg-emerald-800 text-white font-extrabold text-sm transition shadow-md flex items-center justify-center gap-2 group"
                  >
                    <span>Login & Continue to Admission Dossier</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          INSTITUTIONAL FOOTER (White & Emerald)
          ========================================================================= */}
      <footer className="isd-white-footer mt-auto">
        <div className="landing-container">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-slate-200">
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-3">
                <GraduationCap className="text-[#014d33]" size={24} />
                <span className="font-serif font-black text-lg text-slate-900">
                  International School Dhaka
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                Empowering ethical, inquisitive leaders with Cambridge, IB, and National curriculum excellence in Dhaka, Bangladesh.
              </p>
            </div>
            <div className="md:col-span-4 space-y-2 text-xs text-slate-600">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Admissions Contact
              </div>
              <div>Plot 19-21, Block D, Bashundhara R/A, Dhaka-1229</div>
              <div>Phone: +880 2 843 1101 | Email: admissions@isd.edu.bd</div>
            </div>
            <div className="md:col-span-3 space-y-2 text-xs text-slate-600">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Accreditation
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-emerald-800">
                <span>IB World School</span> • <span>CIS Accredited</span> • <span>NCTB Bangladesh</span>
              </div>
            </div>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
            <div>&copy; {new Date().getFullYear()} International School Dhaka. All rights reserved.</div>
            <div>PostgreSQL FCFS Atomic Row Locks • 17-Digit BRN Primary Key</div>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default ParentLoginPage;
