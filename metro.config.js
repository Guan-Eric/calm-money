const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// Prefer React Native Firebase Auth entry so getReactNativePersistence resolves at runtime.
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
