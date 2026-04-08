import { createContext, useContext, useState, useCallback } from 'react';

const LANGUAGES = [
  { code: 'en', label: 'EN', full: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिं', full: 'हिन्दी', flag: '🇮🇳' },
  { code: 'pa', label: 'ਪੰ', full: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
];

const TRANSLATIONS = {
  en: {
    // Header
    aiIntelligence: 'AI Intelligence v5.0',
    live: 'Live',
    // Hero
    heroLabel: 'AI-Powered News Intelligence v5.0',
    departures: 'DEPARTURES',
    analyzeStory: 'Analyze This Story',
    // Map
    globalNewsMap: 'GLOBAL NEWS MAP',
    clickCountry: 'Click any country for live news',
    loadingMap: 'Loading Global Map...',
    // Trending
    trendingNow: 'Trending Now',
    trusted: 'Trusted',
    analyze: 'Analyze',
    loading: 'Loading...',
    backendOffline: '⚠️ Backend Connection Offline.',
    // Search
    globalSearch: 'Global Search',
    searchPlaceholder: 'Search any topic...',
    region: 'Region:',
    global: '🌍 Global',
    // Quick topics
    quickTopics: 'Quick Topics',
    // City
    cityNews: 'City News',
    // Stats
    countries: 'Countries',
    articles: 'Articles',
    aiModels: 'AI Models',
    realTime: 'Real-time',
    // Footer
    footerMain: 'NewsIntel v5.0 — AI-Powered News Intelligence Platform',
    footerTech: 'FastAPI · HuggingFace NLP · Google Gemini · React',
    // Breaking
    breaking: 'BREAKING',
    // Weather
    weatherDashboard: 'Weather Dashboard',
    readingList: 'Reading List',
  },
  hi: {
    aiIntelligence: 'AI इंटेलिजेंस v5.0',
    live: 'लाइव',
    heroLabel: 'AI-संचालित समाचार बुद्धिमत्ता v5.0',
    departures: 'प्रस्थान',
    analyzeStory: 'इस खबर का विश्लेषण करें',
    globalNewsMap: 'वैश्विक समाचार मानचित्र',
    clickCountry: 'लाइव समाचार के लिए किसी भी देश पर क्लिक करें',
    loadingMap: 'वैश्विक मानचित्र लोड हो रहा है...',
    trendingNow: 'अभी ट्रेंडिंग',
    trusted: 'विश्वसनीय',
    analyze: 'विश्लेषण',
    loading: 'लोड हो रहा है...',
    backendOffline: '⚠️ बैकएंड कनेक्शन ऑफ़लाइन।',
    globalSearch: 'वैश्विक खोज',
    searchPlaceholder: 'कोई भी विषय खोजें...',
    region: 'क्षेत्र:',
    global: '🌍 वैश्विक',
    quickTopics: 'त्वरित विषय',
    cityNews: 'शहर समाचार',
    countries: 'देश',
    articles: 'लेख',
    aiModels: 'AI मॉडल',
    realTime: 'रियल-टाइम',
    footerMain: 'NewsIntel v5.0 — AI-संचालित समाचार बुद्धिमत्ता प्लेटफ़ॉर्म',
    footerTech: 'FastAPI · HuggingFace NLP · Google Gemini · React',
    breaking: 'ब्रेकिंग',
    weatherDashboard: 'मौसम डैशबोर्ड',
    readingList: 'पढ़ने की सूची',
  },
  pa: {
    aiIntelligence: 'AI ਇੰਟੈਲੀਜੈਂਸ v5.0',
    live: 'ਲਾਈਵ',
    heroLabel: 'AI-ਸੰਚਾਲਿਤ ਖ਼ਬਰ ਬੁੱਧੀ v5.0',
    departures: 'ਰਵਾਨਗੀਆਂ',
    analyzeStory: 'ਇਸ ਖ਼ਬਰ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰੋ',
    globalNewsMap: 'ਗਲੋਬਲ ਖ਼ਬਰ ਨਕਸ਼ਾ',
    clickCountry: 'ਲਾਈਵ ਖ਼ਬਰਾਂ ਲਈ ਕਿਸੇ ਵੀ ਦੇਸ਼ ਤੇ ਕਲਿੱਕ ਕਰੋ',
    loadingMap: 'ਗਲੋਬਲ ਨਕਸ਼ਾ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...',
    trendingNow: 'ਹੁਣ ਟ੍ਰੈਂਡਿੰਗ',
    trusted: 'ਭਰੋਸੇਯੋਗ',
    analyze: 'ਵਿਸ਼ਲੇਸ਼ਣ',
    loading: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...',
    backendOffline: '⚠️ ਬੈਕਐਂਡ ਕਨੈਕਸ਼ਨ ਆਫ਼ਲਾਈਨ।',
    globalSearch: 'ਗਲੋਬਲ ਖੋਜ',
    searchPlaceholder: 'ਕੋਈ ਵੀ ਵਿਸ਼ਾ ਖੋਜੋ...',
    region: 'ਖੇਤਰ:',
    global: '🌍 ਗਲੋਬਲ',
    quickTopics: 'ਤੇਜ਼ ਵਿਸ਼ੇ',
    cityNews: 'ਸ਼ਹਿਰ ਖ਼ਬਰਾਂ',
    countries: 'ਦੇਸ਼',
    articles: 'ਲੇਖ',
    aiModels: 'AI ਮਾਡਲ',
    realTime: 'ਰੀਅਲ-ਟਾਈਮ',
    footerMain: 'NewsIntel v5.0 — AI-ਸੰਚਾਲਿਤ ਖ਼ਬਰ ਬੁੱਧੀ ਪਲੇਟਫ਼ਾਰਮ',
    footerTech: 'FastAPI · HuggingFace NLP · Google Gemini · React',
    breaking: 'ਬ੍ਰੇਕਿੰਗ',
    weatherDashboard: 'ਮੌਸਮ ਡੈਸ਼ਬੋਰਡ',
    readingList: 'ਪੜ੍ਹਨ ਸੂਚੀ',
  },
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('newsintel-lang') || 'en';
    } catch { return 'en'; }
  });

  const setLanguage = useCallback((code) => {
    setLang(code);
    try { localStorage.setItem('newsintel-lang', code); } catch {}
    
    // Wire into Google Translate widget
    setTimeout(() => {
      const select = document.querySelector('.goog-te-combo');
      if (select) {
        select.value = code;
        select.dispatchEvent(new Event('change'));
      }
    }, 100);
  }, []);

  const t = useCallback((key) => {
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

export { LANGUAGES, TRANSLATIONS };
