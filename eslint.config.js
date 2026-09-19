// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// react-native-maps' native components (map, marker, polygon, …).
const MAP_COMPONENTS = '/^(MapView|Marker|Polygon|Polyline|Circle|Callout)$/';
// View-level props React Native applies by diffing against the last props.
const VIEW_PROPS = '/^(pointerEvents|opacity|transform)$/';
const MAP_PROP_MESSAGE =
  'Put pointerEvents/opacity/transform on a wrapping <View>, never on a ' +
  'react-native-maps component: iOS recycles its native views and the ' +
  'library resets its props record on reuse, so the value leaks into the ' +
  'next map (a static preview once froze every map after it). See ' +
  'MAP_STYLE_RULE in src/features/map/maps.ts.';

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // <MapView pointerEvents="none" …>
          selector: `JSXOpeningElement[name.name=${MAP_COMPONENTS}] > JSXAttribute[name.name=${VIEW_PROPS}]`,
          message: MAP_PROP_MESSAGE,
        },
        {
          // <MapView style={{ pointerEvents: "none" }} …>
          selector: `JSXOpeningElement[name.name=${MAP_COMPONENTS}] > JSXAttribute[name.name='style'] Property[key.name=${VIEW_PROPS}]`,
          message: MAP_PROP_MESSAGE,
        },
      ],
    },
  },
]);
