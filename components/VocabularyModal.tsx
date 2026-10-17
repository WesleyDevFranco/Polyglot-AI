import React from 'react';
import { X, BookOpen, Sparkles } from 'lucide-react';
import { VocabularyExplorer } from './VocabularyExplorer';

interface VocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
  words: string[];
  onChangeWords?: (words: string[]) => void;
  targetLanguage: string;
  t: any;
}

export const VocabularyModal: React.FC<VocabularyModalProps> = ({
  isOpen,
  onClose,
  words,
  onChangeWords,
  targetLanguage,
  t
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <BookOpen size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {t.wordsLearned || "Learned Vocabulary"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {targetLanguage} • {words.length} {t.words || "words"} in your active lexicon
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Explorer Body */}
        <div className="flex-grow overflow-y-auto">
          <VocabularyExplorer
            words={words}
            onChangeWords={onChangeWords}
            targetLanguage={targetLanguage}
            t={t}
            allowEdit={true}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
