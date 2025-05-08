import { CatalogManifest } from './types';

// Interface für die Rohdaten aus der Manifest-API
interface RawManifest {
  id: string;
  name: string;
  description?: string;
  version?: string;
  resources?: string[];
  types?: string[];
  catalogs: { type: string; id: string; name: string }[];
  idPrefixes?: string[];
  behaviorHints?: {
    adult?: boolean;
    p2p?: boolean;
  };
}

class CatalogAggregator {
  // Hole das Manifest eines Katalogs von einer URL
  async fetchCatalogManifest(url: string): Promise<CatalogManifest | null> {
    try {
      console.log(`Fetching catalog manifest from ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Failed to fetch catalog manifest: ${response.statusText}`);
        return null;
      }

      const data = await response.json();

      // Typprüfung der erforderlichen Felder
      if (!data || typeof data !== 'object') {
        console.error('Invalid manifest format: not an object');
        return null;
      }

      // Cast zu RawManifest zur Typsicherheit
      const manifest = data as RawManifest;

      // Prüfe, ob das Manifest gültig ist und die erforderlichen Felder enthält
      if (!manifest.id || !manifest.name || !manifest.catalogs) {
        console.error('Invalid manifest format: missing required fields');
        return null;
      }

      // Erstelle ein CatalogManifest-Objekt
      const catalogManifest: CatalogManifest = {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description || `Catalog from ${url}`,
        endpoint: url.replace('/manifest.json', ''),
        version: manifest.version || '0.0.1',
        resources: manifest.resources || ['catalog'],
        types: manifest.types || ['movie', 'series'],
        catalogs: manifest.catalogs || [],
        idPrefixes: manifest.idPrefixes,
        behaviorHints: manifest.behaviorHints,
      };

      console.log(
        `Successfully fetched manifest for ${catalogManifest.name} with ${catalogManifest.catalogs.length} catalogs`
      );
      return catalogManifest;
    } catch (error) {
      console.error('Error fetching catalog manifest:', error);
      return null;
    }
  }

  // Hole Katalogdaten von einem Endpunkt
  async fetchCatalogData(endpoint: string, type: string, id: string): Promise<any> {
    try {
      // Stelle sicher, dass der Endpunkt korrekt formatiert ist
      const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
      const url = `${baseUrl}/catalog/${type}/${id}.json`;

      console.log(`Fetching catalog data from ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Failed to fetch catalog data: ${response.statusText}`);
        return { metas: [] };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching catalog data:', error);
      return { metas: [] };
    }
  }
}

// Singleton-Instanz
export const catalogAggregator = new CatalogAggregator();
