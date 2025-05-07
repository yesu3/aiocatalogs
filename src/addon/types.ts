export interface CatalogManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  resources: string[];
  types: string[];
  catalogs: {
    type: string;
    id: string;
    name: string;
  }[];
  idPrefixes?: string[];
  behaviorHints?: {
    adult?: boolean;
    p2p?: boolean;
  };
  endpoint: string;
}

export interface UserConfig {
  catalogs: CatalogManifest[];
}

export interface MetaPreviewItem {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
}
