import React, { useState, useMemo } from 'react';
import { Icon } from './Icons';
import { BeneficiaryProfile, SupportedLanguage, Opportunity, AppView, SummaryModalData } from '../types';
import { rankPaths, rankJobs, splitList, kmLabel, buildSummary, slug } from '../services/recommendationEngine';
import { STAGE_TITLES } from '../data/mockData';
import { speechService } from '../services/speechService';
import { storageService } from '../services/storageService';

interface DashboardProps {
  profile: BeneficiaryProfile;
  hasAssessment: boolean;
  currentLang: SupportedLanguage;
  go: (view: AppView, sectionId?: string) => void;
  onNotify: (msg: string) => void;
  onOpenSummary: (summaryData: SummaryModalData) => void;
  onSelectDetail: (opp: Opportunity) => void;
}

// Circular Fit Score Gauge using civic teal
const Ring: React.FC<{ value: number; size?: number }> = ({ value, size = 64 }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`Fit score ${value} out of 100`} className="flex-none">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" className="stroke-[#DCE3EA]" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        transform="rotate(-90 32 32)"
        className="stroke-[#287D73]"
      />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontSize="16"
        fontWeight="800"
        className="fill-[#17365D] font-['Bricolage_Grotesque']"
      >
        {value}
      </text>
    </svg>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({
  profile,
  hasAssessment,
  currentLang,
  go,
  onNotify,
  onOpenSummary,
  onSelectDetail,
}) => {
  const rankedPaths = useMemo(() => rankPaths(profile), [profile]);
  const topPaths = rankedPaths.slice(0, 3);
  const jobs = useMemo(() => rankJobs(profile, rankedPaths), [profile, rankedPaths]);

  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});
  const [selectedPathId, setSelectedPathId] = useState<string>(topPaths[0]?.id || rankedPaths[0]?.id);
  const [doneStages, setDoneStages] = useState<Record<string, boolean>>(() => storageService.loadProgress());
  const [jobFilter, setJobFilter] = useState<'All' | 'Job' | 'Self-employment'>('All');
  const [shortlist, setShortlist] = useState<Record<string, boolean>>(() => storageService.loadShortlist());
  const [isReadingRoadmap, setIsReadingRoadmap] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState<boolean>(false);

  const displayName = profile.name && profile.name.trim() ? profile.name.trim() : 'लाभार्थी (Beneficiary)';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const selectedPathway = rankedPaths.find((p) => p.id === selectedPathId) || topPaths[0] || rankedPaths[0];
  const completedCount = [0, 1, 2].filter((i) => doneStages[selectedPathway.id + i]).length;
  const filteredJobs = jobs.filter((j) => jobFilter === 'All' || j.type === jobFilter);
  const totalShortlisted = Object.values(shortlist).filter(Boolean).length;

  const [celebratedStageKey, setCelebratedStageKey] = useState<string | null>(null);

  const toggleWhy = (id: string) => {
    setExpandedWhy((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleStageDone = (key: string) => {
    setDoneStages((prev) => {
      const willBeDone = !prev[key];
      const updated = { ...prev, [key]: willBeDone };
      storageService.saveProgress(updated);

      if (willBeDone) {
        // Play success audio chime and trigger micro-interaction
        speechService.playAudioCue('success');
        setCelebratedStageKey(key);
        onNotify('🎉 बधाई! आपने यह कौशल चरण पूरा कर लिया है! (Stage Completed!)');
        setTimeout(() => setCelebratedStageKey(null), 2500);
      }

      return updated;
    });
  };

  const toggleShortlist = (id: string) => {
    setShortlist((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      storageService.saveShortlist(updated);
      onNotify(updated[id] ? 'Saved to personal shortlist.' : 'Removed from shortlist.');
      return updated;
    });
  };

  const handleReadAloudRoadmap = () => {
    if (isReadingRoadmap) {
      speechService.stopSpeaking();
      setIsReadingRoadmap(false);
      return;
    }

    let textToSpeak = '';
    const loc = profile.location ? profile.location : (currentLang === 'bho' ? 'रउआ इलाका' : 'आपके क्षेत्र');

    if (currentLang === 'bho') {
      textToSpeak = `प्रणाम ${displayName}! जीविका एआई में रउआ स्वागत बा। रउआ पढ़ाई, हुनर अउर ${loc} के हिसाब से रउआ आजीविका रोडमैप बन गइल बा। ` +
        (profile.aiAnalysis ? `एआई विश्लेषण: ${profile.aiAnalysis.summary}। ` : '') +
        `रउआ खातिर सबसे उपयुक्त कौशल बा ${selectedPathway.name}। एह में रउआ मैच स्कोर बा ${selectedPathway.score} प्रतिशत। ई ट्रेनिंग ${selectedPathway.duration} के बा। ` +
        `एकर तीन मुख्य चरण बा: ` +
        `पहिला चरण: ${selectedPathway.stages[0][0]} - ${selectedPathway.stages[0][1]}। ` +
        `दूसर चरण: ${selectedPathway.stages[1][0]} - ${selectedPathway.stages[1][1]}। ` +
        `तीसर चरण: ${selectedPathway.stages[2][0]} - ${selectedPathway.stages[2][1]}। ` +
        (filteredJobs.length > 0 ? `रउआ लगे ${filteredJobs.length} रोजगार के अवसर उपलब्ध बा, जइसे कि ${filteredJobs[0].title}। ` : '') +
        `रउआ नीचे दिहल गइल चरण पूरा क के आपन प्रगति देख सकीं।`;
    } else if (currentLang === 'en') {
      textToSpeak = `Hello ${displayName}! Welcome to JeevikaAI. Based on your education and location in ${loc}, your personalized livelihood roadmap is ready. ` +
        (profile.aiAnalysis ? `AI Analysis: ${profile.aiAnalysis.summary}. ` : '') +
        `Your top recommended pathway is ${selectedPathway.name} with a fit score of ${selectedPathway.score} percent. Training duration is ${selectedPathway.duration}. ` +
        `The three key stages are: ` +
        `Stage 1: ${selectedPathway.stages[0][0]}, ${selectedPathway.stages[0][1]}. ` +
        `Stage 2: ${selectedPathway.stages[1][0]}, ${selectedPathway.stages[1][1]}. ` +
        `Stage 3: ${selectedPathway.stages[2][0]}, ${selectedPathway.stages[2][1]}. ` +
        (filteredJobs.length > 0 ? `There are ${filteredJobs.length} opportunities available nearby, including ${filteredJobs[0].title}. ` : '') +
        `You can complete the stages below to track your real-time progress.`;
    } else {
      textToSpeak = `नमस्ते ${displayName}! जीविका एआई में आपका स्वागत है। आपकी शिक्षा, हुनर और ${loc} के अनुसार आपका व्यक्तिगत आजीविका रोडमैप तैयार है। ` +
        (profile.aiAnalysis ? `एआई विश्लेषण: ${profile.aiAnalysis.summary}। ` : '') +
        `आपके लिए सबसे उपयुक्त कौशल है ${selectedPathway.name}। आपकी योग्यता मैच स्कोर ${selectedPathway.score} प्रतिशत है और यह प्रशिक्षण ${selectedPathway.duration} का है। ` +
        `इसके तीन मुख्य चरण हैं: ` +
        `पहला चरण: ${selectedPathway.stages[0][0]} - ${selectedPathway.stages[0][1]}। ` +
        `दूसरा चरण: ${selectedPathway.stages[1][0]} - ${selectedPathway.stages[1][1]}। ` +
        `तीसरा चरण: ${selectedPathway.stages[2][0]} - ${selectedPathway.stages[2][1]}। ` +
        (filteredJobs.length > 0 ? `आपके लिए पास में ${filteredJobs.length} रोजगार और स्वरोजगार के अवसर उपलब्ध हैं, जैसे ${filteredJobs[0].title}। ` : '') +
        `आप नीचे दिए गए चरणों को पूरा करके अपनी प्रगति दर्ज कर सकते हैं। धन्यवाद!`;
    }

    setIsReadingRoadmap(true);
    speechService.speak(textToSpeak, currentLang, () => {
      setIsReadingRoadmap(false);
    });
  };

  const handleDownload = () => {
    const text = buildSummary(profile, rankedPaths, jobs, selectedPathId, shortlist);
    const fname = `JeevikaAI-Roadmap-${slug(displayName)}.txt`;
    onOpenSummary({
      text,
      fname,
      profile,
      selectedPathway,
      jobs: filteredJobs,
    });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Top Welcome Hero Banner with Integrated Profile Summary */}
      <div className="bg-gradient-to-br from-[#17365D] via-[#1E4373] to-[#245A91] rounded-3xl p-6 sm:p-8 text-white shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-56 h-56 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              {/* User Avatar Circle */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-white flex items-center justify-center font-extrabold text-2xl font-['Bricolage_Grotesque'] flex-shrink-0 shadow-md">
                {displayInitial}
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full text-xs font-bold bg-white/15 text-white backdrop-blur-md border border-white/20">
                  <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
                  <span>व्यक्तिगत आजीविका योजना (Personalized Roadmap)</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-['Bricolage_Grotesque']">
                  नमस्ते, {displayName}! 👋
                </h1>
                <p className="text-xs sm:text-sm text-white/85 max-w-xl leading-relaxed font-['Hind']">
                  आपकी शिक्षा, रुचि और स्थान के आधार पर तैयार की गई आजीविका योजना।
                </p>

                {profile.aiAnalysis && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs text-white/95 flex items-start gap-2 max-w-xl">
                    <Icon name="sparkles" size={16} className="text-[#38BDF8] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-[#38BDF8] mr-1">AI विश्लेषण:</span>
                      <span>{profile.aiAnalysis.summary}</span>
                      {profile.aiAnalysis.topCareerPathway && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-white/20 font-bold text-[10px] text-white">
                            🎯 अनुशंसित क्षेत्र: {profile.aiAnalysis.topCareerPathway}
                          </span>
                          {profile.aiAnalysis.readinessScore && (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200 font-bold text-[10px]">
                              ⚡ तैयारी स्कोर: {profile.aiAnalysis.readinessScore}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Hero Actions */}
            <div className="flex flex-wrap lg:flex-col items-stretch gap-2.5 flex-shrink-0">
              <button
                onClick={handleReadAloudRoadmap}
                className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md ${
                  isReadingRoadmap
                    ? 'bg-[#38BDF8] text-[#17365D]'
                    : 'bg-white text-[#17365D] hover:bg-slate-100'
                }`}
              >
                <Icon name={isReadingRoadmap ? 'volumeX' : 'volume2'} size={18} />
                <span>{isReadingRoadmap ? 'रोकें (Stop)' : 'रोडमैप सुनें (Audio)'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => go('profile')}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Icon name="edit" size={14} />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Icon name="download" size={14} />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Profile Attribute Chips Bar */}
          <div className="pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 font-medium">
                <Icon name="cap" size={14} className="text-[#38BDF8]" />
                <span>शिक्षा: {profile.education || '10वीं पास'}</span>
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 font-medium">
                <Icon name="pin" size={14} className="text-[#38BDF8]" />
                <span>स्थान: {profile.location || 'उत्तर प्रदेश'}</span>
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 font-medium">
                <Icon name="store" size={14} className="text-[#38BDF8]" />
                <span>काम की प्राथमिकता: {profile.workType || 'Self-employment'}</span>
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 font-medium">
                <Icon name="sparkles" size={14} className="text-[#FBBF24]" />
                <span>Top Match: {topPaths[0]?.name} ({topPaths[0]?.score}%)</span>
              </span>
            </div>

            <button
              onClick={() => setShowProfileDetails(!showProfileDetails)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white/90 hover:text-white underline underline-offset-4"
            >
              <span>{showProfileDetails ? 'प्रोफ़ाइल विवरण छिपाएँ' : 'सभी प्रोफ़ाइल विवरण देखें'}</span>
              <Icon name="chev" size={14} className={`transition-transform duration-200 ${showProfileDetails ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Expandable Profile Overview Card */}
          {showProfileDetails && (
            <div className="mt-4 p-5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  वर्तमान कौशल (Skills)
                </div>
                <div className="font-semibold text-white mt-1">
                  {profile.skills || 'सिलाई, प्राथमिक डिजिटल काम'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  रुचि व महत्वाकांक्षा (Interests)
                </div>
                <div className="font-semibold text-white mt-1">
                  {profile.interests || 'डिजिटल सेवाएँ, स्वरोजगार'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  वर्तमान कार्य (Occupation)
                </div>
                <div className="font-semibold text-white mt-1">
                  {profile.occupation || 'गृहकार्य व हस्तशिल्प'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  यात्रा सीमा (Mobility)
                </div>
                <div className="font-semibold text-white mt-1">
                  {profile.mobility || 'Nearby only (within ~10 km)'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Highlights Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white border border-[#DCE3EA] shadow-xs flex items-center gap-4">
          <Ring value={topPaths[0]?.score || 85} size={56} />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#287D73]">
              सर्वश्रेष्ठ करियर मैच (Top Match)
            </div>
            <div className="text-base font-bold text-[#17365D]">
              {topPaths[0]?.name}
            </div>
            <div className="text-xs text-[#5F6B76]">
              NSQF Level {topPaths[0]?.nsqf} · {topPaths[0]?.duration}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#DCE3EA] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#287D73]/15 text-[#287D73] flex items-center justify-center font-bold">
            <Icon name="route" size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#287D73]">
              रोडमैप प्रगति (Progress)
            </div>
            <div className="text-base font-bold text-[#17365D]">
              {completedCount} of 3 Stages Done
            </div>
            <div className="w-full bg-[#F5F7FA] h-2 rounded-full overflow-hidden mt-1.5 border border-[#DCE3EA]">
              <div
                className="bg-[#287D73] h-full rounded-full transition-all duration-300"
                style={{ width: `${(completedCount / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#DCE3EA] shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#245A91]/15 text-[#245A91] flex items-center justify-center font-bold">
            <Icon name="briefcase" size={24} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#245A91]">
              पास के अवसर (Nearby Jobs)
            </div>
            <div className="text-base font-bold text-[#17365D]">
              {filteredJobs.length} Available Listings
            </div>
            <div className="text-xs text-[#5F6B76]">
              {profile.mobility || 'Nearby'} Range
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Suggested Skill Pathways, Learning Roadmap, Opportunities */}
      <div className="space-y-8">
        {/* Section 1: Suggested Skill Pathways */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-xs uppercase font-extrabold tracking-widest text-[#245A91] mb-1">
                Transparent Matching
              </div>
              <h2 className="text-2xl font-extrabold text-[#17365D]">
                Suggested Skill Pathways · अनुशंसित कौशल मार्ग
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => go('assessment')}
                className="px-3.5 py-1.5 rounded-xl bg-[#245A91] text-white text-xs font-bold hover:bg-[#17365D] transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Icon name="mic" size={14} />
                <span>पुनः आवाज़ मूल्यांकन (Retake Assessment)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topPaths.map((p, index) => (
              <article
                key={p.id}
                className="bg-white border border-[#DCE3EA] rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#245A91] transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-none ${
                        index === 0
                          ? 'bg-[#287D73]/15 text-[#287D73]'
                          : index === 1
                          ? 'bg-[#245A91]/15 text-[#245A91]'
                          : 'bg-[#17365D]/10 text-[#17365D]'
                      }`}
                    >
                      <Icon name={p.icon} size={24} />
                    </div>
                    <Ring value={p.score} />
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#287D73]">
                      Recommendation #{index + 1}
                    </div>
                    <h3 className="text-lg font-bold text-[#17365D] leading-tight mt-0.5">
                      {p.name}
                    </h3>
                    <div className="text-xs text-[#5F6B76] mt-0.5 font-['Hind']">
                      {p.hi} · {p.role}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F5F7FA] text-[#5F6B76] border border-[#DCE3EA] flex items-center gap-1 font-medium">
                      <Icon name="clock" size={12} /> {p.duration}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E3F1FA] text-[#245A91] flex items-center gap-1 font-semibold">
                      <Icon name="layers" size={12} /> NSQF Level {p.nsqf}
                    </span>
                  </div>

                  <p className="text-xs text-[#202B36] font-medium leading-relaxed">
                    {p.fit}
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-[#DCE3EA]">
                  <button
                    onClick={() => toggleWhy(p.id)}
                    className="w-full py-1.5 px-3 rounded-xl border border-[#DCE3EA] text-xs font-bold text-[#17365D] hover:bg-slate-50 transition-colors flex items-center justify-between"
                    aria-expanded={Boolean(expandedWhy[p.id])}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon name="bulb" size={14} />
                      Why this recommendation?
                    </span>
                    <Icon
                      name="chev"
                      size={12}
                      className={`transition-transform duration-200 ${
                        expandedWhy[p.id] ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedPathId(p.id);
                      scrollToSection('roadmap-section');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#245A91] text-white text-xs font-bold hover:bg-[#17365D] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Icon name="route" size={14} />
                    View Learning Roadmap
                  </button>

                  {/* Factor Breakdown Accordion */}
                  {expandedWhy[p.id] && (
                    <div className="mt-3 pt-3 border-t border-dashed border-[#DCE3EA] space-y-2 bg-[#F5F7FA] p-3 rounded-2xl">
                      <div className="text-[11px] font-bold text-[#17365D]">
                        Scoring Breakdown (Capped: {p.score}/100)
                      </div>
                      <div className="space-y-1.5">
                        {p.factors.map((factor) => (
                          <div key={factor.k} className="text-[11px] space-y-0.5">
                            <div className="flex justify-between items-center font-semibold">
                              <span>{factor.label}</span>
                              <span className="font-bold tabular-nums text-[#287D73]">
                                +{factor.pts} pts
                              </span>
                            </div>
                            <p className="text-[10px] text-[#5F6B76]">
                              {factor.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Section 2: Interactive Learning Roadmap */}
        <section
          id="roadmap-section"
          className="bg-white border border-[#DCE3EA] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 scroll-mt-24"
        >
          <div>
            <div className="text-xs uppercase font-extrabold tracking-widest text-[#245A91] mb-1">
              Structured Steps
            </div>
            <h2 className="text-2xl font-extrabold text-[#17365D]">
              Your Learning Roadmap · चरणबद्ध रोडमैप
            </h2>
            <p className="text-xs sm:text-sm text-[#5F6B76] mt-1">
              Three progressive learning stages for your chosen pathway. Mark stages as done to track your milestones.
            </p>
          </div>

          {/* Pathway Selector Tabs */}
          <div className="flex flex-wrap gap-2">
            {topPaths.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPathId(p.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedPathId === p.id
                    ? 'bg-[#17365D] text-white shadow-xs'
                    : 'bg-[#F5F7FA] text-[#5F6B76] border border-[#DCE3EA] hover:bg-slate-200'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Stages Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectedPathway.stages.map((stage, idx) => {
              const stageKey = selectedPathway.id + idx;
              const isDone = Boolean(doneStages[stageKey]);

              return (
                <div
                  key={stageKey}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 relative overflow-hidden ${
                    isDone
                      ? 'border-[#287D73] bg-[#287D73]/5'
                      : 'border-[#DCE3EA] bg-[#F5F7FA]'
                  }`}
                >
                  {celebratedStageKey === stageKey && (
                    <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center bg-[#287D73]/15 backdrop-blur-[1px] animate-fade-in">
                      <div className="bg-white text-[#287D73] px-3.5 py-2 rounded-2xl shadow-xl border border-[#287D73]/30 font-extrabold text-xs flex items-center gap-1.5 animate-bounce">
                        <Icon name="sparkles" size={16} className="text-[#D9822B]" />
                        <span>🎉 चरण पूर्ण! (Stage Completed)</span>
                        <Icon name="check" size={16} className="text-[#287D73]" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#287D73]">
                      Stage {idx + 1} · {STAGE_TITLES[idx]}
                    </div>
                    <h4 className="text-base font-bold text-[#17365D] leading-snug">
                      {stage[0]}
                    </h4>
                    <p className="text-xs text-[#5F6B76] leading-relaxed">
                      {stage[1]}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[#DCE3EA]">
                    <span className="text-[11px] font-bold text-[#17365D]">
                      {stage[2]}
                    </span>
                    <button
                      onClick={() => toggleStageDone(stageKey)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        isDone
                          ? 'bg-[#287D73] text-white'
                          : 'bg-white border border-[#DCE3EA] text-[#5F6B76] hover:border-[#287D73]'
                      }`}
                    >
                      <Icon name="check" size={14} />
                      {isDone ? 'Completed' : 'Mark done'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Roadmap Progress Bar */}
          <div className="flex items-center gap-3 pt-2 text-xs font-bold text-[#5F6B76]">
            <span>{completedCount} of 3 stages completed</span>
            <div className="flex-1 bg-[#F5F7FA] border border-[#DCE3EA] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#287D73] h-full rounded-full transition-all duration-300"
                style={{ width: `${(completedCount / 3) * 100}%` }}
              />
            </div>
          </div>
        </section>

        {/* Section 3: Hyperlocal Opportunities */}
        <section
          id="opportunities-section"
          className="space-y-4 scroll-mt-24"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase font-extrabold tracking-widest text-[#245A91] mb-1">
                Local Openings
              </div>
              <h2 className="text-2xl font-extrabold text-[#17365D]">
                Matched Livelihood Opportunities · पास के रोजगार अवसर
              </h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-[#F5F7FA] p-1 rounded-xl border border-[#DCE3EA] text-xs font-bold">
              {(['All', 'Job', 'Self-employment'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setJobFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    jobFilter === filter
                      ? 'bg-white text-[#17365D] shadow-xs'
                      : 'text-[#5F6B76] hover:text-[#202B36]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Opportunities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredJobs.map((job) => {
              const isShortlisted = Boolean(shortlist[job.id]);

              return (
                <article
                  key={job.id}
                  className={`bg-white border rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-[#245A91] transition-all ${
                    job.inRange
                      ? 'border-[#DCE3EA]'
                      : 'border-dashed border-[#DCE3EA] opacity-80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            job.type === 'Job'
                              ? 'bg-[#E3F1FA] text-[#245A91]'
                              : 'bg-[#287D73]/15 text-[#287D73]'
                          }`}
                        >
                          {job.type}
                        </span>
                        {job.verified && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#287D73]/15 text-[#287D73] flex items-center gap-1">
                            <Icon name="check" size={10} /> Verified
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-[#17365D] leading-snug">
                        {job.title}
                      </h4>
                      <div className="text-xs text-[#5F6B76] mt-0.5">
                        {job.org}
                      </div>
                    </div>

                    <div className="p-3 bg-[#F5F7FA] rounded-2xl border border-[#DCE3EA] space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-[#17365D] font-bold">
                        <Icon name="pin" size={14} />
                        <span>{job.loc} · {kmLabel(job)}</span>
                      </div>
                      <div className="font-bold text-[#287D73]">
                        {job.pay}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#DCE3EA]">
                    <button
                      onClick={() => onSelectDetail(job)}
                      className="text-xs font-bold text-[#245A91] hover:underline"
                    >
                      Details →
                    </button>

                    <button
                      onClick={() => toggleShortlist(job.id)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isShortlisted
                          ? 'bg-[#FFF4DB] text-[#D9822B] border border-[#EBCB7A]'
                          : 'bg-white border border-[#DCE3EA] text-[#5F6B76] hover:border-[#245A91]'
                      }`}
                    >
                      <Icon name="star" size={14} className={isShortlisted ? 'fill-[#D9822B]' : ''} />
                      {isShortlisted ? 'Saved' : 'Save'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
};
