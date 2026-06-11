import * as fs from 'fs';
import * as path from 'path';

const CERT_EXTENSIONS = ['.cer', '.crt', '.pem', '.der', '.pfx', '.p12'];

export class FileManager {
  async scanDirectory(dirPath: string): Promise<string[]> {
    const results: string[] = [];

    const scan = async (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scan(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (CERT_EXTENSIONS.includes(ext)) {
              results.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error);
      }
    };

    await scan(dirPath);
    return results;
  }

  async importCertificate(filePath: string): Promise<string> {
    return filePath;
  }

  async batchImport(filePaths: string[]): Promise<string[]> {
    return filePaths.filter(filePath => {
      const ext = path.extname(filePath).toLowerCase();
      return CERT_EXTENSIONS.includes(ext);
    });
  }
}
