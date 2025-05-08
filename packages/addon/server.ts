import express from 'express';
import bodyParser from 'body-parser';
import { createAddonBuilder } from './manifest';
import configManager from './lib/configManager';
import { getHomePageHTML } from '../shared/templates/configPage';
import configRoutes from './routes/configPage';

// Port für den Server (Default: 7000, kann über ENV-Variable überschrieben werden)
const port = process.env.PORT || 7000;

// Express-App erstellen
const app = express();

// Middleware für JSON und URL-encodierte Formulardaten
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Cache für Builder um Mehrfacherstellung zu vermeiden
const builderCache = new Map();

// Cache für einen Benutzer löschen
export function clearBuilderCache(userId: string) {
  if (builderCache.has(userId)) {
    console.log(`Clearing builder cache for user ${userId}`);
    builderCache.delete(userId);
  }
}

// Gesamten Cache löschen
export function clearAllBuilderCache() {
  console.log('Clearing entire builder cache');
  builderCache.clear();
}

// Startseite
app.get('/', (req, res) => {
  // Umleitung von / auf /configure
  return res.redirect('/configure');
});

// Hauptseite mit Benutzerauswahl
app.get('/configure', (req, res) => {
  // Wenn userId als Query-Parameter vorhanden, zur Konfigurationsseite umleiten
  const userId = req.query.userId as string;
  if (userId) {
    return res.redirect(`/configure/${userId}`);
  }

  // Andernfalls Startseite anzeigen
  res.setHeader('Content-Type', 'text/html');
  res.send(getHomePageHTML());
});

// Neuen Benutzer erstellen
app.post('/configure/create', (req, res) => {
  const userId = configManager.generateUserId();
  configManager.loadConfig(userId);
  configManager.saveConfig(userId);
  res.redirect(`/configure/${userId}`);
});

// Benutzer laden
// @ts-ignore - Temporary fix for Express version conflict
app.post('/configure/load', (req, res) => {
  const userId = req.body.userId;

  if (!userId) {
    return res.status(400).send('User ID is required');
  }

  if (!configManager.userExists(userId)) {
    return res.status(404).send('User not found');
  }

  res.redirect(`/configure/${userId}`);
});

// Konfigurationsrouten einbinden
app.use('/configure', configRoutes);

// Handler für /manifest.json
app.get('/manifest.json', (req, res) => {
  const userId = (req.query.userId as string) || 'default';

  // Builder aus Cache holen oder neu erstellen
  let builder;

  if (builderCache.has(userId)) {
    builder = builderCache.get(userId);
  } else {
    const catalogs = configManager.getAllCatalogs(userId);
    builder = createAddonBuilder(userId);
    builderCache.set(userId, builder);
  }

  res.setHeader('Content-Type', 'application/json');
  res.send(builder.manifest);
});

// Handler für Stremio-Endpunkte
app.get('/:resource/:type/:id.json', (req, res) => {
  const { resource, type, id } = req.params;
  const userId = (req.query.userId as string) || 'default';

  // Builder aus Cache holen oder neu erstellen
  let builder;

  if (builderCache.has(userId)) {
    builder = builderCache.get(userId);
  } else {
    const catalogs = configManager.getAllCatalogs(userId);
    builder = createAddonBuilder(userId);
    builderCache.set(userId, builder);
  }

  // Je nach Ressource Endpoint auswählen
  let handler;

  switch (resource) {
    case 'catalog':
      handler = builder.catalogHandler;
      break;
    case 'meta':
      handler = builder.metaHandler;
      break;
    case 'stream':
      handler = builder.streamHandler;
      break;
    default:
      res.status(404).json({ error: 'resource not found' });
      return;
  }

  // Prüfen, ob der Handler existiert und eine Funktion ist
  if (!handler || typeof handler !== 'function') {
    console.error(`Handler for ${resource} not found or not a function`);
    res.status(501).json({ error: `${resource} not implemented` });
    return;
  }

  handler({ type, id })
    .then((result: unknown) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(result);
    })
    .catch((error: Error) => {
      console.error(`Error handling ${resource} request:`, error);
      res.status(500).json({ error: 'internal error' });
    });
});

// Server starten
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Open http://localhost:${port} in your browser`);
});
