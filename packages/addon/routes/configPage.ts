import express from 'express';
import configManager from '../lib/configManager';
import catalogAggregator from '../lib/catalogAggregator';
import { getConfigPageHTML, convertStremioUrl } from '../../shared/templates/configPage';
import { clearBuilderCache } from '../server';
import packageJson from '../../../package.json';

// Router für die Konfigurationsseite
const router = express.Router();

// Paketversion aus der package.json lesen
const getPackageVersion = (): string => {
  return packageJson.version || 'unknown';
};

// Konfigurationsseite anzeigen
router.get('/:userId', async (req, res) => {
  const userId = req.params.userId;

  // Prüfen, ob der Benutzer existiert
  if (!configManager.userExists(userId)) {
    return res.redirect('/configure');
  }

  try {
    // Konfiguration laden
    const catalogs = configManager.getAllCatalogs(userId);

    // Host-URL für Stremio-Links
    // Protokoll und Host korrekt setzen für lokale Entwicklung
    const host = req.headers.host || 'localhost:7000';
    const baseUrl = `${req.protocol === 'https' ? 'https' : 'http'}://${host}`;

    // Optionale Nachrichten
    const message = (req.query.message as string) || '';
    const error = (req.query.error as string) || '';

    // Version aus package.json lesen
    const packageVersion = getPackageVersion();

    // HTML rendern
    res.send(getConfigPageHTML(userId, catalogs, baseUrl, message, error, false, packageVersion));
  } catch (error) {
    console.error('Error displaying config page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Katalog hinzufügen
router.post('/:userId/add', async (req, res) => {
  const userId = req.params.userId;
  const catalogUrl = req.body.catalogUrl;

  if (!catalogUrl) {
    return res.redirect(`/configure/${userId}?error=Catalog URL is required`);
  }

  try {
    // stremio://-URL in https:// konvertieren, falls nötig
    const normalizedUrl = convertStremioUrl(catalogUrl);

    console.log(`Fetching catalog manifest from ${normalizedUrl}`);
    const manifest = await catalogAggregator.fetchCatalogManifest(normalizedUrl);

    if (manifest) {
      configManager.addCatalog(userId, manifest);
      clearBuilderCache(userId); // Cache nach Hinzufügen eines Katalogs löschen
      return res.redirect(`/configure/${userId}?message=Catalog added successfully`);
    } else {
      return res.redirect(`/configure/${userId}?error=Failed to fetch catalog manifest`);
    }
  } catch (error) {
    console.error('Error adding catalog:', error);
    return res.redirect(`/configure/${userId}?error=Failed to add catalog`);
  }
});

// Katalog entfernen
router.post('/:userId/remove', async (req, res) => {
  const userId = req.params.userId;
  const catalogId = req.body.catalogId;

  if (!catalogId) {
    return res.redirect(`/configure/${userId}?error=Catalog ID is required`);
  }

  try {
    const success = configManager.removeCatalog(userId, catalogId);

    if (success) {
      clearBuilderCache(userId); // Cache nach Entfernen eines Katalogs löschen
      return res.redirect(`/configure/${userId}?message=Catalog removed successfully`);
    } else {
      return res.redirect(`/configure/${userId}?error=Failed to remove catalog`);
    }
  } catch (error) {
    console.error('Error removing catalog:', error);
    return res.redirect(`/configure/${userId}?error=Failed to remove catalog`);
  }
});

export default router;
