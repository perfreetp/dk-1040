import * as crypto from 'crypto';
import { DataStore } from './data-store';
import { PasswordEntry } from '../shared/types';

export class PasswordVault {
  private dataStore: DataStore;
  private masterPasswordHash: string | null = null;
  private isUnlocked: boolean = false;
  private currentMasterPassword: string | null = null;

  constructor() {
    this.dataStore = new DataStore();
  }

  setMasterPassword(password: string): void {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    this.masterPasswordHash = salt.toString('hex') + ':' + hash.toString('hex');
    this.dataStore.setMasterPasswordHash(this.masterPasswordHash);
    this.isUnlocked = true;
    this.currentMasterPassword = password;
  }

  verifyMasterPassword(password: string): boolean {
    const storedHash = this.dataStore.getMasterPasswordHash();
    if (!storedHash) return false;

    try {
      const [saltHex, hashHex] = storedHash.split(':');
      const salt = Buffer.from(saltHex, 'hex');
      const storedHashBuffer = Buffer.from(hashHex, 'hex');
      const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');

      const result = crypto.timingSafeEqual(storedHashBuffer, hash);
      if (result) {
        this.isUnlocked = true;
        this.currentMasterPassword = password;
      }
      return result;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  isMasterPasswordSet(): boolean {
    return this.dataStore.getMasterPasswordHash() !== null;
  }

  isVaultUnlocked(): boolean {
    return this.isUnlocked;
  }

  lockVault(): void {
    this.isUnlocked = false;
    this.currentMasterPassword = null;
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

    try {
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
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  async savePassword(entry: PasswordEntry): Promise<void> {
    if (!this.isUnlocked || !this.currentMasterPassword) {
      throw new Error('Vault is locked');
    }

    const entries = await this.dataStore.getPasswords();
    entry.password = this.encrypt(entry.password, this.currentMasterPassword);
    entry.modifiedDate = new Date();

    const index = entries.findIndex(e => e.id === entry.id);
    if (index >= 0) {
      entries[index] = entry;
    } else {
      entries.push(entry);
    }

    await this.dataStore.savePasswords(entries);
  }

  async getPasswords(): Promise<PasswordEntry[]> {
    if (!this.isUnlocked || !this.currentMasterPassword) {
      return [];
    }

    const entries = await this.dataStore.getPasswords();
    return entries.map(entry => ({
      ...entry,
      password: '********'
    }));
  }

  async getDecryptedPassword(id: string): Promise<string> {
    if (!this.isUnlocked || !this.currentMasterPassword) {
      throw new Error('Vault is locked');
    }

    const entries = await this.dataStore.getPasswords();
    const entry = entries.find(e => e.id === id);
    if (!entry) {
      throw new Error('Password not found');
    }

    return this.decrypt(entry.password, this.currentMasterPassword);
  }

  async deletePassword(id: string): Promise<void> {
    if (!this.isUnlocked) {
      throw new Error('Vault is locked');
    }

    const entries = await this.dataStore.getPasswords();
    const filtered = entries.filter(e => e.id !== id);
    await this.dataStore.savePasswords(filtered);
  }
}
