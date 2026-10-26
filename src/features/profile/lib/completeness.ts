// src/features/profile/lib/completeness.ts
// How much of a profile is filled in, and what is still missing.
//
// NAMING — this is "complete your profile", NOT "get verified".
//
// `isVerifiedRealtor` already exists and means something much stronger: a
// passport, both sides, and a selfie holding it, reviewed by a human (see
// app/verify-profile.tsx). Calling a self-serve form "verification" would
// put two different badges behind one word, and the cheap one would quietly
// devalue the one that cost somebody a document check.
//
// So: a complete profile is a profile people can read. It is worth asking
// for because a listing with a face and a name beside it gets answered; it
// is not worth pretending is proof of anything.
import type { Profile } from "../api/profile.api";

/** The optional fields worth asking for, in the order the form asks them. */
export const PROFILE_STEPS = ["identity", "about", "reach"] as const;
export type ProfileStep = (typeof PROFILE_STEPS)[number];

export interface Completeness {
  /** 0–1, for the progress bar and the ring on the profile screen. */
  ratio: number;
  /** True once nothing worth asking for is missing. */
  complete: boolean;
  missing: {
    surname: boolean;
    gender: boolean;
    birthDate: boolean;
    bio: boolean;
  };
}

/**
 * What is missing from a profile.
 *
 * `name` and `phoneNumber` are not counted: an account cannot exist without
 * a phone, and the name is taken at sign-up, so including them would start
 * everybody at 40% for things they could not have skipped.
 *
 * The AVATAR is not counted either, and that is a deliberate softening. It
 * is still the single most useful thing on a profile — a buyer deciding
 * whether to ring a stranger looks at the face first — so the form still
 * asks for it, first, on its own step. But plenty of people will never
 * upload one, and a badge that a photograph alone can block is a badge most
 * accounts never reach, which makes it useless as a signal. Asked for,
 * not required.
 *
 * Address is deliberately absent too. It was removed from the profile — a
 * region/district code the server never showed anyone and never filtered
 * on, and the location card answers the same question better.
 */
export function completeness(profile: Profile | undefined): Completeness {
  const missing = {
    surname: !profile?.surname?.trim(),
    gender: !profile?.gender,
    birthDate: !profile?.birthDate,
    bio: !profile?.bio?.trim(),
  };

  const fields = Object.values(missing);
  const filled = fields.filter((isMissing) => !isMissing).length;

  return {
    ratio: fields.length ? filled / fields.length : 1,
    complete: filled === fields.length,
    missing,
  };
}

/**
 * Whether to offer the prompt at all.
 *
 * Only for an account that is genuinely bare — somebody who has filled in
 * most of it already should not be nagged over a missing bio. Half is the
 * line: below it the profile reads as empty to anyone who opens it.
 */
export function shouldPromptCompletion(profile: Profile | undefined): boolean {
  if (!profile) return false;
  return completeness(profile).ratio < 0.5;
}

/**
 * Which fields are missing, as translation keys, in the order the form asks
 * for them.
 *
 * The banner used to say only that something was missing, which leaves the
 * reader to open the form and compare it against their own memory. Naming
 * them turns "your profile is incomplete" into a to-do list two items long
 * — and usually shows that the thing standing between them and the badge is
 * one photograph.
 */
export const MISSING_LABELS = {
  surname: "completeProfile.fieldSurname",
  gender: "completeProfile.fieldGender",
  birthDate: "completeProfile.fieldBirthDate",
  bio: "completeProfile.fieldBio",
} as const satisfies Record<keyof Completeness["missing"], string>;

/** The missing ones, in form order, as keys the caller can translate. */
export function missingLabels(
  state: Completeness,
): (typeof MISSING_LABELS)[keyof typeof MISSING_LABELS][] {
  return (
    Object.keys(MISSING_LABELS) as (keyof Completeness["missing"])[]
  )
    .filter((field) => state.missing[field])
    .map((field) => MISSING_LABELS[field]);
}
