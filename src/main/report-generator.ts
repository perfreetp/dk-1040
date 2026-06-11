import { Certificate, CheckResult, InventoryReport } from '../shared/types';

export class ReportGenerator {
  generateReport(certs: Certificate[]): InventoryReport {
    const now = new Date();
    const validCerts = certs.filter(c => c.notAfter > now);
    const expiringCerts = certs.filter(c => {
      const daysUntilExpiry = this.getDaysUntilExpiry(c.notAfter);
      return daysUntilExpiry > 0 && daysUntilExpiry <= 60;
    });
    const expiredCerts = certs.filter(c => c.notAfter <= now);

    return {
      generatedDate: now,
      totalCertificates: certs.length,
      validCertificates: validCerts.length,
      expiringCertificates: expiringCerts.length,
      expiredCertificates: expiredCerts.length,
      certificates: certs,
      checkResults: []
    };
  }

  checkDuplicates(certs: Certificate[]): CheckResult[] {
    const results: CheckResult[] = [];
    const seen = new Map<string, Certificate[]>();

    certs.forEach(cert => {
      const key = cert.fingerprint.sha256;
      if (seen.has(key)) {
        seen.get(key)!.push(cert);
      } else {
        seen.set(key, [cert]);
      }
    });

    seen.forEach((certs, fingerprint) => {
      if (certs.length > 1) {
        certs.forEach(cert => {
          results.push({
            type: 'duplicate',
            severity: 'warning',
            certificateId: cert.id,
            certificateName: cert.name,
            message: `Duplicate certificate found (SHA-256: ${fingerprint})`,
            details: `Found ${certs.length} certificates with the same fingerprint`,
            suggestion: 'Review if multiple copies are needed or remove duplicates'
          });
        });
      }
    });

    return results;
  }

  checkExpired(certs: Certificate[]): CheckResult[] {
    const results: CheckResult[] = [];
    const now = new Date();

    certs.forEach(cert => {
      if (cert.notAfter <= now) {
        results.push({
          type: 'expired',
          severity: 'error',
          certificateId: cert.id,
          certificateName: cert.name,
          message: 'Certificate has expired',
          details: `Expired on ${cert.notAfter.toLocaleDateString()}`,
          suggestion: 'Renew the certificate or remove from active use'
        });
      }
    });

    return results;
  }

  exportReport(report: InventoryReport, format: 'json' | 'csv' | 'html'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this.exportToCSV(report);
      case 'html':
        return this.exportToHTML(report);
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  private exportToCSV(report: InventoryReport): string {
    const headers = [
      'Name', 'Subject', 'Issuer', 'Valid From', 'Valid To',
      'SHA-256 Fingerprint', 'Key Usage', 'File Path', 'Project'
    ];

    const rows = report.certificates.map(cert => [
      cert.name,
      cert.subject,
      cert.issuer,
      cert.notBefore.toISOString(),
      cert.notAfter.toISOString(),
      cert.fingerprint.sha256,
      cert.keyUsage.join('; '),
      cert.filePath,
      cert.projectId
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  private exportToHTML(report: InventoryReport): string {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Certificate Inventory Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #1890ff; }
    .summary { background: #f0f2f5; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
    .summary-item { display: inline-block; margin-right: 30px; }
    .summary-value { font-size: 24px; font-weight: bold; color: #262626; }
    .summary-label { font-size: 14px; color: #8c8c8c; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #d9d9d9; padding: 12px; text-align: left; }
    th { background: #fafafa; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    tr:hover { background: #e6f7ff; }
    .status-valid { color: #52c41a; }
    .status-warning { color: #faad14; }
    .status-expired { color: #ff4d4f; }
    .footer { margin-top: 30px; color: #8c8c8c; font-size: 12px; }
  </style>
</head>
<body>
  <h1>证书盘点报告</h1>
  <div class="summary">
    <div class="summary-item">
      <div class="summary-value">${report.totalCertificates}</div>
      <div class="summary-label">总数</div>
    </div>
    <div class="summary-item">
      <div class="summary-value status-valid">${report.validCertificates}</div>
      <div class="summary-label">有效</div>
    </div>
    <div class="summary-item">
      <div class="summary-value status-warning">${report.expiringCertificates}</div>
      <div class="summary-label">即将过期</div>
    </div>
    <div class="summary-item">
      <div class="summary-value status-expired">${report.expiredCertificates}</div>
      <div class="summary-label">已过期</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>证书名称</th>
        <th>主题</th>
        <th>颁发者</th>
        <th>有效期</th>
        <th>状态</th>
        <th>用途</th>
      </tr>
    </thead>
    <tbody>
      ${report.certificates.map(cert => {
        const now = new Date();
        const daysLeft = this.getDaysUntilExpiry(cert.notAfter);
        let statusClass = 'status-valid';
        let statusText = '有效';

        if (cert.notAfter <= now) {
          statusClass = 'status-expired';
          statusText = '已过期';
        } else if (daysLeft <= 7) {
          statusClass = 'status-expired';
          statusText = `剩余${daysLeft}天`;
        } else if (daysLeft <= 30) {
          statusClass = 'status-warning';
          statusText = `剩余${daysLeft}天`;
        } else if (daysLeft <= 60) {
          statusClass = 'status-warning';
          statusText = `剩余${daysLeft}天`;
        }

        return `<tr>
          <td>${cert.name}</td>
          <td>${cert.subject}</td>
          <td>${cert.issuer}</td>
          <td>${cert.notBefore.toLocaleDateString()} - ${cert.notAfter.toLocaleDateString()}</td>
          <td class="${statusClass}">${statusText}</td>
          <td>${cert.keyUsage.join(', ') || cert.extendedKeyUsage.join(', ') || 'N/A'}</td>
        </tr>`;
      }).join('\n')}
    </tbody>
  </table>
  <div class="footer">
    生成时间: ${report.generatedDate.toLocaleString()}
  </div>
</body>
</html>`;

    return html;
  }

  private getDaysUntilExpiry(date: Date): number {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
