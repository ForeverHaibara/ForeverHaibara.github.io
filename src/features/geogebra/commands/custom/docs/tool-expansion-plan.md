# GeoGebra 自定义工具扩展计划

状态为设计草案。以工作区的 [工具定义](../library.json)、[分类](../toolCategories.ts) 和 [原生索引](../../completion/geogebraCommandNames.ts) 为基线。当前目录为 0.3.0，含 165 个规范命令和 100 个别名。三次曲线的既有计划见 [cubic-tools-roadmap.md](cubic-tools-roadmap.md)。附件用来提出候选；签名、优先级和推广方式按现有系统重新筛选。

## 1. 现有覆盖与候选去向

| 附件方向 | 当前覆盖与取舍 |
| --- | --- |
| 交比、中心、轴、配极 | 原生已有 `CrossRatio(A,B,C,D)`、`Center(q)`、`Axes(q)`、`Asymptote(q)`、`Polar(P,q)` 和 `Polar(l,q)`，站内还有 `Pole(l,q)`。保留原生用法；只补一次产生三个对应顶点的 `PolarTriangle`。见 [交比](https://geogebra.github.io/docs/manual/en/commands/CrossRatio/)、[中心](https://geogebra.github.io/docs/manual/en/commands/Center/)、[轴](https://geogebra.github.io/docs/manual/en/commands/Axes/)、[渐近线](https://geogebra.github.io/docs/manual/en/commands/Asymptote/)、[配极](https://geogebra.github.io/docs/manual/en/commands/Polar/)。 |
| 射影变换 | 原生 `ApplyMatrix(M,P)` 已支持 3×3 齐次点变换。实际缺口是**从四对点直接确定映射并求像**。先做点像，后续再考虑线和圆锥曲线像。沿用 General constructions 的分类。[ApplyMatrix 手册](https://geogebra.github.io/docs/manual/en/commands/ApplyMatrix/) |
| 共轭与三角形族 | `Isoconjugate` 已有固定点和指定点像两种接口，等角／等截还已有支撑直线到 conic 的重载。`CevaConjugate`、`CrossConjugate`、`Crosspoint`、`Cevapoint` 是各自不同的构造。旁心组可直接用 `Excenters`；内心的塞瓦三角形可用 `CevianTriangle(A,B,C,Incenter(A,B,C))`。有编号配方的派生三角形优先走 `GeminiTriangle`。 |
| 四点与四线 | `DiagonalPoints` 已返回完全四点形的三个对角点；`NewtonLine`、`MiquelPoint` 均有点版和线版，`MiquelCircle` 已是 `QLCi3` 的别名。保留现有 `Quadrangles` 和 `Quadrilaterals` 的输入语义。完全四点形的六条线、完全四线形的六个交点用原生构造即可。 |
| 圆、相似和反演 | `RadicalAxis`、`RadicalCenter`、`CommonTangents`、圆间 `SimilarityCenter` 与两点定相似的 `DirectSimilarity`／`OppositeSimilarity` 均已覆盖；点、直线和圆的圆反演优先用原生 `Reflect(object,c)`。任意隐式多项式反演涉及基点和分量，作为独立研究项。[Reflect 手册](https://geogebra.github.io/docs/manual/en/commands/Reflect/) |
| 三次曲线 | `ThirdIntersection`（含切线形式，`Tangential` 为别名）、`Pretangential`、`CubicInvolution`、`CubicPencil`、`CayleyBacharachPoint`、`HessianCubic`、`CircularPolarPoint`、`CubicAsymptotes` 均已存在。原生隐式曲线 `Asymptote(F)` 返回列表，与现有三次曲线独立直线槽用途不同。`GibertCurve` 在站内承载已收录的 Q 系列，K 编号仍应按当前引擎实际支持范围核对原生 `Cubic`。见 [相关曲线覆盖](related-curves.md) 和 [原生 Cubic](https://geogebra.github.io/docs/manual/en/commands/Cubic/)。 |
| 轨迹、包络、曲线交点 | 原生已有 `Envelope`、`LocusEquation` 及适用的 `Intersect` 重载。只补有闭式、可直接拖动的构造，或语义确实不同的运算，例如带重数的剩余交点。原生消元支持的对象有限，且可能产生额外分支。[Envelope](https://geogebra.github.io/docs/manual/en/commands/Envelope/)、[LocusEquation](https://geogebra.github.io/docs/manual/en/commands/LocusEquation/)、[Intersect](https://geogebra.github.io/docs/manual/en/commands/Intersect/) |

## 2. 实施队列与菜单归属

命令名是候选，已对照当前规范名、别名和原生索引。下表的英文句子可作为工具描述底稿。菜单新增项安排在现有顶层分类之下。

| 批次 | 现有分类或拟加子类 | 候选签名 → 输出 | 英文描述 |
| --- | --- | --- | --- |
| 第一批 | Triangle constructions → Correspondence（新增子类） | `TrianglePerspector(A,B,C,D,E,F)` → point | Common center of the corresponding vertex joins, extended by weighted least squares. |
| 第一批 | 同上 | `OrthologyCenter(A,B,C,D,E,F)` → point | Center of the perpendiculars from the first triangle to the corresponding sides of the second, extended by weighted least squares. |
| 第一批 | Circles and conics → General constructions | `ConicPencil(q1,q2,P)` → conic | Member of the conic pencil through P. |
| 第一批 | Circles and conics → Interrelations | `LimitingPoints(c1,c2[,i])` → point × 2／point | Real finite limiting points of the coaxal pencil of two circles. |
| 第一批 | Circles and conics → Conical transformations | `PolarTriangle(q,A,B,C[,i])` → point × 3／point | Vertices formed by the three polar lines of A, B and C. |
| 第二批 | General constructions → Projective configurations（新增子类） | `CollineationImage(A,B,C,D,E,F,G,H,P)` → point | Image of P under the projectivity taking ABCD to EFGH in order. |
| 第二批 | 同上 | `PascalLine(A,B,C,D,E,F)` → line | Pascal line of an ordered hexagon, extended by a weighted fit of its opposite-side intersections. |
| 第二批 | Triangle constructions → Correspondence | `DesarguesAxis(A,B,C,D,E,F)` → line | Axis of perspective, extended by a weighted fit of corresponding-side intersections. |
| 第二批 | Cubics → General constructions | `CubicCurvatureConic(F,P)` → conic | Osculating circle of the level curve of F through P, with a tangent-line limit at zero curvature. |
| 第二批 | General constructions → Loci and envelopes，可同时列于 Triangle constructions 的曲线入口 | `SteinerDeltoid(A,B,C)` → implicitCurve | Envelope of the Simson lines of ABC. |

第一批先验证共点内核、原生 conic 类型和独立输出槽。第二批的 Pascal 线与 Desargues 轴共用同一个拟合内核，可单独验收。点像可先于线和圆锥曲线像交付。曲率圆与 deltoid 各走现有曲线后端，独立于射影工具。

## 3. 接口与连续性

- 三角形、四点形、六边形用独立的点表达。两组三角形按 `A↔D、B↔E、C↔F` 对应，允许同时换序与镜像。A 专属结果和三个顶点槽按 BC、CA、AB 对应。Pascal 的六点有给定的循环次序。
- `point` 表示有限实仿射点，`lineLike` 取无限支撑线，`conic` 接受圆，`circle` 只接实圆。中间点、直线、二次型保留齐次系数；最终输出才有限化。直线型或点型 conic 优先保留原生 conic 元数据。
- 多结果分成同类型独立对象。顶层产生固定槽数，赋值和嵌套沿用现有首槽行为，末尾 `i` 选择 1-based 槽。保留空槽，切触合根如何显示须逐项核定。多根的集合连续性和逐槽编号连续性分别验收。
- 特殊性质写入数学语义，例如共点、共圆锥、曲线上取点。在一般输入上沿用同一方程，不加几何成员判断或投影修正。公式本身无唯一结果或没有可表示的有限实输出时，允许 undefined。可去的中间分母优先约掉；引擎若把恒零方程误建成已定义对象，只在输出边界加必要守卫。
- JavaScript 只负责类型分派和生成表达式。数值、条件及依赖由 GeoGebra 动态计算。短式优先 `expression`，复用站内工具用 `compose`，其余 builder 复用 [齐次运算](../algebra/homogeneous.ts)、[稀疏多项式](../algebra/polynomial.ts) 及 `bind`。长式可评估现有 [Medium／High 隐藏辅助对象机制](named-intermediates-implementation.md)。避免自由构造点、采样拟合、坐标快照、脚本回调或自建持久化变换对象。

## 4. 第一批算法

### 三角形对应中心

两个命令共用三线最小二乘。对第 j 条线，在局部坐标中取法向量 `nⱼ` 和过点 `pⱼ`，最小化 `Σ[nⱼ·(x−pⱼ)]²`。令 `bⱼ=nⱼ·pⱼ`，`dⱼₖ=det(nⱼ,nₖ)`，`J(x,y)=(−y,x)`。用两两子式直接算

> `x = Σ(j<k) dⱼₖ (bₖ Jnⱼ − bⱼ Jnₖ) / Σ(j<k) dⱼₖ²`。

这是 2×2 正规方程的 Cauchy–Binet 形式，分母是子式平方和，避免从两个近等的大数相减。各线共点且法向张成二维时，结果正是该点。取六点质心为局部原点，可按同一尺度归一化，再变回世界坐标。接近平行时有限中心本身可能很远，不按距离截断。

- **TrianglePerspector** 取 `n₁=J(D−A)`、`p₁=(A+D)/2`，其余两条同理。距离平方按对应点间距的平方加权；一对点恰好重合时该项连续归零，其余两条独立线仍可确定中心。交换两三角形不改变结果。可用两个位似三角形以及 ETC 已列的透视三角形对验收。[ETC Perspectivities](https://faculty.evansville.edu/ck6/encyclopedia/Perspectivities.html)
- **OrthologyCenter** 取 `(p₁,p₂,p₃)=(A,B,C)`，法向量分别为 `F−E、D−F、E−D`。即按第二组三角形的边长平方加权。交换输入可求反向中心；令两组三角形相同，结果为垂心。一般位置的加权中心可用独立数值最小二乘验证。[ETC 的 orthologic triangles 定义](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html#orthologic-triangles)

### 二次型束与极三角形

- **ConicPencil** 用同一组原生六系数计算各自的 `qⱼ(P)`，再输出系数向量 `q₂(P)·q₁ − q₁(P)·q₂`。系数向量与求值必须使用同一方程规范。输入各自换非零尺度或交换次序只改变总因子。P 是共同基点时整个束都经过 P；两个方程成比例时输入没有给出一维曲线束。这两种情形都使输出系数为零。用 [Coefficients](https://geogebra.github.io/docs/manual/en/commands/Coefficients/) 和六系数 `Conic`，沿用 [现有的系数顺序](../algebra/homogeneous.ts)。用经过四点的两条线对构造有独立答案的测试，也验收圆束、线对和点型成员。
- **PolarTriangle** 令 `Q` 为 q 的对称齐次矩阵，首槽为 `(QB)×(QC) = adj(Q)ᵀ(B×C)`，其余循环。直接保留系数，允许某条极线是无穷远线时与另一条极线求交；无穷远交点只影响该槽。退化二次型仍取线性极化，个别极线未定义或两极线重合时由全零交点得到 undefined。用普通 `Intersect(Polar(B,q),Polar(C,q))` 作对照，并验收 q 接近退化、输入点经过中心、顶点换序。

### 圆束极限点

`LimitingPoints` 求圆束中半径为零的实成员的中心。令 `d=O₂−O₁`、`D=d·d`、`k=D+r₁²−r₂²`。成员 `(1−t)c₁+t c₂` 用二次项系数为 1 的圆方程，圆心 `O₁+t d`，半径平方为 `D t²−k t+r₁²`。以 `O₁` 为原点，判别式可写为

> `Δ=(D−(r₁+r₂)²)(D−(r₁−r₂)²)`。

两个槽按 `(k−√Δ)/(2D)`、`(k+√Δ)/(2D)` 对应，换圆次序交换槽。稳定求根取 `m=(|k|+√Δ)/2`、`σ=sgn(k)`，两根以（分子，分母）保留：

> 大绝对值根 `L=(σm,D)`，小绝对值根 `S=(σr₁²,m)`。

正半径圆在有实根且 `D>0` 时 k 非零。槽位可用 `(1+σ)/2` 在分子、分母层将 `S,L` 排回 `−,+` 的顺序，最后对选中的 `(N,W)` 计算 `O₁+(N d)/W`。距离和半径先用共用尺度归一化再计算系数。同心异半径时有限槽返回共同圆心，另一槽没有有限极限；重合圆两槽未定。相切两槽合到切点，横截时没有实槽。用半径平方为零、圆束成员方程以及从相离拖到相切、横截、内含和同心的序列核验。特别测近同心大小两根、近内切以及大量级平移；判别式容差只在实机证实有必要后确定，近切的不同对象仍要区分。

## 5. 第二批算法

### 四对点定射影像

对每个四点标架取 `M₀=[P₁ P₂ P₃]`，`u=adj(M₀)P₄`，`M=M₀ diag(u)`。这样三个坐标基点及 `(1:1:1)` 对应四点。源和目标分别在自身局部坐标中构造标架；在目标局部坐标中以 `H=M_target adj(M_source)` 作用于源局部点，最后有限化并还原。无须逐项除以行列式。

四点标架无三点共线；可直接复用前三点行列式与 u 的三分量确认两个标架可逆。该守卫界定变换是否唯一，避免奇异矩阵伪造点像。先验证四对点、标架同换序、交换标架后的往返和中途穿过极线。点像试验优先比较原生 `ApplyMatrix`；后续若扩为线／conic 重载，分别用 `adj(H)ᵀl` 和 `adj(H)ᵀ Q adj(H)`，且对比原生 conic 支持。先验证圆经一般射影可成为抛物线或双曲线、输出经过像点以及与线像相切。

### Pascal 线与 Desargues 轴

Pascal 取 `AB∩DE、BC∩EF、CD∩FA`；Desargues 取 `BC∩EF、CA∩FD、AB∩DE`。用局部坐标下的输入点 `(x,y,1)`，两次叉积直接得到 `(vⱼ,wⱼ)`，其中 v 为平面两分量。两组线平行时 w 可以为零。共圆锥／透视时，三交点满足相应的经典结论。六点重排的允许对称性分别为六边形循环和反向、两三角形对应点同时换序及两组互换。[Pascal 构造](https://sites.math.washington.edu/~king/coursedir/m445w01/lab/lab09.html)

推广选取使 `Σ(n·vⱼ+c wⱼ)²` 最小的有限直线，约束 `||n||=1`。有限交点按 `wⱼ²` 加权，远处的近无穷远交点不会因先除以 w 而失控，真正无穷远的交点贡献方向约束。权重由叉积链给定，所有输入点用同一局部长度尺度，保持平移、旋转、缩放与上述换序的等变性。该推广采用欧氏度量；定理配置上还原射影线。

令 `S=Σwⱼ²`、`m=Σwⱼvⱼ`，对称 2×2 矩阵取 `C=Σ(j<k) uⱼₖ uⱼₖᵀ`，`uⱼₖ=wⱼvₖ−wₖvⱼ`。n 为最小特征值的法向，`c=−n·m/S`。可用半角 `½ atan2(2Cxy,Cxx−Cyy)+π/2` 求 n。角度跨分支时 n 变号仍表示同一条线；两个特征值相同或 `S=0` 时，没有唯一有限最优线。最后通过现有直线系数生成器输出。原生 `FitLine` 是纵向回归，无法代替该法向拟合。[FitLine 手册](https://geogebra.github.io/docs/manual/en/commands/FitLine/)

若对边刚好重合，叉积为零的约束自然消失；仍有足够独立约束就保留结果。共同圆锥与透视条件无需判定。实机重点测竖直线、一个中间交点穿越无穷远、对称等特征值、循环换序，以及从定理配置向一般位置拖动。两相邻六边形顶点重合时，点接口无法确定它们之间的切线方向；该极限需要额外输入曲线或切线，留给专门重载。

### 三次曲线的密切圆及直线极限

`CubicCurvatureConic(F,P)` 对一般 P 使用通过 P 的等值线 `F(X)=F(P)`，无需判断 P 是否在零等值线上。用现有 `withCubic` 取得十系数，按三次输入契约计算梯度 g 与 2×2 Hessian H，不额外拟合。令 `s=g·g`、`K=(Jg)ᵀH(Jg)`、`δ=X−P`，输出原生六系数 conic

> `K ||δ||² + 2s g·δ = 0`。

`K≠0` 时圆心 `P−s g/K`；`K=0` 且 g 非零时，原式给等值线的切线，连续跨过普通拐点。g 为零时整式为零，没有唯一密切圆。最终输出验证 conic 类型和退化直线，无须除以 K。用 `F=y−x³` 的平滑分支测试穿过拐点，用 `F=y²−x²−x³` 测结点，另测 F 乘非零常数和 P 离开 F 后的等值线语义。核对原生 `OsculatingCircle(P,F)` 的隐式曲线支持范围；计划中新增工具的价值在于等值线定义与固定 conic 类型的直线极限。[OsculatingCircle 手册](https://geogebra.github.io/docs/manual/en/commands/OsculatingCircle/)

### Simson 线的闭式包络

`SteinerDeltoid` 取外心 O、外接半径 R、垂心 H、九点圆心 `N=(O+H)/2`。在以 O 为原点的单位外接圆上，设三顶点复数为 a,b,c，令 `k=abc`，动点 `p=e^(it)`。Simson 线过 `(P+H)/2`，复方向满足 `d/conj(d)=k/p`。对该直线方程随 t 求导可得包络 `X=N+R(p+k/(2p²))`。[Steiner deltoid 的形式化推导](https://isa-afp.org/entries/Steiner_Deltoid.html)

令 `w=2(X−N)/R`，直接生成四次隐式方程 `|w|⁴+18|w|²−8 Re(conj(k)w³)−27=0`。它是 `z³−wz²+k conj(w)z−k` 的判别式除以 `k²`。该三次式的根按倒数共轭成对，重根若离开单位圆就至少需要四个根（含重数）。因此重根 p 在单位圆上，Vieta 给回 `w=2p+k/p²`，四次式恰好表示整个包络。实部展开成实多项式，避免选 k 的立方根。保留现有 implicitCurve 类型。验收三个尖点 `p³=k`、切向与 Simson 线一致、顶点置换与镜像、正三角形和直角三角形。非共线三角形趋近共线时外接圆可能趋于无穷大，按外心和半径的实际极限处理。

## 6. 研究队列

| 方向 | 提升优先级的条件 |
| --- | --- |
| 派生三角形快捷命令 | `ExtouchTriangle` 暂作使用频率候选。A 槽已有短组合 `B+C−IntouchTriangle(A,B,C,1)`，ETC 也列为 Gemini 29 的补三角形。若加入菜单 `Triangle constructions → Triangles of the triangle`，可用 `B+((s−c)/a)(C−B)`（s 为半周长）及其循环式，避免构造近共线时很远的旁心。边长 a 趋零时结果趋向重合端点，可在零长度的结果边界补这个极限。[ETC extouch 条目](https://faculty.evansville.edu/ck6/encyclopedia/IndexOfTrianglesReferencedInETC.html#extouch) |
| `BrianchonPoint` | 输入六条支撑线，从相邻两线交点构造三条相对顶点连线。先按统一局部尺度规范各输入线法向，再用齐次叉积和第一批共点内核。需验证中间顶点无穷远、全线重新定向和一般情况下的权重语义；共切时还原 Brianchon 点。 |
| `CubicGroupAdd` | 延续三次曲线路线图的研究项。对光滑实射影三次曲线，以曲线上给定的 O 为单位元，可用两次弦切求第三点，即 `O*(P*Q)`，其中 `*` 是按重数取第三点。以任意 O 作原点是把拐点原点群律平移。若 `F(sP+tQ)` 的混合项是 `u s²t+v st²`，弦的齐次第三点为 `vP−uQ`。这条式子也给出两点不在曲线上时的代数候选，但两点合并时会消成零向量，一般离曲路径可能没有同一切线极限。待明确 P=Q 与 P*Q=O 的极限和齐次中间点契约后再确定 API。[Poonen 的弦切群律说明](https://math.mit.edu/~poonen/papers/elliptic.pdf) |
| `CubicSingularPoints`、拐点、j 不变量、对偶曲线 | 维持既有路线图的研究状态。优先离线验证齐次梯度联立、Hessian 交点、公共分量及实有限槽契约；奇点与拐点先解决实际引擎的求解和拖动行为。j 的范围是光滑三次曲线，专门处理奇异边界；对偶曲线还需规范化消元结果。 |
| `ResidualIntersection` | 首个可试边界是两个给定三次方程、无公共分量、已知八个简单公共点时求唯一有限剩余点。比较现有 `CayleyBacharachPoint` 能覆盖多少需求。存在相切、重根、复点、无穷远点或公共分量时，交点列表减法无法表达交数。稳定的重数和输出契约确定后再扩一般次数。 |
| ETC 共轭、Gibert 类、通用双有理曲线像 | 每个候选先核对坐标制和参数语义。ETC 的 U-isoconjugate 约定与站内固定点接口不同；若确有用途，先确定独立名称和明确权重契约。曲线像要分清代数闭包与因清分母出现的基点分量。已实现的 Pivotal／Nonpivotal／ConicoPivotal 和目录入口优先复用；专名需有独立定义和可核验的特化。[ETC Glossary](https://faculty.evansville.edu/ck6/encyclopedia/Glossary.html)、[Gibert CTC](https://www.bernard-gibert.fr/ctc.html) |
| 参数化中心三角形、一般包络、Apollonius 三圆问题 | 中心三角形先通过明确的编号配方验证需求。一般包络优先使用原生支持的构造，扩大范围之前须有参数和消元语义。三圆公切圆与现有三角形 `ApolloniusCircle` 是不同问题，需先核对有向切触、实根、重合解与固定槽编号。 |

## 7. 实现阶段的验收

1. **定义与兼容**。确认英文定义、参数顺序和别名。检查原生命令的实际重载、文件工具优先级及类型推断。涉及 conic 退化时查原生 XML 的类与后续命令分派。
2. **代数与几何对照**。各工具至少有一个独立的经典配置和一个一般位置对照。覆盖镜像、适用的换序、尺度改变、大坐标平移。对限制条件构造，用拖动穿入和穿出该条件的序列检查连续性。区分可去分母、唯一但病态的结果与真正非唯一的结果。
3. **真实引擎**。在 [浏览器验收入口](../../../../../../scripts/README.md) 中逐签名创建、拖动、导出重开；验收顶层独立槽、编号、空槽恢复、嵌套首槽及文件宏覆盖。记录对象计数及辅助对象的隐藏、清理与保存恢复。
4. **性能**。按现有匿名／命名执行路径分别测创建与更新；高成本构造复用已验证的数值绑定。只有确认匿名模式无法实际使用时才考虑 `requiresNamed`，并在入口明确限制。以交互数据决定是否保留展开、复合或矩阵后端。相关先例见 [三次曲线性能](benchmarks/qa-cubics-performance.md) 与 [辅助对象性能](benchmarks/named-intermediates-performance.md)。
