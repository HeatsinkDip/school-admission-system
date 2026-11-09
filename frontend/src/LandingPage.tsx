import React from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  FileCode2,
  FileText,
  GraduationCap,
  Layers,
  Lock,
  School,
  ShieldCheck,
  Sparkles,
  Users,
  Bolt,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
} from 'lucide-react';
import { SchoolClass } from './types';

interface LandingPageProps {
  classes: SchoolClass[];
  onOpenParentPortal: (classIdToSelect?: string) => void;
  onOpenAdminPortal: () => void;
  savedStudentId: string | null;
  onOpenK8sSpikeModal?: () => void;
  onOpenSystemSpecModal?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  classes,
  onOpenParentPortal,
  onOpenAdminPortal,
  savedStudentId,
  onOpenK8sSpikeModal,
  onOpenSystemSpecModal,
}) => {
  return (
    <div className="landing-page-root font-sans text-slate-800">
      {/* =========================================================================
          Top Kubernetes Live Infrastructure Status Ribbon
          ========================================================================= */}
      <div className="k8s-live-bar">
        <div className="landing-container flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="k8s-status-pill">
              <span className="k8s-pulse-dot"></span>
              <span>K8s Cluster: ACTIVE</span>
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Cpu size={14} className="text-sky-400" />
              <span>Pods: <strong className="text-white font-mono">3</strong>/16</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-slate-300">
              <Users size={14} className="text-amber-400" />
              <span>Concurrent Velocity: <strong className="text-white font-mono">14</strong> req/s</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 text-slate-300">
              <ShieldCheck size={14} className="text-purple-400" />
              <span>Queue Policy: <strong className="text-purple-300">First-Come-First-Served Atomic Lock</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenK8sSpikeModal && (
              <button
                type="button"
                onClick={onOpenK8sSpikeModal}
                className="btn btn-xs k8s-sim-btn"
                title="Simulate 100 simultaneous users competing for 50 seats"
              >
                <Bolt size={13} className="text-amber-400" />
                <span>Simulate 100 Users Spike</span>
              </button>
            )}
            {onOpenSystemSpecModal && (
              <button
                type="button"
                onClick={onOpenSystemSpecModal}
                className="btn btn-xs btn-outline text-slate-300 border-slate-700 hover:bg-slate-800"
                title="View Markdown Architecture Specification"
              >
                <FileCode2 size={13} className="text-sky-400" />
                <span>System .MD Spec</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ISD Dhaka Inspired Institutional Header
          ========================================================================= */}
      <header className="isd-header">
        <div className="landing-container flex items-center justify-between h-20">
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => onOpenParentPortal()}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-md">
              <School size={24} />
            </div>
            <div>
              <div className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-none">
                Onnorokom Projukti
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 mt-1">
                School & Future Science Lab • Dhaka
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="btn btn-outline btn-sm font-semibold hidden sm:inline-flex items-center gap-1.5"
              onClick={() => onOpenParentPortal()}
            >
              <FileText size={15} />
              <span>Parent Portal</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm font-semibold flex items-center gap-1.5"
              onClick={() => onOpenParentPortal()}
              data-testid="landing-apply-btn"
            >
              <span>Apply for Admission</span>
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm font-semibold flex items-center gap-1.5"
              onClick={onOpenAdminPortal}
              data-testid="landing-admin-btn"
              title="Secure Staff & Admin Management"
            >
              <Lock size={15} />
              <span className="hidden sm:inline">Admin Login</span>
            </button>
          </nav>
        </div>
      </header>

      {/* =========================================================================
          ISD Dhaka Inspired Prestigious Hero Section
          ========================================================================= */}
      <section className="isd-hero-section">
        <div className="landing-container relative z-10 py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Vision & Actions */}
            <div className="lg:col-span-7 space-y-6 text-white">
              <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-400/30 text-amber-300 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide">
                <Sparkles size={14} className="text-amber-400 animate-pulse" />
                <span>ADMISSION OPEN FOR ACADEMIC SESSION 2027</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                Nurturing Curious Minds into <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-200 to-sky-300">
                  Tomorrow’s Scientific Leaders
                </span>
              </h1>

              <p className="text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed">
                Welcome to <strong>Onnorokom Projukti School</strong>. Modeled after world-class international standards,
                we combine rigorous Bangladesh National Curriculum foundations with cutting-edge robotics, AI literacy,
                and hands-on experimental sciences. Our admission portal operates on a transparent, 100% First-Come-First-Served
                cloud reservation system with zero lottery quotas.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  type="button"
                  className="btn btn-warning btn-lg font-bold flex items-center gap-2 shadow-xl shadow-amber-500/20"
                  onClick={() => onOpenParentPortal()}
                >
                  <span>Apply for Admission (Parent Portal)</span>
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-lg text-white border-slate-600 hover:bg-slate-800 flex items-center gap-2"
                  onClick={onOpenAdminPortal}
                >
                  <Lock size={18} className="text-amber-400" />
                  <span>Admin & Staff Console</span>
                </button>
              </div>

              {savedStudentId && (
                <div className="hero-active-session inline-flex items-center gap-2.5 bg-slate-900/80 border border-slate-700 px-4 py-2 rounded-xl text-xs text-slate-300">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>
                    Active Session: Student ID <strong className="font-mono text-white">{savedStudentId}</strong>
                  </span>
                  <button
                    type="button"
                    className="text-amber-400 hover:underline font-semibold ml-2"
                    onClick={() => onOpenParentPortal()}
                  >
                    Resume Application &rarr;
                  </button>
                </div>
              )}

              {/* Trust Metric Counters */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-800/80 max-w-xl">
                <div>
                  <div className="text-3xl font-serif font-bold text-white">100%</div>
                  <div className="text-xs text-slate-400 mt-1">Digital Labs & Robotics</div>
                </div>
                <div>
                  <div className="text-3xl font-serif font-bold text-amber-400">50 Max</div>
                  <div className="text-xs text-slate-400 mt-1">Seats Per Academic Batch</div>
                </div>
                <div>
                  <div className="text-3xl font-serif font-bold text-emerald-400">Zero</div>
                  <div className="text-xs text-slate-400 mt-1">Downtime K8s Cluster</div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Admission Architecture Card */}
            <div className="lg:col-span-5">
              <div className="isd-preview-card">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-mono text-slate-400 ml-2">admission-workflow.yml</span>
                  </div>
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded">
                    FCFS Certified
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="workflow-step-pill">
                    <div className="step-badge">1</div>
                    <div>
                      <div className="step-title">Student Registration (17-Digit PK)</div>
                      <div className="step-desc">
                        Parent submits mandatory 17-digit Birth Registration Number. Initial state: <code>PENDING</code>.
                      </div>
                    </div>
                  </div>

                  <div className="workflow-step-pill">
                    <div className="step-badge">2</div>
                    <div>
                      <div className="step-title">Admission Office Verification</div>
                      <div className="step-desc">
                        Officers inspect documents in modal desk and mark student <code>ELIGIBLE</code>.
                      </div>
                    </div>
                  </div>

                  <div className="workflow-step-pill">
                    <div className="step-badge">3</div>
                    <div>
                      <div className="step-title">Atomic 10-Min Hold & PDF Receipt</div>
                      <div className="step-desc">
                        Pessimistic lock reserves seat. On payment, instant downloadable cryptographic PDF voucher is issued.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Need high-load demo?
                  </span>
                  {onOpenK8sSpikeModal && (
                    <button
                      type="button"
                      className="btn btn-xs btn-warning font-semibold flex items-center gap-1.5"
                      onClick={onOpenK8sSpikeModal}
                    >
                      <Bolt size={12} />
                      <span>Test 100-User Surge</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          Real-Time Seat Matrix & Live Capacity Grid
          ========================================================================= */}
      <section className="landing-section bg-white border-b border-slate-200">
        <div className="landing-container">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block">
                REAL-TIME SEAT MATRIX
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-1">
                Academic Classes & Available Seats
              </h2>
            </div>
            <p className="text-sm text-slate-600 max-w-md">
              Each class batch is capped strictly (e.g. 50 seats) on a First-Come-First-Served payment basis.
              Live inventory updates continuously.
            </p>
          </div>

          <div className="classes-preview-grid">
            {classes.length === 0 ? (
              <div className="col-span-full p-10 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500">
                Academic admission windows will be published shortly by the School Registrar.
              </div>
            ) : (
              classes.map((c) => {
                const isFull = c.availableSeats <= 0;
                const fillPercent = Math.min(100, Math.round(((c.totalSeats - c.availableSeats) / c.totalSeats) * 100));
                const isMorning = c.name.toLowerCase().includes('morning');
                const isDay = c.name.toLowerCase().includes('day');

                return (
                  <div key={c.id} className="isd-matrix-card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                          {isMorning ? '🌅 Morning Shift (08:00 AM - 01:15 PM)' : isDay ? '☀️ Day Shift (01:30 PM - 06:15 PM)' : 'Standard Academic Cohort'}
                        </span>
                        <h4 className="font-serif font-bold text-lg text-slate-900">{c.name}</h4>
                      </div>
                      <span className={`status-pill ${isFull ? 'status-danger' : 'status-open'}`}>
                        {isFull ? 'BATCH FULL' : 'SEATS OPEN'}
                      </span>
                    </div>

                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Available Seats:</span>
                        <strong className="text-slate-900 font-mono text-sm">
                          {c.availableSeats} of {c.totalSeats}
                        </strong>
                      </div>
                      <div className="seat-progress-bar">
                        <div
                          className={`seat-progress-fill ${isFull ? 'bg-rose-500' : 'bg-amber-500'}`}
                          style={{ width: `${fillPercent}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                        <span>Confirmed: {c.confirmedSeats}</span>
                        <span>In Payment Hold: {c.heldSeats}</span>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Admission Fee</span>
                        <span className="text-sm font-bold text-slate-800 font-mono">৳ 12,500 BDT</span>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => onOpenParentPortal(c.id)}
                        disabled={isFull}
                      >
                        {isFull ? 'Capacity Reached' : 'Apply for this Shift'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          Elite Academic Pathways (Inspired by ISD Dhaka Curricula)
          ========================================================================= */}
      <section className="landing-section bg-slate-50 border-b border-slate-200">
        <div className="landing-container">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block">
              ACADEMIC EXCELLENCE
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-1">
              Three Comprehensive Learning Pathways
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              Our pedagogical framework bridges national STEM excellence with real-world technological fabrication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="isd-pathway-card">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center mb-5">
                <BookOpen size={24} />
              </div>
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">Class 6</span>
              <h3 className="font-serif text-xl font-bold text-slate-900 mb-2">
                Junior STEM & Computational Thinking
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Foundations in mathematics, natural sciences, algorithmic logic with Scratch, and English communication excellence.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>National Curriculum Mastery</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Computational Thinking Lab</span>
                </li>
              </ul>
            </div>

            <div className="isd-pathway-card">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-700 flex items-center justify-center mb-5">
                <Cpu size={24} />
              </div>
              <span className="text-xs font-bold text-sky-700 uppercase tracking-wider block mb-1">Class 7</span>
              <h3 className="font-serif text-xl font-bold text-slate-900 mb-2">
                Robotics, Microcontrollers & IoT
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Hands-on electronics tinkering with Arduino/ESP32 microcontrollers, sensory robotics, and Python programming.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Hardware Prototyping Studio</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>National Robotics Olympiad Track</span>
                </li>
              </ul>
            </div>

            <div className="isd-pathway-card">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center mb-5">
                <Layers size={24} />
              </div>
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-1">Class 8</span>
              <h3 className="font-serif text-xl font-bold text-slate-900 mb-2">
                Artificial Intelligence & Advanced Science
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Introduction to machine learning principles, data literacy, advanced physics experiments, and scientific ethics.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Applied AI & Machine Learning Basics</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Peer-Reviewed Science Exhibitions</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          Head of School Welcome Letter (ISD Dhaka Style)
          ========================================================================= */}
      <section className="landing-section bg-white border-b border-slate-200">
        <div className="landing-container">
          <div className="isd-director-card">
            <div className="max-w-3xl space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                MESSAGE FROM THE PRINCIPAL
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
                "Empowering Bangladesh’s Next Generation of Innovators and Ethical Thinkers."
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                At Onnorokom Projukti School, we believe every child possesses innate scientific curiosity that
                blossoms when provided with equal opportunity, modern digital laboratories, and passionate educators.
                Our transparent cloud admission platform ensures that every seat is awarded objectively and equitably.
                We look forward to welcoming your family into our learning community for the 2027 academic session.
              </p>
              <div className="pt-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-serif font-bold text-slate-700">
                  DR
                </div>
                <div>
                  <div className="font-serif font-bold text-slate-900">Dr. M. Rahman, Ph.D.</div>
                  <div className="text-xs text-slate-500">Principal & Head of Future Labs, Onnorokom Projukti School</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5-Step Guided Admission Roadmap
          ========================================================================= */}
      <section className="landing-section bg-slate-50">
        <div className="landing-container">
          <div className="section-header text-center max-w-3xl mx-auto mb-12">
            <span className="section-eyebrow text-amber-700">TRANSPARENT ADMISSION LIFECYCLE</span>
            <h2 className="section-title font-serif">How the Admission Process Works</h2>
            <p className="section-subtitle">
              Follow our 5-step guided journey designed for maximum fairness, security, and clarity.
            </p>
          </div>

          <div className="roadmap-grid">
            <div className="roadmap-card">
              <div className="roadmap-step-num bg-indigo-600 text-white">1</div>
              <div className="roadmap-icon-box">
                <Users size={22} className="text-indigo-600" />
              </div>
              <h3 className="roadmap-title">17-Digit Birth ID</h3>
              <p className="roadmap-desc">
                Provide your child's official 17-digit Birth Registration Number. This is the mandatory Primary Key across the school database.
              </p>
            </div>

            <div className="roadmap-card">
              <div className="roadmap-step-num bg-blue-600 text-white">2</div>
              <div className="roadmap-icon-box">
                <FileText size={22} className="text-blue-600" />
              </div>
              <h3 className="roadmap-title">Child Dossier</h3>
              <p className="roadmap-desc">
                Fill in student profile, verified guardian contacts, and upload required documents (birth certificate, photo).
              </p>
            </div>

            <div className="roadmap-card">
              <div className="roadmap-step-num bg-amber-600 text-white">3</div>
              <div className="roadmap-icon-box">
                <Award size={22} className="text-amber-600" />
              </div>
              <h3 className="roadmap-title">Office Verification</h3>
              <p className="roadmap-desc">
                Admission Officers verify age cutoff and documentation. Once approved as <code>ELIGIBLE</code>, class shifts unlock.
              </p>
            </div>

            <div className="roadmap-card">
              <div className="roadmap-step-num bg-emerald-600 text-white">4</div>
              <div className="roadmap-icon-box">
                <Clock size={22} className="text-emerald-600" />
              </div>
              <h3 className="roadmap-title">Hold & Pay Fee</h3>
              <p className="roadmap-desc">
                Claim a 10-minute atomic seat hold. Finalize tuition payment to guarantee the seat permanently.
              </p>
            </div>

            <div className="roadmap-card">
              <div className="roadmap-step-num bg-purple-600 text-white">5</div>
              <div className="roadmap-icon-box">
                <GraduationCap size={22} className="text-purple-600" />
              </div>
              <h3 className="roadmap-title">Official PDF Receipt</h3>
              <p className="roadmap-desc">
                Download your official verified PDF receipt with digital QR verification code and roll assignment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          Institutional Dhaka Campus Footer (ISD Dhaka Style)
          ========================================================================= */}
      <footer className="isd-footer">
        <div className="landing-container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  <School size={20} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-white">ONNOROKOM PROJUKTI SCHOOL</h3>
                  <p className="text-xs text-amber-300 font-semibold uppercase tracking-wider">
                    Future Lab & Academy of Sciences • Dhaka
                  </p>
                </div>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-md">
                Dedicated to pioneering high-caliber scientific and technological education in Bangladesh.
                A transparent, merit-guided, and cloud-guaranteed institution for the innovators of tomorrow.
              </p>
            </div>

            <div>
              <h4 className="text-white font-serif font-semibold text-sm mb-3">Campus Address</h4>
              <p className="text-slate-400 text-sm space-y-1">
                <span className="flex items-start gap-1.5">
                  <MapPin size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>Plot 8, Block E, Bashundhara R/A, Dhaka-1229, Bangladesh</span>
                </span>
                <span className="flex items-center gap-1.5 mt-2">
                  <Phone size={14} className="text-amber-400 shrink-0" />
                  <span>+880 2 843 1101 / +880 1700-000000</span>
                </span>
                <span className="flex items-center gap-1.5 mt-1">
                  <Mail size={14} className="text-amber-400 shrink-0" />
                  <span>admissions@onnorokom.edu.bd</span>
                </span>
              </p>
            </div>

            <div>
              <h4 className="text-white font-serif font-semibold text-sm mb-3">Portals & Navigation</h4>
              <ul className="text-slate-400 text-sm space-y-2">
                <li>
                  <button type="button" className="hover:text-amber-300 flex items-center gap-1" onClick={() => onOpenParentPortal()}>
                    <ChevronRight size={14} />
                    <span>Parent & Student Portal</span>
                  </button>
                </li>
                <li>
                  <button type="button" className="hover:text-amber-300 flex items-center gap-1" onClick={onOpenAdminPortal}>
                    <ChevronRight size={14} />
                    <span>Staff / Admin Console</span>
                  </button>
                </li>
                {onOpenK8sSpikeModal && (
                  <li>
                    <button type="button" className="hover:text-amber-300 flex items-center gap-1" onClick={onOpenK8sSpikeModal}>
                      <ChevronRight size={14} />
                      <span>K8s Burst Simulator</span>
                    </button>
                  </li>
                )}
                {onOpenSystemSpecModal && (
                  <li>
                    <button type="button" className="hover:text-amber-300 flex items-center gap-1" onClick={onOpenSystemSpecModal}>
                      <ChevronRight size={14} />
                      <span>Architecture .MD Blueprint</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-3">
            <div>
              &copy; {new Date().getFullYear()} Onnorokom Projukti School & Future Lab. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span>Kubernetes Orchestrated</span>
              <span>•</span>
              <span>PostgreSQL FCFS Locks</span>
              <span>•</span>
              <span>17-Digit BRN Primary Key</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
