import React, { useState } from 'react';
import { Icon } from './Icons';
import { AppView, SupportedLanguage } from '../types';

interface PresentationViewProps {
  go: (view: AppView) => void;
  onNotify: (msg: string) => void;
  currentLang?: SupportedLanguage;
}

interface Slide {
  title: string;
  subtitle: string;
  tag: string;
  points: { title: string; desc: string }[];
  accentColor: string;
}

const SLIDES: Slide[] = [
  {
    title: 'JeevikaAI · जीविका एआई',
    subtitle: 'Voice-First Civic Livelihood & Skilling Platform for Rural India',
    tag: 'Pitch Deck & Idea Presentation',
    accentColor: 'from-[#17365D] via-[#245A91] to-[#287D73]',
    points: [
      { title: 'Empowering Rural Communities', desc: 'Bridging the digital literacy and language divide for millions of rural citizens.' },
      { title: 'Voice-First Interaction', desc: 'Natural speech recognition in Hindi and Bhojpuri with Gemini AI intelligence.' },
      { title: 'NSQF Aligned Roadmaps', desc: 'Personalized vocational training and hyperlocal livelihood recommendations.' }
    ]
  },
  {
    title: 'The Problem: Rural Livelihood Gap',
    subtitle: 'Why traditional portals fail rural job seekers and SHG members',
    tag: 'Problem Statement',
    accentColor: 'from-[#9E2A2B] via-[#BD403F] to-[#D9822B]',
    points: [
      { title: 'Complex English Interfaces', desc: 'Most government and job portals require advanced digital literacy and English typing.' },
      { title: 'Language Barriers', desc: 'Lack of regional dialect support (like Bhojpuri and rural Hindi) alienates grassroots workers.' },
      { title: 'Generic Guidance', desc: 'Absence of personalized skilling paths matched to local district opportunities and mobility.' }
    ]
  },
  {
    title: 'Our Solution: JeevikaAI Platform',
    subtitle: 'An intelligent, voice-guided companion for sustainable livelihoods',
    tag: 'Core Solution',
    accentColor: 'from-[#17365D] via-[#287D73] to-[#245A91]',
    points: [
      { title: 'Conversational Voice Assessment', desc: 'Speak naturally to share education, skills, and interests without filling complex forms.' },
      { title: 'AI Recommendation Engine', desc: 'Instantly matches profiles with NSQF-aligned training courses and local job openings.' },
      { title: 'Real-Time Progress & Offline PDF', desc: 'Track learning stages and download official printer-friendly roadmaps for offline use.' }
    ]
  },
  {
    title: 'Key Features & Capabilities',
    subtitle: 'Built for rural accessibility, reliability, and scale',
    tag: 'Product Features',
    accentColor: 'from-[#17365D] via-[#245A91] to-[#38BDF8]',
    points: [
      { title: 'JeevikaAI Voice Assistant', desc: 'Always-accessible floating voice assistant to answer questions and update profile attributes.' },
      { title: 'Multi-Language Support', desc: 'Seamless switching between Hindi, Bhojpuri, and English across all views.' },
      { title: 'Admin CMS & Analytics', desc: 'District-level monitoring, beneficiary tracking, and grievance management for administrators.' }
    ]
  },
  {
    title: 'Technology Stack & Architecture',
    subtitle: 'Modern, robust, and lightning-fast engineering stack',
    tag: 'Tech Stack',
    accentColor: 'from-[#202B36] via-[#17365D] to-[#287D73]',
    points: [
      { title: 'Frontend & PWA', desc: 'React 19, TypeScript, Tailwind CSS, Vite, and Progressive Web App offline capabilities.' },
      { title: 'AI & Speech Integration', desc: '@google/genai SDK for semantic profiling, Web Speech API for voice recognition & TTS.' },
      { title: 'Backend & Cloud DB', desc: 'Node.js Express proxy server with Firebase Authentication & Firestore database sync.' }
    ]
  },
  {
    title: 'Social Impact & Target Beneficiaries',
    subtitle: 'Driving grassroots economic empowerment and financial inclusion',
    tag: 'Impact & Reach',
    accentColor: 'from-[#287D73] via-[#138808] to-[#17365D]',
    points: [
      { title: 'Women Self-Help Groups (SHGs)', desc: 'Empowering Jeevika Didis with micro-enterprise and vocational training pathways.' },
      { title: 'Rural Youth', desc: 'Connecting young job seekers with government skill development schemes and local openings.' },
      { title: 'Grassroots Governance', desc: 'Providing district officers with transparent data to plan targeted skilling camps.' }
    ]
  },
  {
    title: 'Future Roadmap & Vision',
    subtitle: 'Scaling impact across states and expanding service offerings',
    tag: 'Future Outlook',
    accentColor: 'from-[#17365D] via-[#D9822B] to-[#245A91]',
    points: [
      { title: 'Pan-India Expansion', desc: 'Extending regional dialect support to Maithili, Magahi, Bengali, Odia, and Tamil.' },
      { title: 'WhatsApp & IVR Integration', desc: 'Bringing voice assessment directly to feature phones via WhatsApp audio bots.' },
      { title: 'Employer Partnership Network', desc: 'Direct recruitment pipelines with local MSMEs, cooperatives, and training partners.' }
    ]
  },
  {
    title: 'Conclusion & Call to Action',
    subtitle: 'Join us in building digital economic independence for rural India',
    tag: 'Conclusion',
    accentColor: 'from-[#17365D] via-[#245A91] to-[#287D73]',
    points: [
      { title: 'Bridging Aspirations and Opportunities', desc: 'Every citizen deserves a personalized roadmap to sustainable livelihood.' },
      { title: 'Experience the Live App', desc: 'Test the voice assessment, explore recommendations, and export the official PDF roadmap.' },
      { title: 'Thank You!', desc: 'Open for questions, feedback, and collaboration.' }
    ]
  }
];

export const PresentationView: React.FC<PresentationViewProps> = ({
  go,
  onNotify,
  currentLang = 'hi',
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const slide = SLIDES[currentSlideIndex];

  const handleNext = () => {
    if (currentSlideIndex < SLIDES.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  const handleExportOutline = () => {
    const text = SLIDES.map((s, i) => 
      `SLIDE ${i + 1}: ${s.title}\nSubtitle: ${s.subtitle}\nTag: ${s.tag}\n` +
      s.points.map((p, j) => `  ${j + 1}. ${p.title}: ${p.desc}`).join('\n') +
      '\n\n'
    ).join('-----------------------------------\n\n');

    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'JeevikaAI-Pitch-Deck-Outline.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onNotify('✅ Pitch deck outline exported successfully!');
    } catch {
      onNotify('Could not download file.');
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#DCE3EA]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#17365D]/10 text-[#17365D] mb-2">
            <Icon name="sparkles" size={14} />
            <span>Investor &amp; Evaluator Presentation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#17365D] font-['Bricolage_Grotesque']">
            JeevikaAI Pitch Deck · आइडिया प्रेजेंटेशन
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6B76] mt-1">
            Browse interactive presentation slides or export the complete pitch outline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportOutline}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#245A91] hover:bg-[#17365D] text-white text-xs font-bold transition-colors shadow-sm"
          >
            <Icon name="download" size={15} />
            <span>Export Slide Outline (.txt)</span>
          </button>

          <button
            onClick={() => go('dashboard')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#DCE3EA] bg-white text-[#17365D] text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            <Icon name="route" size={15} />
            <span>View Dashboard</span>
          </button>
        </div>
      </div>

      {/* Slide Deck Viewer Card */}
      <div className="bg-white border border-[#DCE3EA] rounded-3xl shadow-xl overflow-hidden flex flex-col">
        {/* Slide Header Banner */}
        <div className={`bg-gradient-to-r ${slide.accentColor} p-6 sm:p-10 text-white relative overflow-hidden`}>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-extrabold tracking-wider uppercase">
                {slide.tag}
              </span>
              <span className="text-xs font-extrabold bg-black/20 px-3 py-1 rounded-full">
                Slide {currentSlideIndex + 1} of {SLIDES.length}
              </span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black font-['Bricolage_Grotesque'] tracking-tight mt-2">
              {slide.title}
            </h2>
            <p className="text-xs sm:text-sm text-white/90 max-w-2xl font-['Hind']">
              {slide.subtitle}
            </p>
          </div>
        </div>

        {/* Slide Body / Content Points */}
        <div className="p-6 sm:p-10 space-y-6 bg-white flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {slide.points.map((pt, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#F5F7FA] border border-[#DCE3EA] hover:border-[#245A91] transition-all space-y-2 group"
              >
                <div className="w-8 h-8 rounded-xl bg-[#17365D] text-white flex items-center justify-center font-extrabold text-xs shadow-xs group-hover:bg-[#245A91] transition-colors">
                  0{idx + 1}
                </div>
                <h3 className="font-extrabold text-[#17365D] text-sm sm:text-base">
                  {pt.title}
                </h3>
                <p className="text-xs text-[#5F6B76] leading-relaxed">
                  {pt.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Slide Navigation Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-[#DCE3EA] flex-shrink-0">
          <button
            onClick={handlePrev}
            disabled={currentSlideIndex === 0}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentSlideIndex === 0
                ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500'
                : 'bg-white border border-[#DCE3EA] text-[#17365D] hover:bg-slate-100 shadow-xs'
            }`}
          >
            <Icon name="arrowL" size={16} />
            <span>Previous Slide</span>
          </button>

          {/* Dot Indicators */}
          <div className="hidden sm:flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlideIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  currentSlideIndex === i ? 'bg-[#17365D] w-6' : 'bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={currentSlideIndex === SLIDES.length - 1}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentSlideIndex === SLIDES.length - 1
                ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-500'
                : 'bg-[#17365D] text-white hover:bg-[#245A91] shadow-sm'
            }`}
          >
            <span>Next Slide</span>
            <Icon name="chev" size={16} className="rotate-270" />
          </button>
        </div>
      </div>
    </main>
  );
};
