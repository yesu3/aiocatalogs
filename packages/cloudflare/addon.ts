import { CatalogRequest, CatalogResponse, D1Database, MetaItem } from './types';
import { configManager } from './configManager';
import { version, description } from '../../package.json';

// Cache für Builder um Mehrfacherstellung zu vermeiden
const addonCache = new Map();

// Standardmanifest für einen Benutzer erstellen
function buildManifest(userId: string) {
  return {
    id: `aio-catalogs-${userId}`,
    version,
    name: 'AIOCatalogs',
    description,
    resources: ['catalog'],
    types: ['movie', 'series'],
    catalogs: [] as Array<{ id: string; type: string; name: string }>,
    background: 'https://i.imgur.com/mjyzBmX.png',
    logo: 'https://i.imgur.com/mjyzBmX.png',
  };
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

  // Kataloge zum Manifest hinzufügen
  if (userCatalogs.length === 0) {
    // Default-Katalog, wenn keine Kataloge konfiguriert wurden
    manifest.catalogs.push({
      id: 'aiocatalogs-default',
      type: 'movie',
      name: 'Setup Required',
    });
  } else {
    // Kataloge aus den Benutzerkonfigurationen hinzufügen
    userCatalogs.forEach(source => {
      source.catalogs.forEach(catalog => {
        manifest.catalogs.push({
          id: `${source.id}:${catalog.id}`,
          type: catalog.type,
          name: `${source.name}: ${catalog.name}`,
        });
      });
    });
  }

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
                type: 'movie',
                name: 'Setup Required',
                poster: 'https://i.imgur.com/mjyzBmX.png',
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
