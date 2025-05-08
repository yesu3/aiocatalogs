import { configManager } from '../configManager';
import { catalogAggregator } from '../catalogAggregator';
import { CatalogManifest } from '../types';
import {
  getConfigPageHTML as sharedGetConfigPageHTML,
  convertStremioUrl,
} from '../../shared/templates/configPage';

// Direkte Referenz zur package.json für die Version
// Dies funktioniert, weil beim Build-Prozess alle Assets gebundelt werden
import packageJson from '../../../package.json';
const PACKAGE_VERSION = packageJson.version || 'unknown';

// Konfigurationsseite anzeigen
export const getConfigPage = async (c: any) => {
  const userId = c.req.param('userId');

  // Falls keine User-ID angegeben wurde, zur Startseite umleiten
  if (!userId) {
    return c.redirect('/configure');
  }

  try {
    // Konfiguration laden
    const catalogs = await configManager.getAllCatalogs(userId);
    const url = new URL(c.req.url);
    const baseUrl = url.host;
    const message = c.req.query('message') || '';
    const error = c.req.query('error') || '';

    // HTML als Text zurückgeben
    return c.html(
      sharedGetConfigPageHTML(userId, catalogs, baseUrl, message, error, true, PACKAGE_VERSION)
    );
  } catch (error) {
    console.error('Error displaying config page:', error);
    return c.redirect('/configure?error=Failed to load user configuration');
  }
};

// Katalog hinzufügen
export const addCatalog = async (c: any) => {
  const userId = c.req.param('userId');
  const formData = await c.req.formData();
  const rawCatalogUrl = formData.get('catalogUrl') as string;

  // Prüfen, ob der Benutzer existiert
  const exists = await configManager.userExists(userId);
  if (!exists) {
    return c.text('User not found', 404);
  }

  // stremio://-URL in https:// konvertieren, falls nötig
  const catalogUrl = convertStremioUrl(rawCatalogUrl);

  try {
    console.log('Fetching manifest from:', catalogUrl);
    const manifest = await catalogAggregator.fetchCatalogManifest(catalogUrl);

    if (manifest) {
      await configManager.addCatalog(userId, manifest);
      // Cache löschen
      return c.redirect(`/configure/${userId}?message=Catalog added successfully`);
    } else {
      return c.redirect(`/configure/${userId}?error=Failed to fetch catalog manifest`);
    }
  } catch (error) {
    console.error('Error adding catalog:', error);
    return c.redirect(`/configure/${userId}?error=Failed to add catalog`);
  }
};

// Katalog entfernen
export const removeCatalog = async (c: any) => {
  const userId = c.req.param('userId');
  const formData = await c.req.formData();
  const catalogId = formData.get('catalogId') as string;

  // Prüfen, ob der Benutzer existiert
  const exists = await configManager.userExists(userId);
  if (!exists) {
    return c.text('User not found', 404);
  }

  const success = await configManager.removeCatalog(userId, catalogId);

  if (success) {
    // Cache löschen
    return c.redirect(`/configure/${userId}?message=Catalog removed successfully`);
  } else {
    return c.redirect(`/configure/${userId}?error=Failed to remove catalog`);
  }
};
