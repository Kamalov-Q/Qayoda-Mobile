import { memo, useEffect, useRef, useState } from "react";
import type { TextInputProps } from "react-native";
import type { Ionicons } from "@expo/vector-icons";
import { TextField } from "./TextField";

interface Props extends Omit<TextInputProps, "value" | "onChangeText"> {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  hint?: string;
  /**
   * The text the field opens with. Changing it later does NOT move what the
   * reader is typing — to clear the field from outside, remount it with a
   * different `key`.
   */
  initialValue?: string;
  /** Called once typing pauses, never per keystroke. */
  onChangeDebounced: (value: string) => void;
  delayMs?: number;
}

/**
 * A text field that keeps its keystrokes to itself.
 *
 * A filter field wired straight to a screen's state re-renders that whole
 * screen on every letter — and on the sale tab that screen owns a map, a
 * feed, a filter sheet and two sliders. The typing is what suffers: the
 * debounce downstream stops the REQUESTS, but the renders happen anyway.
 *
 * Here the raw text lives in this component and only the settled value goes
 * up, so a keystroke re-renders one input and the screen hears about it once.
 */
export const DebouncedTextField = memo(function DebouncedTextField({
  initialValue = "",
  onChangeDebounced,
  delayMs = 350,
  ...rest
}: Props) {
  const [text, setText] = useState(initialValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A field unmounted mid-word (the sheet closing, the tab changing) would
  // otherwise push its last value into a screen that has moved on.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onChangeText = (next: string) => {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChangeDebounced(next), delayMs);
  };

  return <TextField {...rest} value={text} onChangeText={onChangeText} />;
});
