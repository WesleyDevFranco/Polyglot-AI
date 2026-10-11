
import React, { useMemo } from 'react';
import { UserProfile, HistoryItem } from '../types';
import { Award, Zap, BookOpen, ChevronRight, Loader2, Info, TrendingUp, Activity, Calendar, RefreshCw } from 'lucide-react';

interface DashboardProps {
  profile: UserProfile;
  onGenerate: () => void;
  onReview: () => void;
  loading: boolean;
  historyCount: number;
  t: any;
  history: HistoryItem[];
}

const Dashboard: React.FC<DashboardProps> = ({ profile, onGenerate, onReview, loading, historyCount, t, history }) => {
  const thresholds = [
    { level: 'A1', min: 0, max: 500 },
    { level: 'A2', min: 500, max: 1000 },
    { level: 'B1', min: 1000, max: 2500 },
    { level: 'B2', min: 2500, max: 5000 },
    { level: 'C1', min: 5000, max: 10000 },
    { level: 'C2', min: 10000, max: 15000 },
  ];

  const calculateLevelProgress = (wordCount: number) => {
    const currentRange = thresholds.find(range => range.level === profile.level) || thresholds[0];
    const wordsInCurrentLevel = wordCount - currentRange.min;
    const levelSize = currentRange.max - currentRange.min;
    const levelPercentage = Math.min(Math.max((wordsInCurrentLevel / levelSize) * 100, 0), 100);
    
    return {
      percentage: levelPercentage,
      nextLevelWords: currentRange.max - wordCount,
      isMax: profile.level === 'C2' && wordCount >= currentRange.max,
      nextLevel: thresholds[thresholds.indexOf(currentRange) + 1]?.level || 'Mastery'
    };
  };

  const progress = calculateLevelProgress(profile.knownWords.length);

  // Helper to get local date key "YYYY-MM-DD"
  const getLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate growth chart data organized by days (Last 10 Days)
  const growthData = useMemo(() => {
    const dayCount = 10;
    const points = [];
    const today = new Date();
    
    // Group history by local date string
    const gainsByDate: Record<string, number> = {};
    history.forEach(item => {
      const d = new Date(item.timestamp);
      const dateStr = getLocalDateKey(d);
      gainsByDate[dateStr] = (gainsByDate[dateStr] || 0) + item.new_words_to_add.length;
    });

    let cumulativeTotal = profile.knownWords.length;
    
    // Build timeline backward from today
    for (let i = 0; i < dayCount; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      const dateStr = getLocalDateKey(targetDate);
      
      const dailyDelta = gainsByDate[dateStr] || 0;
      
      points.push({
        total: Math.max(0, cumulativeTotal),
        delta: dailyDelta,
        label: targetDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
        isToday: i === 0,
        fullDate: dateStr
      });
      
      // For the day before, subtract the current day's delta from the total
      cumulativeTotal -= dailyDelta;
    }
    
    return points.reverse();
  }, [history, profile.knownWords.length]);

  // Calculate learning velocity (avg words per day over the last 7 active days)
  const velocity = useMemo(() => {
    if (history.length === 0) return 0;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentGains = history
      .filter(item => item.timestamp >= sevenDaysAgo)
      .reduce((acc, curr) => acc + curr.new_words_to_add.length, 0);
    
    return Math.round((recentGains / 7) * 10) / 10;
  }, [history]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t.welcome}, {profile.name}!</h2>
          <p className="text-slate-500 dark:text-slate-400">{t.ready}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReview}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            {t.review}
          </button>
          <button
            onClick={onGenerate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
            {t.generate}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CEFR Level Progress */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-4">
          <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 p-2 rounded-lg w-fit">
            <Award size={24} />
          </div>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.cefr}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{profile.level}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                {profile.level === 'C2' ? 'Mastery' : `${Math.round(progress.percentage)}% to ${progress.nextLevel}`}
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full transition-all duration-1000 ease-out" style={{ width: `${progress.percentage}%` }} />
          </div>
          {profile.level !== 'C2' ? (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Info size={10} /> {progress.nextLevelWords} words remaining for {progress.nextLevel}
            </p>
          ) : (
            <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><Zap size={10} /> Maximum level reached!</p>
          )}
        </div>

        {/* Vocabulary Growth Card - DAILY TIMELINE */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 p-2 rounded-lg w-fit">
              <Calendar size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase flex items-center gap-1 justify-end">
                <Activity size={10} /> Daily Velocity
              </p>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300">+{velocity} <span className="text-[10px] font-normal text-slate-400">w/d</span></p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Progress Timeline</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{profile.knownWords.length} words</p>
          </div>
          
          {/* DAILY SVG Growth Chart */}
          <div className="h-16 w-full mt-auto flex items-end gap-1 px-1">
            {growthData.map((p, i) => {
              const maxTotal = Math.max(...growthData.map(d => d.total));
              const totalHeight = maxTotal > 0 ? (p.total / maxTotal) * 100 : 0;
              const deltaRatio = p.total > 0 ? (p.delta / p.total) : 0;
              
              return (
                <div key={i} className="flex-grow flex flex-col justify-end group relative cursor-pointer" style={{ height: `100%` }}>
                  {/* The Bar */}
                  <div className={`w-full ${p.isToday ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-blue-100 dark:bg-blue-900/20'} rounded-t-sm overflow-hidden flex flex-col justify-end`} style={{ height: `${totalHeight}%` }}>
                    {/* Daily Gain highlight */}
                    <div 
                      className={`${p.isToday ? 'bg-indigo-600' : 'bg-blue-500 dark:bg-blue-600'} transition-all duration-500`} 
                      style={{ height: `${deltaRatio * 100}%` }} 
                    />
                  </div>
                  
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-2 rounded pointer-events-none whitespace-nowrap z-20 shadow-xl transition-opacity">
                    <div className="font-bold border-b border-slate-600 mb-1 pb-0.5">{p.label} {p.isToday && '(Today)'}</div>
                    <div className="flex justify-between gap-4"><span>Vocabulary:</span> <span className="font-mono">{p.total}</span></div>
                    <div className="flex justify-between gap-4 text-blue-300"><span>Daily Gain:</span> <span className="font-mono">+{p.delta}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lessons Completed */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-4">
          <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-2 rounded-lg w-fit">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.completed}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{historyCount}</p>
          </div>
          <div className="mt-auto">
             <p className="text-xs text-slate-400 dark:text-slate-500">Keep your streak alive.</p>
             <div className="flex gap-1 mt-2">
               {Array.from({length: 7}).map((_, i) => {
                 const dayHasLesson = growthData.slice(-7)[i]?.delta > 0;
                 return (
                   <div key={i} className={`h-2 w-full rounded-sm ${dayHasLesson ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-800'}`} />
                 );
               })}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Philosophy Section */}
        <div className="bg-indigo-900 dark:bg-indigo-800 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 space-y-4">
            <h3 className="text-2xl font-bold">{t.philosophy}</h3>
            <p className="text-indigo-100 leading-relaxed text-sm">{t.philosophyDesc}</p>
          </div>
          <div className="relative z-10 pt-6">
            <button onClick={onGenerate} className="group flex items-center gap-2 text-indigo-200 hover:text-white transition-colors font-bold">
              {t.startNow} <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        </div>

        {/* Review Promo Section */}
        <div className="bg-emerald-900 dark:bg-emerald-800 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 space-y-4">
            <h3 className="text-2xl font-bold">{t.review}</h3>
            <p className="text-emerald-100 leading-relaxed text-sm">{t.reviewDesc}</p>
          </div>
          <div className="relative z-10 pt-6">
            <button onClick={onReview} className="group flex items-center gap-2 text-emerald-200 hover:text-white transition-colors font-bold">
              Consolidate now <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
