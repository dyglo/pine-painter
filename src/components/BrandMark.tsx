import type { SVGProps } from "react";
import { BRAND } from "@/lib/branding";

export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}>
      <path d={BRAND.monogramPath} />
    </svg>
  );
}
