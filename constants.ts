
import { ProjectConfig, TaskType } from './types';

export const DEFAULT_PROJECTS: ProjectConfig[] = [];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  [TaskType.TASK]: 'Tarea',
  [TaskType.MEETING]: 'Reunión',
  [TaskType.TRAINING]: 'Capacitación',
};

export const STORAGE_KEY = 'tempo_app_data';

export const PALETTE = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
];
