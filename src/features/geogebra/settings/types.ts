export interface GgbPreferences {
  axes: boolean;
  grid: boolean;
  pointLabels: boolean;
  lineLabels: boolean;
  algebra: boolean;
  cas: boolean;
  spreadsheet: boolean;
  graphics2: boolean;
  graphics3d: boolean;
  inputBar: boolean;
  decimals: number;
  pointSize: number;
  pointColor: string;
  constrainedPointColor: string;
  dependentPointColor: string;
  pointColorMode: 'by-role' | 'uniform';
  lineThickness: number;
  lineColor: string;
  palette: string;
  stylePolicy: 'preserve' | 'override';
}

export interface ObjectStyle {
  label?: boolean;
  size?: number;
  color?: string;
}

/** Studio baseline plus explicit per-property overrides; old draft baselines remain valid. */
export type ManagedStyles = Record<string, ObjectStyle & { overrides?: ObjectStyle }>;
