import { memo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { radii, spacing } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

// One hidden input drives N display boxes — no focus juggling between 6 inputs,
// and display boxes are plain Views (cheap), not TextInputs.
export const OtpInput = memo(function OtpInput({
  value,
  onChange,
  length = 6,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const { colors } = useTheme();

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
        autoFocus
      />
      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          justifyContent: "center",
        }}
      >
        {Array.from({ length }).map((_, i) => {
          const char = value[i];
          // The caret box is the next empty slot, but only while focused —
          // an unfocused field shouldn't look like it's accepting input.
          const isCaret = focused && i === value.length;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                maxWidth: 54,
                aspectRatio: 0.82,
                borderWidth: isCaret ? 2 : 1.5,
                borderColor: error
                  ? colors.danger
                  : isCaret
                    ? colors.primary
                    : char
                      ? colors.borderStrong
                      : colors.border,
                backgroundColor: isCaret
                  ? colors.primarySoft
                  : colors.surfaceRaised,
                borderRadius: radii.lg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                {char ?? ""}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
});
