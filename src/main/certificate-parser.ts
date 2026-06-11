import * as forge from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Certificate } from '../shared/types';

export class CertificateParser {
  async parseCertificate(filePath: string, password?: string): Promise<Certificate> {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let cert: forge.pki.Certificate;
    let fileFormat: string;

    try {
      if (ext === '.pfx' || ext === '.p12') {
        const p12Der = forge.util.createBuffer(content.toString('binary'));
        const p12Asn1 = forge.asn1.fromDer(p12Der);
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password || '');
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const bags = certBags[forge.pki.oids.certBag];
        if (!bags || !bags[0]) {
          throw new Error('No certificate found in P12 file');
        }
        const certBag = bags[0];
        cert = certBag.cert as forge.pki.Certificate;
        fileFormat = 'PKCS#12';
      } else if (ext === '.pem') {
        const pemContent = content.toString('utf-8');
        const certMatch = pemContent.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
        if (certMatch) {
          const cert_pem = certMatch[0];
          cert = forge.pki.certificateFromPem(cert_pem);
          fileFormat = 'PEM';
        } else {
          throw new Error('No valid certificate found in PEM file');
        }
      } else {
        const asn1Buffer = forge.util.createBuffer(content.toString('binary'));
        const asn1 = forge.asn1.fromDer(asn1Buffer);
        cert = forge.pki.certificateFromAsn1(asn1);
        fileFormat = ext === '.der' ? 'DER' : 'Unknown';
      }
    } catch (error) {
      throw new Error(`Failed to parse certificate: ${error}`);
    }

    return this.convertToCertificate(cert, filePath, fileFormat);
  }

  private convertToCertificate(cert: forge.pki.Certificate, filePath: string, fileFormat: string): Certificate {
    const subject = this.formatDN(cert.subject);
    const issuer = this.formatDN(cert.issuer);
    const serialNumber = cert.serialNumber;
    const notBefore = cert.validity.notBefore;
    const notAfter = cert.validity.notAfter;

    const asn1Bytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();

    const md1 = forge.md.sha1.create();
    md1.update(asn1Bytes);
    const sha1Fingerprint = md1.digest().toHex().toUpperCase();

    const md256 = forge.md.sha256.create();
    md256.update(asn1Bytes);
    const sha256Fingerprint = md256.digest().toHex().toUpperCase();

    const publicKeyInfo = cert.publicKey as forge.pki.rsa.PublicKey;
    const publicKeyAlgorithm = publicKeyInfo ? 'RSA' : 'Unknown';
    const signatureAlgorithm = forge.pki.oids[cert.signatureOid] || cert.signatureOid;

    const keyUsage: string[] = [];
    const extensions: any[] = cert.extensions || [];
    extensions.forEach((ext: any) => {
      if (ext.name === 'keyUsage') {
        if (ext.digitalSignature) keyUsage.push('Digital Signature');
        if (ext.nonRepudiation) keyUsage.push('Non Repudiation');
        if (ext.keyEncipherment) keyUsage.push('Key Encipherment');
        if (ext.dataEncipherment) keyUsage.push('Data Encipherment');
        if (ext.keyAgreement) keyUsage.push('Key Agreement');
        if (ext.keyCertSign) keyUsage.push('Certificate Sign');
        if (ext.cRLSign) keyUsage.push('CRL Sign');
      }
    });

    const extendedKeyUsage: string[] = [];
    extensions.forEach((ext: any) => {
      if (ext.name === 'extKeyUsage') {
        if (ext.serverAuth) extendedKeyUsage.push('Server Authentication');
        if (ext.clientAuth) extendedKeyUsage.push('Client Authentication');
        if (ext.codeSigning) extendedKeyUsage.push('Code Signing');
        if (ext.emailProtection) extendedKeyUsage.push('Email Protection');
        if (ext.timeStamping) extendedKeyUsage.push('Time Stamping');
      }
    });

    const name = this.extractCN(subject) || path.basename(filePath);

    return {
      id: uuidv4(),
      name,
      subject,
      issuer,
      serialNumber,
      notBefore,
      notAfter,
      fingerprint: {
        sha1: sha1Fingerprint,
        sha256: sha256Fingerprint
      },
      keyUsage,
      extendedKeyUsage,
      publicKeyAlgorithm,
      signatureAlgorithm,
      filePath,
      fileFormat,
      projectId: '',
      notes: '',
      responsiblePerson: '',
      importDate: new Date(),
      sourceType: filePath.startsWith('\\\\') ? 'shared' : 'local'
    };
  }

  private formatDN(dn: any): string {
    const parts: string[] = [];
    const attributes = [
      { oid: '2.5.4.3', name: 'CN' },
      { oid: '2.5.4.6', name: 'C' },
      { oid: '2.5.4.7', name: 'L' },
      { oid: '2.5.4.8', name: 'ST' },
      { oid: '2.5.4.10', name: 'O' },
      { oid: '2.5.4.11', name: 'OU' }
    ];

    attributes.forEach(attr => {
      const value = dn.getField(attr.oid);
      if (value) {
        parts.push(`${attr.name}=${value.value}`);
      }
    });

    return parts.join(', ');
  }

  private extractCN(dn: string): string | null {
    const match = dn.match(/CN=([^,]+)/);
    return match ? match[1].trim() : null;
  }

  async checkKeyMatch(certPath: string, keyPath: string): Promise<boolean> {
    try {
      const certPem = fs.readFileSync(certPath, 'utf-8');
      let certificate: forge.pki.Certificate;

      if (certPath.toLowerCase().endsWith('.pem')) {
        const certMatch = certPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
        if (!certMatch) return false;
        certificate = forge.pki.certificateFromPem(certMatch[0]);
      } else {
        const content = fs.readFileSync(certPath);
        const asn1 = forge.asn1.fromDer(forge.util.createBuffer(content.toString('binary')));
        certificate = forge.pki.certificateFromAsn1(asn1);
      }

      const keyContent = fs.readFileSync(keyPath, 'utf-8');
      let privateKey: forge.pki.rsa.PrivateKey;
      let publicKey: forge.pki.rsa.PublicKey;

      if (keyContent.includes('-----BEGIN RSA PRIVATE KEY-----') || keyContent.includes('-----BEGIN PRIVATE KEY-----')) {
        privateKey = forge.pki.privateKeyFromPem(keyContent);
      } else {
        const keyBuffer = Buffer.from(keyContent, 'utf-8');
        const forgeBuffer = forge.util.createBuffer();
        forgeBuffer.putBytes(keyBuffer.toString('binary'));
        const keyAsn1 = forge.asn1.fromDer(forgeBuffer);
        privateKey = forge.pki.privateKeyFromAsn1(keyAsn1);
      }

      publicKey = certificate.publicKey as forge.pki.rsa.PublicKey;

      if (!publicKey || !privateKey) return false;

      const certModulus = (publicKey.n as any).toString(16);
      const keyModulus = (privateKey.n as any).toString(16);

      return certModulus === keyModulus;
    } catch (error) {
      console.error('Key match check error:', error);
      return false;
    }
  }

  async getCertificateChain(filePath: string): Promise<any[]> {
    try {
      const chain: any[] = [];
      const content = fs.readFileSync(filePath);
      let mainCert: forge.pki.Certificate;

      if (filePath.toLowerCase().endsWith('.pem')) {
        const pemContent = content.toString('utf-8');
        const certMatch = pemContent.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
        if (certMatch) {
          mainCert = forge.pki.certificateFromPem(certMatch[0]);
        } else {
          return [];
        }
      } else {
        const asn1 = forge.asn1.fromDer(forge.util.createBuffer(content.toString('binary')));
        mainCert = forge.pki.certificateFromAsn1(asn1);
      }

      chain.push({
        subject: this.formatDN(mainCert.subject),
        issuer: this.formatDN(mainCert.issuer),
        serialNumber: mainCert.serialNumber,
        notAfter: mainCert.validity.notAfter,
        isRoot: this.formatDN(mainCert.subject) === this.formatDN(mainCert.issuer),
        level: 0
      });

      let currentIssuer = mainCert.issuer;
      let currentCert = mainCert;
      let depth = 1;
      const maxDepth = 10;
      const seen = new Set<string>();

      while (depth < maxDepth) {
        const issuerStr = this.formatDN(currentIssuer);
        if (issuerStr === this.formatDN(currentCert.subject)) {
          break;
        }

        if (seen.has(issuerStr)) {
          break;
        }
        seen.add(issuerStr);

        const issuerCert = await this.findIssuerCert(currentCert, filePath);
        if (!issuerCert) {
          break;
        }

        chain.push({
          subject: this.formatDN(issuerCert.subject),
          issuer: this.formatDN(issuerCert.issuer),
          serialNumber: issuerCert.serialNumber,
          notAfter: issuerCert.validity.notAfter,
          isRoot: this.formatDN(issuerCert.subject) === this.formatDN(issuerCert.issuer),
          level: depth
        });

        currentIssuer = issuerCert.issuer;
        currentCert = issuerCert;
        depth++;
      }

      return chain;
    } catch (error) {
      console.error('Error getting certificate chain:', error);
      return [];
    }
  }

  private async findIssuerCert(cert: forge.pki.Certificate, certPath: string): Promise<forge.pki.Certificate | null> {
    return null;
  }
}
