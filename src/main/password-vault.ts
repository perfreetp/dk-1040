import * as crypto from 'crypto';
import { DataStore } from './data-store';

export class PasswordVault {
  private dataStore: DataStore;
  private masterPasswordHash: string | null = null;

  constructor() {
    this.dataStore = new DataStore();
  }

  setMasterPassword(password: string): void {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    this.masterPasswordHash = salt.toString('hex') + ':' + hash.toString('hex');
    this.dataStore.setMasterPasswordHash(this.masterPasswordHash);
  }

  verifyMasterPassword(password: string): boolean {
    const storedHash = this.dataStore.getMasterPasswordHash();
    if (!storedHash) return false;

    const [saltHex, hashHex] = storedHash.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const storedHashBuffer = Buffer.from(hashHex, 'hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');

    return crypto.timingSafeEqual(storedHashBuffer, hash);
  }

  isMasterPasswordSet(): boolean {
    return this.dataStore.getMasterPasswordHash() !== null;
  }

  encrypt(data: string, password: string): string {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(data: string, password: string): string {
    const parts = data.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = parts[3];

    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
