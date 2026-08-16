import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export interface Task {
  id: string;
  title: string;
  outcome: string;
  obstacle: string;
  obstacleType: string;
  microStep: string;
  microSteps: { id: string; text: string; completed: boolean }[];
  dreadLevel: number;
  impactLevel: number;
  category: string;
  status: 'todo' | 'in_progress' | 'done';
  createdAt: string;
  completedAt: string | null;
  timeSpentSeconds: number;
  isQuickEntry?: boolean;
  learningGoal?: string;
}

export interface TaskRow {
  id: string;
  title: string;
  outcome: string | null;
  obstacle: string | null;
  obstacle_type: string | null;
  micro_step: string | null;
  micro_steps: { id: string; text: string; completed: boolean }[] | null;
  dread_level: number | null;
  impact_level: number | null;
  category: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  time_spent_seconds: number | null;
  is_quick_entry: boolean | null;
  learning_goal?: string | null;
  updated_at?: string | null;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function taskToRow(task: Task): TaskRow {
  return {
    id: task.id,
    title: task.title,
    outcome: task.outcome,
    obstacle: task.obstacle,
    obstacle_type: task.obstacleType,
    micro_step: task.microStep,
    micro_steps: task.microSteps || [],
    dread_level: task.dreadLevel,
    impact_level: task.impactLevel,
    category: task.category,
    status: task.status,
    created_at: task.createdAt,
    completed_at: task.completedAt,
    time_spent_seconds: task.timeSpentSeconds || 0,
    is_quick_entry: Boolean(task.isQuickEntry),
    learning_goal: task.learningGoal || '',
    updated_at: new Date().toISOString()
  };
}

export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title || 'Naamloze taak',
    outcome: row.outcome || '',
    obstacle: row.obstacle || '',
    obstacleType: row.obstacle_type || 'overwhelm',
    microStep: row.micro_step || '',
    microSteps: Array.isArray(row.micro_steps) ? row.micro_steps : [],
    dreadLevel: row.dread_level ?? 3,
    impactLevel: row.impact_level ?? 4,
    category: row.category || 'Werk',
    status: (row.status as 'todo' | 'in_progress' | 'done') || 'todo',
    createdAt: row.created_at || new Date().toISOString(),
    completedAt: row.completed_at || null,
    timeSpentSeconds: row.time_spent_seconds ?? 0,
    isQuickEntry: Boolean(row.is_quick_entry),
    learningGoal: row.learning_goal || ''
  };
}

let cachedClient: SupabaseClient | null = null;
let currentConfigKey = '';

export function getSupabaseConfig(): SupabaseConfig | null {
  try {
    const saved = localStorage.getItem('editorial_supabase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.url && parsed?.anonKey) {
        return {
          url: parsed.url.trim(),
          anonKey: parsed.anonKey.trim()
        };
      }
    }
  } catch (e) {
    console.error('Error loading Supabase config:', e);
  }
  return null;
}

export function saveSupabaseConfig(config: SupabaseConfig | null) {
  if (!config) {
    localStorage.removeItem('editorial_supabase_config');
    cachedClient = null;
    currentConfigKey = '';
    return;
  }
  localStorage.setItem('editorial_supabase_config', JSON.stringify(config));
  cachedClient = null;
  currentConfigKey = '';
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config?.url || !config?.anonKey) return null;

  const key = `${config.url}_${config.anonKey}`;
  if (cachedClient && currentConfigKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false
      }
    });
    currentConfigKey = key;
    return cachedClient;
  } catch (e) {
    console.error('Failed to create Supabase client:', e);
    return null;
  }
}

export async function testSupabaseConnection(config: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  try {
    const client = createClient(config.url.trim(), config.anonKey.trim(), {
      auth: { persistSession: false }
    });
    const { data, error } = await client.from('tasks').select('id').limit(1);
    if (error) {
      return { success: false, message: `Database fout: ${error.message}` };
    }
    return { success: true, message: `Succesvol verbonden! (${data?.length ?? 0} taken gevonden)` };
  } catch (err: any) {
    return { success: false, message: `Verbindingsfout: ${err?.message || 'Onbekende fout'}` };
  }
}

export async function fetchRemoteTasks(): Promise<Task[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch tasks from Supabase:', error);
      return null;
    }

    return (data || []).map(rowToTask);
  } catch (err) {
    console.error('Error fetching tasks from Supabase:', err);
    return null;
  }
}

export async function upsertRemoteTask(task: Task): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const row = taskToRow(task);
    const { error } = await client.from('tasks').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error('Failed to upsert task to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error upserting task:', err);
    return false;
  }
}

export async function deleteRemoteTask(taskId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('tasks').delete().eq('id', taskId);
    if (error) {
      console.error('Failed to delete task from Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleting task:', err);
    return false;
  }
}

export async function bulkUploadTasks(tasks: Task[]): Promise<{ success: boolean; count: number }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, count: 0 };

  try {
    const rows = tasks.map(taskToRow);
    const { error } = await client.from('tasks').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.error('Failed bulk upload:', error);
      return { success: false, count: 0 };
    }
    return { success: true, count: rows.length };
  } catch (err) {
    console.error('Error in bulk upload:', err);
    return { success: false, count: 0 };
  }
}

export function subscribeToRemoteTasks(
  onInsert: (task: Task) => void,
  onUpdate: (task: Task) => void,
  onDelete: (taskId: string) => void
): RealtimeChannel | null {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const channel = client
      .channel('momentum-tasks-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.new) onInsert(rowToTask(payload.new as TaskRow));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.new) onUpdate(rowToTask(payload.new as TaskRow));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.old && payload.old.id) onDelete(payload.old.id);
        }
      )
      .subscribe();

    return channel;
  } catch (err) {
    console.error('Failed to subscribe to realtime channel:', err);
    return null;
  }
}
