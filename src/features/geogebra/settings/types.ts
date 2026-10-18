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

/** Last values written by the studio, not a copy of the user's object styles. */
export type ManagedStyles = Record<string, Partial<Record<'label' | 'size' | 'color', string | number | boolean>>>;
