import { addonBuilder as StremioAddonBuilder } from 'stremio-addon-sdk';
import configManager from './lib/configManager';
import { version, description } from '../../package.json';

const ADDON_ID = 'community.aiocatalogs';

const buildManifest = (userId: string) => {
  try {
    // Get all catalog sources for the user
    const userCatalogs = configManager.getAllCatalogs(userId);
    console.log(`Building manifest for user ${userId} with ${userCatalogs.length} catalog sources`);

    // Collect all catalogs from all sources
    const allCatalogs = [];
    const allTypes = new Set<string>();
    const allResources = new Set<string>();

    // Nur 'catalog' hinzufügen, da wir nur diesen Handler definieren
    allResources.add('catalog');

    // Collect catalogs, types and resources from all sources
    for (const source of userCatalogs) {
      console.log(
        `Processing source: ${source.id} (${source.name}) with ${source.catalogs.length} catalogs`
      );

      // Add all catalogs from this source
      for (const catalog of source.catalogs) {
        console.log(`Adding catalog: ${catalog.type}/${catalog.id} (${catalog.name})`);

        allCatalogs.push({
          type: catalog.type,
          id: `${source.id}:${catalog.id}`, // Unique ID by prefixing with source ID
          name: `${source.name}: ${catalog.name}`, // Mark the origin in the name
        });

        // Collect types for the manifest
        allTypes.add(catalog.type);
      }

      // Collect additional resources from the source -
      // aber nur solche beibehalten, die wir unterstützen
      for (const resource of source.resources) {
        if (resource === 'catalog') {
          allResources.add(resource);
        }
      }
    }

    // Default catalog for new users without catalogs
    if (allCatalogs.length === 0) {
      console.log('No catalogs found, adding default catalog');

      allCatalogs.push({
        type: 'movie',
        id: 'aiocatalogs-default',
        name: 'AIO Catalogs (No catalogs added yet)',
      });
      allTypes.add('movie');
    }

    console.log(
      `Final manifest will contain ${allCatalogs.length} catalogs, ${allTypes.size} types, and ${allResources.size} resources`
    );

    // Build the manifest
    const manifest = {
      id: `${ADDON_ID}.${userId}`,
      version,
      name: 'AIOCatalogs',
      description,
      logo: 'https://i.imgur.com/fRPYeIV.png',
      background: 'https://i.imgur.com/QPPXf5T.jpeg',

      // Resource types supported by this addon (catalog only)
      resources: Array.from(allResources),

      // Content types supported by this addon (movie, series, etc.)
      types: Array.from(allTypes),

      // The catalogs offered by this addon (each catalog listed individually)
      catalogs: allCatalogs,

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
};

// Create a new AddonBuilder for a specific user
export const createAddonBuilder = (userId: string) => {
  try {
    // Load user configuration
    const userCatalogs = configManager.getAllCatalogs(userId);
    console.log(
      `Creating AddonBuilder for user ${userId} with ${userCatalogs.length} catalog sources`
    );

    // Build the manifest using the helper function
    const manifest = buildManifest(userId);

    // Create the builder with the manifest
    const builder = new StremioAddonBuilder(manifest);

    // Nur den catalog-Handler definieren, da wir nur Kataloge unterstützen
    builder.defineCatalogHandler(async args => {
      console.log(`Catalog request for type ${args.type}, id ${args.id}`);

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
              },
            ],
          };
        }

        // Das Format der Katalog-ID ist: sourceId:catalogId
        // ID aufteilen, um Quelle und Katalog zu identifizieren
        const idParts = args.id.split(':');
        if (idParts.length !== 2) {
          console.error(`Invalid catalog ID format: ${args.id}`);
          return { metas: [] };
        }

        const sourceId = idParts[0];
        const catalogId = idParts[1];

        // Katalogquelle aus der Benutzerkonfiguration holen
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
            console.error(`Error fetching catalog: ${response.statusText} (${response.status})`);
            return { metas: [] };
          }

          const data = (await response.json()) as { metas?: any[] };

          // Quelle zu jedem Element hinzufügen
          if (data && Array.isArray(data.metas)) {
            data.metas.forEach((item: any) => {
              item.sourceAddon = sourceId;
            });
          }

          return data;
        } catch (error) {
          console.error(`Error fetching catalog: ${error}`);
          return { metas: [] };
        }
      } catch (error) {
        console.error('Error in catalog handler:', error);
        return { metas: [] };
      }
    });

    // Log manifest for debugging
    console.log(
      'Created addon builder with manifest:',
      JSON.stringify(manifest).substring(0, 200) + '...'
    );

    return builder;
  } catch (error) {
    console.error('Error creating addon builder:', error);
    // Create a fallback minimal builder to avoid errors
    const fallbackManifest = {
      id: `${ADDON_ID}.${userId}`,
      version,
      name: 'AIOCatalogs (Error)',
      description: 'Error loading catalogs',
      resources: ['catalog'],
      types: ['movie'],
      catalogs: [
        {
          type: 'movie',
          id: 'error',
          name: 'Error loading catalogs',
        },
      ],
    };

    const fallbackBuilder = new StremioAddonBuilder(fallbackManifest);

    // Nur den catalog-Handler definieren
    fallbackBuilder.defineCatalogHandler(() => Promise.resolve({ metas: [] }));

    return fallbackBuilder;
  }
};
