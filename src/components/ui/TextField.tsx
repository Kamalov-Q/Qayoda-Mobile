import { forwardRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  Pressable,
  Platform,
  type TextInputInstance,
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
  /** Leading static text, e.g. a country code the user does not type. */
  prefix?: string;
  /** Muted line under the field when there is no error to show instead. */
  hint?: string;
  /**
   * Marks the label with a red asterisk.
   *
   * Only the required fields are marked — the optional ones say nothing,
   * which is shorter to read than labelling every one of them "optional"
   * and leaves the eye only the few things it must fill in.
   */
  required?: boolean;
  /**
   * Full-pill corners instead of the usual soft rectangle.
   *
   * For a field that floats over content rather than sitting in a form — the
   * search box on the map, where a rectangle reads as a panel edge and a
   * pill reads as something laid on top.
   */
  round?: boolean;
}

export const TextField = forwardRef<TextInputInstance, Props>(
  (
    { label, error, icon, suffix, prefix, hint, required, round, secureTextEntry, onFocus, onBlur, ...inputProps },
    ref,
  ) => {
    const { colors } = useTheme();
    const t = useT();
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);

    const isPassword = !!secureTextEntry;
    // A multiline field grows instead of sitting at the fixed control height,
    // and its content has to start at the top rather than being centred.
    const isMultiline = !!inputProps.multiline;

    // TextInput's own placeholder is clipped at the field's edge with no
    // ellipsis and no way to shrink it, so a search box sharing its row with
    // a back button and a funnel showed half a sentence. On one line we draw
    // the placeholder ourselves and let it scale down to fit; the field keeps
    // TextInput's placeholder when it is multiline, where there is room.
    const { placeholder } = inputProps;
    const ownPlaceholder = !isMultiline && !!placeholder && !inputProps.value;

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
          <Text style={{ ...type.label, color: colors.textMuted }}>
            {label}
            {required ? (
              <Text style={{ color: colors.danger }}> *</Text>
            ) : null}
          </Text>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: isMultiline ? "flex-start" : "center",
            gap: spacing.sm,
            height: isMultiline ? undefined : sizing.control,
            minHeight: isMultiline ? MULTILINE_HEIGHT : undefined,
            borderRadius: round ? radii.pill : radii.md,
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

          {prefix ? (
            <Text style={{ ...type.body, color: colors.textMuted }}>{prefix}</Text>
          ) : null}

          {/* Wrapper so the drawn placeholder can be positioned over the
              input; it is transparent to layout and to touches. */}
          <View
            style={{
              flex: 1,
              alignSelf: "stretch",
              justifyContent: isMultiline ? "flex-start" : "center",
            }}
          >
            <TextInput
              ref={ref}
              {...inputProps}
              placeholder={ownPlaceholder ? undefined : placeholder}
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

            {ownPlaceholder ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  justifyContent: "center",
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={{ fontSize: 16, color: colors.textFaint }}
                >
                  {placeholder}
                </Text>
              </View>
            ) : null}
          </View>

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

        {!error && hint ? (
          <Text style={{ ...type.caption, color: colors.textMuted }}>{hint}</Text>
        ) : null}

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
