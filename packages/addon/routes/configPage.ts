import express from 'express';
import configManager from '../lib/configManager';
import catalogAggregator from '../lib/catalogAggregator';
import { getConfigPageHTML, convertStremioUrl } from '../../shared/templates/configPage';
import { clearBuilderCache } from '../server';
import packageJson from '../../../package.json';

// Router for the configuration page
const router = express.Router();

// Read package version from package.json
const getPackageVersion = (): string => {
  return packageJson.version || 'unknown';
};

// Display configuration page
router.get('/:userId', async (req, res) => {
  const userId = req.params.userId;

  // Check if user exists
  if (!configManager.userExists(userId)) {
    return res.redirect('/configure');
  }

  try {
    // Load configuration
    const catalogs = configManager.getAllCatalogs(userId);

    // Host URL for Stremio links
    // Set protocol and host correctly for local development
    const host = req.headers.host || 'localhost:7000';
    const baseUrl = `${req.protocol === 'https' ? 'https' : 'http'}://${host}`;

    // Optional messages
    const message = (req.query.message as string) || '';
    const error = (req.query.error as string) || '';

    // Read version from package.json
    const packageVersion = getPackageVersion();

    // Render HTML
    res.send(getConfigPageHTML(userId, catalogs, baseUrl, message, error, false, packageVersion));
  } catch (error) {
    console.error('Error displaying config page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Add catalog
router.post('/:userId/add', async (req, res) => {
  const userId = req.params.userId;
  const catalogUrl = req.body.catalogUrl;

  if (!catalogUrl) {
    return res.redirect(`/configure/${userId}?error=Catalog URL is required`);
  }

  try {
    // Convert stremio:// URL to https:// if necessary
    const normalizedUrl = convertStremioUrl(catalogUrl);

    console.log(`Fetching catalog manifest from ${normalizedUrl}`);
    const manifest = await catalogAggregator.fetchCatalogManifest(normalizedUrl);

    if (manifest) {
      configManager.addCatalog(userId, manifest);
      clearBuilderCache(userId); // Clear cache after adding a catalog
      return res.redirect(`/configure/${userId}?message=Catalog added successfully`);
    } else {
      return res.redirect(`/configure/${userId}?error=Failed to fetch catalog manifest`);
    }
  } catch (error) {
    console.error('Error adding catalog:', error);
    return res.redirect(`/configure/${userId}?error=Failed to add catalog`);
  }
});

// Remove catalog
router.post('/:userId/remove', async (req, res) => {
  const userId = req.params.userId;
  const catalogId = req.body.catalogId;

  if (!catalogId) {
    return res.redirect(`/configure/${userId}?error=Catalog ID is required`);
  }

  try {
    const success = configManager.removeCatalog(userId, catalogId);

    if (success) {
      clearBuilderCache(userId); // Clear cache after removing a catalog
      return res.redirect(`/configure/${userId}?message=Catalog removed successfully`);
    } else {
      return res.redirect(`/configure/${userId}?error=Failed to remove catalog`);
    }
  } catch (error) {
    console.error('Error removing catalog:', error);
    return res.redirect(`/configure/${userId}?error=Failed to remove catalog`);
  }
});

// Move catalog up
router.post('/:userId/moveUp', async (req, res) => {
  const userId = req.params.userId;
  const catalogId = req.body.catalogId;

  if (!catalogId) {
    return res.redirect(`/configure/${userId}?error=Catalog ID is required`);
  }

  try {
    const success = configManager.moveCatalogUp(userId, catalogId);

    if (success) {
      clearBuilderCache(userId); // Clear cache after changing catalog order
      return res.redirect(`/configure/${userId}?message=Catalog moved up successfully`);
    } else {
      return res.redirect(`/configure/${userId}?error=Failed to move catalog up`);
    }
  } catch (error) {
    console.error('Error moving catalog up:', error);
    return res.redirect(`/configure/${userId}?error=Failed to move catalog up`);
  }
});

// Move catalog down
router.post('/:userId/moveDown', async (req, res) => {
  const userId = req.params.userId;
  const catalogId = req.body.catalogId;

  if (!catalogId) {
    return res.redirect(`/configure/${userId}?error=Catalog ID is required`);
  }

  try {
    const success = configManager.moveCatalogDown(userId, catalogId);

    if (success) {
      clearBuilderCache(userId); // Clear cache after changing catalog order
      return res.redirect(`/configure/${userId}?message=Catalog moved down successfully`);
    } else {
      return res.redirect(`/configure/${userId}?error=Failed to move catalog down`);
    }
  } catch (error) {
    console.error('Error moving catalog down:', error);
    return res.redirect(`/configure/${userId}?error=Failed to move catalog down`);
  }
});

export default router;
