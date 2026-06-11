export interface Certificate {
  id: string;
  name: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  fingerprint: {
    sha1: string;
    sha256: string;
  };
  keyUsage: string[];
  extendedKeyUsage: string[];
  publicKeyAlgorithm: string;
  signatureAlgorithm: string;
  filePath: string;
  fileFormat: string;
  projectId: string;
  notes: string;
  responsiblePerson: string;
  importDate: Date;
  sourceType: 'local' | 'shared';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdDate: Date;
  color: string;
}

export interface RenewalTask {
  id: string;
  certificateId: string;
  taskName: string;
  assignee: string;
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed';
  notes: string;
  createdDate: Date;
  completedDate?: Date;
}

export interface PasswordEntry {
  id: string;
  name: string;
  password: string;
  relatedCertificateId?: string;
  notes: string;
  createdDate: Date;
  modifiedDate: Date;
}

export interface CheckResult {
  type: 'key_match' | 'expired' | 'duplicate' | 'chain_trust';
  severity: 'error' | 'warning' | 'info';
  certificateId: string;
  certificateName: string;
  message: string;
  details: string;
  suggestion: string;
}

export interface InventoryReport {
  generatedDate: Date;
  totalCertificates: number;
  validCertificates: number;
  expiringCertificates: number;
  expiredCertificates: number;
  certificates: Certificate[];
  checkResults: CheckResult[];
}

export interface AppSettings {
  masterPassword?: string;
  autoLockMinutes: number;
  clipboardClearSeconds: number;
  defaultReminderDays: number;
  sharedPaths: string[];
}

export type PageType = 'certificates' | 'reminders' | 'tools' | 'passwords';

export interface IpcChannels {
  'certificates:parse': (filePath: string, password?: string) => Promise<Certificate>;
  'certificates:parse-batch': (filePaths: string[]) => Promise<Certificate[]>;
  'certificates:scan-directory': (dirPath: string) => Promise<string[]>;
  'certificates:save': (cert: Certificate) => Promise<void>;
  'certificates:delete': (id: string) => Promise<void>;
  'certificates:get-all': () => Promise<Certificate[]>;
  'projects:get-all': () => Promise<Project[]>;
  'projects:save': (project: Project) => Promise<void>;
  'projects:delete': (id: string) => Promise<void>;
  'tasks:get-all': () => Promise<RenewalTask[]>;
  'tasks:save': (task: RenewalTask) => Promise<void>;
  'tasks:delete': (id: string) => Promise<void>;
  'passwords:get-all': () => Promise<PasswordEntry[]>;
  'passwords:save': (entry: PasswordEntry) => Promise<void>;
  'passwords:delete': (id: string) => Promise<void>;
  'passwords:verify-master': (password: string) => Promise<boolean>;
  'passwords:set-master': (password: string) => Promise<void>;
  'dialog:open-file': () => Promise<string[]>;
  'dialog:open-directory': () => Promise<string>;
  'dialog:save-file': (defaultPath: string) => Promise<string>;
  'settings:get': () => Promise<AppSettings>;
  'settings:save': (settings: AppSettings) => Promise<void>;
  'report:generate': (format: 'json' | 'csv' | 'html') => Promise<string>;
}
