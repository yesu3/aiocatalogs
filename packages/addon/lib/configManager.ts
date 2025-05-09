import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UserConfig, CatalogManifest } from '../types';

class ConfigManager {
  private configsPath: string;
  private configs: Map<string, UserConfig>;

  constructor(configsPath: string = path.join(process.cwd(), 'userConfigs')) {
    this.configsPath = configsPath;
    this.configs = new Map();

    // Ensure the configuration directory exists
    if (!fs.existsSync(this.configsPath)) {
      fs.mkdirSync(this.configsPath, { recursive: true });
    }
  }

  // Generate a new user ID
  generateUserId(): string {
    const userId = crypto.randomUUID();
    console.log(`Generated new user ID: ${userId}`);
    return userId;
  }

  // Load the configuration for a specific user
  loadConfig(userId: string): UserConfig {
    if (this.configs.has(userId)) {
      console.log(`Using cached config for user ${userId}`);
      return this.configs.get(userId)!;
    }

    const configPath = path.join(this.configsPath, `${userId}.json`);
    console.log(`Loading config from ${configPath}`);

    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        console.log(
          `Loaded config for user ${userId} with ${config.catalogs?.length || 0} catalogs`
        );

        this.configs.set(userId, config);
        return config;
      }
    } catch (error) {
      console.error(`Error loading config for user ${userId}:`, error);
    }

    // Default empty configuration
    console.log(`Creating new empty config for user ${userId}`);
    const defaultConfig = { catalogs: [] };
    this.configs.set(userId, defaultConfig);
    return defaultConfig;
  }

  // Save the configuration for a specific user
  saveConfig(userId: string): boolean {
    if (!this.configs.has(userId)) {
      console.error(`Cannot save config for user ${userId}: config not found in memory`);
      return false;
    }

    const configPath = path.join(this.configsPath, `${userId}.json`);
    const config = this.configs.get(userId)!;

    try {
      console.log(
        `Saving config for user ${userId} with ${config.catalogs.length} catalogs to ${configPath}`
      );
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error(`Error saving config for user ${userId}:`, error);
      return false;
    }
  }

  // Get the configuration for a specific user
  getConfig(userId: string): UserConfig {
    return this.loadConfig(userId);
  }

  // Add a catalog for a specific user
  addCatalog(userId: string, manifest: CatalogManifest): boolean {
    console.log(`Adding catalog ${manifest.id} to user ${userId}`);
    const config = this.loadConfig(userId);

    // Check if a catalog with the same ID already exists
    const existingIndex = config.catalogs.findIndex(c => c.id === manifest.id);

    if (existingIndex >= 0) {
      console.log(`Updating existing catalog at index ${existingIndex}`);
      config.catalogs[existingIndex] = manifest;
    } else {
      console.log(`Adding new catalog to list`);
      config.catalogs.push(manifest);
    }

    const success = this.saveConfig(userId);
    if (success) {
      console.log(`Successfully saved config with ${config.catalogs.length} catalogs`);
    } else {
      console.error(`Failed to save config`);
    }

    return success;
  }

  // Remove a catalog for a specific user
  removeCatalog(userId: string, id: string): boolean {
    console.log(`Removing catalog ${id} from user ${userId}`);
    const config = this.loadConfig(userId);
    const initialLength = config.catalogs.length;

    config.catalogs = config.catalogs.filter(c => c.id !== id);
    console.log(`After removal: ${config.catalogs.length} catalogs (was ${initialLength})`);

    if (initialLength !== config.catalogs.length) {
      return this.saveConfig(userId);
    }

    return false;
  }

  // Move a catalog up in the list for a specific user
  moveCatalogUp(userId: string, id: string): boolean {
    console.log(`Moving catalog ${id} up for user ${userId}`);
    const config = this.loadConfig(userId);

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
    return this.saveConfig(userId);
  }

  // Move a catalog down in the list for a specific user
  moveCatalogDown(userId: string, id: string): boolean {
    console.log(`Moving catalog ${id} down for user ${userId}`);
    const config = this.loadConfig(userId);

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
    return this.saveConfig(userId);
  }

  // Get a specific catalog for a user
  getCatalog(userId: string, id: string): CatalogManifest | undefined {
    const config = this.loadConfig(userId);
    return config.catalogs.find(c => c.id === id);
  }

  // Get all catalogs for a user
  getAllCatalogs(userId: string): CatalogManifest[] {
    const config = this.loadConfig(userId);
    console.log(`Getting all catalogs for user ${userId}: found ${config.catalogs.length}`);
    return config.catalogs;
  }

  // Check if a user exists
  userExists(userId: string): boolean {
    const configPath = path.join(this.configsPath, `${userId}.json`);
    const exists = fs.existsSync(configPath);
    console.log(`Checking if user ${userId} exists: ${exists}`);
    return exists;
  }

  // List all users
  getAllUsers(): string[] {
    try {
      const files = fs.readdirSync(this.configsPath);
      const users = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));

      console.log(`Found ${users.length} users in ${this.configsPath}`);
      return users;
    } catch (error) {
      console.error('Error listing users:', error);
      return [];
    }
  }
}

// Singleton instance
const configManager = new ConfigManager();
export default configManager;
