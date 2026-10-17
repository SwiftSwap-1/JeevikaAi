import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString()
  });
});

// Helper for timeout
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('AI extraction timeout')), timeoutMs)
    ),
  ]);
}

// API Route: AI Conversational Profile Extraction & Guidance
app.post('/api/extract-profile', async (req: Request, res: Response) => {
  try {
    const { message, language = 'hi', currentStep = 'general', existingProfile = {}, stepQuestion = '' } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        fallback: true,
        message: 'GEMINI_API_KEY not configured, utilizing Indic client rule-engine.'
      });
    }

    const ai = new GoogleGenAI();

    const systemPrompt = `You are JeevikaAI (जीविका एआई), an empathetic and natural livelihood & skill guide for rural and semi-urban Indian youth and workers.
The user speaks in Hindi, Bhojpuri, Hinglish, or English.
Current Context:
- Step Key: "${currentStep}"
- Current Question Asked: "${stepQuestion}"
- Preferred Language: "${language}" (hi = Hindi, bho = Bhojpuri, hin = Hinglish, en = English)
- Current Profile Data So Far: ${JSON.stringify(existingProfile)}
- User Just Said: "${message}"

Your Task:
1. Interpret intent and extract the clean, relevant value for this field.
2. Standardize choice options:
   - For 'education': Map to one of ["Below 8th class", "8th class pass", "10th pass (Secondary)", "12th pass (Higher Secondary)", "Graduate", "ITI / Diploma"].
   - For 'workType': Map to ["Job", "Self-employment", "Either"].
   - For 'mobility': Map to ["Nearby only (within ~10 km)", "Within my district", "Anywhere in the state"].
3. Determine confidence (0.0 to 1.0). If the answer is completely off-topic or ambiguous, confidence should be below 0.6 and needsClarification should be true.
4. For intro step ("intro"): If user said "haan", "ji", "yes", "shuru karein", "theek ba", recognize intent as "start_affirmative".
5. Produce a warm, encouraging, short 1-sentence acknowledgment in the user's spoken dialect (e.g. Hindi, Bhojpuri, or English).
6. Return ONLY a valid JSON object matching this schema without any markdown formatting around it:
{
  "recognizedIntent": "start_affirmative" | "start_negative" | "education" | "skills" | "interests" | "occupation" | "location" | "workType" | "mobility" | "unclear",
  "cleanValue": "Normalized string for this field",
  "confidence": 0.95,
  "needsClarification": false,
  "clarificationQuestion": "Friendly clarification if confidence is low, else empty string",
  "acknowledgment": "Short 1-sentence natural warm acknowledgment in the user's dialect (e.g. 'Achha, baarahvi pass. Bahut badhiya!')",
  "suggestedNextTopic": "Next field"
}`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const response = await withTimeout(generatePromise, 8500);

    let rawText = response.text || '{}';
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(rawText);
    return res.json({
      fallback: false,
      result: parsed
    });
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || error?.message?.includes('Quota exceeded');
    if (!isRateLimit) {
      console.warn('Gemini extraction fallback triggered:', error.message);
    }
    return res.json({
      fallback: true,
      error: error.message || 'Internal error processing speech input'
    });
  }
});

// API Route: Generate Readback Summary Aloud
app.post('/api/generate-readback', async (req: Request, res: Response) => {
  try {
    const { profile, language = 'hi' } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({ fallback: true });
    }

    const ai = new GoogleGenAI();
    const prompt = `Generate a concise, natural, warm 2-sentence verbal summary read-back for this beneficiary in ${language === 'bho' ? 'Bhojpuri' : language === 'en' ? 'English' : 'simple conversational Hindi'}:
Profile:
- Name: ${profile?.name || 'Not specified'}
- Education: ${profile?.education || 'Not specified'}
- Skills: ${profile?.skills || 'Not specified'}
- Interests: ${profile?.interests || 'Not specified'}
- Location: ${profile?.location || 'Not specified'}
- Work Preference: ${profile?.workType || 'Not specified'}

Format requirements:
- Natural spoken cadence suitable for Text-to-Speech (TTS).
- End with asking if this information is correct so we can generate their livelihood roadmap.
- Return ONLY plain text with no quotes, markdown, or JSON.`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const response = await withTimeout(generatePromise, 8500);

    return res.json({
      fallback: false,
      readbackText: response.text?.trim()
    });
  } catch {
    return res.json({ fallback: true });
  }
});

// API Route: AI Profile Analysis & Career Roadmap Synthesis
app.post('/api/analyze-profile', async (req: Request, res: Response) => {
  try {
    const { profile, language = 'hi' } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        fallback: true,
        analysis: {
          summary: 'प्रोफ़ाइल का विश्लेषण सफलतापूर्वक पूरा हुआ। आपकी योग्यता और प्राथमिकताओं के अनुसार रोडमैप तैयार है।',
          topCareerPathway: profile?.interests?.toLowerCase().includes('digital') ? 'Digital Services' : 'Local Livelihood Services',
          readinessScore: 88,
          keyStrengths: [profile?.skills || 'बुनियादी कौशल', 'स्थानीय उपलब्धता']
        }
      });
    }

    const ai = new GoogleGenAI();
    const prompt = `Analyze this Indian rural/semi-urban citizen profile for NSQF livelihood alignment:
Profile:
- Name: ${profile?.name || 'Beneficiary'}
- Education: ${profile?.education || 'Not specified'}
- Existing Skills: ${profile?.skills || 'Not specified'}
- Interests: ${profile?.interests || 'Not specified'}
- Occupation: ${profile?.occupation || 'None'}
- Location: ${profile?.location || 'Rural/Semi-urban area'}
- Work Preference: ${profile?.workType || 'Job'}
- Mobility: ${profile?.mobility || 'Nearby'}

Language: ${language === 'bho' ? 'Bhojpuri' : language === 'en' ? 'English' : 'Hindi'}

Return strictly JSON with no markdown formatting:
{
  "summary": "1-2 sentence warm encouraging summary in the requested language",
  "topCareerPathway": "Best matching pathway e.g. Digital Services, Retail Operations, Tailoring & Crafts, Solar Installation",
  "readinessScore": 85,
  "keyStrengths": ["Strength 1", "Strength 2"]
}`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const response = await withTimeout(generatePromise, 8500);
    let rawText = response.text || '{}';
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(rawText);

    return res.json({
      fallback: false,
      analysis: parsed
    });
  } catch {
    return res.json({
      fallback: true,
      analysis: {
        summary: 'प्रोफ़ाइल का विश्लेषण सफलतापूर्वक पूरा हुआ। आपका व्यक्तिगत रोडमैप तैयार है।',
        topCareerPathway: 'Digital & Local Livelihood Services',
        readinessScore: 85,
        keyStrengths: ['कौशल रुचि', 'स्थानीय रोजगार तत्परता']
      }
    });
  }
});

// API Route: Floating Voice AI Assistant & Site Navigation Proxy
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, language = 'hi', currentView = 'home', userProfile = {} } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const lower = message.toLowerCase();
      let navTarget: string | null = null;
      let highlight: string | null = null;
      let reply = 'नमस्ते! मैं जीविका एआई वॉइस असिस्टेंट हूँ। आप मुझसे नौकरी, रोडमैप, या कौशल कार्ड पढ़ने के लिए कह सकते हैं।';

      // 1. Creator query
      if (lower.includes('banaya') || lower.includes('created') || lower.includes('maker') || lower.includes('developer') || lower.includes('किसने बनाया') || lower.includes('कोन बनइले')) {
        reply = 'मुझे JeevikaAI Organization (जीविका एआई आर्गेनाइजेशन) द्वारा बनाया गया है ताकि हर नागरिक अपनी भाषा में आजीविका और कौशल की सही दिशा पा सके।';
      }
      // 2. Roadmap Card reading
      else if (lower.includes('roadmap') || lower.includes('रोडमैप') || lower.includes('डैशबोर्ड')) {
        navTarget = 'dashboard';
        highlight = 'roadmap-section';
        if (lower.includes('padh') || lower.includes('card') || lower.includes('कार्ड') || lower.includes('batao') || lower.includes('read') || lower.includes('step')) {
          reply = 'आजीविका रोडमैप कार्ड: आपके लिए डिजिटल सेवाएँ और स्थानीय रोजगार सबसे उपयुक्त मार्ग है। इसमें 3 चरण हैं: 1. कंप्यूटर व फोन की बुनियादी समझ, 2. ऑनलाइन सेवाएँ व बिलिंग का अभ्यास, 3. नजदीकी सेवा काउंटर या जॉब के लिए आवेदन। आप ₹8,000 से ₹15,000 प्रति माह कमा सकते हैं।';
        } else {
          reply = 'जी, आपका व्यक्तिगत आजीविका रोडमैप डैशबोर्ड खोला जा रहा है।';
        }
      }
      // 3. Job / Naukari Card reading
      else if (lower.includes('job') || lower.includes('kaam') || lower.includes('नौकरी') || lower.includes('रोजगार') || lower.includes('naukri')) {
        navTarget = 'opportunities';
        highlight = 'opportunities-section';
        if (lower.includes('padh') || lower.includes('card') || lower.includes('कार्ड') || lower.includes('batao') || lower.includes('read') || lower.includes('first') || lower.includes('salary') || lower.includes('solar')) {
          reply = 'नौकरी कार्ड विवरण: 1. डिजिटल सर्विस असिस्टेंट (CSC केंद्र) - वेतन ₹8,000 से ₹12,000, 10वीं पास आवश्यक। 2. सोलर इंस्टॉलेशन हेल्पर - वेतन ₹9,000 से ₹14,000। 3. रिटेल सेल्स एसोसिएट - वेतन ₹7,000 से ₹10,000। रोजगार सूची खोली जा रही है।';
        } else {
          reply = 'जी, आपके नजदीकी रोजगार और नौकरी के अवसर खोले जा रहे हैं।';
        }
      }
      // 4. Training Card reading
      else if (lower.includes('train') || lower.includes('center') || lower.includes('प्रशिक्षण') || lower.includes('केंद्र') || lower.includes('pmkvy') || lower.includes('rseti')) {
        navTarget = 'training';
        if (lower.includes('padh') || lower.includes('card') || lower.includes('कार्ड') || lower.includes('batao') || lower.includes('read')) {
          reply = 'कौशल प्रशिक्षण केंद्र कार्ड: 1. PMKVY डिजिटल साक्षरता व डाटा एंट्री केंद्र, महराजगंज - निःशुल्क ट्रेनिंग व सरकारी वजीफा। 2. RSETI सिलाई मशीन व स्वरोजगार केंद्र, गोरखपुर - फ्री आवासीय कोर्स व टूलकिट। प्रशिक्षण केंद्र खोले जा रहे हैं।';
        } else {
          reply = 'आपके पास के PMKVY और RSETI कौशल प्रशिक्षण केंद्र दिखाए जा रहे हैं।';
        }
      }
      // 5. Skills & Skill-gap card reading
      else if (lower.includes('gap') || lower.includes('skill') || lower.includes('कौशल') || lower.includes('हुनर')) {
        navTarget = 'skill-gap';
        reply = 'कौशल कार्ड विश्लेषण: आपके वर्तमान कौशलों के आधार पर आपकी तैयारी 85% है। उन्नत कार्य के लिए आपको डिजिटल बिलिंग और उपकरण संचालन का अभ्यास करना होगा। कौशल अंतर पेज खोला जा रहा है।';
      }
      // 6. Government Schemes
      else if (lower.includes('yojana') || lower.includes('योजना') || lower.includes('scheme') || lower.includes('vishwakarma') || lower.includes('mudra')) {
        navTarget = 'faq';
        reply = 'सरकारी योजना कार्ड: 1. PM विश्वकर्मा योजना - ₹15,000 टूलकिट ग्रांट व ₹3 लाख तक रियायती लोन। 2. PMKVY 4.0 - फ्री वोकेशनल ट्रेनिंग व सर्टिफिकेट। 3. PM मुद्रा योजना - ₹50,000 से ₹10 लाख तक व्यवसाय लोन।';
      }
      // 7. Profile navigation
      else if (lower.includes('profile') || lower.includes('नाम') || lower.includes('प्रोफाइल')) {
        navTarget = 'profile';
        reply = 'आपकी प्रोफाइल खोली जा रही है।';
      }
      // 8. Help / FAQ navigation
      else if (lower.includes('help') || lower.includes('faq') || lower.includes('मदद') || lower.includes('सवाल')) {
        navTarget = 'faq';
        reply = 'सहायता और प्रश्नोत्तर अनुभाग खोला जा रहा है।';
      }
      // 9. Saved / Shortlist navigation
      else if (lower.includes('saved') || lower.includes('सहेजे') || lower.includes('shortlist')) {
        navTarget = 'saved';
        reply = 'आपके सहेजे गए अवसर दिखाए जा रहे हैं।';
      }
      // 10. Home navigation
      else if (lower.includes('home') || lower.includes('होम') || lower.includes('start') || lower.includes('शुरू')) {
        navTarget = 'home';
        reply = 'मुख्य पृष्ठ खोला जा रहा है जहाँ से आप नया मूल्यांकन शुरू कर सकते हैं।';
      }

      return res.json({
        fallback: true,
        reply,
        targetView: navTarget,
        actionHighlight: highlight
      });
    }

    const ai = new GoogleGenAI();
    const systemPrompt = `You are JeevikaAI (जीविका एआई), an intelligent, empathetic voice AI assistant for an Indian livelihood & skill discovery web application.
The user speaks in Hindi, Bhojpuri, Hinglish, or English.
Current Page View: "${currentView}"
User Language: "${language}"
User Profile: ${JSON.stringify(userProfile)}
User Said: "${message}"

Your Goal:
1. Answer the user's question concisely in 2-3 friendly spoken sentences in their spoken language (${language === 'bho' ? 'Bhojpuri' : language === 'en' ? 'English' : language === 'hin' ? 'Hinglish' : 'Hindi'}).
2. If the user asks to READ or EXPLAIN any card:
   - "Roadmap Card" / "रोडमैप कार्ड": Explain their career pathway, NSQF level, duration, and the 3 milestone stages. Target: "dashboard".
   - "Naukari / Job Card" / "नौकरी कार्ड": Read out the job title, organization, pay, location, and requirements. Target: "opportunities".
   - "Skill Card" / "कौशल कार्ड": Explain their current skills vs missing skills and readiness. Target: "skill-gap".
   - "Training Card" / "ट्रेनिंग कार्ड": Read out PMKVY and RSETI training centers and free benefits. Target: "training".
   - "Yojana Card" / "योजना कार्ड": Read out PM Vishwakarma, PMKVY, Mudra schemes. Target: "faq".
3. Determine if the user wants to navigate to any section.
   Allowed targetView values: "home", "dashboard", "opportunities", "training", "skill-gap", "saved", "profile", "faq", "history", null.
4. If the user expresses a desire to update their profile (e.g., "My name is Ramesh", "I passed 12th class", "I live in Lucknow"), extract the updated key-values into "profileUpdates".
5. If the user asks who created or made you (e.g. "tumhe kisne banaya", "who made you", "केहू बनइले बा", "किसने बनाया"), you must answer that you were created by JeevikaAI Organization (जीविका एआई आर्गेनाइजेशन).

Return strictly JSON matching this schema with no markdown code blocks:
{
  "reply": "Concise spoken reply in user's language (including card details if asked to read)",
  "targetView": "opportunities" | "training" | "dashboard" | "skill-gap" | "saved" | "profile" | "faq" | "home" | null,
  "actionHighlight": "Optional element ID to scroll to e.g. 'opportunities-section' | 'roadmap-section' | 'training-section'",
  "profileUpdates": {
    "name": "Updated name if user mentioned name",
    "education": "Updated education level if mentioned",
    "location": "Updated district/location if mentioned",
    "skills": "Updated skills if mentioned"
  }
}`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const response = await withTimeout(generatePromise, 8500);
    let rawText = response.text || '{}';
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(rawText);
    return res.json({
      fallback: false,
      reply: parsed.reply || 'जी, मैं आपकी सहायता के लिए तैयार हूँ।',
      targetView: parsed.targetView || null,
      actionHighlight: parsed.actionHighlight || null,
      profileUpdates: parsed.profileUpdates && Object.keys(parsed.profileUpdates).length ? parsed.profileUpdates : null
    });
  } catch (error: any) {
    return res.json({
      fallback: true,
      reply: 'जी, मैं आपकी सहायता के लिए तैयार हूँ। आप नौकरी, प्रशिक्षण केंद्र या अपने रोडमैप के बारे में पूछ सकते हैं।',
      targetView: null
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JeevikaAI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
