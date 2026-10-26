// src/features/map/MapLayerButton.tsx
import { memo } from "react";
import type { ViewStyle } from "react-native";
import { useT } from "../../i18n";
import { MapIconButton } from "./MapIconButton";
import { useMapLayerStore } from "./mapLayer";

/**
 * Street ⇄ satellite, as one control that shows where it would take you.
 *
 * The glyph is the layer you would GET, not the one you are on: a button
 * labelled with the current state reads as a status light and nobody presses
 * it. Filled while satellite is on, which is also how the radius control
 * says it is active — one vocabulary for every toggle floating over a map.
 */
export const MapLayerButton = memo(function MapLayerButton({
  style,
}: {
  style?: ViewStyle;
}) {
  const layer = useMapLayerStore((s) => s.layer);
  const toggle = useMapLayerStore((s) => s.toggle);
  const t = useT();
  const satellite = layer === "satellite";

  return (
    <MapIconButton
      icon={satellite ? "map-outline" : "globe-outline"}
      label={t(satellite ? "map.layerStreet" : "map.layerSatellite")}
      active={satellite}
      onPress={toggle}
      style={style}
    />
  );
});
