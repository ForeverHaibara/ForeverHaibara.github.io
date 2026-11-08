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

