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
      'Orthopole', 'Orthocorrespondent', 'IsogonalPairWithMidpoint', 'Trilinear'
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
      ],
      'Correspondence': ['Perspector', 'OrthologyCenter', 'PascalLine', 'QuasiperspectiveConic'],
    },
    'Circles': {
      'Circles of the triangle': ['Incircle', 'Excircle', 'Excircles', 'NinePointCircle',  'ApolloniusCircle', 'ApolloniusCircles', 'FuhrmannCircle', 'BrocardCircle', 'TaylorCircle', 'MixtilinearIncircle', 'MixtilinearIncircles', 'MixtilinearExcircle', 'MixtilinearExcircles'],
      'Circles from a point': ['HaggeCircle', 'PedalCircle'],
    },
    'Conics': {
      'Conics of the triangle': ['FeuerbachHyperbola', 'JerabekHyperbola', 'KiepertHyperbola', 'StammlerHyperbola', 'SteinerInellipse', 'SteinerCircumellipse'],
      'Conics from a point': ['InconicWithFocus', 'InconicWithCenter', 'OrthopolarConic'],
    },
    'Cubics': ['PivotalCubic', 'PivotalIsogonalCubic', 'PivotalIsotomicCubic', 'NonpivotalCubic', 'ConicoPivotalCubic', 'OrthopivotalCubic'],
    'Catalogue curves': ['GibertCurve', 'TriangleCurve'],
  },
  'Circles and conics': {
    'General constructions': [
      'Circle', 'Conic', 'Ellipse', 'Hyperbola', 'Parabola',
      'InconicWithFocus', 'InconicWithCenter',
      'NinePointConic', 'TangentParabola', 'ConicPencil'
    ],
    'Components': ['Center', 'Axes', 'MajorAxis', 'MinorAxis', 'Focus', 'Directrix'],
    'Conical transformations': ['SecondIntersection', 'Pole', 'Polar', 'Tangent', 'ConjugateDiameter', 'CoTf3', 'CoTf3Inv', 'OsculatingCircle'],
    'Interrelations': ['RadicalAxis', 'RadicalCenter', 'SimilarityCenter', 'CommonTangents', 'CoaxialLimitingPoints'],
    'Measurements and coefficients': ['Coefficients', 'Radius', 'Circumference', 'Eccentricity', 'LinearEccentricity', 'SemiMajorAxisLength', 'SemiMinorAxisLength', 'Curvature', 'Parameter'],
    'Arcs and sectors': ['Arc', 'CircularArc', 'CircularSector', 'CircumcircularArc', 'CircumcircularSector', 'Sector', 'Semicircle'],
  },
  'Quadri or poly geometry': {
    'Quadrangles': ['DiagonalPoints', 'QAP2', 'QAP3', 'QAP4', 'QAP5', 'QL2P1', 'QL2P2', 'QL2P3', 'NinePointConic', 'QACu1', 'QACu1Inv'],
    'Quadrilaterals': ['MiquelPoint', 'QLP3', 'QLP4', 'QLP5', 'QLP6', 'QLP7', 'QLP19', 'QLP20', 'QLP21', 'QLCi3', 'NewtonLine', 'SteinerLineQ', 'QLCi5', 'QLCi6', 'TangentParabola', 'QLTf1', 'QLCu1', 'QLQu3'],
    'Polygons': ['Polygon', 'Polyline', 'RigidPolygon', 'Vertex', 'Centroid', 'Area', 'Perimeter', 'InteriorAngles', 'Union', 'Difference', 'IntersectPath'],
  },
  'Cubics': {
    'General constructions': ['Cubic', 'ConicLineCubic', 'CircularCubic', 'ThirdIntersection', 'Pretangential', 'CayleyBacharachPoint', 'CubicPencil', 'NodalCubic', 'Strophoid', 'CuspidalCubic', 'CubicAsymptotes', 'CubicInvolution'],
    'Polars and related constructions': ['Polar', 'PolarConic', 'MixedPolar', 'Poloconic', 'OrthicAxis', 'CircularPolarPoint'],
    'Hessian and related constructions': ['HessianCubic', 'HessianCorrespondent', 'PrehessianCubic', 'JacobianCubic'],
    'Special cubic families': ['QLCu1', 'QACu1', 'QACu1Inv', 'OrthopivotalCubic', 'NonpivotalCubic', 'ConicoPivotalCubic'],
  },
  'General constructions': {
    'Basics': ['Point', 'Midpoint', 'Intersect', 'Pedal',
      'Line', 'Ray', 'Segment', 'AngleBisector', 'PerpendicularBisector', 'PerpendicularLine'],
    'Projective geometry': ['HarmonicConjugate', 'Collineation', 'Affine', 'Involution', 'InvolutionCenter', 'PascalLine', 'TransferRatio', 'TrisectionPoint', 'GoldenSectionPoint'],
    'Numerics': ['Type', 'Distance', 'Length', 'Angle', 'Slope', 'Direction', 'AffineRatio', 'CrossRatio'],
    'Loci and envelopes': ['Locus', 'Envelope'],
    'Similarities': ['DirectSimilarity', 'OppositeSimilarity'],
  },
};

