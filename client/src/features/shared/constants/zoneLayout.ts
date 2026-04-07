export const ZONE_LAYOUT = {
  HEADER_PERCENT: 0.25,
  MIDDLE_PERCENT: 0.40,
  SUB_BOTTOM_PERCENT: 0.10,
  FOOTER_PERCENT: 0.25,

  QR_INNER_MARGIN: 0.06,
  QR_INNER_MARGIN_EXPANDED: 0.08,
} as const;

export const ZONE_LAYOUT_CSS = {
  header: '25%',
  middle: '40%',
  subBottom: '10%',
  footer: '25%',
  qrInnerMargin: '6%',
  qrInnerMarginExpanded: '8%',
} as const;
