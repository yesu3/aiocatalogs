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

// CORS-Header für Stremio-Anfragen hinzufügen
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

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

  try {
    // Builder aus Cache holen oder neu erstellen
    let builder;

    if (builderCache.has(userId)) {
      builder = builderCache.get(userId);
    } else {
      builder = createAddonBuilder(userId);
      builderCache.set(userId, builder);
    }

    // Stremio SDK verwendet getInterface() um das Interface und Manifest zu bekommen
    const addonInterface = builder.getInterface();

    // Logging für Debug-Zwecke
    console.log(
      'Sending manifest (first 200 chars):',
      JSON.stringify(addonInterface.manifest).substring(0, 200) + '...'
    );

    // Explizit Header setzen und Manifest senden
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(addonInterface.manifest));
  } catch (error) {
    console.error('Error generating manifest:', error);
    res.status(500).json({ error: 'Failed to generate manifest' });
  }
});

// Handler für Stremio-Endpunkte
app.get('/:resource/:type/:id.json', (req, res) => {
  const { resource, type, id } = req.params;
  const userId = (req.query.userId as string) || 'default';

  try {
    // Nur catalog-Anfragen bearbeiten, andere mit Fehler beantworten
    if (resource !== 'catalog') {
      res.status(404).json({ error: 'Resource not supported' });
      return;
    }

    // Builder aus Cache holen oder neu erstellen
    let builder;

    if (builderCache.has(userId)) {
      builder = builderCache.get(userId);
    } else {
      builder = createAddonBuilder(userId);
      builderCache.set(userId, builder);
    }

    // Addon Interface holen
    const addonInterface = builder.getInterface();

    // Catalog-Methode aus Interface aufrufen - KORRIGIERT
    // Die Stremio SDK stellt eine get() Methode zur Verfügung
    addonInterface
      .get(resource, type, id)
      .then((result: unknown) => {
        res.setHeader('Content-Type', 'application/json');
        res.json(result);
      })
      .catch((error: Error) => {
        console.error(`Error handling ${resource} request:`, error);
        res.status(500).json({ error: 'internal error' });
      });
  } catch (error) {
    console.error(`Error in ${req.params.resource} endpoint:`, error);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Server starten
const portNumber = typeof port === 'string' ? parseInt(port, 10) : port;
app.listen(portNumber, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${portNumber}`);
  console.log(`Manifest URL: http://localhost:${portNumber}/manifest.json`);
  console.log(`Open http://localhost:${portNumber} in your browser to configure`);
});
