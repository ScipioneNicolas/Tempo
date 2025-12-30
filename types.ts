
export enum TaskType {
  TASK = 'Tarea',
  MEETING = 'Reunión',
  TRAINING = 'Capacitación'
}

export enum DevOpsStatus {
  PENDING = 'Pendiente',
  LOADED = 'Cargado'
}

export interface Activity {
  id: string;
  title: string;
  description?: string;
  hours: number;
  date: string; // ISO string YYYY-MM-DD
  type: TaskType;
  project: string;
  projectColor: string;
  devOpsStatus: DevOpsStatus;
  devOpsId?: number;
}

export interface ProjectConfig {
  name: string;
  color: string;
}

export interface AppState {
  activities: Activity[];
  projects: ProjectConfig[];
  lastUsedProject?: string;
  lastUsedType?: TaskType;
}
