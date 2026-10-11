
import React, { useState, useRef } from 'react';
import { UserProfile, CEFRLevel, UILanguage, StorySize, AncientGreekDialect, AncientGreekFocus, ShakespeareanFocus } from '../types';
import { User, Globe, GraduationCap, Save, Bell, Moon, Languages, Info, Download, Upload, Database, BookOpen, ScrollText, BrainCircuit, Feather, Sparkles } from 'lucide-react';

const STARTER_VOCABULARY: Record<string, string[]> = {
  'Shakespearean English': [
    'thou', 'thee', 'thy', 'thine', 'art', 'hath', 'doth', 'tis', 
    'wherefore', 'anon', 'nay', 'aye', 'fair', 'heart', 'lord', 'lady', 
    'love', 'night', 'sun', 'speak', 'shall', 'good', 'heavens', 'farewell'
  ],
  'Ancient Greek': [
    'logos', 'theos', 'anthropos', 'psyche', 'sophia', 'kosmos', 
    'arete', 'nomos', 'physis', 'polis', 'kalon', 'agathon', 'nous'
  ],
  'Latin': [
    'salve', 'terra', 'aqua', 'ignis', 'caelum', 'homo', 'deus', 
    'amor', 'lux', 'nox', 'vita', 'mors', 'tempus', 'veritas'
  ],
  'English': ['hello', 'world', 'the', 'is', 'a', 'to', 'in', 'and', 'you', 'it'],
  'Spanish': ['hola', 'mundo', 'el', 'la', 'es', 'un', 'una', 'en', 'y', 'de'],
  'Portuguese': ['olá', 'mundo', 'o', 'a', 'é', 'um', 'uma', 'em', 'e', 'de'],
  'French': ['bonjour', 'monde', 'le', 'la', 'est', 'un', 'une', 'dans', 'et', 'de'],
  'German': ['hallo', 'welt', 'der', 'die', 'das', 'ist', 'ein', 'eine', 'in', 'und'],
  'Italian': ['ciao', 'mondo', 'il', 'la', 'è', 'un', 'una', 'in', 'e', 'di'],
  'Japanese': ['konnichiwa', 'sekai', 'kore', 'sore', 'watashi', 'anata', 'desu', 'wa', 'no'],
  'Chinese': ['nihao', 'shijie', 'zhe', 'na', 'wo', 'ni', 'shi', 'zai', 'he', 'de'],
  'Russian': ['privet', 'mir', 'eto', 'ya', 'ty', 'on', 'ona', 'v', 'i', 'ne'],
  'Modern Greek': ['geia', 'kosmos', 'aftos', 'afti', 'einai', 'enas', 'mia', 'se', 'kai']
};

interface SettingsProps {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  t: any;
}

const Settings: React.FC<SettingsProps> = ({ profile, setProfile, onExport, onImport, t }) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setTimeout(() => {
      setProfile(formData);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const loadStarterVocabForLanguage = () => {
    const starter = STARTER_VOCABULARY[formData.targetLanguage] || STARTER_VOCABULARY['English'];
    setFormData({
      ...formData,
      knownWords: starter
    });
  };

  const requestNotificationPermission = async () => {
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        setFormData({ ...formData, notificationsEnabled: true });
      } else {
        alert("Permission denied. Enable notifications in your browser settings.");
      }
    } else {
      setFormData({ ...formData, notificationsEnabled: !formData.notificationsEnabled });
    }
  };

  const cefrLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const languages = [
    'English', 'Shakespearean English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 
    'Japanese', 'Chinese', 'Russian', 'Latin', 'Modern Greek', 'Ancient Greek'
  ];
  const uiLanguages: {code: UILanguage, label: string}[] = [
    {code: 'en', label: 'English'},
    {code: 'pt', label: 'Português'},
    {code: 'es', label: 'Español'}
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center">{t.settings}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-center">Customize your experience</p>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
        {/* Core Profile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <User size={16} /> Display Name
            </label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <GraduationCap size={16} /> CEFR Level
            </label>
            <select 
              value={formData.level}
              onChange={(e) => setFormData({...formData, level: e.target.value as CEFRLevel})}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              {cefrLevels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Learning Preferences */}
        <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BookOpen size={20} /> Learning Preferences
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Target Language
              </label>
              <select 
                value={formData.targetLanguage}
                onChange={(e) => setFormData({...formData, targetLanguage: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                {languages.map(l => <option key={l} value={l}>{l === 'Shakespearean English' ? (t.shakespearean || l) : l}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {t.storySize}
              </label>
              <select 
                value={formData.storySize}
                onChange={(e) => setFormData({...formData, storySize: e.target.value as StorySize})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="short">{t.short}</option>
                <option value="standard">{t.standard}</option>
                <option value="medium">{t.medium}</option>
                <option value="long">{t.long}</option>
              </select>
            </div>
          </div>

          {/* Conditional Style Selection for Shakespearean English */}
          {formData.targetLanguage === 'Shakespearean English' && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 bg-amber-50/50 dark:bg-amber-950/20 p-5 rounded-2xl border border-amber-200/70 dark:border-amber-900/40">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Feather size={16} className="text-amber-600 dark:text-amber-400" /> {t.shakespeareanStyle}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, shakespeareanFocus: 'general'})}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center text-center ${(!formData.shakespeareanFocus || formData.shakespeareanFocus === 'general') ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'}`}
                  >
                    {t.generalShakespearean}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, shakespeareanFocus: 'drama'})}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center text-center ${formData.shakespeareanFocus === 'drama' ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'}`}
                  >
                    {t.dramaShakespearean}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, shakespeareanFocus: 'courtly'})}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center text-center ${formData.shakespeareanFocus === 'courtly' ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-amber-300'}`}
                  >
                    {t.courtlyShakespearean}
                  </button>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 italic flex items-center gap-1">
                  <Sparkles size={12} className="shrink-0" />
                  {formData.shakespeareanFocus === 'drama'
                    ? "Foco em drama e tragédias épicas: temas solenes, destino, honra e monólogos poéticos."
                    : formData.shakespeareanFocus === 'courtly'
                    ? "Foco cortesão e sonetos: corte amorosa, jogo de palavras, elegância lírica e sagacidade."
                    : "Inglês elizabetano clássico: pronomes arcaicos (thou/thee/thy), flexões verbais (-eth/-est) e cadência teatral."
                  }
                </p>
              </div>
            </div>
          )}

          {/* Conditional Dialect Selection for Ancient Greek */}
          {formData.targetLanguage === 'Ancient Greek' && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <ScrollText size={16} /> {t.dialect}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, ancientGreekDialect: 'attic'})}
                    className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${formData.ancientGreekDialect === 'attic' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                  >
                    {t.attic}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, ancientGreekDialect: 'koine'})}
                    className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${formData.ancientGreekDialect === 'koine' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                  >
                    {t.koine}
                  </button>
                </div>
              </div>

              {/* Focus Selection for Attic Greek */}
              {formData.ancientGreekDialect === 'attic' && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300 border-l-2 border-indigo-200 dark:border-indigo-800 pl-4 py-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <BrainCircuit size={16} /> {t.focus}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, ancientGreekFocus: 'general'})}
                      className={`px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${formData.ancientGreekFocus === 'general' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                    >
                      {t.generalAttic}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, ancientGreekFocus: 'philosophical'})}
                      className={`px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${formData.ancientGreekFocus === 'philosophical' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                    >
                      {t.philosophicalAttic}
                    </button>
                  </div>
                  {formData.ancientGreekFocus === 'philosophical' && (
                    <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1 font-medium italic">
                      Léxico especializado: Platão e Aristóteles.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Localization & Notifications */}
        <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Languages size={20} /> Localization
          </h3>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Interface Language
            </label>
            <select 
              value={formData.uiLanguage}
              onChange={(e) => setFormData({...formData, uiLanguage: e.target.value as UILanguage})}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              {uiLanguages.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Bell size={20} /> Notifications & Display
          </h3>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">Study Notifications</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Daily reminders</p>
            </div>
            <button 
              type="button"
              onClick={requestNotificationPermission}
              className={`w-12 h-6 rounded-full transition-all relative ${formData.notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.notificationsEnabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* Data Management Section */}
        <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Database size={20} /> {t.export} / {t.import}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={onExport} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-all">
              <Download size={18} /> {t.export}
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-all">
              <Upload size={18} /> {t.import}
            </button>
            <input type="file" ref={fileInputRef} onChange={onImport} className="hidden" accept=".json" />
          </div>
        </div>

        {/* Vocab List - FULL ACCESS */}
        <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              Known Vocabulary (Full Context for AI)
            </label>
            <button
              type="button"
              onClick={loadStarterVocabForLanguage}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50 transition-all flex items-center gap-1.5 w-fit"
            >
              <Sparkles size={13} /> {t.loadStarterVocab} ({formData.targetLanguage === 'Shakespearean English' ? t.shakespearean : formData.targetLanguage})
            </button>
          </div>
          <textarea 
            value={formData.knownWords.join(', ')}
            onChange={(e) => setFormData({...formData, knownWords: e.target.value.split(',').map(w => w.trim()).filter(w => w !== '')})}
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-mono leading-relaxed"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Info size={12} /> Sending {formData.knownWords.length} words to Gemini for precise i+1 generation.
          </p>
        </div>

        <button
          type="submit"
          disabled={saveStatus !== 'idle'}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:bg-slate-500"
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : (
            <><Save size={20} /> Save Changes</>
          )}
        </button>
      </form>
    </div>
  );
};

export default Settings;
