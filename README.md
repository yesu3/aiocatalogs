# AIO Catalogs für Stremio - Cloudflare Workers Edition

Ein All-in-One Katalog-Addon für Stremio, das mehrere Katalog-Addons in einem einzigen Addon vereint und auf Cloudflare Workers läuft.

## Features

- Füge mehrere Katalog-Addons aus verschiedenen Quellen in einem einzigen Addon zusammen
- Benutzerspezifische Konfigurationen, die in einer Cloudflare D1 Datenbank gespeichert werden
- Schnelle und zuverlässige Ausführung auf Cloudflare's Edge-Netzwerk
- Keine Server-Wartung notwendig durch serverlose Architektur

## Installation und Einrichtung für Entwickler

### Voraussetzungen

- Node.js und npm installiert
- Ein Cloudflare-Konto
- Wrangler CLI (`npm install -g wrangler`)

### Erste Schritte

1. Repository klonen oder herunterladen:

   ```
   git clone https://github.com/benutzer/aiocatalogs
   cd aiocatalogs
   ```

2. Abhängigkeiten installieren:

   ```
   npm install
   ```

3. Bei Cloudflare anmelden:

   ```
   wrangler login
   ```

4. D1-Datenbank erstellen:

   ```
   wrangler d1 create aiocatalogs
   ```

5. Die zurückgegebene Datenbank-ID in `wrangler.toml` eintragen.

6. Migrations ausführen:

   ```
   wrangler d1 migrations apply aiocatalogs
   ```

7. Lokale Entwicklung starten:

   ```
   npm run dev
   ```

8. Deployment auf Cloudflare Workers:
   ```
   npm run deploy
   ```

## Verwendung

1. Öffne die Addon-Webseite in deinem Browser (die URL wird nach dem Deployment angezeigt).

2. Klicke auf "Create New Configuration" um eine neue Benutzer-ID zu erstellen.

3. Füge Katalog-Addons hinzu, indem du deren Manifest-URLs eingibst (z.B. https://mdblist.com/addon/manifest.json).

4. Installiere das Addon in Stremio mit der angezeigten URL oder dem QR-Code.

5. Speichere deine Benutzer-ID, um später darauf zugreifen zu können!

## Technologie-Stack

- Cloudflare Workers für serverlose JavaScript/TypeScript-Ausführung
- Cloudflare D1 für SQLite-kompatible Datenspeicherung
- Hono.js als Web-Framework

## Migrieren von der Dateisystem-Version

Wenn du von der Dateisystem-Version migrieren möchtest, beachte, dass die Daten nicht automatisch migriert werden. Du musst deine Konfigurationen manuell neu erstellen.

## Lizenz

MIT

## Cloudflare Workers Deployment (Optional)

Das Add-on kann optional auch als Cloudflare Worker mit D1-Datenbank-Integration eingesetzt werden, um ohne eigene Server-Infrastruktur zu arbeiten:

### Voraussetzungen

- Node.js und npm installiert
- Ein Cloudflare-Konto
- Wrangler CLI (`npm install -g wrangler`)

### Einrichtung

1. Bei Cloudflare anmelden:

   ```
   wrangler login
   ```

2. D1-Datenbank erstellen:

   ```
   wrangler d1 create aiocatalogs
   ```

3. Die zurückgegebene Datenbank-ID in `packages/cloudflare/wrangler.toml` eintragen.

4. Migrations ausführen:

   ```
   wrangler d1 migrations apply aiocatalogs --local
   ```

5. Lokale Entwicklung starten:

   ```
   npm run dev:cf
   ```

6. Deployment auf Cloudflare Workers:
   ```
   npm run deploy:cf
   ```

### Vorteile der Cloudflare-Implementierung

- Keine eigene Server-Infrastruktur notwendig
- Globales Edge-Netzwerk für bessere Verfügbarkeit
- Persistente Datenspeicherung in Cloudflare D1
- Automatische Skalierung
