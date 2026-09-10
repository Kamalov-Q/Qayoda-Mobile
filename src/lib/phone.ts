// src/lib/phone.ts — one home for Uzbek mobile number handling, shared by
// every screen with a phone field so they all accept and reject the same
// things. The server applies the same operator rule, so anything that passes
// here passes there.

/** Operator prefixes actually in service (Beeline, Ucell, UMS/Mobiuz, Uzmobile,
 *  Perfectum, Humans). `9\d` covers the whole 90–99 range. */
const OPERATOR = /^(20|33|50|55|77|88|9\d)$/;

export const digitsOf = (v: string) => v.replace(/\D/g, "");

/** Bare 9-digit local part, from anything the user typed or pasted. */
export const localPart = (v: string) => {
  const d = digitsOf(v);
  return d.startsWith("998") ? d.slice(3) : d;
};

/** Valid Uzbek mobile: 9 digits behind an in-service operator prefix. */
export const isUzMobile = (v: string) => {
  const local = localPart(v);
  return local.length === 9 && OPERATOR.test(local.slice(0, 2));
};

/** What the server stores and screens display: +998XXXXXXXXX. */
export const normalizePhone = (v: string) => `+998${localPart(v)}`;

/** +998901234567 → "+998 90 123 45 67" for read-only display. */
export const prettyPhone = (p: string) =>
  p.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, "+998 $1 $2 $3 $4");

/**
 * As-you-type mask for the field behind a fixed "+998" prefix: keeps digits
 * only, drops a pasted country code, caps at 9 digits, and groups them
 * "90 123 45 67" so the number is checkable against the SMS at a glance.
 */
export const formatUzPhoneInput = (v: string) => {
  const d = localPart(v).slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)]
    .filter(Boolean)
    .join(" ");
};
