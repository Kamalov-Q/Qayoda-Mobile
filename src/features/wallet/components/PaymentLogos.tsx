import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { weight } from "@/src/theme/tokens";

export function UzcardLogo({ width = 32, height = 22 }: { width?: number; height?: number }) {
  return (
    <View style={[styles.cardBadge, { width, height, backgroundColor: "#0C2340" }]}>
      <Svg width={width * 0.7} height={height * 0.7} viewBox="0 0 24 24">
        <Path
          d="M6 4h4v9a2 2 0 0 0 4 0V4h4v9a6 6 0 0 1-12 0V4z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

export function HumoLogo({ width = 36, height = 22 }: { width?: number; height?: number }) {
  return (
    <View style={[styles.cardBadge, { width, height, backgroundColor: "#2D2926" }]}>
      <View style={styles.humoInner}>
        <View style={styles.humoGoldArc} />
        <Text style={styles.humoText}>HUMO</Text>
      </View>
    </View>
  );
}

export function VisaLogo({ width = 36, height = 22 }: { width?: number; height?: number }) {
  return (
    <View style={[styles.cardBadge, { width, height, backgroundColor: "#00579F" }]}>
      <Text style={styles.visaText}>VISA</Text>
    </View>
  );
}

export function MastercardLogo({ width = 36, height = 22 }: { width?: number; height?: number }) {
  return (
    <View style={[styles.cardBadge, { width, height, backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: "#E5E7EB" }]}>
      <Svg width={24} height={16} viewBox="0 0 32 20">
        <Circle cx="11" cy="10" r="8" fill="#EB001B" />
        <Circle cx="21" cy="10" r="8" fill="#F79E1B" fillOpacity="0.88" />
      </Svg>
    </View>
  );
}

export function UnionPayLogo({ width = 36, height = 22 }: { width?: number; height?: number }) {
  return (
    <View style={[styles.cardBadge, { width, height, backgroundColor: "#FFFFFF", borderWidth: 0.5, borderColor: "#E5E7EB", overflow: "hidden" }]}>
      <View style={styles.unionPayContainer}>
        <View style={[styles.unionStripe, { backgroundColor: "#D81E06" }]} />
        <View style={[styles.unionStripe, { backgroundColor: "#004B87" }]} />
        <View style={[styles.unionStripe, { backgroundColor: "#007F3E" }]} />
      </View>
      <Text style={styles.unionPayText}>UnionPay</Text>
    </View>
  );
}

export function PaymeBrand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const fontSize = size === "lg" ? 22 : size === "md" ? 18 : 14;
  return (
    <View style={styles.brandRow}>
      <Text style={[styles.paymeText, { fontSize }]}>payme</Text>
    </View>
  );
}

export function ClickBrand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const circleSize = size === "lg" ? 16 : size === "md" ? 14 : 11;
  const fontSize = size === "lg" ? 22 : size === "md" ? 18 : 14;

  return (
    <View style={styles.brandRow}>
      <Svg width={circleSize} height={circleSize} viewBox="0 0 16 16" style={{ marginRight: 6 }}>
        <Circle cx="8" cy="8" r="7" fill="#0073FF" />
        <Circle cx="8" cy="8" r="3.2" fill="#FFFFFF" />
      </Svg>
      <Text style={[styles.clickText, { fontSize }]}>click</Text>
    </View>
  );
}

export function UzumBrand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const fontSize = size === "lg" ? 22 : size === "md" ? 18 : 14;
  const dotSize = size === "lg" ? 7 : size === "md" ? 6 : 5;

  return (
    <View style={styles.brandRow}>
      <View style={[styles.uzumIcon, { width: fontSize + 2, height: fontSize + 2 }]}>
        <View style={[styles.uzumDot, { width: dotSize, height: dotSize, top: 1, left: 4 }]} />
        <View style={[styles.uzumDot, { width: dotSize, height: dotSize, top: 1, right: 4 }]} />
        <View style={[styles.uzumDot, { width: dotSize, height: dotSize, bottom: 2, left: 7 }]} />
      </View>
      <Text style={[styles.uzumText, { fontSize }]}>uzum</Text>
      <Text style={[styles.uzumPayText, { fontSize: fontSize * 0.85 }]}> pay</Text>
    </View>
  );
}

export function PaynetBrand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const fontSize = size === "lg" ? 20 : size === "md" ? 17 : 13;

  return (
    <View style={styles.brandRow}>
      <View style={styles.paynetBadge}>
        <Text style={styles.paynetP}>P</Text>
      </View>
      <Text style={[styles.paynetText, { fontSize }]}>paynet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardBadge: {
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  humoInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  humoGoldArc: {
    width: 6,
    height: 12,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    backgroundColor: "#F59E0B",
    marginRight: 2,
  },
  humoText: {
    color: "#FFFFFF",
    fontSize: 7.5,
    ...weight("900"),
    letterSpacing: 0.4,
  },
  visaText: {
    color: "#FFFFFF",
    fontSize: 9,
    ...weight("900"),
    fontStyle: "italic",
    letterSpacing: 0.5,
  },
  unionPayContainer: {
    position: "absolute",
    left: 2,
    top: 2,
    bottom: 2,
    flexDirection: "row",
    gap: 1,
    transform: [{ skewX: "-14deg" }],
  },
  unionStripe: {
    width: 2.5,
    height: "100%",
    borderRadius: 1,
  },
  unionPayText: {
    color: "#004B87",
    fontSize: 5.5,
    ...weight("800"),
    marginLeft: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  paymeText: {
    color: "#00BBC7",
    ...weight("800"),
    letterSpacing: -0.3,
  },
  clickText: {
    color: "#18181B",
    ...weight("800"),
    letterSpacing: -0.2,
  },
  uzumIcon: {
    position: "relative",
    marginRight: 4,
  },
  uzumDot: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "#7000FF",
  },
  uzumText: {
    color: "#7000FF",
    ...weight("900"),
    letterSpacing: -0.5,
  },
  uzumPayText: {
    color: "#18181B",
    ...weight("800"),
    letterSpacing: -0.2,
  },
  paynetBadge: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#00A859",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  paynetP: {
    color: "#FFFFFF",
    fontSize: 13,
    ...weight("900"),
  },
  paynetText: {
    color: "#00A859",
    ...weight("800"),
    letterSpacing: -0.2,
  },
});
