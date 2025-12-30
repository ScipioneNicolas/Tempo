
import { Activity, ProjectConfig, AppState, DevOpsStatus, TaskType } from './types';

const DB_NAME = 'TempoDB';
const DB_VERSION = 1;

export class TempoDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('activities')) {
          db.createObjectStore('activities', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event: any) => reject(event.target.error);
    });
  }

  private getStore(name: string, mode: IDBTransactionMode = 'readonly') {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(name, mode);
    return transaction.objectStore(name);
  }

  // Activities CRUD
  async getActivities(): Promise<Activity[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('activities');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveActivity(activity: Activity): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('activities', 'readwrite');
      const request = store.put(activity);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteActivity(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('activities', 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Projects CRUD
  async getProjects(): Promise<ProjectConfig[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('projects');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveProject(project: ProjectConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('projects', 'readwrite');
      const request = store.put(project);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Settings
  async getSetting<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('settings');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async setSetting(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('settings', 'readwrite');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Export/Import
  async exportData(): Promise<string> {
    const activities = await this.getActivities();
    const projects = await this.getProjects();
    const lastUsedProject = await this.getSetting<string>('lastUsedProject');
    const lastUsedType = await this.getSetting<TaskType>('lastUsedType');

    const data: AppState = {
      activities,
      projects,
      lastUsedProject,
      lastUsedType
    };
    return JSON.stringify(data, null, 2);
  }

  async importData(json: string, merge: boolean = true): Promise<void> {
    const data: AppState = JSON.parse(json);
    
    if (!merge) {
      // Clear existing
      await this.clearAll();
    }

    for (const a of data.activities || []) {
      await this.saveActivity(a);
    }
    for (const p of data.projects || []) {
      await this.saveProject(p);
    }
    if (data.lastUsedProject) await this.setSetting('lastUsedProject', data.lastUsedProject);
    if (data.lastUsedType) await this.setSetting('lastUsedType', data.lastUsedType);
  }

  private async clearAll(): Promise<void> {
    const stores = ['activities', 'projects', 'settings'];
    for (const name of stores) {
      await new Promise<void>((resolve, reject) => {
        const store = this.getStore(name, 'readwrite');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

export const db = new TempoDB();
