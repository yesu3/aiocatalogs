// Datentypen für Cloudflare D1
import { D1Database as CloudflareD1Database } from '@cloudflare/workers-types';

export type D1Database = CloudflareD1Database;

// Import der MetaPreviewItem-Schnittstelle aus dem Basispaket
import {
  UserConfig,
  CatalogManifest,
  MetaPreviewItem as BaseMetaPreviewItem,
} from '../addon/types';

// Re-Export der Typen
export { UserConfig, CatalogManifest };
export type MetaPreviewItem = BaseMetaPreviewItem;

// Cloudflare Worker Environment
export interface Env {
  DB: D1Database;
  // Hinzufügen eines Index-Signatures, um den Env-Typ zu erfüllen
  [key: string]: any;
}

// Anfrage-Parameter für Katalog-Anfragen
export interface CatalogRequest {
  type: string; // Typ des Inhalts (z.B. 'movie', 'series')
  id: string; // ID des Katalogs
  extra?: any; // Zusätzliche Parameter
}

// Antwort einer Katalog-Anfrage
export interface CatalogResponse {
  metas: MetaItem[]; // Liste der Meta-Objekte
}

// Struktur eines Meta-Objekts
export interface MetaItem extends MetaPreviewItem {
  releaseInfo?: string; // Veröffentlichungsinformationen (z.B. Jahr)
  imdbRating?: string; // IMDB-Bewertung
  director?: string[]; // Regisseure
  cast?: string[]; // Schauspieler
  genres?: string[]; // Genres
  sourceAddon?: string; // Quell-Addon-ID
  [key: string]: any; // Weitere Felder
}
