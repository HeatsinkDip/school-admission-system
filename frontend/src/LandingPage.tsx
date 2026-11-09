import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  GraduationCap,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  ChevronLeft,
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
  Users,
} from 'lucide-react';
import { SchoolClass } from './types';
import { TalkToHawkBotModal } from './TalkToHawkBotModal';
import './LandingPage.css';
import './K8sModals.css';

interface LandingPageProps {
  classes?: SchoolClass[];
  onOpenParentPortal: (classIdToSelect?: string) => void;
  savedStudentId: string | null;
  onOpenK8sSpikeModal?: () => void;
  onOpenSystemSpecModal?: () => void;
}

// =========================================================================
// MOCK DATA & CONTENT (Aligned with Onnorokom School, Bangladesh)
// =========================================================================

// Mega Menu Data structured into Category -> Sub-links (matching Image 2)
const MEGA_MENU_SECTIONS: Record<
  string,
  Array<{ name: string; desc: string; highlight?: boolean; linkTarget?: string }>
> = {
  'ABOUT US': [
    { name: "Director's Welcome", desc: 'Vision for 21st century inquisitive learners' },
    { name: 'Senior Leadership Team', desc: 'Internationally accredited educators & mentors' },
    { name: 'Mission, Vision and Values', desc: 'Integrity, curiosity, empathy and leadership' },
    { name: 'Why ISD?', desc: 'Ivy League, BUET & premier university track record' },
    { name: 'Academic Performance', desc: 'Top distinction percentiles across South Asia' },
    { name: 'Campus & Facilities', desc: '7.5 acre eco-sustainable smart campus in Dhaka' },
    { name: 'ISD Policies', desc: 'Child safeguarding, ethics and safety standards' },
    { name: 'Privacy Policy', desc: 'Digital data governance and student confidentiality' },
  ],
  'LEARNING': [
    { name: 'Early Years (Ages 3-5)', desc: 'Play-based sensory discovery & bilingual phonics' },
    { name: 'Primary School (Grades 1-5)', desc: 'Foundational STEM, Singapore Math & Inquiry' },
    { name: 'Secondary School (Grades 6-10)', desc: 'Cambridge IGCSE & National Curriculum' },
    { name: 'Higher Secondary & Pre-U', desc: 'A-Levels, Pre-Engineering & AI Seminar Labs' },
    { name: 'Robotics & Computational Thinking', desc: 'Microcontrollers, Python & rover engineering' },
  ],
  'SCHOOL LIFE': [
    { name: 'Co-Curricular Activities (CCA)', desc: 'Over 18 active student clubs & societies' },
    { name: 'Barça Athletic Academy', desc: 'Olympic swimming pool, football turf, basketball' },
    { name: 'Performing Arts & Conservatory', desc: 'Classical Bengali orchestra, drama & gala' },
    { name: 'Community Service Outreach', desc: 'Clean water, solar energy & village literacy' },
  ],
  'ADMISSIONS': [
    { name: 'Admission Guidelines & Criteria', desc: 'Transparent zero-lottery FCFS policy' },
    { name: '17-Digit Birth ID Requirement', desc: 'Mandatory government primary key' },
    { name: 'Fee Schedule & Sibling Concession', desc: 'Transparent fees with 10% sibling discount' },
    { name: 'Apply for Admission Online', desc: 'Parent registration & live seat reservation', highlight: true, linkTarget: 'portal' },
  ],
  'COMMUNITY': [
    { name: 'Parent-Teacher Association (PTA)', desc: 'Active family engagement and governance' },
    { name: 'Alumni Worldwide Network', desc: 'Graduates at MIT, Harvard, BUET, and Oxford' },
    { name: 'Global School Exchanges', desc: 'Collaborative partnerships in Madrid, Tokyo, Zurich' },
  ],
  'NEWS & EVENTS': [
    { name: 'Campus Life & Announcements', desc: 'Latest updates on student triumphs and events' },
    { name: 'Academic Calendar 2026-2027', desc: 'Term dates, exams, holidays and sports days' },
    { name: 'Annual Science & Tech Fair', desc: 'National robotics and innovation showcase' },
  ],
  'CAREERS': [
    { name: 'Faculty Vacancies', desc: 'Join our internationally diverse teaching faculty' },
    { name: 'Professional Development', desc: 'Continuous IB, Cambridge and pedagogy training' },
  ],
  'CLASS OF 2026': [
    { name: 'Senior Honors & Placements', desc: '100% university acceptances and scholarships' },
    { name: 'Graduation Commencement', desc: 'Celebrating academic milestones and leadership' },
  ],
  'CONTACT US': [
    { name: 'Tejgaon Campus Address', desc: 'Tejgaon, Dhaka-1208, Bangladesh' },
    { name: 'Admissions Hotline & Email', desc: '+880 2 843 1101 / admissions@onnorokomschool.edu.bd' },
    { name: 'Schedule a Campus Visit', desc: 'Guided family tours Sunday through Thursday' },
  ],
};

// Facilities Carousel Data (matching Image 4, Section 2)
const FACILITIES_DATA = [
  {
    id: 'pavilion',
    name: 'Central Academic Complex & Smart Campus',
    badge: 'CAMPUS COMPLEX',
    subtitle: 'Modern Eco-Sustainable Campus in Tejgaon, Dhaka',
    description:
      'Our campus was designed to provide the best facilities for our students, supporting our varied curriculum and helping our community stay healthy and active. Features climate-controlled smart classrooms, interactive displays, and acoustic learning zones.',
    photo: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80',
    stats: '7.5 Acres • 60+ Smart Pods • 500-Seat Auditorium',
    highlights: [
      'Interactive Smart Pod Classrooms with digital learning boards',
      '500-seat acoustically engineered Performing Arts Auditorium',
      'Solar-powered eco-sustainable green campus architecture',
    ],
  },
  {
    id: 'robotics',
    name: 'AI Robotics & Future Tech Laboratory',
    badge: 'INNOVATION LAB',
    subtitle: 'Hardware Prototyping & AI Neural Computing',
    description:
      'Equipped with Arduino, Raspberry Pi, microcontrollers, 3D rapid prototyping printers, laser cutters, and autonomous rover testing arenas where students engineer real-world solutions from grade 6.',
    photo: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1200&q=80',
    stats: '30+ Workstations • 3D Printers • Drone Arena',
    highlights: [
      '3D Rapid Prototyping & precision laser cutters',
      'Autonomous Rover, Drone & IoT sensor test arena',
      'High-concurrency cloud computing and GPU clusters',
    ],
  },
  {
    id: 'sports',
    name: 'Olympic Sports & Aquatic Arena',
    badge: 'ATHLETIC ARENA',
    subtitle: 'FIFA-Grade Turf & Heated Competition Pool',
    description:
      'A 25-meter heated competition swimming pool, FIFA-certified artificial turf football ground, international-standard basketball courts, and badminton academy with certified coaches.',
    photo: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1200&q=80',
    stats: '25m Heated Pool • FIFA Turf • 4 Hardcourts',
    highlights: [
      '25m heated 6-lane competition swimming pool',
      'FIFA-certified all-weather football turf ground',
      'International sports coaches and athletic trainers',
    ],
  },
  {
    id: 'harkness',
    name: 'Founders Hall & Harkness Seminar Rooms',
    badge: 'ACADEMIC SEMINAR',
    subtitle: 'Discussion-Driven Collegiate Learning',
    description:
      'Modeled after top liberal arts colleges, classrooms feature oval mahogany Harkness discussion tables where dialogue, peer debate, and critical inquiry replace conventional lecturing.',
    photo: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
    stats: '24 Harkness Suites • Digital Library • Research Commons',
    highlights: [
      'Oval mahogany Harkness discussion tables (12-student avg)',
      'Digital archival library with 50,000+ academic journals',
      'Silent study carrels and collaborative thesis defense rooms',
    ],
  },
];

// Story Cards Data (matching Image 4, Section 5)
const STORIES_DATA = [
  {
    type: 'quote',
    bg: 'bg-orange-600',
    headline: 'Dare to Lead the Way.',
    body: 'Student leadership council initiatives driving tangible policy changes and social action across Dhaka.',
    tag: 'LEADERSHIP',
  },
  {
    type: 'photo',
    photo: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
    headline: 'Discovery in the Science Lab',
    body: 'Students conduct biochemical titrations and robotics telemetry under university faculty mentorship.',
    tag: 'SCIENCE & RESEARCH',
  },
  {
    type: 'quote',
    bg: 'bg-emerald-800',
    headline: "Always asking 'why?'",
    body: 'Fostering deep intellectual fearlessness, socratic inquiry, and character from early childhood onward.',
    tag: 'INQUIRY MINDSET',
  },
  {
    type: 'photo',
    photo: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80',
    headline: 'Bengali Heritage & Global Arts',
    body: 'Celebrating classical music, contemporary theater, and international diplomacy at our annual festival.',
    tag: 'CULTURE & ARTS',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenParentPortal,
  savedStudentId,
  onOpenK8sSpikeModal,
  onOpenSystemSpecModal,
}) => {
  // Mega Menu State (Image 2)
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [activeMenuCategory, setActiveMenuCategory] = useState<string>('ABOUT US');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');

  // Facilities Carousel State (Image 4, Section 2)
  const [facilityIndex, setFacilityIndex] = useState(0);

  // Stories Carousel State (Image 4, Section 5)
  const [storyIndex, setStoryIndex] = useState(0);

  // Modals
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isCounselorModalOpen, setIsCounselorModalOpen] = useState(false);

  const currentFacility = FACILITIES_DATA[facilityIndex];

  const handleNextFacility = () => {
    setFacilityIndex((prev) => (prev + 1) % FACILITIES_DATA.length);
  };

  const handlePrevFacility = () => {
    setFacilityIndex((prev) => (prev - 1 + FACILITIES_DATA.length) % FACILITIES_DATA.length);
  };

  const handleNextStory = () => {
    setStoryIndex((prev) => (prev + 1) % STORIES_DATA.length);
  };

  const handlePrevStory = () => {
    setStoryIndex((prev) => (prev - 1 + STORIES_DATA.length) % STORIES_DATA.length);
  };

  // Filtered menu links based on search
  const currentCategoryLinks = (MEGA_MENU_SECTIONS[activeMenuCategory] || []).filter(
    (item) =>
      item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(menuSearchQuery.toLowerCase())
  );

  return (
    <div className="landing-page-root">
      {/* =========================================================================
          TOP UTILITY BAR (Deep Emerald Green `#014d33` matching ISD Image 1 & 4)
          ========================================================================= */}
      <div className="isd-top-utility-bar">
        <div className="landing-container flex items-center justify-between text-xs py-1.5">
          <div className="flex items-center gap-4 text-emerald-100 font-medium">
            <span className="flex items-center gap-1.5">
              <MapPin size={13} className="text-amber-400 shrink-0" />
              <span className="truncate max-w-[280px] sm:max-w-none">
                Tejgaon, Dhaka-1208, Bangladesh
              </span>
            </span>
            <span className="hidden md:inline text-emerald-400/50">|</span>
            <span className="hidden md:flex items-center gap-1.5">
              <Phone size={13} className="text-amber-400 shrink-0" />
              <span>+880 2 843 1101</span>
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
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
          MAIN INSTITUTIONAL HEADER (White with Emerald & Saffron Orange Accent)
          ========================================================================= */}
      <header className="isd-main-header">
        <div className="landing-container flex items-center justify-between h-20">
          {/* School Brand Emblem & Typography */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onOpenParentPortal()}
            title="Go to School Admission Portal"
          >
            {/* Colorful Geometric Sunburst Emblem matching ISD Reference Image 1 & 4 */}
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
              <div className="font-serif text-lg sm:text-2xl font-black tracking-tight text-slate-900 group-hover:text-emerald-800 transition leading-none">
                Onnorokom School, Bangladesh
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-emerald-700 mt-1 flex items-center gap-1.5">
                <span>Tejgaon Campus</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span className="text-slate-500 font-semibold">Online Admission System</span>
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
                document.getElementById('experiences-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span>Learning Experiences</span>
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
          </nav>

          {/* Right Action: Admission Trigger & Orange Square Menu Trigger */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenParentPortal()}
              data-testid="landing-parent-login-btn"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-700/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs transition"
            >
              <Shield size={14} className="text-emerald-700" />
              <span>{savedStudentId ? 'Parent Dashboard' : 'Parent Login'}</span>
            </button>

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

            {/* Square Saffron Orange Hamburger Button matching Reference Image 1 & 4 */}
            <button
              type="button"
              className="isd-hamburger-trigger"
              onClick={() => setIsMegaMenuOpen(true)}
              aria-label="Open Full Institutional Navigation Menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          ISD MEGA MENU DRAWER OVERLAY (Matching Reference Image 2)
          ========================================================================= */}
      {isMegaMenuOpen && (
        <div className="isd-megamenu-overlay" onClick={() => setIsMegaMenuOpen(false)}>
          <div className="isd-megamenu-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Top Bar: Search Input on Left, Orange Square Close Button on Right (Image 2) */}
            <div className="isd-megamenu-topbar">
              <div className="isd-megamenu-search-box">
                <Search size={18} className="text-emerald-300 shrink-0" />
                <input
                  type="text"
                  placeholder="search for something...."
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  className="isd-megamenu-search-input"
                  autoFocus
                />
              </div>
              <button
                type="button"
                className="isd-megamenu-close-square"
                onClick={() => setIsMegaMenuOpen(false)}
                aria-label="Close Navigation Menu"
              >
                <X size={24} />
              </button>
            </div>

            {/* Split Content: Left Main Categories | Right Sub-Items (Image 2 Layout) */}
            <div className="isd-megamenu-split-body">
              {/* Left Column: Bold White Uppercase Categories */}
              <div className="isd-megamenu-categories-col">
                <nav className="space-y-1">
                  {Object.keys(MEGA_MENU_SECTIONS).map((category) => {
                    const isActive = activeMenuCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onMouseEnter={() => setActiveMenuCategory(category)}
                        onClick={() => setActiveMenuCategory(category)}
                        className={`isd-megamenu-cat-btn ${isActive ? 'active' : ''}`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isActive && <span className="isd-cat-indicator-line">—</span>}
                          <span className="font-extrabold tracking-wide uppercase text-lg sm:text-xl">
                            {category}
                          </span>
                        </div>
                        {isActive && (
                          <span className="isd-cat-sunburst-badge">
                            <Sparkles size={14} className="text-amber-400" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Right Column: Detailed Sub-Links with Vertical Divider */}
              <div className="isd-megamenu-sublinks-col">
                <div className="isd-sublinks-header flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                      {activeMenuCategory}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-200">
                    {currentCategoryLinks.length} Sections Available
                  </span>
                </div>

                <div className="isd-sublinks-list space-y-2">
                  {currentCategoryLinks.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`isd-sublink-btn ${item.highlight ? 'is-highlighted' : ''}`}
                      onClick={() => {
                        setIsMegaMenuOpen(false);
                        if (item.linkTarget === 'portal' || item.name.includes('Apply') || item.name.includes('Admission')) {
                          onOpenParentPortal();
                        } else if (item.name.includes('Facilities') || item.name.includes('Campus')) {
                          document.getElementById('facilities-section')?.scrollIntoView({ behavior: 'smooth' });
                        } else if (item.name.includes('Early') || item.name.includes('Primary') || item.name.includes('Secondary')) {
                          document.getElementById('our-schools-section')?.scrollIntoView({ behavior: 'smooth' });
                        } else if (item.name.includes('Co-Curricular') || item.name.includes('Athletic')) {
                          document.getElementById('clubs-section')?.scrollIntoView({ behavior: 'smooth' });
                        } else {
                          document.getElementById('experiences-section')?.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                    >
                      <div className="font-semibold text-white text-base group-hover:text-amber-300 transition flex items-center justify-between">
                        <span>{item.name}</span>
                        <ChevronRight size={15} className="text-emerald-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                      </div>
                      <div className="text-xs text-emerald-200/80 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Bottom Quick Registration Strip inside Drawer */}
                <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-emerald-200 font-semibold">Ready to enroll your child?</div>
                    <div className="text-[11px] text-amber-300 font-bold">17-Digit Birth ID & FCFS Allocation</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-warning btn-sm font-bold flex items-center gap-1.5 shadow-md"
                    onClick={() => {
                      setIsMegaMenuOpen(false);
                      onOpenParentPortal();
                    }}
                  >
                    <span>Parents Portal &rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          HERO SECTION (Matching ISD Image 1 & 4 with Bold Stylized Outlined Typography)
          ========================================================================= */}
      <section className="isd-hero-showcase">
        <div className="isd-hero-bg-media">
          <img
            src="https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=2000&q=80"
            alt="Onnorokom School, Bangladesh students performing and innovating"
            className="isd-hero-img"
          />
          <div className="isd-hero-gradient-overlay" />
        </div>

        <div className="landing-container isd-hero-content-wrap">
          <div className="max-w-3xl">
            {/* Session Pill */}
            <div className="isd-hero-session-pill">
              <Sparkles size={14} className="text-amber-400 shrink-0" />
              <span>ACADEMIC YEAR 2027 • ADMISSIONS OPEN NOW</span>
            </div>

            {/* Distinctive Editorial Hero Titles (As in ISD Reference Image 1 & 4) */}
            <div className="isd-hero-title-group">
              <h1 className="isd-hero-title-filled">The</h1>
              <h2 className="isd-hero-title-outlined">Communicator.</h2>
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
                <span>Register & Apply Now!</span>
                <ArrowRight size={18} />
              </button>

              {/* Yellow Pill "WATCH THE FULL VIDEO >" matching Reference Image 1 & 4 */}
              <button
                type="button"
                className="isd-video-pill-btn"
                onClick={() => setIsVideoModalOpen(true)}
              >
                <Play size={14} fill="currentColor" />
                <span>WATCH THE FULL VIDEO &gt;</span>
              </button>
            </div>

            {/* Fast Resume Badge for logged-in parents */}
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
            <Compass size={18} />
          </div>
          <div className="text-left">
            <div className="text-[11px] font-bold text-white uppercase tracking-wider">Talk to Hawk</div>
            <div className="text-[9px] text-emerald-200">Admissions Desk • ISD</div>
          </div>
        </button>
      </section>

      {/* =========================================================================
          SECTION 2: CAMPUS FACILITIES (Matching ISD Image 4, Section 2)
          Left: Text & Controls | Right: Large Photo with Green Frame Accent & Yellow Tour Button
          ========================================================================= */}
      <section id="facilities-section" className="py-20 bg-white border-b border-slate-100">
        <div className="landing-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Heading, Description, Learn More & Carousel Arrows */}
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-black tracking-widest text-emerald-700 uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span>COME AND SEE</span>
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-950 tracking-tight leading-tight">
                OUR CAMPUS <br /> FACILITIES
              </h2>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                {currentFacility.description}
              </p>

              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Facility Highlights:
                </div>
                {currentFacility.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>

              {/* Action and Interactive Slider Controls (Image 4) */}
              <div className="pt-4 flex items-center gap-6">
                <button
                  type="button"
                  className="px-6 py-2.5 rounded-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider transition shadow-md"
                  onClick={() => setIsCounselorModalOpen(true)}
                >
                  LEARN MORE
                </button>

                {/* Circular Slider Navigation Buttons */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    className="w-10 h-10 rounded-full bg-emerald-900 text-white flex items-center justify-center hover:bg-emerald-800 transition"
                    onClick={handlePrevFacility}
                    aria-label="Previous Campus Facility"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    className="w-10 h-10 rounded-full bg-emerald-900 text-white flex items-center justify-center hover:bg-emerald-800 transition"
                    onClick={handleNextFacility}
                    aria-label="Next Campus Facility"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-400 ml-2">
                    0{facilityIndex + 1} / 0{FACILITIES_DATA.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Featured Large Photo with Emerald Frame & Yellow Tour Pill (Image 4) */}
            <div className="lg:col-span-7">
              <div className="isd-facility-featured-frame">
                {/* Decorative Green Accent Frame on Top Right matching Image 4 */}
                <div className="isd-frame-accent-corner" />

                <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-slate-900">
                  <img
                    src={currentFacility.photo}
                    alt={currentFacility.name}
                    className="w-full h-[360px] sm:h-[420px] object-cover transition-all duration-500"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-emerald-950/90 text-amber-300 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-amber-400/30 tracking-wider">
                      {currentFacility.badge}
                    </span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-slate-950/90 via-slate-900/60 to-transparent text-white">
                    <h3 className="font-serif font-black text-xl sm:text-2xl text-white mb-1">
                      {currentFacility.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-200">
                      {currentFacility.subtitle} • {currentFacility.stats}
                    </p>
                  </div>
                </div>

                {/* Yellow "TAKE A TOUR" Pill Button placed directly below matching Image 4 */}
                <div className="mt-4 flex justify-center sm:justify-start">
                  <button
                    type="button"
                    className="px-6 py-2.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-2"
                    onClick={() => setIsVideoModalOpen(true)}
                  >
                    <Play size={14} fill="currentColor" />
                    <span>TAKE A TOUR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: "FIND OUT MORE ABOUT OUR SCHOOLS" (Matching ISD Image 3 & 4)
          Deep Forest Green `#014d33` Background with Concentric Orange Stadium Curves
          3-Column Grid Cards: EARLY YEARS, PRIMARY, SECONDARY
          ========================================================================= */}
      <section id="our-schools-section" className="isd-our-schools-section">
        {/* Distinctive Concentric Orange Stadium Tracks on Right Margin (Image 3 & 4) */}
        <div className="isd-concentric-tracks" aria-hidden="true">
          <svg viewBox="0 0 320 320" className="w-[300px] h-[300px] sm:w-[380px] sm:h-[380px]" fill="none">
            <path
              d="M160 30 C240 30 290 80 290 160 C290 240 240 290 160 290"
              stroke="#EA580C"
              strokeWidth="24"
              strokeLinecap="round"
            />
            <path
              d="M160 65 C220 65 255 105 255 160 C255 215 220 255 160 255"
              stroke="#F97316"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <path
              d="M160 100 C195 100 220 125 220 160 C220 195 195 220 160 220"
              stroke="#EAB308"
              strokeWidth="16"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="landing-container relative z-10">
          {/* Section Header with Sunburst Icon */}
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center justify-center mb-2">
              <Sparkles size={20} className="text-amber-400" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-white/90 block mb-2">
              FIND OUT MORE ABOUT
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-black text-white tracking-tight">
              OUR SCHOOLS
            </h2>
          </div>

          {/* 3 Prominent School Cards (Early Years, Primary, Secondary) in 3-column grid matching Image 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Early Years (Child in play tunnel matching Image 3) */}
            <div
              className="isd-school-poster-card group cursor-pointer"
              onClick={() => onOpenParentPortal()}
            >
              <div className="isd-school-poster-media">
                <img
                  src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=800&q=80"
                  alt="Early Years student smiling in sensory exploration tunnel"
                  className="isd-school-poster-img"
                />
                <div className="isd-school-poster-overlay">
                  <div className="mt-auto text-center w-full pb-4">
                    <h3 className="font-serif font-black text-2xl tracking-wider text-white uppercase drop-shadow-md">
                      EARLY YEARS
                    </h3>
                    <div className="text-xs text-amber-300 font-bold opacity-0 group-hover:opacity-100 transition mt-1">
                      Ages 3 – 5 • Playgroup to KG &rarr;
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Primary (Young boy in Harry Potter glasses & gown matching Image 3) */}
            <div
              className="isd-school-poster-card group cursor-pointer"
              onClick={() => onOpenParentPortal()}
            >
              <div className="isd-school-poster-media">
                <img
                  src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80"
                  alt="Primary school student in interactive learning"
                  className="isd-school-poster-img"
                />
                <div className="isd-school-poster-overlay">
                  <div className="mt-auto text-center w-full pb-4">
                    <h3 className="font-serif font-black text-2xl tracking-wider text-white uppercase drop-shadow-md">
                      PRIMARY
                    </h3>
                    <div className="text-xs text-amber-300 font-bold opacity-0 group-hover:opacity-100 transition mt-1">
                      Grades 1 – 5 • Ages 6 – 10 &rarr;
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary (Older student in striped polo with robotics kit matching Image 3) */}
            <div
              className="isd-school-poster-card group cursor-pointer"
              onClick={() => onOpenParentPortal()}
            >
              <div className="isd-school-poster-media">
                <img
                  src="https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=800&q=80"
                  alt="Secondary student engineering robotics circuits"
                  className="isd-school-poster-img"
                />
                <div className="isd-school-poster-overlay">
                  <div className="mt-auto text-center w-full pb-4">
                    <h3 className="font-serif font-black text-2xl tracking-wider text-white uppercase drop-shadow-md">
                      SECONDARY
                    </h3>
                    <div className="text-xs text-amber-300 font-bold opacity-0 group-hover:opacity-100 transition mt-1">
                      Grades 6 – 12 • Cambridge & Pre-U &rarr;
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: "ISD IN NUMBERS" STATS BAR (Matching ISD Image 4, Section 4)
          4 Stats across with icons: 100%, 1:8, 32, 18
          ========================================================================= */}
      <section className="isd-numbers-bar-section">
        <div className="landing-container">
          <div className="text-center max-w-xl mx-auto mb-10">
            <div className="inline-flex items-center justify-center mb-1">
              <Sparkles size={18} className="text-amber-400" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-200 block mb-1">
              MORE ABOUT US
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl font-black text-white">
              ONNOROKOM SCHOOL IN NUMBERS
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {/* Stat 1: 100% */}
            <div className="isd-stat-box">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-orange-600/30 text-amber-400 mb-2">
                <Globe size={20} />
              </div>
              <div className="text-4xl sm:text-5xl font-black text-white font-serif">100%</div>
              <div className="text-xs sm:text-sm text-emerald-100 font-medium mt-1">
                University Acceptance Rate
              </div>
            </div>

            {/* Stat 2: 1:8 */}
            <div className="isd-stat-box">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600/30 text-emerald-300 mb-2">
                <Users size={20} />
              </div>
              <div className="text-4xl sm:text-5xl font-black text-white font-serif">1:8</div>
              <div className="text-xs sm:text-sm text-emerald-100 font-medium mt-1">
                Teacher to Student Ratio
              </div>
            </div>

            {/* Stat 3: 32 */}
            <div className="isd-stat-box">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/30 text-amber-300 mb-2">
                <GraduationCap size={20} />
              </div>
              <div className="text-4xl sm:text-5xl font-black text-white font-serif">32</div>
              <div className="text-xs sm:text-sm text-emerald-100 font-medium mt-1">
                Average IB Diploma Score
              </div>
            </div>

            {/* Stat 4: 18 */}
            <div className="isd-stat-box">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-rose-600/30 text-rose-300 mb-2">
                <Trophy size={20} />
              </div>
              <div className="text-4xl sm:text-5xl font-black text-white font-serif">18</div>
              <div className="text-xs sm:text-sm text-emerald-100 font-medium mt-1">
                Extracurricular Clubs & Sports
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: STORIES & SCHOOL LIFE (Matching ISD Image 4, Section 5)
          Carousel Cards: "Dare to Lead the Way", Science Photo, "Always asking 'why?'", Arts Photo
          Yellow Buttons: "STORIES" & "NEWS"
          ========================================================================= */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="landing-container">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-700 block mb-1">
                COMMUNITY VOICES & MILESTONES
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                STORIES OF INQUIRY & LIFE
              </h2>
            </div>

            {/* Yellow Action Pills & Slider Navigation (Image 4) */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-5 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-sm"
              >
                STORIES
              </button>
              <button
                type="button"
                className="px-5 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-sm"
              >
                NEWS
              </button>
              <div className="flex items-center gap-2 ml-2">
                <button
                  type="button"
                  className="w-9 h-9 rounded-full bg-emerald-900 text-white flex items-center justify-center hover:bg-emerald-800 transition"
                  onClick={handlePrevStory}
                  aria-label="Previous Story"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="w-9 h-9 rounded-full bg-emerald-900 text-white flex items-center justify-center hover:bg-emerald-800 transition"
                  onClick={handleNextStory}
                  aria-label="Next Story"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* 4 Cards Grid / Carousel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...STORIES_DATA.slice(storyIndex), ...STORIES_DATA.slice(0, storyIndex)].map((story, sIdx) => {
              if (story.type === 'quote') {
                return (
                  <div
                    key={sIdx}
                    className={`rounded-2xl p-7 text-white flex flex-col justify-between shadow-md ${story.bg} min-h-[300px]`}
                  >
                    <span className="text-[10px] font-extrabold uppercase tracking-widest bg-black/20 px-2.5 py-1 rounded-md self-start">
                      {story.tag}
                    </span>
                    <div className="my-auto">
                      <h3 className="font-serif text-2xl sm:text-3xl font-black leading-tight mb-2">
                        {story.headline}
                      </h3>
                      <p className="text-xs text-white/90 leading-relaxed">{story.body}</p>
                    </div>
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1">
                      <span>Read Feature &rarr;</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={sIdx}
                  className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-md flex flex-col min-h-[300px] group"
                >
                  <div className="h-44 overflow-hidden relative">
                    <img
                      src={story.photo}
                      alt={story.headline}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <span className="absolute top-3 left-3 bg-slate-900/80 text-amber-300 text-[10px] font-extrabold px-2.5 py-1 rounded-md">
                      {story.tag}
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h4 className="font-serif font-bold text-base text-slate-900 mb-1">
                      {story.headline}
                    </h4>
                    <p className="text-xs text-slate-600 line-clamp-3 mb-3">{story.body}</p>
                    <div className="mt-auto text-xs font-bold text-emerald-700">
                      <span>Learn More &rarr;</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: "EXCEPTIONAL LEARNING EXPERIENCES AT ISD" (Matching Image 4, Section 6)
          Deep Forest Green `#014d33` Background with Concentric Orange Stadium Curves
          3 Tall Column Image Cards:
          - Carnegie Mellon University (AI Robotics)
          - Service Learning (Community Outreach)
          - Barça Academy (Athletics & Soccer)
          ========================================================================= */}
      <section id="experiences-section" className="isd-experiences-section">
        {/* Concentric Orange Curves on Top Right Margin (Image 4) */}
        <div className="isd-concentric-tracks top-tracks" aria-hidden="true">
          <svg viewBox="0 0 320 320" className="w-[300px] h-[300px] sm:w-[380px] sm:h-[380px]" fill="none">
            <path
              d="M160 30 C240 30 290 80 290 160 C290 240 240 290 160 290"
              stroke="#EA580C"
              strokeWidth="24"
              strokeLinecap="round"
            />
            <path
              d="M160 65 C220 65 255 105 255 160 C255 215 220 255 160 255"
              stroke="#F97316"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <path
              d="M160 100 C195 100 220 125 220 160 C220 195 195 220 160 220"
              stroke="#EAB308"
              strokeWidth="16"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="landing-container relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center justify-center mb-2">
              <Sparkles size={20} className="text-amber-400" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-200 block mb-2">
              EXCEPTIONAL LEARNING
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-black text-white tracking-tight">
              EXPERIENCES AT ISD
            </h2>
          </div>

          {/* 3 Column Image Cards matching Image 4 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1: Carnegie Mellon University Robotics */}
            <div
              className="isd-experience-card group cursor-pointer"
              onClick={() => onOpenParentPortal()}
            >
              <div className="isd-experience-media">
                <img
                  src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80"
                  alt="Carnegie Mellon Robotics & AI Academy"
                  className="isd-experience-img"
                />
                <div className="isd-experience-overlay">
                  <div className="mt-auto text-center w-full pb-4 px-3">
                    <h3 className="font-serif font-black text-xl sm:text-2xl text-white uppercase tracking-wider drop-shadow-md">
                      CARNEGIE MELLON UNIVERSITY
                    </h3>
                    <p className="text-xs text-amber-300 font-semibold opacity-0 group-hover:opacity-100 transition mt-1">
                      Robotics & AI Computational Academy &rarr;
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Service Learning */}
            <div
              className="isd-experience-card group cursor-pointer"
              onClick={() => onOpenParentPortal()}
            >
              <div className="isd-experience-media">
                <img
                  src="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80"
                  alt="Service Learning and community impact across Bangladesh"
                  className="isd-experience-img"
                />
                <div className="isd-experience-overlay">
                  <div className="mt-auto text-center w-full pb-4 px-3">
                    <h3 className="font-serif font-black text-xl sm:text-2xl text-white uppercase tracking-wider drop-shadow-md">
                      SERVICE LEARNING
                    </h3>
                    <p className="text-xs text-amber-300 font-semibold opacity-0 group-hover:opacity-100 transition mt-1">
                      Student Outreach & Rural Solar Drives &rarr;
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Barça Academy */}
            <div
              className="isd-experience-card group cursor-pointer"
              onClick={() => onOpenParentPortal()}
            >
              <div className="isd-experience-media">
                <img
                  src="https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80"
                  alt="Barça Academy athletics and international soccer training"
                  className="isd-experience-img"
                />
                <div className="isd-experience-overlay">
                  <div className="mt-auto text-center w-full pb-4 px-3">
                    <h3 className="font-serif font-black text-xl sm:text-2xl text-white uppercase tracking-wider drop-shadow-md">
                      BARÇA ACADEMY
                    </h3>
                    <p className="text-xs text-amber-300 font-semibold opacity-0 group-hover:opacity-100 transition mt-1">
                      Elite Football, Aquatics & Basketball Training &rarr;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7: CO-CURRICULAR CLUBS & LIFE (Grid 3-Column Layout from Request 3)
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
          SECTION 8: 5-STEP GUIDED ADMISSION PROCESS (Transparent & Merit-Driven)
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
          SECTION 9: INSTITUTIONAL FOOTER (White Background matching ISD Image 4, Section 7)
          Logo, Contact Us, Links, Connect (25 Years), Campus Photo, Accreditation Badges
          ========================================================================= */}
      <footer className="isd-white-footer">
        <div className="landing-container">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-16 border-b border-slate-200">
            {/* Column 1: School Identity & Description */}
            <div className="md:col-span-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="isd-sunburst-logo">
                  <svg viewBox="0 0 44 44" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 4C23.1 4 24 4.9 24 6V10C24 11.1 23.1 12 22 12C20.9 12 20 10V6C20 4.9 20.9 4 22 4Z" fill="#10B981" />
                    <path d="M22 32C23.1 32 24 32.9 24 34V38C24 39.1 23.1 40 22 40C20.9 40 20 39.1 20 38V34C20 32.9 20.9 32 22 32Z" fill="#EA580C" />
                    <path d="M4 22C4 20.9 4.9 20 6 20H10C11.1 20 12 20.9 12 22C12 23.1 11.1 24 10 24H6C4.9 24 4 23.1 4 22Z" fill="#F59E0B" />
                    <path d="M32 22C32 20.9 32.9 20 34 20H38C39.1 20 40 20.9 40 22C40 23.1 39.1 24 38 24H34C32.9 24 32 23.1 32 22Z" fill="#047857" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-serif font-black text-xl text-slate-900 leading-tight">
                    Onnorokom School, Bangladesh
                  </h3>
                  <p className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
                    Online Admission & Academic System
                  </p>
                </div>
              </div>

              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-sm">
                Onnorokom School, Bangladesh offers an exemplary education to students aged 3-18.
                Our state-of-the-art campus in Tejgaon empowers inquisitive minds with Cambridge, IB,
                and national curricula mastery.
              </p>

              {/* Celebrating 25 Years Badge (matching Image 4, Section 7) */}
              <div className="inline-flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-xs text-emerald-950">
                <div className="w-9 h-9 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-sm shadow-sm">
                  25
                </div>
                <div>
                  <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">Celebrating 25 Years</div>
                  <div className="text-[10px] text-emerald-700 font-semibold">1999 — 2026 Academic Excellence</div>
                </div>
              </div>
            </div>

            {/* Column 2: Contact Us (matching Image 4, Section 7) */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="font-serif font-black text-xs text-slate-900 uppercase tracking-widest border-b border-emerald-700/30 pb-1.5 inline-block">
                CONTACT US
              </h4>
              <div className="text-slate-600 text-xs space-y-2.5">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-emerald-700 shrink-0 mt-0.5" />
                  <span>Tejgaon, Dhaka-1208, Bangladesh</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={15} className="text-emerald-700 shrink-0" />
                  <span>+880 2 843 1101 / +880 1700-000000</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={15} className="text-emerald-700 shrink-0" />
                  <span>admissions@onnorokomschool.edu.bd</span>
                </div>
                <div className="pt-1 text-[11px] text-slate-500">
                  Office Hours: Sunday – Thursday, 08:00 AM – 04:30 PM BST
                </div>
              </div>
            </div>

            {/* Column 3: Links (matching Image 4, Section 7) */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="font-serif font-black text-xs text-slate-900 uppercase tracking-widest border-b border-emerald-700/30 pb-1.5 inline-block">
                LINKS
              </h4>
              <ul className="text-xs space-y-2 text-slate-600 font-medium">
                <li>
                  <button
                    type="button"
                    className="hover:text-emerald-800 transition flex items-center gap-1.5"
                    onClick={() => onOpenParentPortal()}
                  >
                    <ChevronRight size={13} className="text-amber-500" />
                    <span>Parent Portal Login</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="hover:text-emerald-800 transition flex items-center gap-1.5"
                    onClick={() => {
                      document.getElementById('our-schools-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronRight size={13} className="text-amber-500" />
                    <span>Our Schools & Grades</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="hover:text-emerald-800 transition flex items-center gap-1.5"
                    onClick={() => {
                      document.getElementById('facilities-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronRight size={13} className="text-amber-500" />
                    <span>Campus Facilities</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="hover:text-emerald-800 transition flex items-center gap-1.5"
                    onClick={() => {
                      document.getElementById('clubs-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <ChevronRight size={13} className="text-amber-500" />
                    <span>Clubs & Student Life</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Campus Photo (matching Image 4, Section 7) */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="font-serif font-black text-xs text-slate-900 uppercase tracking-widest border-b border-emerald-700/30 pb-1.5 inline-block">
                CAMPUS VIEW
              </h4>
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=600&q=80"
                  alt="Onnorokom School campus building facade"
                  className="w-full h-28 object-cover hover:scale-105 transition duration-500"
                />
              </div>
              <div className="text-[11px] text-slate-500">
                Main Academic Complex, Tejgaon, Dhaka
              </div>
            </div>
          </div>

          {/* Accreditation Logos Row matching Image 4, Section 7 */}
          <div className="py-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
            <span className="font-extrabold text-slate-800 uppercase text-[11px] tracking-wider">
              ACCREDITED BY, AUTHORISED BY AND AFFILIATED:
            </span>
            <div className="flex flex-wrap items-center gap-6 font-semibold">
              <span className="flex items-center gap-1.5 text-slate-700">
                <GraduationCap size={15} className="text-emerald-700" />
                <span>IB World School</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <Shield size={15} className="text-emerald-700" />
                <span>CIS Accredited</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <Award size={15} className="text-emerald-700" />
                <span>NEASC Member</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <Globe size={15} className="text-emerald-700" />
                <span>Cambridge Assessment</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 size={15} className="text-emerald-700" />
                <span>NCTB Bangladesh</span>
              </span>
            </div>
          </div>

          {/* Bottom Copyright Strip */}
          <div className="pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-3">
            <div>
              &copy; {new Date().getFullYear()} Onnorokom School, Bangladesh. All rights reserved.
            </div>
            <div className="flex items-center gap-3">
              <span>Zero Lottery • FCFS Admission</span>
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
                  Onnorokom School, Bangladesh — Campus Film & Life
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
              <span>Experience scientific inquiry & campus vibrancy in Tejgaon, Dhaka.</span>
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
          ONLINE BOT: "TALK TO HAWK ADMISSIONS DESK" (Interactive AI/Rule Counselor)
          ========================================================================= */}
      <TalkToHawkBotModal
        isOpen={isCounselorModalOpen}
        onClose={() => setIsCounselorModalOpen(false)}
        onProceedToPortal={onOpenParentPortal}
      />

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
