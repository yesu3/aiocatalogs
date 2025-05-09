import { configManager } from '../configManager';
import { catalogAggregator } from '../catalogAggregator';
import { CatalogManifest } from '../types';
import {
  getConfigPageHTML as sharedGetConfigPageHTML,
  convertStremioUrl,
} from '../../shared/templates/configPage';

// Direct reference to package.json for version
// This works because all assets are bundled during the build process
import packageJson from '../../../package.json';
const PACKAGE_VERSION = packageJson.version || 'unknown';

// Display configuration page
export const getConfigPage = async (c: any) => {
  const userId = c.req.param('userId');

  // If no user ID is provided, redirect to home page
  if (!userId) {
    return c.redirect('/configure');
  }

  // Check if user exists
  const exists = await configManager.userExists(userId);
  if (!exists) {
    return c.redirect('/configure');
  }

  try {
    // Load configuration
    const catalogs = await configManager.getAllCatalogs(userId);
    const url = new URL(c.req.url);
    const baseUrlHost = url.host;
    const baseUrl = `${url.protocol === 'https' ? 'https' : 'http'}://${baseUrlHost}`;
    const message = c.req.query('message') || '';
    const error = c.req.query('error') || '';

    // Return HTML as text
    return c.html(
      sharedGetConfigPageHTML(userId, catalogs, baseUrl, message, error, true, PACKAGE_VERSION)
    );
  } catch (error) {
    console.error('Error displaying config page:', error);
    return c.redirect('/configure?error=Failed to load user configuration');
  }
};

// Add catalog
export const addCatalog = async (c: any) => {
  const userId = c.req.param('userId');
  const formData = await c.req.formData();
  const rawCatalogUrl = formData.get('catalogUrl') as string;

  // Check if user exists
  const exists = await configManager.userExists(userId);
  if (!exists) {
    return c.text('User not found', 404);
  }

  // Convert stremio:// URL to https:// if necessary
  const catalogUrl = convertStremioUrl(rawCatalogUrl);

  try {
    console.log('Fetching manifest from:', catalogUrl);
    const manifest = await catalogAggregator.fetchCatalogManifest(catalogUrl);

    if (manifest) {
      await configManager.addCatalog(userId, manifest);
      // Clear cache
      return c.redirect(`/configure/${userId}?message=Catalog added successfully`);
    } else {
      return c.redirect(`/configure/${userId}?error=Failed to fetch catalog manifest`);
    }
  } catch (error) {
    console.error('Error adding catalog:', error);
    return c.redirect(`/configure/${userId}?error=Failed to add catalog`);
  }
};

// Remove catalog
export const removeCatalog = async (c: any) => {
  const userId = c.req.param('userId');
  const formData = await c.req.formData();
  const catalogId = formData.get('catalogId') as string;

  // Check if user exists
  const exists = await configManager.userExists(userId);
  if (!exists) {
    return c.text('User not found', 404);
  }

  const success = await configManager.removeCatalog(userId, catalogId);

  if (success) {
    // Clear cache
    return c.redirect(`/configure/${userId}?message=Catalog removed successfully`);
  } else {
    return c.redirect(`/configure/${userId}?error=Failed to remove catalog`);
  }
};

// Move catalog up
export const moveCatalogUp = async (c: any) => {
  const userId = c.req.param('userId');
  const formData = await c.req.formData();
  const catalogId = formData.get('catalogId') as string;

  // Check if user exists
  const exists = await configManager.userExists(userId);
  if (!exists) {
    return c.text('User not found', 404);
  }

  const success = await configManager.moveCatalogUp(userId, catalogId);

  if (success) {
    // Clear cache
    return c.redirect(`/configure/${userId}?message=Catalog moved up successfully`);
  } else {
    return c.redirect(`/configure/${userId}?error=Failed to move catalog up`);
  }
};

// Move catalog down
export const moveCatalogDown = async (c: any) => {
  const userId = c.req.param('userId');
  const formData = await c.req.formData();
  const catalogId = formData.get('catalogId') as string;

  // Check if user exists
  const exists = await configManager.userExists(userId);
  if (!exists) {
    return c.text('User not found', 404);
  }

  const success = await configManager.moveCatalogDown(userId, catalogId);

  if (success) {
    // Clear cache
    return c.redirect(`/configure/${userId}?message=Catalog moved down successfully`);
  } else {
    return c.redirect(`/configure/${userId}?error=Failed to move catalog down`);
  }
};
