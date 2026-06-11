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
}

interface PasswordEntry {
  id: string;
  name: string;
  password: string;
  relatedCertificateId?: string;
  notes: string;
  createdDate: Date;
  modifiedDate: Date;
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
    verifyMaster: (password: string) => Promise<boolean>;
    setMaster: (password: string) => Promise<void>;
    isSet: () => Promise<boolean>;
  };
  dialog: {
    openFile: () => Promise<string[]>;
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
    keyMatch: (certPath: string, keyPath: string) => Promise<boolean>;
    duplicates: () => Promise<any[]>;
  };
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

  constructor() {
    this.init();
  }

  private async init() {
    try {
      await this.loadData();
      this.setupEventListeners();
      this.renderCurrentPage();
      this.updateStatusBar();
      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
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
      if (chain && chain.length > 0) {
        chainHtml = chain.map((item: any, index: number) => `<div class="chain-item" style="padding: 12px; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 8px; ${index === 0 ? 'background: rgba(24, 144, 255, 0.05);' : ''}"><div style="font-weight: 600; margin-bottom: 4px;">${index === 0 ? '🔒 ' : index === chain.length - 1 ? '🌿 ' : '📜 '}${this.escapeHtml(item.subject.split(',')[0] || item.subject)}${item.isRoot ? ' (根证书)' : ''}</div><div style="font-size: 12px; color: var(--text-secondary);">颁发者: ${this.escapeHtml(item.issuer.split(',')[0] || item.issuer)}</div><div style="font-size: 12px; color: var(--text-secondary);">序列号: ${this.escapeHtml(item.serialNumber)}</div><div style="font-size: 12px; color: ${new Date(item.notAfter) < new Date() ? 'var(--danger)' : 'var(--secondary)'};">过期时间: ${new Date(item.notAfter).toLocaleDateString()}</div></div>`).join('');
      } else {
        chainHtml = '<p style="color: var(--text-secondary);">⚠️ 未检测到完整的证书链路（可能为自签名证书或缺少中间证书）</p>';
      }
    } catch (error) {
      console.error('Failed to get certificate chain:', error);
      chainHtml = '<p style="color: var(--text-secondary);">⚠️ 未检测到完整的证书链路（可能为自签名证书或缺少中间证书）</p>';
    }

    const body = document.getElementById('detailBody');
    if (body) {
      body.innerHTML = `<div class="detail-section"><h4>基本信息</h4><div class="detail-grid"><div class="detail-item"><span class="detail-label">证书名称</span><span class="detail-value">${this.escapeHtml(cert.name)}</span></div><div class="detail-item"><span class="detail-label">序列号</span><span class="detail-value">${this.escapeHtml(cert.serialNumber)}</span></div><div class="detail-item"><span class="detail-label">颁发者</span><span class="detail-value">${this.escapeHtml(cert.issuer)}</span></div><div class="detail-item"><span class="detail-label">持有人</span><span class="detail-value">${this.escapeHtml(cert.subject)}</span></div><div class="detail-item"><span class="detail-label">有效期</span><span class="detail-value">${new Date(cert.notBefore).toLocaleDateString()} - ${new Date(cert.notAfter).toLocaleDateString()}</span></div><div class="detail-item"><span class="detail-label">剩余天数</span><span class="detail-value" style="color: ${daysLeft <= 7 ? '#ff4d4f' : daysLeft <= 30 ? '#faad14' : '#52c41a'}">${daysLeft} 天</span></div></div></div><div class="detail-section"><h4>证书链路</h4>${chainHtml}</div><div class="detail-section"><h4>技术信息</h4><div class="detail-grid"><div class="detail-item"><span class="detail-label">公钥算法</span><span class="detail-value">${cert.publicKeyAlgorithm}</span></div><div class="detail-item"><span class="detail-label">签名算法</span><span class="detail-value">${cert.signatureAlgorithm}</span></div><div class="detail-item"><span class="detail-label">密钥用途</span><span class="detail-value">${cert.keyUsage.join(', ') || 'N/A'}</span></div><div class="detail-item"><span class="detail-label">扩展用途</span><span class="detail-value">${cert.extendedKeyUsage.join(', ') || 'N/A'}</span></div></div></div><div class="detail-section"><h4>指纹信息</h4><div class="detail-item"><span class="detail-label">SHA-1</span><span class="detail-value large">${cert.fingerprint.sha1}</span></div><div class="detail-item" style="margin-top: 12px;"><span class="detail-label">SHA-256</span><span class="detail-value large">${cert.fingerprint.sha256}</span></div></div><div class="detail-section"><h4>文件信息</h4><div class="detail-grid"><div class="detail-item"><span class="detail-label">文件格式</span><span class="detail-value">${cert.fileFormat}</span></div><div class="detail-item"><span class="detail-label">来源类型</span><span class="detail-value">${cert.sourceType === 'local' ? '本机' : '共享目录'}</span></div><div class="detail-item" style="grid-column: 1 / -1;"><span class="detail-label">文件路径</span><span class="detail-value large">${this.escapeHtml(cert.filePath)}</span></div></div></div><div class="detail-section"><h4>管理信息</h4><div class="detail-grid"><div class="detail-item"><label class="detail-label">关联负责人</label><input type="text" id="detailResponsible" class="input" value="${this.escapeHtml(cert.responsiblePerson)}" placeholder="输入负责人"></div><div class="detail-item"><label class="detail-label">所属项目</label><select id="detailProject" class="select"><option value="">未分类</option>${this.projects.map(p => `<option value="${p.id}" ${p.id === cert.projectId ? 'selected' : ''}>${this.escapeHtml(p.name)}</option>`).join('')}</select></div></div><div class="detail-notes" style="margin-top: 16px;"><label class="detail-label">备注</label><textarea id="detailNotes" style="width: 100%; min-height: 100px; padding: 12px; border: 1px solid var(--border); border-radius: 4px; font-size: 14px; resize: vertical;">${this.escapeHtml(cert.notes)}</textarea></div></div>`;
    }

    this.showModal('modalDetail');
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

  public completeTask(taskId: string) {
    this.editingTask = this.tasks.find(t => t.id === taskId) || null;
    if (this.editingTask) {
      this.editingTask.status = 'completed';
      this.editingTask.completedDate = new Date();
      electronAPI.tasks.save(this.editingTask).then(() => {
        this.showToast('任务已标记完成', 'success');
        this.renderReminders();
      });
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
      try {
        const keyFiles = await electronAPI.dialog.openFile();
        if (keyFiles && keyFiles.length > 0) {
          for (const cert of this.certificates) {
            for (const keyFile of keyFiles) {
              try {
                const isMatch = await electronAPI.check.keyMatch(cert.filePath, keyFile);
                results.push({
                  type: 'key_match',
                  severity: isMatch ? 'info' : 'warning',
                  certificateId: cert.id,
                  certificateName: cert.name,
                  message: isMatch ? `✅ 私钥匹配成功` : `❌ 私钥不匹配`,
                  details: `证书: ${cert.name}\n私钥文件: ${keyFile}`,
                  suggestion: isMatch ? '证书和私钥匹配正确' : '该私钥不是此证书的正确私钥，请检查私钥文件'
                });
              } catch (err) {
                console.error(`Key match check failed for ${cert.name}:`, err);
                results.push({
                  type: 'key_match',
                  severity: 'warning',
                  certificateId: cert.id,
                  certificateName: cert.name,
                  message: `❌ 无法验证私钥匹配`,
                  details: `证书: ${cert.name}\n私钥文件: ${keyFile}\n错误: ${err}`,
                  suggestion: '无法读取私钥文件，请确保文件格式正确'
                });
              }
            }
          }
        } else {
          this.showToast('请选择私钥文件', 'warning');
        }
      } catch (error) {
        console.error('Failed to select key files:', error);
        this.showToast('选择私钥文件失败', 'error');
      }
    }

    this.renderCheckResultsList(results);
    this.showToast(`检查完成，发现 ${results.length} 个问题`, results.length > 0 ? 'warning' : 'success');
  }

  private renderCheckResults() {
    const container = document.getElementById('checkResults');
    if (container) {
      container.innerHTML = '<div class="empty-state"><p>点击"运行检查"开始验证</p></div>';
    }
  }

  private renderCheckResultsList(results: CheckResult[]) {
    const container = document.getElementById('checkResults');
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

  private renderPasswords() {
    const list = document.getElementById('passwordsList');
    if (!list) return;

    if (this.passwords.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>暂无保存的密码</p></div>';
      return;
    }

    list.innerHTML = this.passwords.map(entry => `<div class="password-item"><div class="password-icon">🔑</div><div class="password-info"><div class="password-name">${this.escapeHtml(entry.name)}</div><div class="password-meta"><span>创建: ${new Date(entry.createdDate).toLocaleDateString()}</span>${entry.relatedCertificateId ? `<span>关联证书: ${this.getCertificateName(entry.relatedCertificateId)}</span>` : ''}</div></div><div class="password-value"><span class="password-dots">••••••••</span><button class="btn btn-sm btn-secondary" onclick="app.copyPassword('${entry.id}')">复制</button></div><div class="password-actions"><button class="btn btn-sm btn-secondary" onclick="app.editPassword('${entry.id}')">编辑</button><button class="btn btn-sm btn-danger" onclick="app.deletePassword('${entry.id}')">删除</button></div></div>`).join('');
  }

  private getCertificateName(certId: string): string {
    const cert = this.certificates.find(c => c.id === certId);
    return cert ? cert.name : '未知证书';
  }

  private showPasswordModal(entry?: PasswordEntry) {
    this.editingPassword = entry || null;
    document.querySelector('#modalPassword h3')!.textContent = entry ? '编辑密码' : '添加密码';
    (document.getElementById('passwordName') as HTMLInputElement).value = entry?.name || '';
    (document.getElementById('passwordValue') as HTMLInputElement).value = entry?.password || '';
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

    if (!name || !password) {
      this.showToast('请填写名称和密码', 'warning');
      return;
    }

    const entry: PasswordEntry = {
      id: this.editingPassword?.id || this.generateId(),
      name,
      password,
      relatedCertificateId: certId || undefined,
      notes,
      createdDate: this.editingPassword?.createdDate || new Date(),
      modifiedDate: new Date()
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
    const entry = this.passwords.find(p => p.id === id);
    if (entry) {
      await navigator.clipboard.writeText(entry.password);
      this.showToast('密码已复制到剪贴板', 'success');
      setTimeout(() => {
        navigator.clipboard.writeText('');
      }, 30000);
    }
  }

  public editPassword(id: string) {
    const entry = this.passwords.find(p => p.id === id);
    if (entry) {
      this.showPasswordModal(entry);
    }
  }

  public async deletePassword(id: string) {
    if (!confirm('确定要删除此密码吗？')) return;
    try {
      await electronAPI.passwords.delete(id);
      this.passwords = this.passwords.filter(p => p.id !== id);
      this.renderPasswords();
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

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

(window as any).app = new CertManagerApp();
