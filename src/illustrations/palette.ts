/**
 * The single colour system for every Gaskin pictogram and handout.
 * Chosen so that each pair used side by side differs in lightness as well as
 * hue, which keeps the drawings readable when printed in black and white.
 */
export const PALETTE = {
  /** Cream disc behind every pictogram */
  disc: '#F5E7CF',
  /** Slightly darker cream for ground shadows and secondary fills */
  discShade: '#E8D2AE',
  /** Off-white for paper, cloth, enamel */
  paper: '#FFFBF2',
  /** Ink outline, used at 2-3.5 px */
  ink: '#2A1C15',
  /** Clay / terracotta accent */
  clay: '#C0603A',
  clayLight: '#E3A07A',
  /** Deep green */
  green: '#2E6A4D',
  greenLight: '#79AA80',
  /** Soft gold */
  gold: '#E3AE4A',
  goldLight: '#F4D795',
  /** Alert red-orange, reserved for danger badges and blood */
  alert: '#E0442A',
  /** A muted water blue, used only for water and the net */
  water: '#8EBFC8',
  /** Warm skin tones, darkest to lightest */
  skin1: '#5A321E',
  skin2: '#7B4529',
  skin3: '#9C5F3A',
  skin4: '#BC7E50',
  /** Liver / dark meat */
  meat: '#7E3326',
  /** Hair */
  hair: '#24170F',
  /** Grey-white for older women's headwraps and metal */
  silver: '#D9D2C6',
} as const;

export type PaletteColour = keyof typeof PALETTE;
