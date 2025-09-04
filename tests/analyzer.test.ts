import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import { 
  OpenAPIAnalyzer, 
  type ApiSummary,
  type SearchResult,
  type ApiStats,
  type Inconsistency,
  type SchemaComparison
} from '../src/index';

// Mock fs module
vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

// Mock console methods to avoid cluttering test output
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('OpenAPIAnalyzer', () => {
  let analyzer: OpenAPIAnalyzer;

  beforeEach(() => {
    analyzer = new OpenAPIAnalyzer();
    vi.clearAllMocks();
    mockConsoleError.mockClear();
    process.env.OPENAPI_SPECS_FOLDER = '/test/folder';
  });

  afterEach(() => {
    delete process.env.OPENAPI_SPECS_FOLDER;
  });

  describe('loadSpecs', () => {
    it('should load valid OpenAPI specifications', async () => {
      const sampleApiContent = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: { summary: 'Get users' }
          }
        }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['sample-api.json', 'other-file.txt'] as any);
      mockedFs.readFile.mockResolvedValue(sampleApiContent);

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(1);
      expect(specs[0].filename).toBe('sample-api.json');
      expect(specs[0].title).toBe('Test API');
    });

    it('should skip invalid JSON files', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['invalid.json'] as any);
      mockedFs.readFile.mockResolvedValue('invalid json content');

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(0);
      expect(mockConsoleError).toHaveBeenCalledWith('⚠️  Skipping invalid.json: Invalid JSON format');
    });

    it('should skip files without openapi or swagger field', async () => {
      const invalidApiContent = JSON.stringify({
        title: 'Not an OpenAPI spec',
        paths: {}
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['invalid-api.json'] as any);
      mockedFs.readFile.mockResolvedValue(invalidApiContent);

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(0);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Skipping invalid-api.json: Not an OpenAPI/Swagger specification')
      );
    });

    it('should load specs with swagger field', async () => {
      const swaggerApiContent = JSON.stringify({
        swagger: '2.0',
        info: { title: 'Swagger API', version: '1.0.0' },
        paths: {
          '/test': {
            get: { summary: 'Test endpoint' }
          }
        }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['swagger-api.json'] as any);
      mockedFs.readFile.mockResolvedValue(swaggerApiContent);

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(1);
      expect(specs[0].title).toBe('Swagger API');
    });

    it('should handle specs without info section', async () => {
      const apiWithoutInfo = JSON.stringify({
        openapi: '3.0.0',
        paths: {
          '/test': {
            get: { summary: 'Test' }
          }
        }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['no-info.json'] as any);
      mockedFs.readFile.mockResolvedValue(apiWithoutInfo);

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(1);
      expect(specs[0].title).toBe('No title');
      expect(mockConsoleError).toHaveBeenCalledWith(
        "⚠️  Warning: no-info.json missing 'info' section, but will be loaded"
      );
    });

    it('should handle specs with no paths', async () => {
      const apiWithoutPaths = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'No Paths API', version: '1.0.0' }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['no-paths.json'] as any);
      mockedFs.readFile.mockResolvedValue(apiWithoutPaths);

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(1);
      expect(specs[0].endpointCount).toBe(0);
      expect(mockConsoleError).toHaveBeenCalledWith(
        '⚠️  Warning: no-paths.json has no paths defined'
      );
    });
  });

  describe('listAllSpecs', () => {
    it('should return empty array when no specs loaded', () => {
      const result: ApiSummary[] = analyzer.listAllSpecs();
      expect(result).toEqual([]);
    });

    it('should return spec summaries', async () => {
      const apiContent = JSON.stringify({
        openapi: '3.0.0',
        info: { 
          title: 'Test API', 
          version: '1.0.0',
          description: 'Test description'
        },
        paths: {
          '/users': { get: {} },
          '/posts': { get: {}, post: {} }
        }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['test.json'] as any);
      mockedFs.readFile.mockResolvedValue(apiContent);

      await analyzer.loadSpecs();
      const result: ApiSummary[] = analyzer.listAllSpecs();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        filename: 'test.json',
        title: 'Test API',
        version: '1.0.0',
        description: 'Test description',
        endpointCount: 2
      });
    });
  });

  describe('getSpecByFilename', () => {
    it('should return null for non-existent spec', () => {
      const result = analyzer.getSpecByFilename('nonexistent.json');
      expect(result).toBeNull();
    });

    it('should return the correct spec', async () => {
      const apiContent = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['test.json'] as any);
      mockedFs.readFile.mockResolvedValue(apiContent);

      await analyzer.loadSpecs();
      const result = analyzer.getSpecByFilename('test.json');

      expect(result).toEqual({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      });
    });
  });

  describe('searchEndpoints', () => {
    beforeEach(async () => {
      const apiContent = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: { 
              summary: 'Get all users',
              description: 'Retrieve list of users',
              operationId: 'getUsers'
            },
            post: {
              summary: 'Create user',
              description: 'Create a new user',
              operationId: 'createUser'
            }
          },
          '/posts': {
            get: {
              summary: 'Get posts',
              description: 'Retrieve blog posts',
              operationId: 'getPosts'
            }
          }
        }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['test.json'] as any);
      mockedFs.readFile.mockResolvedValue(apiContent);

      await analyzer.loadSpecs();
    });

    it('should find endpoints by path', () => {
      const results: SearchResult[] = analyzer.searchEndpoints('users');
      expect(results).toHaveLength(2);
      expect(results[0].path).toBe('/users');
      expect(results[1].path).toBe('/users');
      expect(results[0].method).toBe('GET');
      expect(results[1].method).toBe('POST');
    });

    it('should find endpoints by method', () => {
      const results: SearchResult[] = analyzer.searchEndpoints('get');
      expect(results).toHaveLength(2);
      expect(results.every(r => r.method === 'GET')).toBe(true);
    });

    it('should find endpoints by summary', () => {
      const results: SearchResult[] = analyzer.searchEndpoints('blog posts');
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('/posts');
      expect(results[0].operationId).toBe('getPosts');
    });

    it('should find endpoints by operation ID', () => {
      const results: SearchResult[] = analyzer.searchEndpoints('createUser');
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('/users');
      expect(results[0].method).toBe('POST');
    });

    it('should return empty array for no matches', () => {
      const results: SearchResult[] = analyzer.searchEndpoints('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should be case insensitive', () => {
      const results: SearchResult[] = analyzer.searchEndpoints('USERS');
      expect(results).toHaveLength(2);
    });
  });

  describe('getApiStats', () => {
    it('should return empty stats for no specs', () => {
      const stats: ApiStats = analyzer.getApiStats();
      expect(stats.totalApis).toBe(0);
      expect(stats.totalEndpoints).toBe(0);
      expect(stats.apis).toHaveLength(0);
      expect(stats.methodCounts).toEqual({});
      expect(stats.commonPaths).toEqual({});
      expect(stats.versions).toEqual({});
    });

    it('should calculate correct statistics', async () => {
      const apiContent = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {},
            post: {}
          },
          '/users/{id}': {
            get: {},
            put: {},
            delete: {}
          },
          '/posts/{postId}/comments': {
            get: {},
            post: {}
          }
        }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['test.json'] as any);
      mockedFs.readFile.mockResolvedValue(apiContent);

      await analyzer.loadSpecs();
      const stats: ApiStats = analyzer.getApiStats();

      expect(stats.totalApis).toBe(1);
      expect(stats.totalEndpoints).toBe(7);
      expect(stats.methodCounts).toEqual({
        GET: 3,
        POST: 2,
        PUT: 1,
        DELETE: 1
      });
      expect(stats.commonPaths).toEqual({
        '/users': 1,
        '/users/{id}': 1,
        '/posts/{id}/comments': 1
      });
      expect(stats.versions).toEqual({
        '1.0.0': 1
      });
      expect(stats.apis).toHaveLength(1);
      expect(stats.apis[0].methods).toEqual(['DELETE', 'GET', 'POST', 'PUT']);
    });

    it('should handle multiple APIs with different versions', async () => {
      const api1Content = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        paths: { '/users': { get: {}, post: {} } }
      });

      const api2Content = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API 2', version: '2.0.0' },
        paths: { '/products': { get: {} } }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['api1.json', 'api2.json'] as any);
      mockedFs.readFile
        .mockResolvedValueOnce(api1Content)
        .mockResolvedValueOnce(api2Content);

      await analyzer.loadSpecs();
      const stats: ApiStats = analyzer.getApiStats();

      expect(stats.totalApis).toBe(2);
      expect(stats.totalEndpoints).toBe(3);
      expect(stats.versions).toEqual({
        '1.0.0': 1,
        '2.0.0': 1
      });
    });
  });

  describe('findInconsistencies', () => {
    it('should find authentication inconsistencies', async () => {
      const api1Content = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer' }
          }
        }
      });

      const api2Content = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API 2', version: '1.0.0' },
        components: {
          securitySchemes: {
            apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' }
          }
        }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['api1.json', 'api2.json'] as any);
      mockedFs.readFile
        .mockResolvedValueOnce(api1Content)
        .mockResolvedValueOnce(api2Content);

      await analyzer.loadSpecs();
      const inconsistencies: Inconsistency[] = analyzer.findInconsistencies();

      expect(inconsistencies).toHaveLength(1);
      expect(inconsistencies[0].type).toBe('authentication');
      expect(inconsistencies[0].message).toContain('Multiple authentication schemes');
      expect(inconsistencies[0].details).toHaveProperty('http');
      expect(inconsistencies[0].details).toHaveProperty('apiKey');
    });

    it('should return no inconsistencies for consistent auth', async () => {
      const api1Content = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer' }
          }
        }
      });

      const api2Content = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API 2', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerToken: { type: 'http', scheme: 'bearer' }
          }
        }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['api1.json', 'api2.json'] as any);
      mockedFs.readFile
        .mockResolvedValueOnce(api1Content)
        .mockResolvedValueOnce(api2Content);

      await analyzer.loadSpecs();
      const inconsistencies: Inconsistency[] = analyzer.findInconsistencies();

      expect(inconsistencies).toHaveLength(0);
    });

    it('should return no inconsistencies when no security schemes exist', async () => {
      const apiContent = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: { '/test': { get: {} } }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['api.json'] as any);
      mockedFs.readFile.mockResolvedValue(apiContent);

      await analyzer.loadSpecs();
      const inconsistencies: Inconsistency[] = analyzer.findInconsistencies();

      expect(inconsistencies).toHaveLength(0);
    });
  });

  describe('compareSchemas', () => {
    beforeEach(async () => {
      const api1Content = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                email: { type: 'string' }
              }
            },
            Product: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' }
              }
            }
          }
        }
      });

      const api2Content = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'API 2', version: '1.0.0' },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string' },
                email: { type: 'string' }
              }
            }
          }
        }
      });

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['api1.json', 'api2.json'] as any);
      mockedFs.readFile
        .mockResolvedValueOnce(api1Content)
        .mockResolvedValueOnce(api2Content);

      await analyzer.loadSpecs();
    });

    it('should compare single schema across APIs', () => {
      const results: SchemaComparison[] = analyzer.compareSchemas('User', '');
      expect(results).toHaveLength(2);
      expect(results.every(r => r.schemaName === 'User')).toBe(true);
      
      const api1Result = results.find(r => r.api === 'API 1');
      const api2Result = results.find(r => r.api === 'API 2');
      
      expect(api1Result).toBeDefined();
      expect(api2Result).toBeDefined();
      expect(api1Result!.schema.properties.name).toBeDefined();
      expect(api2Result!.schema.properties.username).toBeDefined();
    });

    it('should compare two different schemas', () => {
      const results: SchemaComparison[] = analyzer.compareSchemas('User', 'Product');
      expect(results).toHaveLength(3); // User from both APIs + Product from API 1
      
      const userResults = results.filter(r => r.schemaName === 'User');
      const productResults = results.filter(r => r.schemaName === 'Product');
      
      expect(userResults).toHaveLength(2);
      expect(productResults).toHaveLength(1);
    });

    it('should return empty array for non-existent schema', () => {
      const results: SchemaComparison[] = analyzer.compareSchemas('NonExistent', '');
      expect(results).toHaveLength(0);
    });

    it('should handle APIs without components/schemas', async () => {
      const apiWithoutSchemas = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Simple API', version: '1.0.0' },
        paths: { '/test': { get: {} } }
      });

      mockedFs.readdir.mockResolvedValue(['simple.json'] as any);
      mockedFs.readFile.mockResolvedValue(apiWithoutSchemas);

      const simpleAnalyzer = new OpenAPIAnalyzer();
      await simpleAnalyzer.loadSpecs();
      
      const results: SchemaComparison[] = simpleAnalyzer.compareSchemas('User', '');
      expect(results).toHaveLength(0);
    });
  });
});

describe('OpenAPIAnalyzer validation', () => {
  let validationAnalyzer: OpenAPIAnalyzer;

  beforeEach(() => {
    validationAnalyzer = new OpenAPIAnalyzer();
  });

  it('should throw error for missing environment variable', async () => {
    delete process.env.OPENAPI_SPECS_FOLDER;
    
    await expect(validationAnalyzer.loadSpecs()).rejects.toThrow('OPENAPI_SPECS_FOLDER environment variable is required');
  });

  it('should throw error for non-existent directory', async () => {
    process.env.OPENAPI_SPECS_FOLDER = '/non/existent/path';
    mockedFs.stat.mockRejectedValue({ code: 'ENOENT' });
    
    await expect(validationAnalyzer.loadSpecs()).rejects.toThrow('OPENAPI_SPECS_FOLDER does not exist: /non/existent/path');
  });

  it('should throw error for non-directory path', async () => {
    process.env.OPENAPI_SPECS_FOLDER = '/path/to/file';
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => false
    } as any);
    
    await expect(validationAnalyzer.loadSpecs()).rejects.toThrow('OPENAPI_SPECS_FOLDER is not a directory: /path/to/file');
  });

  it('should throw error for permission denied', async () => {
    process.env.OPENAPI_SPECS_FOLDER = '/protected/path';
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => true
    } as any);
    mockedFs.access.mockRejectedValue({ code: 'EACCES' });
    
    await expect(validationAnalyzer.loadSpecs()).rejects.toThrow('No read permission for OPENAPI_SPECS_FOLDER: /protected/path');
  });
});