import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { Certificate, Project, RenewalTask, PasswordEntry, AppSettings } from '../shared/types';

export class DataStore {
  private dataPath: string;
  private masterPasswordHashPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dataPath = userDataPath;
    this.masterPasswordHashPath = path.join(userDataPath, 'master.hash');

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
  }

  private getFilePath(filename: string): string {
    return path.join(this.dataPath, filename);
  }

  async getCertificates(): Promise<Certificate[]> {
    const filePath = this.getFilePath('certificates.json');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const certs = JSON.parse(data);
        return certs.map((c: any) => ({
          ...c,
          notBefore: new Date(c.notBefore),
          notAfter: new Date(c.notAfter),
          importDate: new Date(c.importDate)
        }));
      }
      return [];
    } catch (error) {
      console.error('Error reading certificates:', error);
      return [];
    }
  }

  async saveCertificates(certs: Certificate[]): Promise<void> {
    const filePath = this.getFilePath('certificates.json');
    fs.writeFileSync(filePath, JSON.stringify(certs, null, 2), 'utf-8');
  }

  async getProjects(): Promise<Project[]> {
    const filePath = this.getFilePath('projects.json');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const projects = JSON.parse(data);
        return projects.map((p: any) => ({
          ...p,
          createdDate: new Date(p.createdDate)
        }));
      }
      return [];
    } catch (error) {
      console.error('Error reading projects:', error);
      return [];
    }
  }

  async saveProjects(projects: Project[]): Promise<void> {
    const filePath = this.getFilePath('projects.json');
    fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), 'utf-8');
  }

  async getTasks(): Promise<RenewalTask[]> {
    const filePath = this.getFilePath('tasks.json');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const tasks = JSON.parse(data);
        return tasks.map((t: any) => ({
          ...t,
          dueDate: new Date(t.dueDate),
          createdDate: new Date(t.createdDate),
          completedDate: t.completedDate ? new Date(t.completedDate) : undefined
        }));
      }
      return [];
    } catch (error) {
      console.error('Error reading tasks:', error);
      return [];
    }
  }

  async saveTasks(tasks: RenewalTask[]): Promise<void> {
    const filePath = this.getFilePath('tasks.json');
    fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2), 'utf-8');
  }

  async getPasswords(): Promise<PasswordEntry[]> {
    const filePath = this.getFilePath('passwords.json');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const entries = JSON.parse(data);
        return entries.map((e: any) => ({
          ...e,
          createdDate: new Date(e.createdDate),
          modifiedDate: new Date(e.modifiedDate)
        }));
      }
      return [];
    } catch (error) {
      console.error('Error reading passwords:', error);
      return [];
    }
  }

  async savePasswords(entries: PasswordEntry[]): Promise<void> {
    const filePath = this.getFilePath('passwords.json');
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
  }

  async getSettings(): Promise<AppSettings> {
    const filePath = this.getFilePath('settings.json');
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
      }
      return {
        autoLockMinutes: 5,
        clipboardClearSeconds: 30,
        defaultReminderDays: 30,
        sharedPaths: []
      };
    } catch (error) {
      console.error('Error reading settings:', error);
      return {
        autoLockMinutes: 5,
        clipboardClearSeconds: 30,
        defaultReminderDays: 30,
        sharedPaths: []
      };
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const filePath = this.getFilePath('settings.json');
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  setMasterPasswordHash(hash: string): void {
    fs.writeFileSync(this.masterPasswordHashPath, hash, 'utf-8');
  }

  getMasterPasswordHash(): string | null {
    try {
      if (fs.existsSync(this.masterPasswordHashPath)) {
        return fs.readFileSync(this.masterPasswordHashPath, 'utf-8');
      }
      return null;
    } catch (error) {
      console.error('Error reading master password hash:', error);
      return null;
    }
  }
}
