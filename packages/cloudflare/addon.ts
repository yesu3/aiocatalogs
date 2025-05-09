import { CatalogRequest, CatalogResponse, D1Database, MetaItem } from './types';
import { configManager } from './configManager';
import { version, description } from '../../package.json';

// Cache for builders to avoid multiple creations
const addonCache = new Map();

const ADDON_ID = 'community.aiocatalogs';

// Create standard manifest for a user
function buildManifest(userId: string) {
  try {
    // Initialize manifest object
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

    // Return fallback manifest
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

// Create AddonInterface for a specific user
export async function getAddonInterface(userId: string, db: D1Database) {
  // Check cache
  if (addonCache.has(userId)) {
    return addonCache.get(userId);
  }

  // Ensure database is set in configManager
  configManager.setDatabase(db);

  // Get all catalogs for the user
  const userCatalogs = await configManager.getAllCatalogs(userId);

  // Create manifest
  const manifest = buildManifest(userId);

  // Collect all catalogs, types and resources
  const allTypes = new Set<string>();
  const allResources = new Set<string>();

  // Only add 'catalog' since we only define this handler
  allResources.add('catalog');

  // Add catalogs to the manifest
  if (userCatalogs.length === 0) {
    // Default catalog if no catalogs were configured
    manifest.catalogs.push({
      id: 'aiocatalogs-default',
      type: 'movie',
      name: 'AIO Catalogs (No catalogs added yet)',
    });
    allTypes.add('movie');
  } else {
    // Add catalogs from user configurations
    userCatalogs.forEach(source => {
      // Add catalogs from this source
      source.catalogs.forEach(catalog => {
        manifest.catalogs.push({
          id: `${source.id}:${catalog.id}`,
          type: catalog.type,
          name: `${source.name}: ${catalog.name}`,
        });

        // Collect types for the manifest
        allTypes.add(catalog.type);
      });

      // Collect resources from the source -
      // but only keep those we support
      if (source.resources) {
        source.resources.forEach(resource => {
          if (resource === 'catalog') {
            allResources.add(resource);
          }
        });
      }
    });
  }

  // Insert collected types and resources into the manifest
  manifest.types = Array.from(allTypes);
  manifest.resources = Array.from(allResources);

  // Create AddonInterface
  const addonInterface = {
    manifest,

    // Catalog handler
    async catalog(args: CatalogRequest): Promise<CatalogResponse> {
      console.log(`Catalog request for ${userId} - ${args.type}/${args.id}`);

      try {
        // Handle default catalog
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

        // The new catalog ID format is: sourceId:catalogId
        // Split ID to identify source and catalog
        const idParts = args.id.split(':');
        if (idParts.length !== 2) {
          console.error(`Invalid catalog ID format: ${args.id}`);
          return { metas: [] };
        }

        const sourceId = idParts[0];
        const catalogId = idParts[1];

        // Get catalog source from user configuration
        const userCatalogs = await configManager.getAllCatalogs(userId);
        const source = userCatalogs.find(c => c.id === sourceId);

        if (!source) {
          console.error(`Source not found: ${sourceId}`);
          return { metas: [] };
        }

        // Find catalog in the source
        const catalog = source.catalogs.find(c => c.type === args.type && c.id === catalogId);

        if (!catalog) {
          console.error(`Catalog not found: ${catalogId} in source ${sourceId}`);
          return { metas: [] };
        }

        // Create catalog endpoint
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

          // Add source to each item
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
        console.error(`Error handling catalog request: ${error}`);
        return { metas: [] };
      }
    },

    // Meta handler - not implemented
    async meta() {
      return { meta: null };
    },

    // Stream handler - not implemented
    async stream() {
      return { streams: [] };
    },
  };

  // Cache and return the AddonInterface
  addonCache.set(userId, addonInterface);
  return addonInterface;
}

// Clear cache for a specific user
export function clearAddonCache(userId: string) {
  if (addonCache.has(userId)) {
    console.log(`Clearing addon cache for user ${userId}`);
    addonCache.delete(userId);
  }
}

// Clear entire addon cache
export function clearAllAddonCache() {
  console.log('Clearing entire addon cache');
  addonCache.clear();
}
