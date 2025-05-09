import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { html } from 'hono/html';
import { configManager } from './configManager';
import { getAddonInterface, clearAddonCache } from './addon';
import { D1Database, Env } from './types';
import { getHomePageHTML } from '../shared/templates/configPage';

// Create Hono App with Bindings type parameter
const app = new Hono<{ Bindings: Env }>();

// Enable CORS middleware
app.use('*', cors());

// Initialize config manager
const initConfigManager = (c: any) => {
  if (c.env && c.env.DB) {
    configManager.setDatabase(c.env.DB);
  }
};

// Routes
app.get('/', async c => {
  // Redirect from / to /configure
  return c.redirect('/configure');
});

// Home page with user selection
app.get('/configure', async c => {
  initConfigManager(c);
  return c.html(getHomePageHTML());
});

// Create user
app.post('/configure/create', async c => {
  initConfigManager(c);
  const userId = await configManager.generateUserId();
  await configManager.saveConfig(userId, { catalogs: [] });

  return c.redirect(`/configure/${userId}`);
});

// Load user
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

// Configuration page (imported from separate file)
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

// Manifest.json with userId as query parameter
app.get('/manifest.json', async c => {
  initConfigManager(c);
  const userId = c.req.query('userId') || 'default';

  if (c.env && c.env.DB) {
    const addonInterface = await getAddonInterface(userId, c.env.DB as D1Database);

    // Clear cache for future requests
    clearAddonCache(userId);

    c.header('Content-Type', 'application/json');
    return c.json(addonInterface.manifest);
  } else {
    return c.json({ error: 'Database not available' }, 500);
  }
});

// Addon API routes
app.get('/:resource/:type/:id\\.json', async c => {
  initConfigManager(c);
  const params = c.req.param();
  const resource = params.resource;
  const type = params.type;
  // Extract route parameters correctly
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

// 404 handler
app.notFound(c => {
  return c.text('Not found', 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.text('Internal Server Error', 500);
});

// Worker export
export default app;
