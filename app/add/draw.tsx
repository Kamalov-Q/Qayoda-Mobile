// app/add/draw.tsx — draw the boundary of the listing being posted.
import { Redirect, router } from "expo-router";
import { PolygonPicker } from "../../src/features/map/PolygonPicker";
import { useLocationPicker } from "../../src/features/map/locationPickerStore";

export default function DrawBoundaryScreen() {
  const request = useLocationPicker((s) => s.request);
  // No form to send a ring to (reload, deep link) → back to the form.
  if (request?.kind !== "polygon") return <Redirect href="/add" />;

  return (
    <PolygonPicker
      initial={request.initial}
      onCancel={() => router.back()}
      onSave={(ring) => {
        request.onSave(ring);
        router.back();
      }}
    />
  );
}
