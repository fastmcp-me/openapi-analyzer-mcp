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

// Mock swagger parser
vi.mock('@apidevtools/swagger-parser', () => ({
  default: {
    parse: vi.fn()
  }
}));

import SwaggerParser from '@apidevtools/swagger-parser';
const mockedSwaggerParser = vi.mocked(SwaggerParser);

// Mock console methods to avoid cluttering test output
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('OpenAPIAnalyzer', () => {
  let analyzer: OpenAPIAnalyzer;

  beforeEach(() => {
    analyzer = new OpenAPIAnalyzer();
    vi.clearAllMocks();
    mockConsoleError.mockClear();
    mockedSwaggerParser.parse.mockClear();
    process.env.OPENAPI_SPECS_FOLDER = '/test/folder';
  });

  afterEach(() => {
    delete process.env.OPENAPI_SPECS_FOLDER;
  });

  describe('loadSpecs', () => {
    it('should load valid OpenAPI specifications', async () => {
      const sampleApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: { summary: 'Get users' }
          }
        }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['sample-api.json', 'other-file.txt'] as any);
      mockedSwaggerParser.parse.mockResolvedValue(sampleApiSpec as any);

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
      mockedSwaggerParser.parse.mockRejectedValue(new Error('Invalid JSON'));

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(0);
      expect(mockConsoleError).toHaveBeenCalledWith('⚠️  Skipping invalid.json: Invalid JSON format or malformed OpenAPI spec');
    });

    it('should skip files without openapi or swagger field', async () => {
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['invalid-api.json'] as any);
      mockedSwaggerParser.parse.mockRejectedValue(new Error('Not an OpenAPI specification'));

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(0);
      expect(mockConsoleError).toHaveBeenCalledWith('⚠️  Skipping invalid-api.json: Invalid JSON format or malformed OpenAPI spec');
    });

    it('should load specs with swagger field', async () => {
      const swaggerApiSpec = {
        swagger: '2.0',
        info: { title: 'Swagger API', version: '1.0.0' },
        paths: {
          '/users': { get: { summary: 'Get users' } }
        }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['swagger-api.json'] as any);
      mockedSwaggerParser.parse.mockResolvedValue(swaggerApiSpec as any);

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(1);
      expect(specs[0].filename).toBe('swagger-api.json');
      expect(specs[0].title).toBe('Swagger API');
    });

    it('should handle specs without info section', async () => {
      const apiWithoutInfo = {
        openapi: '3.0.0',
        paths: {
          '/test': {
            get: { summary: 'Test endpoint' }
          }
        }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['no-info.json'] as any);
      mockedSwaggerParser.parse.mockResolvedValue(apiWithoutInfo as any);

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(1);
      expect(specs[0].title).toBe('No title'); // Default title when no info section
    });

    it('should handle specs with no paths', async () => {
      const apiWithoutPaths = {
        openapi: '3.0.0',
        info: { title: 'No Paths API', version: '1.0.0' }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['no-paths.json'] as any);
      mockedSwaggerParser.parse.mockResolvedValue(apiWithoutPaths as any);

      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(1);
      expect(specs[0].title).toBe('No Paths API');
    });
  });

  describe('listAllSpecs', () => {
    it('should return empty array when no specs loaded', () => {
      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(0);
    });

    it('should return spec summaries', async () => {
      const apiSpec = {
        openapi: '3.0.0',
        info: { 
          title: 'Test API', 
          version: '1.0.0',
          description: 'A test API'
        },
        paths: {
          '/users': { get: {}, post: {} },
          '/posts': { get: {} }
        }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['test.json'] as any);
      mockedSwaggerParser.parse.mockResolvedValue(apiSpec as any);
      await analyzer.loadSpecs();

      const specs = analyzer.listAllSpecs();
      expect(specs).toHaveLength(1);
      expect(specs[0].filename).toBe('test.json');
      expect(specs[0].title).toBe('Test API');
      expect(specs[0].version).toBe('1.0.0');
      expect(specs[0].description).toBe('A test API');
      expect(specs[0].endpointCount).toBe(2); // 2 paths: /users and /posts
    });
  });

  describe('getSpecByFilename', () => {
    it('should return null for non-existent spec', () => {
      const spec = analyzer.getSpecByFilename('nonexistent.json');
      expect(spec).toBeNull();
    });

    it('should return the correct spec', async () => {
      const apiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {}
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['test.json'] as any);
      mockedSwaggerParser.parse.mockResolvedValue(apiSpec as any);
      await analyzer.loadSpecs();

      const spec = analyzer.getSpecByFilename('test.json');
      expect(spec).toEqual(apiSpec);
    });
  });

  describe('searchEndpoints', () => {
    beforeEach(async () => {
      const apiSpec = {
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
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['test.json'] as any);
      mockedSwaggerParser.parse.mockResolvedValue(apiSpec as any);
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
      expect(results[0].method).toBe('GET');
      expect(results[1].method).toBe('GET');
    });

    it('should find endpoints by summary', () => {
      const results: SearchResult[] = analyzer.searchEndpoints('Create user');
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('/users');
      expect(results[0].method).toBe('POST');
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
      expect(stats.methodCounts).toEqual({});
      expect(stats.versions).toEqual({});
      expect(stats.commonPaths).toEqual({});
    });

    it('should calculate correct statistics', async () => {
      const apiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            get: { summary: 'Get users' },
            post: { summary: 'Create user' },
            put: { summary: 'Update user' },
            delete: { summary: 'Delete user' }
          },
          '/posts': {
            get: { summary: 'Get posts' },
            post: { summary: 'Create post' }
          },
          '/comments': {
            get: { summary: 'Get comments' }
          }
        }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['test.json'] as any);
      mockedSwaggerParser.parse.mockResolvedValue(apiSpec as any);
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
      expect(stats.versions).toEqual({
        '1.0.0': 1
      });
      expect(stats.commonPaths).toEqual({
        '/users': 1,
        '/posts': 1,
        '/comments': 1
      });
    });

    it('should handle multiple APIs with different versions', async () => {
      const api1Spec = {
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        paths: { '/users': { get: {}, post: {} } }
      };

      const api2Spec = {
        openapi: '3.0.0',
        info: { title: 'API 2', version: '2.0.0' },
        paths: { '/products': { get: {} } }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['api1.json', 'api2.json'] as any);
      mockedSwaggerParser.parse
        .mockResolvedValueOnce(api1Spec as any)
        .mockResolvedValueOnce(api2Spec as any);
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
      const api1Spec = {
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer' }
          }
        }
      };

      const api2Spec = {
        openapi: '3.0.0',
        info: { title: 'API 2', version: '1.0.0' },
        components: {
          securitySchemes: {
            apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' }
          }
        }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['api1.json', 'api2.json'] as any);
      mockedSwaggerParser.parse
        .mockResolvedValueOnce(api1Spec as any)
        .mockResolvedValueOnce(api2Spec as any);
      await analyzer.loadSpecs();

      const inconsistencies: Inconsistency[] = analyzer.findInconsistencies();

      expect(inconsistencies).toHaveLength(1);
      expect(inconsistencies[0].type).toBe('authentication');
      expect(inconsistencies[0].message).toContain('Multiple authentication schemes');
    });

    it('should return no inconsistencies for consistent auth', async () => {
      const api1Spec = {
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer' }
          }
        }
      };

      const api2Spec = {
        openapi: '3.0.0',
        info: { title: 'API 2', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer' }
          }
        }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['api1.json', 'api2.json'] as any);
      mockedSwaggerParser.parse
        .mockResolvedValueOnce(api1Spec as any)
        .mockResolvedValueOnce(api2Spec as any);
      await analyzer.loadSpecs();

      const inconsistencies: Inconsistency[] = analyzer.findInconsistencies();
      expect(inconsistencies).toHaveLength(0);
    });

    it('should return no inconsistencies when no security schemes exist', async () => {
      const apiSpec = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: { '/test': { get: {} } }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['api.json'] as any);
      mockedSwaggerParser.parse.mockResolvedValue(apiSpec as any);
      await analyzer.loadSpecs();

      const inconsistencies: Inconsistency[] = analyzer.findInconsistencies();
      expect(inconsistencies).toHaveLength(0);
    });
  });

  describe('compareSchemas', () => {
    beforeEach(async () => {
      const api1Spec = {
        openapi: '3.0.0',
        info: { title: 'API 1', version: '1.0.0' },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' }
              }
            },
            Product: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                title: { type: 'string' }
              }
            }
          }
        }
      };

      const api2Spec = {
        openapi: '3.0.0',
        info: { title: 'API 2', version: '1.0.0' },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                email: { type: 'string' }
              }
            }
          }
        }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['api1.json', 'api2.json'] as any);
      mockedSwaggerParser.parse
        .mockResolvedValueOnce(api1Spec as any)
        .mockResolvedValueOnce(api2Spec as any);
      await analyzer.loadSpecs();
    });

    it('should compare single schema across APIs', () => {
      const results: SchemaComparison[] = analyzer.compareSchemas('User', '');
      expect(results).toHaveLength(2);
      expect(results.every(r => r.schemaName === 'User')).toBe(true);
    });

    it('should compare two different schemas', () => {
      const results: SchemaComparison[] = analyzer.compareSchemas('User', 'Product');
      expect(results).toHaveLength(3); // User from both APIs + Product from API 1
    });

    it('should return empty array for non-existent schema', () => {
      const results: SchemaComparison[] = analyzer.compareSchemas('NonExistent', '');
      expect(results).toHaveLength(0);
    });

    it('should handle APIs without components/schemas', async () => {
      const apiWithoutSchemas = {
        openapi: '3.0.0',
        info: { title: 'Simple API', version: '1.0.0' },
        paths: { '/test': { get: {} } }
      };

      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockResolvedValue();
      mockedFs.readdir.mockResolvedValue(['simple.json'] as any);
      mockedSwaggerParser.parse.mockResolvedValue(apiWithoutSchemas as any);

      const simpleAnalyzer = new OpenAPIAnalyzer();
      await simpleAnalyzer.loadSpecs();

      const results: SchemaComparison[] = simpleAnalyzer.compareSchemas('User', '');
      expect(results).toHaveLength(0);
    });
  });

  describe('OpenAPIAnalyzer validation', () => {
    it('should throw error for missing environment variable', async () => {
      delete process.env.OPENAPI_SPECS_FOLDER;
      
      await expect(analyzer.loadSpecs()).rejects.toThrow();
    });

    it('should throw error for non-existent directory', async () => {
      process.env.OPENAPI_SPECS_FOLDER = '/nonexistent';
      mockedFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      
      await expect(analyzer.loadSpecs()).rejects.toThrow();
    });

    it('should throw error for non-directory path', async () => {
      process.env.OPENAPI_SPECS_FOLDER = '/some/file.txt';
      mockedFs.stat.mockResolvedValue({ isDirectory: () => false } as any);
      
      await expect(analyzer.loadSpecs()).rejects.toThrow();
    });

    it('should throw error for permission denied', async () => {
      process.env.OPENAPI_SPECS_FOLDER = '/no/permission';
      mockedFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockedFs.access.mockRejectedValue(new Error('EACCES: permission denied'));
      
      await expect(analyzer.loadSpecs()).rejects.toThrow();
    });
  });
});