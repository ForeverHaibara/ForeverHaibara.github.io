export type ToolCategory = { readonly [name: string]: ToolCategory | readonly string[] };

// Leaves list canonical command names. A command may belong to multiple branches.
export const toolGroups: ToolCategory = {
  'Triangle centers': {
    'Named centers': [
      'TriangleCenter', 'Incenter', 'Excenter', 'Excenters', 'Centroid', 'Circumcenter', 'Orthocenter', 'NinePointCenter', 'SymmedianPoint',
      'GergonnePoint', 'NagelPoint', 'Mittenpunkt', 'SpiekerCenter', 'FeuerbachPoint', 'FermatPoint', 'IsodynamicPoint',
      'DeLongchampsPoint', 'BevanPoint', 'SoddyPoint'
    ],
    'Other distinguished points': [
      'Antipode', 'ArcMidpoint', 'OppositeArcMidpoint', 'HarmonicConjugate',
      'SteinerFoci', 'BrocardPoints',
      'MixtilinearContactPoint'
    ],
    'Point constructions and maps': [
      'IsogonalConjugate', 'IsotomicConjugate', 'Isoconjugate', 'Complement', 'Anticomplement', 'IsogonalComplement',
      'AntigonalConjugate', 'CyclocevianConjugate', 'TrilinearPole', 'AntiSteinerPoint',
      'Crosspoint', 'Cevapoint', 'CevaConjugate', 'CrossConjugate', 'CevianAffineMap', 'PedalAffineMap', 
      'HaggeInverse', 'CundyParryPhi', 'CundyParryPsi', 'LiangZelichPerspector',
      'CircumcevianPoint',
      'Orthopole', 'Orthocorrespondent', 'IsogonalPairWithMidpoint'
    ],
  },
  'Triangle constructions': {
    'Lines': {
      'Lines of the triangle': ['EulerLine', 'BrocardAxis', 'LemoineAxis', 'OrthicAxis'],
      'Lines from a point': ['TrilinearPolar', 'Orthotransversal', 'SimsonLine', 'SteinerLine'],
    },
    'Triangles': {
      'Triangles of the triangle':
      [
        'MedialTriangle', 'IntouchTriangle', 'TangentialTriangle',
        'GeminiTriangle',
      ],
      'Triangles from a point':
      [
       'OrthicTriangle', 'CevianTriangle', 'PedalTriangle', 'AnticevianTriangle',
        'CircumcevianTriangle',  'AntipedalTriangle', 'CarnotTriangle'
      ]
    },
    'Circles': {
      'Circles of the triangle': ['Excircle', 'Excircles', 'NinePointCircle',  'ApolloniusCircle', 'ApolloniusCircles', 'FuhrmannCircle', 'BrocardCircle', 'TaylorCircle', 'MixtilinearIncircle', 'MixtilinearIncircles', 'MixtilinearExcircle', 'MixtilinearExcircles'],
      'Circles from a point': ['HaggeCircle', 'PedalCircle'],
    },
    'Conics': {
      'Conics of the triangle': ['FeuerbachHyperbola', 'JerabekHyperbola', 'KiepertHyperbola', 'StammlerHyperbola', 'SteinerInellipse', 'SteinerCircumellipse'],
      'Conics from a point': ['InconicWithFocus', 'InconicWithCenter', 'OrthopolarConic'],
    },
    'Cubics': ['PivotalCubic', 'PivotalIsogonalCubic', 'PivotalIsotomicCubic', 'NonpivotalCubic', 'ConicoPivotalCubic', 'OrthopivotalCubic'],
    'Catalogue curves': ['GibertCurve'],
  },
  'Circles and conics': ['Conic', 'Pole', 'SecondIntersection', 'RadicalAxis', 'RadicalCenter', 'CoTf3', 'CoTf3Inv', 'SimilarityCenter', 'CommonTangents', 'NinePointConic', 'TangentParabola'],
  'Quadrangle or quadrilateral geometry': {
    'Quadrangles': ['DiagonalPoints', 'QAP2', 'QAP3', 'QAP4', 'QAP5', 'QL2P1', 'QL2P2', 'QL2P3', 'NinePointConic', 'QACu1', 'QACu1Inv'],
    'Quadrilaterals': ['MiquelPoint', 'QLP3', 'QLP4', 'QLP5', 'QLP6', 'QLP7', 'QLP20', 'QLP19', 'QLP21', 'QLCi3', 'NewtonLine', 'SteinerLineQ', 'QLCi5', 'QLCi6', 'TangentParabola', 'QLTf1', 'QLCu1', 'QLQu3'],
  },
  'Cubics': {
    'General constructions': ['Cubic', 'ConicLineCubic', 'CircularCubic', 'ThirdIntersection', 'Pretangential', 'CayleyBacharachPoint', 'CubicPencil', 'NodalCubic', 'Strophoid', 'CuspidalCubic', 'CubicAsymptotes', 'CubicInvolution'],
    'Polars and related constructions': ['Polar', 'PolarConic', 'MixedPolar', 'Poloconic', 'OrthicAxis', 'CircularPolarPoint'],
    'Hessian and related constructions': ['HessianCubic', 'HessianCorrespondent', 'PrehessianCubic', 'JacobianCubic'],
    'Special cubic families': ['QLCu1', 'QACu1', 'QACu1Inv', 'OrthopivotalCubic', 'NonpivotalCubic', 'ConicoPivotalCubic'],
  },
  'General constructions': ['Intersect', 'Pedal', 'HarmonicConjugate', 'TransferRatio', 'TrisectionPoint', 'GoldenSectionPoint', 'DirectSimilarity', 'OppositeSimilarity'],
};

export interface ReferenceExample {
  command: string;
  note?: string;
}

interface ReferenceNote {
  keywords?: string;
  details?: string[];
  examples?: ReferenceExample[];
  related?: string[];
}

// Use canonical names here, including the ! prefix for special commands.
// Signatures, descriptions and aliases come from the command registries.
export const referenceNotes: Readonly<Partial<Record<string, ReferenceNote>>> = {
  Pedal: {
    keywords: 'foot perpendicular projection 垂足 投影',
    examples: [{ command: 'Pedal(P, Line(A, B))', note: 'Projects P onto the line through A and B.' }],
    related: ['PedalTriangle', 'PedalCircle'],
  },
  PedalTriangle: {
    keywords: 'foot perpendicular projection 垂足 垂足三角形 投影',
    details: [
      'At the top level the four-argument form creates three independent points, in the order BC, CA, AB. An assignment names the first point.',
      'Use the five-argument form to select one point. Indices 1, 2 and 3 select BC, CA and AB respectively. A nested call without an index uses the first point.',
    ],
    examples: [{ command: 'PedalTriangle(A, B, C, P, 1)', note: 'With four existing points, constructs just the projection of P onto BC.' }],
    related: ['Pedal', 'PedalCircle', 'OrthicTriangle'],
  },
  PedalCircle: { keywords: 'foot projection 垂足 垂足圆', related: ['PedalTriangle', 'SimsonLine'] },
  Orthocenter: {
    keywords: 'altitude intersection 垂心',
    examples: [{ command: 'Orthocenter(A, B, C)', note: 'Constructs the orthocenter of the existing triangle ABC.' }],
    related: ['Circumcenter', 'EulerLine', 'NinePointCenter'],
  },
  Incenter: { keywords: 'angle bisector incircle 内心 内切圆', related: ['Excenter', 'IntouchTriangle'] },
  Circumcenter: { keywords: 'perpendicular bisector 外心 外接圆', related: ['Orthocenter', 'EulerLine'] },
  Centroid: { keywords: 'median barycenter 重心 中线', related: ['MedialTriangle', 'EulerLine'] },
  ArcMidpoint: { keywords: 'arc midpoint 弧中点', related: ['OppositeArcMidpoint'] },
  TriangleCenter: {
    keywords: 'ETC encyclopedia triangle centre 三角形中心 编号',
    details: [
      'Use a literal integer to request a reviewed extension or a patched native center. Unpatched native indices and computed selectors use the native GeoGebra command.',
      'An extended index needs a supported recipe. A center at infinity does not produce a finite point when requested directly.',
    ],
    examples: [{ command: 'TriangleCenter(A, B, C, 2)', note: 'Constructs ETC X(2), the centroid of ABC.' }],
    related: ['Centroid', '!nearestTriangleCenter'],
  },
  GibertCurve: {
    keywords: 'catalogue catalog implicit quartic quintic sextic septic octic nonic 曲线',
    details: [
      'Use a supported literal number such as 12 or a quoted catalogue ID such as "Q012" or "Q036A". The selector cannot be a slider or an arithmetic expression.',
      'Use Medium or High custom tool performance and a fresh output label. To replace an existing result, delete it and recreate it.',
    ],
    examples: [{ command: 'g = GibertCurve(A, B, C, "Q012")', note: 'Choose an unused label in place of g if needed.' }],
  },
  Conic: {
    keywords: 'tangent line ellipse parabola hyperbola 二次曲线 圆锥曲线',
    details: [
      'The extended forms accept five point or tangent-line constraints. Segments and rays use their supporting lines. Mixed constraints can produce two or four independent solutions. Use the 1-based index to select a slot, which can be undefined.',
      'The native five-point and coefficient forms remain available.',
    ],
    related: ['Pole', 'SecondIntersection'],
  },
  Intersect: {
    keywords: 'intersection supporting lines 交点',
    details: ['The four-point form intersects the infinite lines AB and CD. Other signatures use the native GeoGebra command.'],
    examples: [{ command: 'Intersect(A, B, C, D)', note: 'Uses four existing points to define the two lines.' }],
  },
  Cubic: {
    keywords: 'interpolation third degree 三次曲线',
    details: ['The extension constructs a cubic through nine points. The native triangle-and-index form remains available.'],
    related: ['CircularCubic', 'HessianCubic', 'ThirdIntersection'],
  },
  Polar: {
    details: ['With a cubic, the extension returns the second polar line. Native conic polar and pole forms remain available.'],
    related: ['PolarConic', 'MixedPolar', 'Pole'],
  },
  ThirdIntersection: {
    keywords: 'tangential tangent residual 第三交点 切点',
    examples: [{ command: 'ThirdIntersection(F, P, Q)', note: 'F is a cubic and P and Q are known points on the secant.' }],
    related: ['Pretangential', 'CubicInvolution'],
  },
  '!nearestTriangleCenter': {
    keywords: 'ETC nearest closest numerical search 最近 三角形中心',
    details: [
      'Reads four defined 2D points and requires a nondegenerate triangle. The JSON result gives the nearest supported finite ETC center and its distance to P.',
      'The result describes the current coordinates. Run the command again after moving a point.',
    ],
    examples: [{ command: '!nearestTriangleCenter(A, B, C, P)', note: 'Searches for the center nearest to the existing point P.' }],
    related: ['TriangleCenter'],
  },
};
