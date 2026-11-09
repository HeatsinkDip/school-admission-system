import React from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cpu,
  FileCode2,
  GraduationCap,
  Layers,
  School,
  ShieldCheck,
  Sparkles,
  Users,
  Bolt,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { SchoolClass } from './types';
import './LandingPage.css';
import './K8sModals.css';

interface LandingPageProps {
  classes: SchoolClass[];
  onOpenParentPortal: (classIdToSelect?: string) => void;
  savedStudentId: string | null;
  onOpenK8sSpikeModal?: () => void;
  onOpenSystemSpecModal?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  classes,
  onOpenParentPortal,
  savedStudentId,
  onOpenK8sSpikeModal,
  onOpenSystemSpecModal,
}) => {
  return (
    <div className="landing-page-root">
      {/* =========================================================================
          TOP KUBERNETES LIVE INFRASTRUCTURE BAR
          ========================================================================= */}
      <div className="k8s-live-bar">
        <div className="landing-container flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="k8s-status-pill">
              <span className="k8s-pulse-dot"></span>
              <span>K8s Cluster: ACTIVE</span>
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <div className="flex items-center gap-1.5 text-slate-300 text-xs">
              <Cpu size={13} className="text-sky-400" />
              <span>Pods: <strong className="text-white font-mono">3/16</strong></span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-slate-300 text-xs">
              <Users size={13} className="text-amber-400" />
              <span>Concurrent Velocity: <strong className="text-white font-mono">14 req/s</strong></span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 text-slate-300 text-xs">
              <ShieldCheck size={13} className="text-purple-400" />
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
                <Bolt size={12} className="text-amber-400" />
                <span>Simulate 100 Users Spike</span>
              </button>
            )}
            {onOpenSystemSpecModal && (
              <button
                type="button"
                onClick={onOpenSystemSpecModal}
                className="btn btn-xs btn-outline text-slate-200 border-slate-700 hover:bg-slate-800"
                title="View Markdown Architecture Specification"
              >
                <FileCode2 size={12} className="text-sky-400" />
                <span>System .MD Spec</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ALL-WHITE INSTITUTIONAL HEADER (Zero Admin Buttons)
          ========================================================================= */}
      <header className="isd-header-white">
        <div className="landing-container flex items-center justify-between h-20">
          {/* School Brand Emblem & Name */}
          <div
            className="flex items-center gap-3.5 cursor-pointer"
            onClick={() => onOpenParentPortal()}
          >
            <div className="isd-brand-emblem">
              <School size={24} />
            </div>
            <div>
              <div className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-none">
                Onnorokom Projukti
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-indigo-700 mt-1">
                School & Future Science Lab • Dhaka
              </div>
            </div>
          </div>

          {/* Navigation Links & Primary Action */}
          <nav className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              className="isd-nav-link hidden md:inline-flex"
              onClick={() => {
                document.getElementById('seat-matrix-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Layers size={14} />
              <span>Available Shifts</span>
            </button>
            <button
              type="button"
              className="isd-nav-link hidden md:inline-flex"
              onClick={() => {
                document.getElementById('pathways-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <BookOpen size={14} />
              <span>Curriculum</span>
            </button>
            <button
              type="button"
              className="isd-nav-link hidden sm:inline-flex"
              onClick={() => {
                document.getElementById('workflow-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Calendar size={14} />
              <span>How to Apply</span>
            </button>

            {/* Prominent Parents Registration Action */}
            <button
              type="button"
              className="btn btn-primary btn-md font-bold flex items-center gap-2 shadow-sm"
              onClick={() => onOpenParentPortal()}
              data-testid="landing-apply-btn"
            >
              <span>Parents Registration</span>
              <ArrowRight size={16} />
            </button>
          </nav>
        </div>
      </header>

      {/* =========================================================================
          ALL-WHITE HERO SECTION WITH REAL EDUCATIONAL PHOTOGRAPHY
          ========================================================================= */}
      <section className="isd-hero-white">
        <div className="landing-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <div className="hero-tag-pill">
                <Sparkles size={13} className="text-amber-600" />
                <span>ADMISSIONS OPEN FOR ACADEMIC SESSION 2027</span>
              </div>

              <h1 className="hero-title-white">
                Nurturing Curious Minds into <br />
                <span className="hero-highlight-amber">Tomorrow’s Scientific Leaders</span>
              </h1>

              <p className="hero-description-white">
                Welcome to <strong>Onnorokom Projukti School</strong>. Modeled after world-class international standards,
                we combine rigorous Bangladesh National Curriculum foundations with cutting-edge robotics, AI literacy,
                and hands-on experimental sciences. Our admission portal operates on a transparent, 100% First-Come-First-Served
                cloud reservation system with zero lottery quotas.
              </p>

              <div className="flex flex-wrap gap-4 pt-1">
                <button
                  type="button"
                  className="btn btn-primary btn-lg font-bold flex items-center gap-2 shadow-md"
                  onClick={() => onOpenParentPortal()}
                >
                  <GraduationCap size={18} />
                  <span>Parents Registration / Apply Now</span>
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-lg font-semibold flex items-center gap-2 text-slate-700"
                  onClick={() => {
                    document.getElementById('seat-matrix-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <Layers size={16} />
                  <span>View Seat Capacity Matrix</span>
                </button>
              </div>

              {savedStudentId && (
                <div className="mt-5 inline-flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-xs text-emerald-900">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>
                    Welcome back! Active Student ID: <strong className="font-mono text-emerald-950">{savedStudentId}</strong>
                  </span>
                  <button
                    type="button"
                    className="text-emerald-700 hover:underline font-bold ml-2"
                    onClick={() => onOpenParentPortal()}
                  >
                    Resume Child Dossier &rarr;
                  </button>
                </div>
              )}

              {/* Fast Trust Metrics */}
              <div className="grid grid-cols-3 gap-6 pt-8 mt-6 border-t border-slate-100 max-w-lg">
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-serif">100%</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">Digital Labs & Robotics</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 font-serif">50 Max</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">Seats Per Tech Batch</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-serif">Zero</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">Downtime K8s Cluster</div>
                </div>
              </div>
            </div>

            {/* Right Educational Photo & Live Workflow Card */}
            <div className="lg:col-span-5 space-y-5">
              <div className="hero-image-wrapper">
                <img
                  src="https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=1200&q=80"
                  alt="Students engaged in robotics and engineering laboratory at Onnorokom Projukti School"
                  className="hero-image-main"
                  loading="eager"
                />
                <div className="hero-floating-badge">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Hands-on Future Lab</div>
                    <div className="text-[11px] text-slate-500">Hardware Prototyping & Coding</div>
                  </div>
                </div>
              </div>

              {/* Workflow Preview Card */}
              <div className="workflow-card-white">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Cloud Admission Lifecycle</span>
                  </span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    FCFS Protected
                  </span>
                </div>

                <div className="workflow-step-item">
                  <div className="step-num-badge">1</div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">17-Digit Birth ID (Primary Key)</div>
                    <div className="text-[11px] text-slate-500">Parent submits child registration number to start dossier.</div>
                  </div>
                </div>

                <div className="workflow-step-item">
                  <div className="step-num-badge">2</div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Admission Office Scrutiny</div>
                    <div className="text-[11px] text-slate-500">Officers verify certificates and mark student <code>ELIGIBLE</code>.</div>
                  </div>
                </div>

                <div className="workflow-step-item">
                  <div className="step-num-badge">3</div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Atomic Hold & PDF Receipt</div>
                    <div className="text-[11px] text-slate-500">10-minute hold window guarantees seat upon tuition payment.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          REAL-TIME SEAT CAPACITY MATRIX (All-White Theme)
          ========================================================================= */}
      <section id="seat-matrix-section" className="py-16 bg-slate-50/60 border-b border-slate-200">
        <div className="landing-container">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">
                REAL-TIME SEAT MATRIX
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-1">
                Academic Classes & Available Seats
              </h2>
            </div>
            <p className="text-sm text-slate-600 max-w-md">
              Each class batch is strictly capped (e.g. 50 seats) on a First-Come-First-Served payment basis.
              Live inventory updates continuously.
            </p>
          </div>

          <div className="matrix-grid-white">
            {classes.length === 0 ? (
              <div className="col-span-full p-10 text-center bg-white border border-slate-200 rounded-2xl text-slate-500">
                Academic admission windows will be published shortly by the School Registrar.
              </div>
            ) : (
              classes.map((c) => {
                const isFull = c.availableSeats <= 0;
                const fillPercent = Math.min(100, Math.round(((c.totalSeats - c.availableSeats) / c.totalSeats) * 100));
                const isMorning = c.name.toLowerCase().includes('morning');
                const isDay = c.name.toLowerCase().includes('day');

                return (
                  <div key={c.id} className="seat-matrix-card-white">
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

                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Available Seats:</span>
                        <strong className="text-slate-900 font-mono text-sm">
                          {c.availableSeats} of {c.totalSeats}
                        </strong>
                      </div>
                      <div className="seat-progress-bar-white">
                        <div
                          className={`seat-progress-fill ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`}
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
          ACADEMIC PATHWAYS WITH VISUAL PHOTOGRAPHY
          ========================================================================= */}
      <section id="pathways-section" className="py-16 bg-white border-b border-slate-200">
        <div className="landing-container">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">
              ACADEMIC EXCELLENCE
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-1">
              Three Innovative Learning Pathways
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              Our pedagogical framework bridges national STEM excellence with hands-on technological fabrication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="pathway-card-photo">
              <img
                src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80"
                alt="Students learning science and mathematics in classroom"
                className="pathway-photo"
                loading="lazy"
              />
              <div className="pathway-body">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-1">Class 6</span>
                <h3 className="font-serif text-xl font-bold text-slate-900 mb-2">
                  Junior STEM & Computational Thinking
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Foundations in mathematics, natural sciences, algorithmic logic with Scratch, and English communication excellence.
                </p>
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>National Curriculum Mastery</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
              </div>
            </div>

            <div className="pathway-card-photo">
              <img
                src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80"
                alt="Robotics hardware circuits and microcontrollers"
                className="pathway-photo"
                loading="lazy"
              />
              <div className="pathway-body">
                <span className="text-xs font-bold text-sky-700 uppercase tracking-wider block mb-1">Class 7</span>
                <h3 className="font-serif text-xl font-bold text-slate-900 mb-2">
                  Robotics, Microcontrollers & IoT
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Hands-on electronics tinkering with Arduino/ESP32 microcontrollers, sensory robotics, and Python programming.
                </p>
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Hardware Prototyping Studio</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
              </div>
            </div>

            <div className="pathway-card-photo">
              <img
                src="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80"
                alt="Students collaborating on advanced science and technology models"
                className="pathway-photo"
                loading="lazy"
              />
              <div className="pathway-body">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">Class 8</span>
                <h3 className="font-serif text-xl font-bold text-slate-900 mb-2">
                  Artificial Intelligence & Advanced Science
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Introduction to machine learning principles, data literacy, advanced physics experiments, and scientific ethics.
                </p>
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Applied AI & Olympiad Prep</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CAMPUS FACILITIES SHOWCASE (With Real Images)
          ========================================================================= */}
      <section className="py-16 bg-slate-50/60 border-b border-slate-200">
        <div className="landing-container">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">
              WORLD-CLASS CAMPUS INFRASTRUCTURE
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-1">
              Purpose-Built Spaces for Exploration
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="facility-card-white">
              <img
                src="https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80"
                alt="Advanced robotics maker lab with 3D printers and microelectronics"
                className="facility-photo"
                loading="lazy"
              />
              <div className="facility-overlay">
                <h4 className="font-serif font-bold text-lg text-white">Innovation & Robotics Studio</h4>
                <p className="text-xs text-slate-200">Arduino, ESP32, and 3D prototyping benches for student inventors.</p>
              </div>
            </div>

            <div className="facility-card-white">
              <img
                src="https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80"
                alt="Modern digital library and collaborative media commons"
                className="facility-photo"
                loading="lazy"
              />
              <div className="facility-overlay">
                <h4 className="font-serif font-bold text-lg text-white">Digital Library & Media Commons</h4>
                <p className="text-xs text-slate-200">20,000+ volumes, scientific journal subscriptions, and research terminals.</p>
              </div>
            </div>

            <div className="facility-card-white">
              <img
                src="https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=800&q=80"
                alt="Campus architecture and green collegiate courtyard"
                className="facility-photo"
                loading="lazy"
              />
              <div className="facility-overlay">
                <h4 className="font-serif font-bold text-lg text-white">Future Lab Academic Complex</h4>
                <p className="text-xs text-slate-200">Bashundhara R/A Dhaka campus designed for safe, collaborative student life.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRINCIPAL / HEAD OF SCHOOL PERSPECTIVE (White Theme)
          ========================================================================= */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="landing-container">
          <div className="director-card-white flex flex-col md:flex-row items-center gap-8">
            <div className="w-28 h-28 rounded-full overflow-hidden shrink-0 border-4 border-white shadow-md">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
                alt="Head of School"
                className="w-full h-full object-fit"
                loading="lazy"
              />
            </div>
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                MESSAGE FROM THE PRINCIPAL
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
                "Empowering Bangladesh’s Next Generation of Innovators and Ethical Thinkers."
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                At Onnorokom Projukti School, we believe every child possesses innate scientific curiosity that
                blossoms when provided with equal opportunity, modern digital laboratories, and passionate educators.
                Our transparent cloud admission platform ensures that every seat is awarded objectively and equitably.
                We look forward to welcoming your family into our learning community for the 2027 academic session.
              </p>
              <div className="pt-2">
                <div className="font-serif font-bold text-slate-900 text-sm">Dr. M. Rahman, Ph.D.</div>
                <div className="text-xs text-slate-500">Principal & Head of Future Labs, Onnorokom Projukti School</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5-STEP GUIDED ADMISSION PROCESS (All-White Theme)
          ========================================================================= */}
      <section id="workflow-section" className="py-16 bg-slate-50/60 border-b border-slate-200">
        <div className="landing-container">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="section-eyebrow text-indigo-700">TRANSPARENT ADMISSION LIFECYCLE</span>
            <h2 className="section-title font-serif">How Online Admission Works</h2>
            <p className="section-subtitle">
              Follow our 5-step guided journey designed for maximum fairness, security, and clarity for every parent.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm flex items-center justify-center mb-4">
                1
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">17-Digit Birth ID</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide your child's official 17-digit Birth Registration Number. This is the mandatory Primary Key.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-sm flex items-center justify-center mb-4">
                2
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">Child Dossier</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Fill in student profile, verified guardian contacts, and upload required documents.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white font-bold text-sm flex items-center justify-center mb-4">
                3
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">Office Verification</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Admission Officers verify age cutoff and documentation. Once approved as <code>ELIGIBLE</code>, class shifts unlock.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center justify-center mb-4">
                4
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">Hold & Pay Fee</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Claim a 10-minute atomic seat hold. Finalize tuition payment to guarantee the seat permanently.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
              <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-bold text-sm flex items-center justify-center mb-4">
                5
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">Official PDF Receipt</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Download your official verified PDF receipt with digital QR verification code and roll assignment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          ALL-WHITE INSTITUTIONAL FOOTER (Zero Admin Buttons)
          ========================================================================= */}
      <footer className="isd-footer-white">
        <div className="landing-container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12">
            {/* School Info */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-900 text-amber-400 flex items-center justify-center font-bold">
                  <School size={22} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-slate-900">ONNOROKOM PROJUKTI SCHOOL</h3>
                  <p className="text-xs text-indigo-700 font-semibold uppercase tracking-wider">
                    Future Lab & Academy of Sciences • Dhaka
                  </p>
                </div>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed max-w-md">
                Dedicated to pioneering high-caliber scientific and technological education in Bangladesh.
                A transparent, merit-guided, and cloud-guaranteed institution for the innovators of tomorrow.
              </p>
            </div>

            {/* Campus Address */}
            <div>
              <h4 className="footer-column-title">Dhaka Campus</h4>
              <div className="text-slate-500 text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <span>Plot 8, Block E, Bashundhara R/A, Dhaka-1229, Bangladesh</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={15} className="text-indigo-600 shrink-0" />
                  <span>+880 2 843 1101 / +880 1700-000000</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={15} className="text-indigo-600 shrink-0" />
                  <span>admissions@onnorokom.edu.bd</span>
                </div>
              </div>
            </div>

            {/* Quick Links for Parents */}
            <div>
              <h4 className="footer-column-title">Parent Services</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    className="footer-link-white font-semibold text-indigo-700"
                    onClick={() => onOpenParentPortal()}
                  >
                    <ChevronRight size={14} />
                    <span>Parents Registration Portal</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="footer-link-white"
                    onClick={() => {
                      document.getElementById('seat-matrix-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronRight size={14} />
                    <span>Live Class Seat Matrix</span>
                  </button>
                </li>
                {onOpenK8sSpikeModal && (
                  <li>
                    <button
                      type="button"
                      className="footer-link-white"
                      onClick={onOpenK8sSpikeModal}
                    >
                      <ChevronRight size={14} />
                      <span>Simulate 100 Users Spike</span>
                    </button>
                  </li>
                )}
                {onOpenSystemSpecModal && (
                  <li>
                    <button
                      type="button"
                      className="footer-link-white"
                      onClick={onOpenSystemSpecModal}
                    >
                      <ChevronRight size={14} />
                      <span>System .MD Spec</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-3">
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
