/** Single source for product identity and the geometric, open-stem D mark. */
export const BRAND = {
  name: "Deplyze Quant",
  description: "Create, refine and test Pine Script indicators in your trading workspace.",
  monogramPath: "M5 4h10a12 12 0 0 1 0 24H5v-5h10a7 7 0 0 0 0-14H5V4Zm0 8h5v8H5v-8Z",
} as const;
export const brandSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" role="img" aria-label="${BRAND.name}"><path fill="currentColor" d="${BRAND.monogramPath}"/></svg>`;
export const brandIcon = `data:image/svg+xml,${encodeURIComponent(brandSvg.replace('fill="currentColor"', 'fill="#b5b9c0"'))}`;
