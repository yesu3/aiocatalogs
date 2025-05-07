import fetch from "node-fetch";
import configManager from "./configManager";
import { CatalogManifest, MetaPreviewItem } from "../types";

class CatalogAggregator {
  async fetchCatalogData(
    userId: string,
    catalogType: string,
    catalogId: string
  ): Promise<MetaPreviewItem[]> {
    const allCatalogs = configManager.getAllCatalogs(userId);
    const results: MetaPreviewItem[] = [];

    // Process each catalog that matches the requested type and ID
    for (const catalog of allCatalogs) {
      const matchingCatalog = catalog.catalogs.find(
        (cat) =>
          cat.type === catalogType &&
          (catalogId === "all" || cat.id === catalogId)
      );

      if (matchingCatalog) {
        try {
          // Construct the catalog endpoint URL
          const endpoint = catalog.endpoint.endsWith("/")
            ? catalog.endpoint.slice(0, -1)
            : catalog.endpoint;
          const url = `${endpoint}/catalog/${catalogType}/${matchingCatalog.id}.json`;
          const response = await fetch(url);

          if (!response.ok) {
            console.error(
              `Error fetching from catalog ${catalog.id}: ${response.statusText}`
            );
            continue;
          }

          const data = await response.json();

          if (data && Array.isArray(data.metas)) {
            // Add source catalog ID to each item for tracking
            const itemsWithSource = data.metas.map((item: MetaPreviewItem) => ({
              ...item,
              // Add a sourceAddon property that won't be shown in the UI but is useful for debugging
              sourceAddon: catalog.id,
            }));

            results.push(...itemsWithSource);
          }
        } catch (error) {
          console.error(`Error processing catalog ${catalog.id}:`, error);
        }
      }
    }

    return results;
  }

  // Get all catalog types and IDs from the user's added catalogs
  getAllCatalogTypes(
    userId: string
  ): { type: string; id: string; name: string }[] {
    const catalogs = configManager.getAllCatalogs(userId);
    const allCatalogTypes: { type: string; id: string; name: string }[] = [];

    // Create a map to deduplicate catalog entries
    const catalogMap = new Map<
      string,
      { type: string; id: string; name: string }
    >();

    catalogs.forEach((catalog) => {
      catalog.catalogs.forEach((cat) => {
        const key = `${cat.type}-${cat.id}`;
        if (!catalogMap.has(key)) {
          catalogMap.set(key, {
            type: cat.type,
            id: cat.id,
            name: cat.name,
          });
        }
      });
    });

    return Array.from(catalogMap.values());
  }

  // Get all resource types from the user's added catalogs
  getAllResourceTypes(userId: string): string[] {
    const catalogs = configManager.getAllCatalogs(userId);
    const resourceSet = new Set<string>();

    catalogs.forEach((catalog) => {
      catalog.resources.forEach((resource) => {
        resourceSet.add(resource);
      });
    });

    return Array.from(resourceSet);
  }

  // Check if a catalog is reachable
  async checkCatalogHealth(manifest: CatalogManifest): Promise<boolean> {
    try {
      const response = await fetch(`${manifest.endpoint}/manifest.json`);
      return response.ok;
    } catch (error) {
      console.error(`Health check failed for ${manifest.id}:`, error);
      return false;
    }
  }

  // Fetch catalog manifest from URL
  async fetchCatalogManifest(
    catalogUrl: string
  ): Promise<CatalogManifest | null> {
    try {
      // Normalize the URL to ensure it points to the manifest.json
      let endpoint = catalogUrl;
      if (endpoint.endsWith("/manifest.json")) {
        endpoint = endpoint.substring(
          0,
          endpoint.length - "/manifest.json".length
        );
      }

      // Add trailing slash if missing
      if (!endpoint.endsWith("/")) {
        endpoint += "/";
      }

      const manifestUrl = `${endpoint}manifest.json`;
      console.log(`Fetching manifest from: ${manifestUrl}`);

      const response = await fetch(manifestUrl);

      if (!response.ok) {
        console.error(`Failed to fetch manifest: ${response.statusText}`);
        return null;
      }

      const manifest = await response.json();

      // Extract the necessary information for our catalog manifest
      const catalogManifest: CatalogManifest = {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description || "",
        endpoint: endpoint,
        resources: manifest.resources || [],
        catalogs: manifest.catalogs || [],
        version: manifest.version || "0.0.1",
        types: manifest.types || [],
      };

      return catalogManifest;
    } catch (error) {
      console.error(`Error fetching catalog manifest: ${error}`);
      return null;
    }
  }
}

const catalogAggregator = new CatalogAggregator();
export default catalogAggregator;
