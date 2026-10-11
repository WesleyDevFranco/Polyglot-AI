
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserProfile, HistoryItem, CEFRLevel, StoryResponse, UILanguage, StorySize } from './types';
import { generateStory, generateReviewStory } from './services/geminiService';
import Dashboard from './components/Dashboard';
import StudyArea from './components/StudyArea';
import History from './components/History';
import Settings from './components/Settings';
import { BookOpen, LayoutDashboard, History as HistoryIcon, Settings as SettingsIcon, Download, Upload, Sun, Moon, RefreshCw } from 'lucide-react';

const STORAGE_KEY = 'polyglot_i1_data_v3';

const DEFAULT_PROFILE: UserProfile = {
  name: 'User',
  targetLanguage: 'English',
  nativeLanguage: 'Portuguese',
  level: 'A1',
  knownWords: ['hello', 'world', 'the', 'is', 'a', 'to', 'in', 'and'],
  uiLanguage: 'pt',
  darkMode: false,
  notificationTime: '09:00',
  notificationsEnabled: false,
  storySize: 'short',
  ancientGreekDialect: 'attic',
  ancientGreekFocus: 'general',
  shakespeareanFocus: 'general'
};

const translations = {
  en: {
    dashboard: "Dashboard",
    studyArea: "Study Area",
    history: "History",
    settings: "Settings",
    export: "Export Data",
    import: "Import Data",
    welcome: "Welcome back",
    ready: "Ready for your next i+1 breakthrough?",
    generate: "Generate New Lesson",
    review: "Review Known Words",
    reviewDesc: "Consolidate your knowledge with a long story using only words you already know.",
    cefr: "CEFR Level",
    vocab: "Estimated Vocabulary",
    completed: "Lessons Completed",
    philosophy: "The i+1 Philosophy",
    philosophyDesc: "The Natural Method suggests that we acquire language best when we are exposed to input that is just one step beyond our current stage (i+1).",
    startNow: "Start learning now",
    congrats: "Congratulations! Your vocabulary has grown.",
    reviewCongrats: "Great job! You consolidated your knowledge.",
    levelUp: "Your CEFR level has improved to ",
    importSuccess: "Progress imported successfully!",
    invalidFile: "Invalid file format.",
    notificationTitle: "Time to Study!",
    notificationBody: "Don't break your streak. Your next i+1 lesson is waiting!",
    storySize: "Story Length",
    short: "Short (5-10 sentences)",
    standard: "Standard (Exactly 10 sentences)",
    medium: "Medium (10-15 sentences)",
    long: "Long (15-25 sentences)",
    dialect: "Dialect Variant",
    attic: "Attic Greek",
    koine: "Koine Greek",
    focus: "Vocabulary Focus",
    generalAttic: "General Attic",
    philosophicalAttic: "Philosophical (Plato/Aristotle)",
    shakespearean: "Shakespearean English",
    shakespeareanStyle: "Shakespearean Style",
    generalShakespearean: "Classic Elizabethan",
    dramaShakespearean: "Tragedy & Drama (Macbeth/Hamlet)",
    courtlyShakespearean: "Courtly & Romance (Sonnets/Comedies)",
    loadStarterVocab: "Load Starter Vocabulary",
    starterVocabLoaded: "Starter vocabulary loaded for"
  },
  pt: {
    dashboard: "Painel",
    studyArea: "Área de Estudo",
    history: "Histórico",
    settings: "Configurações",
    export: "Exportar Dados",
    import: "Importar Dados",
    welcome: "Bem-vindo de volta",
    ready: "Pronto para sua próxima evolução i+1?",
    generate: "Gerar Nova Lição",
    review: "Revisar Palavras Conhecidas",
    reviewDesc: "Consolide seu conhecimento com uma história longa usando apenas palavras que você já conhece.",
    cefr: "Nível CEFR",
    vocab: "Vocabulário Estimado",
    completed: "Lições Concluídas",
    philosophy: "A Filosofia i+1",
    philosophyDesc: "O Método Natural sugere que adquirimos linguagem melhor quando expostos a inputs apenas um passo além do nosso estágio atual (i+1).",
    startNow: "Começar agora",
    congrats: "Parabéns! Seu vocabulário cresceu.",
    reviewCongrats: "Bom trabalho! Você consolidou seu conhecimento.",
    levelUp: "Seu nível CEFR subiu para ",
    importSuccess: "Progresso importado com sucesso!",
    invalidFile: "Formato de arquivo inválido.",
    notificationTitle: "Hora de Estudar!",
    notificationBody: "Não quebre sua sequência. Sua próxima lição i+1 está esperando!",
    storySize: "Tamanho das Histórias",
    short: "Curtas (5-10 frases)",
    standard: "Padrão (Exatamente 10 frases)",
    medium: "Médias (10-15 frases)",
    long: "Longas (15-25 frases)",
    dialect: "Variante de Dialeto",
    attic: "Grego Ático",
    koine: "Grego Koiné",
    focus: "Foco do Vocabulário",
    generalAttic: "Ático Geral",
    philosophicalAttic: "Filosófico (Platão/Aristóteles)",
    shakespearean: "Inglês Shakespeariano",
    shakespeareanStyle: "Estilo Shakespeariano",
    generalShakespearean: "Elizabetano Clássico",
    dramaShakespearean: "Tragédia & Drama (Macbeth/Hamlet)",
    courtlyShakespearean: "Cortesão & Romance (Sonetos/Comédias)",
    loadStarterVocab: "Carregar Vocabulário Inicial",
    starterVocabLoaded: "Vocabulário inicial carregado para"
  },
  es: {
    dashboard: "Panel",
    studyArea: "Área de Estudio",
    history: "Historial",
    settings: "Configuración",
    export: "Exportar Dados",
    import: "Importar Datos",
    welcome: "Bienvenido de nuevo",
    ready: "¿Listo para tu próximo avance i+1?",
    generate: "Gerar Nova Lección",
    review: "Revisar palabras conocidas",
    reviewDesc: "Consolida tus conocimientos con una historia larga utilizando sólo palabras que ya conoces.",
    cefr: "Nivel CEFR",
    vocab: "Vocabulario Estimado",
    completed: "Lecciones Completadas",
    philosophy: "The i+1 Philosophy",
    philosophyDesc: "El Método Natural sugiere que adquirimos el lenguaje mejor cuando estamos expuestos a información que está solo un paso más allá de nuestra etapa actual (i+1).",
    startNow: "Empezar a aprender ahora",
    congrats: "¡Felicidades! Tu vocabulario ha crecido.",
    reviewCongrats: "¡Buen trabalho! Has consolidado tus conocimientos.",
    levelUp: "Tu nivel CEFR ha subido a ",
    importSuccess: "¡Progreso importado con éxito!",
    invalidFile: "Formato de arquivo inválido.",
    notificationTitle: "¡Hora de Estudiar!",
    notificationBody: "No rompas tu racha. ¡Tu próxima lección i+1 te espera!",
    storySize: "Tamaño de las historias",
    short: "Cortas (5-10 frases)",
    standard: "Estándar (Exactamente 10 frases)",
    medium: "Medias (10-15 frases)",
    long: "Largas (15-25 frases)",
    dialect: "Variante de Dialecto",
    attic: "Griego Ático",
    koine: "Griego Koiné",
    focus: "Enfoque de Vocabulario",
    generalAttic: "Ático General",
    philosophicalAttic: "Filosófico (Platón/Aristóteles)",
    shakespearean: "Inglés Shakesperiano",
    shakespeareanStyle: "Estilo Shakesperiano",
    generalShakespearean: "Isabelino Clásico",
    dramaShakespearean: "Tragedia y Drama (Macbeth/Hamlet)",
    courtlyShakespearean: "Cortesano y Romance (Sonetos/Comedias)",
    loadStarterVocab: "Cargar Vocabulario Inicial",
    starterVocabLoaded: "Vocabulario inicial cargado para"
  }
};

const calculateLevelFromVocab = (count: number): CEFRLevel => {
  if (count <= 500) return 'A1';
  if (count <= 1000) return 'A2';
  if (count <= 2500) return 'B1';
  if (count <= 5000) return 'B2';
  if (count <= 10000) return 'C1';
  return 'C2';
};

const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'study' | 'history' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [currentStory, setCurrentStory] = useState<StoryResponse | null>(null);

  const t = useMemo(() => translations[profile.uiLanguage || 'en'] as any, [profile.uiLanguage]);

  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const { profile: savedProfile, history: savedHistory } = JSON.parse(savedData);
        if (savedProfile) setProfile({ ...DEFAULT_PROFILE, ...savedProfile });
        if (savedHistory) setHistory(savedHistory);
      } catch (e) {
        console.error("Failed to parse stored data", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!profile.notificationsEnabled) return;

    const checkNotification = () => {
      const now = new Date();
      const currentStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentStr === profile.notificationTime) {
        if (Notification.permission === 'granted') {
          new Notification(t.notificationTitle, { body: t.notificationBody });
        }
      }
    };

    const interval = setInterval(checkNotification, 60000);
    return () => clearInterval(interval);
  }, [profile.notificationsEnabled, profile.notificationTime, t]);


  useEffect(() => {
    if (profile.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [profile.darkMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, history }));
  }, [profile, history]);

  const handleGenerateStory = async () => {
    setLoading(true);
    try {
      const story = await generateStory(
        profile.targetLanguage,
        profile.nativeLanguage,
        profile.level,
        profile.knownWords,
        profile.storySize,
        profile.ancientGreekDialect,
        profile.ancientGreekFocus,
        profile.shakespeareanFocus
      );
      setCurrentStory(story);
      setActiveTab('study');
    } catch (error) {
      alert("Error generating story.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReview = async () => {
    if (profile.knownWords.length < 20) {
      alert("You need at least 20 known words for a high-quality review session.");
      return;
    }
    setLoading(true);
    try {
      const story = await generateReviewStory(
        profile.targetLanguage,
        profile.nativeLanguage,
        profile.knownWords,
        profile.ancientGreekDialect,
        profile.ancientGreekFocus,
        profile.shakespeareanFocus
      );
      setCurrentStory(story);
      setActiveTab('study');
    } catch (error) {
      alert("Error generating review story.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteLesson = (story: StoryResponse) => {
    const isReview = !!story.is_review;
    const updatedKnownWords = Array.from(new Set([...profile.knownWords, ...story.new_words_to_add]));
    const newLevel = calculateLevelFromVocab(updatedKnownWords.length);
    const levelChanged = newLevel !== profile.level;
    
    setProfile(prev => ({ 
      ...prev, 
      knownWords: updatedKnownWords,
      level: newLevel
    }));
    
    const newHistoryItem: HistoryItem = {
      ...story,
      timestamp: Date.now(),
      completed: true
    };
    
    setHistory(prev => [newHistoryItem, ...prev]);
    setCurrentStory(null);
    setActiveTab('dashboard');
    
    if (isReview) {
      alert(t.reviewCongrats);
    } else {
      alert(levelChanged ? `${t.congrats} ${t.levelUp} ${newLevel}!` : t.congrats);
    }
  };

  const handleReopenStory = (story: StoryResponse) => {
    setCurrentStory(story);
    setActiveTab('study');
  };

  const handleExport = () => {
    const data = JSON.stringify({ profile, history }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polyglot_progress_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.profile) {
           const level = calculateLevelFromVocab(data.profile.knownWords.length);
           setProfile({ ...DEFAULT_PROFILE, ...data.profile, level });
        }
        if (data.history) setHistory(data.history);
        alert(t.importSuccess);
      } catch (err) {
        alert(t.invalidFile);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <nav className="w-full md:w-64 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-6 flex flex-col shrink-0 border-r border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-500 p-2 rounded-lg"><BookOpen size={24} className="text-white" /></div>
            <h1 className="text-xl font-bold tracking-tight">Polyglot i+1</h1>
          </div>
          <button onClick={() => setProfile(p => ({...p, darkMode: !p.darkMode}))} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {profile.darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="flex flex-col gap-2 flex-grow">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} /> {t.dashboard}
          </button>
          <button onClick={() => setActiveTab('study')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'study' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <BookOpen size={20} /> {t.studyArea}
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <HistoryIcon size={20} /> {t.history}
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <SettingsIcon size={20} /> {t.settings}
          </button>
        </div>
      </nav>

      <main className="flex-grow p-4 md:p-10 overflow-y-auto max-h-screen">
        {activeTab === 'dashboard' && (
          <Dashboard 
            profile={profile} 
            onGenerate={handleGenerateStory} 
            onReview={handleGenerateReview}
            loading={loading} 
            historyCount={history.length}
            t={t}
            history={history}
          />
        )}
        {activeTab === 'study' && (
          <StudyArea 
            story={currentStory} 
            loading={loading}
            onGenerate={handleGenerateStory}
            onComplete={handleCompleteLesson}
            targetLanguage={profile.targetLanguage}
            t={t}
          />
        )}
        {activeTab === 'history' && <History history={history} onReopen={handleReopenStory} targetLanguage={profile.targetLanguage} />}
        {activeTab === 'settings' && (
          <Settings 
            profile={profile} 
            setProfile={setProfile} 
            onExport={handleExport}
            onImport={handleImport}
            t={t}
          />
        )}
      </main>
    </div>
  );
};

export default App;
