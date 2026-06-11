import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import { CertificateParser } from './certificate-parser';
import { FileManager } from './file-manager';
import { PasswordVault } from './password-vault';
import { DataStore } from './data-store';
import { ReportGenerator } from './report-generator';
import { Certificate, Project, RenewalTask, PasswordEntry, AppSettings } from '../shared/types';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let passwordVaultWindow: BrowserWindow | null = null;

const certificateParser = new CertificateParser();
const fileManager = new FileManager();
const passwordVault = new PasswordVault();
const dataStore = new DataStore();
const reportGenerator = new ReportGenerator();

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#f0f2f5',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createPasswordVaultWindow(): void {
  if (passwordVaultWindow) {
    passwordVaultWindow.focus();
    return;
  }

  passwordVaultWindow = new BrowserWindow({
    width: 500,
    height: 450,
    parent: mainWindow || undefined,
    modal: true,
    frame: false,
    backgroundColor: '#f0f2f5',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  passwordVaultWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'renderer', 'password-vault.html'));

  passwordVaultWindow.on('closed', () => {
    passwordVaultWindow = null;
  });
}

function setupIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
  });

  ipcMain.handle('window:open-password-vault', () => {
    createPasswordVaultWindow();
  });

  ipcMain.handle('window:close-password-vault', () => {
    if (passwordVaultWindow) {
      passwordVaultWindow.close();
    }
  });

  ipcMain.handle('certificates:parse', async (_, filePath: string, password?: string) => {
    try {
      return await certificateParser.parseCertificate(filePath, password);
    } catch (error) {
      console.error('Error parsing certificate:', error);
      throw error;
    }
  });

  ipcMain.handle('certificates:parse-batch', async (_, filePaths: string[]) => {
    try {
      const results: Certificate[] = [];
      for (const filePath of filePaths) {
        try {
          const cert = await certificateParser.parseCertificate(filePath);
          results.push(cert);
        } catch (error) {
          console.error(`Error parsing ${filePath}:`, error);
        }
      }
      return results;
    } catch (error) {
      console.error('Error in batch parse:', error);
      throw error;
    }
  });

  ipcMain.handle('certificates:scan-directory', async (_, dirPath: string) => {
    try {
      return await fileManager.scanDirectory(dirPath);
    } catch (error) {
      console.error('Error scanning directory:', error);
      throw error;
    }
  });

  ipcMain.handle('certificates:save', async (_, cert: Certificate) => {
    const certs = await dataStore.getCertificates();
    const index = certs.findIndex(c => c.id === cert.id);
    if (index >= 0) {
      certs[index] = cert;
    } else {
      certs.push(cert);
    }
    await dataStore.saveCertificates(certs);
  });

  ipcMain.handle('certificates:delete', async (_, id: string) => {
    const certs = await dataStore.getCertificates();
    const filtered = certs.filter(c => c.id !== id);
    await dataStore.saveCertificates(filtered);
  });

  ipcMain.handle('certificates:get-all', async () => {
    return await dataStore.getCertificates();
  });

  ipcMain.handle('certificates:get-chain', async (_, filePath: string) => {
    try {
      return await certificateParser.getCertificateChain(filePath);
    } catch (error) {
      console.error('Error getting certificate chain:', error);
      return [];
    }
  });

  ipcMain.handle('projects:get-all', async () => {
    return await dataStore.getProjects();
  });

  ipcMain.handle('projects:save', async (_, project: Project) => {
    const projects = await dataStore.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    await dataStore.saveProjects(projects);
  });

  ipcMain.handle('projects:delete', async (_, id: string) => {
    const projects = await dataStore.getProjects();
    const filtered = projects.filter(p => p.id !== id);
    await dataStore.saveProjects(filtered);
    const certs = await dataStore.getCertificates();
    const updatedCerts = certs.map(c => c.projectId === id ? { ...c, projectId: '' } : c);
    await dataStore.saveCertificates(updatedCerts);
  });

  ipcMain.handle('tasks:get-all', async () => {
    return await dataStore.getTasks();
  });

  ipcMain.handle('tasks:save', async (_, task: RenewalTask) => {
    const tasks = await dataStore.getTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    if (index >= 0) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }
    await dataStore.saveTasks(tasks);
  });

  ipcMain.handle('tasks:delete', async (_, id: string) => {
    const tasks = await dataStore.getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    await dataStore.saveTasks(filtered);
  });

  ipcMain.handle('passwords:get-all', async () => {
    return await passwordVault.getPasswords();
  });

  ipcMain.handle('passwords:save', async (_, entry: PasswordEntry) => {
    await passwordVault.savePassword(entry);
  });

  ipcMain.handle('passwords:delete', async (_, id: string) => {
    await passwordVault.deletePassword(id);
  });

  ipcMain.handle('passwords:get-decrypted', async (_, id: string) => {
    return await passwordVault.getDecryptedPassword(id);
  });

  ipcMain.handle('passwords:is-unlocked', async () => {
    return passwordVault.isVaultUnlocked();
  });

  ipcMain.handle('passwords:verify-master', async (_, password: string) => {
    return passwordVault.verifyMasterPassword(password);
  });

  ipcMain.handle('passwords:set-master', async (_, password: string) => {
    passwordVault.setMasterPassword(password);
  });

  ipcMain.handle('passwords:is-set', async () => {
    return passwordVault.isMasterPasswordSet();
  });

  ipcMain.handle('dialog:open-file', async (_, filters?: string) => {
    let fileFilters = [
      { name: 'Certificates', extensions: ['cer', 'crt', 'pem', 'der', 'pfx', 'p12'] },
      { name: 'All Files', extensions: ['*'] }
    ];

    if (filters === 'key') {
      fileFilters = [
        { name: 'Private Keys', extensions: ['key', 'pem', 'priv', 'pk8'] },
        { name: 'All Files', extensions: ['*'] }
      ];
    } else if (filters === 'cert') {
      fileFilters = [
        { name: 'Certificates', extensions: ['cer', 'crt', 'pem', 'der', 'pfx', 'p12'] },
        { name: 'All Files', extensions: ['*'] }
      ];
    }

    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: fileFilters
    });
    if (result.canceled) {
      return [];
    }
    return result.filePaths;
  });

  ipcMain.handle('dialog:open-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (result.canceled) {
      return '';
    }
    return result.filePaths[0] || '';
  });

  ipcMain.handle('dialog:save-file', async (_, defaultPath: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultPath,
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'CSV', extensions: ['csv'] },
        { name: 'HTML', extensions: ['html'] }
      ]
    });
    return result.filePath || '';
  });

  ipcMain.handle('settings:get', async () => {
    return await dataStore.getSettings();
  });

  ipcMain.handle('settings:save', async (_, settings: AppSettings) => {
    await dataStore.saveSettings(settings);
  });

  ipcMain.handle('report:generate', async (_, format: 'json' | 'csv' | 'html') => {
    const certs = await dataStore.getCertificates();
    const report = reportGenerator.generateReport(certs);
    return reportGenerator.exportReport(report, format);
  });

  ipcMain.handle('report:save', async (_, content: string, filePath: string) => {
    fs.writeFileSync(filePath, content, 'utf-8');
  });

  ipcMain.handle('shell:open-path', async (_, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('check:key-match', async (_, certId: string, keyPath: string) => {
    const certs = await dataStore.getCertificates();
    const cert = certs.find(c => c.id === certId);
    if (!cert) {
      throw new Error('Certificate not found');
    }
    return await certificateParser.checkKeyMatch(cert.filePath, keyPath);
  });

  ipcMain.handle('check:duplicates', async () => {
    const certs = await dataStore.getCertificates();
    return reportGenerator.checkDuplicates(certs);
  });
}

app.whenReady().then(() => {
  createMainWindow();
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
