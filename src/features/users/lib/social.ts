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

/** The hosts each platform is known by, for recognising a pasted link. */
const HOSTS = {
  tiktok: /^(www\.)?tiktok\.com$/i,
  instagram: /^(www\.)?instagram\.com$/i,
  facebook: /^(www\.)?(facebook\.com|fb\.com|fb\.me)$/i,
  x: /^(www\.)?(x\.com|twitter\.com)$/i,
  threads: /^(www\.)?(threads\.net|threads\.com)$/i,
  whatsapp: /^(www\.|api\.)?(wa\.me|whatsapp\.com)$/i,
} as const satisfies Record<SocialPlatform, RegExp>;

/** Local mobile numbers are nine digits here; wa.me needs the country code. */
const UZ_DIALING_CODE = "998";
const UZ_LOCAL_DIGITS = 9;

/**
 * One account, written the one way.
 *
 * People type whatever they have: `@name`, `name`, the full link, or the
 * link with the `https://` rubbed off. Storing all four verbatim meant the
 * same account could be held four ways — and a scheme-less link was the one
 * that actually broke, because it is not a URL and not a handle, so it got
 * pasted onto the end of the base and produced
 * `instagram.com/instagram.com/name`.
 *
 * So handles are canonicalised on the way in: no @, no host, no query. The
 * renderer stays tolerant of the old shapes, because rows written before
 * this still hold them.
 */
export function normalizeSocial(platform: SocialPlatform, raw: string): string {
  let value = raw.trim();
  if (!value) return "";

  // A pasted link, with or without a scheme. The trailing slash is required
  // so that a handle which merely contains a dot ("john.doe") is left alone.
  const asUrl = /^(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})\/(.*)$/i.exec(value);
  if (asUrl && HOSTS[platform].test(asUrl[1])) {
    // wa.me puts the number in the path, api.whatsapp.com in the query.
    const phone = /[?&]phone=(\d+)/i.exec(value);
    value = phone ? phone[1] : asUrl[2];
  }

  // Anything after the handle itself: ?igsh=..., #fragment, a trailing slash.
  value = value.split(/[?#]/)[0].replace(/\/+$/, "");

  if (platform === "whatsapp") {
    const digits = value.replace(/\D/g, "");
    // A bare local number is unreachable without the country code, and
    // somebody typing nine digits means their own number, not a foreign one.
    return digits.length === UZ_LOCAL_DIGITS
      ? `${UZ_DIALING_CODE}${digits}`
      : digits;
  }

  // Repeated, because "@@name" happens when a paste lands in a field that
  // already shows the @ the placeholder asked for.
  return value.replace(/^@+/, "");
}

/**
 * The URL to open for one entry.
 *
 * Normalises first, so a value stored before handles were canonicalised —
 * an @handle, a full link, a scheme-less one — still resolves to the same
 * place as a freshly written one.
 */
export function socialUrl(
  platform: SocialPlatform,
  value: string,
): string | null {
  const handle = normalizeSocial(platform, value);
  if (!handle) return null;

  return `${BASE[platform]}${handle}`;
}
