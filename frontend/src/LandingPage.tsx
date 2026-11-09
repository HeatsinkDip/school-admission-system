import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  GraduationCap,
  School,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  Play,
  X,
  Search,
  Trophy,
  Award,
  Globe,
  HeartHandshake,
  Compass,
  Menu,
  Shield,
  MessageCircle,
} from 'lucide-react';
import { SchoolClass } from './types';
import './LandingPage.css';
import './K8sModals.css';

interface LandingPageProps {
  classes?: SchoolClass[];
  onOpenParentPortal: (classIdToSelect?: string) => void;
  savedStudentId: string | null;
  onOpenK8sSpikeModal?: () => void;
  onOpenSystemSpecModal?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenParentPortal,
  savedStudentId,
  onOpenK8sSpikeModal,
  onOpenSystemSpecModal,
}) => {
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isCounselorModalOpen, setIsCounselorModalOpen] = useState(false);

  // Filtered menu sections for search
  const menuSections = [
    {
      category: 'ABOUT US',
      links: [
        { name: "Director's Welcome", desc: 'Vision for 21st century learners' },
        { name: 'Senior Leadership Team', desc: 'Internationally accredited educators' },
        { name: 'Mission, Vision and Values', desc: 'Integrity, curiosity and empathy' },
        { name: 'Why Onnorokom School?', desc: 'Ivy League & BUET placement track record' },
        { name: 'Academic Performance', desc: 'Top distinction percentiles in Bangladesh' },
        { name: 'Campus & Facilities', desc: '7.5 acre eco-sustainable smart campus' },
        { name: 'School Policies & Safeguarding', desc: 'Comprehensive child protection' },
      ],
    },
    {
      category: 'LEARNING',
      links: [
        { name: 'Early Years (Ages 3-5)', desc: 'Play-based discovery & bilingual phonics' },
        { name: 'Primary School (Grades 1-5)', desc: 'Foundational STEM & Singapore Math' },
        { name: 'Secondary School (Grades 6-10)', desc: 'Cambridge IGCSE & National Curriculum' },
        { name: 'Higher Secondary & Pre-U', desc: 'A-Levels & Pre-Engineering AI Labs' },
        { name: 'Robotics & Computational Thinking', desc: 'Hands-on hardware & algorithm design' },
      ],
    },
    {
      category: 'SCHOOL LIFE',
      links: [
        { name: 'Co-Curricular Activities (CCA)', desc: 'Over 18 active clubs and societies' },
        { name: 'Barca Athletic Academy', desc: 'Olympic swimming, football, basketball' },
        { name: 'Performing Arts & Theater', desc: 'Music conservatory, dance and drama' },
        { name: 'Community Service & Outreach', desc: 'Empowering communities across Bangladesh' },
      ],
    },
    {
      category: 'ADMISSIONS',
      links: [
        { name: 'Admission Guidelines & Criteria', desc: 'Transparent zero-lottery FCFS policy' },
        { name: '17-Digit Birth ID Requirement', desc: 'Official government primary key' },
        { name: 'Fee Structure & Sibling Concession', desc: 'Transparent fee schedule' },
        { name: 'Apply for Admission Online', desc: 'Parent registration & live seat holds', highlight: true },
      ],
    },
  ];

  const filteredMenuSections = menuSections.map((sec) => ({
    ...sec,
    links: sec.links.filter(
      (l) =>
        l.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
        l.desc.toLowerCase().includes(menuSearchQuery.toLowerCase())
    ),
  })).filter((sec) => sec.links.length > 0);

  return (
    <div className="landing-page-root">
      {/* =========================================================================
          ISD-STYLE TOP UTILITY BAR (Quick Links & Admissions Portal)
          ========================================================================= */}
      <div className="isd-top-utility-bar">
        <div className="landing-container flex items-center justify-between text-xs py-1.5">
          <div className="flex items-center gap-4 text-emerald-100 font-medium">
            <span className="flex items-center gap-1.5">
              <MapPin size={13} className="text-amber-400" />
              <span>Plot 19-21, Block D, Bashundhara R/A, Dhaka-1229, Bangladesh</span>
            </span>
            <span className="hidden md:inline text-emerald-400">|</span>
            <span className="hidden md:flex items-center gap-1.5">
              <Phone size={13} className="text-amber-400" />
              <span>+880 2 843 1101</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              className="text-emerald-100 hover:text-white flex items-center gap-1 font-semibold transition"
              onClick={() => setIsCounselorModalOpen(true)}
            >
              <Compass size={13} className="text-amber-400" />
              <span>Inquire</span>
            </button>
            <button
              type="button"
              className="text-emerald-100 hover:text-white flex items-center gap-1 font-semibold transition hidden sm:flex"
              onClick={() => {
                document.getElementById('facilities-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Globe size={13} className="text-amber-400" />
              <span>Quick Links</span>
            </button>
            <button
              type="button"
              className="text-amber-300 hover:text-amber-200 flex items-center gap-1 font-bold transition"
              onClick={() => onOpenParentPortal()}
            >
              <GraduationCap size={14} />
              <span>Our Portals</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN INSTITUTIONAL HEADER (White & Emerald with Orange Menu Trigger)
          ========================================================================= */}
      <header className="isd-main-header">
        <div className="landing-container flex items-center justify-between h-20">
          {/* School Brand Emblem & Typography */}
          <div
            className="flex items-center gap-3.5 cursor-pointer group"
            onClick={() => onOpenParentPortal()}
            title="Go to Onnorokom School Admission Portal"
          >
            {/* Colorful Geometric Sunburst Emblem matching ISD Reference */}
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
                Onnorokom School
              </div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 mt-1 flex items-center gap-1.5">
                <span>Dhaka</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span className="text-slate-500 font-semibold">Collegiate Academy</span>
              </div>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6">
            <button
              type="button"
              className="isd-nav-item"
              onClick={() => {
                document.getElementById('our-schools-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span>Our Schools</span>
            </button>
            <button
              type="button"
              className="isd-nav-item"
              onClick={() => {
                document.getElementById('facilities-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span>Facilities</span>
            </button>
            <button
              type="button"
              className="isd-nav-item"
              onClick={() => {
                document.getElementById('clubs-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span>Clubs & Life</span>
            </button>
            <button
              type="button"
              className="isd-nav-item"
              onClick={() => {
                document.getElementById('experiences-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span>Learning Experiences</span>
            </button>
          </nav>

          {/* Right Action: Admission Trigger & Orange Menu Trigger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="isd-apply-cta-btn"
              onClick={() => onOpenParentPortal()}
              data-testid="landing-apply-btn"
            >
              <GraduationCap size={18} />
              <span>Apply for Admission</span>
              <ArrowRight size={16} />
            </button>

            {/* Hamburger Button (Saffron Orange square matching ISD reference) */}
            <button
              type="button"
              className="isd-hamburger-trigger"
              onClick={() => setIsMegaMenuOpen(true)}
              aria-label="Open Full Navigation Menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          FULL-SCREEN MEGA MENU OVERLAY (Deep Emerald `#014d33` matching ISD Image 2)
          ========================================================================= */}
      {isMegaMenuOpen && (
        <div className="isd-megamenu-overlay">
          <div className="isd-megamenu-panel">
            {/* Top Search & Close Bar */}
            <div className="isd-megamenu-header">
              <div className="isd-search-bar-wrap">
                <Search size={18} className="text-emerald-300" />
                <input
                  type="text"
                  placeholder="search for something..."
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  className="isd-megamenu-search-input"
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="isd-megamenu-close-btn"
                onClick={() => setIsMegaMenuOpen(false)}
                aria-label="Close Menu"
              >
                <X size={24} />
              </button>
            </div>

            {/* Menu Links Columns */}
            <div className="isd-megamenu-grid">
              {filteredMenuSections.map((sec, idx) => (
                <div key={idx} className="isd-menu-col">
                  <h3 className="isd-menu-col-title">{sec.category}</h3>
                  <ul className="isd-menu-link-list">
                    {sec.links.map((link, lIdx) => (
                      <li key={lIdx}>
                        <button
                          type="button"
                          className={`isd-menu-link-btn ${link.highlight ? 'highlight' : ''}`}
                          onClick={() => {
                            setIsMegaMenuOpen(false);
                            if (link.name.includes('Apply') || link.name.includes('Admission')) {
                              onOpenParentPortal();
                            } else if (link.name.includes('Facilities')) {
                              document.getElementById('facilities-section')?.scrollIntoView({ behavior: 'smooth' });
                            } else if (link.name.includes('Primary') || link.name.includes('Early')) {
                              document.getElementById('our-schools-section')?.scrollIntoView({ behavior: 'smooth' });
                            } else if (link.name.includes('Co-Curricular') || link.name.includes('Club')) {
                              document.getElementById('clubs-section')?.scrollIntoView({ behavior: 'smooth' });
                            } else {
                              document.getElementById('experiences-section')?.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                        >
                          <div className="link-title">{link.name}</div>
                          <div className="link-desc">{link.desc}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Bottom Quick Admission Strip inside Menu */}
            <div className="isd-megamenu-footer">
              <div className="flex items-center gap-3">
                <School size={24} className="text-amber-400" />
                <div>
                  <div className="text-sm font-bold text-white">Onnorokom School Dhaka</div>
                  <div className="text-xs text-emerald-200">First-Come, First-Served Admission System</div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-warning font-bold flex items-center gap-2"
                onClick={() => {
                  setIsMegaMenuOpen(false);
                  onOpenParentPortal();
                }}
              >
                <span>Parents Registration & Apply</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          HERO SECTION (Matching ISD Image 1 & 4 with Bold Stylized Typography)
          ========================================================================= */}
      <section className="isd-hero-showcase">
        <div className="isd-hero-bg-media">
          <img
            src="https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=2000&q=80"
            alt="Students performing on stage and collaborating in Onnorokom School"
            className="isd-hero-img"
          />
          <div className="isd-hero-gradient-overlay" />
        </div>

        <div className="landing-container isd-hero-content-wrap">
          <div className="max-w-3xl">
            {/* Session Pill */}
            <div className="isd-hero-session-pill">
              <Sparkles size={14} className="text-amber-400" />
              <span>ACADEMIC YEAR 2027 • ADMISSIONS OPEN NOW</span>
            </div>

            {/* Distinctive Editorial Hero Titles (As in ISD Reference) */}
            <div className="isd-hero-title-group">
              <h1 className="isd-hero-title-filled">The Innovator.</h1>
              <h2 className="isd-hero-title-outlined">The Communicator.</h2>
            </div>

            <p className="isd-hero-lead-text">
              Nurturing Curious Minds into Bangladesh’s Foremost Scientific Leaders, Engineers & Ethical Visionaries.
              Equipped with state-of-the-art AI laboratories, Cambridge & National curriculum mastery, and transparent
              zero-lottery cloud admission.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-3">
              <button
                type="button"
                className="btn-isd-primary font-bold shadow-lg flex items-center gap-2.5"
                onClick={() => onOpenParentPortal()}
                data-testid="landing-apply-btn-hero"
              >
                <GraduationCap size={20} />
                <span>Parents Registration & Apply</span>
                <ArrowRight size={18} />
              </button>

              {/* Yellow Pill "WATCH THE FULL VIDEO >" matching Reference Image 1 */}
              <button
                type="button"
                className="isd-video-pill-btn"
                onClick={() => setIsVideoModalOpen(true)}
              >
                <Play size={14} fill="currentColor" />
                <span>WATCH THE FULL VIDEO &gt;</span>
              </button>
            </div>

            {/* If student already has registered ID, display fast resume chip */}
            {savedStudentId && (
              <div className="mt-6 inline-flex items-center gap-3 bg-white/95 backdrop-blur-md border border-emerald-400/50 px-4 py-2.5 rounded-2xl shadow-md text-xs text-slate-900">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span>
                  Active Student ID: <strong className="font-mono text-emerald-800">{savedStudentId}</strong>
                </span>
                <button
                  type="button"
                  className="btn btn-xs btn-primary font-bold ml-2"
                  onClick={() => onOpenParentPortal()}
                >
                  Continue Admission Dossier &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Floating "Talk to Hawk / OPS Counselor" Widget at Bottom Right (Image 1 reference) */}
        <button
          type="button"
          className="isd-hawk-counselor-pill"
          onClick={() => setIsCounselorModalOpen(true)}
          title="Talk with an Admission Counselor"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-950 flex items-center justify-center text-amber-400">
            <MessageCircle size={18} />
          </div>
          <div className="text-left">
            <div className="text-[11px] font-bold text-white uppercase tracking-wider">Talk to OPS Counselor</div>
            <div className="text-[9px] text-emerald-200">Online Helpdesk • Dhaka</div>
          </div>
        </button>
      </section>

      {/* =========================================================================
          CAMPUS FACILITIES SECTION (GRID 3-COLUMN LAYOUT)
          ========================================================================= */}
      <section id="facilities-section" className="py-20 bg-white border-b border-slate-100">
        <div className="landing-container">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 text-xs font-black tracking-widest text-emerald-700 uppercase bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200 mb-3">
              <span>COME AND SEE</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              OUR CAMPUS FACILITIES
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed mt-3">
              Step onto our purpose-built 7.5-acre smart campus in Bashundhara R/A, Dhaka. Designed to spark inquiry,
              scientific creativity, and athletic mastery with internationally accredited safety standards.
            </p>
          </div>

          {/* 3-Column Facilities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Facility Card 1 */}
            <div className="isd-facility-grid-card">
              <div className="isd-facility-card-media">
                <img
                  src="https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80"
                  alt="AI Robotics Studio and micro-engineering laboratory"
                  className="isd-facility-photo"
                />
                <span className="isd-facility-category-badge">INNOVATION LAB</span>
              </div>
              <div className="isd-facility-card-body">
                <h3 className="isd-facility-card-title">AI Robotics & Future Tech Lab</h3>
                <p className="isd-facility-card-desc">
                  Microcontrollers, Arduino, Raspberry Pi, 3D prototyping benches, and sensory test tracks for student inventors and competitive robotics teams.
                </p>
                <div className="isd-facility-checklist">
                  <div className="isd-facility-check-item">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>3D Rapid Prototyping & Laser Cutters</span>
                  </div>
                  <div className="isd-facility-check-item">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>Autonomous Rover & Drone Arena</span>
                  </div>
                  <div className="isd-facility-check-item">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>High-Concurrency Cloud Computing Rigs</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 mt-auto">
                  <button
                    type="button"
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition"
                    onClick={() => setIsCounselorModalOpen(true)}
                  >
                    <span>Schedule Lab Tour &rarr;</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Facility Card 2 */}
            <div className="isd-facility-grid-card">
              <div className="isd-facility-card-media">
                <img
                  src="https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=800&q=80"
                  alt="Central Academic Pavilion in Bashundhara campus"
                  className="isd-facility-photo"
                />
                <span className="isd-facility-category-badge">SMART PAVILION</span>
              </div>
              <div className="isd-facility-card-body">
                <h3 className="isd-facility-card-title">Central Academic Complex</h3>
                <p className="isd-facility-card-desc">
                  Modern architecturally designed climate-controlled smart classrooms with interactive digital displays, high-speed fiber connectivity, and acoustic learning zones.
                </p>
                <div className="isd-facility-checklist">
                  <div className="isd-facility-check-item">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>Interactive Smart Pod Classrooms</span>
                  </div>
                  <div className="isd-facility-check-item">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>500-Seat Performing Arts Auditorium</span>
                  </div>
                  <div className="isd-facility-check-item">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>Eco-Sustainable Green Architecture</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 mt-auto">
                  <button
                    type="button"
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition"
                    onClick={() => setIsCounselorModalOpen(true)}
                  >
                    <span>Explore Pavilion &rarr;</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Facility Card 3 */}
            <div className="isd-facility-grid-card">
              <div className="isd-facility-card-media">
                <img
                  src="https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80"
                  alt="Olympic-standard sports arena and artificial turf"
                  className="isd-facility-photo"
                />
                <span className="isd-facility-category-badge">ATHLETIC COMPLEX</span>
              </div>
              <div className="isd-facility-card-body">
                <h3 className="isd-facility-card-title">Olympic Sports & Aquatic Arena</h3>
                <p className="isd-facility-card-desc">
                  25-meter heated competition swimming pool, FIFA-grade artificial turf football ground, professional basketball courts, and badminton academy.
                </p>
                <div className="isd-facility-checklist">
                  <div className="isd-facility-check-item">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>25m Heated Competition Pool</span>
                  </div>
                  <div className="isd-facility-check-item">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>FIFA-Certified Football Turf Ground</span>
                  </div>
                  <div className="isd-facility-check-item">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>Certified International Sports Coaches</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 mt-auto">
                  <button
                    type="button"
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition"
                    onClick={() => setIsCounselorModalOpen(true)}
                  >
                    <span>View Sports Facilities &rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tour CTA Strip */}
          <div className="mt-12 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <School size={28} className="text-emerald-700 shrink-0" />
              <div>
                <strong className="text-slate-900 block font-serif text-lg">Interested in Visiting the Campus?</strong>
                <p className="text-xs text-slate-600">Guided family tours run Sunday through Thursday by appointment.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-primary font-bold px-5 py-2.5"
                onClick={() => setIsCounselorModalOpen(true)}
              >
                Schedule Campus Tour
              </button>
              <button
                type="button"
                className="isd-yellow-pill-solid font-bold px-5 py-2.5"
                onClick={() => setIsVideoModalOpen(true)}
              >
                Virtual 360° Walkthrough
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          "FIND OUT MORE ABOUT OUR SCHOOLS" (Deep Green & Orange Curves: ISD Image 3 & 4)
          ========================================================================= */}
      <section id="our-schools-section" className="isd-our-schools-section">
        {/* Decorative Orange & Yellow Geometric Curves */}
        <div className="isd-ribbon-decor isd-ribbon-top" />
        <div className="isd-ribbon-decor isd-ribbon-bottom" />

        <div className="landing-container relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-amber-300 block mb-2">
              FIND OUT MORE ABOUT
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-black text-white tracking-tight">
              OUR SCHOOLS
            </h2>
            <p className="text-emerald-100 text-sm sm:text-base mt-3">
              Comprehensive educational pathways tailored to every developmental stage of your child's journey.
            </p>
          </div>

          {/* 3 Prominent School Cards (Early Years, Primary, Secondary) in 3-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Early Years */}
            <div className="isd-school-level-card">
              <div className="isd-school-card-media">
                <img
                  src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80"
                  alt="Early Years student smiling in discovery"
                  className="isd-school-photo"
                />
                <div className="isd-school-card-overlay">
                  <span className="isd-school-badge">Playgroup — KG</span>
                </div>
              </div>
              <div className="isd-school-card-body">
                <h3 className="isd-school-card-title">EARLY YEARS</h3>
                <p className="isd-school-card-text">
                  Play-based sensory discovery, social-emotional development, bilingual English/Bangla phonics,
                  and foundational early-math logic in child-safe interactive pods.
                </p>
                <div className="pt-4 border-t border-emerald-900/60 mt-auto flex items-center justify-between">
                  <span className="text-xs text-amber-300 font-semibold">Ages 3 to 5</span>
                  <button
                    type="button"
                    className="text-xs font-bold text-white hover:text-amber-300 flex items-center gap-1 transition"
                    onClick={() => onOpenParentPortal()}
                  >
                    <span>Apply Now</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Primary School */}
            <div className="isd-school-level-card">
              <div className="isd-school-card-media">
                <img
                  src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80"
                  alt="Primary school student in STEM classroom"
                  className="isd-school-photo"
                />
                <div className="isd-school-card-overlay">
                  <span className="isd-school-badge">Grade 1 — Grade 5</span>
                </div>
              </div>
              <div className="isd-school-card-body">
                <h3 className="isd-school-card-title">PRIMARY</h3>
                <p className="isd-school-card-text">
                  Rigorous literacy, Singapore-style mathematics inquiry, foundational Scratch programming,
                  experimental science labs, and leadership development.
                </p>
                <div className="pt-4 border-t border-emerald-900/60 mt-auto flex items-center justify-between">
                  <span className="text-xs text-amber-300 font-semibold">Ages 6 to 10</span>
                  <button
                    type="button"
                    className="text-xs font-bold text-white hover:text-amber-300 flex items-center gap-1 transition"
                    onClick={() => onOpenParentPortal()}
                  >
                    <span>Apply Now</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Secondary School */}
            <div className="isd-school-level-card">
              <div className="isd-school-card-media">
                <img
                  src="https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=800&q=80"
                  alt="Secondary student engaged in robotics engineering"
                  className="isd-school-photo"
                />
                <div className="isd-school-card-overlay">
                  <span className="isd-school-badge">Grade 6 — Grade 12</span>
                </div>
              </div>
              <div className="isd-school-card-body">
                <h3 className="isd-school-card-title">SECONDARY</h3>
                <p className="isd-school-card-text">
                  Cambridge IGCSE & National Curriculum mastery, advanced robotics engineering, AI algorithms,
                  Model UN diplomacy, and dedicated college counseling for top global universities.
                </p>
                <div className="pt-4 border-t border-emerald-900/60 mt-auto flex items-center justify-between">
                  <span className="text-xs text-amber-300 font-semibold">Ages 11 to 18</span>
                  <button
                    type="button"
                    className="text-xs font-bold text-white hover:text-amber-300 flex items-center gap-1 transition"
                    onClick={() => onOpenParentPortal()}
                  >
                    <span>Apply Now</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          "OPS IN NUMBERS" STATS BAR (Matching ISD Image 4)
          ========================================================================= */}
      <section className="isd-numbers-bar-section">
        <div className="landing-container">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-amber-400 block mb-1">
              MORE ABOUT US
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl font-black text-white">
              OPS IN NUMBERS
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="isd-stat-item">
              <div className="text-4xl sm:text-5xl font-black text-white font-serif">100%</div>
              <div className="text-xs sm:text-sm text-emerald-200 font-medium mt-2">
                University Acceptance <br />
                <span className="text-amber-300 font-semibold">(BUET, DU, MIT, Toronto)</span>
              </div>
            </div>

            <div className="isd-stat-item">
              <div className="text-4xl sm:text-5xl font-black text-amber-400 font-serif">1:8</div>
              <div className="text-xs sm:text-sm text-emerald-200 font-medium mt-2">
                Teacher to Student Ratio <br />
                <span className="text-slate-300">Personalized Mentorship</span>
              </div>
            </div>

            <div className="isd-stat-item">
              <div className="text-4xl sm:text-5xl font-black text-white font-serif">32+</div>
              <div className="text-xs sm:text-sm text-emerald-200 font-medium mt-2">
                Average Diploma Score <br />
                <span className="text-amber-300 font-semibold">Top 5% in South Asia</span>
              </div>
            </div>

            <div className="isd-stat-item">
              <div className="text-4xl sm:text-5xl font-black text-amber-400 font-serif">18+</div>
              <div className="text-xs sm:text-sm text-emerald-200 font-medium mt-2">
                Student Clubs & Teams <br />
                <span className="text-slate-300">Active CCAs & Sports</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          "EXCEPTIONAL LEARNING EXPERIENCES AT OPS" (GRID 3-COLUMN LAYOUT)
          ========================================================================= */}
      <section id="experiences-section" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="landing-container">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-700 block mb-2">
              EXCEPTIONAL LEARNING
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              EXPERIENCES AT OPS
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3">
              Beyond traditional classroom textbooks — world-class signature academies designed for real-world impact.
            </p>
          </div>

          {/* 3-Column Learning Experiences Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Experience 1: Carnegie Mellon Tech Academy */}
            <div className="isd-exp-card">
              <div className="isd-exp-media">
                <img
                  src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80"
                  alt="Carnegie Mellon Coding and AI Academy"
                />
                <div className="isd-exp-badge">TECH CODING ACADEMY</div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h4 className="font-serif font-bold text-xl text-slate-900 mb-2">
                  Robotics, Cloud & AI Academy
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                  Hands-on curriculum incorporating microcontrollers, Python neural networks, autonomous rovers, and
                  high-concurrency cloud computing fundamentals from grade 6.
                </p>
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center text-xs font-bold text-emerald-700">
                  <span>Explore Robotics Curriculum &rarr;</span>
                </div>
              </div>
            </div>

            {/* Experience 2: Service Learning */}
            <div className="isd-exp-card">
              <div className="isd-exp-media">
                <img
                  src="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80"
                  alt="Service Learning and community impact"
                />
                <div className="isd-exp-badge">SERVICE LEARNING</div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h4 className="font-serif font-bold text-xl text-slate-900 mb-2">
                  Bangladesh Community Outreach
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                  Student-led community projects across Bangladesh: clean water filtration engineering, solar energy drives for rural schools,
                  and digital literacy mentorship for underprivileged youth.
                </p>
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center text-xs font-bold text-emerald-700">
                  <span>Explore Social Impact Initiatives &rarr;</span>
                </div>
              </div>
            </div>

            {/* Experience 3: Barca Athletic Academy */}
            <div className="isd-exp-card">
              <div className="isd-exp-media">
                <img
                  src="https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80"
                  alt="Barca Academy and Athletic Excellence"
                />
                <div className="isd-exp-badge">BARCA ATHLETICS</div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h4 className="font-serif font-bold text-xl text-slate-900 mb-2">
                  Athletic Academy & Sports
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                  Elite training programs in competitive football, swimming, cricket, tennis, and badminton coached
                  by certified international trainers emphasizing teamwork, agility, and grit.
                </p>
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center text-xs font-bold text-emerald-700">
                  <span>View Sports Schedules & Teams &rarr;</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CO-CURRICULAR CLUBS & LIFE (GRID 3-COLUMN LAYOUT)
          ========================================================================= */}
      <section id="clubs-section" className="py-20 bg-white border-b border-slate-200">
        <div className="landing-container">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-700 block mb-2">
              STUDENT LIFE & LEADERSHIP
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              CLUBS & STUDENT LIFE
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3">
              Where passions transform into lifelong skills. Over 18 student-led societies spanning technology,
              competitive debate, athletics, arts, and humanitarian outreach.
            </p>
          </div>

          {/* 3-Column Clubs & Life Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Club 1 */}
            <div className="isd-club-box">
              <div className="flex items-center justify-between mb-4">
                <div className="isd-club-icon-wrap bg-emerald-100 text-emerald-800">
                  <Cpu size={24} />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  TECH & STEM
                </span>
              </div>
              <h4 className="font-bold text-lg text-slate-900 mb-2">Robotics & AI Society</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                National champions in FIRST Lego League & VEX Robotics. Students design autonomous rovers, IoT sensor networks, and competitive bots.
              </p>
              <div className="pt-3 border-t border-slate-100 mt-auto flex items-center justify-between text-xs">
                <span className="text-slate-500">Mentored by Engineers</span>
                <span className="font-bold text-emerald-700">FLL Champions '26</span>
              </div>
            </div>

            {/* Club 2 */}
            <div className="isd-club-box">
              <div className="flex items-center justify-between mb-4">
                <div className="isd-club-icon-wrap bg-amber-100 text-amber-800">
                  <Trophy size={24} />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                  ORATORY & DEBATE
                </span>
              </div>
              <h4 className="font-bold text-lg text-slate-900 mb-2">National Debating Society</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Parliamentary and Asian format debate. Fostering sharp analytical argumentation, public oratory, and quick critical thinking.
              </p>
              <div className="pt-3 border-t border-slate-100 mt-auto flex items-center justify-between text-xs">
                <span className="text-slate-500">English & Bangla</span>
                <span className="font-bold text-amber-700">National Finalists</span>
              </div>
            </div>

            {/* Club 3 */}
            <div className="flex items-center justify-between mb-4" style={{ display: 'none' }} />
            <div className="isd-club-box">
              <div className="flex items-center justify-between mb-4">
                <div className="isd-club-icon-wrap bg-sky-100 text-sky-800">
                  <Award size={24} />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200">
                  OLYMPIADS
                </span>
              </div>
              <h4 className="font-bold text-lg text-slate-900 mb-2">Science Olympiad Team</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Intensive preparation for Bangladesh Math, Physics, and Informatics Olympiads with distinguished university researchers.
              </p>
              <div className="pt-3 border-t border-slate-100 mt-auto flex items-center justify-between text-xs">
                <span className="text-slate-500">Math, Physics, AI</span>
                <span className="font-bold text-sky-700">Top 5% Rank</span>
              </div>
            </div>

            {/* Club 4 */}
            <div className="isd-club-box">
              <div className="flex items-center justify-between mb-4">
                <div className="isd-club-icon-wrap bg-indigo-100 text-indigo-800">
                  <Globe size={24} />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                  DIPLOMACY
                </span>
              </div>
              <h4 className="font-bold text-lg text-slate-900 mb-2">Model United Nations (MUN)</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Simulating international diplomacy, geopolitical resolution drafting, and global crisis management summits worldwide.
              </p>
              <div className="pt-3 border-t border-slate-100 mt-auto flex items-center justify-between text-xs">
                <span className="text-slate-500">Global Delegations</span>
                <span className="font-bold text-indigo-700">Best Delegate '26</span>
              </div>
            </div>

            {/* Club 5 */}
            <div className="isd-club-box">
              <div className="flex items-center justify-between mb-4">
                <div className="isd-club-icon-wrap bg-rose-100 text-rose-800">
                  <HeartHandshake size={24} />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                  HUMANITARIAN
                </span>
              </div>
              <h4 className="font-bold text-lg text-slate-900 mb-2">Red Crescent & Outreach</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Disaster relief coordination, medical first-aid training, clean water campaigns, and charity drives for underprivileged communities.
              </p>
              <div className="pt-3 border-t border-slate-100 mt-auto flex items-center justify-between text-xs">
                <span className="text-slate-500">Community Impact</span>
                <span className="font-bold text-rose-700">Red Crescent Partner</span>
              </div>
            </div>

            {/* Club 6 */}
            <div className="isd-club-box">
              <div className="flex items-center justify-between mb-4">
                <div className="isd-club-icon-wrap bg-teal-100 text-teal-800">
                  <Sparkles size={24} />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
                  CREATIVE ARTS
                </span>
              </div>
              <h4 className="font-bold text-lg text-slate-900 mb-2">Performing Arts & Theater</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                Classical Bengali music, contemporary symphony orchestra, choral ensembles, and annual dramatic stage productions.
              </p>
              <div className="pt-3 border-t border-slate-100 mt-auto flex items-center justify-between text-xs">
                <span className="text-slate-500">Auditorium Stage</span>
                <span className="font-bold text-teal-700">Annual Gala</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5-STEP GUIDED ADMISSION PROCESS (Transparent & Merit-Driven)
          ========================================================================= */}
      <section id="workflow-section" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="landing-container">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-700 block mb-2">
              TRANSPARENT ADMISSION LIFECYCLE
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              HOW ADMISSION WORKS
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3">
              Zero lotteries, zero quotas. Complete our 5-step transparent digital workflow from anywhere in Bangladesh.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="isd-workflow-box">
              <div className="isd-step-number">1</div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">17-Digit Birth ID</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide student's official 17-digit Birth Registration Number. This is the mandatory Primary Key.
              </p>
            </div>

            <div className="isd-workflow-box">
              <div className="isd-step-number">2</div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">Child Dossier</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter student details, guardian verified phone number, present address, and upload birth certificate.
              </p>
            </div>

            <div className="isd-workflow-box">
              <div className="isd-step-number">3</div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">Office Verification</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Admission Officers inspect records and confirm age eligibility. Once marked <code>ELIGIBLE</code>, seats unlock.
              </p>
            </div>

            <div className="isd-workflow-box">
              <div className="isd-step-number">4</div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">Atomic Hold & Pay</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Lock your seat with a 10-minute atomic hold. Finalize tuition payment to guarantee the enrollment.
              </p>
            </div>

            <div className="isd-workflow-box">
              <div className="isd-step-number">5</div>
              <h4 className="font-bold text-sm text-slate-900 mb-1.5">Official PDF Receipt</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Instantly download your official verified PDF admission receipt with unique digital barcode and roll assignment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          RICH BANGLADESH SCHOOL FOOTER (Matching ISD Image 4 Reference)
          ========================================================================= */}
      <footer className="isd-official-footer">
        <div className="landing-container">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-16 border-b border-emerald-900/60">
            {/* Column 1: School Identity & Description */}
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="isd-sunburst-logo">
                  <svg viewBox="0 0 44 44" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 4C23.1 4 24 4.9 24 6V10C24 11.1 23.1 12 22 12C20.9 12 20 10V6C20 4.9 20.9 4 22 4Z" fill="#10B981" />
                    <path d="M22 32C23.1 32 24 32.9 24 34V38C24 39.1 23.1 40 22 40C20.9 40 20 39.1 20 38V34C20 32.9 20.9 32 22 32Z" fill="#EA580C" />
                    <path d="M4 22C4 20.9 4.9 20 6 20H10C11.1 20 12 20.9 12 22C12 23.1 11.1 24 10 24H6C4.9 24 4 23.1 4 22Z" fill="#F59E0B" />
                    <path d="M32 22C32 20.9 32.9 20 34 20H38C39.1 20 40 20.9 40 22C40 23.1 39.1 24 38 24H34C32.9 24 32 23.1 32 22Z" fill="#047857" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-serif font-black text-xl text-white">ONNOROKOM PROJUKTI SCHOOL</h3>
                  <p className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                    Future Lab & Academy of Sciences • Dhaka
                  </p>
                </div>
              </div>

              <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed max-w-md">
                Pioneering high-caliber scientific, technological, and character education in Bangladesh.
                A transparent, merit-guided, and cloud-guaranteed school community for the innovators of tomorrow.
              </p>

              {/* 25 Years Anniversary Emblem matching ISD reference */}
              <div className="inline-flex items-center gap-3 bg-emerald-900/60 border border-emerald-700/50 px-3.5 py-2 rounded-xl text-xs text-emerald-200">
                <div className="w-8 h-8 rounded-full bg-amber-400 text-emerald-950 font-black flex items-center justify-center text-sm">
                  25
                </div>
                <div>
                  <div className="font-bold text-white uppercase text-[11px] tracking-wider">Years of Academic Excellence</div>
                  <div className="text-[10px] text-amber-300">1999 — 2026 Bangladesh Heritage</div>
                </div>
              </div>
            </div>

            {/* Column 2: Contact Us in Bashundhara R/A */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="isd-footer-col-title">CONTACT US</h4>
              <div className="text-emerald-100 text-xs space-y-2.5">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>Plot 19-21, Block D, Bashundhara R/A, Dhaka-1229, Bangladesh</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={15} className="text-amber-400 shrink-0" />
                  <span>+880 2 843 1101 / +880 1700-000000</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={15} className="text-amber-400 shrink-0" />
                  <span>admissions@onnorokom.edu.bd</span>
                </div>
                <div className="pt-2 text-[11px] text-emerald-300">
                  Office Hours: Sunday – Thursday, 08:00 AM – 04:30 PM BST
                </div>
              </div>
            </div>

            {/* Column 3: Quick Links & Parent Portal Trigger */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="isd-footer-col-title">QUICK LINKS</h4>
              <ul className="text-xs space-y-2 text-emerald-200">
                <li>
                  <button
                    type="button"
                    className="hover:text-white transition flex items-center gap-1.5"
                    onClick={() => onOpenParentPortal()}
                  >
                    <ChevronRight size={13} className="text-amber-400" />
                    <span>Parent Portal Login</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="hover:text-white transition flex items-center gap-1.5"
                    onClick={() => {
                      document.getElementById('our-schools-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronRight size={13} className="text-amber-400" />
                    <span>Academic Curriculum</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="hover:text-white transition flex items-center gap-1.5"
                    onClick={() => {
                      document.getElementById('facilities-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronRight size={13} className="text-amber-400" />
                    <span>Campus Facilities</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="hover:text-white transition flex items-center gap-1.5"
                    onClick={() => {
                      document.getElementById('clubs-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronRight size={13} className="text-amber-400" />
                    <span>Clubs & Student Life</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Campus Photo (Matching ISD Image 4 Footer) */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="isd-footer-col-title">CAMPUS VIEW</h4>
              <div className="rounded-xl overflow-hidden border border-emerald-700/60 shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=400&q=80"
                  alt="Onnorokom School Pavilion Building"
                  className="w-full h-24 object-cover"
                />
              </div>
              <div className="text-[11px] text-emerald-300">
                Main Academic Complex, Bashundhara R/A
              </div>
            </div>
          </div>

          {/* Accreditation Badges Strip (Cambridge, IB, NCTB, British Council, CIS) */}
          <div className="py-6 border-b border-emerald-900/60 flex flex-wrap items-center justify-between gap-4 text-xs text-emerald-300">
            <span className="font-bold text-white uppercase text-[11px] tracking-wider">
              OFFICIAL ACCREDITATIONS & CURRICULUM BOARDS:
            </span>
            <div className="flex flex-wrap items-center gap-6 font-semibold">
              <span className="flex items-center gap-1.5">
                <Award size={14} className="text-amber-400" />
                <span>NCTB Bangladesh</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Globe size={14} className="text-amber-400" />
                <span>Cambridge International Assessment</span>
              </span>
              <span className="flex items-center gap-1.5">
                <GraduationCap size={14} className="text-amber-400" />
                <span>IB World School</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Shield size={14} className="text-amber-400" />
                <span>British Council Partner</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-amber-400" />
                <span>Council of International Schools (CIS)</span>
              </span>
            </div>
          </div>

          {/* Bottom Copyright Strip */}
          <div className="pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-emerald-300/80 gap-3">
            <div>
              &copy; {new Date().getFullYear()} Onnorokom School Dhaka. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span>Kubernetes Orchestrated</span>
              <span>•</span>
              <span>PostgreSQL FCFS Atomic Row Locks</span>
              <span>•</span>
              <span>17-Digit BRN Primary Key</span>
            </div>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          CAMPUS VIDEO PREVIEW MODAL ("WATCH THE FULL VIDEO >")
          ========================================================================= */}
      {isVideoModalOpen && (
        <div className="isd-video-modal-backdrop" onClick={() => setIsVideoModalOpen(false)}>
          <div className="isd-video-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Play size={18} className="text-amber-500" />
                <span className="font-serif font-bold text-slate-900">
                  Onnorokom School — Campus Film & Life
                </span>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsVideoModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative pt-[56.25%] bg-slate-950 rounded-xl overflow-hidden mt-4">
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0"
                title="School Campus Tour Film"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="pt-4 flex justify-between items-center text-xs text-slate-500">
              <span>Experience scientific inquiry & campus vibrancy in Bashundhara, Dhaka.</span>
              <button
                type="button"
                className="btn btn-primary btn-sm font-bold"
                onClick={() => {
                  setIsVideoModalOpen(false);
                  onOpenParentPortal();
                }}
              >
                Apply for Admission Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          COUNSELOR INQUIRY MODAL ("TALK TO HAWK / COUNSELOR")
          ========================================================================= */}
      {isCounselorModalOpen && (
        <div className="isd-video-modal-backdrop" onClick={() => setIsCounselorModalOpen(false)}>
          <div className="isd-counselor-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-800 text-amber-400 flex items-center justify-center font-bold">
                  <Compass size={18} />
                </div>
                <div>
                  <h4 className="font-serif font-bold text-slate-900">Admissions Inquiry & Counselor Desk</h4>
                  <div className="text-xs text-emerald-700 font-semibold">Onnorokom School Dhaka</div>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsCounselorModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 py-4 text-xs sm:text-sm text-slate-700">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                <strong className="text-emerald-950 block mb-1">Frequently Asked Questions</strong>
                <ul className="space-y-1.5 text-xs text-emerald-900">
                  <li>• <strong>Primary Key:</strong> Mandatory 17-digit Birth Registration Number.</li>
                  <li>• <strong>No Quotas/Lottery:</strong> Admissions are strictly First-Come-First-Served upon payment.</li>
                  <li>• <strong>Class Shifts:</strong> Morning (07:30 - 12:00 BST) & Day (12:30 - 05:00 BST).</li>
                </ul>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">How can our admissions counselor help you today?</label>
                <textarea
                  className="form-input w-full"
                  rows={3}
                  placeholder="Ask any question regarding seat availability, documents, or curriculum..."
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsCounselorModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm font-bold"
                onClick={() => {
                  setIsCounselorModalOpen(false);
                  onOpenParentPortal();
                }}
              >
                Proceed to Parent Portal &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen-reader and testing accessibility helpers */}
      <div className="sr-only" aria-hidden="true">
        {onOpenK8sSpikeModal && (
          <button type="button" onClick={onOpenK8sSpikeModal}>
            Simulate 100 Users Spike
          </button>
        )}
        {onOpenSystemSpecModal && (
          <button type="button" onClick={onOpenSystemSpecModal}>
            System .MD Spec
          </button>
        )}
      </div>
    </div>
  );
};
