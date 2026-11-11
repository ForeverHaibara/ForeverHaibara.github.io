# 无穷远点输入计划

状态为待实现。只在几何角色明确的槽中用直线表示无穷远方向。以 Euler 线为例，`CevianTriangle(A,B,C,EulerLine(A,B,C))` 应生成平行于 Euler 线的三条塞瓦线在对边上的迹点。它对应 ETC 的 X(30)。等边三角形没有唯一的 Euler 线方向，应沿用输入线未定义的行为。[ETC X(30)](https://faculty.evansville.edu/ck6/encyclopedia/part1.html#X30)

## 接口约定

- 表中的 † 表示该槽拟接受 `pointOrLine`。按角色逐槽决定。变换的**被映射点、被求共轭点或被反演点**继续用 `point`，因为同位置的线很容易被读作实线的像。优先审核负责定义变换的枢点、极和标定点，即使它们在参数中间。
- 塞瓦三角形、塞瓦圆等构造中，末点负责确定一组连接线。这个角色有明确的方向延拓，可以保留在候选表中。参考三角形顶点继续用有限点，编号和比例仍为数值。例如 `CevianTriangle(A,B,C,l,2)` 仍取第二槽。
- 直线、线段、射线均取支撑线方向，复用已有射影工具的约定。对支撑线 `ax+by+c=0` 取齐次点 `(b:−a:0)`。平移支撑线、反向输入或改变线段长度应得到同一构造。保留原有线重载的含义，详见暂缓表。
- 返回类型和多输出顺序沿用现有契约。只有最终像有限时才生成有限点，只有最终线可在仿射平面中表示时才生成原生线。理想像、无唯一解或全零系数用 undefined 表示，已有的 conic 工具仍可表达可见的直线退化。逐槽处理，保持编号、参数展开和解包命名稳定。
- 用户用线来提供方向。本期无需更改 `TriangleCenter` 的返回类型，也不依靠引擎对原生无穷远点标签的分类。已有 `CollineationL` 和 `InvolutionL` 的方向重载可作类型分派与交互对照。

## 首批候选

| 命令与拟开放的槽 | 延拓算法与预期结果 |
| --- | --- |
| `CevianTriangle(A,B,C,P†[,i])` | A 槽为 `(0:p_B:p_C)`，其余循环。也可在齐次坐标求 `AP∩BC`。方向平行 BC 时 A 槽为无穷远点，其他槽仍独立计算。 |
| `AnticevianTriangle(A,B,C,P†[,i])` | 复用 `(−p_A:p_B:p_C)` 及循环式。理想输入的 A 槽有限化分母为 `−2p_A`，为零时只影响该槽。 |
| `CocevianTriangle(A,B,C,P†[,i])` | 复用 `(0:p_B:−p_C)`。无需先建立有限塞瓦迹点，平行于 BC 的方向仍可给出有限 A 槽。 |
| `CircumcevianPoint(A,B,C,P†)`、`CircumcevianTriangle(A,B,C,P†[,i])` | 从 A 沿输入方向取外接圆的另一交点。以外心 O 和方向向量 d 表示时，直接取 `A+2[(O−A)·d]d/|d|²`，另两槽循环。切向时该槽返回原顶点。 |
| `CevianCircle(A,B,C,P†)` | 继续使用现有塞瓦迹点的齐次限制式。世界坐标的二次项须乘参考三角形行列式，现有有限输入用的 `sum(p)` 在理想输入时为零，不能代替它。保留本来就应出现的直线极限。 |
| `Isoconjugate(A,B,C,P†,U)` | P 是 ETC 的共轭枢点，U 是被求共轭的有限点。输出第 i 项仍为 `a_i³ p_j p_k u_j u_k`。X(30)-isoconjugate of U 写成 `Isoconjugate(A,B,C,EulerLine(A,B,C),U)`。五点式对两个有限点有交换对称性，方向重载按公开参数角色分派。 |
| `Isoconjugate(A,B,C,X†,Y†,P)` | X 和 Y 是标定点，各自可给方向。计算 `x_i y_i p_j p_k`，P 保持有限。核对方向标定后映射是否仍为非退化等度共轭，以及两个相同方向标定的固定点特例。 |
| `ReciprocalConjugate(A,B,C,P†,Q)` | P 定义倒数权，Q 是有限运算点。复用重心→P 的六点式，直接给出重心分量 `p_i q_j q_k`。 |
| `CevaConjugate(A,B,C,X†,P)`、`CrossConjugate(A,B,C,X†,P)` | X 定义共轭变换，P 是有限运算点。复用现有循环权式，单独核对理想枢点下的有限像与基点。 |
| `CrossCevianTriangle(A,B,C,P†,Q[,i])` | P 定义内层塞瓦三角形，Q 仍是有限点。直接使用内层迹点的齐次权式，即使其中某槽为理想点也不先转成原生点。 |

## 第二批候选

| 命令与拟开放的槽 | 算法及验证重点 |
| --- | --- |
| `ComplementaryConjugate`、`AnticomplementaryConjugate`、`LineConjugate`、`HirstInverse` | 审核 `(A,B,C,P†,Q)` 中定义变换或二次曲线的 P。Q 保持有限。互补两种的四点式继续使用内心作枢点。核对理想枢点下的齐次尺度和最终像。 |
| `AlephConjugate`、`BethConjugate`、`GimelConjugate`、`DalethConjugate`、`HeConjugate`、`WawConjugate`、`ZayinConjugate` | 逐式审核第四槽枢点，末点 Q 保持有限。原有以枢点重心分量和判断退化的代码需改用参考标架。Gimel 还需独立计算参考三角形面积平方，保持对枢点齐次缩放不变。 |
| `GibertPsi(A,B,C,P†,Q)` | 只研究双曲线束中心 P。P 理想时曲线束可能退化并有公共分量，需先验证共轭仍有唯一像。Q 及省略枢点的四参数重载保持有限。 |
| `InconicWithCenter(A,B,C,P†)`、`InconicWithFocus(A,B,C,P†)` | 一般方向对应内切抛物线。中心式可从现有齐次切触系数推导。焦点式先由方向取得有限等角像 F，再以 F 及其 Steiner 线作抛物线。两种算法在同一方向应一致，并核对方向平行参考边时的退化。[内切抛物线的焦点和准线](https://bernard-gibert.fr/curves/q078.html) |
| `OrthopolarConic(A,B,C,P†)` | 理想输入的线束是一族平行线。移动其中一条线时，各垂足沿同一法向等量平移，垂极点也同量平移。其轨迹是经过任一代表支撑线垂极点的法向直线，可继续按 conic 输出。用不同平行代表线核对结果不变。 |
| `HaggeCircle(A,B,C,P†)` | P 定义圆。理想点的等角像 F 在外接圆上，关于九点中心反射后为 `O+H−F`，以该点为心、以外接半径作圆。优先验收方向平行边时 F 为顶点的情形。 |
| `PivotalCubic`、`PivotalIsogonalCubic`、`PivotalIsotomicCubic`、`NonpivotalCubic`、`ConicoPivotalCubic`、`OrthopivotalCubic` | 曲线工具独立成批，按参数角色审核 pole、pivot、root。它们定义曲线而非接受被映射对象。六参数 `NonpivotalCubic` 的通过点 Q 保持有限，以免实线被理解为曲线应含的分量。各式须核对恒零、降次和基点。 |

## 暂缓或保持现状

| 命令 | 理由 |
| --- | --- |
| `IsogonalConjugate`、`IsotomicConjugate` | 四参数线重载已经表示该实线的共轭 conic 像。不得占用该签名或改变现有分派。 |
| `Collineation`、`Involution`、`TrilinearImage` 的末槽 | 保持被映射点为有限点。平面射影工具已有的中间标定槽继续接受方向。已上线的 `CollineationL`、`InvolutionL` 方向重载保留。 |
| `PolarConjugate`、`IsogonalComplement`、`CyclocevianConjugate`、`HaggeInverse`、`CST`、`GST`、`GSC`、`OrionTransform`、`OrionConjugate`、`CundyParryPhi`、`CundyParryPsi`、`LiangZelichPerspector`、`Orthojoin` | 只有一个运算点，即使某些方向的齐次极限有限，也暂不接收直线。 |
| `Cevapoint`、`Crosspoint`、`CrossSum`、`CrossDifference`、`VertexConjugate` | 输入点的角色对称或没有明确枢点，暂不把任一槽单独改成方向入口。 |
| `TrilinearPolar` | 线可能被理解为要配极的对象。本期保持点输入，并沿用 `TrilinearPole` 处理实线。 |
| `Orthopole`、`AntiSteinerPoint`、`TrilinearPole`、`SecondIntersection` 的线重载，以及原生 `Polar`、`Conic`、`QLTf1` 的线重载 | 线是构造对象，位置通常参与算法。按方向解释会改变现有几何语义。 |
| `CircularCubic`、`NodalCubic`、`CuspidalCubic`、`Strophoid` 的已有线重载 | 线参数已用作方向、切线或其他曲线约束。保留各自语义，本期不把这些槽统一改称理想点输入。 |
| `Complement`、`Anticomplement`、`Affine`、`AffineL`、`OrionPivot` | 仿射映射把理想点送到理想点，现有点输出无法显示其像。 |
| `AntigonalConjugate`、`Syngonal`、`AntitomicConjugate` | 现有齐次式在一般无穷远方向给回理想点，开放后通常没有可用有限输出。 |
| `PedalTriangle`、`PedalCircle`、`AntipedalTriangle`、`CarnotTriangle`、`ReflectionTriangle` 的动点重载，`SimsonLine`、`SteinerLine`、`Isoscelizer` | 一般方向下投影、反射、圆心或有关直线趋于无穷远。个别方向的可去极限需要独立审查。 |
| `Orthotransversal`、`Orthocorrespondent`、`CircumperpConjugate`、`HaimovTriangle`、`HarmonicConjugate` | 分别涉及无穷远线、重心、外心、参考顶点组或中点等简单极限。保留作后续一致性候选。 |
| `IsogonalPairWithMidpoint`、`CevianAffineMap`、`PedalAffineMap` | 焦点对涉及有限与理想槽混合。两种仿射映射的末点保持有限。CevianAffineMap 的中间点理想时，需检查三个迹点能否构成有限目标标架。PedalAffineMap 的中间点理想时，一般垂足本身趋于无穷远，缺少有限目标标架。 |
| 四边形、四角形和一般多点定曲线工具的框架顶点 | 逐个允许框架顶点理想化会改变构造对象的约束。平面射影标定重载已有自己的明确契约。 |

## 齐次内核与验收

1. 抽出共用的方向点读取器，复用 `supportingLine`。现有 `homogeneous(line)` 返回线的协向量，继续留给线构造。另一个入口专门在点角色下返回 `(x:y:1)` 或 `(b:−a:0)`。
2. 参考 ABC 用有限顶点组成标架。动点的齐次重心取 `(det(B,C,P):det(C,A,P):det(A,B,P))`，其中列向量是世界齐次坐标。有限输入还原现有 `triangleAreas`。标架是否退化由 `det(A,B,C)` 判断。动点分量和为零只表示它是理想点。
3. 用 `A=(0,0), B=(4,0), C=(0,3)` 作可重复基准。Euler 方向取 `(4,3)`，重心为 `(−2:1:1)`。三个塞瓦迹点依次是 `(2,1.5)`、`(0,−3)`、`(−4,0)`。五点 `Isoconjugate` 第四槽取 Euler 线，末槽取重心坐标 `(2:3:4)` 的有限点，重心像可取 `(−125/4:9:16)`。六点式的 X、Y 同取 Euler 方向时，同一有限输入的重心像为 `(24:4:3)`。再验收将有限标定点送到理想标定点的情形，在有限化前检查齐次像。
4. 用互相平行的两条不同支撑线、反向射线和等方向线段核对结果。对照 `P=O+t d` 在两侧趋于无穷远的输出，测试平行边方向、直角与等边标架、重合线、非唯一解和最终理想像。验收编号、展开和解包时，观察空槽是否保持原位并能在拖动后恢复。
5. 核对目录说明、补全签名及已有线重载的分派。专门检查新增共轭重载仅接受枢点槽的线，被求共轭点槽的线不会匹配该重载。复用 Low／Medium／High 的绑定机制，实机测试创建、拖动、导出重开和隐藏辅助量清理。
