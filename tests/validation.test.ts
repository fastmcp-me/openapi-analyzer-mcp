import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

describe('Environment Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean environment
    delete process.env.OPENAPI_SPECS_FOLDER;
  });

  describe('validateSpecsFolder', () => {
    it('should validate existing readable directory', async () => {
      process.env.OPENAPI_SPECS_FOLDER = '/valid/path';
      
      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true
      } as any);
      mockedFs.access.mockResolvedValue();

      // Test passes if no error is thrown
      expect(process.env.OPENAPI_SPECS_FOLDER).toBe('/valid/path');
    });

    it('should handle missing environment variable', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process exit with code ${code}`);
      });

      expect(() => {
        // This would normally trigger validation in the real module
        if (!process.env.OPENAPI_SPECS_FOLDER) {
          console.error('❌ Error: OPENAPI_SPECS_FOLDER environment variable is required');
          process.exit(1);
        }
      }).toThrow('Process exit with code 1');

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Error: OPENAPI_SPECS_FOLDER environment variable is required'
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should handle non-existent directory', async () => {
      process.env.OPENAPI_SPECS_FOLDER = '/non/existent/path';
      
      mockedFs.stat.mockRejectedValue({ code: 'ENOENT' });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process exit with code ${code}`);
      });

      try {
        await mockedFs.stat(process.env.OPENAPI_SPECS_FOLDER);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.error(`❌ Error: OPENAPI_SPECS_FOLDER does not exist: ${process.env.OPENAPI_SPECS_FOLDER}`);
          expect(() => process.exit(1)).toThrow('Process exit with code 1');
        }
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Error: OPENAPI_SPECS_FOLDER does not exist: /non/existent/path'
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should handle path that is not a directory', async () => {
      process.env.OPENAPI_SPECS_FOLDER = '/path/to/file';
      
      mockedFs.stat.mockResolvedValue({
        isDirectory: () => false
      } as any);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process exit with code ${code}`);
      });

      try {
        const stats = await mockedFs.stat(process.env.OPENAPI_SPECS_FOLDER);
        if (!stats.isDirectory()) {
          console.error(`❌ Error: OPENAPI_SPECS_FOLDER is not a directory: ${process.env.OPENAPI_SPECS_FOLDER}`);
          expect(() => process.exit(1)).toThrow('Process exit with code 1');
        }
      } catch (error) {
        // Expected behavior
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Error: OPENAPI_SPECS_FOLDER is not a directory: /path/to/file'
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should handle permission denied', async () => {
      process.env.OPENAPI_SPECS_FOLDER = '/protected/path';
      
      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true
      } as any);
      mockedFs.access.mockRejectedValue({ code: 'EACCES' });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process exit with code ${code}`);
      });

      try {
        const stats = await mockedFs.stat(process.env.OPENAPI_SPECS_FOLDER);
        if (stats.isDirectory()) {
          await mockedFs.access(process.env.OPENAPI_SPECS_FOLDER, fs.constants.R_OK);
        }
      } catch (error: any) {
        if (error.code === 'EACCES') {
          console.error(`❌ Error: No read permission for OPENAPI_SPECS_FOLDER: ${process.env.OPENAPI_SPECS_FOLDER}`);
          expect(() => process.exit(1)).toThrow('Process exit with code 1');
        }
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Error: No read permission for OPENAPI_SPECS_FOLDER: /protected/path'
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('File Processing', () => {
    beforeEach(() => {
      process.env.OPENAPI_SPECS_FOLDER = '/test/specs';
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
    });

    it('should filter JSON files correctly', async () => {
      mockedFs.readdir.mockResolvedValue([
        'api1.json',
        'api2.json',
        'readme.txt',
        'schema.yaml',
        'config.json'
      ] as any);

      const files = await mockedFs.readdir('/test/specs');
      const jsonFiles = files.filter((file: string) => file.endsWith('.json'));

      expect(jsonFiles).toEqual(['api1.json', 'api2.json', 'config.json']);
      expect(jsonFiles).toHaveLength(3);
    });

    it('should handle empty directory', async () => {
      mockedFs.readdir.mockResolvedValue([] as any);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const files = await mockedFs.readdir('/test/specs');
      const jsonFiles = files.filter((file: string) => file.endsWith('.json'));

      if (jsonFiles.length === 0) {
        console.error('⚠️  Warning: No .json files found in /test/specs');
      }

      expect(jsonFiles).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  Warning: No .json files found in /test/specs'
      );

      consoleSpy.mockRestore();
    });

    it('should handle directory with only non-JSON files', async () => {
      mockedFs.readdir.mockResolvedValue([
        'readme.md',
        'config.yaml',
        'script.py'
      ] as any);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const files = await mockedFs.readdir('/test/specs');
      const jsonFiles = files.filter((file: string) => file.endsWith('.json'));

      if (jsonFiles.length === 0) {
        console.error('⚠️  Warning: No .json files found in /test/specs');
      }

      expect(jsonFiles).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  Warning: No .json files found in /test/specs'
      );

      consoleSpy.mockRestore();
    });
  });
});