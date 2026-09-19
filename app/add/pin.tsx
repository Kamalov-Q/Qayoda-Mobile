// app/add/pin.tsx — drop a pin for the listing being posted.
import { Redirect, router } from "expo-router";
import { PinPicker } from "../../src/features/map/PinPicker";
import { useLocationPicker } from "../../src/features/map/locationPickerStore";

export default function PinPickerScreen() {
  const request = useLocationPicker((s) => s.request);
  // Reached without a request (a reload, a deep link): there is no form to
  // send a pin to, so go back to the form rather than show a dead picker.
  if (request?.kind !== "pin") return <Redirect href="/add" />;

  return (
    <PinPicker
      initial={request.initial}
      onCancel={() => router.back()}
      onSave={(point) => {
        request.onSave(point);
        router.back();
      }}
    />
  );
}
