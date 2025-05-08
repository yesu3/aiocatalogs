import configManager from "../lib/configManager";
import catalogAggregator from "../lib/catalogAggregator";
import { CatalogManifest } from "../types";
import { clearBuilderCache } from "../server";

// Helper function to convert stremio:// URLs to https://
function convertStremioUrl(url: string): string {
  if (url.startsWith("stremio://")) {
    return url.replace("stremio://", "https://");
  }
  return url;
}

// HTML template for the configuration page
const getConfigPageHTML = (
  userId: string,
  catalogs: CatalogManifest[],
  baseUrl: string,
  message: string = "",
  error: string = "",
) => {
  const catalogRows = catalogs
    .map(
      (catalog) => `
    <div class="flex flex-col space-y-2 p-4 rounded-lg bg-card border border-border hover:bg-accent/50 transition-colors">
      <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
        <div>
          <h3 class="font-medium">${catalog.name}</h3>
          <p class="text-sm text-muted-foreground">${catalog.id}</p>
        </div>
        <form method="POST" action="/configure/${userId}/remove" class="flex-shrink-0">
          <input type="hidden" name="catalogId" value="${catalog.id}">
          <button type="submit" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-4 py-2">
            Remove
          </button>
        </form>
      </div>
      <p class="text-sm text-muted-foreground">${catalog.description}</p>
      <p class="text-xs font-mono text-muted-foreground truncate">${catalog.endpoint}</p>
    </div>
  `,
    )
    .join("");

  // Create URLs for Stremio integration with query parameters
  const stremioUrl = `stremio://${baseUrl}/manifest.json?userId=${userId}`;
  const manifestUrl = `http://${baseUrl}/manifest.json?userId=${userId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    stremioUrl,
  )}`;

  return `
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AIO Catalogs Configuration</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          darkMode: 'class',
          theme: {
            container: {
              center: true,
              padding: "2rem",
              screens: {
                "2xl": "1400px",
              },
            },
            extend: {
              colors: {
                border: "hsl(240 3.7% 15.9%)",
                input: "hsl(240 3.7% 15.9%)",
                ring: "hsl(142.1 70.6% 45.3%)",
                background: "hsl(240 10% 3.9%)",
                foreground: "hsl(0 0% 98%)",
                primary: {
                  DEFAULT: "hsl(142.1 70.6% 45.3%)",
                  foreground: "hsl(144.9 80.4% 10%)",
                },
                secondary: {
                  DEFAULT: "hsl(240 3.7% 15.9%)",
                  foreground: "hsl(0 0% 98%)",
                },
                destructive: {
                  DEFAULT: "hsl(0 62.8% 30.6%)",
                  foreground: "hsl(0 0% 98%)",
                },
                muted: {
                  DEFAULT: "hsl(240 3.7% 15.9%)",
                  foreground: "hsl(240 5% 64.9%)",
                },
                accent: {
                  DEFAULT: "hsl(240 3.7% 15.9%)",
                  foreground: "hsl(0 0% 98%)",
                },
                card: {
                  DEFAULT: "hsl(240 10% 5.9%)",
                  foreground: "hsl(0 0% 98%)",
                },
              },
              borderRadius: {
                lg: "0.5rem",
                md: "calc(0.5rem - 2px)",
                sm: "calc(0.5rem - 4px)",
              },
            },
          },
        }
      </script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          font-family: 'Inter', sans-serif;
        }
        
        .bg-card-pattern {
          background-color: hsla(240, 10%, 5.9%, 1);
          background-image:
            radial-gradient(at 67% 27%, hsla(215, 98%, 61%, 0.05) 0px, transparent 50%),
            radial-gradient(at 0% 0%, hsla(343, 100%, 76%, 0.05) 0px, transparent 50%);
        }
      </style>
    </head>
    <body class="min-h-screen bg-background text-foreground bg-card-pattern">
      <div class="container py-10">
        <header class="mb-10">
          <h1 class="text-3xl font-bold tracking-tight mb-2">All-in-One Catalogs Configuration</h1>
          <p class="text-lg text-muted-foreground">Your unique user ID: <span class="font-medium text-primary">${userId}</span> (Save this ID to access your catalogs later)</p>
        </header>
        
        ${
          message
            ? `<div class="p-4 mb-6 border rounded-lg bg-primary/10 border-primary text-primary">${message}</div>`
            : ""
        }
        ${
          error
            ? `<div class="p-4 mb-6 border rounded-lg bg-destructive/10 border-destructive text-destructive">${error}</div>`
            : ""
        }
        
        <div class="grid gap-8">
          <section>
            <div class="rounded-lg border bg-card p-6 shadow-sm">
              <h2 class="text-xl font-semibold mb-4">Add New Catalog</h2>
              <form method="POST" action="/configure/${userId}/add">
                <div class="grid gap-4">
                  <div class="grid gap-2">
                    <label for="catalogUrl" class="text-sm font-medium">Catalog Manifest URL</label>
                    <input 
                      type="url" 
                      id="catalogUrl" 
                      name="catalogUrl" 
                      placeholder="https://example.com/manifest.json" 
                      required
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                    <p class="text-sm text-muted-foreground">Enter the manifest.json URL of the catalog addon you want to add (e.g. MDBList)</p>
                  </div>
                  <button type="submit" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full sm:w-auto">
                    Add Catalog
                  </button>
                </div>
              </form>
            </div>
          </section>
          
          <section>
            <h2 class="text-xl font-semibold mb-4">Your Catalogs</h2>
            ${
              catalogs.length === 0
                ? '<div class="p-4 rounded-lg bg-secondary/50 text-muted-foreground">No catalogs added yet. Add some catalogs to get started.</div>'
                : `<div class="grid gap-4">${catalogRows}</div>`
            }
          </section>
          
          <section class="mt-6">
            <div class="rounded-lg border bg-card p-6 shadow-sm">
              <h2 class="text-xl font-semibold mb-4">Install Your Addon</h2>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p class="mb-4">Click the button below to install this addon with your catalogs in Stremio:</p>
                  <a href="${stremioUrl}" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                    Add to Stremio
                  </a>
                  
                  <div class="mt-6">
                    <p class="mb-2">Alternatively, add this URL manually:</p>
                    <div class="p-3 rounded-md bg-muted font-mono text-sm break-all">
                      ${manifestUrl}
                    </div>
                    <button class="mt-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2" type="button" onclick="navigator.clipboard.writeText('${manifestUrl}')">
                      Copy URL
                    </button>
                  </div>
                </div>
                
                <div class="flex flex-col items-center">
                  <p class="mb-4">Or scan this QR code with your mobile device:</p>
                  <div class="p-4 bg-white rounded-lg inline-block">
                    <img src="${qrCodeUrl}" alt="QR Code for Stremio Addon" class="h-[150px] w-[150px]">
                  </div>
                  <p class="text-sm text-muted-foreground mt-4 text-center">The QR code contains the Stremio URL for this addon. Scan it with your smartphone to install the addon in the mobile Stremio app.</p>
                </div>
              </div>

              <div class="mt-4 p-4 rounded-lg bg-secondary/50 border-l-4 border-primary">
                <p class="text-sm text-muted-foreground">
                  <strong>Note:</strong> You have to reinstall the addon after
                  adding or removing catalogs.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
      
      <script>
        function copyToClipboard(text) {
          navigator.clipboard.writeText(text);
          alert('Copied to clipboard!');
        }
      </script>
    </body>
    </html>
  `;
};

// Extract the base URL from the request object
function getBaseUrl(req: any): string {
  const host = req.headers.host || "localhost:7000";
  return host;
}

// Create a new user ID and redirect to the user-specific configuration URL
export const createUser = (req: any, res: any) => {
  const userId = configManager.generateUserId();
  res.redirect(`/configure/${userId}`);
};

// Load an existing user configuration
export const loadUser = (req: any, res: any) => {
  const userId = req.body.userId;

  if (!userId) {
    res.status(400).send("User ID is required");
    return;
  }

  if (!configManager.userExists(userId)) {
    res.status(404).send("User not found");
    return;
  }

  res.redirect(`/configure/${userId}`);
};

// Konfigurations-Homepage mit Benutzerauswahl
export const getHomePage = (req: any, res: any) => {
  // Redirect from / to /configure
  if (req.path === "/") {
    res.redirect("/configure");
    return;
  }

  // Check if userId is provided in query parameters
  const userId = req.query.userId;
  if (userId) {
    res.redirect(`/configure/${userId}`);
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AIO Catalogs</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        tailwind.config = {
          darkMode: 'class',
          theme: {
            container: {
              center: true,
              padding: "2rem",
              screens: {
                "2xl": "1400px",
              },
            },
            extend: {
              colors: {
                border: "hsl(240 3.7% 15.9%)",
                input: "hsl(240 3.7% 15.9%)",
                ring: "hsl(142.1 70.6% 45.3%)",
                background: "hsl(240 10% 3.9%)",
                foreground: "hsl(0 0% 98%)",
                primary: {
                  DEFAULT: "hsl(142.1 70.6% 45.3%)",
                  foreground: "hsl(144.9 80.4% 10%)",
                },
                secondary: {
                  DEFAULT: "hsl(240 3.7% 15.9%)",
                  foreground: "hsl(0 0% 98%)",
                },
                destructive: {
                  DEFAULT: "hsl(0 62.8% 30.6%)",
                  foreground: "hsl(0 0% 98%)",
                },
                muted: {
                  DEFAULT: "hsl(240 3.7% 15.9%)",
                  foreground: "hsl(240 5% 64.9%)",
                },
                accent: {
                  DEFAULT: "hsl(240 3.7% 15.9%)",
                  foreground: "hsl(0 0% 98%)",
                },
                card: {
                  DEFAULT: "hsl(240 10% 5.9%)",
                  foreground: "hsl(0 0% 98%)",
                },
              },
              borderRadius: {
                lg: "0.5rem",
                md: "calc(0.5rem - 2px)",
                sm: "calc(0.5rem - 4px)",
              },
            },
          },
        }
      </script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          font-family: 'Inter', sans-serif;
        }
        
        .bg-card-pattern {
          background-color: hsla(240, 10%, 5.9%, 1);
          background-image:
            radial-gradient(at 67% 27%, hsla(215, 98%, 61%, 0.05) 0px, transparent 50%),
            radial-gradient(at 0% 0%, hsla(343, 100%, 76%, 0.05) 0px, transparent 50%);
        }
      </style>
    </head>
    <body class="min-h-screen bg-background text-foreground bg-card-pattern">
      <div class="container py-16">
        <h1 class="text-4xl font-bold tracking-tight text-center mb-10">All-in-One Catalogs for Stremio</h1>
        
        <div class="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
          <div class="rounded-lg border bg-card p-6 shadow-sm">
            <h2 class="text-xl font-semibold mb-4">New User</h2>
            <p class="text-muted-foreground mb-6">Create a new configuration for your catalogs.</p>
            <form method="POST" action="/configure/create">
              <button type="submit" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full">
                Create New Configuration
              </button>
            </form>
          </div>
          
          <div class="rounded-lg border bg-card p-6 shadow-sm">
            <h2 class="text-xl font-semibold mb-4">Existing User</h2>
            <p class="text-muted-foreground mb-4">Load your existing catalog configuration.</p>
            <form method="POST" action="/configure/load">
              <div class="grid gap-4">
                <div class="grid gap-2">
                  <label for="userId" class="text-sm font-medium">Your User ID</label>
                  <input 
                    type="text" 
                    id="userId" 
                    name="userId" 
                    required
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                </div>
                <button type="submit" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2 w-full">
                  Load Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
};

// Handler for GET /configure/:userId
export const getConfigPage = async (req: any, res: any) => {
  const userId = req.params.userId;

  if (!userId) {
    res.redirect("/configure");
    return;
  }

  const catalogs = configManager.getAllCatalogs(userId);
  const baseUrl = getBaseUrl(req);
  const message = req.query.message || "";
  const error = req.query.error || "";

  res.setHeader("Content-Type", "text/html");
  res.send(getConfigPageHTML(userId, catalogs, baseUrl, message, error));
};

// Handler for POST /configure/:userId/add
export const addCatalog = async (req: any, res: any) => {
  const userId = req.params.userId;
  const rawCatalogUrl = req.body.catalogUrl;

  if (!configManager.userExists(userId)) {
    res.status(404).send("User not found");
    return;
  }

  // Convert stremio:// URL to https:// if needed
  const catalogUrl = convertStremioUrl(rawCatalogUrl);

  try {
    console.log("Fetching manifest from:", catalogUrl);
    const manifest = await catalogAggregator.fetchCatalogManifest(catalogUrl);
    if (manifest) {
      configManager.addCatalog(userId, manifest);
      clearBuilderCache(userId); // Clear cache after adding catalog
      res.redirect(`/configure/${userId}?message=Catalog added successfully`);
    } else {
      res.redirect(
        `/configure/${userId}?error=Failed to fetch catalog manifest`,
      );
    }
  } catch (error) {
    console.error("Error adding catalog:", error);
    res.redirect(`/configure/${userId}?error=Failed to add catalog`);
  }
};

// Handler for POST /configure/:userId/remove
export const removeCatalog = async (req: any, res: any) => {
  const userId = req.params.userId;
  const catalogId = req.body.catalogId;

  if (!configManager.userExists(userId)) {
    res.status(404).send("User not found");
    return;
  }

  if (configManager.removeCatalog(userId, catalogId)) {
    clearBuilderCache(userId); // Clear cache after removing catalog
    res.redirect(`/configure/${userId}?message=Catalog removed successfully`);
  } else {
    res.redirect(`/configure/${userId}?error=Failed to remove catalog`);
  }
};
