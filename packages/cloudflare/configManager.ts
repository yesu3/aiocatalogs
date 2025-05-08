import { UserConfig, CatalogManifest, D1Database } from './types';
import { randomUUID } from 'crypto';

class ConfigManager {
  private db: D1Database | null = null;
  private cache: Map<string, UserConfig> = new Map();

  constructor() {
    this.cache = new Map();
  }

  // Datenbank setzen
  setDatabase(database: D1Database) {
    this.db = database;
  }

  // Initialisiere Datenbank-Schema
  async initDatabase() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Erstelle die Tabelle für Nutzerkonfigurationen, falls nicht vorhanden
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

  // Generiere eine neue Benutzer-ID
  async generateUserId(): Promise<string> {
    // In Cloudflare Workers verwenden wir crypto.randomUUID
    const userId = randomUUID();
    console.log(`Generated new user ID: ${userId}`);
    return userId;
  }

  // Lade die Konfiguration für einen bestimmten Benutzer
  async loadConfig(userId: string): Promise<UserConfig> {
    // Prüfe zuerst den Cache
    if (this.cache.has(userId)) {
      console.log(`Using cached config for user ${userId}`);
      return this.cache.get(userId)!;
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Initialisiere die Datenbank, falls nicht bereits geschehen
      await this.initDatabase();

      // Lade die Konfiguration aus der Datenbank
      const result = await this.db
        .prepare('SELECT config FROM user_configs WHERE user_id = ?')
        .bind(userId)
        .first();

      if (result && result.config) {
        const config = JSON.parse(result.config as string);
        console.log(
          `Loaded config for user ${userId} with ${config.catalogs?.length || 0} catalogs`
        );

        // Speichere im Cache
        this.cache.set(userId, config);
        return config;
      }
    } catch (error) {
      console.error(`Error loading config for user ${userId}:`, error);
    }

    // Standard-leere Konfiguration
    console.log(`Creating new empty config for user ${userId}`);
    const defaultConfig: UserConfig = { catalogs: [] };
    return defaultConfig;
  }

  // Speichere die Konfiguration für einen bestimmten Benutzer
  async saveConfig(userId: string, config?: UserConfig): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Wenn keine Konfiguration angegeben wurde, aber im Cache ist, verwende diese
    if (!config && this.cache.has(userId)) {
      config = this.cache.get(userId)!;
    } else if (!config) {
      // Fehler, wenn keine Konfiguration gefunden wurde
      console.error(
        `Cannot save config for user ${userId}: config not provided and not found in cache`
      );
      return false;
    }

    try {
      // Initialisiere die Datenbank, falls nicht bereits geschehen
      await this.initDatabase();

      const now = Date.now();
      const configJson = JSON.stringify(config);

      // Prüfe, ob der Benutzer bereits existiert
      const exists = await this.userExists(userId);

      if (exists) {
        // Update bestehenden Eintrag
        await this.db
          .prepare('UPDATE user_configs SET config = ?, updated_at = ? WHERE user_id = ?')
          .bind(configJson, now, userId)
          .run();
      } else {
        // Füge neuen Eintrag hinzu
        await this.db
          .prepare(
            'INSERT INTO user_configs (user_id, config, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind(userId, configJson, now, now)
          .run();
      }

      console.log(`Saved config for user ${userId} with ${config.catalogs.length} catalogs`);

      // Aktualisiere den Cache
      this.cache.set(userId, config);
      return true;
    } catch (error) {
      console.error(`Error saving config for user ${userId}:`, error);
      return false;
    }
  }

  // Hole die Konfiguration für einen bestimmten Benutzer
  async getConfig(userId: string): Promise<UserConfig> {
    return this.loadConfig(userId);
  }

  // Füge einen Katalog für einen bestimmten Benutzer hinzu
  async addCatalog(userId: string, manifest: CatalogManifest): Promise<boolean> {
    console.log(`Adding catalog ${manifest.id} to user ${userId}`);
    const config = await this.loadConfig(userId);

    // Prüfe, ob ein Katalog mit der gleichen ID bereits existiert
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

  // Entferne einen Katalog für einen bestimmten Benutzer
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

  // Hole einen bestimmten Katalog für einen Benutzer
  async getCatalog(userId: string, id: string): Promise<CatalogManifest | undefined> {
    const config = await this.loadConfig(userId);
    return config.catalogs.find(c => c.id === id);
  }

  // Hole alle Kataloge für einen Benutzer
  async getAllCatalogs(userId: string): Promise<CatalogManifest[]> {
    const config = await this.loadConfig(userId);
    console.log(`Getting all catalogs for user ${userId}: found ${config.catalogs.length}`);
    return config.catalogs;
  }

  // Prüfe, ob ein Benutzer existiert
  async userExists(userId: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Initialisiere die Datenbank, falls nicht bereits geschehen
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

  // Liste alle Benutzer auf
  async getAllUsers(): Promise<string[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Initialisiere die Datenbank, falls nicht bereits geschehen
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

  // Cache für einen Benutzer löschen
  clearCache(userId: string) {
    if (this.cache.has(userId)) {
      console.log(`Clearing cache for user ${userId}`);
      this.cache.delete(userId);
    }
  }

  // Gesamten Cache löschen
  clearAllCache() {
    console.log('Clearing entire cache');
    this.cache.clear();
  }
}

// Singleton-Instanz
export const configManager = new ConfigManager();
