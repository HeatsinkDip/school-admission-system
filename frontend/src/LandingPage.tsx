import React from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  FileCheck2,
  FileText,
  GraduationCap,
  Layers,
  Lock,
  School,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { SchoolClass } from './types';

interface LandingPageProps {
  classes: SchoolClass[];
  onOpenParentPortal: (classIdToSelect?: string) => void;
  onOpenAdminPortal: () => void;
  savedStudentId: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  classes,
  onOpenParentPortal,
  onOpenAdminPortal,
  savedStudentId,
}) => {
  return (
    <div className="landing-page-root">
      {/* Top Banner Notice */}
      <div className="landing-top-bar">
        <div className="landing-container flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <span className="badge-pulse"></span>
            <strong>Academic Session 2027 Admissions Active:</strong> First-Come, First-Served Online Seats Open!
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="text-white hover:underline flex items-center gap-1"
              onClick={onOpenAdminPortal}
            >
              <Lock size={12} /> Staff / Admin Login
            </button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <header className="landing-hero-section">
        <div className="landing-container">
          <div className="landing-hero-content">
            <div className="hero-badge">
              <Sparkles size={14} className="text-amber-300" />
              <span>ONNOROKOM PROJUKTI SCHOOL • ADMISSION 2027</span>
            </div>
            <h1 className="hero-title">
              Nurturing Curious Minds into <br />
              <span className="hero-highlight">Tomorrow’s Scientific Leaders</span>
            </h1>
            <p className="hero-description">
              Welcome to <strong>Onnorokom Projukti School</strong>. Experience a transparent, 100% first-come-first-served
              online admission system powered by state-of-the-art concurrency controls. Secure your child's seat, complete
              eligibility review, and download an official verified PDF receipt instantly.
            </p>

            <div className="hero-cta-group">
              <button
                type="button"
                className="btn btn-primary btn-lg flex items-center gap-2"
                onClick={() => onOpenParentPortal()}
                data-testid="landing-apply-btn"
              >
                <span>Apply for Admission (Parent Portal)</span>
                <ArrowRight size={18} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-lg flex items-center gap-2"
                onClick={onOpenAdminPortal}
                data-testid="landing-admin-btn"
              >
                <Lock size={18} />
                <span>Admin & Staff Console</span>
              </button>
            </div>

            {savedStudentId && (
              <div className="hero-active-session">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>
                  Welcome back! Active Student ID: <strong className="mono">{savedStudentId}</strong>
                </span>
                <button
                  type="button"
                  className="btn-link text-white underline text-xs"
                  onClick={() => onOpenParentPortal()}
                >
                  Continue Application &rarr;
                </button>
              </div>
            )}

            {/* Quick Metrics */}
            <div className="hero-metrics-grid">
              <div className="metric-card">
                <ShieldCheck size={24} className="text-emerald-400 mb-1" />
                <div className="metric-val">100% Transparent</div>
                <div className="metric-desc">Zero lottery. Strict first-come, first-served allocation</div>
              </div>
              <div className="metric-card">
                <Clock size={24} className="text-amber-400 mb-1" />
                <div className="metric-val">10-Minute Hold</div>
                <div className="metric-desc">Temporary seat lock to pay fee securely without race conditions</div>
              </div>
              <div className="metric-card">
                <Cpu size={24} className="text-indigo-400 mb-1" />
                <div className="metric-val">Robotics & STEM</div>
                <div className="metric-desc">Hands-on science labs and tech-oriented learning curriculum</div>
              </div>
              <div className="metric-card">
                <FileCheck2 size={24} className="text-purple-400 mb-1" />
                <div className="metric-val">Instant PDF Receipt</div>
                <div className="metric-desc">Official digitally signed voucher with seat guarantee</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 5-Step Admission Roadmap */}
      <section className="landing-section bg-slate-50">
        <div className="landing-container">
          <div className="section-header text-center">
            <span className="section-eyebrow">SIMPLE & TRANSPARENT WORKFLOW</span>
            <h2 className="section-title">How Online Admission Works</h2>
            <p className="section-subtitle">
              Follow our 5-step guided process designed for maximum fairness and zero stress for parents.
            </p>
          </div>

          <div className="roadmap-grid">
            <div className="roadmap-card">
              <div className="roadmap-step-num">1</div>
              <div className="roadmap-icon-box">
                <Users size={22} className="text-indigo-600" />
              </div>
              <h3 className="roadmap-title">17-Digit Birth ID</h3>
              <p className="roadmap-desc">
                Provide your child's mandatory 17-digit Birth Registration Number. This acts as the primary key across the school database.
              </p>
            </div>

            <div className="roadmap-card">
              <div className="roadmap-step-num">2</div>
              <div className="roadmap-icon-box">
                <FileText size={22} className="text-blue-600" />
              </div>
              <h3 className="roadmap-title">Accurate Child Data</h3>
              <p className="roadmap-desc">
                Fill in student profile, guardian contacts, previous school results, and upload birth certificate & passport photo.
              </p>
            </div>

            <div className="roadmap-card">
              <div className="roadmap-step-num">3</div>
              <div className="roadmap-icon-box">
                <Award size={22} className="text-amber-600" />
              </div>
              <h3 className="roadmap-title">Office Verification</h3>
              <p className="roadmap-desc">
                Admission Officers verify your child's age eligibility and documents. Once confirmed, available classes unlock in your portal.
              </p>
            </div>

            <div className="roadmap-card">
              <div className="roadmap-step-num">4</div>
              <div className="roadmap-icon-box">
                <Clock size={22} className="text-emerald-600" />
              </div>
              <h3 className="roadmap-title">Seat Hold & Fee Payment</h3>
              <p className="roadmap-desc">
                Select your preferred class-shift to lock a seat for 10 minutes. Complete the admission fee to guarantee your seat permanently.
              </p>
            </div>

            <div className="roadmap-card">
              <div className="roadmap-step-num">5</div>
              <div className="roadmap-icon-box">
                <GraduationCap size={22} className="text-purple-600" />
              </div>
              <h3 className="roadmap-title">Official PDF Receipt</h3>
              <p className="roadmap-desc">
                Download your official printable PDF admission receipt with registrar seal and student enrollment number.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Seat Availability Preview */}
      <section className="landing-section">
        <div className="landing-container">
          <div className="section-header flex justify-between items-end">
            <div>
              <span className="section-eyebrow">REAL-TIME CAPACITY</span>
              <h2 className="section-title">Class-Shifts & Available Seats</h2>
              <p className="section-subtitle">
                Live seat inventory updated every 3 seconds. Limited seats per class-shift.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onOpenParentPortal()}
            >
              Enter Parent Portal &rarr;
            </button>
          </div>

          <div className="classes-preview-grid">
            {classes.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-slate-100 rounded-lg text-slate-500">
                Admission window is opening soon. Class capacities will be published shortly.
              </div>
            ) : (
              classes.map((c) => {
                const isFull = c.availableSeats <= 0;
                const fillPercent = Math.min(100, Math.round(((c.totalSeats - c.availableSeats) / c.totalSeats) * 100));

                return (
                  <div key={c.id} className="class-preview-card">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="class-preview-name">{c.name}</h4>
                      <span className={`status-pill ${isFull ? 'status-danger' : 'status-open'}`}>
                        {isFull ? 'FULL' : 'SEATS OPEN'}
                      </span>
                    </div>

                    <div className="class-preview-stats">
                      <div className="text-sm text-slate-600">
                        Available Seats: <strong className="text-indigo-600 text-lg">{c.availableSeats}</strong> of {c.totalSeats}
                      </div>
                      <div className="seat-progress-bar mt-2">
                        <div
                          className={`seat-progress-fill ${isFull ? 'bg-rose-500' : 'bg-indigo-600'}`}
                          style={{ width: `${fillPercent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-500 mt-3 pt-3 border-t">
                      <span>Confirmed: {c.confirmedSeats}</span>
                      <span>On Hold: {c.heldSeats}</span>
                    </div>

                    <button
                      type="button"
                      className={`btn btn-sm w-full mt-3 ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => onOpenParentPortal(c.id)}
                      disabled={isFull}
                    >
                      {isFull ? 'Capacity Reached' : 'Enroll in this Shift'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* School Highlights & Facilities */}
      <section className="landing-section bg-slate-50">
        <div className="landing-container">
          <div className="section-header text-center">
            <span className="section-eyebrow">WORLD-CLASS EDUCATION</span>
            <h2 className="section-title">Why Onnorokom Projukti School?</h2>
            <p className="section-subtitle">
              Pioneering modern education in Bangladesh with emphasis on STEM, character building, and critical thinking.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-box">
              <div className="feature-icon bg-indigo-50 text-indigo-600">
                <Cpu size={28} />
              </div>
              <h4 className="feature-title">AI & Robotics Laboratory</h4>
              <p className="feature-desc">
                From Class 3 onwards, every student learns coding, microcontrollers, and applied robotics under expert mentorship.
              </p>
            </div>

            <div className="feature-box">
              <div className="feature-icon bg-emerald-50 text-emerald-600">
                <BookOpen size={28} />
              </div>
              <h4 className="feature-title">National Olympiad Mentorship</h4>
              <p className="feature-desc">
                Dedicated training for Math Olympiad, Informatics Olympiad, and Science Fairs integrated into regular school hours.
              </p>
            </div>

            <div className="feature-box">
              <div className="feature-icon bg-amber-50 text-amber-600">
                <Award size={28} />
              </div>
              <h4 className="feature-title">Sibling & Merit Concessions</h4>
              <p className="feature-desc">
                Generous fee concessions for younger siblings and income-based financial support reviewed post-enrollment.
              </p>
            </div>

            <div className="feature-box">
              <div className="feature-icon bg-purple-50 text-purple-600">
                <Layers size={28} />
              </div>
              <h4 className="feature-title">Transparent Governance</h4>
              <p className="feature-desc">
                Automated first-come-first-served systems ensure zero nepotism or hidden quotas. Every seat is publicly tracked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="footer-top grid grid-cols-1 md:grid-cols-4 gap-8 pb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <School size={28} className="text-indigo-400" />
                <h3 className="font-bold text-lg text-white">ONNOROKOM PROJUKTI SCHOOL</h3>
              </div>
              <p className="text-slate-400 text-sm max-w-md">
                Empowering the future generation with science, technology, ethics, and innovation. Dedicated to making quality education accessible and transparent.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Campus Location</h4>
              <p className="text-slate-400 text-sm">
                Plot #12, Section #10, Mirpur<br />
                Dhaka-1216, Bangladesh<br />
                Email: admission@onnorokom.edu.bd<br />
                Helpline: +880 1700-000000
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Quick Navigation</h4>
              <ul className="text-slate-400 text-sm space-y-2">
                <li>
                  <button type="button" className="hover:text-white" onClick={() => onOpenParentPortal()}>
                    Parent Admission Portal
                  </button>
                </li>
                <li>
                  <button type="button" className="hover:text-white" onClick={onOpenAdminPortal}>
                    Staff / Admin Login
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Onnorokom Projukti School. All rights reserved. Online Admission System v2.0.
          </div>
        </div>
      </footer>
    </div>
  );
};

