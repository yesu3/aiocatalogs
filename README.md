# AIO Catalogs - All-in-One Stremio Catalogs

A Stremio addon that allows you to combine multiple catalog addons into one, so you don't need to install each catalog separately.

## Features

- Combine multiple Stremio catalog addons into one
- **User-specific configurations** - create your own personal collection of catalogs
- Simple configuration page to add/remove catalogs
- All catalogs accessible through one addon
- TypeScript implementation
- Easy to run locally or deploy

## Getting Started

### Prerequisites

- Node.js (14.x or newer)
- npm

### Installation

1. Clone this repository:

```
git clone https://github.com/panteLx/aiocatalogs.git
cd aiocatalogs
```

2. Install dependencies:

```
npm install
```

3. Start the development server:

```
npm run dev
```

4. Open your browser and navigate to:

```
http://localhost:7000/configure
```

5. Create a new user configuration or load an existing one

6. Add your catalog manifest URLs in the configuration page

7. Use the provided Stremio link or QR code to install the addon in Stremio

### Building

To build the addon for production:

```
npm run build
npm run serve
```

## How It Works

1. The addon starts a local web server with a configuration page
2. You create a personal user configuration (save your User ID!)
3. You add Stremio catalog addon manifest URLs through the configuration page
4. The addon aggregates catalogs from all the added addons
5. When you browse for content in Stremio, the addon fetches data from all configured catalogs

## User Configurations

Each user gets a unique ID that is used to manage their specific set of catalogs. Users can:

- Create a new configuration
- Load an existing configuration using their User ID
- Add and remove catalogs from their own configuration
- Share their configuration with others by sharing their unique manifest URL

## Advanced Configuration

User configurations are stored in the `userConfigs/` directory in the project root, with each user having their own JSON file.

## License

This project is licensed under the MIT License.
