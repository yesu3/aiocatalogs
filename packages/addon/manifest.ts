import { addonBuilder as StremioAddonBuilder } from 'stremio-addon-sdk';
import configManager from './lib/configManager';

const ADDON_ID = 'org.aiocatalogs';
const ADDON_VERSION = '1.0.0';

const buildManifest = (userId: string) => {
  // Get all catalog sources for the user
  const userCatalogs = configManager.getAllCatalogs(userId);
  console.log(`Building manifest for user ${userId} with ${userCatalogs.length} catalog sources`);

  // Collect all catalogs from all sources
  const allCatalogs = [];
  const allTypes = new Set<string>();
  const allResources = new Set<string>();

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

    // Collect resources for the manifest
    for (const resource of source.resources) {
      allResources.add(resource);
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
    allResources.add('catalog');
  }

  console.log(
    `Final manifest will contain ${allCatalogs.length} catalogs, ${allTypes.size} types, and ${allResources.size} resources`
  );

  // Build the manifest
  const manifest = {
    id: `${ADDON_ID}.${userId}`,
    version: ADDON_VERSION,
    name: 'All-in-one Catalogs',
    description: 'Aggregate multiple Stremio catalogs into one addon',
    logo: 'https://i.imgur.com/mjyzBmX.png',
    background: 'https://i.imgur.com/X9PYlKT.jpg',

    // Resource types supported by this addon (catalog, meta, stream, etc.)
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
};

// Create a new AddonBuilder for a specific user
export const createAddonBuilder = (userId: string) => {
  const builder = new StremioAddonBuilder(buildManifest(userId));

  // Stelle sicher, dass alle Handler definiert sind
  // Definiere leere Handler für alle Ressourcen
  builder.defineCatalogHandler(args => {
    console.log(`Catalog request for type ${args.type}, id ${args.id}`);
    // Implementiere hier die Katalog-Logik mit userCatalogs
    return Promise.resolve({ metas: [] });
  });

  builder.defineMetaHandler(args => {
    console.log(`Meta request for type ${args.type}, id ${args.id}`);
    return Promise.resolve({ meta: null });
  });

  builder.defineStreamHandler(args => {
    console.log(`Stream request for type ${args.type}, id ${args.id}`);
    return Promise.resolve({ streams: [] });
  });

  return builder;
};
