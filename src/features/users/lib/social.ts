import { Ionicons } from "@expo/vector-icons";

/**
 * The six accounts a profile can advertise, in the order they are shown.
 * Mirrors SOCIAL_PLATFORMS on the server — adding one means a change here,
 * there, and nowhere else.
 */
export const SOCIAL_PLATFORMS = [
  "tiktok",
  "instagram",
  "facebook",
  "x",
  "threads",
  "whatsapp",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export const SOCIAL_ICONS = {
  tiktok: "logo-tiktok",
  instagram: "logo-instagram",
  facebook: "logo-facebook",
  x: "logo-x",
  threads: "logo-threads",
  whatsapp: "logo-whatsapp",
} as const satisfies Record<SocialPlatform, keyof typeof Ionicons.glyphMap>;

/** Each platform's own colour, for the icon row. */
export const SOCIAL_COLORS = {
  tiktok: "#000000",
  instagram: "#E1306C",
  facebook: "#1877F2",
  x: "#000000",
  threads: "#000000",
  whatsapp: "#25D366",
} as const satisfies Record<SocialPlatform, string>;

/** What the field asks for, so nobody has to guess whether to paste a URL. */
export const SOCIAL_PLACEHOLDERS = {
  tiktok: "@username",
  instagram: "@username",
  facebook: "username",
  x: "@username",
  threads: "@username",
  whatsapp: "+998901234567",
} as const satisfies Record<SocialPlatform, string>;

const BASE = {
  tiktok: "https://tiktok.com/@",
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  x: "https://x.com/",
  threads: "https://threads.net/@",
  whatsapp: "https://wa.me/",
} as const satisfies Record<SocialPlatform, string>;

/**
 * The URL to open for one entry.
 *
 * People paste whatever they have — a bare handle, an @handle, or the full
 * link they copied from the app — and all three are reasonable things to
 * type, so the server stores them verbatim and this decides at render time.
 * WhatsApp is the odd one: wa.me wants digits only, so punctuation goes.
 */
export function socialUrl(
  platform: SocialPlatform,
  value: string,
): string | null {
  const handle = value.trim();
  if (!handle) return null;

  // Already a link — trust it rather than mangling it into a double prefix.
  if (/^https?:\/\//i.test(handle)) return handle;

  if (platform === "whatsapp") {
    const digits = handle.replace(/[^\d]/g, "");
    return digits ? `${BASE.whatsapp}${digits}` : null;
  }

  return `${BASE[platform]}${handle.replace(/^@/, "")}`;
}
