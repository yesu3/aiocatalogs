import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { html } from 'hono/html';
import { configManager } from './configManager';
import { getAddonInterface, clearAddonCache } from './addon';
import { D1Database, Env } from './types';
import { getHomePageHTML } from '../shared/templates/configPage';

// Erstelle Hono App mit Bindings Typparameter
const app = new Hono<{ Bindings: Env }>();

// CORS-Middleware aktivieren
app.use('*', cors());

// Konfigmanager initialisieren
const initConfigManager = (c: any) => {
  if (c.env && c.env.DB) {
    configManager.setDatabase(c.env.DB);
  }
};

// Routen
app.get('/', async c => {
  // Umleitung von / auf /configure
  return c.redirect('/configure');
});

// Startseite mit Benutzerauswahl
app.get('/configure', async c => {
  initConfigManager(c);
  return c.html(getHomePageHTML());
});

// Benutzer erstellen
app.post('/configure/create', async c => {
  initConfigManager(c);
  const userId = await configManager.generateUserId();
  await configManager.saveConfig(userId, { catalogs: [] });

  return c.redirect(`/configure/${userId}`);
});

// Benutzer laden
app.post('/configure/load', async c => {
  initConfigManager(c);
  const formData = await c.req.formData();
  const userId = formData.get('userId') as string;

  if (!userId) {
    return c.text('User ID is required', 400);
  }

  const exists = await configManager.userExists(userId);
  if (!exists) {
    return c.text('User not found', 404);
  }

  return c.redirect(`/configure/${userId}`);
});

// Konfigurations-Seite (importiert aus separater Datei)
import { getConfigPage, addCatalog, removeCatalog } from './routes/configPage';

app.get('/configure/:userId', async c => {
  initConfigManager(c);
  return getConfigPage(c);
});

app.post('/configure/:userId/add', async c => {
  initConfigManager(c);
  return addCatalog(c);
});

app.post('/configure/:userId/remove', async c => {
  initConfigManager(c);
  return removeCatalog(c);
});

// Manifest.json mit userId als Query-Parameter
app.get('/manifest.json', async c => {
  initConfigManager(c);
  const userId = c.req.query('userId') || 'default';

  if (c.env && c.env.DB) {
    const addonInterface = await getAddonInterface(userId, c.env.DB as D1Database);

    // Cache für zukünftige Anfragen löschen
    clearAddonCache(userId);

    c.header('Content-Type', 'application/json');
    return c.json(addonInterface.manifest);
  } else {
    return c.json({ error: 'Database not available' }, 500);
  }
});

// Addon-API-Routen
app.get('/:resource/:type/:id\\.json', async c => {
  initConfigManager(c);
  const params = c.req.param();
  const resource = params.resource;
  const type = params.type;
  // Route-Parameter korrekt extrahieren
  const idWithJson = params['id\\.json'];
  const id = idWithJson ? idWithJson.replace(/\.json$/, '') : '';
  const userId = c.req.query('userId') || 'default';

  if (c.env && c.env.DB) {
    const addonInterface = await getAddonInterface(userId, c.env.DB as D1Database);

    if (resource === 'catalog') {
      const result = await addonInterface.catalog({ type, id });
      return c.json(result);
    } else if (resource === 'meta') {
      const result = await addonInterface.meta();
      return c.json(result);
    } else if (resource === 'stream') {
      const result = await addonInterface.stream();
      return c.json(result);
    } else {
      return c.json({ error: 'not found' }, 404);
    }
  } else {
    return c.json({ error: 'Database not available' }, 500);
  }
});

// 404-Handler
app.notFound(c => {
  return c.text('Not found', 404);
});

// Error-Handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.text('Internal Server Error', 500);
});

// Worker-Export
export default app;
