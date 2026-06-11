interface Certificate {
  id: string;
  name: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  fingerprint: { sha1: string; sha256: string };
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

interface Project {
  id: string;
  name: string;
  description: string;
  createdDate: Date;
  color: string;
}

interface RenewalTask {
  id: string;
  certificateId: string;
  taskName: string;
  assignee: string;
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed';
  notes: string;
  createdDate: Date;
  completedDate?: Date;
  renewedCertFile?: string;
  renewalNotes?: string;
}

interface PasswordEntry {
  id: string;
  name: string;
  password: string;
  relatedCertificateId?: string;
  notes: string;
  createdDate: Date;
  modifiedDate: Date;
  keepOriginal?: boolean;
}

interface CheckResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  certificateId: string;
  certificateName: string;
  message: string;
  details: string;
  suggestion: string;
}

interface CertificateChainItem {
  subject: string;
  issuer: string;
  serialNumber: string;
  notAfter: Date;
  isRoot: boolean;
  level: number;
}

interface KeyMatchRecord {
  id: string;
  certificateId: string;
  certificateName: string;
  certificateSerial: string;
  keyFilePath: string;
  isMatch: boolean;
  checkedAt: Date;
}

interface ElectronAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    openPasswordVault: () => Promise<void>;
    closePasswordVault: () => Promise<void>;
  };
  certificates: {
    parse: (filePath: string, password?: string) => Promise<any>;
    parseBatch: (filePaths: string[]) => Promise<any[]>;
    scanDirectory: (dirPath: string) => Promise<string[]>;
    save: (cert: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
    getAll: () => Promise<any[]>;
    getChain: (filePath: string) => Promise<any[]>;
  };
  projects: {
    getAll: () => Promise<any[]>;
    save: (project: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  tasks: {
    getAll: () => Promise<any[]>;
    save: (task: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  passwords: {
    getAll: () => Promise<any[]>;
    save: (entry: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
    getDecrypted: (id: string) => Promise<string>;
    verifyMaster: (password: string) => Promise<boolean>;
    setMaster: (password: string) => Promise<void>;
    isSet: () => Promise<boolean>;
    isUnlocked: () => Promise<boolean>;
    lock: () => Promise<void>;
    resetLockTimer: () => Promise<void>;
  };
  keymatch: {
    getHistory: () => Promise<KeyMatchRecord[]>;
    saveRecord: (record: KeyMatchRecord) => Promise<void>;
  };
  dialog: {
    openFile: (filters?: string) => Promise<string[]>;
    openDirectory: () => Promise<string>;
    saveFile: (defaultPath: string) => Promise<string>;
  };
  settings: {
    get: () => Promise<any>;
    save: (settings: any) => Promise<void>;
  };
  report: {
    generate: (format: string) => Promise<string>;
    save: (content: string, filePath: string) => Promise<void>;
  };
  shell: {
    openPath: (filePath: string) => Promise<void>;
  };
  check: {
    keyMatch: (certId: string, keyPath: string) => Promise<boolean>;
    duplicates: () => Promise<any[]>;
  };
  onVaultLocked: (callback: () => void) => void;
}

declare const electronAPI: ElectronAPI;

class CertManagerApp {
  private certificates: Certificate[] = [];
  private projects: Project[] = [];
  private tasks: RenewalTask[] = [];
  private passwords: PasswordEntry[] = [];
  private currentPage: string = 'certificates';
  private selectedCertificate: Certificate | null = null;
  private editingTask: RenewalTask | null = null;
  private editingPassword: PasswordEntry | null = null;
  private searchTerm: string = '';
  private filterStatus: string = '';
  private filterProject: string = '';
  private passwordSearchTerm: string = '';
  private passwordFilterCert: string = '';
  private keyMatchHistory: KeyMatchRecord[] = [];

  constructor() {
    this.init();
  }

  private async init() {
    try {
      await this.loadData();
      this.setupEventListeners();
      this.setupVaultLockListener();
      this.renderCurrentPage();
      this.updateStatusBar();
      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  }

  private setupVaultLockListener() {
    electronAPI.onVaultLocked(() => {
      if (this.currentPage === 'passwords') {
        this.renderPasswords();
      }
    });
  }

  private async loadData() {
    try {
      this.certificates = await electronAPI.certificates.getAll();
      this.projects = await electronAPI.projects.getAll();
      this.tasks = await electronAPI.tasks.getAll();
      this.passwords = await electronAPI.passwords.getAll();
      console.log('Data loaded:', {
        certificates: this.certificates.length,
        projects: this.projects.length,
        tasks: this.tasks.length,
        passwords: this.passwords.length
      });
    } catch (error) {
      console.error('Failed to load data:', error);
      throw error;
    }
  }

  private setupEventListeners() {
    const btnMinimize = document.getElementById('btnMinimize');
    const btnMaximize = document.getElementById('btnMaximize');
    const btnClose = document.getElementById('btnClose');

    if (btnMinimize) btnMinimize.addEventListener('click', () => electronAPI.window.minimize());
    if (btnMaximize) btnMaximize.addEventListener('click', () => electronAPI.window.maximize());
    if (btnClose) btnClose.addEventListener('click', () => electronAPI.window.close());

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const page = target.dataset.page;
        if (page) {
          this.navigateTo(page);
        }
      });
    });

    const btnImport = document.getElementById('btnImport');
    const btnScanDir = document.getElementById('btnScanDir');
    const btnSelectFiles = document.getElementById('btnSelectFiles');
    const btnCloseImport = document.getElementById('btnCloseImport');
    const btnCloseDetail = document.getElementById('btnCloseDetail');
    const btnSaveDetail = document.getElementById('btnSaveDetail');
    const btnOpenLocation = document.getElementById('btnOpenLocation');
    const btnCopyFingerprint = document.getElementById('btnCopyFingerprint');
    const btnDeleteCert = document.getElementById('btnDeleteCert');
    const btnNewTask = document.getElementById('btnNewTask');
    const btnCloseTask = document.getElementById('btnCloseTask');
    const btnCancelTask = document.getElementById('btnCancelTask');
    const btnSaveTask = document.getElementById('btnSaveTask');
    const btnRunChecks = document.getElementById('btnRunChecks');
    const btnExportReport = document.getElementById('btnExportReport');
    const btnAddPassword = document.getElementById('btnAddPassword');
    const btnClosePassword = document.getElementById('btnClosePassword');
    const btnCancelPassword = document.getElementById('btnCancelPassword');
    const btnSavePassword = document.getElementById('btnSavePassword');
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    const filterStatus = document.getElementById('filterStatus') as HTMLSelectElement;
    const filterProject = document.getElementById('filterProject') as HTMLSelectElement;

    if (btnImport) btnImport.addEventListener('click', () => this.showImportModal());
    if (btnScanDir) btnScanDir.addEventListener('click', () => this.scanDirectory());
    if (btnSelectFiles) btnSelectFiles.addEventListener('click', () => this.selectFiles());
    if (btnCloseImport) btnCloseImport.addEventListener('click', () => this.hideModal('modalImport'));
    if (btnCloseDetail) btnCloseDetail.addEventListener('click', () => this.hideModal('modalDetail'));
    if (btnSaveDetail) btnSaveDetail.addEventListener('click', () => this.saveCertificateDetail());
    if (btnOpenLocation) btnOpenLocation.addEventListener('click', () => {
      if (this.selectedCertificate) {
        electronAPI.shell.openPath(this.selectedCertificate.filePath);
      }
    });
    if (btnCopyFingerprint) btnCopyFingerprint.addEventListener('click', () => {
      if (this.selectedCertificate) {
        navigator.clipboard.writeText(this.selectedCertificate.fingerprint.sha256);
        this.showToast('指纹已复制到剪贴板', 'success');
      }
    });
    if (btnDeleteCert) btnDeleteCert.addEventListener('click', () => {
      if (this.selectedCertificate) {
        this.deleteCertificate(this.selectedCertificate.id);
      }
    });

    if (searchInput) searchInput.addEventListener('input', (e) => {
      this.searchTerm = (e.target as HTMLInputElement).value;
      this.renderCertificates();
    });

    if (filterStatus) filterStatus.addEventListener('change', (e) => {
      this.filterStatus = (e.target as HTMLSelectElement).value;
      this.renderCertificates();
    });

    if (filterProject) filterProject.addEventListener('change', (e) => {
      this.filterProject = (e.target as HTMLSelectElement).value;
      this.renderCertificates();
    });

    if (btnNewTask) btnNewTask.addEventListener('click', () => this.showTaskModal());
    if (btnCloseTask) btnCloseTask.addEventListener('click', () => this.hideModal('modalTask'));
    if (btnCancelTask) btnCancelTask.addEventListener('click', () => this.hideModal('modalTask'));
    if (btnSaveTask) btnSaveTask.addEventListener('click', () => this.saveTask());

    if (btnRunChecks) btnRunChecks.addEventListener('click', () => this.runChecks());
    if (btnExportReport) btnExportReport.addEventListener('click', () => this.exportReport());

    if (btnAddPassword) btnAddPassword.addEventListener('click', () => this.showPasswordModal());
    if (btnClosePassword) btnClosePassword.addEventListener('click', () => this.hideModal('modalPassword'));
    if (btnCancelPassword) btnCancelPassword.addEventListener('click', () => this.hideModal('modalPassword'));
    if (btnSavePassword) btnSavePassword.addEventListener('click', () => this.savePassword());

    this.setupDropzone();
    this.setupModalBackdrops();

    (window as any).app = this;
    (window as any).createTaskForCert = (certId: string) => this.createTaskForCert(certId);
  }

  private setupDropzone() {
    const dropzone = document.getElementById('dropzone');
    if (!dropzone) return;

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const paths: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i] as any;
          if (file.path) {
            paths.push(file.path);
          }
        }
        if (paths.length > 0) {
          this.handleFiles(paths);
        }
      }
    });
  }

  private setupModalBackdrops() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', () => {
        const modal = backdrop.closest('.modal');
        if (modal) {
          modal.classList.remove('active');
        }
      });
    });
  }

  private navigateTo(page: string) {
    this.currentPage = page;

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if ((item as HTMLElement).dataset.page === page) {
        item.classList.add('active');
      }
    });

    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
    });

    const pageElement = document.getElementById(`page${page.charAt(0).toUpperCase() + page.slice(1)}`);
    if (pageElement) {
      pageElement.classList.add('active');
    }

    this.renderCurrentPage();
  }

  private renderCurrentPage() {
    switch (this.currentPage) {
      case 'certificates':
        this.renderCertificates();
        this.updateProjectFilters();
        break;
      case 'reminders':
        this.renderReminders();
        break;
      case 'tools':
        this.renderCheckResults();
        break;
      case 'passwords':
        this.renderPasswords();
        break;
    }
  }

  private renderCertificates() {
    const grid = document.getElementById('certificatesGrid');
    if (!grid) return;

    let filtered = this.certificates;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(cert =>
        cert.name.toLowerCase().includes(term) ||
        cert.subject.toLowerCase().includes(term) ||
        cert.issuer.toLowerCase().includes(term)
      );
    }

    if (this.filterStatus) {
      const now = new Date();
      filtered = filtered.filter(cert => {
        const notAfter = new Date(cert.notAfter);
        if (this.filterStatus === 'expired') {
          return notAfter <= now;
        } else if (this.filterStatus === 'expiring') {
          const daysLeft = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return notAfter > now && daysLeft <= 60;
        } else if (this.filterStatus === 'valid') {
          const daysLeft = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return notAfter > now && daysLeft > 60;
        }
        return true;
      });
    }

    if (this.filterProject) {
      filtered = filtered.filter(cert => cert.projectId === this.filterProject);
    }

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>暂无证书</p><p>点击上方"导入证书"按钮开始</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(cert => {
      const status = this.getCertificateStatus(cert);
      const match = status.match(/\d+/);
      const days = match ? parseInt(match[0], 10) : 0;
      const statusClass = status === '已过期' ? 'expired' : status.includes('剩余') && days <= 7 ? 'expired' : days <= 30 ? 'warning' : 'valid';

      return `<div class="cert-card" data-id="${cert.id}" style="cursor: pointer;"><div class="cert-card-header"><div><div class="cert-name">${this.escapeHtml(cert.name)}</div><div class="cert-info"><span>颁发者: ${this.escapeHtml(cert.issuer.split(',')[0] || cert.issuer)}</span></div></div><span class="cert-status ${statusClass}">${status}</span></div><div class="cert-info"><span>持有人: ${this.escapeHtml(cert.subject.split(',')[0] || cert.subject)}</span><span>格式: ${cert.fileFormat} | 用途: ${cert.keyUsage[0] || cert.extendedKeyUsage[0] || 'N/A'}</span></div><div class="cert-dates"><span>有效期: ${new Date(cert.notBefore).toLocaleDateString()}</span><span>至 ${new Date(cert.notAfter).toLocaleDateString()}</span></div></div>`;
    }).join('');

    grid.querySelectorAll('.cert-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.id;
        if (id) {
          this.showCertificateDetail(id);
        }
      });
    });
  }

  private getCertificateStatus(cert: Certificate): string {
    const now = new Date();
    const notAfter = new Date(cert.notAfter);
    if (notAfter <= now) {
      return '已过期';
    }
    const daysLeft = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `剩余${daysLeft}天`;
  }

  private async showCertificateDetail(id: string) {
    const cert = this.certificates.find(c => c.id === id);
    if (!cert) return;

    this.selectedCertificate = cert;
    const daysLeft = Math.ceil((new Date(cert.notAfter).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    let chainHtml = '<p style="color: var(--text-secondary);">正在获取证书链路...</p>';
    try {
      const chain = await electronAPI.certificates.getChain(cert.filePath);
      if (chain && chain.length > 1) {
        chainHtml = `<div class="cert-chain-viewer" style="font-family: monospace;">
          <div style="margin-bottom: 12px; color: var(--text-secondary); font-size: 12px;">
            点击各层证书可展开查看详情
          </div>
          ${chain.map((item: any, index: number) => {
            const isLeaf = index === 0;
            const isRoot = index === chain.length - 1;
            const certType = isLeaf ? 'leaf' : isRoot ? 'root' : 'intermediate';
            const icon = isLeaf ? '🔒' : isRoot ? '🌿' : '📜';
            const typeLabel = isLeaf ? '叶子证书' : isRoot ? '根证书' : '中间证书';
            const leftPadding = index * 20;

            return `<div class="chain-node" style="margin-bottom: 8px;">
              <div class="chain-header" onclick="app.toggleChainDetail('chain-${index}')" style="
                padding: 12px;
                background: ${isLeaf ? 'rgba(24, 144, 255, 0.1)' : isRoot ? 'rgba(82, 196, 26, 0.1)' : 'rgba(250, 173, 20, 0.1)'};
                border: 1px solid ${isLeaf ? '#1890ff' : isRoot ? '#52c41a' : '#faad14'};
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 12px;
              ">
                <span style="font-size: 20px;">${icon}</span>
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
                    ${this.escapeHtml(item.subject.split(',')[0]?.replace('CN=', '') || item.subject)}
                  </div>
                  <div style="font-size: 11px; color: var(--text-secondary);">
                    <span style="background: ${isLeaf ? '#1890ff' : isRoot ? '#52c41a' : '#faad14'}; color: white; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">
                      ${typeLabel}
                    </span>
                    ${isRoot ? '<span style="color: #52c41a;">自签名</span>' : `<span>颁发者: ${this.escapeHtml(item.issuer.split(',')[0]?.replace('CN=', '') || item.issuer)}</span>`}
                  </div>
                </div>
                <span class="chain-arrow" style="color: var(--text-secondary); font-size: 12px;">▼</span>
              </div>
              <div id="chain-${index}" class="chain-detail" style="display: none; padding: 12px; background: #fafafa; border: 1px solid #d9d9d9; border-top: none; border-radius: 0 0 6px 6px; font-size: 12px;">
                <div style="display: grid; gap: 8px;">
                  <div><span style="color: var(--text-secondary);">主题:</span> ${this.escapeHtml(item.subject)}</div>
                  <div><span style="color: var(--text-secondary);">颁发者:</span> ${this.escapeHtml(item.issuer)}</div>
                  <div><span style="color: var(--text-secondary);">序列号:</span> <code style="background: #e6e6e6; padding: 2px 4px; border-radius: 2px;">${this.escapeHtml(item.serialNumber)}</code></div>
                  <div><span style="color: var(--text-secondary);">过期时间:</span> <span style="color: ${new Date(item.notAfter) < new Date() ? 'var(--danger)' : 'var(--secondary)'};">${new Date(item.notAfter).toLocaleString()}</span></div>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>`;
      } else {
        chainHtml = '<p style="color: var(--text-secondary);">⚠️ 没有完整的证书链路（当前文件只包含单张证书）</p>';
      }
    } catch (error) {
      console.error('Failed to get certificate chain:', error);
      chainHtml = '<p style="color: var(--text-secondary);">⚠️ 没有完整的证书链路（当前文件只包含单张证书）</p>';
    }

    const relatedTasks = this.tasks.filter(t => t.certificateId === cert.id);
    let renewalHistoryHtml = '';
    if (relatedTasks.length > 0) {
      renewalHistoryHtml = `<div class="detail-section">
        <h4>续期记录</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${relatedTasks.map((task: any) => `
            <div style="padding: 12px; background: ${task.status === 'completed' ? 'rgba(82, 196, 26, 0.1)' : '#fafafa'}; border: 1px solid ${task.status === 'completed' ? '#52c41a' : '#d9d9d9'}; border-radius: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 600;">${this.escapeHtml(task.taskName)}</span>
                <span style="padding: 2px 8px; border-radius: 3px; font-size: 12px; background: ${task.status === 'completed' ? '#52c41a' : task.status === 'in_progress' ? '#1890ff' : '#8c8c8c'}; color: white;">
                  ${task.status === 'completed' ? '已完成' : task.status === 'in_progress' ? '进行中' : '待处理'}
                </span>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary);">
                <div>负责人: ${this.escapeHtml(task.assignee) || '未指定'}</div>
                <div>截止日期: ${new Date(task.dueDate).toLocaleDateString()}</div>
                ${task.completedDate ? `<div style="color: #52c41a;">完成时间: ${new Date(task.completedDate).toLocaleDateString()}</div>` : ''}
                ${task.renewedCertFile ? `<div style="margin-top: 4px; padding: 6px 8px; background: white; border-radius: 4px; border-left: 3px solid #52c41a;">新证书: <a href="#" onclick="event.preventDefault(); app.openCertFile('${this.escapeHtml(task.renewedCertFile)}')" style="color: #1890ff;">${this.escapeHtml(task.renewedCertFile.split(/[/\\]/).pop() || task.renewedCertFile)}</a></div>` : ''}
                ${task.renewalNotes ? `<div style="margin-top: 4px; padding: 6px 8px; background: white; border-radius: 4px;">续期备注: ${this.escapeHtml(task.renewalNotes)}</div>` : ''}
                ${task.notes ? `<div style="margin-top: 4px; padding: 6px 8px; background: white; border-radius: 4px;">任务备注: ${this.escapeHtml(task.notes)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    const body = document.getElementById('detailBody');
    if (body) {
      body.innerHTML = `<div class="detail-section"><h4>基本信息</h4><div class="detail-grid"><div class="detail-item"><span class="detail-label">证书名称</span><span class="detail-value">${this.escapeHtml(cert.name)}</span></div><div class="detail-item"><span class="detail-label">序列号</span><span class="detail-value">${this.escapeHtml(cert.serialNumber)}</span></div><div class="detail-item"><span class="detail-label">颁发者</span><span class="detail-value">${this.escapeHtml(cert.issuer)}</span></div><div class="detail-item"><span class="detail-label">持有人</span><span class="detail-value">${this.escapeHtml(cert.subject)}</span></div><div class="detail-item"><span class="detail-label">有效期</span><span class="detail-value">${new Date(cert.notBefore).toLocaleDateString()} - ${new Date(cert.notAfter).toLocaleDateString()}</span></div><div class="detail-item"><span class="detail-label">剩余天数</span><span class="detail-value" style="color: ${daysLeft <= 7 ? '#ff4d4f' : daysLeft <= 30 ? '#faad14' : '#52c41a'}">${daysLeft} 天</span></div></div></div><div class="detail-section"><h4>证书链路</h4>${chainHtml}</div>${renewalHistoryHtml}<div class="detail-section"><h4>技术信息</h4><div class="detail-grid"><div class="detail-item"><span class="detail-label">公钥算法</span><span class="detail-value">${cert.publicKeyAlgorithm}</span></div><div class="detail-item"><span class="detail-label">签名算法</span><span class="detail-value">${cert.signatureAlgorithm}</span></div><div class="detail-item"><span class="detail-label">密钥用途</span><span class="detail-value">${cert.keyUsage.join(', ') || 'N/A'}</span></div><div class="detail-item"><span class="detail-label">扩展用途</span><span class="detail-value">${cert.extendedKeyUsage.join(', ') || 'N/A'}</span></div></div></div><div class="detail-section"><h4>指纹信息</h4><div class="detail-item"><span class="detail-label">SHA-1</span><span class="detail-value large">${cert.fingerprint.sha1}</span></div><div class="detail-item" style="margin-top: 12px;"><span class="detail-label">SHA-256</span><span class="detail-value large">${cert.fingerprint.sha256}</span></div></div><div class="detail-section"><h4>文件信息</h4><div class="detail-grid"><div class="detail-item"><span class="detail-label">文件格式</span><span class="detail-value">${cert.fileFormat}</span></div><div class="detail-item"><span class="detail-label">来源类型</span><span class="detail-value">${cert.sourceType === 'local' ? '本机' : '共享目录'}</span></div><div class="detail-item" style="grid-column: 1 / -1;"><span class="detail-label">文件路径</span><span class="detail-value large">${this.escapeHtml(cert.filePath)}</span></div></div></div><div class="detail-section"><h4>管理信息</h4><div class="detail-grid"><div class="detail-item"><label class="detail-label">关联负责人</label><input type="text" id="detailResponsible" class="input" value="${this.escapeHtml(cert.responsiblePerson)}" placeholder="输入负责人"></div><div class="detail-item"><label class="detail-label">所属项目</label><select id="detailProject" class="select"><option value="">未分类</option>${this.projects.map(p => `<option value="${p.id}" ${p.id === cert.projectId ? 'selected' : ''}>${this.escapeHtml(p.name)}</option>`).join('')}</select></div></div><div class="detail-notes" style="margin-top: 16px;"><label class="detail-label">备注</label><textarea id="detailNotes" style="width: 100%; min-height: 100px; padding: 12px; border: 1px solid var(--border); border-radius: 4px; font-size: 14px; resize: vertical;">${this.escapeHtml(cert.notes)}</textarea></div></div>`;
    }

    this.showModal('modalDetail');
  }

  public toggleChainDetail(id: string) {
    const detail = document.getElementById(id);
    if (detail) {
      const isHidden = detail.style.display === 'none';
      detail.style.display = isHidden ? 'block' : 'none';
      const header = detail.previousElementSibling;
      if (header) {
        const arrow = header.querySelector('.chain-arrow');
        if (arrow) {
          arrow.textContent = isHidden ? '▲' : '▼';
        }
      }
    }
  }

  private async saveCertificateDetail() {
    if (!this.selectedCertificate) return;
    const responsible = (document.getElementById('detailResponsible') as HTMLInputElement).value;
    const projectId = (document.getElementById('detailProject') as HTMLSelectElement).value;
    const notes = (document.getElementById('detailNotes') as HTMLTextAreaElement).value;
    this.selectedCertificate.responsiblePerson = responsible;
    this.selectedCertificate.projectId = projectId;
    this.selectedCertificate.notes = notes;
    try {
      await electronAPI.certificates.save(this.selectedCertificate);
      const index = this.certificates.findIndex(c => c.id === this.selectedCertificate!.id);
      if (index >= 0) {
        this.certificates[index] = this.selectedCertificate;
      }
      this.hideModal('modalDetail');
      this.renderCertificates();
      this.showToast('证书信息已保存', 'success');
    } catch (error) {
      console.error('Failed to save certificate:', error);
      this.showToast('保存失败', 'error');
    }
  }

  private async deleteCertificate(id: string) {
    if (!confirm('确定要删除此证书吗？')) return;
    try {
      await electronAPI.certificates.delete(id);
      this.certificates = this.certificates.filter(c => c.id !== id);
      this.hideModal('modalDetail');
      this.renderCertificates();
      this.updateStatusBar();
      this.showToast('证书已删除', 'success');
    } catch (error) {
      console.error('Failed to delete certificate:', error);
      this.showToast('删除失败', 'error');
    }
  }

  private async showImportModal() {
    this.updateProjectSelect('importProject');
    this.showModal('modalImport');
  }

  private async selectFiles() {
    try {
      const files = await electronAPI.dialog.openFile();
      if (files && files.length > 0) {
        await this.handleFiles(files);
      }
    } catch (error) {
      console.error('Failed to select files:', error);
      this.showToast('选择文件失败', 'error');
    }
  }

  private async handleFiles(filePaths: string[]) {
    const projectId = (document.getElementById('importProject') as HTMLSelectElement).value;
    this.showToast(`正在导入 ${filePaths.length} 个文件...`, 'success');
    try {
      const newCerts: Certificate[] = [];
      for (const filePath of filePaths) {
        try {
          const cert = await electronAPI.certificates.parse(filePath);
          cert.projectId = projectId;
          await electronAPI.certificates.save(cert);
          newCerts.push(cert);
          this.certificates.push(cert);
        } catch (err) {
          console.error(`Failed to parse ${filePath}:`, err);
        }
      }
      this.hideModal('modalImport');
      this.renderCertificates();
      this.updateStatusBar();
      this.showToast(`成功导入 ${newCerts.length} 个证书`, 'success');
    } catch (error) {
      console.error('Failed to import certificates:', error);
      this.showToast('导入失败', 'error');
    }
  }

  private async scanDirectory() {
    try {
      const dirPath = await electronAPI.dialog.openDirectory();
      if (!dirPath) return;
      this.showToast('正在扫描目录...', 'success');
      const files = await electronAPI.certificates.scanDirectory(dirPath);
      if (files.length > 0) {
        await this.handleFiles(files);
      } else {
        this.showToast('未找到证书文件', 'warning');
      }
    } catch (error) {
      console.error('Failed to scan directory:', error);
      this.showToast('扫描失败', 'error');
    }
  }

  private updateProjectFilters() {
    const filter = document.getElementById('filterProject') as HTMLSelectElement;
    if (!filter) return;
    filter.innerHTML = '<option value="">全部项目</option>' + this.projects.map(p => `<option value="${p.id}">${this.escapeHtml(p.name)}</option>`).join('');
  }

  private updateProjectSelect(selectId: string) {
    const select = document.getElementById(selectId) as HTMLSelectElement;
    if (!select) return;
    select.innerHTML = '<option value="">未分类</option>' + this.projects.map(p => `<option value="${p.id}">${this.escapeHtml(p.name)}</option>`).join('');
  }

  private renderReminders() {
    const list = document.getElementById('remindersList');
    if (!list) return;

    const now = new Date();
    const certsWithDays = this.certificates.map(cert => ({
      ...cert,
      daysLeft: Math.ceil((new Date(cert.notAfter).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }));

    const urgent = certsWithDays.filter(c => c.daysLeft >= 0 && c.daysLeft <= 7);
    const warning = certsWithDays.filter(c => c.daysLeft > 7 && c.daysLeft <= 30);
    const notice = certsWithDays.filter(c => c.daysLeft > 30 && c.daysLeft <= 60);
    const expired = certsWithDays.filter(c => c.daysLeft < 0);

    document.getElementById('summaryTotal')!.textContent = String(this.certificates.length);
    document.getElementById('summaryValid')!.textContent = String(certsWithDays.filter(c => c.daysLeft > 60).length);
    document.getElementById('summaryWarning')!.textContent = String(urgent.length + warning.length + notice.length);
    document.getElementById('summaryExpired')!.textContent = String(expired.length);

    let html = '<div class="reminders-list">';

    if (this.tasks.length > 0) {
      html += '<h3 style="margin-bottom: 16px; font-size: 16px;">续期任务</h3>';
      this.tasks.forEach(task => {
        const cert = this.certificates.find(c => c.id === task.certificateId);
        const certName = cert ? cert.name : '未知证书';
        const statusText = task.status === 'completed' ? '已完成' : task.status === 'in_progress' ? '进行中' : '待处理';
        const statusClass = task.status === 'completed' ? 'completed' : task.status === 'in_progress' ? 'in_progress' : 'pending';
        html += `<div class="task-item"><div class="task-header"><div><div class="task-name">${this.escapeHtml(task.taskName)}</div><div class="task-cert">关联证书: ${this.escapeHtml(certName)}</div></div><span class="task-status ${statusClass}">${statusText}</span></div><div class="task-meta"><span>负责人: ${this.escapeHtml(task.assignee) || '未指定'}</span><span>截止日期: ${new Date(task.dueDate).toLocaleDateString()}</span></div>${task.notes ? `<div class="task-cert" style="margin-bottom: 12px;">备注: ${this.escapeHtml(task.notes)}</div>` : ''}<div class="task-actions">${task.status !== 'completed' ? `<button class="btn btn-sm btn-primary" onclick="app.completeTask('${task.id}')">确认完成</button><button class="btn btn-sm btn-secondary" onclick="app.editTask('${task.id}')">编辑</button>` : ''}<button class="btn btn-sm btn-danger" onclick="app.deleteTask('${task.id}')">删除</button></div></div>`;
      });
      html += '<h3 style="margin: 24px 0 16px; font-size: 16px;">到期概览</h3>';
    }

    const sortedCerts = [
      ...urgent.map(c => ({ ...c, level: 'urgent' })),
      ...warning.map(c => ({ ...c, level: 'warning' })),
      ...notice.map(c => ({ ...c, level: 'notice' })),
      ...expired.map(c => ({ ...c, level: 'normal' }))
    ];

    if (sortedCerts.length === 0 && this.tasks.length === 0) {
      html += '<div class="empty-state"><p>暂无到期提醒</p></div>';
    } else {
      sortedCerts.forEach(cert => {
        const statusText = cert.daysLeft < 0 ? `已过期 ${Math.abs(cert.daysLeft)} 天` : `剩余 ${cert.daysLeft} 天`;
        const levelClass = cert.level;
        const daysClass = cert.level;
        html += `<div class="reminder-item"><div class="reminder-level ${levelClass}"></div><div class="reminder-info"><div class="reminder-name">${this.escapeHtml(cert.name)}</div><div class="reminder-details">${this.escapeHtml(cert.subject.split(',')[0])}</div></div><div class="reminder-days ${daysClass}">${statusText}</div><div class="reminder-actions"><button class="btn btn-sm btn-secondary" onclick="app.createTaskForCert('${cert.id}')">创建任务</button></div></div>`;
      });
    }

    html += '</div>';
    list.innerHTML = html;
  }

  public async completeTask(taskId: string) {
    const task = this.tasks.find(t => t.id === taskId) || null;
    if (!task) return;

    const renewedCertFile = prompt('请输入新证书文件路径（可选）:', task.renewedCertFile || '');
    const renewalNotes = prompt('请输入完成备注（可选）:', task.renewalNotes || '');

    task.status = 'completed';
    task.completedDate = new Date();
    task.renewedCertFile = renewedCertFile || undefined;
    task.renewalNotes = renewalNotes || undefined;

    try {
      await electronAPI.tasks.save(task);
      const index = this.tasks.findIndex(t => t.id === taskId);
      if (index >= 0) {
        this.tasks[index] = task;
      }
      this.showToast('任务已完成', 'success');
      this.renderReminders();
    } catch (error) {
      console.error('Failed to complete task:', error);
      this.showToast('操作失败', 'error');
    }
  }

  public editTask(taskId: string) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      this.showTaskModal(task);
    }
  }

  public async deleteTask(taskId: string) {
    if (!confirm('确定要删除此任务吗？')) return;
    try {
      await electronAPI.tasks.delete(taskId);
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      this.renderReminders();
      this.showToast('任务已删除', 'success');
    } catch (error) {
      console.error('Failed to delete task:', error);
      this.showToast('删除失败', 'error');
    }
  }

  private showTaskModal(task?: RenewalTask) {
    this.editingTask = task || null;
    document.getElementById('taskModalTitle')!.textContent = task ? '编辑续期任务' : '新建续期任务';
    (document.getElementById('taskName') as HTMLInputElement).value = task?.taskName || '';
    (document.getElementById('taskDueDate') as HTMLInputElement).value = task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
    (document.getElementById('taskAssignee') as HTMLInputElement).value = task?.assignee || '';
    (document.getElementById('taskNotes') as HTMLTextAreaElement).value = task?.notes || '';

    const select = document.getElementById('taskCertificate') as HTMLSelectElement;
    select.innerHTML = '<option value="">选择证书</option>' + this.certificates.map(c => `<option value="${c.id}" ${task?.certificateId === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`).join('');

    this.showModal('modalTask');
  }

  public createTaskForCert(certId: string) {
    const cert = this.certificates.find(c => c.id === certId);
    if (cert) {
      const defaultTaskName = `续期: ${cert.name}`;
      const defaultDueDate = new Date(cert.notAfter);
      defaultDueDate.setDate(defaultDueDate.getDate() - 7);

      document.getElementById('taskModalTitle')!.textContent = '新建续期任务';
      (document.getElementById('taskName') as HTMLInputElement).value = defaultTaskName;
      (document.getElementById('taskDueDate') as HTMLInputElement).value = defaultDueDate.toISOString().split('T')[0];
      (document.getElementById('taskAssignee') as HTMLInputElement).value = cert.responsiblePerson || '';
      (document.getElementById('taskNotes') as HTMLTextAreaElement).value = '';

      const select = document.getElementById('taskCertificate') as HTMLSelectElement;
      select.innerHTML = '<option value="">选择证书</option>' + this.certificates.map(c => `<option value="${c.id}" ${certId === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`).join('');

      this.showModal('modalTask');
    }
  }

  private async saveTask() {
    const name = (document.getElementById('taskName') as HTMLInputElement).value;
    const certId = (document.getElementById('taskCertificate') as HTMLSelectElement).value;
    const dueDate = (document.getElementById('taskDueDate') as HTMLInputElement).value;
    const assignee = (document.getElementById('taskAssignee') as HTMLInputElement).value;
    const notes = (document.getElementById('taskNotes') as HTMLTextAreaElement).value;

    if (!name) {
      this.showToast('请输入任务名称', 'warning');
      return;
    }

    const task: RenewalTask = {
      id: this.editingTask?.id || this.generateId(),
      certificateId: certId,
      taskName: name,
      assignee,
      dueDate: dueDate ? new Date(dueDate) : new Date(),
      status: this.editingTask?.status || 'pending',
      notes,
      createdDate: this.editingTask?.createdDate || new Date(),
      completedDate: this.editingTask?.completedDate
    };

    try {
      await electronAPI.tasks.save(task);
      const index = this.tasks.findIndex(t => t.id === task.id);
      if (index >= 0) {
        this.tasks[index] = task;
      } else {
        this.tasks.push(task);
      }
      this.hideModal('modalTask');
      this.renderReminders();
      this.showToast('任务已保存', 'success');
    } catch (error) {
      console.error('Failed to save task:', error);
      this.showToast('保存失败', 'error');
    }
  }

  private async runChecks() {
    const results: CheckResult[] = [];

    const checkExpired = (document.getElementById('checkExpired') as HTMLInputElement).checked;
    const checkDuplicates = (document.getElementById('checkDuplicates') as HTMLInputElement).checked;
    const checkKeyMatch = (document.getElementById('checkKeyMatch') as HTMLInputElement).checked;

    if (checkExpired) {
      const now = new Date();
      this.certificates.forEach(cert => {
        if (new Date(cert.notAfter) <= now) {
          results.push({
            type: 'expired',
            severity: 'error',
            certificateId: cert.id,
            certificateName: cert.name,
            message: `证书 "${cert.name}" 已过期`,
            details: `过期日期: ${new Date(cert.notAfter).toLocaleDateString()}`,
            suggestion: '请及时续期或更新证书'
          });
        }
      });
    }

    if (checkDuplicates) {
      const seen = new Map<string, Certificate[]>();
      this.certificates.forEach(cert => {
        const key = cert.fingerprint.sha256;
        if (seen.has(key)) {
          seen.get(key)!.push(cert);
        } else {
          seen.set(key, [cert]);
        }
      });

      seen.forEach((certs) => {
        if (certs.length > 1) {
          certs.forEach(cert => {
            results.push({
              type: 'duplicate',
              severity: 'warning',
              certificateId: cert.id,
              certificateName: cert.name,
              message: `发现重复证书`,
              details: `与 ${certs.length - 1} 个其他证书具有相同的 SHA-256 指纹`,
              suggestion: '检查是否需要保留多个副本'
            });
          });
        }
      });
    }

    if (checkKeyMatch) {
      if (this.certificates.length === 0) {
        this.showToast('请先导入证书', 'warning');
        return;
      }

      const keyMatchSection = document.getElementById('keyMatchSection');
      if (keyMatchSection) {
        const certSelect = document.getElementById('keyMatchCertSelect') as HTMLSelectElement;
        const keyFileInput = document.getElementById('keyMatchFileInput') as HTMLInputElement;

        const selectedCertId = certSelect.value;
        const keyFilePath = keyFileInput.value;

        if (!selectedCertId) {
          this.showToast('请选择证书', 'warning');
          return;
        }
        if (!keyFilePath) {
          this.showToast('请选择私钥文件', 'warning');
          return;
        }

        const selectedCert = this.certificates.find(c => c.id === selectedCertId);
        if (!selectedCert) {
          this.showToast('未找到选中的证书', 'error');
          return;
        }

        try {
          const isMatch = await electronAPI.check.keyMatch(selectedCertId, keyFilePath);

          const record: KeyMatchRecord = {
            id: this.generateId(),
            certificateId: selectedCertId,
            certificateName: selectedCert.name,
            certificateSerial: selectedCert.serialNumber,
            keyFilePath: keyFilePath,
            isMatch: isMatch,
            checkedAt: new Date()
          };
          await electronAPI.keymatch.saveRecord(record);
          this.keyMatchHistory = await electronAPI.keymatch.getHistory();

          results.push({
            type: 'key_match',
            severity: isMatch ? 'info' : 'warning',
            certificateId: selectedCertId,
            certificateName: selectedCert.name,
            message: isMatch ? `✅ 私钥匹配成功` : `❌ 私钥不匹配`,
            details: `证书: ${selectedCert.name}\n证书序列号: ${selectedCert.serialNumber}\n私钥文件: ${keyFilePath}`,
            suggestion: isMatch ? '证书和私钥匹配正确' : '该私钥不是此证书的正确私钥，请检查私钥文件是否正确'
          });
        } catch (err) {
          console.error(`Key match check failed:`, err);
          results.push({
            type: 'key_match',
            severity: 'warning',
            certificateId: selectedCertId,
            certificateName: selectedCert.name,
            message: `❌ 无法验证私钥匹配`,
            details: `证书: ${selectedCert.name}\n私钥文件: ${keyFilePath}\n错误: ${err}`,
            suggestion: '无法读取私钥文件，请确保文件格式正确（支持 .key, .pem 格式）'
          });
        }
      }
    }

    this.renderCheckResultsList(results);
    this.showToast(`检查完成，发现 ${results.length} 个问题`, results.length > 0 ? 'warning' : 'success');
  }

  private async renderCheckResults() {
    const container = document.getElementById('checkResults');
    if (!container) return;

    this.keyMatchHistory = await electronAPI.keymatch.getHistory();

    const keyMatchHistorySection = this.keyMatchHistory.length > 0 ? `
      <div style="margin-top: 20px; padding: 16px; background: #fafafa; border-radius: 6px;">
        <h4 style="margin-bottom: 12px;">最近检查记录</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${this.keyMatchHistory.slice(0, 5).map((record: any) => `
            <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: white; border-radius: 4px; font-size: 12px;">
              <span style="color: ${record.isMatch ? '#52c41a' : '#ff4d4f'};">${record.isMatch ? '✅' : '❌'}</span>
              <span style="flex: 1;">${this.escapeHtml(record.certificateName)}</span>
              <span style="color: #8c8c8c;">${new Date(record.checkedAt).toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <div id="keyMatchSection" style="margin-bottom: 20px; padding: 16px; background: #fafafa; border-radius: 6px;">
        <h4 style="margin-bottom: 12px;">私钥匹配检查</h4>
        <div style="display: flex; gap: 12px; align-items: center;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 12px; margin-bottom: 4px; color: var(--text-secondary);">选择证书</label>
            <select id="keyMatchCertSelect" style="width: 100%; height: 36px; padding: 0 12px; border: 1px solid var(--border); border-radius: 4px;">
              <option value="">请选择证书</option>
              ${this.certificates.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 12px; margin-bottom: 4px; color: var(--text-secondary);">私钥文件</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="keyMatchFileInput" placeholder="选择或输入私钥文件路径" style="flex: 1; height: 36px; padding: 0 12px; border: 1px solid var(--border); border-radius: 4px;">
              <button class="btn btn-secondary" onclick="app.selectKeyFile()" style="height: 36px;">浏览</button>
            </div>
          </div>
        </div>
      </div>
      ${keyMatchHistorySection}
      <div id="checkResultsList"></div>
    `;
  }

  public async selectKeyFile() {
    const files = await electronAPI.dialog.openFile('key');
    if (files && files.length > 0) {
      const input = document.getElementById('keyMatchFileInput') as HTMLInputElement;
      if (input) {
        input.value = files[0];
      }
    }
  }

  private renderCheckResultsList(results: CheckResult[]) {
    const container = document.getElementById('checkResultsList');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>✅ 未发现问题，证书状态良好！</p></div>';
      return;
    }

    container.innerHTML = results.map(result => `<div class="check-result-item"><div class="check-result-header"><span class="check-result-icon ${result.severity}">${result.severity === 'error' ? '❌' : result.severity === 'warning' ? '⚠️' : '✅'}</span><span class="check-result-name">${this.escapeHtml(result.certificateName)}</span><span class="check-result-type">${result.type === 'expired' ? '过期' : result.type === 'duplicate' ? '重复' : result.type === 'key_match' ? '私钥匹配' : result.type}</span></div><div class="check-result-message">${this.escapeHtml(result.message)}</div><div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; white-space: pre-wrap;">${this.escapeHtml(result.details)}</div><div class="check-result-suggestion">💡 ${this.escapeHtml(result.suggestion)}</div></div>`).join('');
  }

  private async exportReport() {
    try {
      const filePath = await electronAPI.dialog.saveFile(`certificates-report-${new Date().toISOString().split('T')[0]}.html`);
      if (!filePath) return;
      const format = filePath.endsWith('.csv') ? 'csv' : filePath.endsWith('.json') ? 'json' : 'html';
      const content = await electronAPI.report.generate(format);
      await electronAPI.report.save(content, filePath);
      this.showToast('报告已导出', 'success');
    } catch (error) {
      console.error('Failed to export report:', error);
      this.showToast('导出失败', 'error');
    }
  }

  private async renderPasswords() {
    const list = document.getElementById('passwordsList');
    const header = document.querySelector('#pagePasswords .page-header');
    if (!list) return;

    const isSet = await electronAPI.passwords.isSet();
    const isUnlocked = await electronAPI.passwords.isUnlocked();

    if (!isSet) {
      if (header) {
        header.innerHTML = `<h2>密码保险箱</h2>`;
      }
      list.innerHTML = `<div class="empty-state"><p>🔐 密码保险箱未设置</p><p>请先设置主密码以保护您的密码</p><div style="margin-top: 16px;"><div style="margin-bottom: 12px;"><input type="password" id="setupNewPass" placeholder="设置主密码（至少6位）" style="width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 4px;"></div><div style="margin-bottom: 12px;"><input type="password" id="setupConfirmPass" placeholder="确认主密码" style="width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 4px;"></div><button class="btn btn-primary" onclick="app.setupMasterPassword()" style="width: 100%;">设置主密码</button></div></div>`;
      return;
    }

    if (!isUnlocked) {
      if (header) {
        header.innerHTML = `<h2>密码保险箱</h2>`;
      }
      list.innerHTML = `<div class="empty-state"><p>🔒 密码保险箱已锁定</p><p>请输入主密码解锁</p><div style="margin-top: 16px;"><input type="password" id="unlockPassInput" placeholder="输入主密码" style="width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 12px;"><button class="btn btn-primary" onclick="app.unlockPasswords()" style="width: 100%;">解锁</button></div></div>`;
      return;
    }

    if (header) {
      header.innerHTML = `<h2>密码保险箱</h2>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="text" id="passwordSearchInput" placeholder="搜索名称、备注..." value="${this.escapeHtml(this.passwordSearchTerm)}" style="height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 4px; width: 160px;">
          <select id="passwordCertFilter" style="height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 4px;">
            <option value="">全部证书关联</option>
            ${this.certificates.map(c => `<option value="${c.id}" ${this.passwordFilterCert === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="btnAddPassword">添加密码</button>
        </div>`;

      document.getElementById('btnAddPassword')?.addEventListener('click', () => this.showPasswordModal());

      const searchInput = document.getElementById('passwordSearchInput');
      searchInput?.addEventListener('input', (e) => {
        this.passwordSearchTerm = (e.target as HTMLInputElement).value;
        this.renderPasswords();
      });

      const certFilter = document.getElementById('passwordCertFilter');
      certFilter?.addEventListener('change', (e) => {
        this.passwordFilterCert = (e.target as HTMLSelectElement).value;
        this.renderPasswords();
      });
    }

    let filtered = this.passwords;
    if (this.passwordSearchTerm) {
      const term = this.passwordSearchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.notes.toLowerCase().includes(term)
      );
    }
    if (this.passwordFilterCert) {
      filtered = filtered.filter(p => p.relatedCertificateId === this.passwordFilterCert);
    }

    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>暂无保存的密码</p></div>';
      return;
    }

    list.innerHTML = filtered.map(entry => `<div class="password-item"><div class="password-icon">🔑</div><div class="password-info"><div class="password-name">${this.escapeHtml(entry.name)}</div><div class="password-meta"><span>创建: ${new Date(entry.createdDate).toLocaleDateString()}</span>${entry.relatedCertificateId ? `<span>关联证书: ${this.getCertificateName(entry.relatedCertificateId)}</span>` : ''}</div>${entry.notes ? `<div class="password-meta" style="margin-top: 4px;">备注: ${this.escapeHtml(entry.notes)}</div>` : ''}</div><div class="password-value"><span class="password-dots">••••••••</span><button class="btn btn-sm btn-secondary" onclick="app.copyPassword('${entry.id}')">复制</button></div><div class="password-actions"><button class="btn btn-sm btn-secondary" onclick="app.editPassword('${entry.id}')">编辑</button><button class="btn btn-sm btn-danger" onclick="app.deletePassword('${entry.id}')">删除</button></div></div>`).join('');
  }

  public async setupMasterPassword() {
    const newPass = (document.getElementById('setupNewPass') as HTMLInputElement).value;
    const confirmPass = (document.getElementById('setupConfirmPass') as HTMLInputElement).value;

    if (!newPass) {
      this.showToast('请输入主密码', 'warning');
      return;
    }
    if (newPass.length < 6) {
      this.showToast('主密码至少需要6个字符', 'warning');
      return;
    }
    if (newPass !== confirmPass) {
      this.showToast('两次输入的密码不一致', 'warning');
      return;
    }

    try {
      await electronAPI.passwords.setMaster(newPass);
      this.passwords = await electronAPI.passwords.getAll();
      await this.renderPasswords();
      this.showToast('主密码设置成功', 'success');
    } catch (error) {
      console.error('Failed to set master password:', error);
      this.showToast('设置失败', 'error');
    }
  }

  public async unlockPasswords() {
    const password = (document.getElementById('unlockPassInput') as HTMLInputElement)?.value;
    if (!password) {
      this.showToast('请输入主密码', 'warning');
      return;
    }

    try {
      const isValid = await electronAPI.passwords.verifyMaster(password);
      if (isValid) {
        this.passwords = await electronAPI.passwords.getAll();
        await this.renderPasswords();
        await electronAPI.passwords.resetLockTimer();
        this.showToast('密码保险箱已解锁', 'success');
      } else {
        this.showToast('主密码错误', 'error');
      }
    } catch (error) {
      console.error('Failed to unlock:', error);
      this.showToast('解锁失败', 'error');
    }
  }

  private getCertificateName(certId: string): string {
    const cert = this.certificates.find(c => c.id === certId);
    return cert ? cert.name : '未知证书';
  }

  private showPasswordModal(entry?: PasswordEntry) {
    this.editingPassword = entry || null;
    document.querySelector('#modalPassword h3')!.textContent = entry ? '编辑密码' : '添加密码';
    (document.getElementById('passwordName') as HTMLInputElement).value = entry?.name || '';
    (document.getElementById('passwordValue') as HTMLInputElement).value = '';
    (document.getElementById('passwordValue') as HTMLInputElement).placeholder = entry ? '留空则保留原密码' : '输入密码';
    (document.getElementById('passwordNotes') as HTMLTextAreaElement).value = entry?.notes || '';

    const select = document.getElementById('passwordCert') as HTMLSelectElement;
    select.innerHTML = '<option value="">无</option>' + this.certificates.map(c => `<option value="${c.id}" ${entry?.relatedCertificateId === c.id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`).join('');

    this.showModal('modalPassword');
  }

  private async savePassword() {
    const name = (document.getElementById('passwordName') as HTMLInputElement).value;
    const password = (document.getElementById('passwordValue') as HTMLInputElement).value;
    const certId = (document.getElementById('passwordCert') as HTMLSelectElement).value;
    const notes = (document.getElementById('passwordNotes') as HTMLTextAreaElement).value;

    if (!name) {
      this.showToast('请填写名称', 'warning');
      return;
    }

    if (!password && !this.editingPassword) {
      this.showToast('请填写密码', 'warning');
      return;
    }

    const actualPassword = password || (this.editingPassword ? '___KEEP_ORIGINAL___' : '');

    const entry: PasswordEntry = {
      id: this.editingPassword?.id || this.generateId(),
      name,
      password: actualPassword,
      relatedCertificateId: certId || undefined,
      notes,
      createdDate: this.editingPassword?.createdDate || new Date(),
      modifiedDate: new Date(),
      keepOriginal: !!password ? false : !!this.editingPassword
    };

    try {
      await electronAPI.passwords.save(entry);
      const index = this.passwords.findIndex(p => p.id === entry.id);
      if (index >= 0) {
        this.passwords[index] = entry;
      } else {
        this.passwords.push(entry);
      }
      this.hideModal('modalPassword');
      this.renderPasswords();
      this.showToast('密码已保存', 'success');
    } catch (error) {
      console.error('Failed to save password:', error);
      this.showToast('保存失败', 'error');
    }
  }

  public async copyPassword(id: string) {
    try {
      const isUnlocked = await electronAPI.passwords.isUnlocked();
      if (!isUnlocked) {
        this.showToast('密码保险箱已锁定，请先解锁', 'error');
        return;
      }
      const password = await electronAPI.passwords.getDecrypted(id);
      await navigator.clipboard.writeText(password);
      this.showToast('密码已复制到剪贴板', 'success');
      setTimeout(() => {
        navigator.clipboard.writeText('');
      }, 30000);
    } catch (error) {
      console.error('Failed to copy password:', error);
      this.showToast('复制失败，请先解锁密码保险箱', 'error');
    }
  }

  public editPassword(id: string) {
    const entry = this.passwords.find(p => p.id === id);
    if (entry) {
      this.showPasswordModal(entry);
    }
  }

  public async deletePassword(id: string) {
    try {
      const isUnlocked = await electronAPI.passwords.isUnlocked();
      if (!isUnlocked) {
        this.showToast('密码保险箱已锁定，请先解锁', 'error');
        return;
      }
      if (!confirm('确定要删除此密码吗？')) return;
      await electronAPI.passwords.delete(id);
      this.passwords = await electronAPI.passwords.getAll();
      await this.renderPasswords();
      this.showToast('密码已删除', 'success');
    } catch (error) {
      console.error('Failed to delete password:', error);
      this.showToast('删除失败', 'error');
    }
  }

  private updateStatusBar() {
    const total = this.certificates.length;
    const local = this.certificates.filter(c => c.sourceType === 'local').length;
    const shared = this.certificates.filter(c => c.sourceType === 'shared').length;
    const totalEl = document.getElementById('statusTotal');
    const sourceEl = document.getElementById('statusSource');
    if (totalEl) totalEl.textContent = `证书总数: ${total}`;
    if (sourceEl) sourceEl.textContent = `本机: ${local} | 共享: ${shared}`;
  }

  private showModal(id: string) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
    }
  }

  private hideModal(id: string) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  private showToast(message: string, type: 'success' | 'error' | 'warning') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public openCertFile(filePath: string) {
    if (filePath) {
      electronAPI.shell.openPath(filePath);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

(window as any).app = new CertManagerApp();
