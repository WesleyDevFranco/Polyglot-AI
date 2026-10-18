
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserProfile, HistoryItem, CEFRLevel, StoryResponse, UILanguage, StorySize, SRSCard, SRSBackType } from './types';
import { generateStory, generateReviewStory, normalizeStoryResponse } from './services/geminiService';
import Dashboard from './components/Dashboard';
import StudyArea from './components/StudyArea';
import History from './components/History';
import Settings from './components/Settings';
import { SRSReviewArea } from './components/SRSReviewArea';
import { VocabularyModal } from './components/VocabularyModal';
import { ApiKeyPromptModal } from './components/ApiKeyPromptModal';
import { ApiKeyTutorialModal } from './components/ApiKeyTutorialModal';
import { JsonBackupTutorialModal } from './components/JsonBackupTutorialModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { calculateStreak } from './utils/streak';
import { syncCardsFromHistory, computeSRSStats } from './utils/srs';
import { BookOpen, LayoutDashboard, History as HistoryIcon, Settings as SettingsIcon, Download, Upload, Sun, Moon, RefreshCw, Flame, Key, FileJson, HelpCircle, Layers, Menu, X } from 'lucide-react';

const STORAGE_KEY = 'polyglot_i1_data_v3';
const SRS_STORAGE_KEY = 'polyglot_srs_cards_v1';

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
  shakespeareanFocus: 'general',
  dailyGoal: 2,
  srsBackType: 'full_translation',
  srsDailyGoal: 20
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
    consolidateNow: "Consolidate now",
    congrats: "Congratulations! Your vocabulary has grown.",
    reviewCongrats: "Great job! You consolidated your knowledge.",
    levelUp: "Your CEFR level has improved to ",
    importSuccess: "Progress imported successfully!",
    invalidFile: "Invalid file format.",
    notificationTitle: "Time to Study!",
    notificationBody: "Don't break your streak. Your next i+1 lesson is waiting!",
    storySize: "Story Length",
    short: "Short (5-10 sentences)",
    standard: "Standard (10 sentences)",
    medium: "Medium (10-15 sentences)",
    long: "Long (15-25 sentences)",
    dialect: "Dialect Variant",
    attic: "Attic Greek",
    koine: "Koine Greek",
    focus: "Vocabulary Focus",
    generalAttic: "General Attic",
    philosophicalAttic: "Philosophical (Plato/Aristotle)",
    philosophicalDesc: "Specialized vocabulary: Plato and Aristotle",
    shakespearean: "Shakespearean English",
    shakespeareanStyle: "Shakespearean Style",
    generalShakespearean: "Classic Elizabethan",
    dramaShakespearean: "Tragedy & Drama (Macbeth/Hamlet)",
    courtlyShakespearean: "Courtly & Romance (Sonnets/Comedies)",
    shakespeareanGeneralDesc: "Classic Elizabethan English: archaic pronouns (thou/thee/thy), verbal inflections (-eth/-est), and theatrical cadence.",
    shakespeareanDramaDesc: "Epic tragedy and drama: solemn themes, fate, honor, and poetic soliloquies.",
    shakespeareanCourtlyDesc: "Courtly romance and sonnets: wordplay, lyrical elegance, and romantic wit.",
    loadStarterVocab: "Load Starter Vocabulary",
    starterVocabLoaded: "Starter vocabulary loaded for",
    streak: "Streak",
    dayStreak: "Daily Streak",
    days: "days",
    day: "day",
    streakActive: "Streak Active Today!",
    keepStreak: "Complete a lesson today to maintain your streak!",
    streakBroken: "Complete a lesson today to start a new streak!",
    todayActive: "Active",
    todayPending: "⚡ Today pending",
    searchVocab: "Search known words...",
    filterWords: "Filter Words",
    wordsLearned: "Learned Vocabulary",
    showing: "Showing",
    of: "of",
    words: "words",
    noWordsFound: "No matching words found.",
    clearFilter: "Clear search",
    sortAZ: "A-Z",
    sortZA: "Z-A",
    sortDefault: "Default",
    rawEdit: "Raw CSV",
    interactiveView: "Search & Filter",
    browseVocab: "Search Words",
    addWord: "Add Word",
    newWordPlaceholder: "Add new word to vocabulary...",
    dailyGoal: "Daily Study Goal",
    dailyGoalDesc: "Set target lessons to complete each day",
    dailyGoalTarget: "lessons / day",
    goalProgress: "Daily Goal",
    goalAchieved: "Goal Achieved! 🎉",
    goalLeft: "left today",
    lesson: "lesson",
    lessons: "lessons",
    activityCalendar: "Study Activity Calendar",
    activityCalendarDesc: "Daily study frequency over the last 30 days",
    progressTimeline: "Progress Timeline",
    dailyVelocity: "Daily Velocity",
    wordsPerDay: "w/d",
    mastery: "Mastery",
    wordsRemainingFor: "words remaining for",
    maxLevelReached: "Maximum level reached!",
    dailyGain: "Daily Gain",
    less: "Less",
    more: "More",
    noLessonsOnDay: "No lessons completed",
    lessonCompleted: "lesson completed",
    lessonsCompleted: "lessons completed",
    customizeExperience: "Customize your experience",
    displayName: "Display Name",
    learningPreferences: "Learning Preferences",
    targetLanguage: "Target Language",
    customGoal: "Custom goal:",
    localization: "Localization",
    interfaceLanguage: "Interface Language",
    notificationsDisplay: "Notifications & Display",
    studyNotifications: "Study Notifications",
    dailyReminders: "Daily reminders",
    saveChanges: "Save Changes",
    saving: "Saving...",
    saved: "Saved successfully!",
    vocabExplorerSubtitle: "Search, filter, or manage vocabulary used by Gemini for precise i+1 generation.",
    separateCommas: "Separate words with commas. Changes will be saved.",
    sendingWordsToAI: "Sending words to Gemini for precise i+1 generation",
    noActiveLesson: "No Active Lesson",
    noActiveLessonDesc: "Generate a custom story tailored to your current vocabulary level.",
    generateMyStory: "Generate New Lesson",
    generatingLesson: "Crafting your custom lesson with the Natural Method (i+1)...",
    hideTranslation: "Hide Translation",
    showTranslation: "Show Translation",
    definition: "Definition",
    plusOneElement: "The \"+1\" Element",
    pronunciationIPA: "Pronunciation (IPA)",
    sessionReview: "Session Review",
    lessonReview: "Lesson Review",
    listenFullStory: "Listen to Full Story",
    downloadAudio: "Download Audio (.wav)",
    reviewCompleted: "Review Completed",
    lessonCompletedBtn: "Lesson Completed",
    learningHistory: "Learning History",
    revisitBreakthroughs: "Revisit your past breakthroughs",
    historyEmpty: "Your story list is currently empty.",
    reopenLesson: "Reopen lesson",
    listenStory: "Listen to story",
    moreWords: "more",
    progressChart: "Progress Chart",
    progressChartDesc: "Vocabulary growth (known words) over the last 30 days",
    thirtyDayGrowth: "30d Growth",
    thirtyDayLessons: "30d Lessons",
    activeDays: "Active Days",
    cumulativeVocab: "Cumulative Known Vocabulary",
    current: "Current:",
    learned: "Learned:",
    noNewWords: "No new words",
    today: "Today",
    calendarHint: "Click or hover on any day to inspect completed lessons.",
    inActiveLexicon: "in your active lexicon",
    close: "Close",
    clickToCopy: "Click to copy",
    removeWord: "Remove",
    wordAlreadyExists: "is already in your known vocabulary list.",
    needMoreWordsForReview: "You need at least 20 known words for a high-quality review session.",
    level: "Level",
    reviewMode: "Review Mode",
    errorGeneratingStory: "Error generating lesson:",
    errorGeneratingReview: "Error generating review lesson:",
    apiKey: "Gemini API Key",
    apiKeySubtitle: "Required for generating AI-powered natural stories and vocabulary reviews.",
    apiKeyPlaceholder: "Paste your Google Gemini API key (e.g. AIzaSy...)",
    apiKeyConfigured: "Key Configured",
    apiKeyMissing: "No key configured",
    howToGetFreeKey: "Get a Free API Key",
    apiKeyHelp: "Your key is saved locally in your browser and inside your exported JSON backups. Never shared.",
    dataManagementSubtitle: "Export vocabulary, history, and key as JSON or restore your progress.",
    backupRestoreGuideBtn: "Save & Restore Guide (JSON)",
    freeAndQuick: "100% Free & Quick",
    howToGetApiKeyTitle: "How to Get Your Free Gemini API Key",
    howToGetApiKeySubtitle: "Google AI Studio gives you a free API key with generous limits to generate endless i+1 lessons.",
    openGoogleStudio: "Open Google AI Studio",
    stepByStepTutorial: "Step by Step (under 1 minute)",
    step1Title: "Open the official Google AI Studio portal",
    step1Desc: "Sign in with your regular Google Account. No credit card or payment is required.",
    step2Title: "Click \"Create API key\"",
    step2Desc: "Choose \"Create API key in new project\" or select an existing project in your account.",
    step3Title: "Copy your generated key",
    step3Desc: "Your key begins with \"AIzaSy...\". Copy it to your clipboard.",
    step4Title: "Paste your key in Polyglot i+1 and save",
    step4Desc: "Your key is stored safely on your device and will be included in your JSON backups.",
    pasteKeyDirectly: "Paste your key here to save now:",
    saveKey: "Save Key",
    securityPrivacyTitle: "100% Private & Secure",
    securityPrivacyDesc: "Your API key is stored only on your device (localStorage) and in JSON files you export. Requests go directly to Google's official API.",
    backupSystem: "Local & Portable Backup",
    backupRestoreTitle: "How to Save and Restore Your Progress (JSON)",
    backupRestoreSubtitle: "Learn how to backup your data, sync your learning across devices, and never lose your progress.",
    whyBackupTitle: "Why backup your data in JSON?",
    whyBackupDesc: "Polyglot i+1 is designed privacy-first: all vocabulary, history, and streaks stay in your browser. Exporting a JSON file lets you create restore points and switch devices effortlessly!",
    howToExportTitle: "1. How to Save (Export)",
    clickExportBtn: "Click \"Export Data\":",
    exportStep1: "accessible in Settings or below.",
    downloadJson: "Automatic download:",
    exportStep2: "a .json file with today's date will be saved to your device.",
    safeStorage: "What is saved:",
    exportStep3: "all learned vocabulary, CEFR level, daily streaks, story history, and your API key.",
    howToImportTitle: "2. How to Restore (Import)",
    clickImportBtn: "Click \"Import Data\":",
    importStep1: "in Settings or below.",
    selectJson: "Select the file:",
    importStep2: "choose your previously saved .json file.",
    instantSync: "Instant restoration:",
    importStep3: "your vocabulary, completed lessons, and API key are restored immediately!",
    exportNowBtn: "Export My Data Now",
    importNowBtn: "Import JSON File Now",
    deviceSyncTipTitle: "Tip: Switch between Laptop, Phone & Tablet",
    deviceSyncTipDesc: "Export on your computer, send the JSON to your phone (via Drive, email, or chat), and import to continue your daily streak on the go.",
    jsonPrivacyNote: "JSON files belong to you and remain 100% under your local control.",
    apiKeyRequiredTitle: "Gemini API Key Required",
    apiKeyPromptNotice: "To generate authentic stories with the Natural Method (i+1) and review vocabulary, please configure your free Google Gemini API key.",
    pasteKeyHerePrompt: "Paste your Gemini API key below:",
    howToGetAKey: "How to get one for free?",
    saveAndGenerate: "Save Key & Continue",
    viewStepByStepGuide: "View Step-by-Step Guide",
    apiKeySecurityBrief: "Your key is only stored locally and in your JSON backups.",
    apiKeyRequiredPrompt: "Please enter a valid Gemini API key.",
    reviewNeedsKey: "API Key Required for Review",
    lessonNeedsKey: "API Key Required to Generate Lesson",
    clear: "Clear",
    show: "Show",
    hide: "Hide",
    srsReview: "Anki SRS Review",
    srsTitle: "Spaced Repetition (SRS / Anki)",
    srsSubtitle: "The forgetting curve and spaced repetition to lock every i+1 sentence into long-term memory.",
    srsCardBackSetting: "Card Back Configuration",
    srsSelectBackMode: "What would you like to see on the card back?",
    srsBackFull: "Full Sentence Translation",
    srsBackFullDesc: "Displays the complete sentence translation in your native language.",
    srsBackElement: "i+1 Element Translation Only",
    srsBackElementDesc: "Exact focus on the new vocabulary or unfamiliar element.",
    srsBackDefinition: "Target Language Definition",
    srsBackDefinitionDesc: "Pure immersion: definition in the language being learned.",
    srsCardFront: "FRONT (i+1 Sentence)",
    srsCardBack: "BACK",
    srsShowAnswer: "Show Answer",
    srsPressSpace: "Press [Space] to flip card",
    srsElementBadge: "i+1 Element",
    srsFullTranslationLabel: "Full Sentence Translation",
    srsElementTranslationLabel: "i+1 Element Translation",
    srsTargetDefinitionLabel: "Target Language Definition",
    srsHideOtherDetails: "Hide other details",
    srsShowOtherDetails: "Show other modes (full translation / extra definition)",
    srsRatePrompt: "How well did you remember? (Rate for the Forgetting Curve):",
    srsAgain: "Again",
    srsHard: "Hard",
    srsGood: "Good",
    srsEasy: "Easy",
    srsShortcutsHint: "Keyboard shortcuts: [1] Again • [2] Hard • [3] Good • [4] Easy",
    srsDueToday: "Due Today",
    srsNewCards: "New (i+1)",
    srsLearningCards: "In Learning",
    srsMasteredCards: "Mastered",
    srsStartReviewBtn: "Start Today's Review",
    srsCramBtn: "Practice Free (Cram)",
    srsGenerateNewStory: "Generate New i+1 Story",
    srsForgettingCurveTitle: "Ebbinghaus Forgetting Curve",
    srsForgettingCurveSubtitle: "How the SM-2 algorithm transforms fleeting exposure into permanent retention.",
    srsDeckExplorerTitle: "Completed Stories Deck",
    srsDeckExplorerSubtitle: "Every completed lesson automatically feeds your deck with i+1 flashcards.",
    srsNoCardsYet: "Your Anki Deck is Empty",
    srsNoCardsDesc: "As soon as you complete your first story in Polyglot i+1, all sentences and new elements will be automatically added here for spaced repetition!",
    srsGenerateFirstStory: "Create My First Story",
    srsSessionDoneTitle: "Review Session Complete!",
    srsSessionDoneDesc: "Outstanding work! You intercepted the forgetting curve and strengthened your neural pathways for long-term mastery.",
    srsReviewedCards: "Cards reviewed",
    srsRememberedCount: "Remembered",
    srsAgainCount: "To reinforce",
    srsReturnToDeck: "Return to Deck",
    srsCramMore: "Practice More (Cram)",
    srsFinishSession: "Exit",
    srsConfirmQuit: "Do you want to end the review session early?",
    srsSettingsTitle: "Spaced Repetition (SRS / Anki)",
    srsSettingsSubtitle: "Configure how the back of each i+1 flashcard is displayed during spaced repetition reviews."
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
    consolidateNow: "Consolidar agora",
    congrats: "Parabéns! Seu vocabulário cresceu.",
    reviewCongrats: "Bom trabalho! Você consolidou seu conhecimento.",
    levelUp: "Seu nível CEFR subiu para ",
    importSuccess: "Progresso importado com sucesso!",
    invalidFile: "Formato de arquivo inválido.",
    notificationTitle: "Hora de Estudar!",
    notificationBody: "Não quebre sua sequência. Sua próxima lição i+1 está esperando!",
    storySize: "Tamanho das Histórias",
    short: "Curtas (5-10 frases)",
    standard: "Padrão (10 frases)",
    medium: "Médias (10-15 frases)",
    long: "Longas (15-25 frases)",
    dialect: "Variante de Dialeto",
    attic: "Grego Ático",
    koine: "Grego Koiné",
    focus: "Foco do Vocabulário",
    generalAttic: "Ático Geral",
    philosophicalAttic: "Filosófico (Platão/Aristóteles)",
    philosophicalDesc: "Léxico especializado: Platão e Aristóteles",
    shakespearean: "Inglês Shakespeariano",
    shakespeareanStyle: "Estilo Shakespeariano",
    generalShakespearean: "Elizabetano Clássico",
    dramaShakespearean: "Tragédia & Drama (Macbeth/Hamlet)",
    courtlyShakespearean: "Cortesão & Romance (Sonetos/Comédias)",
    shakespeareanGeneralDesc: "Inglês elizabetano clássico: pronomes arcaicos (thou/thee/thy), flexões verbais (-eth/-est) e cadência teatral.",
    shakespeareanDramaDesc: "Tragédia e drama épico: temas solenes, destino, honra e monólogos poéticos.",
    shakespeareanCourtlyDesc: "Foco cortesão e sonetos: corte amorosa, jogos de palavras, elegância lírica e sagacidade.",
    loadStarterVocab: "Carregar Vocabulário Inicial",
    starterVocabLoaded: "Vocabulário inicial carregado para",
    streak: "Sequência",
    dayStreak: "Dias de Sequência",
    days: "dias",
    day: "dia",
    streakActive: "Sequência Ativa Hoje!",
    keepStreak: "Complete uma lição hoje para manter sua sequência!",
    streakBroken: "Complete uma lição hoje para iniciar uma nova sequência!",
    todayActive: "Ativo",
    todayPending: "⚡ Pendente hoje",
    searchVocab: "Buscar palavras conhecidas...",
    filterWords: "Filtrar Palavras",
    wordsLearned: "Vocabulário Aprendido",
    showing: "Mostrando",
    of: "de",
    words: "palavras",
    noWordsFound: "Nenhuma palavra encontrada.",
    clearFilter: "Limpar busca",
    sortAZ: "A-Z",
    sortZA: "Z-A",
    sortDefault: "Padrão",
    rawEdit: "Lista CSV",
    interactiveView: "Buscar & Filtrar",
    browseVocab: "Explorar Palavras",
    addWord: "Adicionar Palavra",
    newWordPlaceholder: "Adicionar nova palavra ao vocabulário...",
    dailyGoal: "Meta Diária de Estudo",
    dailyGoalDesc: "Defina a quantidade de lições a concluir por dia",
    dailyGoalTarget: "lições / dia",
    goalProgress: "Meta Diária",
    goalAchieved: "Meta Atingida! 🎉",
    goalLeft: "restantes hoje",
    lesson: "lição",
    lessons: "lições",
    activityCalendar: "Calendário de Atividades",
    activityCalendarDesc: "Frequência diária de estudo nos últimos 30 dias",
    progressTimeline: "Evolução do Vocabulário",
    dailyVelocity: "Velocidade Diária",
    wordsPerDay: "pal/dia",
    mastery: "Domínio Completo",
    wordsRemainingFor: "palavras restantes para",
    maxLevelReached: "Nível máximo alcançado!",
    dailyGain: "Ganho Diário",
    less: "Menos",
    more: "Mais",
    noLessonsOnDay: "Nenhuma lição concluída",
    lessonCompleted: "lição concluída",
    lessonsCompleted: "lições concluídas",
    customizeExperience: "Personalize sua experiência",
    displayName: "Nome de Exibição",
    learningPreferences: "Preferências de Aprendizagem",
    targetLanguage: "Idioma de Estudo",
    customGoal: "Meta personalizada:",
    localization: "Localização",
    interfaceLanguage: "Idioma da Interface",
    notificationsDisplay: "Notificações & Exibição",
    studyNotifications: "Notificações de Estudo",
    dailyReminders: "Lembretes diários",
    saveChanges: "Salvar Alterações",
    saving: "Salvando...",
    saved: "Salvo com sucesso!",
    vocabExplorerSubtitle: "Pesquise, filtre ou gerencie o vocabulário usado pela IA para geração precisa de i+1.",
    separateCommas: "Separe as palavras por vírgulas. As alterações serão salvas.",
    sendingWordsToAI: "Enviando palavras para o Gemini para geração precisa de i+1",
    noActiveLesson: "Nenhuma Lição Ativa",
    noActiveLessonDesc: "Gere uma nova história sob medida para continuar sua jornada de aprendizagem.",
    generateMyStory: "Gerar Nova Lição",
    generatingLesson: "Criando sua lição personalizada com o Método Natural (i+1)...",
    hideTranslation: "Ocultar Tradução",
    showTranslation: "Mostrar Tradução",
    definition: "Definição",
    plusOneElement: "Elemento \"+1\"",
    pronunciationIPA: "Pronúncia (IPA)",
    sessionReview: "Revisão da Sessão",
    lessonReview: "Revisão da Lição",
    listenFullStory: "Ouvir História Completa",
    downloadAudio: "Baixar Áudio (.wav)",
    reviewCompleted: "Revisão Concluída",
    lessonCompletedBtn: "Lição Concluída",
    learningHistory: "Histórico de Aprendizagem",
    revisitBreakthroughs: "Revise suas conquistas e lições passadas",
    historyEmpty: "Seu histórico de lições está vazio.",
    reopenLesson: "Reabrir lição",
    listenStory: "Ouvir história",
    moreWords: "mais",
    progressChart: "Gráfico de Progresso",
    progressChartDesc: "Evolução do vocabulário (palavras conhecidas) nos últimos 30 dias",
    thirtyDayGrowth: "Ganho em 30d",
    thirtyDayLessons: "Lições em 30d",
    activeDays: "Dias Ativos",
    cumulativeVocab: "Vocabulário Conhecido Acumulado",
    current: "Atual:",
    learned: "Aprendidas:",
    noNewWords: "Sem palavras novas",
    today: "Hoje",
    calendarHint: "Clique ou passe o mouse em qualquer dia para ver as lições concluídas.",
    inActiveLexicon: "no seu vocabulário ativo",
    close: "Fechar",
    clickToCopy: "Clique para copiar",
    removeWord: "Remover",
    wordAlreadyExists: "já está na sua lista de vocabulário conhecido.",
    needMoreWordsForReview: "Você precisa de pelo menos 20 palavras conhecidas para uma sessão de revisão de qualidade.",
    level: "Nível",
    reviewMode: "Modo de Revisão",
    errorGeneratingStory: "Erro ao gerar lição:",
    errorGeneratingReview: "Erro ao gerar lição de revisão:",
    apiKey: "Chave de API do Gemini",
    apiKeySubtitle: "Necessária para gerar histórias originais (i+1) e revisões de vocabulário com inteligência artificial.",
    apiKeyPlaceholder: "Cole sua chave do Google Gemini (ex: AIzaSy...)",
    apiKeyConfigured: "Chave Configurada",
    apiKeyMissing: "Nenhuma chave configurada",
    howToGetFreeKey: "Como obter chave gratuita",
    apiKeyHelp: "Sua chave fica salva no seu navegador (localStorage) e no backup JSON que você exportar. Nunca é compartilhada.",
    dataManagementSubtitle: "Exporte seu vocabulário, histórico e chave em formato JSON ou restaure seu progresso.",
    backupRestoreGuideBtn: "Como salvar & restaurar (Guia)",
    freeAndQuick: "100% Gratuito & Rápido",
    howToGetApiKeyTitle: "Como Obter sua Chave Gratuita do Gemini",
    howToGetApiKeySubtitle: "O Google AI Studio oferece uma chave gratuita com limites generosos para você gerar lições i+1 sem custos.",
    openGoogleStudio: "Abrir Google AI Studio",
    stepByStepTutorial: "Passo a Passo (menos de 1 minuto)",
    step1Title: "Acesse o portal oficial do Google AI Studio",
    step1Desc: "Faça login com sua conta Google padrão (Gmail). Nenhuma cobrança ou cartão de crédito é exigido.",
    step2Title: "Clique no botão \"Create API key\" (Criar chave)",
    step2Desc: "Escolha \"Create API key in new project\" ou selecione um projeto existente da sua conta Google.",
    step3Title: "Copie a sua chave gerada",
    step3Desc: "Sua chave é uma sequência de caracteres que geralmente inicia com \"AIzaSy...\". Copie-a para a área de transferência.",
    step4Title: "Cole sua chave no Polyglot i+1 e salve",
    step4Desc: "Sua chave será armazenada localmente no seu dispositivo e incluída nos seus backups JSON.",
    pasteKeyDirectly: "Cole sua chave aqui para salvar agora:",
    saveKey: "Salvar Chave",
    securityPrivacyTitle: "100% Seguro & Privado",
    securityPrivacyDesc: "Sua chave de API fica armazenada exclusivamente no seu navegador (localStorage) e nos seus backups JSON exportados. Suas requisições vão direto para a API oficial do Google.",
    backupSystem: "Backup Local e Portátil",
    backupRestoreTitle: "Como Salvar e Restaurar seu Progresso (JSON)",
    backupRestoreSubtitle: "Aprenda a fazer backup dos seus dados, transferir seu aprendizado entre dispositivos e nunca perder seu progresso.",
    whyBackupTitle: "Por que salvar seus dados em JSON?",
    whyBackupDesc: "O Polyglot i+1 funciona com foco total em privacidade: seus dados ficam armazenados localmente no seu navegador. Exportar um arquivo JSON permite que você crie pontos de restauração e use o app em qualquer computador, tablet ou celular sem criar contas em servidores externos!",
    howToExportTitle: "1. Como Salvar (Exportar)",
    clickExportBtn: "Clique em \"Exportar Dados\":",
    exportStep1: "disponível nas Configurações ou logo abaixo.",
    downloadJson: "Download automático:",
    exportStep2: "um arquivo .json com a data atual é salvo nos seus Downloads.",
    safeStorage: "O que está incluído:",
    exportStep3: "seu vocabulário completo, nível CECR, dias de sequência, histórico de histórias lidas e sua chave API.",
    howToImportTitle: "2. Como Restaurar (Importar)",
    clickImportBtn: "Clique em \"Importar Dados\":",
    importStep1: "nas Configurações ou pelo botão abaixo.",
    selectJson: "Selecione o arquivo:",
    importStep2: "escolha o arquivo .json que você salvou anteriormente.",
    instantSync: "Restauração imediata:",
    importStep3: "o aplicativo recarrega todas as suas palavras, lições concluídas e chave de API na mesma hora!",
    exportNowBtn: "Exportar Meus Dados Agora",
    importNowBtn: "Importar Arquivo JSON",
    deviceSyncTipTitle: "Dica: Mudar de Dispositivo ou Navegador",
    deviceSyncTipDesc: "Você pode exportar o arquivo JSON no seu computador e importá-lo no celular (ou vice-versa) enviando o arquivo pelo WhatsApp, e-mail ou Google Drive para continuar sua sequência de dias de onde parou.",
    jsonPrivacyNote: "Os arquivos JSON pertencem a você e ficam 100% sob seu controle local.",
    apiKeyRequiredTitle: "Chave de API do Gemini Necessária",
    apiKeyPromptNotice: "Para gerar histórias no Método Natural (i+1) e criar revisões personalizadas para seu nível, é necessário cadastrar sua chave de API do Google Gemini. É 100% gratuito e rápido!",
    pasteKeyHerePrompt: "Cole sua chave da API abaixo:",
    howToGetAKey: "Como pegar grátis?",
    saveAndGenerate: "Salvar Chave e Continuar",
    viewStepByStepGuide: "Ver Tutorial Passo a Passo",
    apiKeySecurityBrief: "Sua chave é salva apenas localmente no navegador e nos backups JSON.",
    apiKeyRequiredPrompt: "Por favor, insira uma chave de API válida.",
    reviewNeedsKey: "Chave Necessária para Revisar",
    lessonNeedsKey: "Chave Necessária para Gerar Lição",
    clear: "Limpar",
    show: "Mostrar",
    hide: "Ocultar",
    srsReview: "Revisão Anki",
    srsTitle: "Revisão Espaçada (SRS / Anki)",
    srsSubtitle: "Curva do esquecimento e repetição espaçada para fixar cada frase i+1 na memória de longo prazo.",
    srsCardBackSetting: "Configuração do Verso",
    srsSelectBackMode: "O que você deseja ver no verso do card?",
    srsBackFull: "Tradução Completa da Frase",
    srsBackFullDesc: "Exibe a tradução completa em seu idioma nativo.",
    srsBackElement: "Tradução Apenas do Elemento i+1",
    srsBackElementDesc: "Foco exato no novo vocábulo ou elemento desconhecido.",
    srsBackDefinition: "Definição do Elemento no Idioma Alvo",
    srsBackDefinitionDesc: "Imersão pura: definição explicada na própria língua de estudo.",
    srsCardFront: "FRENTE (Frase i+1)",
    srsCardBack: "VERSO",
    srsShowAnswer: "Mostrar Resposta",
    srsPressSpace: "Pressione [Espaço] para virar o card",
    srsElementBadge: "Elemento i+1",
    srsFullTranslationLabel: "Tradução Completa da Frase",
    srsElementTranslationLabel: "Tradução do Elemento i+1",
    srsTargetDefinitionLabel: "Definição Imersiva no Idioma Alvo",
    srsHideOtherDetails: "Ocultar outros detalhes",
    srsShowOtherDetails: "Ver outros modos (tradução / definição extra)",
    srsRatePrompt: "Como foi a sua lembrança? (Classifique para a Curva do Esquecimento):",
    srsAgain: "Errei",
    srsHard: "Difícil",
    srsGood: "Bom",
    srsEasy: "Fácil",
    srsShortcutsHint: "Atalhos no teclado: [1] Errei • [2] Difícil • [3] Bom • [4] Fácil",
    srsDueToday: "Devidos Hoje",
    srsNewCards: "Novos (i+1)",
    srsLearningCards: "Em Aprendizado",
    srsMasteredCards: "Dominados",
    srsStartReviewBtn: "Iniciar Revisão de Hoje",
    srsCramBtn: "Praticar Modo Livre",
    srsGenerateNewStory: "Gerar Nova História i+1",
    srsForgettingCurveTitle: "A Curva do Esquecimento de Ebbinghaus",
    srsForgettingCurveSubtitle: "Como o algoritmo SM-2 transforma aprendizado efêmero em retenção permanente.",
    srsDeckExplorerTitle: "Deck de Histórias Concluídas",
    srsDeckExplorerSubtitle: "Cada lição concluída alimenta automaticamente seu deck com frases i+1.",
    srsNoCardsYet: "Seu Deck do Anki está vazio",
    srsNoCardsDesc: "Assim que você completar sua primeira história no Polyglot i+1, todas as frases e elementos novos serão automaticamente adicionados aqui para repetição espaçada!",
    srsGenerateFirstStory: "Criar Minha Primeira História",
    srsSessionDoneTitle: "Sessão de Revisão Concluída!",
    srsSessionDoneDesc: "Excelente trabalho! Você desafiou a curva do esquecimento e reforçou suas conexões neurais para o longo prazo.",
    srsReviewedCards: "Cards revisados",
    srsRememberedCount: "Lembrados",
    srsAgainCount: "Para reforçar",
    srsReturnToDeck: "Voltar ao Deck",
    srsCramMore: "Praticar Mais (Modo Livre)",
    srsFinishSession: "Sair",
    srsConfirmQuit: "Deseja encerrar a sessão de revisão antecipadamente?",
    srsSettingsTitle: "Revisão Espaçada (SRS / Anki)",
    srsSettingsSubtitle: "Configure como o verso de cada flashcard i+1 é apresentado durante as revisões de repetição espaçada."
  },
  es: {
    dashboard: "Panel",
    studyArea: "Área de Estudio",
    history: "Historial",
    settings: "Configuración",
    export: "Exportar Datos",
    import: "Importar Datos",
    welcome: "Bienvenido de nuevo",
    ready: "¿Listo para tu próximo avance i+1?",
    generate: "Generar Nueva Lección",
    review: "Revisar Palabras Conocidas",
    reviewDesc: "Consolida tus conocimientos con una historia larga utilizando únicamente palabras que ya conoces.",
    cefr: "Nivel CEFR",
    vocab: "Vocabulario Estimado",
    completed: "Lecciones Completadas",
    philosophy: "La Filosofía i+1",
    philosophyDesc: "El Método Natural propone que adquirimos el lenguaje de forma óptima cuando nos exponemos a contenidos solo un paso más allá de nuestro nivel actual (i+1).",
    startNow: "Comenzar ahora",
    consolidateNow: "Consolidar ahora",
    congrats: "¡Felicidades! Tu vocabulario ha crecido.",
    reviewCongrats: "¡Buen trabajo! Has consolidado tus conocimientos.",
    levelUp: "Tu nivel CEFR ha subido a ",
    importSuccess: "¡Progreso importado con éxito!",
    invalidFile: "Formato de archivo inválido.",
    notificationTitle: "¡Hora de Estudiar!",
    notificationBody: "No rompas tu racha. ¡Tu próxima lección i+1 te espera!",
    storySize: "Longitud de las Historias",
    short: "Cortas (5-10 oraciones)",
    standard: "Estándar (10 oraciones)",
    medium: "Medias (10-15 oraciones)",
    long: "Largas (15-25 oraciones)",
    dialect: "Variante de Dialecto",
    attic: "Griego Ático",
    koine: "Griego Koiné",
    focus: "Enfoque de Vocabulario",
    generalAttic: "Ático General",
    philosophicalAttic: "Filosófico (Platón/Aristóteles)",
    philosophicalDesc: "Léxico especializado: Platón y Aristóteles",
    shakespearean: "Inglés Shakespeareano",
    shakespeareanStyle: "Estilo Shakespeareano",
    generalShakespearean: "Isabelino Clásico",
    dramaShakespearean: "Tragedia y Drama (Macbeth/Hamlet)",
    courtlyShakespearean: "Cortesano y Romance (Sonetos/Comedias)",
    shakespeareanGeneralDesc: "Inglés isabelino clásico: pronombres arcaicos (thou/thee/thy), flexiones verbales (-eth/-est) y cadencia teatral.",
    shakespeareanDramaDesc: "Tragedia y drama épico: temas solemnes, destino, honor y monólogos poéticos.",
    shakespeareanCourtlyDesc: "Amor cortesano y sonetos: juegos de palabras, elegancia lírica e ingenio romántico.",
    loadStarterVocab: "Cargar Vocabulario Inicial",
    starterVocabLoaded: "Vocabulario inicial cargado para",
    streak: "Racha",
    dayStreak: "Días de Racha",
    days: "días",
    day: "día",
    streakActive: "¡Racha Activa Hoy!",
    keepStreak: "¡Completa una lección hoy para mantener tu racha!",
    streakBroken: "¡Completa una lección hoy para iniciar una nueva racha!",
    todayActive: "Activo",
    todayPending: "⚡ Pendiente hoy",
    searchVocab: "Buscar palabras aprendidas...",
    filterWords: "Filtrar Palabras",
    wordsLearned: "Vocabulario Aprendido",
    showing: "Mostrando",
    of: "de",
    words: "palabras",
    noWordsFound: "No se encontraron palabras coincidentes.",
    clearFilter: "Limpiar búsqueda",
    sortAZ: "A-Z",
    sortZA: "Z-A",
    sortDefault: "Por defecto",
    rawEdit: "Lista CSV",
    interactiveView: "Buscar y Filtrar",
    browseVocab: "Explorar Palabras",
    addWord: "Agregar Palabra",
    newWordPlaceholder: "Agregar nueva palabra al vocabulario...",
    dailyGoal: "Meta Diaria de Estudio",
    dailyGoalDesc: "Establece la cantidad de lecciones a completar por día",
    dailyGoalTarget: "lecciones / día",
    goalProgress: "Meta Diaria",
    goalAchieved: "¡Meta Alcanzada! 🎉",
    goalLeft: "restantes hoy",
    lesson: "lección",
    lessons: "lecciones",
    activityCalendar: "Calendario de Actividad",
    activityCalendarDesc: "Frecuencia diaria de estudio en los últimos 30 días",
    progressTimeline: "Evolución del Vocabulario",
    dailyVelocity: "Velocidad Diaria",
    wordsPerDay: "pal/día",
    mastery: "Dominio Completo",
    wordsRemainingFor: "palabras restantes para",
    maxLevelReached: "¡Nivel máximo alcanzado!",
    dailyGain: "Ganancia Diaria",
    less: "Menos",
    more: "Más",
    noLessonsOnDay: "Ninguna lección completada",
    lessonCompleted: "lección completada",
    lessonsCompleted: "lecciones completadas",
    customizeExperience: "Personaliza tu experiencia",
    displayName: "Nombre para Mostrar",
    learningPreferences: "Preferencias de Aprendizaje",
    targetLanguage: "Idioma Objetivo",
    customGoal: "Meta personalizada:",
    localization: "Localización",
    interfaceLanguage: "Idioma de la Interfaz",
    notificationsDisplay: "Notificaciones y Pantalla",
    studyNotifications: "Notificaciones de Estudio",
    dailyReminders: "Recordatorios diarios",
    saveChanges: "Guardar Cambios",
    saving: "Guardando...",
    saved: "¡Guardado con éxito!",
    vocabExplorerSubtitle: "Busca, filtra o gestiona el vocabulario utilizado por la IA para la generación precisa de i+1.",
    separateCommas: "Separa las palabras con comas. Los cambios se guardarán.",
    sendingWordsToAI: "Enviando palabras a Gemini para una generación precisa de i+1",
    noActiveLesson: "Ninguna Lección Activa",
    noActiveLessonDesc: "Genera una nueva historia personalizada para continuar tu aprendizaje.",
    generateMyStory: "Generar Nueva Lección",
    generatingLesson: "Creando tu lección personalizada con el Método Natural (i+1)...",
    hideTranslation: "Ocultar Traducción",
    showTranslation: "Mostrar Traducción",
    definition: "Definición",
    plusOneElement: "Elemento \"+1\"",
    pronunciationIPA: "Pronunciación (IPA)",
    sessionReview: "Revisión de la Sesión",
    lessonReview: "Revisión de la Lección",
    listenFullStory: "Escuchar Historia Completa",
    downloadAudio: "Descargar Audio (.wav)",
    reviewCompleted: "Revisión Completada",
    lessonCompletedBtn: "Lección Completada",
    learningHistory: "Historial de Aprendizaje",
    revisitBreakthroughs: "Revisa tus logros y lecciones anteriores",
    historyEmpty: "Tu lista de historias está vacía actualmente.",
    reopenLesson: "Reabrir lección",
    listenStory: "Escuchar historia",
    moreWords: "más",
    progressChart: "Gráfico de Progreso",
    progressChartDesc: "Crecimiento del vocabulario (palabras conocidas) en los últimos 30 días",
    thirtyDayGrowth: "Crecimiento 30d",
    thirtyDayLessons: "Lecciones 30d",
    activeDays: "Días Activos",
    cumulativeVocab: "Vocabulario Conocido Acumulado",
    current: "Actual:",
    learned: "Aprendidas:",
    noNewWords: "Sin palabras nuevas",
    today: "Hoy",
    calendarHint: "Haz clic o pasa el cursor sobre cualquier día para ver las lecciones completadas.",
    inActiveLexicon: "en tu vocabulario activo",
    close: "Cerrar",
    clickToCopy: "Clic para copiar",
    removeWord: "Eliminar",
    wordAlreadyExists: "ya está en tu lista de vocabulario conocido.",
    needMoreWordsForReview: "Necesitas al menos 20 palabras conocidas para una sesión de revisión de calidad.",
    level: "Nivel",
    reviewMode: "Modo de Revisión",
    errorGeneratingStory: "Error al generar la lección:",
    errorGeneratingReview: "Error al generar la lección de revisión:",
    apiKey: "Clave de API de Gemini",
    apiKeySubtitle: "Requerida para generar historias originales (i+1) y repasos de vocabulario con inteligencia artificial.",
    apiKeyPlaceholder: "Pega tu clave de Google Gemini (ej: AIzaSy...)",
    apiKeyConfigured: "Clave Configurada",
    apiKeyMissing: "Sin clave configurada",
    howToGetFreeKey: "Cómo obtener clave gratuita",
    apiKeyHelp: "Tu clave se almacena localmente en el navegador y en las copias JSON que exportes. Nunca se comparte.",
    dataManagementSubtitle: "Exporta tu vocabulario, historial y clave en formato JSON o restaura tu progreso.",
    backupRestoreGuideBtn: "Cómo guardar y restaurar (Guía)",
    freeAndQuick: "100% Gratuito y Rápido",
    howToGetApiKeyTitle: "Cómo Obtener tu Clave Gratuita de Gemini",
    howToGetApiKeySubtitle: "Google AI Studio te proporciona una clave gratuita con amplios límites para generar lecciones i+1 sin coste.",
    openGoogleStudio: "Abrir Google AI Studio",
    stepByStepTutorial: "Paso a Paso (menos de 1 minuto)",
    step1Title: "Entra al portal oficial de Google AI Studio",
    step1Desc: "Inicia sesión con tu cuenta de Google habitual (Gmail). No se requiere tarjeta de crédito ni pago.",
    step2Title: "Haz clic en \"Create API key\" (Crear clave)",
    step2Desc: "Elige \"Create API key in new project\" o selecciona un proyecto existente de tu cuenta.",
    step3Title: "Copia tu clave generada",
    step3Desc: "Tu clave suele comenzar con \"AIzaSy...\". Cópiala al portapapeles.",
    step4Title: "Pega tu clave en Polyglot i+1 y guarda",
    step4Desc: "Tu clave se guardará localmente en tu dispositivo y se incluirá en tus copias de seguridad JSON.",
    pasteKeyDirectly: "Pega tu clave aquí para guardarla ahora:",
    saveKey: "Guardar Clave",
    securityPrivacyTitle: "100% Seguro y Privado",
    securityPrivacyDesc: "Tu clave de API se almacena únicamente en tu navegador (localStorage) y en los archivos JSON exportados. Tus peticiones van directo a la API oficial de Google.",
    backupSystem: "Copia de Seguridad Local y Portátil",
    backupRestoreTitle: "Cómo Guardar y Restaurar tu Progreso (JSON)",
    backupRestoreSubtitle: "Aprende a respaldar tus datos, transferir tu aprendizaje entre dispositivos y no perder nunca tu racha.",
    whyBackupTitle: "¿Por qué guardar tus datos en JSON?",
    whyBackupDesc: "Polyglot i+1 está diseñado con máxima privacidad: todos tus datos permanecen en tu navegador. Exportar un archivo JSON te permite crear puntos de restauración y cambiar de dispositivo con facilidad.",
    howToExportTitle: "1. Cómo Guardar (Exportar)",
    clickExportBtn: "Haz clic en \"Exportar Datos\":",
    exportStep1: "disponible en Configuración o más abajo.",
    downloadJson: "Descarga automática:",
    exportStep2: "se descargará un archivo .json con la fecha actual.",
    safeStorage: "Qué se incluye:",
    exportStep3: "todo tu vocabulario, nivel CEFR, días de racha, historias completadas y tu clave de API.",
    howToImportTitle: "2. Cómo Restaurar (Importar)",
    clickImportBtn: "Haz clic en \"Importar Datos\":",
    importStep1: "en Configuración o más abajo.",
    selectJson: "Selecciona el archivo:",
    importStep2: "elige el archivo .json que descargaste anteriormente.",
    instantSync: "Restauración instantánea:",
    importStep3: "¡tu vocabulario, historial de lecciones y clave de API se restauran de inmediato!",
    exportNowBtn: "Exportar Mis Datos Ahora",
    importNowBtn: "Importar Archivo JSON",
    deviceSyncTipTitle: "Consejo: Cambiar entre Ordenador, Móvil o Tablet",
    deviceSyncTipDesc: "Exporta en tu ordenador, envíate el JSON al móvil (por Drive, correo o chat) e impórtalo para mantener tu racha activa donde vayas.",
    jsonPrivacyNote: "Los archivos JSON te pertenecen a ti y permanecen 100% bajo tu control local.",
    apiKeyRequiredTitle: "Clave de API de Gemini Requerida",
    apiKeyPromptNotice: "Para generar historias con el Método Natural (i+1) y crear repasos adaptados a tu nivel, necesitas registrar tu clave gratuita de la API de Google Gemini. ¡Es 100% gratis!",
    pasteKeyHerePrompt: "Pega tu clave de API aquí abajo:",
    howToGetAKey: "¿Cómo conseguirla gratis?",
    saveAndGenerate: "Guardar Clave y Continuar",
    viewStepByStepGuide: "Ver Tutorial Paso a Paso",
    apiKeySecurityBrief: "Tu clave se almacena exclusivamente de forma local y en tus backups JSON.",
    apiKeyRequiredPrompt: "Por favor, introduce una clave de API válida.",
    reviewNeedsKey: "Clave Requerida para Repasar",
    lessonNeedsKey: "Clave Requerida para Generar Lección",
    clear: "Borrar",
    show: "Mostrar",
    hide: "Ocultar",
    srsReview: "Repaso Anki",
    srsTitle: "Repaso Espaciado (SRS / Anki)",
    srsSubtitle: "Curva del olvido y repetición espaciada para fijar cada frase i+1 en la memoria a largo plazo.",
    srsCardBackSetting: "Configuración del Reverso",
    srsSelectBackMode: "¿Qué deseas ver en el reverso de la tarjeta?",
    srsBackFull: "Traducción Completa de la Frase",
    srsBackFullDesc: "Muestra la traducción completa en tu idioma nativo.",
    srsBackElement: "Traducción Solo del Elemento i+1",
    srsBackElementDesc: "Enfoque exacto en la palabra o elemento nuevo.",
    srsBackDefinition: "Definición en el Idioma de Estudio",
    srsBackDefinitionDesc: "Inmersión pura: definición explicada en el propio idioma objetivo.",
    srsCardFront: "FRENTE (Frase i+1)",
    srsCardBack: "REVERSO",
    srsShowAnswer: "Mostrar Respuesta",
    srsPressSpace: "Pulsa [Espacio] para girar la tarjeta",
    srsElementBadge: "Elemento i+1",
    srsFullTranslationLabel: "Traducción Completa de la Frase",
    srsElementTranslationLabel: "Traducción del Elemento i+1",
    srsTargetDefinitionLabel: "Definición Inmersiva en el Idioma Objetivo",
    srsHideOtherDetails: "Ocultar otros detalles",
    srsShowOtherDetails: "Ver otros modos (traducción / definición extra)",
    srsRatePrompt: "¿Cómo fue tu recuerdo? (Clasifica para la Curva del Olvido):",
    srsAgain: "Fallé",
    srsHard: "Difícil",
    srsGood: "Bien",
    srsEasy: "Fácil",
    srsShortcutsHint: "Atajos de teclado: [1] Fallé • [2] Difícil • [3] Bien • [4] Fácil",
    srsDueToday: "Pendientes Hoy",
    srsNewCards: "Nuevas (i+1)",
    srsLearningCards: "En Aprendizaje",
    srsMasteredCards: "Dominadas",
    srsStartReviewBtn: "Iniciar Repaso de Hoy",
    srsCramBtn: "Practicar Modo Libre",
    srsGenerateNewStory: "Generar Nueva Historia i+1",
    srsForgettingCurveTitle: "La Curva del Olvido de Ebbinghaus",
    srsForgettingCurveSubtitle: "Cómo el algoritmo SM-2 convierte el estudio efímero en memoria permanente.",
    srsDeckExplorerTitle: "Mazo de Historias Completadas",
    srsDeckExplorerSubtitle: "Cada lección completada nutre automáticamente tu mazo con tarjetas i+1.",
    srsNoCardsYet: "Tu Mazo de Anki está vacío",
    srsNoCardsDesc: "¡En cuanto completes tu primera historia en Polyglot i+1, todas las frases y elementos nuevos se añadirán aquí para repaso espaciado!",
    srsGenerateFirstStory: "Crear Mi Primera Historia",
    srsSessionDoneTitle: "¡Sesión de Repaso Completada!",
    srsSessionDoneDesc: "¡Excelente trabajo! Has desafiado la curva del olvido y reforzado tus conexiones neuronales a largo plazo.",
    srsReviewedCards: "Tarjetas repasadas",
    srsRememberedCount: "Recordadas",
    srsAgainCount: "A reforzar",
    srsReturnToDeck: "Volver al Mazo",
    srsCramMore: "Practicar Más (Modo Libre)",
    srsFinishSession: "Salir",
    srsConfirmQuit: "¿Deseas finalizar la sesión de repaso antes de tiempo?",
    srsSettingsTitle: "Repaso Espaciado (SRS / Anki)",
    srsSettingsSubtitle: "Configura cómo se muestra el reverso de cada tarjeta i+1 durante las sesiones de repaso espaciado."
  },
  fr: {
    dashboard: "Tableau de bord",
    studyArea: "Espace d'étude",
    history: "Historique",
    settings: "Paramètres",
    export: "Exporter les données",
    import: "Importer des données",
    welcome: "Bon retour",
    ready: "Prêt pour votre prochaine étape i+1 ?",
    generate: "Générer une leçon",
    review: "Réviser les mots connus",
    reviewDesc: "Consolidez vos acquis avec une longue histoire utilisant uniquement les mots que vous connaissez.",
    cefr: "Niveau CECR",
    vocab: "Vocabulaire estimé",
    completed: "Leçons terminées",
    philosophy: "La philosophie i+1",
    philosophyDesc: "La méthode naturelle suggère que nous acquérons une langue de manière optimale en étant exposé à un contenu juste un pas au-delà de notre niveau actuel (i+1).",
    startNow: "Commencer maintenant",
    consolidateNow: "Consolider maintenant",
    congrats: "Félicitations ! Votre vocabulaire s'est enrichi.",
    reviewCongrats: "Bravo ! Vous avez consolidé vos connaissances.",
    levelUp: "Votre niveau CECR est passé à ",
    importSuccess: "Progrès importés avec succès !",
    invalidFile: "Format de fichier non valide.",
    notificationTitle: "C'est l'heure d'étudier !",
    notificationBody: "Ne brisez pas votre série. Votre prochaine leçon i+1 vous attend !",
    storySize: "Longueur des histoires",
    short: "Courte (5-10 phrases)",
    standard: "Standard (10 phrases)",
    medium: "Moyenne (10-15 phrases)",
    long: "Longue (15-25 phrases)",
    dialect: "Variante dialectale",
    attic: "Grec attique",
    koine: "Grec koinè",
    focus: "Thématique du vocabulaire",
    generalAttic: "Attique général",
    philosophicalAttic: "Philosophique (Platon/Aristote)",
    philosophicalDesc: "Lexique spécialisé : Platon et Aristote",
    shakespearean: "Anglais shakespearien",
    shakespeareanStyle: "Style shakespearien",
    generalShakespearean: "Élisabéthain classique",
    dramaShakespearean: "Tragédie & Drame (Macbeth/Hamlet)",
    courtlyShakespearean: "Courtois & Romance (Sonnets/Comédies)",
    shakespeareanGeneralDesc: "Anglais élisabéthain classique : pronoms archaïques (thou/thee/thy), flexions verbales (-eth/-est) et cadence théâtrale.",
    shakespeareanDramaDesc: "Tragédie et drame épique : thèmes solennels, destin, honneur et monologues poétiques.",
    shakespeareanCourtlyDesc: "Amour courtois et sonnets : jeux de mots, élégance lyrique et finesse romantique.",
    loadStarterVocab: "Charger le vocabulaire initial",
    starterVocabLoaded: "Vocabulaire initial chargé pour",
    streak: "Série",
    dayStreak: "Jours consécutifs",
    days: "jours",
    day: "jour",
    streakActive: "Série active aujourd'hui !",
    keepStreak: "Complétez une leçon aujourd'hui pour garder votre série !",
    streakBroken: "Complétez une leçon aujourd'hui pour démarrer une nouvelle série !",
    todayActive: "Actif",
    todayPending: "⚡ En attente aujourd'hui",
    searchVocab: "Rechercher des mots connus...",
    filterWords: "Filtrer les mots",
    wordsLearned: "Vocabulaire appris",
    showing: "Affichage de",
    of: "sur",
    words: "mots",
    noWordsFound: "Aucun mot correspondant trouvé.",
    clearFilter: "Effacer la recherche",
    sortAZ: "A-Z",
    sortZA: "Z-A",
    sortDefault: "Par défaut",
    rawEdit: "Liste CSV",
    interactiveView: "Rechercher & Filtrer",
    browseVocab: "Explorer les mots",
    addWord: "Ajouter un mot",
    newWordPlaceholder: "Ajouter un nouveau mot au vocabulaire...",
    dailyGoal: "Objectif quotidien d'étude",
    dailyGoalDesc: "Définissez le nombre de leçons à terminer par jour",
    dailyGoalTarget: "leçons / jour",
    goalProgress: "Objectif quotidien",
    goalAchieved: "Objectif atteint ! 🎉",
    goalLeft: "restants aujourd'hui",
    lesson: "leçon",
    lessons: "leçons",
    activityCalendar: "Calendrier d'activité",
    activityCalendarDesc: "Fréquence quotidienne d'étude sur les 30 derniers jours",
    progressTimeline: "Évolution du vocabulaire",
    dailyVelocity: "Vélocité quotidienne",
    wordsPerDay: "mots/j",
    mastery: "Maîtrise totale",
    wordsRemainingFor: "mots restants pour",
    maxLevelReached: "Niveau maximum atteint !",
    dailyGain: "Gain quotidien",
    less: "Moins",
    more: "Plus",
    noLessonsOnDay: "Aucune leçon terminée",
    lessonCompleted: "leçon terminée",
    lessonsCompleted: "leçons terminées",
    customizeExperience: "Personnalisez votre expérience",
    displayName: "Nom d'affichage",
    learningPreferences: "Préférences d'apprentissage",
    targetLanguage: "Langue cible",
    customGoal: "Objectif personnalisé :",
    localization: "Localisation",
    interfaceLanguage: "Langue de l'interface",
    notificationsDisplay: "Notifications & Affichage",
    studyNotifications: "Notifications d'étude",
    dailyReminders: "Rappels quotidiens",
    saveChanges: "Enregistrer les modifications",
    saving: "Enregistrement...",
    saved: "Enregistré avec succès !",
    vocabExplorerSubtitle: "Recherchez, filtrez ou gérez le vocabulaire utilisé par l'IA pour la génération précise de i+1.",
    separateCommas: "Séparez les mots par des virgules. Les modifications seront enregistrées.",
    sendingWordsToAI: "Envoi des mots à Gemini pour une génération précise de i+1",
    noActiveLesson: "Aucune leçon active",
    noActiveLessonDesc: "Générez une nouvelle histoire sur mesure pour poursuivre votre parcours.",
    generateMyStory: "Générer une leçon",
    generatingLesson: "Création de votre leçon personnalisée avec la Méthode Naturelle (i+1)...",
    hideTranslation: "Masquer la traduction",
    showTranslation: "Afficher la traduction",
    definition: "Définition",
    plusOneElement: "L'élément « +1 »",
    pronunciationIPA: "Prononciation (API)",
    sessionReview: "Révision de la session",
    lessonReview: "Révision de la leçon",
    listenFullStory: "Écouter toute l'histoire",
    downloadAudio: "Télécharger l'audio (.wav)",
    reviewCompleted: "Révision terminée",
    lessonCompletedBtn: "Leçon terminée",
    learningHistory: "Historique d'apprentissage",
    revisitBreakthroughs: "Revivez vos progrès et leçons passées",
    historyEmpty: "Votre liste d'histoires est actuellement vide.",
    reopenLesson: "Rouvrir la leçon",
    listenStory: "Écouter l'histoire",
    moreWords: "de plus",
    progressChart: "Graphique de progression",
    progressChartDesc: "Croissance du vocabulaire (mots connus) sur les 30 derniers jours",
    thirtyDayGrowth: "Gain 30j",
    thirtyDayLessons: "Leçons 30j",
    activeDays: "Jours actifs",
    cumulativeVocab: "Vocabulaire cumulé connu",
    current: "Actuel :",
    learned: "Appris :",
    noNewWords: "Aucun nouveau mot",
    today: "Aujourd'hui",
    calendarHint: "Cliquez ou survolez un jour pour voir les leçons terminées.",
    inActiveLexicon: "dans votre lexique actif",
    close: "Fermer",
    clickToCopy: "Cliquer pour copier",
    removeWord: "Supprimer",
    wordAlreadyExists: "est déjà dans votre liste de vocabulaire connu.",
    needMoreWordsForReview: "Vous avez besoin d'au moins 20 mots connus pour une session de révision de qualité.",
    level: "Niveau",
    reviewMode: "Mode Révision",
    errorGeneratingStory: "Erreur lors de la génération de la leçon :",
    errorGeneratingReview: "Erreur lors de la génération de la révision :",
    apiKey: "Clé d'API Gemini",
    apiKeySubtitle: "Requise pour générer des histoires naturelles (i+1) et des révisions de vocabulaire personnalisées.",
    apiKeyPlaceholder: "Collez votre clé Google Gemini (ex: AIzaSy...)",
    apiKeyConfigured: "Clé configurée",
    apiKeyMissing: "Aucune clé configurée",
    howToGetFreeKey: "Comment obtenir une clé gratuite",
    apiKeyHelp: "Votre clé est enregistrée localement dans votre navigateur et dans vos sauvegardes JSON. Jamais partagée.",
    dataManagementSubtitle: "Exportez votre vocabulaire, historique et clé au format JSON ou restaurez votre progression.",
    backupRestoreGuideBtn: "Guide Sauvegarde & Restauration (JSON)",
    freeAndQuick: "100% Gratuit & Rapide",
    howToGetApiKeyTitle: "Comment Obtenir votre Clé Gratuite Gemini",
    howToGetApiKeySubtitle: "Google AI Studio vous fournit une clé API gratuite avec des quotas généreux pour étudier sans frais.",
    openGoogleStudio: "Ouvrir Google AI Studio",
    stepByStepTutorial: "Étape par étape (moins d'une minute)",
    step1Title: "Accédez au portail officiel Google AI Studio",
    step1Desc: "Connectez-vous avec votre compte Google standard (Gmail). Aucune carte de crédit n'est requise.",
    step2Title: "Cliquez sur \"Create API key\" (Créer une clé)",
    step2Desc: "Choisissez \"Create API key in new project\" ou sélectionnez un projet existant de votre compte Google.",
    step3Title: "Copiez la clé générée",
    step3Desc: "Votre clé commence généralement par \"AIzaSy...\". Copiez-la dans votre presse-papiers.",
    step4Title: "Collez votre clé dans Polyglot i+1 et enregistrez",
    step4Desc: "Votre clé sera stockée localement sur votre appareil et incluse dans vos sauvegardes JSON.",
    pasteKeyDirectly: "Collez votre clé ici pour l'enregistrer maintenant :",
    saveKey: "Enregistrer la Clé",
    securityPrivacyTitle: "100% Privé & Sécurisé",
    securityPrivacyDesc: "Votre clé API est stockée uniquement sur votre appareil (localStorage) et dans vos fichiers JSON exportés. Vos requêtes s'adressent directement à l'API officielle de Google.",
    backupSystem: "Sauvegarde Locale et Portable",
    backupRestoreTitle: "Comment Sauvegarder et Restaurer votre Progression (JSON)",
    backupRestoreSubtitle: "Apprenez à sauvegarder vos données, synchroniser vos appareils et ne jamais perdre votre série.",
    whyBackupTitle: "Pourquoi sauvegarder vos données en JSON ?",
    whyBackupDesc: "Polyglot i+1 respecte totalement votre vie privée : toutes vos données restent dans votre navigateur. Exporter un fichier JSON vous permet de créer des points de restauration et de changer d'appareil facilement !",
    howToExportTitle: "1. Comment Sauvegarder (Exporter)",
    clickExportBtn: "Cliquez sur \"Exporter les données\" :",
    exportStep1: "accessible dans les Paramètres ou ci-dessous.",
    downloadJson: "Téléchargement automatique :",
    exportStep2: "un fichier .json avec la date du jour sera téléchargé sur votre appareil.",
    safeStorage: "Ce qui est inclus :",
    exportStep3: "tout votre vocabulaire, niveau CECR, série de jours, historique des leçons et votre clé d'API.",
    howToImportTitle: "2. Comment Restaurer (Importer)",
    clickImportBtn: "Cliquez sur \"Importer des données\" :",
    importStep1: "dans les Paramètres ou ci-dessous.",
    selectJson: "Sélectionnez le fichier :",
    importStep2: "choisissez le fichier .json préalablement sauvegardé.",
    instantSync: "Restauration instantanée :",
    importStep3: "votre vocabulaire, vos leçons terminées et votre clé API sont restaurés immédiatement !",
    exportNowBtn: "Exporter Mes Données Maintenant",
    importNowBtn: "Importer un Fichier JSON",
    deviceSyncTipTitle: "Astuce : Passer de l'Ordinateur au Téléphone",
    deviceSyncTipDesc: "Exportez sur votre ordinateur, transférez le fichier JSON sur votre smartphone (Drive, e-mail) et importez-le pour continuer vos études n'importe où.",
    jsonPrivacyNote: "Les fichiers JSON vous appartiennent et restent 100% sous votre contrôle local.",
    apiKeyRequiredTitle: "Clé d'API Gemini Requise",
    apiKeyPromptNotice: "Pour générer des histoires avec la Méthode Naturelle (i+1) et réviser votre vocabulaire, vous devez enregistrer votre clé API gratuite Google Gemini.",
    pasteKeyHerePrompt: "Collez votre clé d'API ci-dessous :",
    howToGetAKey: "Comment l'obtenir gratuitement ?",
    saveAndGenerate: "Enregistrer la Clé & Continuer",
    viewStepByStepGuide: "Voir le Guide Étape par Étape",
    apiKeySecurityBrief: "Votre clé est enregistrée uniquement en local et dans vos sauvegardes JSON.",
    apiKeyRequiredPrompt: "Veuillez saisir une clé API Gemini valide.",
    reviewNeedsKey: "Clé API Requise pour Réviser",
    lessonNeedsKey: "Clé API Requise pour Générer une Leçon",
    clear: "Effacer",
    show: "Afficher",
    hide: "Masquer",
    srsReview: "Révision Anki",
    srsTitle: "Répétition Espacée (SRS / Anki)",
    srsSubtitle: "Courbe de l'oubli et répétition espacée pour ancrer chaque phrase i+1 dans la mémoire à long terme.",
    srsCardBackSetting: "Configuration du Verso",
    srsSelectBackMode: "Que souhaitez-vous voir au verso de la carte ?",
    srsBackFull: "Traduction Complète de la Phrase",
    srsBackFullDesc: "Affiche la traduction intégrale dans votre langue maternelle.",
    srsBackElement: "Traduction de l'Élément i+1 Uniquement",
    srsBackElementDesc: "Focus précis sur le nouveau mot ou élément inconnu.",
    srsBackDefinition: "Définition dans la Langue Cible",
    srsBackDefinitionDesc: "Immersion totale : définition rédigée dans la langue apprise.",
    srsCardFront: "RECTO (Phrase i+1)",
    srsCardBack: "VERSO",
    srsShowAnswer: "Afficher la Réponse",
    srsPressSpace: "Appuyez sur [Espace] pour retourner la carte",
    srsElementBadge: "Élément i+1",
    srsFullTranslationLabel: "Traduction Complète de la Phrase",
    srsElementTranslationLabel: "Traduction de l'Élément i+1",
    srsTargetDefinitionLabel: "Définition Immersive dans la Langue Cible",
    srsHideOtherDetails: "Masquer les autres détails",
    srsShowOtherDetails: "Voir d'autres modes (traduction / définition extra)",
    srsRatePrompt: "Comment était votre souvenir ? (Évaluez pour la Courbe de l'Oubli) :",
    srsAgain: "À revoir",
    srsHard: "Difficile",
    srsGood: "Correct",
    srsEasy: "Facile",
    srsShortcutsHint: "Raccourcis clavier : [1] À revoir • [2] Difficile • [3] Correct • [4] Facile",
    srsDueToday: "À réviser aujourd'hui",
    srsNewCards: "Nouvelles (i+1)",
    srsLearningCards: "En Apprentissage",
    srsMasteredCards: "Maîtrisées",
    srsStartReviewBtn: "Commencer la Révision du Jour",
    srsCramBtn: "Pratiquer en Mode Libre",
    srsGenerateNewStory: "Générer une Nouvelle Histoire i+1",
    srsForgettingCurveTitle: "La Courbe de l'Oubli d'Ebbinghaus",
    srsForgettingCurveSubtitle: "Comment l'algorithme SM-2 transforme l'exposition éphémère en mémoire permanente.",
    srsDeckExplorerTitle: "Paquet d'Histoires Terminées",
    srsDeckExplorerSubtitle: "Chaque leçon terminée enrichit automatiquement votre paquet de cartes i+1.",
    srsNoCardsYet: "Votre paquet Anki est vide",
    srsNoCardsDesc: "Dès que vous terminerez votre première histoire dans Polyglot i+1, toutes les phrases seront automatiquement ajoutées ici pour la répétition espacée !",
    srsGenerateFirstStory: "Créer Ma Première Histoire",
    srsSessionDoneTitle: "Session de Révision Terminée !",
    srsSessionDoneDesc: "Excellent travail ! Vous avez déjoué la courbe de l'oubli et consolidé vos réseaux neuronaux pour le long terme.",
    srsReviewedCards: "Cartes révisées",
    srsRememberedCount: "Mémorisées",
    srsAgainCount: "À renforcer",
    srsReturnToDeck: "Retour au Paquet",
    srsCramMore: "Pratiquer Plus (Mode Libre)",
    srsFinishSession: "Quitter",
    srsConfirmQuit: "Voulez-vous quitter la session de révision prématurément ?",
    srsSettingsTitle: "Répétition Espacée (SRS / Anki)",
    srsSettingsSubtitle: "Configurez l'affichage au verso de chaque carte i+1 pendant les sessions de répétition espacée."
  },
  de: {
    dashboard: "Dashboard",
    studyArea: "Lernbereich",
    history: "Verlauf",
    settings: "Einstellungen",
    export: "Daten exportieren",
    import: "Daten importieren",
    welcome: "Willkommen zurück",
    ready: "Bereit für deinen nächsten i+1-Schritt?",
    generate: "Neue Lektion erstellen",
    review: "Bekannte Wörter wiederholen",
    reviewDesc: "Festige dein Wissen mit einer langen Geschichte, die nur bereits bekannte Wörter verwendet.",
    cefr: "GER-Niveau",
    vocab: "Geschätzter Wortschatz",
    completed: "Abgeschlossene Lektionen",
    philosophy: "Die i+1-Philosophie",
    philosophyDesc: "Die Natürliche Methode besagt, dass wir Sprachen am besten lernen, wenn wir Inhalten ausgesetzt sind, die genau einen Schritt über unserem aktuellen Stand liegen (i+1).",
    startNow: "Jetzt starten",
    consolidateNow: "Jetzt festigen",
    congrats: "Glückwunsch! Dein Wortschatz ist gewachsen.",
    reviewCongrats: "Gute Arbeit! Du hast dein Wissen gefestigt.",
    levelUp: "Dein GER-Niveau hat sich verbessert auf ",
    importSuccess: "Fortschritt erfolgreich importiert!",
    invalidFile: "Ungültiges Dateiformat.",
    notificationTitle: "Zeit zum Lernen!",
    notificationBody: "Verliere nicht deine Serie. Deine nächste i+1-Lektion wartet!",
    storySize: "Geschichtenlänge",
    short: "Kurz (5-10 Sätze)",
    standard: "Standard (10 Sätze)",
    medium: "Mittel (10-15 Sätze)",
    long: "Lang (15-25 Sätze)",
    dialect: "Dialektvariante",
    attic: "Attisches Griechisch",
    koine: "Koine-Griechisch",
    focus: "Wortschatz-Schwerpunkt",
    generalAttic: "Allgemeines Attisch",
    philosophicalAttic: "Philosophisch (Platon/Aristoteles)",
    philosophicalDesc: "Fachwortschatz: Platon und Aristoteles",
    shakespearean: "Shakespeare-Englisch",
    shakespeareanStyle: "Shakespeare-Stil",
    generalShakespearean: "Klassisch Elisabethanisch",
    dramaShakespearean: "Tragödie & Drama (Macbeth/Hamlet)",
    courtlyShakespearean: "Höfisch & Romantisch (Sonette/Komödien)",
    shakespeareanGeneralDesc: "Klassisches elisabethanisches Englisch: archaische Pronomen (thou/thee/thy), Verbendungen (-eth/-est) und dramatische Kadenz.",
    shakespeareanDramaDesc: "Epische Tragödie und Drama: ernste Themen, Schicksal, Ehre und poetische Monologe.",
    shakespeareanCourtlyDesc: "Höfische Romanze und Sonette: Wortspiele, lyrische Eleganz und romantischer Witz.",
    loadStarterVocab: "Start-Wortschatz laden",
    starterVocabLoaded: "Start-Wortschatz geladen für",
    streak: "Serie",
    dayStreak: "Tages-Serie",
    days: "Tage",
    day: "Tag",
    streakActive: "Serie heute aktiv!",
    keepStreak: "Schließe heute eine Lektion ab, um deine Serie zu halten!",
    streakBroken: "Schließe heute eine Lektion ab, um eine neue Serie zu starten!",
    todayActive: "Aktiv",
    todayPending: "⚡ Heute ausstehend",
    searchVocab: "Bekannte Wörter suchen...",
    filterWords: "Wörter filtern",
    wordsLearned: "Gelernter Wortschatz",
    showing: "Anzeige von",
    of: "von",
    words: "Wörtern",
    noWordsFound: "Keine passenden Wörter gefunden.",
    clearFilter: "Suche löschen",
    sortAZ: "A-Z",
    sortZA: "Z-A",
    sortDefault: "Standard",
    rawEdit: "CSV-Rohdaten",
    interactiveView: "Suchen & Filtern",
    browseVocab: "Wörter erkunden",
    addWord: "Wort hinzufügen",
    newWordPlaceholder: "Neues Wort zum Wortschatz hinzufügen...",
    dailyGoal: "Tägliches Lernziel",
    dailyGoalDesc: "Lege die Anzahl der täglich abzuschließenden Lektionen fest",
    dailyGoalTarget: "Lektionen / Tag",
    goalProgress: "Tagesziel",
    goalAchieved: "Ziel erreicht! 🎉",
    goalLeft: "heute übrig",
    lesson: "Lektion",
    lessons: "Lektionen",
    activityCalendar: "Aktivitätskalender",
    activityCalendarDesc: "Tägliche Lernhäufigkeit in den letzten 30 Tagen",
    progressTimeline: "Wortschatz-Entwicklung",
    dailyVelocity: "Tägliche Geschwindigkeit",
    wordsPerDay: "W./Tag",
    mastery: "Vollständige Beherrschung",
    wordsRemainingFor: "Wörter verbleibend für",
    maxLevelReached: "Höchststufe erreicht!",
    dailyGain: "Täglicher Zuwachs",
    less: "Weniger",
    more: "Mehr",
    noLessonsOnDay: "Keine Lektionen abgeschlossen",
    lessonCompleted: "Lektion abgeschlossen",
    lessonsCompleted: "Lektionen abgeschlossen",
    customizeExperience: "Passe dein Erlebnis an",
    displayName: "Anzeigename",
    learningPreferences: "Lerneinstellungen",
    targetLanguage: "Zielsprache",
    customGoal: "Eigenes Ziel:",
    localization: "Lokalisierung",
    interfaceLanguage: "Sprache der Benutzeroberfläche",
    notificationsDisplay: "Benachrichtigungen & Anzeige",
    studyNotifications: "Lernbenachrichtigungen",
    dailyReminders: "Tägliche Erinnerungen",
    saveChanges: "Änderungen speichern",
    saving: "Speichern...",
    saved: "Erfolgreich gespeichert!",
    vocabExplorerSubtitle: "Suche, filtere oder verwalte den von Gemini für präzise i+1-Generierung verwendeten Wortschatz.",
    separateCommas: "Wörter durch Kommas trennen. Änderungen werden gespeichert.",
    sendingWordsToAI: "Wörter an Gemini senden für präzise i+1-Generierung",
    noActiveLesson: "Keine aktive Lektion",
    noActiveLessonDesc: "Erstelle eine neue maßgeschneiderte Geschichte für deine Lernreise.",
    generateMyStory: "Neue Lektion erstellen",
    generatingLesson: "Erstelle deine individuelle Lektion nach der Natürlichen Methode (i+1)...",
    hideTranslation: "Übersetzung ausblenden",
    showTranslation: "Übersetzung anzeigen",
    definition: "Definition",
    plusOneElement: "Das „+1“-Element",
    pronunciationIPA: "Aussprache (IPA)",
    sessionReview: "Sitzungswiederholung",
    lessonReview: "Lektionswiederholung",
    listenFullStory: "Ganze Geschichte anhören",
    downloadAudio: "Audio herunterladen (.wav)",
    reviewCompleted: "Wiederholung abgeschlossen",
    lessonCompletedBtn: "Lektion abgeschlossen",
    learningHistory: "Lernverlauf",
    revisitBreakthroughs: "Erlebe deine vergangenen Fortschritte erneut",
    historyEmpty: "Deine Geschichtenliste ist derzeit leer.",
    reopenLesson: "Lektion erneut öffnen",
    listenStory: "Geschichte anhören",
    moreWords: "mehr",
    progressChart: "Fortschrittsdiagramm",
    progressChartDesc: "Wortschatzwachstum (bekannte Wörter) in den letzten 30 Tagen",
    thirtyDayGrowth: "30-Tage-Zuwachs",
    thirtyDayLessons: "30-Tage-Lektionen",
    activeDays: "Aktive Tage",
    cumulativeVocab: "Kumulierter bekannter Wortschatz",
    current: "Aktuell:",
    learned: "Gelernt:",
    noNewWords: "Keine neuen Wörter",
    today: "Heute",
    calendarHint: "Klicke oder fahre mit der Maus über einen Tag, um die Lektionen anzuzeigen.",
    inActiveLexicon: "in deinem aktiven Wortschatz",
    close: "Schließen",
    clickToCopy: "Zum Kopieren klicken",
    removeWord: "Entfernen",
    wordAlreadyExists: "ist bereits in deiner Wortschatzliste vorhanden.",
    needMoreWordsForReview: "Du benötigst mindestens 20 bekannte Wörter für eine hochwertige Wiederholungssitzung.",
    level: "Stufe",
    reviewMode: "Wiederholungsmodus",
    errorGeneratingStory: "Fehler beim Erstellen der Lektion:",
    errorGeneratingReview: "Fehler beim Erstellen der Wiederholungslektion:",
    apiKey: "Gemini-API-Schlüssel",
    apiKeySubtitle: "Erforderlich zur Erstellung von KI-gestützten Naturmethode-Geschichten (i+1) und Wortschatzwiederholungen.",
    apiKeyPlaceholder: "Fügen Sie Ihren Google Gemini-Schlüssel ein (z. B. AIzaSy...)",
    apiKeyConfigured: "Schlüssel konfiguriert",
    apiKeyMissing: "Kein Schlüssel konfiguriert",
    howToGetFreeKey: "Kostenlosen Schlüssel erhalten",
    apiKeyHelp: "Ihr Schlüssel wird lokal in Ihrem Browser und in Ihren JSON-Backups gespeichert. Niemals geteilt.",
    dataManagementSubtitle: "Exportieren Sie Ihren Wortschatz, Verlauf und Schlüssel als JSON oder stellen Sie Ihren Fortschritt wieder her.",
    backupRestoreGuideBtn: "Anleitung: Speichern & Wiederherstellen (JSON)",
    freeAndQuick: "100% Kostenlos & Schnell",
    howToGetApiKeyTitle: "So erhalten Sie Ihren kostenlosen Gemini-Schlüssel",
    howToGetApiKeySubtitle: "Google AI Studio bietet Ihnen einen kostenlosen API-Schlüssel mit großzügigen Kontingenten.",
    openGoogleStudio: "Google AI Studio öffnen",
    stepByStepTutorial: "Schritt-für-Schritt-Anleitung (unter 1 Minute)",
    step1Title: "Offizielles Google AI Studio Portal aufrufen",
    step1Desc: "Melden Sie sich mit Ihrem normalen Google-Konto an. Keine Kreditkarte oder Zahlung erforderlich.",
    step2Title: "Auf \"Create API key\" (Schlüssel erstellen) klicken",
    step2Desc: "Wählen Sie \"Create API key in new project\" oder ein bestehendes Projekt aus.",
    step3Title: "Generierten Schlüssel kopieren",
    step3Desc: "Ihr Schlüssel beginnt meist mit \"AIzaSy...\". In die Zwischenablage kopieren.",
    step4Title: "In Polyglot i+1 einfügen und speichern",
    step4Desc: "Ihr Schlüssel wird sicher auf Ihrem Gerät gespeichert und in Ihre JSON-Backups aufgenommen.",
    pasteKeyDirectly: "Schlüssel hier einfügen und jetzt speichern:",
    saveKey: "Schlüssel Speichern",
    securityPrivacyTitle: "100% Privat & Sicher",
    securityPrivacyDesc: "Ihr API-Schlüssel wird nur auf Ihrem Gerät (localStorage) und in exportierten JSON-Dateien gespeichert. Anfragen gehen direkt an die offizielle Google-API.",
    backupSystem: "Lokale & Tragbare Sicherung",
    backupRestoreTitle: "Fortschritt Speichern und Wiederherstellen (JSON)",
    backupRestoreSubtitle: "Erfahren Sie, wie Sie Ihre Daten sichern, auf andere Geräte übertragen und Ihren Lernstand nie verlieren.",
    whyBackupTitle: "Warum Daten als JSON sichern?",
    whyBackupDesc: "Polyglot i+1 legt höchsten Wert auf Datenschutz: Alle Daten bleiben in Ihrem Browser. Durch den Export einer JSON-Datei können Sie Wiederherstellungspunkte anlegen und Geräte problemlos wechseln!",
    howToExportTitle: "1. So Speichern Sie (Exportieren)",
    clickExportBtn: "Auf \"Daten exportieren\" klicken:",
    exportStep1: "in den Einstellungen oder unten verfügbar.",
    downloadJson: "Automatischer Download:",
    exportStep2: "eine .json-Datei mit dem heutigen Datum wird heruntergeladen.",
    safeStorage: "Was gespeichert wird:",
    exportStep3: "alle gelernten Wörter, GER-Niveau, Tages-Serie, Lektionsverlauf und Ihr API-Schlüssel.",
    howToImportTitle: "2. So Stellen Sie Wieder Her (Importieren)",
    clickImportBtn: "Auf \"Daten importieren\" klicken:",
    importStep1: "in den Einstellungen oder unten.",
    selectJson: "Datei auswählen:",
    importStep2: "wählen Sie Ihre zuvor gespeicherte .json-Datei aus.",
    instantSync: "Sofortige Wiederherstellung:",
    importStep3: "Wortschatz, abgeschlossene Lektionen und API-Schlüssel werden sofort geladen!",
    exportNowBtn: "Meine Daten Jetzt Exportieren",
    importNowBtn: "JSON-Datei Jetzt Importieren",
    deviceSyncTipTitle: "Tipp: Wechsel zwischen Computer, Handy & Tablet",
    deviceSyncTipDesc: "Exportieren Sie auf dem PC, senden Sie die JSON-Datei an Ihr Smartphone und importieren Sie sie dort, um Ihre tägliche Serie fortzusetzen.",
    jsonPrivacyNote: "JSON-Dateien gehören Ihnen und bleiben 100% unter Ihrer lokalen Kontrolle.",
    apiKeyRequiredTitle: "Gemini-API-Schlüssel Erforderlich",
    apiKeyPromptNotice: "Um Geschichten mit der Natürlichen Methode (i+1) zu generieren und Ihren Wortschatz zu wiederholen, tragen Sie bitte Ihren kostenlosen Google Gemini-API-Schlüssel ein.",
    pasteKeyHerePrompt: "Fügen Sie Ihren API-Schlüssel unten ein:",
    howToGetAKey: "Wie bekomme ich einen kostenlos?",
    saveAndGenerate: "Schlüssel Speichern & Fortfahren",
    viewStepByStepGuide: "Schritt-für-Schritt-Anleitung ansehen",
    apiKeySecurityBrief: "Ihr Schlüssel wird nur lokal und in Ihren JSON-Backups gespeichert.",
    apiKeyRequiredPrompt: "Bitte geben Sie einen gültigen Gemini-API-Schlüssel ein.",
    reviewNeedsKey: "API-Schlüssel für Wiederholung erforderlich",
    lessonNeedsKey: "API-Schlüssel für Lektion erforderlich",
    clear: "Löschen",
    show: "Anzeigen",
    hide: "Verbergen",
    srsReview: "Anki-Wiederholung",
    srsTitle: "Spaced Repetition (SRS / Anki)",
    srsSubtitle: "Vergessenskurve und verteilte Wiederholung, um jeden i+1-Satz dauerhaft im Langzeitgedächtnis zu verankern.",
    srsCardBackSetting: "Rückseiten-Konfiguration",
    srsSelectBackMode: "Was soll auf der Kartenrückseite angezeigt werden?",
    srsBackFull: "Vollständige Satzübersetzung",
    srsBackFullDesc: "Zeigt die komplette Übersetzung in Ihrer Muttersprache an.",
    srsBackElement: "Nur Übersetzung des i+1-Elements",
    srsBackElementDesc: "Exakter Fokus auf das neue Wort oder die unbekannte Struktur.",
    srsBackDefinition: "Definition in der Zielsprache",
    srsBackDefinitionDesc: "Reine Immersion: Definition direkt in der gelernten Sprache.",
    srsCardFront: "VORDERSEITE (i+1-Satz)",
    srsCardBack: "RÜCKSEITE",
    srsShowAnswer: "Antwort Anzeigen",
    srsPressSpace: "Drücken Sie [Leertaste] zum Umdrehen",
    srsElementBadge: "i+1-Element",
    srsFullTranslationLabel: "Vollständige Satzübersetzung",
    srsElementTranslationLabel: "Übersetzung des i+1-Elements",
    srsTargetDefinitionLabel: "Immersive Definition in der Zielsprache",
    srsHideOtherDetails: "Weitere Details ausblenden",
    srsShowOtherDetails: "Andere Modi anzeigen (Übersetzung / Definition)",
    srsRatePrompt: "Wie gut haben Sie sich erinnert? (Bewerten für die Vergessenskurve):",
    srsAgain: "Nochmal",
    srsHard: "Schwer",
    srsGood: "Gut",
    srsEasy: "Einfach",
    srsShortcutsHint: "Tastaturkürzel: [1] Nochmal • [2] Schwer • [3] Gut • [4] Einfach",
    srsDueToday: "Heute fällig",
    srsNewCards: "Neu (i+1)",
    srsLearningCards: "Im Lernprozess",
    srsMasteredCards: "Gemeistert",
    srsStartReviewBtn: "Heutige Wiederholung starten",
    srsCramBtn: "Freier Übungsmodus",
    srsGenerateNewStory: "Neue i+1-Geschichte erstellen",
    srsForgettingCurveTitle: "Die Ebbinghaus-Vergessenskurve",
    srsForgettingCurveSubtitle: "Wie der SM-2-Algorithmus flüchtige Eindrücke in dauerhaftes Wissen verwandelt.",
    srsDeckExplorerTitle: "Stapel abgeschlossener Geschichten",
    srsDeckExplorerSubtitle: "Jede fertige Lektion speist automatisch i+1-Lernkarten in Ihren Stapel ein.",
    srsNoCardsYet: "Ihr Anki-Stapel ist leer",
    srsNoCardsDesc: "Sobald Sie Ihre erste Geschichte in Polyglot i+1 abschließen, werden alle Sätze automatisch hier zur verteilten Wiederholung hinzugefügt!",
    srsGenerateFirstStory: "Erste Geschichte erstellen",
    srsSessionDoneTitle: "Wiederholungssitzung Abgeschlossen!",
    srsSessionDoneDesc: "Hervorragende Arbeit! Sie haben der Vergessenskurve getrotzt und Ihre neuronalen Bahnen langfristig gefestigt.",
    srsReviewedCards: "Karten wiederholt",
    srsRememberedCount: "Erinnert",
    srsAgainCount: "Zur Festigung",
    srsReturnToDeck: "Zurück zum Stapel",
    srsCramMore: "Weiter üben (Freier Modus)",
    srsFinishSession: "Beenden",
    srsConfirmQuit: "Möchten Sie die Wiederholungssitzung vorzeitig beenden?",
    srsSettingsTitle: "Spaced Repetition (SRS / Anki)",
    srsSettingsSubtitle: "Konfigurieren Sie, wie die Rückseite jeder i+1-Lernkarte bei der verteilten Wiederholung dargestellt wird."
  },
  it: {
    dashboard: "Dashboard",
    studyArea: "Area di Studio",
    history: "Cronologia",
    settings: "Impostazioni",
    export: "Esporta Dati",
    import: "Importa Dati",
    welcome: "Bentornato",
    ready: "Pronto per il tuo prossimo passo i+1?",
    generate: "Genera Nuova Lezione",
    review: "Ripassa Parole Note",
    reviewDesc: "Consolida le tue conoscenze con una lunga storia utilizzando solo parole che già conosci.",
    cefr: "Livello QCER",
    vocab: "Vocabolario Stimato",
    completed: "Lezioni Completate",
    philosophy: "La Filosofia i+1",
    philosophyDesc: "Il Metodo Naturale suggerisce che acquisiamo meglio una lingua quando siamo esposti a input appena un passo oltre il nostro livello attuale (i+1).",
    startNow: "Inizia ora",
    consolidateNow: "Consolida ora",
    congrats: "Congratulazioni! Il tuo vocabolario è cresciuto.",
    reviewCongrats: "Ottimo lavoro! Hai consolidato le tue conoscenze.",
    levelUp: "Il tuo livello QCER è passato a ",
    importSuccess: "Progresso importato con successo!",
    invalidFile: "Formato di file non valido.",
    notificationTitle: "È ora di studiare!",
    notificationBody: "Non interrompere la tua serie. La tua prossima lezione i+1 ti aspetta!",
    storySize: "Lunghezza della Storia",
    short: "Breve (5-10 frasi)",
    standard: "Standard (10 frasi)",
    medium: "Media (10-15 frasi)",
    long: "Lunga (15-25 frasi)",
    dialect: "Variante Dialettale",
    attic: "Greco Attico",
    koine: "Greco Koinè",
    focus: "Focus Vocabolario",
    generalAttic: "Attico Generale",
    philosophicalAttic: "Filosofico (Platone/Aristotele)",
    philosophicalDesc: "Lessico specializzato: Platone e Aristotele",
    shakespearean: "Inglese Shakespeariano",
    shakespeareanStyle: "Stile Shakespeariano",
    generalShakespearean: "Elisabettiano Classico",
    dramaShakespearean: "Tragedia e Dramma (Macbeth/Hamlet)",
    courtlyShakespearean: "Cortese e Romantico (Sonetti/Commedie)",
    shakespeareanGeneralDesc: "Inglese elisabettiano classico: pronomi arcaici (thou/thee/thy), inflessioni verbali (-eth/-est) e cadenza teatrale.",
    shakespeareanDramaDesc: "Tragedia e dramma epico: temi solenni, destino, onore e soliloqui poetici.",
    shakespeareanCourtlyDesc: "Amore cortese e sonetti: giochi di parole, eleganza lirica e romanticismo arguto.",
    loadStarterVocab: "Carica Vocabolario Iniziale",
    starterVocabLoaded: "Vocabolario iniziale caricato per",
    streak: "Serie",
    dayStreak: "Giorni Consecutivi",
    days: "giorni",
    day: "giorno",
    streakActive: "Serie Attiva Oggi!",
    keepStreak: "Completa una lezione oggi per mantenere la tua serie!",
    streakBroken: "Completa una lezione oggi per iniziare una nuova serie!",
    todayActive: "Attivo",
    todayPending: "⚡ In sospeso oggi",
    searchVocab: "Cerca parole note...",
    filterWords: "Filtra Parole",
    wordsLearned: "Vocabolario Appreso",
    showing: "Visualizzati",
    of: "di",
    words: "parole",
    noWordsFound: "Nessuna parola corrispondente trovata.",
    clearFilter: "Cancella ricerca",
    sortAZ: "A-Z",
    sortZA: "Z-A",
    sortDefault: "Predefinito",
    rawEdit: "Lista CSV",
    interactiveView: "Cerca & Filtra",
    browseVocab: "Esplora Parole",
    addWord: "Aggiungi Parola",
    newWordPlaceholder: "Aggiungi nuova parola al vocabolario...",
    dailyGoal: "Obiettivo Giornaliero di Studio",
    dailyGoalDesc: "Imposta il numero di lezioni da completare ogni giorno",
    dailyGoalTarget: "lezioni / giorno",
    goalProgress: "Obiettivo Giornaliero",
    goalAchieved: "Obiettivo Raggiunto! 🎉",
    goalLeft: "rimasti oggi",
    lesson: "lezione",
    lessons: "lezioni",
    activityCalendar: "Calendario delle Attività",
    activityCalendarDesc: "Frequenza giornaliera di studio negli ultimi 30 giorni",
    progressTimeline: "Evoluzione del Vocabolario",
    dailyVelocity: "Velocità Giornaliera",
    wordsPerDay: "par/g",
    mastery: "Padronanza Completa",
    wordsRemainingFor: "parole rimanenti per",
    maxLevelReached: "Livello massimo raggiunto!",
    dailyGain: "Guadagno Giornaliero",
    less: "Meno",
    more: "Più",
    noLessonsOnDay: "Nessuna lezione completata",
    lessonCompleted: "lezione completata",
    lessonsCompleted: "lezioni completate",
    customizeExperience: "Personalizza la tua esperienza",
    displayName: "Nome Visualizzato",
    learningPreferences: "Preferenze di Apprendimento",
    targetLanguage: "Lingua di Studio",
    customGoal: "Obiettivo personalizzato:",
    localization: "Localizzazione",
    interfaceLanguage: "Lingua dell'Interfaccia",
    notificationsDisplay: "Notifiche & Display",
    studyNotifications: "Notifiche di Studio",
    dailyReminders: "Promemoria giornalieri",
    saveChanges: "Salva Modifiche",
    saving: "Salvataggio...",
    saved: "Salvato con successo!",
    vocabExplorerSubtitle: "Cerca, filtra o gestisci il vocabolario utilizzato da Gemini per una generazione precisa di i+1.",
    separateCommas: "Separa le parole con virgole. Le modifiche verranno salvate.",
    sendingWordsToAI: "Invio delle parole a Gemini per una generazione precisa di i+1",
    noActiveLesson: "Nessuna Lezione Attiva",
    noActiveLessonDesc: "Genera una nuova storia su misura per continuare il tuo percorso di apprendimento.",
    generateMyStory: "Genera Nuova Lezione",
    generatingLesson: "Creazione della tua lezione personalizzata con il Metodo Naturale (i+1)...",
    hideTranslation: "Nascondi Traduzione",
    showTranslation: "Mostra Traduzione",
    definition: "Definizione",
    plusOneElement: "L'Elemento \"+1\"",
    pronunciationIPA: "Pronuncia (IPA)",
    sessionReview: "Revisione della Sessione",
    lessonReview: "Revisione della Lezione",
    listenFullStory: "Ascolta Tutta la Storia",
    downloadAudio: "Scarica Audio (.wav)",
    reviewCompleted: "Revisione Completata",
    lessonCompletedBtn: "Lezione Completata",
    learningHistory: "Cronologia di Apprendimento",
    revisitBreakthroughs: "Ripercorri i tuoi progressi passati",
    historyEmpty: "La tua cronologia di storie è attualmente vuota.",
    reopenLesson: "Riapri lezione",
    listenStory: "Ascolta storia",
    moreWords: "altre",
    progressChart: "Grafico dei Progressi",
    progressChartDesc: "Crescita del vocabolario (parole note) negli ultimi 30 giorni",
    thirtyDayGrowth: "Crescita 30g",
    thirtyDayLessons: "Lezioni 30g",
    activeDays: "Giorni Attivi",
    cumulativeVocab: "Vocabolario Noto Cumulativo",
    current: "Attuale:",
    learned: "Apprese:",
    noNewWords: "Nessuna parola nuova",
    today: "Oggi",
    calendarHint: "Fai clic o passa il mouse su qualsiasi giorno per visualizzare le lezioni completate.",
    inActiveLexicon: "nel tuo lessico attivo",
    close: "Chiudi",
    clickToCopy: "Clicca per copiare",
    removeWord: "Rimuovi",
    wordAlreadyExists: "è già presente nel tuo elenco di vocaboli noti.",
    needMoreWordsForReview: "Hai bisogno di almeno 20 parole note per una sessione di ripasso di qualità.",
    level: "Livello",
    reviewMode: "Modalità Ripasso",
    errorGeneratingStory: "Errore durante la generazione della lezione:",
    errorGeneratingReview: "Errore durante la generazione del ripasso:",
    apiKey: "Chiave API Gemini",
    apiKeySubtitle: "Richiesta per generare storie naturali (i+1) e sessioni di ripasso con intelligenza artificiale.",
    apiKeyPlaceholder: "Incolla la tua chiave Google Gemini (es: AIzaSy...)",
    apiKeyConfigured: "Chiave configurata",
    apiKeyMissing: "Nessuna chiave configurata",
    howToGetFreeKey: "Ottieni una chiave gratuita",
    apiKeyHelp: "La tua chiave viene salvata localmente nel browser e nei tuoi backup JSON. Mai condivisa.",
    dataManagementSubtitle: "Esporta vocabolario, cronologia e chiave in JSON o ripristina i tuoi progressi.",
    backupRestoreGuideBtn: "Guida: Salva & Ripristina (JSON)",
    freeAndQuick: "100% Gratuito & Rapido",
    howToGetApiKeyTitle: "Come Ottenere la tua Chiave Gratuita di Gemini",
    howToGetApiKeySubtitle: "Google AI Studio offre una chiave API gratuita con quote generose per esercitarti senza costi.",
    openGoogleStudio: "Apri Google AI Studio",
    stepByStepTutorial: "Passo dopo passo (meno di 1 minuto)",
    step1Title: "Accedi al portale ufficiale di Google AI Studio",
    step1Desc: "Accedi con il tuo consueto account Google (Gmail). Non è richiesta alcuna carta di credito.",
    step2Title: "Fai clic su \"Create API key\" (Crea chiave)",
    step2Desc: "Scegli \"Create API key in new project\" o seleziona un progetto esistente nel tuo account.",
    step3Title: "Copia la chiave generata",
    step3Desc: "La tua chiave inizia solitamente con \"AIzaSy...\". Copiala negli appunti.",
    step4Title: "Incolla la chiave in Polyglot i+1 e salva",
    step4Desc: "La tua chiave sarà salvata localmente sul tuo dispositivo e inclusa nei tuoi backup JSON.",
    pasteKeyDirectly: "Incolla qui la chiave per salvarla subito:",
    saveKey: "Salva Chiave",
    securityPrivacyTitle: "100% Privato & Sicuro",
    securityPrivacyDesc: "La tua chiave API è salvata solo sul tuo dispositivo (localStorage) e nei backup JSON esportati. Le richieste raggiungono direttamente l'API ufficiale di Google.",
    backupSystem: "Backup Locale e Portatile",
    backupRestoreTitle: "Come Salvare e Ripristinare i tuoi Progressi (JSON)",
    backupRestoreSubtitle: "Scopri come eseguire il backup dei dati, sincronizzare lo studio tra dispositivi e non perdere la serie.",
    whyBackupTitle: "Perché salvare i dati in JSON?",
    whyBackupDesc: "Polyglot i+1 garantisce la massima privacy: tutti i tuoi dati rimangono nel browser. Esportare un file JSON ti consente di creare punti di ripristino e cambiare dispositivo senza sforzo!",
    howToExportTitle: "1. Come Salvare (Esportare)",
    clickExportBtn: "Fai clic su \"Esporta Dati\":",
    exportStep1: "disponibile nelle Impostazioni o in basso.",
    downloadJson: "Download automatico:",
    exportStep2: "un file .json con la data odierna verrà salvato sul tuo dispositivo.",
    safeStorage: "Cosa viene salvato:",
    exportStep3: "tutto il vocabolario appreso, livello QCER, serie di giorni, storie completate e la tua chiave API.",
    howToImportTitle: "2. Come Ripristinare (Importare)",
    clickImportBtn: "Fai clic su \"Importa Dati\":",
    importStep1: "nelle Impostazioni o in basso.",
    selectJson: "Seleziona il file:",
    importStep2: "scegli il file .json salvato in precedenza.",
    instantSync: "Ripristino istantaneo:",
    importStep3: "il tuo vocabolario, le lezioni completate e la tua chiave API vengono ripristinati subito!",
    exportNowBtn: "Esporta i Miei Dati Ora",
    importNowBtn: "Importa File JSON Ora",
    deviceSyncTipTitle: "Consiglio: Passa da Computer a Telefono",
    deviceSyncTipDesc: "Esporta sul PC, invia il file JSON allo smartphone (Google Drive, email o chat) e importalo per mantenere viva la serie.",
    jsonPrivacyNote: "I file JSON ti appartengono e rimangono al 100% sotto il tuo controllo locale.",
    apiKeyRequiredTitle: "Chiave API Gemini Richiesta",
    apiKeyPromptNotice: "Per generare storie con il Metodo Naturale (i+1) e ripassare il vocabolario, registra la tua chiave API gratuita di Google Gemini.",
    pasteKeyHerePrompt: "Incolla la tua chiave API qui sotto:",
    howToGetAKey: "Come ottenerne una gratis?",
    saveAndGenerate: "Salva Chiave & Continua",
    viewStepByStepGuide: "Visualizza Guida Passo dopo Passo",
    apiKeySecurityBrief: "La tua chiave è salvata esclusivamente in locale e nei tuoi backup JSON.",
    apiKeyRequiredPrompt: "Inserisci una chiave API Gemini valida.",
    reviewNeedsKey: "Chiave API Richiesta per Ripassare",
    lessonNeedsKey: "Chiave API Richiesta per Generare Lezione",
    clear: "Cancella",
    show: "Mostra",
    hide: "Nascondi",
    srsReview: "Ripasso Anki",
    srsTitle: "Ripetizione Spaziata (SRS / Anki)",
    srsSubtitle: "Curva dell'oblio e ripetizione spaziata per consolidare ogni frase i+1 nella memoria a lungo termine.",
    srsCardBackSetting: "Configurazione del Retro",
    srsSelectBackMode: "Cosa desideri visualizzare sul retro della carta?",
    srsBackFull: "Traduzione Completa della Frase",
    srsBackFullDesc: "Mostra la traduzione integrale nella tua lingua madre.",
    srsBackElement: "Traduzione Solo dell'Elemento i+1",
    srsBackElementDesc: "Focus mirato sul nuovo vocabolo o elemento da apprendere.",
    srsBackDefinition: "Definizione nella Lingua di Studio",
    srsBackDefinitionDesc: "Immersione pura: definizione spiegata direttamente nella lingua d'arrivo.",
    srsCardFront: "FRONTE (Frase i+1)",
    srsCardBack: "RETRO",
    srsShowAnswer: "Mostra Risposta",
    srsPressSpace: "Premi [Spazio] per girare la carta",
    srsElementBadge: "Elemento i+1",
    srsFullTranslationLabel: "Traduzione Completa della Frase",
    srsElementTranslationLabel: "Traduzione dell'Elemento i+1",
    srsTargetDefinitionLabel: "Definizione Immersiva nella Lingua di Studio",
    srsHideOtherDetails: "Nascondi altri dettagli",
    srsShowOtherDetails: "Vedi altre modalità (traduzione / definizione extra)",
    srsRatePrompt: "Come valuti il tuo ricordo? (Classifica per la Curva dell'Oblio):",
    srsAgain: "Ripeti",
    srsHard: "Difficile",
    srsGood: "Bene",
    srsEasy: "Facile",
    srsShortcutsHint: "Scorciatoie: [1] Ripeti • [2] Difficile • [3] Bene • [4] Facile",
    srsDueToday: "In Scadenza Oggi",
    srsNewCards: "Nuove (i+1)",
    srsLearningCards: "In Apprendimento",
    srsMasteredCards: "Padroneggiate",
    srsStartReviewBtn: "Inizia Ripasso di Oggi",
    srsCramBtn: "Esercizio Libero",
    srsGenerateNewStory: "Genera Nuova Storia i+1",
    srsForgettingCurveTitle: "La Curva dell'Oblio di Ebbinghaus",
    srsForgettingCurveSubtitle: "Come l'algoritmo SM-2 trasforma lo studio fugace in memoria indelebile.",
    srsDeckExplorerTitle: "Mazzo delle Storie Completate",
    srsDeckExplorerSubtitle: "Ogni lezione completata inserisce automaticamente carte i+1 nel tuo mazzo.",
    srsNoCardsYet: "Il tuo mazzo Anki è vuoto",
    srsNoCardsDesc: "Non appena completerai la tua prima storia su Polyglot i+1, tutte le frasi verranno aggiunte qui per la ripetizione spaziata!",
    srsGenerateFirstStory: "Crea la Mia Prima Storia",
    srsSessionDoneTitle: "Sessione di Ripasso Conclusa!",
    srsSessionDoneDesc: "Ottimo lavoro! Hai sfidato la curva dell'oblio e rinforzato le tue reti neurali a lungo termine.",
    srsReviewedCards: "Carte ripassate",
    srsRememberedCount: "Ricordate",
    srsAgainCount: "Da rinforzare",
    srsReturnToDeck: "Torna al Mazzo",
    srsCramMore: "Esercitati Ancora (Modalità Libera)",
    srsFinishSession: "Esci",
    srsConfirmQuit: "Vuoi interrompere la sessione di ripasso in anticipo?",
    srsSettingsTitle: "Ripetizione Spaziata (SRS / Anki)",
    srsSettingsSubtitle: "Configura la visualizzazione del retro di ciascuna carta i+1 durante i ripassi spaziati."
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
  const [srsCards, setSrsCards] = useState<SRSCard[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'study' | 'srs' | 'history' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [currentStory, setCurrentStory] = useState<StoryResponse | null>(null);
  const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
  const [isApiKeyPromptOpen, setIsApiKeyPromptOpen] = useState(false);
  const [apiKeyPromptAction, setApiKeyPromptAction] = useState<'story' | 'review'>('story');
  const [isGlobalApiKeyTutorialOpen, setIsGlobalApiKeyTutorialOpen] = useState(false);
  const [isGlobalJsonTutorialOpen, setIsGlobalJsonTutorialOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const t = useMemo(() => translations[profile.uiLanguage || 'en'] as any, [profile.uiLanguage]);
  const streakInfo = useMemo(() => calculateStreak(history), [history]);
  const srsStats = useMemo(() => computeSRSStats(srsCards, profile.targetLanguage), [srsCards, profile.targetLanguage]);

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

    const savedSrs = localStorage.getItem(SRS_STORAGE_KEY);
    if (savedSrs) {
      try {
        const parsed = JSON.parse(savedSrs);
        if (Array.isArray(parsed)) {
          setSrsCards(parsed);
        }
      } catch (e) {
        console.error("Failed to parse stored SRS cards", e);
      }
    }
  }, []);

  // Sync cards from history into SRS deck whenever history or target language changes
  useEffect(() => {
    if (history.length > 0) {
      setSrsCards(prev => syncCardsFromHistory(history, prev, profile.targetLanguage, profile.nativeLanguage));
    }
  }, [history, profile.targetLanguage, profile.nativeLanguage]);

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

  useEffect(() => {
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(srsCards));
  }, [srsCards]);

  const handleUpdateSrsCard = (updatedCard: SRSCard) => {
    setSrsCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
  };

  const handleUpdateSrsCardsBatch = (updatedCards: SRSCard[]) => {
    const map = new Map(updatedCards.map(c => [c.id, c]));
    setSrsCards(prev => prev.map(c => map.get(c.id) || c));
  };

  const handleGenerateStory = async () => {
    const hasKey = Boolean(profile.apiKey && profile.apiKey.trim().length > 0);
    if (!hasKey) {
      setApiKeyPromptAction('story');
      setIsApiKeyPromptOpen(true);
      return;
    }
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
        profile.shakespeareanFocus,
        profile.apiKey
      );
      setCurrentStory(story);
      setActiveTab('study');
    } catch (error: any) {
      console.error("Error generating story:", error);
      const msg = error?.message || "Error generating story.";
      if (msg.includes("NO_API_KEY") || msg.includes("API key not configured")) {
        setApiKeyPromptAction('story');
        setIsApiKeyPromptOpen(true);
      } else {
        alert(`${t.errorGeneratingStory || "Error generating lesson:"} ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReview = async () => {
    const hasKey = Boolean(profile.apiKey && profile.apiKey.trim().length > 0);
    if (!hasKey) {
      setApiKeyPromptAction('review');
      setIsApiKeyPromptOpen(true);
      return;
    }
    if (profile.knownWords.length < 20) {
      alert(t.needMoreWordsForReview || "You need at least 20 known words for a high-quality review session.");
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
        profile.shakespeareanFocus,
        profile.apiKey
      );
      setCurrentStory(story);
      setActiveTab('study');
    } catch (error: any) {
      console.error("Error generating review story:", error);
      const msg = error?.message || "Error generating review story.";
      if (msg.includes("NO_API_KEY") || msg.includes("API key not configured")) {
        setApiKeyPromptAction('review');
        setIsApiKeyPromptOpen(true);
      } else {
        alert(`${t.errorGeneratingReview || "Error generating review lesson:"} ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKeyAndProceed = async (newKey: string) => {
    const trimmed = newKey.trim();
    const updatedProfile = { ...profile, apiKey: trimmed };
    setProfile(updatedProfile);
    setIsApiKeyPromptOpen(false);

    setLoading(true);
    try {
      if (apiKeyPromptAction === 'review') {
        if (updatedProfile.knownWords.length < 20) {
          alert(t.needMoreWordsForReview || "You need at least 20 known words for a high-quality review session.");
          return;
        }
        const story = await generateReviewStory(
          updatedProfile.targetLanguage,
          updatedProfile.nativeLanguage,
          updatedProfile.knownWords,
          updatedProfile.ancientGreekDialect,
          updatedProfile.ancientGreekFocus,
          updatedProfile.shakespeareanFocus,
          trimmed
        );
        setCurrentStory(story);
        setActiveTab('study');
      } else {
        const story = await generateStory(
          updatedProfile.targetLanguage,
          updatedProfile.nativeLanguage,
          updatedProfile.level,
          updatedProfile.knownWords,
          updatedProfile.storySize,
          updatedProfile.ancientGreekDialect,
          updatedProfile.ancientGreekFocus,
          updatedProfile.shakespeareanFocus,
          trimmed
        );
        setCurrentStory(story);
        setActiveTab('study');
      }
    } catch (error: any) {
      console.error("Error generating after configuring key:", error);
      const msg = error?.message || "Error generating story.";
      alert(`${t.errorGeneratingStory || "Error generating lesson:"} ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteLesson = (story: StoryResponse) => {
    const isReview = !!story.is_review;
    const newWords = Array.isArray(story.new_words_to_add) ? story.new_words_to_add : [];
    const updatedKnownWords = Array.from(new Set([...profile.knownWords, ...newWords]));
    const newLevel = calculateLevelFromVocab(updatedKnownWords.length);
    const levelChanged = newLevel !== profile.level;
    
    const newHistoryItem: HistoryItem = {
      ...story,
      timestamp: Date.now(),
      completed: true
    };
    
    const updatedHistory = [newHistoryItem, ...history];
    const newStreakInfo = calculateStreak(updatedHistory);
    
    // Automatically feed new sentences into Anki SRS deck
    const newCards = syncCardsFromHistory([newHistoryItem], srsCards, profile.targetLanguage, profile.nativeLanguage);
    setSrsCards(newCards);
    
    setProfile(prev => ({ 
      ...prev, 
      knownWords: updatedKnownWords,
      level: newLevel,
      streakCount: newStreakInfo.streak,
      lastCompletedDate: newStreakInfo.lastCompletedDate || undefined
    }));
    
    setHistory(updatedHistory);
    setCurrentStory(null);
    setActiveTab('dashboard');
    
    if (isReview) {
      alert(t.reviewCongrats);
    } else {
      alert(levelChanged ? `${t.congrats} ${t.levelUp} ${newLevel}!` : t.congrats);
    }
  };

  const handleReopenStory = (story: StoryResponse) => {
    setCurrentStory(normalizeStoryResponse(story, !!story.is_review));
    setActiveTab('study');
  };

  const handleExport = () => {
    const data = JSON.stringify({ profile, history, srsCards }, null, 2);
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
        const raw = e.target?.result as string;
        const data = JSON.parse(raw);
        
        // Support both { profile: {...}, history: [...] } and top-level profile objects
        const rawProfile = data.profile || (data.knownWords || data.targetLanguage ? data : null);
        
        if (rawProfile) {
          let rawWords = rawProfile.knownWords;
          let cleanWords: string[] = [];
          if (typeof rawWords === 'string') {
            cleanWords = rawWords.split(/[,\n\r]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
          } else if (Array.isArray(rawWords)) {
            cleanWords = rawWords.map((w: any) => {
              if (typeof w === 'string') return w.trim().toLowerCase();
              if (w && typeof w === 'object') return String(w.word || w.term || w.original || '').trim().toLowerCase();
              return String(w || '').trim().toLowerCase();
            }).filter((w: string) => w.length > 0 && w !== '[object object]');
          }
          cleanWords = Array.from(new Set(cleanWords));
          if (cleanWords.length === 0) {
            cleanWords = DEFAULT_PROFILE.knownWords;
          }

          const calculatedLevel = calculateLevelFromVocab(cleanWords.length);
          const finalLevel = rawProfile.level || calculatedLevel;

          setProfile(prev => ({
            ...DEFAULT_PROFILE,
            ...prev,
            ...rawProfile,
            apiKey: rawProfile.apiKey || prev.apiKey || '',
            knownWords: cleanWords,
            level: finalLevel
          }));
        }

        if (Array.isArray(data.history)) {
          setHistory(data.history);
        }

        if (Array.isArray(data.srsCards)) {
          setSrsCards(data.srsCards);
        }

        alert(t.importSuccess);
      } catch (err) {
        console.error("Import error:", err);
        alert(t.invalidFile);
      } finally {
        if (event.target) {
          event.target.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const navigateToTab = (tab: 'dashboard' | 'study' | 'srs' | 'history' | 'settings') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <nav className="w-full md:w-64 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 md:p-6 flex flex-col shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 transition-all">
        {/* Top Header Bar: Logo, App Name, Streak, Theme Toggle & Mobile Hamburger */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-500 p-2 rounded-lg"><BookOpen size={24} className="text-white" /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Polyglot AI</h1>
              {streakInfo.streak > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <Flame size={12} className="fill-amber-500 text-amber-500" />
                  <span>{streakInfo.streak} {streakInfo.streak === 1 ? (t.day || 'day') : (t.days || 'days')} {t.streak ? t.streak.toLowerCase() : 'streak'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              onClick={() => setProfile(p => ({...p, darkMode: !p.darkMode}))} 
              aria-label="Alternar tema escuro/claro"
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
            >
              {profile.darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              aria-label="Abrir ou fechar menu"
              aria-expanded={isMobileMenuOpen}
              className="md:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer relative"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              {srsStats.dueToday > 0 && !isMobileMenuOpen && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Items (Always visible on desktop md:flex, collapsible on mobile) */}
        <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col gap-2 flex-grow mt-5 md:mt-8 animate-in fade-in slide-in-from-top-2 duration-150`}>
          <button 
            type="button"
            onClick={() => navigateToTab('dashboard')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <LayoutDashboard size={20} /> {t.dashboard}
          </button>
          <button 
            type="button"
            onClick={() => navigateToTab('study')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'study' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <BookOpen size={20} /> {t.studyArea}
          </button>
          <button 
            type="button"
            onClick={() => navigateToTab('srs')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'srs' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Layers size={20} />
            <span className="flex-1 text-left">{t.srsReview || "Revisão Anki"}</span>
            {srsStats.dueToday > 0 && (
              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${activeTab === 'srs' ? 'bg-white text-indigo-700' : 'bg-amber-500 text-white'}`}>
                {srsStats.dueToday}
              </span>
            )}
          </button>
          <button 
            type="button"
            onClick={() => navigateToTab('history')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <HistoryIcon size={20} /> {t.history}
          </button>
          <button 
            type="button"
            onClick={() => navigateToTab('settings')} 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <SettingsIcon size={20} /> {t.settings}
          </button>

          {/* Quick Tutorial Links in Navigation */}
          <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsGlobalApiKeyTutorialOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer text-left"
            >
              <Key size={15} className="shrink-0 text-amber-500" />
              <span className="truncate">{t.howToGetFreeKey || "Chave API Gratuita"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsGlobalJsonTutorialOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer text-left"
            >
              <FileJson size={15} className="shrink-0 text-emerald-500" />
              <span className="truncate">{t.backupRestoreGuideBtn || "Salvar & Restaurar"}</span>
            </button>
          </div>
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
            onOpenVocabModal={() => setIsVocabModalOpen(true)}
            srsDueCount={srsStats.dueToday}
            onNavigateToSRS={() => setActiveTab('srs')}
          />
        )}
        {activeTab === 'study' && (
          <ErrorBoundary onReset={() => setActiveTab('dashboard')}>
            <StudyArea 
              story={currentStory} 
              loading={loading}
              onGenerate={handleGenerateStory}
              onComplete={handleCompleteLesson}
              targetLanguage={profile.targetLanguage}
              t={t}
              apiKey={profile.apiKey}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'srs' && (
          <SRSReviewArea
            cards={srsCards}
            onUpdateCard={handleUpdateSrsCard}
            onUpdateCardsBatch={handleUpdateSrsCardsBatch}
            targetLanguage={profile.targetLanguage}
            nativeLanguage={profile.nativeLanguage}
            srsBackType={profile.srsBackType || 'full_translation'}
            onChangeBackType={(newType) => setProfile(prev => ({ ...prev, srsBackType: newType }))}
            onNavigateToStudy={() => {
              setActiveTab('study');
              handleGenerateStory();
            }}
            t={t}
          />
        )}
        {activeTab === 'history' && <History history={history} onReopen={handleReopenStory} targetLanguage={profile.targetLanguage} t={t} />}
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

      {/* Dedicated Learned Vocabulary Explorer Modal */}
      <VocabularyModal
        isOpen={isVocabModalOpen}
        onClose={() => setIsVocabModalOpen(false)}
        words={profile.knownWords}
        onChangeWords={(newWords) => {
          const newLevel = calculateLevelFromVocab(newWords.length);
          setProfile(prev => ({ ...prev, knownWords: newWords, level: newLevel }));
        }}
        targetLanguage={profile.targetLanguage}
        t={t}
      />

      {/* Friendly API Key Required Prompt Modal */}
      <ApiKeyPromptModal
        isOpen={isApiKeyPromptOpen}
        onClose={() => setIsApiKeyPromptOpen(false)}
        onGoToSettings={() => {
          setIsApiKeyPromptOpen(false);
          setActiveTab('settings');
        }}
        onOpenTutorial={() => {
          setIsApiKeyPromptOpen(false);
          setIsGlobalApiKeyTutorialOpen(true);
        }}
        onSaveKeyAndProceed={handleSaveKeyAndProceed}
        actionType={apiKeyPromptAction}
        t={t}
      />

      {/* Global API Key Tutorial Modal */}
      <ApiKeyTutorialModal
        isOpen={isGlobalApiKeyTutorialOpen}
        onClose={() => setIsGlobalApiKeyTutorialOpen(false)}
        currentApiKey={profile.apiKey}
        onSaveKey={(newKey) => {
          setProfile(prev => ({ ...prev, apiKey: newKey }));
        }}
        t={t}
      />

      {/* Global JSON Backup & Restore Tutorial Modal */}
      <JsonBackupTutorialModal
        isOpen={isGlobalJsonTutorialOpen}
        onClose={() => setIsGlobalJsonTutorialOpen(false)}
        onExport={handleExport}
        onTriggerImport={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = (e) => handleImport(e as any);
          input.click();
        }}
        t={t}
      />
    </div>
  );
};

export default App;
