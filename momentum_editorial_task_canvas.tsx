import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Edit3,
  Download,
  Upload,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldAlert,
  Target,
  Flame,
  Trophy,
  Zap,
  ChevronRight,
  Info,
  Clock,
  ArrowUpRight,
  FileText,
  Check,
  X,
  RefreshCw,
  Layers,
  Award,
  Filter,
  Tag,
  Lightbulb,
  AlertCircle,
  Maximize2,
  Minimize2,
  FastForward,
  Keyboard,
  ArrowRight,
  CheckSquare,
  Cloud,
  CloudOff,
  Database,
  Copy,
  ExternalLink
} from 'lucide-react';
import {
  Task,
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  fetchRemoteTasks,
  upsertRemoteTask,
  deleteRemoteTask,
  bulkUploadTasks,
  subscribeToRemoteTasks
} from './src/lib/supabase';

const INITIAL_PRESETS: Task[] = [
  {
    id: 'task-preset-1',
    title: 'Belastingaangifte & Financieel Overzicht 2025',
    outcome: 'Rust in mijn hoofd, overzicht van aftrekposten en mogelijke teruggaaf van €350+.',
    obstacle: 'Angst voor ingewikkelde formulieren, saai papierwerk en vermijding van cijfers.',
    obstacleType: 'overwhelm',
    microStep: 'Map Financiën 2025 op het bureau leggen en DigiD inlogpagina openen op laptop.',
    microSteps: [
      { id: 'ms-1', text: 'DigiD inlogpagina openen in browser', completed: true },
      { id: 'ms-2', text: 'Jaaropgaven van bank downloaden', completed: false },
      { id: 'ms-3', text: 'Eerste 3 vragen invullen op belastingdienst.nl', completed: false }
    ],
    dreadLevel: 5,
    impactLevel: 5,
    category: 'Administratie',
    status: 'todo',
    createdAt: new Date().toISOString(),
    completedAt: null,
    timeSpentSeconds: 120,
    isQuickEntry: false
  },
  {
    id: 'task-preset-2',
    title: 'Moeilijke e-mail sturen over projectvertraging',
    outcome: 'Heldere verwachtingen bij de klant, eerlijkheid en wegnemen van constante spanning.',
    obstacle: 'Perfectionisme: bang dat de formulering verkeerd valt of onprofessioneel overkomt.',
    obstacleType: 'perfectionism',
    microStep: 'Nieuw concept openen en 3 ruwe bullet points tikken zonder op stijl te letten.',
    microSteps: [
      { id: 'ms-4', text: 'Conceptmail openen in e-mailprogramma', completed: true },
      { id: 'ms-5', text: 'De kernoorzaak in 1 simpele zin opschrijven', completed: true },
      { id: 'ms-6', text: 'Nieuwe opleverdatum voorstellen', completed: false }
    ],
    dreadLevel: 4,
    impactLevel: 4,
    category: 'Werk',
    status: 'in_progress',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: null,
    timeSpentSeconds: 340,
    isQuickEntry: false
  },
  {
    id: 'task-preset-3',
    title: 'Werkplek grondig opruimen & kabelbeheer',
    outcome: 'Frisse, inspirerende werkomgeving met nul visuele afleidingen.',
    obstacle: 'Ziet eruit als een 4-uur durende klus en vervelend uitzoekwerk.',
    obstacleType: 'boredom',
    microStep: 'Alleen alle lege glazen en koffiemokken naar de keuken brengen.',
    microSteps: [
      { id: 'ms-7', text: 'Koffiemokken en afval van bureau pakken', completed: true },
      { id: 'ms-8', text: 'Losse papieren op 1 stapel leggen', completed: true },
      { id: 'ms-9', text: 'Bureau met vochtig doekje afnemen', completed: true }
    ],
    dreadLevel: 3,
    impactLevel: 3,
    category: 'Gezondheid',
    status: 'done',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    completedAt: new Date(Date.now() - 3600000).toISOString(),
    timeSpentSeconds: 600,
    isQuickEntry: false
  }
];

const COACH_NUDGES: Record<string, { title: string; quote: string; tip: string; action: string }> = {
  overwhelm: {
    title: 'De Micro-Versnipperaar',
    quote: 'Grote taken bestaan niet; het zijn enkel verzamelingen van 2-minuten acties.',
    tip: 'Maak je taak zo belachelijk klein dat het meer moeite kost om te weigeren dan om het gewoon te doen.',
    action: 'Knip de taak nu op in 3 stappen die elk minder dan 90 seconden duren.'
  },
  perfectionism: {
    title: 'De Slechte Eerste Versie',
    quote: 'Beter een matige actie vandaag dan een perfect plan dat nooit wordt uitgevoerd.',
    tip: 'Geef jezelf expliciet toestemming om een rommelige eerste poging af te leveren.',
    action: 'Zet de timer op 2 minuten en schrijf of maak iets wat een cijfer 4 verdient.'
  },
  boredom: {
    title: 'Prikkel-Koppeling',
    quote: 'Saaie taken worden licht zodra je ze combineert met een prettige routine.',
    tip: 'Koppel een saaie taak aan een fijne podcast, favoriete thee of inspirerende soundtrack.',
    action: 'Zet een fijne audiofrequentie of afspeellijst op en doe 1 korte sprint van 5 minuten.'
  },
  fear: {
    title: 'Worst-Case Ontrafeling',
    quote: 'Onzekerheid groeit in het donker, maar verdwijnt zodra je het bij de naam noemt.',
    tip: 'Vraag jezelf af: wat is het állerergste dat realistisch gezien kan gebeuren?',
    action: 'Haal een keer diep adem, voer de micro-stap uit en observeer dat je veilig bent.'
  }
};

const SUPABASE_SETUP_SQL = `-- 1. Maak de taken tabel aan
create table if not exists tasks (
  id text primary key,
  title text not null,
  outcome text,
  obstacle text,
  obstacle_type text default 'overwhelm',
  micro_step text,
  micro_steps jsonb default '[]'::jsonb,
  dread_level integer default 3,
  impact_level integer default 4,
  category text default 'Werk',
  status text default 'todo',
  created_at text default (now() at time zone 'utc')::text,
  completed_at text,
  time_spent_seconds integer default 0,
  is_quick_entry boolean default false,
  updated_at text default (now() at time zone 'utc')::text
);

-- 2. Schakel Row Level Security (RLS) in met open toegang voor jouw persoonlijke app
alter table tasks enable row level security;
create policy "Allow all operations for anon" on tasks for all using (true) with check (true);

-- 3. Activeer Supabase Realtime voor live synchronisatie
alter publication supabase_realtime add table tasks;`;

class DynamicSoundEngine {
  ctx: AudioContext | null;
  enabled: boolean;
  volume: number;

  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.2;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(type: string) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume, now);
    masterGain.connect(this.ctx.destination);

    if (type === 'click') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'start') {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(300, now);
      osc1.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      osc2.frequency.setValueAtTime(450, now);
      osc2.frequency.exponentialRampToValueAtTime(900, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(masterGain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.2);
      osc2.stop(now + 0.2);
    } else if (type === 'complete') {
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      freqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const noteStart = now + idx * 0.08;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.25, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.4);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(noteStart);
        osc.stop(noteStart + 0.4);
      });
    } else if (type === 'tick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.02);
    }
  }
}

const audioEngine = new DynamicSoundEngine();

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('editorial_momentum_tasks');
      return saved ? JSON.parse(saved) : INITIAL_PRESETS;
    } catch (e) {
      return INITIAL_PRESETS;
    }
  });

  const [activeTaskId, setActiveTaskId] = useState<string | null>(() => {
    return tasks.length > 0 ? tasks[0].id : null;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem('editorial_momentum_theme');
      return savedTheme ? JSON.parse(savedTheme) : false;
    } catch (e) {
      return false;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.2);

  // Cloud Sync & Supabase states
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(() => {
    return Boolean(getSupabaseConfig()?.url);
  });
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudUrlInput, setCloudUrlInput] = useState(() => getSupabaseConfig()?.url || '');
  const [cloudKeyInput, setCloudKeyInput] = useState(() => getSupabaseConfig()?.anonKey || '');
  const [cloudTesting, setCloudTesting] = useState(false);
  const [cloudMessage, setCloudMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Focus & Zen Mode states (Phase 1)
  const [isZenMode, setIsZenMode] = useState(false);
  const [autoOpenZenOnTimer, setAutoOpenZenOnTimer] = useState(true);

  // Timer states
  const [timerDuration, setTimerDuration] = useState(120); // default 2 minutes
  const [timerSeconds, setTimerSeconds] = useState(120);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [burstCompleted, setBurstCompleted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const quickTitleInputRef = useRef<HTMLInputElement | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: string; id: number } | null>(null);

  // Filter and Category states
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'frogs', 'quick', 'done'
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Intake Mode: 'quick' (10s fast track) or 'woop' (deep 3-question analysis)
  const [intakeMode, setIntakeMode] = useState<'quick' | 'woop'>('quick');

  // Quick Invoer Form State
  const [quickFormData, setQuickFormData] = useState({
    title: '',
    microStep: '',
    category: 'Werk'
  });

  // WOOP Form states for creating/editing tasks
  const [isEditing, setIsEditing] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    outcome: '',
    obstacle: '',
    obstacleType: 'overwhelm',
    microStep: '',
    dreadLevel: 3,
    impactLevel: 4,
    category: 'Werk'
  });

  // Modal states
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [newStepText, setNewStepText] = useState('');
  const [zenNewStepText, setZenNewStepText] = useState('');

  // Persist LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('editorial_momentum_tasks', JSON.stringify(tasks));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('editorial_momentum_theme', JSON.stringify(isDarkMode));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  }, [isDarkMode]);

  useEffect(() => {
    audioEngine.enabled = soundEnabled;
    audioEngine.volume = soundVolume;
  }, [soundEnabled, soundVolume]);

  const showNotification = (message: string, type: string = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Supabase Initial Sync & Realtime Subscription Lifecycle
  useEffect(() => {
    const config = getSupabaseConfig();
    if (!config) {
      setIsCloudConnected(false);
      return;
    }

    setIsCloudConnected(true);

    // Initial fetch from cloud
    fetchRemoteTasks().then(remoteTasks => {
      if (remoteTasks && remoteTasks.length > 0) {
        setTasks(remoteTasks);
        if (remoteTasks.length > 0 && !activeTaskId) {
          setActiveTaskId(remoteTasks[0].id);
        }
        showNotification('⚡ Live gesynchroniseerd met Supabase Cloud!', 'success');
      }
    });

    // Realtime subscription
    const channel = subscribeToRemoteTasks(
      (newTask) => {
        setTasks(prev => {
          if (prev.some(t => t.id === newTask.id)) return prev;
          return [newTask, ...prev];
        });
      },
      (updatedTask) => {
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      },
      (deletedTaskId) => {
        setTasks(prev => prev.filter(t => t.id !== deletedTaskId));
      }
    );

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, []);

  const activeTask = useMemo(() => {
    return tasks.find(t => t.id === activeTaskId) || tasks[0] || null;
  }, [tasks, activeTaskId]);

  const nextIncompleteMicroStep = useMemo(() => {
    if (!activeTask || !activeTask.microSteps) return null;
    return activeTask.microSteps.find(s => !s.completed) || null;
  }, [activeTask]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const totalMicroSteps = tasks.reduce((acc, t) => acc + (t.microSteps ? t.microSteps.length : 0), 0);
    const completedMicroSteps = tasks.reduce(
      (acc, t) => acc + (t.microSteps ? t.microSteps.filter(s => s.completed).length : 0),
      0
    );
    const frogCount = tasks.filter(t => t.dreadLevel >= 4 && t.status !== 'done').length;

    return {
      total,
      completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalMicroSteps,
      completedMicroSteps,
      frogCount
    };
  }, [tasks]);

  // Timer Tick & Completion Effect
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsTimerRunning(false);
            setBurstCompleted(true);
            audioEngine.play('complete');
            showNotification('🎉 2-Minuten Momentum Burst Voltooid! Je hebt het ijs gebroken.', 'success');
            
            // Increment spent time on active task and sync
            if (activeTaskId) {
              setTasks(prevTasks =>
                prevTasks.map(t => {
                  if (t.id === activeTaskId) {
                    const updated = { ...t, timeSpentSeconds: (t.timeSpentSeconds || 0) + timerDuration };
                    if (isCloudConnected) upsertRemoteTask(updated);
                    return updated;
                  }
                  return t;
                })
              );
            }
            return 0;
          }
          if (soundEnabled && prev % 2 === 0) {
            audioEngine.play('tick');
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, activeTaskId, soundEnabled, timerDuration, isCloudConnected]);

  // Keyboard Shortcuts in Zen Mode (Space, Esc, Enter/C, R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      if (e.key === 'Escape') {
        if (isZenMode) {
          setIsZenMode(false);
          if (autoPlay) audioEngine.play('click');
        }
        return;
      }

      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        toggleTimer();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        resetTimer();
      } else if ((e.key === 'c' || e.key === 'C' || e.key === 'Enter') && activeTask && nextIncompleteMicroStep) {
        e.preventDefault();
        toggleMicroStep(activeTask.id, nextIncompleteMicroStep.id);
        showNotification(`✓ Micro-stap afgevinkt: "${nextIncompleteMicroStep.text}"`, 'success');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode, isTimerRunning, activeTask, nextIncompleteMicroStep, autoPlay]);

  // Fast-Track Quick Brain Dump Submit
  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFormData.title.trim()) {
      showNotification('Voer minimaal een taaknaam in voor de snelle invoer.', 'warning');
      return;
    }

    const firstStep = quickFormData.microStep.trim() || '1e minuut: open het bestand of document en bekijk de startlijn';
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: quickFormData.title.trim(),
      outcome: 'Direct overzicht, rust in het hoofd en taak afgerond.',
      obstacle: 'Initiële startweerstand en vermijding.',
      obstacleType: 'overwhelm',
      microStep: firstStep,
      microSteps: [
        { id: `ms-${Date.now()}-1`, text: firstStep, completed: false }
      ],
      dreadLevel: 3,
      impactLevel: 4,
      category: quickFormData.category,
      status: 'todo',
      createdAt: new Date().toISOString(),
      completedAt: null,
      timeSpentSeconds: 0,
      isQuickEntry: true
    };

    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
    if (isCloudConnected) upsertRemoteTask(newTask);

    setQuickFormData({
      title: '',
      microStep: '',
      category: quickFormData.category
    });

    setTimeout(() => {
      quickTitleInputRef.current?.focus();
    }, 0);

    if (autoPlay) audioEngine.play('start');
    showNotification('⚡ Snelle taak geregistreerd! Typ direct door voor de volgende taak.', 'success');
  };

  // Full WOOP Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.outcome.trim() || !formData.microStep.trim()) {
      showNotification('Vul a.u.b. de 3 kernvragen in voor optimale momentum-begeleiding.', 'warning');
      return;
    }

    if (isEditing && editTargetId) {
      setShowSaveModal(true);
    } else {
      createNewTask();
    }
  };

  const createNewTask = () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: formData.title,
      outcome: formData.outcome,
      obstacle: formData.obstacle || 'Geen specifieke blokkade opgegeven',
      obstacleType: formData.obstacleType,
      microStep: formData.microStep,
      microSteps: [
        { id: `ms-${Date.now()}-1`, text: formData.microStep, completed: false }
      ],
      dreadLevel: Number(formData.dreadLevel),
      impactLevel: Number(formData.impactLevel),
      category: formData.category,
      status: 'todo',
      createdAt: new Date().toISOString(),
      completedAt: null,
      timeSpentSeconds: 0,
      isQuickEntry: false
    };

    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(newTask.id);
    if (isCloudConnected) upsertRemoteTask(newTask);

    resetForm();
    setShowSaveModal(false);
    if (autoPlay) audioEngine.play('start');
    showNotification('Nieuwe WOOP momentum-taak succesvol geregistreerd!', 'success');
  };

  const updateExistingTask = () => {
    let updatedObj: Task | null = null;
    setTasks(prev =>
      prev.map(t => {
        if (t.id === editTargetId) {
          const updated: Task = {
            ...t,
            title: formData.title,
            outcome: formData.outcome,
            obstacle: formData.obstacle,
            obstacleType: formData.obstacleType,
            microStep: formData.microStep,
            dreadLevel: Number(formData.dreadLevel),
            impactLevel: Number(formData.impactLevel),
            category: formData.category,
            isQuickEntry: false
          };
          updatedObj = updated;
          return updated;
        }
        return t;
      })
    );

    if (updatedObj && isCloudConnected) {
      upsertRemoteTask(updatedObj);
    }

    resetForm();
    setShowSaveModal(false);
    if (autoPlay) audioEngine.play('click');
    showNotification('Bestaande taak bijgewerkt in je canvas.', 'info');
  };

  const resetForm = () => {
    setFormData({
      title: '',
      outcome: '',
      obstacle: '',
      obstacleType: 'overwhelm',
      microStep: '',
      dreadLevel: 3,
      impactLevel: 4,
      category: 'Werk'
    });
    setIsEditing(false);
    setEditTargetId(null);
  };

  const handleEditClick = (task: Task) => {
    setIsEditing(true);
    setEditTargetId(task.id);
    setIntakeMode('woop');
    setFormData({
      title: task.title,
      outcome: task.outcome,
      obstacle: task.obstacle,
      obstacleType: task.obstacleType || 'overwhelm',
      microStep: task.microStep,
      dreadLevel: task.dreadLevel,
      impactLevel: task.impactLevel,
      category: task.category
    });
    if (autoPlay) audioEngine.play('click');
  };

  const handleEnrichQuickTask = (task: Task) => {
    handleEditClick(task);
    showNotification('Vul de WOOP-vragen in om de taakpsychologie te verdiepen.', 'info');
  };

  const handleDeleteTask = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (activeTaskId === taskId) {
      const remaining = tasks.filter(t => t.id !== taskId);
      setActiveTaskId(remaining.length > 0 ? remaining[0].id : null);
    }
    if (isCloudConnected) deleteRemoteTask(taskId);
    if (autoPlay) audioEngine.play('click');
    showNotification('Taak verwijderd uit je lijst.', 'info');
  };

  const toggleTaskCompletion = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let updatedObj: Task | null = null;
    setTasks(prev =>
      prev.map(t => {
        if (t.id === taskId) {
          const nextDone = t.status !== 'done';
          if (nextDone) {
            audioEngine.play('complete');
            showNotification('🏆 Gefeliciteerd! Taak voltooid en overwinning behaald.', 'success');
          } else {
            audioEngine.play('click');
          }
          const updated: Task = {
            ...t,
            status: nextDone ? 'done' : 'todo',
            completedAt: nextDone ? new Date().toISOString() : null
          };
          updatedObj = updated;
          return updated;
        }
        return t;
      })
    );

    if (updatedObj && isCloudConnected) {
      upsertRemoteTask(updatedObj);
    }
  };

  const toggleMicroStep = (taskId: string, stepId: string) => {
    let updatedObj: Task | null = null;
    setTasks(prev =>
      prev.map(t => {
        if (t.id === taskId) {
          const updatedSteps = t.microSteps.map(s => {
            if (s.id === stepId) {
              const nextState = !s.completed;
              if (nextState && autoPlay) audioEngine.play('complete');
              return { ...s, completed: nextState };
            }
            return s;
          });
          const updated = { ...t, microSteps: updatedSteps };
          updatedObj = updated;
          return updated;
        }
        return t;
      })
    );

    if (updatedObj && isCloudConnected) {
      upsertRemoteTask(updatedObj);
    }
  };

  const handleAddMicroStep = (e?: React.FormEvent, customText: string | null = null) => {
    if (e) e.preventDefault();
    const textToAdd = customText !== null ? customText : newStepText;
    if (!textToAdd.trim() || !activeTaskId) return;

    const newStepObj = {
      id: `ms-${Date.now()}`,
      text: textToAdd.trim(),
      completed: false
    };

    let updatedObj: Task | null = null;
    setTasks(prev =>
      prev.map(t => {
        if (t.id === activeTaskId) {
          const updated = {
            ...t,
            microSteps: [...(t.microSteps || []), newStepObj]
          };
          updatedObj = updated;
          return updated;
        }
        return t;
      })
    );

    if (updatedObj && isCloudConnected) {
      upsertRemoteTask(updatedObj);
    }

    setNewStepText('');
    setZenNewStepText('');
    if (autoPlay) audioEngine.play('click');
    showNotification('Micro-stap toegevoegd aan de taak.', 'info');
  };

  const toggleTimer = (forceOpenZen = false) => {
    if (!isTimerRunning) {
      audioEngine.play('start');
      setBurstCompleted(false);
      if (timerSeconds === 0) setTimerSeconds(timerDuration);
      if (forceOpenZen || autoOpenZenOnTimer) {
        setIsZenMode(true);
      }
      showNotification('🚀 Timer gestart! Blijf gefocust op de micro-stap.', 'info');
    } else {
      audioEngine.play('click');
    }
    setIsTimerRunning(!isTimerRunning);
  };

  const resetTimer = (newDuration = 120) => {
    setIsTimerRunning(false);
    setTimerDuration(newDuration);
    setTimerSeconds(newDuration);
    setBurstCompleted(false);
    audioEngine.play('click');
  };

  const extendTimer = (extraSeconds: number) => {
    setTimerDuration(prev => prev + extraSeconds);
    setTimerSeconds(prev => prev + extraSeconds);
    setBurstCompleted(false);
    setIsTimerRunning(true);
    if (autoPlay) audioEngine.play('start');
    showNotification(`⚡ +${Math.round(extraSeconds / 60)} min Flow verlengd! Blijf in de zone.`, 'success');
  };

  // Cloud Configuration Handlers
  const handleTestCloudConnection = async () => {
    if (!cloudUrlInput.trim() || !cloudKeyInput.trim()) {
      setCloudMessage({ type: 'error', text: 'Vul a.u.b. zowel de Supabase URL als de Anon Key in.' });
      return;
    }
    setCloudTesting(true);
    setCloudMessage(null);
    const res = await testSupabaseConnection({ url: cloudUrlInput, anonKey: cloudKeyInput });
    setCloudTesting(false);
    if (res.success) {
      setCloudMessage({ type: 'success', text: `✅ ${res.message}` });
    } else {
      setCloudMessage({ type: 'error', text: `❌ ${res.message}` });
    }
  };

  const handleSaveCloudConnection = async () => {
    if (!cloudUrlInput.trim() || !cloudKeyInput.trim()) {
      setCloudMessage({ type: 'error', text: 'Vul a.u.b. zowel de Supabase URL als de Anon Key in.' });
      return;
    }

    setCloudTesting(true);
    const res = await testSupabaseConnection({ url: cloudUrlInput, anonKey: cloudKeyInput });
    setCloudTesting(false);

    if (res.success) {
      saveSupabaseConfig({ url: cloudUrlInput.trim(), anonKey: cloudKeyInput.trim() });
      setIsCloudConnected(true);
      showNotification('🚀 Supabase Cloud verbinding opgeslagen & geactiveerd!', 'success');
      setShowCloudModal(false);
      
      // Auto fetch
      fetchRemoteTasks().then(remoteTasks => {
        if (remoteTasks && remoteTasks.length > 0) {
          setTasks(remoteTasks);
        }
      });
    } else {
      setCloudMessage({ type: 'error', text: `Kan niet verbinden: ${res.message}` });
    }
  };

  const handleDisconnectCloud = () => {
    saveSupabaseConfig(null);
    setIsCloudConnected(false);
    setCloudUrlInput('');
    setCloudKeyInput('');
    setCloudMessage(null);
    setShowCloudModal(false);
    showNotification('Cloud verbinding verbroken. App werkt nu lokaal.', 'info');
  };

  const handleBulkUploadToCloud = async () => {
    if (!isCloudConnected) {
      showNotification('Verbind eerst met Supabase voordat je kunt uploaden.', 'warning');
      return;
    }
    setCloudTesting(true);
    const res = await bulkUploadTasks(tasks);
    setCloudTesting(false);
    if (res.success) {
      setCloudMessage({ type: 'success', text: `✅ ${res.count} taken succesvol geüpload naar Supabase Cloud!` });
      showNotification(`📦 ${res.count} taken geüpload naar de cloud.`, 'success');
    } else {
      setCloudMessage({ type: 'error', text: 'Fout bij het uploaden van taken.' });
    }
  };

  const handleFetchFromCloud = async () => {
    if (!isCloudConnected) return;
    setCloudTesting(true);
    const remoteTasks = await fetchRemoteTasks();
    setCloudTesting(false);
    if (remoteTasks) {
      setTasks(remoteTasks);
      if (remoteTasks.length > 0) setActiveTaskId(remoteTasks[0].id);
      showNotification(`⚡ ${remoteTasks.length} taken opgehaald uit de cloud!`, 'success');
      setShowCloudModal(false);
    } else {
      setCloudMessage({ type: 'error', text: 'Kon geen taken ophalen uit Supabase.' });
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
    showNotification('📋 SQL script gekopieerd naar klembord!', 'info');
  };

  const handleExportJSON = () => {
    const backupData = {
      app: 'Editorial Momentum Task Canvas',
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      tasks: tasks,
      settings: {
        isDarkMode,
        soundEnabled,
        autoPlay,
        soundVolume,
        autoOpenZenOnTimer
      }
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `momentum-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (autoPlay) audioEngine.play('complete');
    showNotification('📦 JSON Backup gedownload!', 'success');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const content = event.target?.result;
          if (typeof content === 'string') {
            const parsed = JSON.parse(content);
            if (parsed && Array.isArray(parsed.tasks)) {
              setTasks(parsed.tasks);
              if (parsed.tasks.length > 0) setActiveTaskId(parsed.tasks[0].id);
              if (parsed.settings) {
                if (typeof parsed.settings.isDarkMode === 'boolean') setIsDarkMode(parsed.settings.isDarkMode);
              }
              if (isCloudConnected) bulkUploadTasks(parsed.tasks);
              setShowBackupModal(false);
              if (autoPlay) audioEngine.play('complete');
              showNotification('✅ Backup succesvol ingeladen en gesynchroniseerd!', 'success');
            } else {
              showNotification('Ongeldig bestand: Geen geldige takenstructuur gevonden.', 'warning');
            }
          }
        } catch (err) {
          showNotification('Fout bij het lezen van JSON-bestand.', 'warning');
        }
      };
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterMode === 'frogs' && t.dreadLevel < 4) return false;
      if (filterMode === 'quick' && t.dreadLevel > 2) return false;
      if (filterMode === 'done' && t.status !== 'done') return false;
      if (filterMode === 'todo' && t.status === 'done') return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      return true;
    });
  }, [tasks, filterMode, categoryFilter]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Timer Progress percentage (0 - 100)
  const timerProgress = useMemo(() => {
    if (timerDuration <= 0) return 0;
    const passed = timerDuration - timerSeconds;
    return Math.min(100, Math.max(0, (passed / timerDuration) * 100));
  }, [timerSeconds, timerDuration]);

  const bgClass = isDarkMode ? 'bg-[#12100E] text-[#F3EFEA]' : 'bg-[#FAF8F5] text-[#1C1917]';
  const cardBgClass = isDarkMode ? 'bg-[#1C1A17] border-[#F3EFEA]/20' : 'bg-white border-[#1C1917]/15';
  const borderDoubleClass = isDarkMode ? 'border-b-2 border-double border-[#F3EFEA]/20' : 'border-b-2 border-double border-[#1C1917]/20';
  const accentTextClass = isDarkMode ? 'text-[#E05626]' : 'text-[#C2410C]';
  const accentBgClass = isDarkMode ? 'bg-[#E05626] hover:bg-[#C84519] text-white' : 'bg-[#C2410C] hover:bg-[#9A3412] text-white';

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${bgClass} pb-16 relative`}>
      
      {/* ========================================================================= */}
      {/* ZEN / FULLSCREEN FOCUS SPRINT MODUS (FASE 1)                              */}
      {/* ========================================================================= */}
      {isZenMode && activeTask && (
        <div className={`fixed inset-0 z-50 flex flex-col justify-between p-6 lg:p-12 transition-all duration-500 backdrop-blur-xl ${
          isDarkMode ? 'bg-[#12100E]/98 text-[#F3EFEA]' : 'bg-[#FAF8F5]/98 text-[#1C1917]'
        }`}>
          
          {/* Zen Header */}
          <div className="max-w-4xl w-full mx-auto flex items-center justify-between border-b border-[#1C1917]/15 dark:border-[#F3EFEA]/15 pb-4">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded font-mono text-xs uppercase font-bold tracking-wider ${
                activeTask.dreadLevel >= 4
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                  : (isDarkMode ? 'bg-[#26221F] border border-[#F3EFEA]/20' : 'bg-stone-200 border border-stone-300')
              }`}>
                {activeTask.dreadLevel >= 4 ? '🔥 KIKKER FOCUS' : '⚡ FOCUS SPRINT'}
              </span>
              <span className="font-mono text-xs opacity-60 uppercase">{activeTask.category}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded border text-xs font-mono flex items-center gap-1 ${
                  isDarkMode ? 'border-[#F3EFEA]/20 hover:bg-[#26221F]' : 'border-[#1C1917]/20 hover:bg-stone-200'
                }`}
                title={soundEnabled ? 'Geluid dempen' : 'Geluid inschakelen'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-50" />}
              </button>

              <button
                onClick={() => setIsZenMode(false)}
                className={`px-3 py-1.5 rounded border font-mono text-xs flex items-center gap-1.5 transition-colors ${
                  isDarkMode ? 'border-[#F3EFEA]/30 hover:bg-[#26221F]' : 'border-[#1C1917]/30 hover:bg-stone-200'
                }`}
                title="Sluit Zen Modus (Esc)"
              >
                <Minimize2 className="w-4 h-4" />
                <span>VERLAAT ZEN (ESC)</span>
              </button>
            </div>
          </div>

          {/* Zen Center Stage */}
          <div className="max-w-3xl w-full mx-auto my-auto py-6 space-y-8 text-center">
            
            {/* Task Title & Outcome */}
            <div className="space-y-3">
              <h1 className="font-serif text-3xl lg:text-5xl font-black tracking-tight leading-tight">
                {activeTask.title}
              </h1>
              <p className="font-serif italic text-sm lg:text-base opacity-80 max-w-xl mx-auto text-emerald-700 dark:text-emerald-400">
                🎯 "{activeTask.outcome}"
              </p>
            </div>

            {/* Prominent Circular Focus Timer */}
            <div className="relative flex flex-col items-center justify-center py-2">
              <div className="relative w-48 h-48 lg:w-56 lg:h-56 flex items-center justify-center">
                
                {/* SVG Circular Progress Track */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    className={`stroke-current ${isDarkMode ? 'text-[#26221F]' : 'text-stone-200'}`}
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    className={`stroke-current transition-all duration-500 ${
                      isTimerRunning ? 'text-[#C2410C] dark:text-[#E05626]' : 'text-amber-500'
                    }`}
                    strokeWidth="6"
                    strokeDasharray={276.46}
                    strokeDashoffset={276.46 - (276.46 * timerProgress) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                {/* Center Timer Countdown */}
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="font-mono font-black text-4xl lg:text-5xl tracking-widest">
                    {formatTimer(timerSeconds)}
                  </span>
                  <span className="font-mono text-[11px] uppercase opacity-60 tracking-wider mt-1">
                    {isTimerRunning ? 'ACTIEF FOCUSBLOK' : (burstCompleted ? 'BURST VOLTOOID' : 'KLAAR VOOR START')}
                  </span>
                </div>
              </div>

              {/* Timer Main Controls */}
              <div className="flex items-center justify-center gap-3 mt-5 font-mono">
                <button
                  onClick={() => toggleTimer(false)}
                  className={`py-3 px-8 rounded font-bold text-sm uppercase flex items-center gap-2.5 transition-all shadow-lg ${
                    isTimerRunning
                      ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                      : accentBgClass
                  }`}
                >
                  {isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  <span>{isTimerRunning ? 'PAUZE (SPATIE)' : 'START SPRINT (SPATIE)'}</span>
                </button>

                <button
                  onClick={() => resetTimer(120)}
                  className={`p-3 rounded border transition-colors ${
                    isDarkMode ? 'border-[#F3EFEA]/20 hover:bg-[#26221F]' : 'border-[#1C1917]/20 hover:bg-stone-200'
                  }`}
                  title="Herstart 2-Minuten Timer (R)"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>

              {/* Flow State Extensions */}
              {(burstCompleted || timerSeconds === 0) && (
                <div className="mt-4 p-4 rounded border bg-emerald-500/10 border-emerald-500/30 max-w-md mx-auto space-y-2 animate-fadeIn">
                  <div className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>HET IJS IS GEBROKEN! MOMENTUM VASTHOUDEN?</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 font-mono text-xs">
                    <button
                      onClick={() => extendTimer(300)}
                      className={`px-4 py-2 rounded font-bold ${accentBgClass} flex items-center gap-1`}
                    >
                      <FastForward className="w-4 h-4" /> +5 MIN FLOW SPRINT
                    </button>
                    <button
                      onClick={() => {
                        toggleTaskCompletion(activeTask.id);
                        setIsZenMode(false);
                      }}
                      className="px-4 py-2 rounded font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" /> VOLTOOI TAAK
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Current Active Micro-Step Hero Box */}
            {nextIncompleteMicroStep ? (
              <div className={`p-6 rounded-lg border text-left max-w-xl mx-auto shadow-md transition-all ${
                isDarkMode ? 'bg-[#1C1A17] border-[#F3EFEA]/20' : 'bg-white border-[#1C1917]/20'
              }`}>
                <div className="flex items-center justify-between text-xs font-mono uppercase pb-2 border-b border-[#1C1917]/10 dark:border-[#F3EFEA]/10 text-amber-600 dark:text-amber-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" /> HUIDIGE MICRO-STAP
                  </span>
                  <span className="opacity-60 font-normal">Druk [Enter] of [C] bij afronding</span>
                </div>

                <div className="py-3 flex items-start gap-4">
                  <button
                    onClick={() => toggleMicroStep(activeTask.id, nextIncompleteMicroStep.id)}
                    className="mt-1 w-6 h-6 rounded border-2 border-amber-600 flex items-center justify-center flex-shrink-0 hover:bg-amber-500/20 transition-colors"
                    title="Vink deze micro-stap af (Enter / C)"
                  >
                    <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </button>
                  <p className="font-serif text-lg lg:text-xl font-bold leading-snug">
                    {nextIncompleteMicroStep.text}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-lg border bg-emerald-500/10 border-emerald-500/30 max-w-xl mx-auto space-y-3">
                <Trophy className="w-8 h-8 mx-auto text-amber-500" />
                <h3 className="font-serif text-xl font-bold">Alle micro-stappen zijn afgevinkt!</h3>
                <button
                  onClick={() => {
                    toggleTaskCompletion(activeTask.id);
                    setIsZenMode(false);
                  }}
                  className={`py-2 px-6 rounded font-mono font-bold text-xs uppercase ${accentBgClass}`}
                >
                  🏆 Markeer gehele taak als voltooid
                </button>
              </div>
            )}

            {/* Quick Micro-step Add Form inside Zen Mode */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (zenNewStepText.trim()) {
                  handleAddMicroStep(e, zenNewStepText);
                }
              }}
              className="max-w-xl mx-auto flex gap-2 pt-1"
            >
              <input
                type="text"
                placeholder="Voeg volgende kleine micro-stap toe..."
                value={zenNewStepText}
                onChange={(e) => setZenNewStepText(e.target.value)}
                className={`flex-1 p-2.5 rounded border text-xs font-sans focus:outline-none ${
                  isDarkMode ? 'bg-[#1C1A17] border-[#F3EFEA]/20' : 'bg-white border-[#1C1917]/20'
                }`}
              />
              <button
                type="submit"
                className={`px-4 py-2.5 rounded font-mono font-bold text-xs uppercase ${accentBgClass}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

          </div>

          {/* Zen Keyboard Shortcuts Footer */}
          <div className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-[#1C1917]/15 dark:border-[#F3EFEA]/15 text-[11px] font-mono opacity-70">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded border bg-black/10 dark:bg-white/10">SPATIE</kbd>
              <span>Start / Pauze</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded border bg-black/10 dark:bg-white/10">ENTER / C</kbd>
              <span>Stap Voltooien</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded border bg-black/10 dark:bg-white/10">R</kbd>
              <span>Reset Timer</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded border bg-black/10 dark:bg-white/10">ESC</kbd>
              <span>Sluit Zen Modus</span>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN TOP NAVIGATION BAR                                                   */}
      {/* ========================================================================= */}
      <header className={`sticky top-0 z-40 backdrop-blur-md bg-opacity-90 ${isDarkMode ? 'bg-[#12100E]/90' : 'bg-[#FAF8F5]/90'} border-b ${isDarkMode ? 'border-[#F3EFEA]/15' : 'border-[#1C1917]/15'} px-4 lg:px-8 py-3.5`}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Brand & Masthead Title */}
          <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded flex items-center justify-center font-serif font-bold text-lg border ${isDarkMode ? 'bg-[#26221F] border-[#F3EFEA]/30 text-[#E05626]' : 'bg-[#1C1917] border-[#1C1917] text-[#FAF8F5]'}`}>
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-black text-xl tracking-tight uppercase">MOMENTUM</h1>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 uppercase border rounded ${isDarkMode ? 'border-[#F3EFEA]/20 text-[#F3EFEA]/70' : 'border-[#1C1917]/20 text-[#1C1917]/70'}`}>
                  VOL. 01 / EDITORIAL
                </span>
              </div>
              <p className="text-xs font-serif italic text-opacity-70 opacity-70">
                Wetenschappelijk anti-uitstel canvas voor actie & oplevering
              </p>
            </div>
          </div>

          {/* Master Controls & Global Utilities */}
          <div className="flex items-center space-x-3 text-xs font-mono">
            
            {/* Supabase Cloud Sync Status Button */}
            <button
              onClick={() => setShowCloudModal(true)}
              className={`px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5 ${
                isCloudConnected
                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold'
                  : (isDarkMode ? 'border-[#F3EFEA]/20 text-[#F3EFEA]/70 hover:bg-[#26221F]' : 'border-[#1C1917]/20 text-[#1C1917]/70 hover:bg-stone-100')
              }`}
              title="Cloud synchronisatie tussen verschillende pc's configureren"
            >
              {isCloudConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Cloud className="w-3.5 h-3.5" />
                  <span>SYNC: LIVE</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 opacity-60" />
                  <span>CLOUD SYNC</span>
                </>
              )}
            </button>

            {/* Auto-open Zen on Timer toggle */}
            <button
              onClick={() => {
                setAutoOpenZenOnTimer(!autoOpenZenOnTimer);
                showNotification(!autoOpenZenOnTimer ? 'Zen Modus opent nu automatisch bij start timer' : 'Automatische Zen Modus uitgeschakeld', 'info');
              }}
              className={`px-2.5 py-1.5 rounded border transition-colors hidden md:flex items-center gap-1.5 ${
                autoOpenZenOnTimer
                  ? (isDarkMode ? 'bg-[#E05626]/20 border-[#E05626] text-[#E05626]' : 'bg-[#C2410C]/10 border-[#C2410C] text-[#C2410C]')
                  : (isDarkMode ? 'border-[#F3EFEA]/20 text-[#F3EFEA]/60' : 'border-[#1C1917]/20 text-[#1C1917]/60')
              }`}
              title="Open automatisch de afleidingsvrije Zen Modus zodra de timer start"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>AUTO-ZEN: {autoOpenZenOnTimer ? 'AAN' : 'UIT'}</span>
            </button>

            {/* Auto-Play Toggle */}
            <button
              onClick={() => {
                setAutoPlay(!autoPlay);
                showNotification(autoPlay ? 'Auto-play gedempt' : 'Auto-play geactiveerd', 'info');
              }}
              className={`px-2.5 py-1.5 rounded border transition-colors hidden sm:flex items-center gap-1.5 ${
                autoPlay 
                  ? (isDarkMode ? 'bg-[#E05626]/20 border-[#E05626] text-[#E05626]' : 'bg-[#C2410C]/10 border-[#C2410C] text-[#C2410C]')
                  : (isDarkMode ? 'border-[#F3EFEA]/20 text-[#F3EFEA]/60' : 'border-[#1C1917]/20 text-[#1C1917]/60')
              }`}
              title="Speel automatisch auditieve feedback bij acties"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>GELUID: {autoPlay ? 'AAN' : 'UIT'}</span>
            </button>

            {/* Sound Mute Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded border ${isDarkMode ? 'border-[#F3EFEA]/20 hover:bg-[#26221F]' : 'border-[#1C1917]/20 hover:bg-[#FAF8F5]'}`}
              title={soundEnabled ? 'Geluid dempen' : 'Geluid inschakelen'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Dark/Light Mode Toggle */}
            <button
              onClick={() => {
                setIsDarkMode(!isDarkMode);
                showNotification(!isDarkMode ? 'Dark Ink Modus ingeschakeld' : 'Warm Paper Modus ingeschakeld', 'info');
              }}
              className={`p-1.5 rounded border transition-colors flex items-center gap-1 ${isDarkMode ? 'border-[#F3EFEA]/20 bg-[#26221F] text-amber-300' : 'border-[#1C1917]/20 bg-[#FAF8F5] text-amber-700'}`}
              title="Schakel tussen Dark Ink & Warm Paper thema"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Backup / Restore Trigger Button */}
            <button
              onClick={() => setShowBackupModal(true)}
              className={`px-3 py-1.5 rounded border font-mono uppercase text-xs flex items-center gap-1.5 transition-all ${isDarkMode ? 'border-[#F3EFEA]/30 hover:bg-[#26221F]' : 'border-[#1C1917]/30 hover:bg-stone-100'}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">BACKUP</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* EDITORIAL MASTHEAD BANNER                                                 */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6">
        
        <div className={`pb-4 mb-6 ${borderDoubleClass} flex flex-wrap items-end justify-between gap-4`}>
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-opacity-60 opacity-60">
              ANTI-UITSTEL METHODOLOGIE // WOOP + MICRO-MOMENTUM
            </div>
            <h2 className="font-serif text-2xl lg:text-3xl font-black tracking-tight mt-1">
              Overwin Uitstel via Resultaat & Weerstands-Analyse
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>VOLTOOID: {stats.completed}/{stats.total} ({stats.completionRate}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>KIKKERS: {stats.frogCount}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ========================================================================= */}
          {/* COL 1 (3 COLS): INTAKE WIZARD (SNELLE INVOER & WOOP)                       */}
          {/* ========================================================================= */}
          <div className="lg:col-span-3 space-y-6">
            <div className={`p-5 rounded border ${cardBgClass}`}>
              
              {/* Header with Mode Switcher (Phase 1 Quick vs WOOP) */}
              <div className="pb-3 border-b border-[#1C1917]/10 dark:border-[#F3EFEA]/10 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${accentBgClass}`}>
                      01
                    </span>
                    <h3 className="font-serif uppercase font-bold text-base tracking-wide">
                      {isEditing ? 'TAAK BEWERKEN' : 'INTAKE WIZARD'}
                    </h3>
                  </div>
                  {isEditing && (
                    <button
                      onClick={resetForm}
                      className="text-xs font-mono underline opacity-70 hover:opacity-100"
                    >
                      Annuleren
                    </button>
                  )}
                </div>

                {/* Tab Switcher: Quick Brain Dump vs WOOP Intake */}
                {!isEditing && (
                  <div className="grid grid-cols-2 gap-1 p-1 rounded bg-black/5 dark:bg-white/5 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setIntakeMode('quick');
                        setTimeout(() => quickTitleInputRef.current?.focus(), 0);
                      }}
                      className={`py-1.5 px-2 rounded transition-all flex items-center justify-center gap-1 ${
                        intakeMode === 'quick'
                          ? (isDarkMode ? 'bg-[#26221F] text-[#E05626] font-bold shadow-sm' : 'bg-white text-[#C2410C] font-bold shadow-sm')
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <Zap className="w-3 h-3" />
                      <span>⚡ SNEL (10s)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIntakeMode('woop')}
                      className={`py-1.5 px-2 rounded transition-all flex items-center justify-center gap-1 ${
                        intakeMode === 'woop'
                          ? (isDarkMode ? 'bg-[#26221F] text-[#E05626] font-bold shadow-sm' : 'bg-white text-[#C2410C] font-bold shadow-sm')
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <Target className="w-3 h-3" />
                      <span>🧠 WOOP DIEP</span>
                    </button>
                  </div>
                )}
              </div>

              {/* MODE A: 10-SECOND QUICK BRAIN DUMP (FASE 1) */}
              {!isEditing && intakeMode === 'quick' ? (
                <form onSubmit={handleQuickSubmit} className="space-y-4 text-xs font-sans">
                  <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 font-serif italic text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                    "Voel je weerstand? Schrijf enkel de taaknaam en druk op Enter om direct door te tikken."
                  </div>

                  <div>
                    <label className="block font-mono font-bold uppercase text-[11px] mb-1">
                      Wat stel je uit? (Taaknaam)
                    </label>
                    <input
                      ref={quickTitleInputRef}
                      type="text"
                      required
                      placeholder="bijv. E-mail beantwoorden over offerte"
                      value={quickFormData.title}
                      onChange={(e) => setQuickFormData({ ...quickFormData, title: e.target.value })}
                      className={`w-full p-2.5 rounded border text-xs font-sans focus:outline-none ${
                        isDarkMode
                          ? 'bg-[#12100E] border-[#F3EFEA]/30 focus:border-[#E05626]'
                          : 'bg-[#FAF8F5] border-[#1C1917]/30 focus:border-[#C2410C]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-mono font-bold uppercase text-[11px] mb-1 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      Eerste micro-stap (&lt; 1 minuut):
                    </label>
                    <input
                      type="text"
                      placeholder="bijv. Alleen conceptmail openen"
                      value={quickFormData.microStep}
                      onChange={(e) => setQuickFormData({ ...quickFormData, microStep: e.target.value })}
                      className={`w-full p-2.5 rounded border text-xs font-sans focus:outline-none ${
                        isDarkMode
                          ? 'bg-[#12100E] border-[#F3EFEA]/30 focus:border-[#E05626]'
                          : 'bg-[#FAF8F5] border-[#1C1917]/30 focus:border-[#C2410C]'
                      }`}
                    />
                    <span className="text-[10px] font-mono opacity-60 mt-1 block">
                      Optioneel — standaard: "Open het bestand/document"
                    </span>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] uppercase opacity-70 mb-1">
                      Categorie:
                    </label>
                    <select
                      value={quickFormData.category}
                      onChange={(e) => setQuickFormData({ ...quickFormData, category: e.target.value })}
                      className={`w-full p-2 rounded border text-xs ${
                        isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/30' : 'bg-[#FAF8F5] border-[#1C1917]/30'
                      }`}
                    >
                      <option value="Werk">Werk & Carrière</option>
                      <option value="Administratie">Administratie & Financiën</option>
                      <option value="Gezondheid">Gezondheid & Huishouden</option>
                      <option value="Creatief">Creatief & Studie</option>
                      <option value="Persoonlijk">Persoonlijk</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className={`w-full py-3 px-4 rounded font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 ${accentBgClass}`}
                  >
                    <Zap className="w-4 h-4" />
                    <span>SNEL REGISTREREN &amp; STARTEN</span>
                  </button>
                </form>
              ) : (
                /* MODE B: DIEPE WOOP INTAKE */
                <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-sans">
                  
                  {/* Taaknaam / Doel */}
                  <div>
                    <label className="block font-mono font-bold uppercase text-[11px] mb-1">
                      Taaknaam / Project
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="bijv. Belastingaangifte 2025 invullen"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className={`w-full p-2.5 rounded border text-xs font-sans focus:outline-none ${
                        isDarkMode
                          ? 'bg-[#12100E] border-[#F3EFEA]/30 focus:border-[#E05626]'
                          : 'bg-[#FAF8F5] border-[#1C1917]/30 focus:border-[#C2410C]'
                      }`}
                    />
                  </div>

                  {/* Vraag 1: Wat wil je bereiken / opleveren? */}
                  <div>
                    <label className="block font-mono font-bold uppercase text-[11px] mb-1 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" />
                      1. Wat wil je bereiken / opleveren?
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Welk concreet resultaat of welk gevoel van rust levert het op?"
                      value={formData.outcome}
                      onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                      className={`w-full p-2.5 rounded border text-xs font-sans focus:outline-none ${
                        isDarkMode
                          ? 'bg-[#12100E] border-[#F3EFEA]/30 focus:border-[#E05626]'
                          : 'bg-[#FAF8F5] border-[#1C1917]/30 focus:border-[#C2410C]'
                      }`}
                    />
                  </div>

                  {/* Vraag 2: Wat is de grootste uitdaging of blokkade? */}
                  <div>
                    <label className="block font-mono font-bold uppercase text-[11px] mb-1 text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      2. Wat is de grootste blokkade / angst?
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Waar zie je het meest tegenop? (bijv. saai, te groot, angst voor fouten)"
                      value={formData.obstacle}
                      onChange={(e) => setFormData({ ...formData, obstacle: e.target.value })}
                      className={`w-full p-2.5 rounded border text-xs font-sans focus:outline-none ${
                        isDarkMode
                          ? 'bg-[#12100E] border-[#F3EFEA]/30 focus:border-[#E05626]'
                          : 'bg-[#FAF8F5] border-[#1C1917]/30 focus:border-[#C2410C]'
                      }`}
                    />
                  </div>

                  {/* Blokkade Categorie voor Psychologisch Advies */}
                  <div>
                    <label className="block font-mono text-[10px] uppercase opacity-70 mb-1">
                      Aard van de weerstand:
                    </label>
                    <select
                      value={formData.obstacleType}
                      onChange={(e) => setFormData({ ...formData, obstacleType: e.target.value })}
                      className={`w-full p-2 rounded border text-xs ${
                        isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/30' : 'bg-[#FAF8F5] border-[#1C1917]/30'
                      }`}
                    >
                      <option value="overwhelm">Overweldiging (Te groot / Veel werk)</option>
                      <option value="perfectionism">Perfectionisme (Bang voor fouten)</option>
                      <option value="boredom">Verveling (Saai / Geen zin)</option>
                      <option value="fear">Angst voor reactie / onzekerheid</option>
                    </select>
                  </div>

                  {/* Vraag 3: Eerste micro-stap */}
                  <div>
                    <label className="block font-mono font-bold uppercase text-[11px] mb-1 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      3. Eerste micro-stap (&lt; 2 min)?
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="bijv. Enkel de map opzoeken en openen op het bureau"
                      value={formData.microStep}
                      onChange={(e) => setFormData({ ...formData, microStep: e.target.value })}
                      className={`w-full p-2.5 rounded border text-xs font-sans focus:outline-none ${
                        isDarkMode
                          ? 'bg-[#12100E] border-[#F3EFEA]/30 focus:border-[#E05626]'
                          : 'bg-[#FAF8F5] border-[#1C1917]/30 focus:border-[#C2410C]'
                      }`}
                    />
                  </div>

                  {/* Weerstands- & Impact Metrics */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-mono text-[10px] uppercase mb-1 flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-500" />
                        Weerstand (1-5):
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={formData.dreadLevel}
                        onChange={(e) => setFormData({ ...formData, dreadLevel: parseInt(e.target.value) })}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-mono opacity-60">
                        <span>1 (Licht)</span>
                        <span className="font-bold text-amber-600">{formData.dreadLevel} 🔥</span>
                        <span>5 (Kikker)</span>
                      </div>
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] uppercase mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                        Impact (1-5):
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={formData.impactLevel}
                        onChange={(e) => setFormData({ ...formData, impactLevel: parseInt(e.target.value) })}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] font-mono opacity-60">
                        <span>1 (Laag)</span>
                        <span className="font-bold text-emerald-600">{formData.impactLevel} 🌟</span>
                        <span>5 (Hoog)</span>
                      </div>
                    </div>
                  </div>

                  {/* Categorie Tag */}
                  <div>
                    <label className="block font-mono text-[10px] uppercase opacity-70 mb-1">
                      Categorie:
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className={`w-full p-2 rounded border text-xs ${
                        isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/30' : 'bg-[#FAF8F5] border-[#1C1917]/30'
                      }`}
                    >
                      <option value="Werk">Werk & Carrière</option>
                      <option value="Administratie">Administratie & Financiën</option>
                      <option value="Gezondheid">Gezondheid & Huishouden</option>
                      <option value="Creatief">Creatief & Studie</option>
                      <option value="Persoonlijk">Persoonlijk</option>
                    </select>
                  </div>

                  {/* Form Action Button */}
                  <button
                    type="submit"
                    className={`w-full py-3 px-4 rounded font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 ${accentBgClass}`}
                  >
                    {isEditing ? (
                      <>
                        <Edit3 className="w-4 h-4" />
                        <span>TAAK BIJWERKEN</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>REGISTREER IN CANVAS</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Quick Productivity Coach Tip Card */}
            <div className={`p-4 rounded border ${cardBgClass} text-xs`}>
              <div className="flex items-center gap-1.5 font-mono font-bold uppercase text-[11px] mb-2 text-amber-600 dark:text-amber-400">
                <Lightbulb className="w-4 h-4" />
                <span>Coach Regel van Fogg</span>
              </div>
              <p className="font-serif italic text-opacity-80 opacity-80 leading-relaxed">
                "Voel je weerstand? Maak de eerste stap nóg kleiner. Als 2 minuten te zwaar voelt, maak er dan 30 seconden van."
              </p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COL 2 (5 COLS): ACTIVE TASK INSPECTOR & ANTI-UITSTEL CANVAS                */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-6">
            
            {activeTask ? (
              <div className={`p-6 rounded border ${cardBgClass} space-y-6 relative`}>
                
                {/* Section Title Header & Zen Trigger */}
                <div className="flex items-center justify-between border-b border-[#1C1917]/10 dark:border-[#F3EFEA]/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${accentBgClass}`}>
                      02
                    </span>
                    <h3 className="font-serif uppercase font-bold text-base tracking-wide">
                      ANTI-UITSTEL INSPECTOR
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Zen Focus Trigger Button */}
                    <button
                      onClick={() => setIsZenMode(true)}
                      className={`px-2.5 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1 transition-all ${
                        isDarkMode ? 'bg-[#26221F] text-[#E05626] hover:bg-[#332D28] border border-[#E05626]/40' : 'bg-stone-100 text-[#C2410C] hover:bg-stone-200 border border-[#C2410C]/40'
                      }`}
                      title="Open afleidingsvrije Zen Focus Sprint"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>ZEN FOCUS</span>
                    </button>

                    {activeTask.dreadLevel >= 4 && (
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> KIKKER
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Entry Enrichment Prompt Badge (Phase 1) */}
                {activeTask.isQuickEntry && (
                  <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="font-mono text-[11px]">Snelle invoer — verdiep de weerstandsanalyse:</span>
                    </div>
                    <button
                      onClick={() => handleEnrichQuickTask(activeTask)}
                      className="px-2 py-1 rounded font-mono text-[10px] font-bold uppercase underline hover:opacity-80"
                    >
                      Vul WOOP aan →
                    </button>
                  </div>
                )}

                {/* Main Active Task Title & Status Toggle */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-serif text-2xl font-black leading-tight">
                      {activeTask.title}
                    </h2>
                    <button
                      onClick={(e) => toggleTaskCompletion(activeTask.id, e)}
                      className={`p-2 rounded border transition-colors flex-shrink-0 ${
                        activeTask.status === 'done'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : (isDarkMode ? 'border-[#F3EFEA]/30 hover:bg-[#26221F]' : 'border-[#1C1917]/30 hover:bg-stone-100')
                      }`}
                      title={activeTask.status === 'done' ? 'Markeer als onvoltooid' : 'Markeer als voltooid'}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Outcome Highlight Box */}
                  <div className="p-3.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                    <div className="font-mono font-bold uppercase text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" />
                      Het Gewenste Resultaat / Oplevering:
                    </div>
                    <p className="font-serif text-sm font-medium leading-relaxed">
                      "{activeTask.outcome}"
                    </p>
                  </div>
                </div>

                {/* Obstacle & WOOP Contract Box */}
                <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/15' : 'bg-[#FAF8F5] border-[#1C1917]/15'} text-xs space-y-2`}>
                  <div className="font-mono font-bold uppercase text-[10px] text-rose-600 dark:text-rose-400 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Grootste Blokkade &amp; Angst:
                    </span>
                    <span className="font-normal opacity-70">
                      Weerstand: {activeTask.dreadLevel}/5 🔥
                    </span>
                  </div>
                  <p className="font-serif italic text-opacity-90 opacity-90">
                    "{activeTask.obstacle}"
                  </p>
                  
                  {/* WOOP If/Then Intention Protocol */}
                  <div className="pt-2 border-t border-dashed border-[#1C1917]/10 dark:border-[#F3EFEA]/10 font-mono text-[11px]">
                    <span className="font-bold text-amber-600 dark:text-amber-400">WOOP ALS/DAN REGEL: </span>
                    <span>"ALS ik weerstand voel om te starten, DAN voer ik direct enkel de micro-stap uit."</span>
                  </div>
                </div>

                {/* Psychologisch Coach Advies Card */}
                {activeTask.obstacleType && COACH_NUDGES[activeTask.obstacleType] && (
                  <div className={`p-4 rounded border text-xs space-y-2 ${
                    isDarkMode ? 'bg-amber-950/20 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-amber-700 dark:text-amber-400 uppercase text-[11px]">
                      <Sparkles className="w-4 h-4" />
                      <span>Coach Advies: {COACH_NUDGES[activeTask.obstacleType].title}</span>
                    </div>
                    <p className="font-serif italic text-opacity-90 opacity-90">
                      "{COACH_NUDGES[activeTask.obstacleType].quote}"
                    </p>
                    <p className="font-sans leading-relaxed">
                      {COACH_NUDGES[activeTask.obstacleType].tip}
                    </p>
                  </div>
                )}

                {/* 2-Minute Starter Timer Box with Zen Mode Integration */}
                <div className={`p-4 rounded border text-center space-y-3 ${
                  isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/20' : 'bg-[#FAF8F5] border-[#1C1917]/20'
                }`}>
                  <div className="flex items-center justify-between font-mono text-xs uppercase opacity-70">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> 2-MINUTEN ACTIVATIE BURST
                    </span>
                    <span>TIJD BESTEED: {Math.round((activeTask.timeSpentSeconds || 0) / 60)} min</span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full transition-all duration-300"
                      style={{ width: `${timerProgress}%` }}
                    />
                  </div>

                  <div className="font-mono font-black text-4xl tracking-widest my-2">
                    {formatTimer(timerSeconds)}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => toggleTimer(true)}
                      className={`py-2.5 px-5 rounded font-mono font-bold text-xs uppercase flex items-center gap-2 transition-all shadow-sm ${
                        isTimerRunning
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : accentBgClass
                      }`}
                    >
                      {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      <span>{isTimerRunning ? 'PAUZE' : 'START 2 MIN SPRINT'}</span>
                    </button>
                    
                    <button
                      onClick={() => setIsZenMode(true)}
                      className={`p-2.5 rounded border transition-colors ${
                        isDarkMode ? 'border-[#F3EFEA]/20 hover:bg-[#26221F]' : 'border-[#1C1917]/20 hover:bg-stone-200'
                      }`}
                      title="Open Volledig Zen Scherm"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => resetTimer(120)}
                      className={`p-2.5 rounded border transition-colors ${
                        isDarkMode ? 'border-[#F3EFEA]/20 hover:bg-[#26221F]' : 'border-[#1C1917]/20 hover:bg-stone-200'
                      }`}
                      title="Reset Timer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Micro-Step Execution Checklist */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between font-mono text-xs uppercase border-b border-[#1C1917]/10 dark:border-[#F3EFEA]/10 pb-2">
                    <span className="font-bold flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" /> MICRO-STAPPEN (MOMENTUM BUILDER)
                    </span>
                    <span className="opacity-70">
                      {activeTask.microSteps ? activeTask.microSteps.filter(s => s.completed).length : 0} / {activeTask.microSteps ? activeTask.microSteps.length : 0}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {activeTask.microSteps && activeTask.microSteps.map((step) => (
                      <div
                        key={step.id}
                        onClick={() => toggleMicroStep(activeTask.id, step.id)}
                        className={`p-2.5 rounded border text-xs font-sans flex items-center gap-3 cursor-pointer transition-colors ${
                          step.completed
                            ? 'line-through opacity-60 bg-emerald-500/5 border-emerald-500/20'
                            : (isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/15 hover:border-[#E05626]' : 'bg-[#FAF8F5] border-[#1C1917]/15 hover:border-[#C2410C]')
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          step.completed ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[#1C1917]/40 dark:border-[#F3EFEA]/40'
                        }`}>
                          {step.completed && <Check className="w-3 h-3" />}
                        </div>
                        <span className="flex-1">{step.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Add New Micro Step Input */}
                  <form onSubmit={handleAddMicroStep} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Voeg nog een kleine micro-stap toe..."
                      value={newStepText}
                      onChange={(e) => setNewStepText(e.target.value)}
                      className={`flex-1 p-2 rounded border text-xs font-sans ${
                        isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/20' : 'bg-[#FAF8F5] border-[#1C1917]/20'
                      }`}
                    />
                    <button
                      type="submit"
                      className={`px-3 py-2 rounded font-mono font-bold text-xs ${accentBgClass}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>

                {/* Footer Controls for Edit & Delete */}
                <div className="flex items-center justify-between pt-4 border-t border-[#1C1917]/10 dark:border-[#F3EFEA]/10 text-xs font-mono">
                  <button
                    onClick={() => handleEditClick(activeTask)}
                    className="flex items-center gap-1 hover:underline opacity-80 hover:opacity-100"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> BEWERKEN
                  </button>
                  <button
                    onClick={(e) => handleDeleteTask(activeTask.id, e)}
                    className="flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline opacity-80 hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> VERWIJDEREN
                  </button>
                </div>

              </div>
            ) : (
              <div className={`p-12 rounded border text-center ${cardBgClass} space-y-4`}>
                <Layers className="w-12 h-12 mx-auto opacity-30" />
                <h3 className="font-serif text-xl font-bold">Geen taak geselecteerd</h3>
                <p className="text-xs font-serif italic text-opacity-70 opacity-70 max-w-xs mx-auto">
                  Kies een taak uit het canvas aan de rechterkant of voer een nieuwe taak in via de intake wizard.
                </p>
              </div>
            )}

          </div>

          {/* ========================================================================= */}
          {/* COL 3 (4 COLS): MOMENTUM TIMELINE, FILTERS & SAVED LIBRARY                 */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 space-y-6">
            
            <div className={`p-5 rounded border ${cardBgClass} space-y-4`}>
              
              <div className="flex items-center justify-between border-b border-[#1C1917]/10 dark:border-[#F3EFEA]/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${accentBgClass}`}>
                    03
                  </span>
                  <h3 className="font-serif uppercase font-bold text-base tracking-wide">
                    MOMENTUM CANVAS
                  </h3>
                </div>
                <span className="font-mono text-xs opacity-60">
                  {filteredTasks.length} ITEMS
                </span>
              </div>

              {/* Filtering Parameters Toolbar */}
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-2.5 py-1 rounded border text-[11px] whitespace-nowrap ${
                      filterMode === 'all'
                        ? (isDarkMode ? 'bg-[#F3EFEA] text-[#12100E] font-bold' : 'bg-[#1C1917] text-white font-bold')
                        : (isDarkMode ? 'border-[#F3EFEA]/20' : 'border-[#1C1917]/20')
                    }`}
                  >
                    ALLE TAKEN
                  </button>
                  <button
                    onClick={() => setFilterMode('frogs')}
                    className={`px-2.5 py-1 rounded border text-[11px] whitespace-nowrap flex items-center gap-1 ${
                      filterMode === 'frogs'
                        ? 'bg-amber-600 text-white font-bold'
                        : (isDarkMode ? 'border-[#F3EFEA]/20 text-amber-400' : 'border-[#1C1917]/20 text-amber-700')
                    }`}
                  >
                    <Flame className="w-3 h-3" /> KIKKERS (4+)
                  </button>
                  <button
                    onClick={() => setFilterMode('quick')}
                    className={`px-2.5 py-1 rounded border text-[11px] whitespace-nowrap ${
                      filterMode === 'quick'
                        ? 'bg-emerald-600 text-white font-bold'
                        : (isDarkMode ? 'border-[#F3EFEA]/20' : 'border-[#1C1917]/20')
                    }`}
                  >
                    SNELLE TAKEN
                  </button>
                  <button
                    onClick={() => setFilterMode('done')}
                    className={`px-2.5 py-1 rounded border text-[11px] whitespace-nowrap ${
                      filterMode === 'done'
                        ? 'bg-blue-600 text-white font-bold'
                        : (isDarkMode ? 'border-[#F3EFEA]/20' : 'border-[#1C1917]/20')
                    }`}
                  >
                    ZEGE-LOG
                  </button>
                </div>

                {/* Category selector */}
                <div className="flex items-center gap-2 pt-1">
                  <Filter className="w-3.5 h-3.5 opacity-60" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className={`w-full p-1.5 rounded border text-[11px] ${
                      isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/20' : 'bg-[#FAF8F5] border-[#1C1917]/20'
                    }`}
                  >
                    <option value="all">Alle Categorieën</option>
                    <option value="Werk">Werk & Carrière</option>
                    <option value="Administratie">Administratie & Financiën</option>
                    <option value="Gezondheid">Gezondheid & Huishouden</option>
                    <option value="Creatief">Creatief & Studie</option>
                    <option value="Persoonlijk">Persoonlijk</option>
                  </select>
                </div>
              </div>

              {/* Task List Canvas Items */}
              <div className="space-y-3 pt-2 max-h-[580px] overflow-y-auto pr-1">
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => {
                    const isSelected = activeTask && activeTask.id === task.id;
                    const isDone = task.status === 'done';

                    return (
                      <div
                        key={task.id}
                        onClick={() => {
                          setActiveTaskId(task.id);
                          if (autoPlay) audioEngine.play('click');
                        }}
                        className={`p-3.5 rounded border transition-all cursor-pointer relative ${
                          isSelected
                            ? (isDarkMode ? 'border-[#E05626] bg-[#26221F] shadow-md ring-1 ring-[#E05626]' : 'border-[#C2410C] bg-stone-50 shadow-md ring-1 ring-[#C2410C]')
                            : (isDarkMode ? 'border-[#F3EFEA]/15 hover:border-[#F3EFEA]/40' : 'border-[#1C1917]/15 hover:border-[#1C1917]/40')
                        } ${isDone ? 'opacity-65' : ''}`}
                      >
                        {/* Header Row: Category badge & dread rating */}
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="uppercase opacity-70 font-semibold">{task.category}</span>
                            {task.isQuickEntry && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                ⚡ SNEL
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {task.dreadLevel >= 4 && (
                              <span className="text-amber-500 font-bold flex items-center gap-0.5">
                                <Flame className="w-3 h-3" /> {task.dreadLevel}/5
                              </span>
                            )}
                            <span className="opacity-50">
                              {new Date(task.createdAt).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        {/* Task Title */}
                        <h4 className={`font-serif font-bold text-sm leading-snug mb-1 ${isDone ? 'line-through' : ''}`}>
                          {task.title}
                        </h4>

                        {/* Micro Step Preview */}
                        <p className="text-xs font-sans text-opacity-80 opacity-80 line-clamp-1 mb-2">
                          <span className="font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">MICRO: </span>
                          {task.microStep}
                        </p>

                        {/* Footer Status Indicators */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#1C1917]/5 dark:border-[#F3EFEA]/5 text-[10px] font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[180px]">
                            🎯 {task.outcome}
                          </span>
                          <button
                            onClick={(e) => toggleTaskCompletion(task.id, e)}
                            className={`p-1 rounded border ${
                              isDone
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : (isDarkMode ? 'border-[#F3EFEA]/20 hover:bg-[#12100E]' : 'border-[#1C1917]/20 hover:bg-white')
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs font-serif italic text-opacity-60 opacity-60">
                    Geen taken gevonden voor deze filter.
                  </div>
                )}
              </div>

            </div>

            {/* Victory / Stats Summary Card */}
            <div className={`p-4 rounded border ${cardBgClass} text-xs space-y-3`}>
              <div className="flex items-center gap-2 font-mono font-bold uppercase text-[11px] border-b border-[#1C1917]/10 dark:border-[#F3EFEA]/10 pb-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>MOMENTUM STATISTIEKEN</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center font-mono">
                <div className={`p-2.5 rounded border ${isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/10' : 'bg-[#FAF8F5] border-[#1C1917]/10'}`}>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.completedMicroSteps}
                  </div>
                  <div className="text-[10px] opacity-70">MICRO-STAPPEN AF</div>
                </div>
                <div className={`p-2.5 rounded border ${isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/10' : 'bg-[#FAF8F5] border-[#1C1917]/10'}`}>
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {stats.frogCount}
                  </div>
                  <div className="text-[10px] opacity-70">RESTERENDE KIKKERS</div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* ========================================================================= */}
      {/* SUPABASE CLOUD SYNC CONFIGURATION MODAL                                   */}
      {/* ========================================================================= */}
      {showCloudModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 rounded border shadow-2xl ${cardBgClass} space-y-5`}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1C1917]/10 dark:border-[#F3EFEA]/10 pb-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-500" />
                <h3 className="font-serif font-bold text-lg">Supabase Realtime Cloud Synchronisatie</h3>
              </div>
              <button onClick={() => setShowCloudModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status overview */}
            <div className={`p-3.5 rounded border flex items-center justify-between text-xs font-mono ${
              isCloudConnected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`}></span>
                <span>STATUS: {isCloudConnected ? 'VERBONDEN MET SUPABASE (REAL-TIME LIVE)' : 'NIET VERBONDEN (LOKALE OPSLAG)'}</span>
              </div>
              {isCloudConnected && (
                <button
                  onClick={handleDisconnectCloud}
                  className="text-rose-600 dark:text-rose-400 underline hover:opacity-80 text-[11px]"
                >
                  Ontkoppelen
                </button>
              )}
            </div>

            {/* Credentials Form */}
            <div className="space-y-3 text-xs font-sans">
              <h4 className="font-mono font-bold uppercase text-[11px] flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Database className="w-4 h-4" /> 1. Vul je Supabase projectgegevens in
              </h4>
              <p className="text-opacity-80 opacity-80 text-[11px] leading-relaxed">
                Maak een gratis project aan op <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline font-bold text-[#E05626] dark:text-[#E05626]">supabase.com</a> en kopieer de Project URL en Public Anon Key uit <em>Settings &gt; API</em>.
              </p>

              <div>
                <label className="block font-mono font-bold uppercase text-[10px] mb-1">
                  Supabase Project URL:
                </label>
                <input
                  type="text"
                  placeholder="https://xyzabcdefg.supabase.co"
                  value={cloudUrlInput}
                  onChange={(e) => setCloudUrlInput(e.target.value)}
                  className={`w-full p-2.5 rounded border text-xs font-mono focus:outline-none ${
                    isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/20 focus:border-[#E05626]' : 'bg-[#FAF8F5] border-[#1C1917]/20 focus:border-[#C2410C]'
                  }`}
                />
              </div>

              <div>
                <label className="block font-mono font-bold uppercase text-[10px] mb-1">
                  Supabase Public Anon Key:
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={cloudKeyInput}
                  onChange={(e) => setCloudKeyInput(e.target.value)}
                  className={`w-full p-2.5 rounded border text-xs font-mono focus:outline-none ${
                    isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/20 focus:border-[#E05626]' : 'bg-[#FAF8F5] border-[#1C1917]/20 focus:border-[#C2410C]'
                  }`}
                />
              </div>

              {cloudMessage && (
                <div className={`p-3 rounded border font-mono text-xs ${
                  cloudMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}>
                  {cloudMessage.text}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
                <button
                  type="button"
                  disabled={cloudTesting}
                  onClick={handleTestCloudConnection}
                  className={`py-2 px-3 rounded border font-bold ${
                    isDarkMode ? 'border-[#F3EFEA]/20 hover:bg-[#26221F]' : 'border-[#1C1917]/20 hover:bg-stone-100'
                  }`}
                >
                  {cloudTesting ? 'Testen...' : 'Test Verbinding'}
                </button>
                <button
                  type="button"
                  disabled={cloudTesting}
                  onClick={handleSaveCloudConnection}
                  className={`py-2 px-4 rounded font-bold ${accentBgClass}`}
                >
                  {isCloudConnected ? 'Instellingen Bijwerken' : 'Opslaan & Verbinden'}
                </button>
                {isCloudConnected && (
                  <>
                    <button
                      type="button"
                      disabled={cloudTesting}
                      onClick={handleBulkUploadToCloud}
                      className="py-2 px-3 rounded border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-bold hover:bg-emerald-500/10"
                      title="Upload alle huidige taken in deze browser naar Supabase"
                    >
                      Upload Lokale Taken → Cloud
                    </button>
                    <button
                      type="button"
                      disabled={cloudTesting}
                      onClick={handleFetchFromCloud}
                      className="py-2 px-3 rounded border border-blue-500/40 text-blue-700 dark:text-blue-400 font-bold hover:bg-blue-500/10"
                      title="Haal taken op van Supabase"
                    >
                      Haal Cloud Taken Op
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* SQL Table Creation Guide */}
            <div className="space-y-2 text-xs font-sans pt-3 border-t border-[#1C1917]/10 dark:border-[#F3EFEA]/10">
              <div className="flex items-center justify-between">
                <h4 className="font-mono font-bold uppercase text-[11px] flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Database className="w-4 h-4" /> 2. SQL Setup Script (1x uitvoeren in Supabase)
                </h4>
                <button
                  onClick={copySqlToClipboard}
                  className="font-mono text-[10px] uppercase underline flex items-center gap-1 hover:opacity-80"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedSql ? 'Gekopieerd! ✓' : 'Kopieer SQL'}</span>
                </button>
              </div>

              <p className="text-opacity-80 opacity-80 text-[11px]">
                Plak dit script in de <strong>SQL Editor</strong> van je Supabase dashboard en klik op <em>Run</em>:
              </p>

              <pre className={`p-3 rounded border text-[10px] font-mono overflow-x-auto max-h-36 ${
                isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/15 text-stone-300' : 'bg-stone-50 border-[#1C1917]/15 text-stone-700'
              }`}>
                {SUPABASE_SETUP_SQL}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowCloudModal(false)}
                className={`px-4 py-2 rounded font-mono text-xs border ${
                  isDarkMode ? 'border-[#F3EFEA]/30' : 'border-[#1C1917]/30'
                }`}
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DUAL-OPTION SAVE MODAL                                                    */}
      {/* ========================================================================= */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-md w-full p-6 rounded border shadow-xl ${cardBgClass} space-y-4`}>
            <div className="flex items-center justify-between border-b border-[#1C1917]/10 dark:border-[#F3EFEA]/10 pb-3">
              <h3 className="font-serif font-bold text-lg">Opslaan als Nieuw of Bijwerken?</h3>
              <button onClick={() => setShowSaveModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs font-sans leading-relaxed text-opacity-80 opacity-80">
              Je bent een bestaande taak aan het bewerken. Wil je de huidige taak overschrijven of deze inzending opslaan als een nieuwe momentum-taak?
            </p>
            <div className="flex flex-col gap-2.5 pt-2 font-mono text-xs">
              <button
                onClick={updateExistingTask}
                className={`w-full py-2.5 px-4 rounded font-bold border transition-all ${
                  isDarkMode ? 'border-[#F3EFEA]/30 hover:bg-[#26221F]' : 'border-[#1C1917]/30 hover:bg-stone-100'
                }`}
              >
                1. BESTAANDE TAAK BIJWERKEN
              </button>
              <button
                onClick={createNewTask}
                className={`w-full py-2.5 px-4 rounded font-bold ${accentBgClass}`}
              >
                2. OPSLAAN ALS NIEUWE TAAK
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-center font-mono text-[11px] underline opacity-60 hover:opacity-100 pt-1"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BACKUP & RESTORE JSON MODAL                                              */}
      {/* ========================================================================= */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-lg w-full p-6 rounded border shadow-xl ${cardBgClass} space-y-5`}>
            <div className="flex items-center justify-between border-b border-[#1C1917]/10 dark:border-[#F3EFEA]/10 pb-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-amber-500" />
                <h3 className="font-serif font-bold text-lg">JSON Backup &amp; Herstel Engine</h3>
              </div>
              <button onClick={() => setShowBackupModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              
              {/* Export Option */}
              <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/15' : 'bg-[#FAF8F5] border-[#1C1917]/15'}`}>
                <h4 className="font-mono font-bold uppercase text-xs mb-1 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-500" /> 1. Exporteer Canvas Backup (JSON)
                </h4>
                <p className="text-opacity-80 opacity-80 mb-3">
                  Download een gestructureerd JSON-bestand met al je taken, WOOP-vragen, micro-stappen en instellingen.
                </p>
                <button
                  onClick={handleExportJSON}
                  className={`w-full py-2 px-3 rounded font-mono font-bold text-xs uppercase ${accentBgClass}`}
                >
                  EXPORTEER JSON BESTAND
                </button>
              </div>

              {/* Import Option */}
              <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#12100E] border-[#F3EFEA]/15' : 'bg-[#FAF8F5] border-[#1C1917]/15'}`}>
                <h4 className="font-mono font-bold uppercase text-xs mb-1 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-amber-500" /> 2. Importeer Canvas Backup (JSON)
                </h4>
                <p className="text-opacity-80 opacity-80 mb-3">
                  Upload een eerder geëxporteerd `.json` bestand om je taken en instellingen te herstellen.
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="block w-full text-xs font-mono file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-mono file:font-bold file:bg-[#1C1917] file:text-white dark:file:bg-[#F3EFEA] dark:file:text-[#12100E] hover:file:opacity-80 cursor-pointer"
                />
              </div>

            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowBackupModal(false)}
                className={`px-4 py-2 rounded font-mono text-xs border ${
                  isDarkMode ? 'border-[#F3EFEA]/30' : 'border-[#1C1917]/30'
                }`}
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOAST NOTIFICATION POPUP                                                  */}
      {/* ========================================================================= */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="bg-[#1C1917] text-white px-4 py-3 rounded shadow-2xl border border-white/20 text-xs font-mono flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}