# 三次曲线自定义工具预选清单

状态：**待审阅，未实现**（2026-10-27）。这是下一轮及以后可能实现的接口清单，不是发布承诺。英文名称和描述是拟议的用户可见文本；算法栏是推导方向，不是可直接粘贴的 GeoGebra 命令。实际实现前仍须完成恒等式证明、原生引擎兼容性和性能验收。

本文沿用 [implementation-plan.md](implementation-plan.md) 第 2 节的类型、参数、齐次坐标、退化、连续性、输出槽位和表达式预算约定。默认 A、B、C、P、Q、N、Ω 为 `point`，`l` 为 `lineLike`（取支撑直线），`q` 为 `conic`，`F`、`G` 为 `implicitCurve`；涉及 F/G 的通用三次工具先在 GeoGebra **动态核验完整输入多项式恰为三次**。所有输出必须保持声明的对象类型。没有实有限解、对象不唯一或零多项式时返回 undefined，不能用采样曲线点或 JavaScript 坐标快照补救。

记号：`F₃(X,Y,Z)` 是输入仿射三次 F 的三次齐次化，`H_F` 是其 3×3 Hessian 矩阵；`(X:Y:Z)` 是变量点，`(x:y:z)` 是相对 ABC 的有向齐次重心，Ω=`(p:q:r)`，枢轴／根 P=`(u:v:w)`。这里的字母只供算法说明；实际签名始终按下表。涉及曲线和直线方程的乘法、行列式或叉积，都应先保留齐次形式，最后在原生引擎内生成对象。

## 先做：通用代数构造与极性工具

这一阶段优先复用现有十系数读取和匿名绑定，并与当前 `Polar`、`PolarConic`、`ThirdIntersection` 交叉验证。下面每项都有独立几何用途；不为已有命令添同义包装。

| English name / signature → output | English description | 候选算法 |
|---|---|---|
| `CircularCubic(A,B,C,D,E,F,G) → implicitCurve` | Circular cubic of passing through seven points. | 经过七点的圆环三次曲线。 |
| `CayleyBacharachPoint(A,B,C,D,E,F,G,H) → point` | Cayley-Bacharach point of a eight points or six points and circular points. | 给定八点，满足过九点有无穷多三次曲线的点。 |
| `CayleyBacharachPoint(A,B,C,D,E,F) → point` | Cayley-Bacharach point of a eight points or six points and circular points. | 给定六点和两个圆环点共八点，满足过九点有无穷多三次曲线的点。作为重载 |
| `OrthicAxis(F) → line` | Locus of points whose first polar conic is a rectangular hyperbola. | `PolarConic(P,F)` 的二次项迹 `A(P)+C(P)=0` 给出 P 的齐次直线。整平面均满足时没有唯一线，undefined；
是 三角形的 OrthicAxis的自然推广。应作为重载。 |
| `CircularPolarPoint(F) → point` | Point whose first polar conic of F is a circle. | `PolarConic(P,F)` 的二次型圆条件 `A(P)=C(P)`、`B(P)=0` 是关于齐次 P 的两条线性方程；取其交点。唯一有限解才输出；两条件相关而得到一整条 circular line、全平面或无穷远解时 undefined。SITP §2.2.4 说明圆型三次的此点是 singular focus。 |
| `HessianCubic(F) → implicitCurve` | Hessian cubic of a plane cubic. | 齐次化 F 后输出 `det H_F(X,Y,Z)=0`；三次矩阵元素均为一次式。Hessian 恒为零或输出方程不唯一时 undefined。检查退化三次、普通结点和光滑三次。见 [SITP §2.2.6](https://bernard-gibert.fr/files/Resources/SITP.pdf)。 |
| `HessianCorrespondent(F,P) → point` | Corresponding point to P on the Hessian cubic. | 要求 P 在 `HessianCubic(F)` 上且 `H_F(P)` 秩为 2；取退化极曲线 `PolarConic(P,F)` 的核作为两分量交点。秩≤1、无穷远核或 F 不满足三次条件时 undefined。见 SITP §2.2.6。 |
| `MixedPolar(P,Q,F) → line` | Mixed polar line of two points with respect to a cubic. | 输出 `Pᵀ H_F(X) Q=0`，与交换 P/Q 不变；P=Q 时应与现有 `Polar(P,F)` 成比例，零线 undefined。见 SITP §2.2.5。 |
| `Poloconic(l,F) → conic` | Poloconic of a line with respect to a cubic. | 把 l 写成齐次线系数向量 L，输出 `Lᵀ adj(H_F(X)) L=0`；它是 l 上各点的三次极线的包络，不是四个 pole 的点列表。伴随矩阵退化为零时 undefined。见 SITP §2.3.2。 |
| `JacobianCubic(q1,q2,q3) → implicitCurve` | Jacobian cubic of a net of three conics. | 对三个二次齐次式取梯度列（或行）的 3×3 行列式；三圆／三一般 conic 都可输入，非独立网导致零式则 undefined。用于核对若干 nK 构造。见 SITP §§1.5.7–1.5.8。 |
| `ConicLineCubic(q,l) → implicitCurve` | Reducible cubic formed by a conic and a line. | 相乘二次曲线与支撑直线的齐次方程；明确保留分量和重数，不能按显示形状拟合九点。若仿射最高次消失，应解释射影无穷远分量与后续“三次输入”守卫的关系。 |
| `CubicPencil(F,G,P) → implicitCurve` | Member of a cubic pencil passing through a specified point. | 输出 `F₃(X)G₃(P)−G₃(X)F₃(P)=0`。此写法对 F/G 各自乘非零常数不变；P 是共同基点、两曲线成比例或线性组合恒零时不唯一，返回 undefined。避免用裸参数 s 给未规范化方程分配伪几何意义。 |

## 再做：等共轭三次曲线族与其它

此处 “isocubic” 严格指相对 ABC 的 circum-cubic，在一个指定的对角倒数型 isoconjugation 下不变。**现有** `Isoconjugate(A,B,C,X,P)` 的五点接口表示固定 X 的变换，不能误当成“极 Ω”接口；六点接口也有自己的定像语义。新曲线直接用 Ω 的重心系数 `p:q:r` 定义 `X*=(pYZ:qZX:rXY)`。在顶点、边线及不可定义的有理映射处先保留清分母后的完整代数闭包，同时在描述中说明哪些点是映射的基点。[SITP §§1.2–1.5、8.1](https://bernard-gibert.fr/files/Resources/SITP.pdf) 给出下列族的定义。

| English name / signature → output | English description | 候选算法 |
|---|---|---|
| `PivotalIsocubic(A,B,C,Ω,P) → implicitCurve` | Pivotal isocubic with isoconjugation pole Ω and pivot P. | 重心式 `uX(rY²−qZ²)+vY(pZ²−rX²)+wZ(qX²−pY²)=0`，等价于 `X,X*,P` 共线。先核对 Ω=K=X(6) 时与已实现 `PivotalIsogonalCubic` 成比例；Ω=G=X(2) 时核对等截情形。Ω 或 P 在边线等特殊位置允许非零分解式。 |
| `PivotalIsotomicCubic(A,B,C,P) → implicitCurve` | Pivotal cubic for isotomic conjugation with pivot P. | 上式取 Ω=G；作为与现有 `PivotalIsogonalCubic` 对称的常用入口，仅在实测说明此快捷名确有使用价值时加入。不能复制另一套算法。 |
| `QACu1Inv(A,B,C,P) → implicitCurve` | | 满足 P在ABCX的QACu1上的点X。一个性质是：设P的垂足三角形DEF, P在AX,BX,CX上射影为U,V,W，则DU,EV,FW共点（要除掉P在直线AB,BC,CA上的退化情况）。 |
| `ApolarIsocubic(A,B,C,Ω,P) → implicitCurve` | Zero-parameter nonpivotal isocubic with pole Ω and root P. | SITP 的 nK₀ 式：`uX(rY²+qZ²)+vY(pZ²+rX²)+wZ(qX²+pY²)=0`。这里的“零”相对所列规范形式，不是把任意方程的 `XYZ` 系数粗暴设零。输出非零式即可保留分解退化。 |
| `NonpivotalIsocubic(A,B,C,Ω,P,Q) → implicitCurve` | Nonpivotal isocubic with pole Ω, root P and point Q on the curve. | 先求 `Q*=(pY_Q Z_Q:qZ_Q X_Q:rX_Q Y_Q)`，再用 SITP §1.5.1 的对称式 `Σ_cyclic uX(Y_Q Z−Z_Q Y)(Y_Q* Z−Z_Q* Y)=0`；Q、Q* 自动在曲线上。避免直接暴露依赖 Ω/P/Q 齐次尺度的裸参数 k。Q 处于边线或构造坍缩时检测零式。 |
| `IsogonalApolarCubic(A,B,C,P) → implicitCurve` | Zero-parameter nonpivotal isogonal cubic with root P. | 复用 `ApolarIsocubic`，Ω=K=X(6)；优先作为易用快捷名审阅，不单独维护方程。 |
| `IsotomicApolarCubic(A,B,C,P) → implicitCurve` | Zero-parameter nonpivotal isotomic cubic with root P. | 同上，Ω=G=X(2)；与 `IsogonalApolarCubic` 做变换不变性和退化对照。 |
| `ConicoPivotalIsocubic(A,B,C,N,P) → implicitCurve` | Conico-pivotal isocubic with singular point N and root P. | N=`(f:g:h)` 时输出 `Σ_cyclic uX(hY−gZ)²=0`；对应的极为 `(f²:g²:h²)`，N 为指定奇点，`X X*` 的包络是二次曲线。必须核查非零式、N 实为结点／尖点的条件，以及映射基点；不能宣称任意参数都给普通结点。见 SITP §8.1。 |

这批先实现**族**，再考虑为目录曲线起专名；例如 `PivotalIsocubic(A,B,C,K,H)` 对应 [K006 Orthocubic](https://bernard-gibert.fr/ctc1.html)，但若项目所用原生 `Cubic(A,B,C,6)` 已支持，就直接用原生编号。Gibert 目录的 Knnn 是曲线目录号，GeoGebra 原生 `Cubic` 的可用编号则须在当前引擎逐一核验；[官方手册](https://geogebra.github.io/docs/manual/en/commands/Cubic/) 明说支持集合会变化。本文不把二者无条件等同。

## 后做：专门曲线与更精细的几何对象

下表有明确的几何定义或可查的方程，但依赖前两阶段的原语、原生编号审计和单独的退化证明。专名须与目录页面逐项交叉核对，不能只用九点拟合冒充定义。

| English name / signature → output | English description | 候选算法 |
|---|---|---|
| `OsculatingCircleOfCubic(F,P) → circle` | Osculating circle of a cubic at a smooth real point. | 对 F 的一、二阶偏导计算隐式曲率和法向圆心；P 须在 F 上且梯度非零，曲率为零时有限圆不存在。先实测原生 `OsculatingCircle(P,F)` 对 implicitCurve 的支持；若已可靠支持，不新增同义工具。[手册](https://geogebra.github.io/docs/manual/en/commands/OsculatingCircle/) 明列 function、curve、conic，未明确 implicitCurve。 |
| `TuckerNodalCubic(A,B,C) → implicitCurve` | Tucker nodal cubic K015. | SITP §8.3 的 `ConicoPivotalIsocubic(A,B,C,G,G)`，重心式 `Σ X(Y−Z)²=0`；G 为指定奇点。仅在原生编号不支持且专名值得保留时加入。 |
| `PelletierStrophoid(A,B,C) → implicitCurve` | Pelletier strophoid K040. | SITP §4.3.2 给出根 X(650) 的 isogonal nK₀ 短式 `Σ a(b−c)(b+c−a)X(c²Y²+b²Z²)=0`；核对边长与重心坐标、奇点和目录 [K040](https://bernard-gibert.fr/ctc1.html)，再决定是否提供名字。不要与旧源 S481 的未定义一般 `Strophoid(A,B,C)` 合并。 |
| `KiCubic(A,B,C) → implicitCurve` | Ki cubic K073, inverse of the Neuberg cubic in the circumcircle. | 目录 [K073](https://www.bernard-gibert.fr/Exemples/k073.html) 还给出 `pK(X50,X3)`；候选为 `PivotalIsocubic(A,B,C,TriangleCenter(A,B,C,50),Circumcenter(A,B,C))`，并独立核对反演像的可约因子。先检测原生编号 73 的实际支持；不通过简单坐标反演默认结果仍是三次。 |
| `MusselmanFirstCubic(A,B,C) → implicitCurve` | First Musselman cubic K026. | 以 [K026 条目](https://www.bernard-gibert.fr/Exemples/k026.html) 的两个圆族公共点重合条件或 SITP §6.5 的方程为定义，推导紧凑隐式式并验证重数；不拿一组特殊中心拟合。与既有计划暂缓的 K028（第三 Musselman）严格区分，原生编号 26 先实测。 |

## 研究队列：暂不承诺接口

这些对象常用，但当前输出契约和分支问题尚未解决；完成证明和交互设计后才能提升到上面三阶段。下表的签名只是讨论草案。

| English name / signature → output | English description | 候选算法 |
|---|---|---|
| `PrehessianCubic(F[,i]) → implicitCurve × 3 / point` |   |   |
| `CubicSingularPoints(F[,i]) → point × 3 / point` | Real finite singular points of a cubic. | 同解 `F₃=∂XF₃=∂YF₃=∂ZF₃=0`，可约曲线可有多个交点；须先设计至多三个固定槽位的稳定编号，并区分重合分量导致的无限解族。不能删除 undefined 槽。 |
| `CubicInflectionPoints(F[,i]) → point × 3 / point` | Real finite flexes of a smooth cubic. | 求 `F∩HessianCubic(F)` 的实有限点并验证切触重数；复数九点、奇异／可约情形与穿越判别式时的槽位稳定性需要单独方案。 |
| `CubicAsymptotes(F[,i]) → line × 3 / line` | Real asymptotes of a cubic. | 先求 `F₃(X,Y,0)=0` 的实无穷远方向，再由次高次项求渐近线；多重无穷远根可能产生抛物支或非唯一线。无全局自然排序，需先解决索引契约。
目前 Geogebra自带 Asymptote(implicitCurve) |
| `CubicGroupAdd(F,O,P,Q) → point` | Sum of two points on a nonsingular cubic with flex O as identity. | 弦切法两次使用已实现 `ThirdIntersection`；P=Q 和中间点 O 需切线重载，曲线必须光滑不可约，O 必须是有限拐点。必须先说明群律原点、加法符号和连续分支，不能把任意 `ThirdIntersection` 当成群和。 |
| `PerspectiveCubic(A,B,C,D,E,P) → implicitCurve` | Cubic associated with two ordered triangles in perspective. | 旧计划 §10.1 的有向面积三因子式可作为候选，但两个三角形的对应顺序和通行定义仍未核定；此处用 P 作第六点名以免与曲线 F/G 混淆。核定后才确定名称及符号。 |

## 实施顺序与验收门槛

1. **定义审阅**：先确认表中的名称、参数顺序和哪些专名确实需要快捷入口。检查 `library.json` 名称／别名冲突、GeoGebra 原生 `Cubic` 编号和 `OsculatingCircle` 支持；原生功能充分时将对应行移为 Native。
2. **共用代数原语**：沿用现有原生十系数提取及完整多项式核对；逐个推导齐次化、Hessian、伴随矩阵、二次曲线梯度。只在 JS 生成符号表达式，输入点和系数始终由 GeoGebra 动态计算。输出曲线须验证非零、次数及正确几何类型；射影三次在仿射图中降次的情况单独标记。
3. **恒等式验证**：先用有理坐标和符号代数对照独立定义，再用一般、等腰、直角、正三角形、奇点、分解、无穷远极限配置。核对 P/Q 交换、顶点循环、三角形镜像、输入曲线方程任意非零倍、参数移动后的恢复。特殊曲线需核对目录给出的已知点／枢轴／奇点，而不仅看图形相似。
4. **原生验收与性能**：每个返回类型在 GeoGebra 中实际创建、拖动、保存重开；检查对象类型、固定输出槽、undefined 的恢复和无命名辅助对象。大表达式先做预算与计时，必要时分阶段发布，不能让一个目录专名拖慢基础操作。

资料：项目内 `.agents/Special Isocubics in the Triangle Plane.pdf`（Jean-Pierre Ehrmann、Bernard Gibert，2015；本轮重点查阅 §§1.2–1.5、2.2–2.3、8.1–8.3，另用目录定位第 4、6 章）；[Gibert CTC 总目录](https://www.bernard-gibert.fr/ctc.html)、[CTC Part 1](https://www.bernard-gibert.fr/ctc1.html) 及上表具体 Knnn 页面；[GeoGebra Cubic](https://geogebra.github.io/docs/manual/en/commands/Cubic/) 与 [OsculatingCircle](https://geogebra.github.io/docs/manual/en/commands/OsculatingCircle/) 手册。CTC 子页若不可直接抓取，则用搜索索引和具体 Knnn 页面交叉核对；未核实的数学等价关系已明确标作候选或待核定。
