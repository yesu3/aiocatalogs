import { CatalogRequest, CatalogResponse, D1Database, MetaItem } from './types';
import { configManager } from './configManager';
import { version, description } from '../../package.json';

// Cache für Builder um Mehrfacherstellung zu vermeiden
const addonCache = new Map();

const ADDON_ID = 'community.aiocatalogs';

// Standardmanifest für einen Benutzer erstellen
function buildManifest(userId: string) {
  try {
    // Manifest-Objekt initialisieren
    const manifest = {
      id: `${ADDON_ID}.${userId}`,
      version,
      name: 'AIOCatalogs',
      description,
      logo: 'https://i.imgur.com/fRPYeIV.png',
      background: 'https://i.imgur.com/QPPXf5T.jpeg',
      resources: [] as string[],
      types: [] as string[],
      catalogs: [] as Array<{ id: string; type: string; name: string }>,
      behaviorHints: {
        configurable: true,
        configurationRequired: false,
      },
    };

    return manifest;
  } catch (error) {
    console.error('Error building manifest:', error);

    // Fallback-Manifest zurückgeben
    return {
      id: `${ADDON_ID}.${userId}`,
      version,
      name: 'AIOCatalogs',
      description: 'Error loading configuration',
      logo: 'https://i.imgur.com/fRPYeIV.png',
      background: 'https://i.imgur.com/QPPXf5T.jpeg',
      resources: ['catalog'],
      types: ['movie'],
      catalogs: [
        {
          type: 'movie',
          id: 'error',
          name: 'Error: Configuration could not be loaded',
        },
      ],
      behaviorHints: {
        configurable: true,
        configurationRequired: false,
      },
    };
  }
}

// Ein AddonInterface für einen bestimmten Benutzer erstellen
export async function getAddonInterface(userId: string, db: D1Database) {
  // Cache prüfen
  if (addonCache.has(userId)) {
    return addonCache.get(userId);
  }

  // Sicherstellen, dass die Datenbank im configManager gesetzt ist
  configManager.setDatabase(db);

  // Alle Kataloge für den Benutzer abrufen
  const userCatalogs = await configManager.getAllCatalogs(userId);

  // Manifest erstellen
  const manifest = buildManifest(userId);

  // Sammle alle Kataloge, Typen und Ressourcen
  const allTypes = new Set<string>();
  const allResources = new Set<string>();

  // Nur 'catalog' hinzufügen, da wir nur diesen Handler definieren
  allResources.add('catalog');

  // Kataloge zum Manifest hinzufügen
  if (userCatalogs.length === 0) {
    // Default-Katalog, wenn keine Kataloge konfiguriert wurden
    manifest.catalogs.push({
      id: 'aiocatalogs-default',
      type: 'movie',
      name: 'AIO Catalogs (No catalogs added yet)',
    });
    allTypes.add('movie');
  } else {
    // Kataloge aus den Benutzerkonfigurationen hinzufügen
    userCatalogs.forEach(source => {
      // Kataloge aus dieser Quelle hinzufügen
      source.catalogs.forEach(catalog => {
        manifest.catalogs.push({
          id: `${source.id}:${catalog.id}`,
          type: catalog.type,
          name: `${source.name}: ${catalog.name}`,
        });

        // Typen für das Manifest sammeln
        allTypes.add(catalog.type);
      });

      // Ressourcen aus der Quelle sammeln -
      // aber nur solche beibehalten, die wir unterstützen
      if (source.resources) {
        source.resources.forEach(resource => {
          if (resource === 'catalog') {
            allResources.add(resource);
          }
        });
      }
    });
  }

  // Gesammelte Typen und Ressourcen in das Manifest einfügen
  manifest.types = Array.from(allTypes);
  manifest.resources = Array.from(allResources);

  // AddonInterface erstellen
  const addonInterface = {
    manifest,

    // Katalog-Handler
    async catalog(args: CatalogRequest): Promise<CatalogResponse> {
      console.log(`Catalog request for ${userId} - ${args.type}/${args.id}`);

      try {
        // Default-Katalog behandeln
        if (args.id === 'aiocatalogs-default') {
          return {
            metas: [
              {
                id: 'setup-required',
                type: args.type,
                name: 'Setup Required',
                poster: 'https://i.imgur.com/fRPYeIV.png',
                description: 'Please visit the configuration page to add catalogs.',
              } as MetaItem,
            ],
          };
        }

        // Das neue Format der Katalog-ID ist: sourceId:catalogId
        // ID aufteilen, um Quelle und Katalog zu identifizieren
        const idParts = args.id.split(':');
        if (idParts.length !== 2) {
          console.error(`Invalid catalog ID format: ${args.id}`);
          return { metas: [] };
        }

        const sourceId = idParts[0];
        const catalogId = idParts[1];

        // Katalogquelle aus der Benutzerkonfiguration holen
        const userCatalogs = await configManager.getAllCatalogs(userId);
        const source = userCatalogs.find(c => c.id === sourceId);

        if (!source) {
          console.error(`Source not found: ${sourceId}`);
          return { metas: [] };
        }

        // Katalog in der Quelle finden
        const catalog = source.catalogs.find(c => c.type === args.type && c.id === catalogId);

        if (!catalog) {
          console.error(`Catalog not found: ${catalogId} in source ${sourceId}`);
          return { metas: [] };
        }

        // Katalog-Endpunkt erstellen
        const endpoint = source.endpoint.endsWith('/')
          ? source.endpoint.slice(0, -1)
          : source.endpoint;
        const url = `${endpoint}/catalog/${args.type}/${catalogId}.json`;
        console.log(`Fetching catalog from: ${url}`);

        try {
          const response = await fetch(url);

          if (!response.ok) {
            console.error(`Error fetching catalog: ${response.statusText}`);
            return { metas: [] };
          }

          const data = (await response.json()) as { metas?: any[] };

          // Quelle zu jedem Element hinzufügen
          if (data && Array.isArray(data.metas)) {
            data.metas.forEach((item: any) => {
              item.sourceAddon = sourceId;
            });
          }

          return data as CatalogResponse;
        } catch (error) {
          console.error(`Error fetching catalog: ${error}`);
          return { metas: [] };
        }
      } catch (error) {
        console.error('Error in catalog handler:', error);
        return { metas: [] };
      }
    },

    // Meta-Handler (optional, falls benötigt)
    async meta() {
      return { meta: {} };
    },

    // Stream-Handler (optional, falls benötigt)
    async stream() {
      return { streams: [] };
    },
  };

  // Interface im Cache speichern
  addonCache.set(userId, addonInterface);

  return addonInterface;
}

// Cache für einen Benutzer löschen
export function clearAddonCache(userId: string) {
  if (addonCache.has(userId)) {
    console.log(`Clearing addon cache for user ${userId}`);
    addonCache.delete(userId);
  }
}

// Gesamten Cache löschen
export function clearAllAddonCache() {
  console.log('Clearing entire addon cache');
  addonCache.clear();
}
