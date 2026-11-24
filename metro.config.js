// expo-sqlite on web (the app's local copy of the account's data) runs SQLite
// as WebAssembly in a worker, so Metro must serve .wasm files. Without this
// the worker can't load, the local copy never opens, and every screen on web
// stays empty even though login works. Android/iOS are unaffected.
// https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/#web-setup
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// The docs' COEP/COOP headers. They only matter for SQLite's *Sync calls
// (SharedArrayBuffer); the app uses the async API only. Note the dev server
// adds them to bundles, not to the HTML page.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
