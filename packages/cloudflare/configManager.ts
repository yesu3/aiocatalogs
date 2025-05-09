import { UserConfig, CatalogManifest, D1Database } from './types';
import { randomUUID } from 'crypto';

class ConfigManager {
  private db: D1Database | null = null;
  private cache: Map<string, UserConfig> = new Map();

  constructor() {
    this.cache = new Map();
  }

  // Set database
  setDatabase(database: D1Database) {
    this.db = database;
  }

  // Initialize database schema
  async initDatabase() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Create table for user configurations if it doesn't exist
    try {
      await this.db.exec(
        `CREATE TABLE IF NOT EXISTS user_configs (user_id TEXT PRIMARY KEY, config TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`
      );
      console.log('Database schema initialized');
    } catch (error) {
      console.error('Error initializing database schema:', error);
      throw error;
    }
  }

  // Generate a new user ID
  async generateUserId(): Promise<string> {
    // In Cloudflare Workers we use crypto.randomUUID
    const userId = randomUUID();
    console.log(`Generated new user ID: ${userId}`);
    return userId;
  }

  // Load configuration for a specific user
  async loadConfig(userId: string): Promise<UserConfig> {
    // First check the cache
    if (this.cache.has(userId)) {
      console.log(`Using cached config for user ${userId}`);
      return this.cache.get(userId)!;
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Initialize the database if not already done
      await this.initDatabase();

      // Load configuration from the database
      const result = await this.db
        .prepare('SELECT config FROM user_configs WHERE user_id = ?')
        .bind(userId)
        .first();

      if (result && result.config) {
        const config = JSON.parse(result.config as string);
        console.log(
          `Loaded config for user ${userId} with ${config.catalogs?.length || 0} catalogs`
        );

        // Save in cache
        this.cache.set(userId, config);
        return config;
      }
    } catch (error) {
      console.error(`Error loading config for user ${userId}:`, error);
    }

    // Default empty configuration
    console.log(`Creating new empty config for user ${userId}`);
    const defaultConfig: UserConfig = { catalogs: [] };
    return defaultConfig;
  }

  // Save configuration for a specific user
  async saveConfig(userId: string, config?: UserConfig): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // If no configuration is provided but exists in cache, use that
    if (!config && this.cache.has(userId)) {
      config = this.cache.get(userId)!;
    } else if (!config) {
      // Error if no configuration found
      console.error(
        `Cannot save config for user ${userId}: config not provided and not found in cache`
      );
      return false;
    }

    try {
      // Initialize the database if not already done
      await this.initDatabase();

      const now = Date.now();
      const configJson = JSON.stringify(config);

      // Check if the user already exists
      const exists = await this.userExists(userId);

      if (exists) {
        // Update existing entry
        await this.db
          .prepare('UPDATE user_configs SET config = ?, updated_at = ? WHERE user_id = ?')
          .bind(configJson, now, userId)
          .run();
      } else {
        // Add new entry
        await this.db
          .prepare(
            'INSERT INTO user_configs (user_id, config, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind(userId, configJson, now, now)
          .run();
      }

      console.log(`Saved config for user ${userId} with ${config.catalogs.length} catalogs`);

      // Update the cache
      this.cache.set(userId, config);
      return true;
    } catch (error) {
      console.error(`Error saving config for user ${userId}:`, error);
      return false;
    }
  }

  // Get configuration for a specific user
  async getConfig(userId: string): Promise<UserConfig> {
    return this.loadConfig(userId);
  }

  // Add a catalog for a specific user
  async addCatalog(userId: string, manifest: CatalogManifest): Promise<boolean> {
    console.log(`Adding catalog ${manifest.id} to user ${userId}`);
    const config = await this.loadConfig(userId);

    // Check if a catalog with the same ID already exists
    const existingIndex = config.catalogs.findIndex(c => c.id === manifest.id);

    if (existingIndex >= 0) {
      console.log(`Updating existing catalog at index ${existingIndex}`);
      config.catalogs[existingIndex] = manifest;
    } else {
      console.log(`Adding new catalog to list`);
      config.catalogs.push(manifest);
    }

    const success = await this.saveConfig(userId, config);
    if (success) {
      console.log(`Successfully saved config with ${config.catalogs.length} catalogs`);
    } else {
      console.error(`Failed to save config`);
    }

    return success;
  }

  // Remove a catalog for a specific user
  async removeCatalog(userId: string, id: string): Promise<boolean> {
    console.log(`Removing catalog ${id} from user ${userId}`);
    const config = await this.loadConfig(userId);
    const initialLength = config.catalogs.length;

    config.catalogs = config.catalogs.filter(c => c.id !== id);
    console.log(`After removal: ${config.catalogs.length} catalogs (was ${initialLength})`);

    if (initialLength !== config.catalogs.length) {
      return this.saveConfig(userId, config);
    }

    return false;
  }

  // Move a catalog up in the list for a specific user
  async moveCatalogUp(userId: string, id: string): Promise<boolean> {
    console.log(`Moving catalog ${id} up for user ${userId}`);
    const config = await this.loadConfig(userId);

    // Find the index of the catalog
    const index = config.catalogs.findIndex(c => c.id === id);

    // If catalog not found or already at the top, do nothing
    if (index <= 0) {
      console.log(`Catalog ${id} not found or already at the top`);
      return false;
    }

    // Swap the catalog with the one above it
    const temp = config.catalogs[index];
    config.catalogs[index] = config.catalogs[index - 1];
    config.catalogs[index - 1] = temp;

    console.log(`Moved catalog ${id} from position ${index} to ${index - 1}`);
    return this.saveConfig(userId, config);
  }

  // Move a catalog down in the list for a specific user
  async moveCatalogDown(userId: string, id: string): Promise<boolean> {
    console.log(`Moving catalog ${id} down for user ${userId}`);
    const config = await this.loadConfig(userId);

    // Find the index of the catalog
    const index = config.catalogs.findIndex(c => c.id === id);

    // If catalog not found or already at the bottom, do nothing
    if (index === -1 || index >= config.catalogs.length - 1) {
      console.log(`Catalog ${id} not found or already at the bottom`);
      return false;
    }

    // Swap the catalog with the one below it
    const temp = config.catalogs[index];
    config.catalogs[index] = config.catalogs[index + 1];
    config.catalogs[index + 1] = temp;

    console.log(`Moved catalog ${id} from position ${index} to ${index + 1}`);
    return this.saveConfig(userId, config);
  }

  // Get a specific catalog for a user
  async getCatalog(userId: string, id: string): Promise<CatalogManifest | undefined> {
    const config = await this.loadConfig(userId);
    return config.catalogs.find(c => c.id === id);
  }

  // Get all catalogs for a user
  async getAllCatalogs(userId: string): Promise<CatalogManifest[]> {
    const config = await this.loadConfig(userId);
    console.log(`Getting all catalogs for user ${userId}: found ${config.catalogs.length}`);
    return config.catalogs;
  }

  // Check if a user exists
  async userExists(userId: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Initialize the database if not already done
      await this.initDatabase();

      const result = await this.db
        .prepare('SELECT 1 FROM user_configs WHERE user_id = ?')
        .bind(userId)
        .first();

      const exists = !!result;
      console.log(`Checking if user ${userId} exists: ${exists}`);
      return exists;
    } catch (error) {
      console.error(`Error checking if user ${userId} exists:`, error);
      return false;
    }
  }

  // List all users
  async getAllUsers(): Promise<string[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Initialize the database if not already done
      await this.initDatabase();

      const results = await this.db
        .prepare('SELECT user_id FROM user_configs ORDER BY updated_at DESC')
        .all();

      if (results && results.results) {
        const users = results.results.map((row: any) => row.user_id as string);
        console.log(`Found ${users.length} users in database`);
        return users;
      }

      return [];
    } catch (error) {
      console.error('Error listing users:', error);
      return [];
    }
  }

  // Clear cache for a user
  clearCache(userId: string) {
    if (this.cache.has(userId)) {
      console.log(`Clearing cache for user ${userId}`);
      this.cache.delete(userId);
    }
  }

  // Clear all cache
  clearAllCache() {
    console.log('Clearing entire cache');
    this.cache.clear();
  }
}

// Create and export a singleton instance
export const configManager = new ConfigManager();
