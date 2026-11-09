import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Phone,
  Shield,
  Sparkles,
  AlertCircle,
  ChevronRight,
  MapPin,
  Home,
  LogOut,
  X,
} from 'lucide-react';
import { STRINGS } from './strings';
import { isValidStudentId } from './ParentPortal';
import { STUDENT_ID_STORAGE_KEY } from './config';
import { loginWithGoogle, logoutFirebase, type User as FirebaseUser } from './firebase';
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
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);

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

  const handleCancelFirebase = async () => {
    try {
      await logoutFirebase();
    } catch {
      // ignore
    }
    setFirebaseUser(null);
    setShowFirebaseModal(false);
    setError('Logged out. Student 17-digit Birth Registration Number is mandatory to access the parent dashboard.');
  };

  const handleConfirmFirebaseStudent = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = studentIdInput.trim();
    if (!isValidStudentId(trimmed)) {
      setError(STRINGS.studentIdValidationError);
      return;
    }
    if (!parentPhoneInput.trim()) {
      setError('Parent / Guardian Mobile Phone is required.');
      return;
    }
    setError(null);
    localStorage.setItem(STUDENT_ID_STORAGE_KEY, trimmed);
    localStorage.setItem('school_parent_phone', parentPhoneInput.trim());
    if (parentNameInput.trim()) {
      localStorage.setItem('school_parent_name', parentNameInput.trim());
    }
    if (firebaseUser?.email) {
      localStorage.setItem('school_firebase_email', firebaseUser.email);
    }
    setShowFirebaseModal(false);
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
              <span>Tejgaon, Dhaka-1208, Bangladesh</span>
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
                Onnorokom School, Bangladesh
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
          LOGIN BODY (Exact Match to Image 2: Centered Wide Card + 3-Column Info Cards)
          ========================================================================= */}
      <main className="flex-1 py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Main Registration & Admission Login Card (Matching Image 2) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Dark Top Banner */}
            <div className="bg-[#03130e] text-white p-6 sm:p-7 border-b border-emerald-950">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-400 text-[11px] font-extrabold uppercase tracking-wider mb-2.5">
                <Shield size={14} className="text-emerald-400" />
                <span>Zero Lottery • FCFS Atomic Row-Lock Admission</span>
              </div>
              <h1 className="font-serif font-black text-2xl sm:text-3xl text-white tracking-tight">
                Parent Registration & Student Admission Login
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
                Enter your child's government 17-digit Birth Registration Number and parent mobile phone to register or log in. Parents with multiple children can manage all siblings under a single unified family account.
              </p>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleLogin} className="p-6 sm:p-7 space-y-5">
              {/* 17-Digit Birth ID Field */}
              <div>
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1.5">
                  Student Birth Registration Number (17 Digits) <span className="text-rose-600">*</span>
                </label>
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono text-sm sm:text-base tracking-wider focus:outline-none focus:border-[#014d33] focus:ring-2 focus:ring-emerald-700/20 bg-slate-50/40 text-slate-900 transition"
                    autoFocus
                  />
                  {studentIdInput.length === 17 && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 flex items-center gap-1 text-xs font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 size={16} />
                      <span>Valid</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500">
                  <span>Must be exactly 17 numeric digits from government birth certificate.</span>
                  <span className="font-mono text-slate-400 font-bold">{studentIdInput.length}/17 digits</span>
                </div>
              </div>

              {/* 2-Column Row: Mobile Phone & Parent Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1.5">
                    Parent / Guardian Mobile Phone <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      data-testid="parent-phone-input"
                      placeholder="01712345678"
                      value={parentPhoneInput}
                      onChange={(e) => setParentPhoneInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#014d33] focus:ring-2 focus:ring-emerald-700/20 bg-slate-50/40 text-slate-900"
                    />
                    <Phone size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Acts as your family account login.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1.5">
                    Parent / Guardian Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    data-testid="parent-name-input"
                    placeholder="e.g. Mr. Rafiqul Rahman"
                    value={parentNameInput}
                    onChange={(e) => setParentNameInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#014d33] focus:ring-2 focus:ring-emerald-700/20 bg-slate-50/40 text-slate-900"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Primary contact for all children.
                  </p>
                </div>
              </div>

              {/* Error Banner */}
              {error && (
                <div
                  data-testid="student-id-error"
                  className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5 animate-shake"
                >
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              {/* Firebase Authentication Options */}
              <div className="pt-1">
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-white px-2">
                    Or Sign In with Firebase
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <div className="mt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setIsFirebaseLoading(true);
                        setError(null);
                        const { user } = await loginWithGoogle();
                        setFirebaseUser(user);
                        if (user.displayName && !parentNameInput) setParentNameInput(user.displayName);
                        if (user.phoneNumber && !parentPhoneInput) setParentPhoneInput(user.phoneNumber);
                        setShowFirebaseModal(true);
                      } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : 'Firebase Google Sign-In cancelled or failed.';
                        setError(message);
                      } finally {
                        setIsFirebaseLoading(false);
                      }
                    }}
                    disabled={isFirebaseLoading}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{isFirebaseLoading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons Row (Matching Image 2) */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                <button
                  type="button"
                  data-testid="quick-fill-student-id-btn"
                  onClick={handleQuickFill}
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50/80 hover:bg-emerald-100/90 px-3.5 py-2 rounded-xl border border-emerald-200 transition flex items-center gap-1.5"
                >
                  <Sparkles size={14} className="text-amber-500" />
                  <span>⚡ Quick Fill Demo Credentials</span>
                </button>

                <button
                  type="submit"
                  data-testid="save-student-id-btn"
                  className="px-6 py-2.5 rounded-xl bg-[#014d33] hover:bg-emerald-800 text-white font-extrabold text-sm transition shadow-md flex items-center gap-2 group"
                >
                  <span>Login & Continue to Admission Dossier</span>
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition" />
                </button>
              </div>
            </form>
          </div>

          {/* 3 Value Proposition Cards (Matching Image 2 Exactly) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <span className="text-base">👥</span>
                <span>1 Parent • Multiple Children</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Easily register 1 or more children in Onnorokom School. Switch between children anytime and receive a 10% sibling concession.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <span className="text-base">📄</span>
                <span>Step 1: Student Dossier</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Fill out child & guardian details. Once saved, real-time class and shift seat reservation unlocks immediately.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <span className="text-base">💳</span>
                <span>Step 2 & 3: Lock Seat & Pay</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                10-minute atomic hold lock ensures zero race conditions. Pay tuition fee to finalize confirmed admission.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          FIREBASE MANDATORY POST-LOGIN LINKING MODAL
          ========================================================================= */}
      {showFirebaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
            {/* Header */}
            <div className="bg-[#03130e] text-white p-5 sm:p-6 border-b border-emerald-950">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                  <Shield size={12} className="text-emerald-400" />
                  <span>Google Authentication Verified</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelFirebase}
                  className="text-slate-400 hover:text-white transition p-1 rounded-md"
                  title="Cancel & Log Out"
                >
                  <X size={18} />
                </button>
              </div>
              <h2 className="text-lg sm:text-xl font-serif font-black text-white mt-2.5">
                Link Student Birth Registration & Family Account
              </h2>
              <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">
                Signed in as <strong className="text-white">{firebaseUser?.displayName || 'Google User'}</strong> ({firebaseUser?.email || ''}). 
                Please enter your child's 17-digit Birth Registration Number and contact phone to proceed to the Parent Dashboard. Otherwise, you will be logged out.
              </p>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmFirebaseStudent} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
                  Student Birth Registration Number (17 Digits) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={17}
                    placeholder="e.g. 20152691234567890"
                    value={studentIdInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 17);
                      setStudentIdInput(val);
                      if (error) setError(null);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm tracking-wider focus:outline-none focus:border-[#014d33] focus:ring-2 focus:ring-emerald-700/20 bg-slate-50/40 text-slate-900"
                    autoFocus
                  />
                  {studentIdInput.length === 17 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 flex items-center gap-1 text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 size={14} />
                      <span>17 Digits</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                  <span>Must be exactly 17 numeric digits from government birth certificate.</span>
                  <span className="font-mono text-slate-400 font-bold">{studentIdInput.length}/17 digits</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
                  Parent / Guardian Mobile Phone <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="01749822422"
                    value={parentPhoneInput}
                    onChange={(e) => {
                      setParentPhoneInput(e.target.value);
                      if (error) setError(null);
                    }}
                    className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#014d33] focus:ring-2 focus:ring-emerald-700/20 bg-slate-50/40 text-slate-900"
                  />
                  <Phone size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Acts as your family account login.
                </p>
              </div>

              <div>
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
                  Parent / Guardian Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="GK"
                  value={parentNameInput}
                  onChange={(e) => setParentNameInput(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#014d33] focus:ring-2 focus:ring-emerald-700/20 bg-slate-50/40 text-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Primary contact for all children.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelFirebase}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <LogOut size={14} className="text-slate-500" />
                  <span>Cancel & Log Out</span>
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#014d33] hover:bg-emerald-800 text-white font-extrabold text-xs transition shadow-md flex items-center gap-1.5"
                >
                  <span>Proceed to Dashboard</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  Onnorokom School, Bangladesh
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                Empowering ethical, inquisitive leaders with Cambridge, IB, and National curriculum excellence in Tejgaon, Dhaka, Bangladesh.
              </p>
            </div>
            <div className="md:col-span-4 space-y-2 text-xs text-slate-600">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Admissions Contact
              </div>
              <div>Tejgaon, Dhaka-1208, Bangladesh</div>
              <div>Phone: +880 2 843 1101 | Email: admissions@onnorokomschool.edu.bd</div>
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
            <div>&copy; {new Date().getFullYear()} Onnorokom School, Bangladesh. All rights reserved.</div>
            <div>Zero Lottery FCFS Admission • 17-Digit BRN Primary Key</div>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default ParentLoginPage;
