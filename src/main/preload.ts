import { contextBridge, ipcRenderer } from 'electron';
import { Certificate, Project, RenewalTask, PasswordEntry, AppSettings } from '../shared/types';

const electronAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    openPasswordVault: () => ipcRenderer.invoke('window:open-password-vault'),
    closePasswordVault: () => ipcRenderer.invoke('window:close-password-vault')
  },
  certificates: {
    parse: (filePath: string, password?: string): Promise<Certificate> =>
      ipcRenderer.invoke('certificates:parse', filePath, password),
    parseBatch: (filePaths: string[]): Promise<Certificate[]> =>
      ipcRenderer.invoke('certificates:parse-batch', filePaths),
    scanDirectory: (dirPath: string): Promise<string[]> =>
      ipcRenderer.invoke('certificates:scan-directory', dirPath),
    save: (cert: Certificate): Promise<void> =>
      ipcRenderer.invoke('certificates:save', cert),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('certificates:delete', id),
    getAll: (): Promise<Certificate[]> =>
      ipcRenderer.invoke('certificates:get-all')
  },
  projects: {
    getAll: (): Promise<Project[]> =>
      ipcRenderer.invoke('projects:get-all'),
    save: (project: Project): Promise<void> =>
      ipcRenderer.invoke('projects:save', project),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('projects:delete', id)
  },
  tasks: {
    getAll: (): Promise<RenewalTask[]> =>
      ipcRenderer.invoke('tasks:get-all'),
    save: (task: RenewalTask): Promise<void> =>
      ipcRenderer.invoke('tasks:save', task),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('tasks:delete', id)
  },
  passwords: {
    getAll: (): Promise<PasswordEntry[]> =>
      ipcRenderer.invoke('passwords:get-all'),
    save: (entry: PasswordEntry): Promise<void> =>
      ipcRenderer.invoke('passwords:save', entry),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('passwords:delete', id),
    verifyMaster: (password: string): Promise<boolean> =>
      ipcRenderer.invoke('passwords:verify-master', password),
    setMaster: (password: string): Promise<void> =>
      ipcRenderer.invoke('passwords:set-master', password),
    isSet: (): Promise<boolean> =>
      ipcRenderer.invoke('passwords:is-set')
  },
  dialog: {
    openFile: (): Promise<string[]> =>
      ipcRenderer.invoke('dialog:open-file'),
    openDirectory: (): Promise<string> =>
      ipcRenderer.invoke('dialog:open-directory'),
    saveFile: (defaultPath: string): Promise<string> =>
      ipcRenderer.invoke('dialog:save-file', defaultPath)
  },
  settings: {
    get: (): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:get'),
    save: (settings: AppSettings): Promise<void> =>
      ipcRenderer.invoke('settings:save', settings)
  },
  report: {
    generate: (format: 'json' | 'csv' | 'html'): Promise<string> =>
      ipcRenderer.invoke('report:generate', format),
    save: (content: string, filePath: string): Promise<void> =>
      ipcRenderer.invoke('report:save', content, filePath)
  },
  shell: {
    openPath: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('shell:open-path', filePath)
  },
  check: {
    keyMatch: (certPath: string, keyPath: string): Promise<boolean> =>
      ipcRenderer.invoke('check:key-match', certPath, keyPath),
    duplicates: (): Promise<any[]> =>
      ipcRenderer.invoke('check:duplicates')
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
