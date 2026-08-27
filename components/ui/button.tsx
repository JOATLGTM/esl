import Link from "next/link";
import type { ComponentProps } from "react";

/*
 * One button, two weights.
 *
 * `min-h-14` is the load-bearing number. PRD 7 asks for thumb-reachable,
 * one-handed operation on a 360px phone, and 56px is comfortably past the 44px
 * accessibility floor -- which matters more than usual here, because this is
 * often being tapped while audio plays and the learner is looking somewhere else.
 */

const base =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 " +
  "text-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  primary: "bg-primary text-primary-ink hover:opacity-90",
  secondary: "border-2 border-line bg-surface text-ink hover:border-primary",
  quiet: "text-muted underline underline-offset-4 hover:text-ink min-h-11 font-medium text-base",
} as const;

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
