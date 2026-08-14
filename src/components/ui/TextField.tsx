import { forwardRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, radii, sizing, type } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { useT } from "../../i18n";

const WEB_RESET =
  Platform.OS === "web" ? ({ outline: "none" } as unknown as TextStyle) : null;

/** Roughly five lines — enough that a description doesn't feel cramped. */
const MULTILINE_HEIGHT = 128;

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  /** Leading glyph inside the field — helps a long form scan quickly. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Trailing static text, e.g. a unit or currency. */
  suffix?: string;
}

export const TextField = forwardRef<TextInput, Props>(
  ({ label, error, icon, suffix, secureTextEntry, onFocus, onBlur, ...inputProps }, ref) => {
    const { colors } = useTheme();
    const t = useT();
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);

    const isPassword = !!secureTextEntry;
    // A multiline field grows instead of sitting at the fixed control height,
    // and its content has to start at the top rather than being centred.
    const isMultiline = !!inputProps.multiline;

    const borderColor = error
      ? colors.danger
      : focused
        ? colors.primary
        : colors.border;

    return (
      <View style={{ gap: spacing.sm }}>
        {label && (
          // Sentence case, not the tracked-out uppercase this used to use:
          // Cyrillic has no small-caps tradition and uppercasing it reads as
          // shouting while costing legibility at 12pt.
          <Text style={{ ...type.label, color: colors.textMuted }}>{label}</Text>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: isMultiline ? "flex-start" : "center",
            gap: spacing.sm,
            height: isMultiline ? undefined : sizing.control,
            minHeight: isMultiline ? MULTILINE_HEIGHT : undefined,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor,
            backgroundColor: focused ? colors.surface : colors.surfaceRaised,
            paddingHorizontal: spacing.md,
            paddingVertical: isMultiline ? spacing.md : 0,
          }}
        >
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={focused ? colors.primary : colors.textFaint}
            />
          ) : null}

          <TextInput
            ref={ref}
            {...inputProps}
            placeholderTextColor={colors.textFaint}
            secureTextEntry={isPassword && !revealed}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[
              {
                flex: 1,
                height: isMultiline ? undefined : "100%",
                minHeight: isMultiline ? MULTILINE_HEIGHT - spacing.md * 2 : undefined,
                textAlignVertical: isMultiline ? "top" : "center",
                fontSize: 16,
                color: colors.text,
              },
              // react-native-web renders a browser focus ring on top of the
              // themed border. Not in RN's style types, hence the cast.
              WEB_RESET,
            ]}
          />

          {suffix && !isPassword ? (
            <Text style={{ ...type.body, color: colors.textMuted }}>{suffix}</Text>
          ) : null}

          {isPassword && (
            <Pressable
              onPress={() => setRevealed((r) => !r)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t(
                revealed ? "auth.hidePassword" : "auth.showPassword",
              )}
            >
              <Ionicons
                name={revealed ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          )}
        </View>

        {error && (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
          >
            <Ionicons name="alert-circle" size={14} color={colors.danger} />
            <Text style={{ ...type.caption, color: colors.danger, flex: 1 }}>
              {error}
            </Text>
          </View>
        )}
      </View>
    );
  },
);

// forwardRef renders an anonymous function, which shows up as "ForwardRef" in
// React DevTools and error boundaries without this.
TextField.displayName = "TextField";
