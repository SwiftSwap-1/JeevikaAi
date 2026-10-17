import React, { useState, useEffect, useRef } from 'react';
import { LogoMark } from './Logo';
import { Icon } from './Icons';
import { SupportedLanguage, AppView, BeneficiaryProfile } from '../types';
import { speechService, SpeechRecognitionResultWrapper } from '../services/speechService';

interface FloatingVoiceAssistantProps {
  currentView: AppView;
  currentLang: SupportedLanguage;
  profile: BeneficiaryProfile | null;
  go: (view: AppView, sectionId?: string) => void;
  onNotify: (msg: string) => void;
  onUpdateProfile?: (updated: BeneficiaryProfile) => void;
}

export const FloatingVoiceAssistant: React.FC<FloatingVoiceAssistantProps> = ({
  currentView,
  currentLang,
  profile,
  go,
  onNotify,
  onUpdateProfile,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [aiMessage, setAiMessage] = useState<string>(
    'नमस्ते! मैं आपकी क्या सहायता कर सकता हूँ? बोलिए, मैं सुन रहा हूँ।'
  );
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    {
      sender: 'ai',
      text: 'नमस्ते! बोलिए, मैं सुन रहा हूँ। उदाहरण: "मुझे नौकरी दिखाओ", "प्रशिक्षण केंद्र कहाँ हैं?", या "मेरा रोडमैप खोलो"'
    }
  ]);
  const [textInput, setTextInput] = useState<string>('');
  const [showApiModal, setShowApiModal] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef<boolean>(false);

  // Draggable floating icon position state
  const [customPosition, setCustomPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('jeevika_bot_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragInfoRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  });

  const buttonContainerRef = useRef<HTMLDivElement>(null);

  // Re-clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      setCustomPosition((prev) => {
        if (!prev) return null;
        const clampedX = Math.max(12, Math.min(window.innerWidth - 68, prev.x));
        const clampedY = Math.max(64, Math.min(window.innerHeight - 80, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    const rect = buttonContainerRef.current?.getBoundingClientRect();
    const currX = rect ? rect.left : (customPosition?.x || (window.innerWidth - 72));
    const currY = rect ? rect.top : (customPosition?.y || (window.innerHeight - 100));

    dragInfoRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: currX,
      initialY: currY,
      hasMoved: false,
    };
  };

  const onDragMove = (clientX: number, clientY: number) => {
    const dx = clientX - dragInfoRef.current.startX;
    const dy = clientY - dragInfoRef.current.startY;

    if (!dragInfoRef.current.hasMoved && Math.hypot(dx, dy) > 5) {
      dragInfoRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragInfoRef.current.hasMoved) {
      const nextX = Math.max(10, Math.min(window.innerWidth - 68, dragInfoRef.current.initialX + dx));
      const nextY = Math.max(60, Math.min(window.innerHeight - 84, dragInfoRef.current.initialY + dy));
      setCustomPosition({ x: nextX, y: nextY });
    }
  };

  const endDrag = () => {
    if (dragInfoRef.current.hasMoved) {
      setTimeout(() => {
        setIsDragging(false);
      }, 60);
      if (customPosition) {
        try {
          localStorage.setItem('jeevika_bot_pos', JSON.stringify(customPosition));
        } catch {
          // Ignore
        }
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      onDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    endDrag();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startDrag(e.clientX, e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      onDragMove(moveEvent.clientX, moveEvent.clientY);
    };

    const onMouseUp = () => {
      endDrag();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleClickTrigger = () => {
    if (dragInfoRef.current.hasMoved) {
      return;
    }
    handleToggleOpen();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, liveTranscript, aiMessage]);

  // Teardown speech on unmount
  useEffect(() => {
    return () => {
      speechService.stopListening();
      speechService.stopSpeaking();
    };
  }, []);

  const handleStartListening = () => {
    if (isListening) {
      speechService.stopListening();
      setIsListening(false);
      return;
    }

    speechService.stopSpeaking();
    setIsSpeaking(false);
    setIsListening(true);
    setLiveTranscript('');

    speechService.startListening(
      currentLang,
      (result: SpeechRecognitionResultWrapper) => {
        setIsSpeaking(false); // Gracefully pause AI output state on user speech
        setLiveTranscript(result.transcript);
        if (result.isFinal && result.transcript.trim()) {
          processUserQuery(result.transcript.trim());
        }
      },
      (errorMsg: string) => {
        setIsListening(false);
        setIsSpeaking(false);
        setAiMessage(`माफ़ कीजिए: ${errorMsg}`);
      },
      () => {
        setIsListening(false);
      }
    );
  };

  const handleToggleOpen = async () => {
    if (!isOpen) {
      setIsOpen(true);
      // Proactively prompt browser for microphone permission
      await speechService.requestMicrophonePermission();

      // Auto-greet aloud and immediately start listening for seamless voice interaction
      const greeting = currentLang === 'bho'
        ? 'नमस्ते! का पूछल चाहत बानी? बोलीं, हम सुनत बानी।'
        : currentLang === 'en'
        ? 'Hello! What would you like to ask or do? Speak now, I am listening.'
        : 'नमस्ते! आप क्या पूछना चाहते हैं? बोलिए, मैं सुन रहा हूँ।';

      setAiMessage(greeting);

      // Start listening immediately so user can speak anytime without waiting
      handleStartListening();

      setIsSpeaking(true);
      speechService.speak(greeting, currentLang, () => {
        setIsSpeaking(false);
      });
    } else {
      setIsOpen(false);
      speechService.stopListening();
      speechService.stopSpeaking();
      setIsListening(false);
      setIsSpeaking(false);
    }
  };

  const processUserQuery = async (queryText: string) => {
    if (processingRef.current || !queryText.trim()) return;
    processingRef.current = true;

    speechService.stopListening();
    setIsListening(false);

    // Add user query to chat history
    setChatHistory((prev) => [...prev, { sender: 'user', text: queryText }]);
    setLiveTranscript('');

    try {
      const workerUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL || 'https://jeevikaai.ayushgupt640.workers.dev/';
      let response;
      try {
        response = await fetch(workerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: queryText,
            language: currentLang,
            currentView,
            userProfile: profile || {}
          })
        });
        if (!response.ok) throw new Error('Worker non-200');
      } catch {
        // Fallback to local server proxy endpoint
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: queryText,
            language: currentLang,
            currentView,
            userProfile: profile || {}
          })
        });
      }

      if (response.ok) {
        const data = await response.json();
        const replyText = data.reply || 'जी, मैं आपकी सहायता के लिए तैयार हूँ।';

        setAiMessage(replyText);
        setChatHistory((prev) => [...prev, { sender: 'ai', text: replyText }]);

        // Speak response aloud
        setIsSpeaking(true);
        speechService.speak(replyText, currentLang, () => {
          setIsSpeaking(false);
        });

        // Apply profile updates via voice if extracted
        if (data.profileUpdates && profile && onUpdateProfile) {
          const updatedProfile = { ...profile, ...data.profileUpdates };
          onUpdateProfile(updatedProfile);
        }

        // Direct silent navigation & card pulse highlight
        if (data.targetView) {
          go(data.targetView as AppView, data.actionHighlight);

          // Apply a brief pulse glow highlight on the target card/section
          setTimeout(() => {
            const highlightId = data.actionHighlight || `${data.targetView}-section`;
            const el = document.getElementById(highlightId);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-4', 'ring-[#287D73]', 'animate-pulse');
              setTimeout(() => {
                el.classList.remove('ring-4', 'ring-[#287D73]', 'animate-pulse');
              }, 3000);
            }
          }, 350);
        }
      } else {
        throw new Error('Server returned non-200 status');
      }
    } catch {
      const fallbackReply = 'जी, आपकी बात सुन ली गई है। आप नीचे दिए गए नेविगेशन से नौकरी, प्रशिक्षण केंद्र या अपना प्रोफाइल देख सकते हैं।';
      setAiMessage(fallbackReply);
      setChatHistory((prev) => [...prev, { sender: 'ai', text: fallbackReply }]);
      setIsSpeaking(true);
      speechService.speak(fallbackReply, currentLang, () => {
        setIsSpeaking(false);
      });
    } finally {
      processingRef.current = false;
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const q = textInput.trim();
    setTextInput('');
    processUserQuery(q);
  };

  return (
    <>
      {/* Floating AI Action Notice Banner if Navigating */}
      {actionNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#17365D] text-white px-4 py-2 rounded-2xl shadow-xl border border-white/20 text-xs font-bold flex items-center gap-2 animate-bounce">
          <Icon name="sparkles" size={16} className="text-[#38BDF8]" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Floating Assistant Trigger Button - Draggable and repositionable anywhere on screen */}
      <div
        ref={buttonContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={
          customPosition
            ? {
                left: `${customPosition.x}px`,
                top: `${customPosition.y}px`,
                right: 'auto',
                bottom: 'auto',
                touchAction: 'none',
              }
            : {
                touchAction: 'none',
              }
        }
        className={`fixed z-50 select-none ${
          !customPosition ? 'bottom-20 md:bottom-8 right-4 sm:right-6' : ''
        } ${isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}`}
      >
        <button
          type="button"
          onClick={handleClickTrigger}
          className="relative group p-3.5 sm:p-4 rounded-full bg-gradient-to-r from-[#17365D] via-[#245A91] to-[#287D73] text-white shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200 flex items-center justify-center border-2 border-white ring-2 ring-black/10"
          aria-label="Open AI Voice Assistant"
          title="JeevikaAI Voice Assistant (टैप करें या ड्रैग करके कहीं भी रखें)"
        >
          {/* Animated Glow Rings */}
          <span className="absolute -inset-1 rounded-full bg-cyan-400/30 animate-ping pointer-events-none" />
          <LogoMark size={28} />

          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#D9822B] text-white text-[9px] font-extrabold shadow-sm border border-white">
            AI
          </span>
        </button>
      </div>

      {/* Floating Voice Assistant Panel / Modal */}
      {isOpen && (
        <div
          className={`fixed z-50 w-[calc(100vw-1.5rem)] sm:w-96 max-h-[80vh] sm:max-h-[580px] bg-white border border-[#DCE3EA] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in ${
            customPosition && customPosition.x < 240 ? 'left-3 sm:left-6' : 'right-3 sm:right-6'
          } ${customPosition && customPosition.y < 350 ? 'top-16' : 'bottom-20 md:bottom-24'}`}
        >
          {/* Panel Header */}
          <div className="p-4 bg-gradient-to-r from-[#17365D] to-[#245A91] text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                <LogoMark size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-none font-['Bricolage_Grotesque']">
                  JeevikaAI Voice Assistant
                </h3>
                <span className="text-[10px] text-white/80 font-medium">
                  Voice &amp; Nav Assistant
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowApiModal(true)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 transition-colors"
                title="Cloudflare Worker & API Key Setup"
              >
                <Icon name="info" size={13} />
                <span className="hidden xs:inline">API Info</span>
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  speechService.stopListening();
                  speechService.stopSpeaking();
                  setIsListening(false);
                  setIsSpeaking(false);
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          </div>

          {/* Voice Spectrum / Waveform Animation Indicator */}
          <div className="p-3 bg-[#F5F7FA] border-b border-[#DCE3EA] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {isListening ? (
                <span className="flex items-center gap-1 text-[#287D73] font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-[#287D73]" />
                  <span>सुन रहा हूँ... (Listening)</span>
                </span>
              ) : isSpeaking ? (
                <span className="flex items-center gap-1 text-[#245A91] font-bold">
                  <Icon name="volume2" size={14} className="animate-pulse" />
                  <span>बोल रहा हूँ... (Speaking)</span>
                </span>
              ) : (
                <span className="text-[#5F6B76] font-medium">
                  माइक चालू करें (Tap mic to speak)
                </span>
              )}
            </div>

            {/* Audio Wave Bars */}
            {(isListening || isSpeaking) && (
              <div className="flex items-center gap-1 h-4">
                <span className="w-1 bg-[#287D73] rounded-full animate-bounce [animation-delay:0.1s] h-3" />
                <span className="w-1 bg-[#245A91] rounded-full animate-bounce [animation-delay:0.2s] h-4" />
                <span className="w-1 bg-[#D9822B] rounded-full animate-bounce [animation-delay:0.3s] h-2" />
                <span className="w-1 bg-[#287D73] rounded-full animate-bounce [animation-delay:0.4s] h-4" />
              </div>
            )}
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-[#245A91] text-white rounded-br-none font-medium shadow-xs'
                      : 'bg-[#F5F7FA] text-[#17365D] border border-[#DCE3EA] rounded-bl-none font-medium leading-relaxed'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Live Auto-Filling Speech Transcript */}
            {liveTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[85%] p-3 rounded-2xl bg-[#E3F1FA] text-[#245A91] border border-[#245A91]/30 rounded-br-none font-semibold animate-pulse">
                  <span className="text-[10px] uppercase tracking-wider block font-bold text-[#245A91] mb-0.5">
                    Recording Live Voice...
                  </span>
                  {liveTranscript}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice Record & Keyboard Input Footer */}
          <div className="p-3 bg-white border-t border-[#DCE3EA] space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartListening}
                className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 ${
                  isListening
                    ? 'bg-[#9E2A2B] text-white animate-pulse'
                    : 'bg-gradient-to-r from-[#245A91] to-[#17365D] text-white hover:opacity-95'
                }`}
              >
                <Icon name="mic" size={16} />
                <span>
                  {isListening ? 'सुन रहे हैं... (Tap to stop)' : 'बोलकर पूछें (Tap to Speak)'}
                </span>
              </button>
            </div>

            {/* Keyboard fallback form */}
            <form onSubmit={handleTextSubmit} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="या यहाँ टाइप करके पूछें..."
                className="flex-1 p-2.5 rounded-xl border border-[#DCE3EA] text-xs focus:border-[#245A91] focus:outline-none text-[#17365D]"
              />
              <button
                type="submit"
                className="px-3.5 py-2.5 rounded-xl bg-[#17365D] hover:bg-[#245A91] text-white text-xs font-bold transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Cloudflare Worker & API Key Instructions Modal */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto border border-[#DCE3EA] text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3EA]">
              <div className="flex items-center gap-2">
                <LogoMark size={24} />
                <h3 className="font-extrabold text-base text-[#17365D]">
                  API Key &amp; Cloudflare Worker Proxy Setup
                </h3>
              </div>
              <button
                onClick={() => setShowApiModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-[#5F6B76]"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="space-y-3 text-[#202B36] leading-relaxed">
              <p>
                <strong>कौन सा API लगाना है? (Which API to use?):</strong>
              </p>
              <div className="p-3 bg-[#F5F7FA] rounded-xl border border-[#DCE3EA] font-semibold text-[#17365D]">
                🔑 <strong>Google Gemini API Key</strong> (`GEMINI_API_KEY`) from Google AI Studio.
              </div>

              <p>
                <strong>API Key Hide करके Cloudflare Worker में कैसे डालें?</strong>
              </p>
              <ol className="list-decimal pl-4 space-y-1.5 font-medium text-[#5F6B76]">
                <li>Google AI Studio से `GEMINI_API_KEY` लें।</li>
                <li>Cloudflare Workers Dashboard खोलें और नया Worker बनाएँ।</li>
                <li>Cloudflare Worker Secrets में `GEMINI_API_KEY` वेरिएबल स्टोर करें।</li>
                <li>नीचे दिया गया Proxy Code worker में पेस्ट करें:</li>
              </ol>

              {/* Code Snippet Box */}
              <div className="bg-[#17365D] text-white p-3 rounded-xl overflow-x-auto font-mono text-[11px] leading-snug">
                <pre>{`export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 455 });
    }
    const { message, language } = await request.json();
    const response = await fetch(
      \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${env.GEMINI_API_KEY}\`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }]
        })
      }
    );
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};`}</pre>
              </div>

              <p className="text-[11px] text-[#5F6B76]">
                आपकी App स्वतः बैकएंड Proxy (`/api/chat`) से कॉल करती है, जिससे API key कभी ब्राउज़र/क्लाइंट-साइड पर एक्सपोज़ नहीं होती।
              </p>
            </div>

            <div className="pt-2 flex justify-end border-t border-[#DCE3EA]">
              <button
                onClick={() => setShowApiModal(false)}
                className="px-4 py-2 rounded-xl bg-[#17365D] text-white font-bold text-xs hover:bg-[#245A91]"
              >
                समझ गया (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
