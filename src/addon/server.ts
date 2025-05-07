import { serveHTTP, getRouter } from "stremio-addon-sdk";
import express from "express";
import bodyParser from "body-parser";
import { createAddonBuilder } from "./manifest";
import catalogAggregator from "./lib/catalogAggregator";
import configManager from "./lib/configManager";
import {
  getHomePage,
  getConfigPage,
  addCatalog,
  removeCatalog,
  createUser,
  loadUser,
} from "./routes/configPage";

const PORT = process.env.PORT || 7000;

// Cache for builders to avoid creating a new one for each request
const builderCache = new Map();

// Function to delete a builder from the cache
export function clearBuilderCache(userId: string) {
  if (builderCache.has(userId)) {
    console.log(`Clearing builder cache for user ${userId}`);
    builderCache.delete(userId);
  }
}

// Helper function to create or retrieve a builder for a user
function getBuilderForUser(userId: string) {
  if (builderCache.has(userId)) {
    return builderCache.get(userId);
  }

  console.log(`Creating new builder for user ${userId}`);
  const builder = createAddonBuilder(userId);

  // Define the catalog handler for this user
  builder.defineCatalogHandler(async ({ type, id }) => {
    console.log(`Catalog request for ${userId} - ${type}/${id}`);

    try {
      // Handle default empty catalog
      if (id === "aiocatalogs-default") {
        return {
          metas: [
            {
              id: "setup-required",
              type: "movie",
              name: "Setup Required",
              poster: "https://i.imgur.com/mjyzBmX.png",
              description:
                "Please visit the configuration page to add catalogs.",
            },
          ],
        };
      }

      // The new format of the catalog ID is: sourceId:catalogId
      // Split the ID to identify the source and catalog
      const idParts = id.split(":");
      if (idParts.length !== 2) {
        console.error(`Invalid catalog ID format: ${id}`);
        return { metas: [] };
      }

      const sourceId = idParts[0];
      const catalogId = idParts[1];

      // Get the catalog source from the user configuration
      const userCatalogs = configManager.getAllCatalogs(userId);
      const source = userCatalogs.find((c) => c.id === sourceId);

      if (!source) {
        console.error(`Source not found: ${sourceId}`);
        return { metas: [] };
      }

      // Find the catalog in the source
      const catalog = source.catalogs.find(
        (c) => c.type === type && c.id === catalogId
      );

      if (!catalog) {
        console.error(`Catalog not found: ${catalogId} in source ${sourceId}`);
        return { metas: [] };
      }

      // Construct the catalog endpoint
      const endpoint = source.endpoint.endsWith("/")
        ? source.endpoint.slice(0, -1)
        : source.endpoint;
      const url = `${endpoint}/catalog/${type}/${catalogId}.json`;
      console.log(`Fetching catalog from: ${url}`);

      try {
        const response = await fetch(url);

        if (!response.ok) {
          console.error(`Error fetching catalog: ${response.statusText}`);
          return { metas: [] };
        }

        const data = await response.json();

        // Add the source to each item
        if (data && Array.isArray(data.metas)) {
          data.metas.forEach((item: any) => {
            item.sourceAddon = sourceId;
          });
        }

        return data;
      } catch (error) {
        console.error(`Error fetching catalog: ${error}`);
        return { metas: [] };
      }
    } catch (error) {
      console.error("Error in catalog handler:", error);
      return { metas: [] };
    }
  });

  builderCache.set(userId, builder);
  return builder;
}

// Extract the user ID from the URL path or query parameter
function extractUserId(req: any): string {
  // First check if a userId query parameter exists
  if (req.query && req.query.userId) {
    return req.query.userId as string;
  }

  // Then check if a userId parameter exists in the URL
  if (req.params && req.params.userId) {
    return req.params.userId;
  }

  // Return default user if no ID was found
  return "default";
}

// Create express app for the addon
const app = express();

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Add middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Root route
app.get("/", getHomePage);

// User management routes
app.get("/configure", getHomePage);
app.post("/configure/create", createUser);
app.post("/configure/load", loadUser);

// User-specific configuration routes
app.get("/configure/:userId", getConfigPage);
app.post("/configure/:userId/add", addCatalog);
app.post("/configure/:userId/remove", removeCatalog);

// Debug route to check the current manifest
app.get("/debug/manifest/:userId", (req, res) => {
  const userId = req.params.userId;
  // Clear cache to get a fresh manifest
  clearBuilderCache(userId);
  const builder = getBuilderForUser(userId);
  const manifest = builder.getInterface().manifest;

  res.setHeader("Content-Type", "application/json");
  res.send(manifest);
});

// Default manifest handler
app.get("/manifest.json", (req, res) => {
  const userId = extractUserId(req);
  console.log(`Manifest request for user ${userId}`);

  // Always use a fresh builder to have the latest catalogs
  clearBuilderCache(userId);
  const builder = getBuilderForUser(userId);
  const manifest = builder.getInterface().manifest;

  console.log(`Manifest contains ${manifest.catalogs.length} catalogs`);

  res.setHeader("Content-Type", "application/json");
  res.send(manifest);
});

// Addon API route, parameters through querystrings
app.get("/:resource/:type/:id.json", (req, res) => {
  const userId = extractUserId(req);
  const { resource, type, id } = req.params;

  console.log(`Request for ${resource}/${type}/${id}.json from user ${userId}`);

  const builder = getBuilderForUser(userId);
  const addonInterface = builder.getInterface();

  const router = getRouter(addonInterface);

  // Manually forward to getRouter
  req.url = `/${resource}/${type}/${id}.json`;
  router(req, res, () => {
    res.status(404).send({ error: "not found" });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Addon server running at http://localhost:${PORT}`);
  console.log(
    `Create a new configuration at http://localhost:${PORT}/configure`
  );
});

// For Docker/Heroku compatibility
// serveHTTP(addonInterface, { port: Number(PORT) });
