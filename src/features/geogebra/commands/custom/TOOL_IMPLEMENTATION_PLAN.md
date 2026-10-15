# Custom geometry tools — implementation review plan

状态：**P1 已实现，实际 GeoGebra 引擎验证待运行**。按人工审阅后的计划完成首批工具及工具组合机制；P2 与暂缓项目仍为后续计划。工具名称和面向用户的描述使用英文；设计理由和算法说明使用中文。

## 1. 范围、来源和取舍

已读取当前 `README.md`、`library.json`、类型与环境代码，以及 `.agents/ggb_tools/001/tools.json` 中的工具元数据、构造步骤和相关 XML 对象。源文件有 **489 个条目、219 个不同显示名称、230 种忽略顶层 cmdName 后的定义**。其中 **31 个不同名称以 PoC/PoE 开头，全部排除**；余下 **188 个名称**的去向见末尾审计表。这里的源编号是 JSON 的 `index`，不是三角形中心或 EPG 编号。

本计划不逐项复制原宏，也不为重复导入产生的数字后缀创建别名。保留常用语义快捷命令，但不重复包装本身已经易用的原生命令。涉及尚未核定的专门定义，明确暂缓，不能用一个貌似合理的构造冒充原定义。

阶段约定：

- **Existing**：当前网站已实现，保留接口；本轮不重写。
- **Implemented (P1)**：已加入工具库，编译／执行边界测试通过；不代表已完成实际引擎几何验证。
- **P2**：建议后续新增，需要更多数学核验、类型支持或原生引擎验证。
- **Native**：使用 GeoGebra 内置功能，不新增同义工具。
- **Defer**：记录定义问题或性价比问题，不进入当前实现队列。

下表记录当前实现算法及后续方案，公式不一定是可直接粘贴的 GeoGebra 命令。P1 的实际原生表达式以 `library.json` 和 `geometryBuilders.ts` 为准。

### 已确认的源工具问题

| 源条目 | 构造证据与处理 |
|---|---|
| #6 Brocard Point | 仅计算输出 I；输出 J 是没有生产步骤的保存点。重写两个点，不能保留 J。 |
| #7 Kiepert Hyperbola | 五点圆锥曲线使用 D，但 D 不是输入，也没有生产步骤，是保存的固定点。改用明确的等角共轭像方程。 |
| #72 Mittenpunkt | 只有三个中点的步骤；输出 G 是保存点。采用中心 X(9)。 |
| #78 对合不动点 | 使用未由输入构造的 G，且输入 C、D 没有参与所列步骤。重新解射影对合矩阵。 |
| #221 Radical Center | 所列步骤只求固定辅助线 f、g 的交点，没有由三个输入圆产生这两条线。使用三个圆的幂方程。 |
| #23 Three Mixtilinear Incircles | 多输出包含外心 E，而第三个圆的圆心 G 不在宏输出中。新接口只输出三个圆，圆心由 Center 取得。 |
| #385 Orthic Triangle / #386 Orthic Circle | 实际分别是第四个点的垂足三角形／垂足圆。标准 orthic triangle 只需 A、B、C。分别并入 PedalTriangle、PedalCircle，另提供真正的 OrthicTriangle。 |
| #87 NinePoint Conic | 四直线先取循环交点，再作该四点的中点圆锥曲线，依赖直线排列；不是四直线的无序对称不变量。仅保留明确的四点版本。 |
| #89 / #444 Isogonal Center | 一个输入四直线，一个输入三角形加点，数学含义不同；不能因名称相同合并。均暂缓核定。 |
| #90 / #458 Poncelet Point；#88 / #459 Pseudocircumcenter | 四直线与四点版本不是可随意互换的对象。先分别记录，暂不猜测统一定义。 |
| #439 补点 / #440 反补点 | 前者实际为 `3G−2P`（Anticomplement），后者为 `(3G−P)/2`（Complement）。按实际数学含义纠正。 |
| #465 Isotocomplementary | 帮助文字说“补点的等截共轭”，步骤却是“等截共轭的补点”。两种复合一般不交换；不保留此含混名字。 |
| 多处 Intersect(...,1/2) | 编号不是“除去已知交点”的定义。第二交点统一用韦达／弦中点法；相切点用极线／圆心关系。 |
| #476–479 三次曲线操作 | 在输入曲线上取九个自由路径点后重建曲线，额外自由度和秩退化没有必要。应直接读取原生多项式系数。 |
| #389、#390、#421 | 轨迹分支不是完整代数曲线的可靠表示。改用隐式方程或内置 Cubic，不复制 Locus 扫描。 |

同名但不同定义还包括 Ceva Triangle、Gergonne、Nagel、Outer Tangent、Orthopivotal Cubic 等；末尾审计表记录所有变体。不同哈希不必然意味着不同数学对象，也不能证明它们等价。

## 2. 统一接口与数值约定

### 2.1 类型、参数和返回对象

- `point`：实仿射点；`lineLike`：直线、线段、射线，几何运算均取**无限支撑直线**。不能把线段长度当成线的系数，也不按线段范围裁剪。
- `circle`：圆；`conic`：包括圆的二次曲线；`number`：实数。圆工具要求对象当前确为实圆，不能把任意 conic 的 Center 当圆心使用。
- `implicitCurve`：**规划中的类型**，当前 `GeometryType` 尚无此项，P2 实现前必须补齐对象映射、推断和返回元数据。本文的 cubic 指此类型且多项式总次数为 3；不是根据点的位置改变类型。
- 签名中的 A、B、C、D、P、Q、X 及带下标的 P 均为 `point`；l、l1…l4 为 `lineLike`；q 为 `conic`；c、c1…c3 为 `circle`；曲线操作中的 F 为 `implicitCurve` 且须满足三次前提（其余场合的 F 为点）。s 为受限 `number`，i 为整数 `number`。少数签名单独标注以覆盖此默认约定。
- 参考三角形永远在前：`(A,B,C,...)`；A 专属对象由 A 在首位表示，B、C 专属对象通过循环排列得到。对称命令不能偷偷要求顺时针输入。
- `point × 3` 等表示三个同类型、可独立选择的输出，不是“点加边段加辅助线”。三角形输出顺序为对 BC、CA、AB 的 A、B、C 对应对象。三圆、三旁心也按 A、B、C 顺序。
- 同类型批量输出沿用当前 Conic 的独立输出方案；在嵌套表达式中取第一项，需另提供末尾整数 `i` 选择单项。表中批量命令均按此规则。单项／多项不通过对象移动而切换返回类型。
- 不新增 point+circle+line 的混合输出。Circle 的圆心用 Center，其他辅助对象单独调用。输出契约变更必须在实现时扩充现有输出元数据，不能仅填写一个误导性的 `returns: list`。
- `i` 是离散编号，不是可连续拖动的几何实参。无实解时保留固定数量的 undefined 槽；不能排序后删掉空槽而让其他对象改名。
- 不返回 Geogebra 内置的 Zip 型等列表型对象。因为这类集合型变量中的单个元素无法在交互界面中拆分选中。

### 2.2 共用数学原语

下列记号只用于阐述算法：`a=|BC|, b=|CA|, c=|AB|`；`G=(A+B+C)/3`；O 为外心，H 为垂心，I 为内心，R、r 为外接圆、内切圆半径。

1. **有向重心坐标**：用有向二倍面积求 P 的齐次重心 `(p:q:r)`。有限化为 `(pA+qB+rC)/(p+q+r)`；外点保留负号。下文有时用 `(u:v:w)` 避免与半径 r 混淆。三线坐标转重心必须逐项乘 `a,b,c`，不能直接混用。
2. **射影 join/meet**：点、线均先用三维齐次坐标，叉积求连线和交点，最后才有限化。尽量消除可约公共因子；结果三坐标全零是未定，不是原点。最终在无穷远的点没有普通 point 输出。点与其关于直线的反射点的中点可用于求垂足，不是一般直线交点的替代算法。
3. **垂足**：用向量点积投影到支撑直线，不用斜率，不限线段。平行线、竖直线和水平线使用相同公式。
4. **共轭与相切**：二次型矩阵 Q 给出极线 QP、极点 adj(Q)l；有限普通切点处切线就是极线。若需过外点的两条切线，先交极线与二次曲线取切点，再连外点；不要把两个近切交点相减估计方向。原生极线／极点优先。
5. **第二交点**：已知 P 在二次曲线上，以弦中点反射 P；圆的弦中点是圆心到弦的垂足。圆与圆已有公共点 P 时，先取两圆根轴再求该弦的第二点。不能固定选 Intersect 的序号。
6. **有向复数相似**：先平移到局部原点并显式 ToComplex，乘除后 ToPoint；普通坐标点相乘可能是点积。直接相似使用复数比，反相似使用共轭比。避免用无向 Angle 决定旋转方向。
7. **二次曲线方程**：以对称 3×3 矩阵或六系数表示，使用局部平移、尺度归一化减小消去误差；返回真正的 conic，不用 implicitCurve 冒充。TriangleCurve 可说明重心方程，但其原生输出为隐式多项式，不能直接充当 conic 的后端。
8. **表达式预算**：短式直接生成；重复中间量在原生匿名绑定中复用。模板 locals 只是文本展开，不保证缓存。禁止任意自由 Point、采样、数值坐标快照、命名临时对象、回调脚本。大矩阵算法必须先估计展开长度，不承诺“一个行列式”就一定便宜。
9. **距离** 两点距离尽量用内置的 Distance 函数。不要用 "AB" 这样的语法，因为它在两点字符串非单个字符时会出错。


### 2.3 退化和连续性

尽可能保留几何对象存在唯一极限时的连续定义，例如普通相切时第二交点返回原点、直角三角形的垂心仍为顶点。不能给本质非唯一的对象编造一个方向：正三角形的 Euler line、圆的主轴、重合圆的根轴均未定义。

不使用固定世界坐标的 epsilon、不用随机点打破对称。需要检验时使用相对尺度残差；相近但不相等的对象不得被随意强行合并。输出在无穷远、输入三角形共线、无限解族、奇异处切线不唯一时允许 undefined，并解释几何原因。保持对象类型固定不等于保证每个位置都存在有限实解。

尽量不对情形分类讨论，保持连续性。因为要保证任何非强类型的判断都在 Geogebra 内部动态计算，不在 js 中计算。不讨论选择哪个尽量最稳定的计算分支。该条优先级高于下面的具体工具条目规则，因为该条是后更新的说明。

### 2.4 简洁性

如果几何构造可保持稳定性（例如当退化情形只有无穷远或undefined的，而不是可连续的），可采用几何或复合构造，避免将复杂算式完全展开。且代码更清晰简洁。允许定义命令复用，便于维护。


## 3. 三角形中心与基本圆

这些是建议保留的少量常用语义快捷名。其余编号中心直接使用 TriangleCenter，无需为 X(57)、X(21) 等各开一个函数。原生中心编号及可用范围以 [TriangleCenter 手册](https://geogebra.github.io/docs/manual/en/commands/TriangleCenter/) 为准；超出手册示例的编号仍须在项目所用引擎核验。

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| Implemented (P1) | `Centroid(A,B,C) → point` | Triangle centroid. | `(A+B+C)/3`；不必作两条中线，三个点共线时仍有定义。需要对现有ggb工具重载。 | S001 S434 |
| Implemented (P1) | `Orthocenter(A,B,C) → point` | Triangle orthocenter. | 原生 TriangleCenter 的 X(4)； | S002 S435 |
| Existing | `Incenter(A,B,C) → point` | Triangle incenter. | 已使用原生 X(1)，保留。 | S009 |
| Implemented (P1) | `Circumcenter(A,B,C) → point` | Triangle circumcenter. | 原生 X(3) 或外接圆 Center；共线时无有限外心。 | S010 |
| Implemented (P1) | `NinePointCenter(A,B,C) → point` | Center of the nine-point circle. | `(O+H)/2`，无需重建三个高足。 | S017 |
| Implemented (P1) | `SymmedianPoint(A,B,C) → point` | Triangle symmedian point. | 原生 X(6)，或重心 `(a²:b²:c²)`。 | S031 |
| Implemented (P1) | `GergonnePoint(A,B,C) → point` | Triangle Gergonne point. | 原生 X(7)；不用内切圆与边段的相切求交。 | S066 S382 |
| Implemented (P1) | `NagelPoint(A,B,C) → point` | Triangle Nagel point. | 原生 X(8)，替换旧版多轮取交点。 | S067 S383 |
| Implemented (P1) | `Mittenpunkt(A,B,C) → point` | Triangle mittenpunkt. | 原生 X(9)，替换固定输出。 | S072 S384 |
| Implemented (P1) | `SpiekerCenter(A,B,C) → point` | Incenter of the medial triangle. | 直接使用X(10)，不要取中点。 | S032 |
| Implemented (P1) | `Excenter(A,B,C) → point` | Excenter opposite A. | `(-aA+bB+cC)/(-a+b+c)`；采用对应符号也等价。A 是明确的对顶点。非退化三角形分母为正。 | S003 |
| Implemented (P1) | `Excenters(A,B,C[,i]) → point × 3 / point` | Excenters opposite A, B and C. | 循环调用同一加权公式，不用角平分线交点，顺序固定。 | S027 |
| Implemented (P1) | `Excircle(A,B,C) → circle` | Excircle opposite A. | 以上述旁心为圆心，到 BC 支撑线的距离为半径；无需附送三个切点。 | S433 |
| Implemented (P1) | `Excircles(A,B,C[,i]) → circle × 3 / circle` | Excircles opposite A, B and C. | 循环构造 Excircle，仅返回圆。 | S028 |
| Implemented (P1) | `NinePointCircle(A,B,C) → circle` | Triangle nine-point circle. | 圆心 N=(O+H)/2，半径 R/2；比三高足定圆更适合直角位置。 | S015 |
| Implemented (P1) | `EulerLine(A,B,C) → line` | Triangle Euler line. | 以 O、H 的齐次连线为主，化简公共因子；O=H 时方向不唯一，undefined。 | S008 |
| Implemented (P1) | `BrocardPoints(A,B,C[,i]) → point × 2 / point` | First and second Brocard points of ordered triangle ABC. | 两组重心可取 `(a²c²:a²b²:b²c²)` 与 `(a²b²:b²c²:a²c²)`，先用有向等角条件核定 first/second 对应；约定第一满足 ∠PAB=∠PBC=∠PCA，第二反向循环。镜像不交换 A、B、C 身份，交换 B、C 会交换两点。保证连续性。 | S006 |
| Defer | `IsogonicCenter(A,B,C,i) → point` | First or second isogonic center. | 不常用。不实现。 | S005 |
| P2 | `FermatPoint(A,B,C) → point` | First isogonic center (X13). | 只返回X(13)，避免讨论。 | S005 |
| Implemented (P1) | `IsodynamicPoint(A,B,C,i) → point` | First or second isodynamic point. | i=1/2 分别采用 X(15)/X(16)，不提供 First/Second 两个函数名；引擎对正三角形的约定须实测。 | S380 S381 |
| Implemented (P1) | `FuhrmannCircle(A,B,C) → circle` | Circle with diameter joining the orthocenter and Nagel point. | 圆心 `(H+Na)/2`，半径 `|H−Na|/2`。 | S373 |
| Implemented (P1) | `BrocardCircle(A,B,C) → circle` | Circle with diameter joining the circumcenter and symmedian point. | 圆心 `(O+K)/2`，半径 `|O−K|/2`；两点重合时遵循原生零半径圆语义。 | S374 |
| P2 | `FeuerbachPoint(A,B,C) → point` | Contact point of the incircle and nine-point circle. | 用 X(11) | S016 |

`BrocardPoints` 的坐标式是本计划的独立代数方案，最终编号由表中等角定义决定，不能依赖原宏输出 I/J。所有中心快捷名的描述都应写清具体对象，而非笼统的 “draw point”。

## 4. 三角形、投影与关联直线

本节的 triangle 返回三个顶点，以便后续独立选取。想要边或 polygon 时由用户另外创建，避免共线垂足时额外 polygon 对象失效。

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| Implemented (P1) | `MedialTriangle(A,B,C[,i]) → point × 3 / point` | Midpoints of BC, CA and AB. | 依次 `(B+C)/2,(C+A)/2,(A+B)/2`。替换含混的 Midpoints。 | S013 |
| Implemented (P1) | `OrthicTriangle(A,B,C[,i]) → point × 3 / point` | Feet of the three triangle altitudes. | A 向 BC、B 向 CA、C 向 AB 作点积投影；直角时允许两个输出重合。 | S014 S385 |
| Implemented (P1) | `CevianTriangle(A,B,C,P[,i]) → point × 3 / point` | Traces of P on the triangle sidelines. | 固定取 AP∩BC、BP∩CA、CP∩AB 的原生直线交点；等价于重心 `(0:q:r),(p:0:r),(p:q:0)`。P 是顶点时部分迹点不唯一。 | S033 S387 |
| Implemented (P1) | `PedalTriangle(A,B,C,P[,i]) → point × 3 / point` | Orthogonal projections of P onto BC, CA and AB. | 各垂足用 P 与其关于支撑直线反射点的中点；不按线段裁剪。 | S034 S385 |
| Implemented (P1) | `PedalCircle(A,B,C,P) → circle` | Circle through the three pedal points of P. | 三垂足定圆；P 在外接圆上时三点共线，不伪装成圆。`PedalCircle(A,B,C,H)` 与 NinePointCircle 相同。 | S386 |
| Implemented (P1) | `IntouchTriangle(A,B,C[,i]) → point × 3 / point` | Contact points of the incircle with BC, CA and AB. | 将 I 投影到三边，不作相切求交。 | S102 S432 |
| Implemented (P1) | `AnticevianTriangle(A,B,C,P[,i]) → point × 3 / point` | Anticevian triangle of P relative to ABC. | 由 P 的齐次重心构成 `(-p:q:r),(p:-q:r),(p:q:-r)`；按有向齐次运算处理外点，分母零时对应顶点在无穷远。 | S404 |
| Implemented (P1) | `CircumcevianTriangle(A,B,C,P[,i]) → point × 3 / point` | Second intersections of AP, BP and CP with the circumcircle. | 对 A、B、C 分别调用已有 SecondIntersection；P=A 时 A 处分支方向未给定，不猜切线。 | S092 |
| Implemented (P1) | `TangentialTriangle(A,B,C[,i]) → point × 3 / point` | Intersections of the circumcircle tangents at B and C, C and A, A and B. | 三顶点极线后两两求交，或求三边极点；不用外点两条切线命令。相邻顶点对径时有输出在无穷远。 | S388 |
| Implemented (P1) | `AntipedalTriangle(A,B,C,P[,i]) → point × 3 / point` | Triangle whose sides pass through A, B and C perpendicular to AP, BP and CP. | 三条边分别以 A−P、B−P、C−P 为法向量，两两求交；P 为顶点时对应边缺少方向。 | S457 |
| Implemented (P1) | `CarnotTriangle(A,B,C,P[,i]) → point × 3 / point` | Circumcenters of PBC, PCA and PAB. | 三次原生外心；P 落对应边上时该点无有限定义。 | S417 |
| P2 | `SimsonLine(A,B,C,P) → line` | Simson line of a point P on the circumcircle. | P关于AB,AC垂足连线。当P不在外接圆上时，仍然默认使用这一行为保持连续性。 | S036 |
| P2 | `SteinerLine(A,B,C,P) → line` | Line of the reflections of P in the three sidelines. | P关于AB,AC对称点连线。当P不在外接圆上时，仍然默认使用这一行为保持连续性。可与下一节四直线版本按类型／数量重载。 | S037 |
| Implemented (P1) | `Orthopole(A,B,C,l) → point` | Orthopole of line l with respect to triangle ABC. | A、B、C 投影到 l 得 U,V,W；分别过 U,V,W 作垂直 BC、CA、AB 的线，求其中两条交点。非退化 ABC 的前两条目标线不平行；只要 l 有定义就不需要自由点。 | S035 |
| P2 | `AntiSteinerPoint(A,B,C,l) → point` | Circumcircle point whose Steiner line is parallel to l. | 过 H 作 l 平行线（即只考虑 l 的方向）。对l关于AB,AC的对称直线求交点。 | S367 |
| P2 | `Orthotransversal(A,B,C,P) → line` | Line through the sideline traces perpendicular to AP, BP and CP. | A 迹点是 BC 与过 P 垂直 AP 的线的交点，B、C 类推。用齐次表达式求三迹共线的线，避免仅连两个恰好重合的迹点；P=A 等零方向位置先判断是否有唯一化简延拓。 | S370 |
| P2 | `Orthocorrespondent(A,B,C,P) → point` | Trilinear pole of the orthotransversal of P. | 使用上一行的线，再取本节后述 TrilinearPole；在齐次层化简，不能将中间无穷远迹点先转普通点。 | S419 |
| P2 | `TaylorCircle(A,B,C) → circle` | Circle through the six projections of altitude feet onto the other sidelines. | 作一个高足，投影到另一条边。圆心直接用 X(389)。 | S376 |

## 5. 点变换、有向比例与共轭

术语使用 ETC 的通行定义；ETC 原文默认三线坐标，因此这里优先从几何定义自行推导重心形式。尤其不能把 ETC 的三线倒数直接当成重心倒数。参见 [ETC glossary](https://faculty.evansville.edu/ck6/encyclopedia/glossary.html)。

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| Implemented (P1) | `Complement(A,B,C,P) → point` | Complement of P with respect to triangle ABC. | `(A+B+C−P)/2`；倍率 −1/2、中心 G。该定义适用于共线 A、B、C。 | S094 S440 |
| Implemented (P1) | `Anticomplement(A,B,C,P) → point` | Anticomplement of P with respect to triangle ABC. | `A+B+C−2P`；倍率 −2、中心 G，与上一行互逆。 | S411 S439 |
| Existing | `IsogonalConjugate(A,B,C,P) → point` | Isogonal conjugate of P with respect to triangle ABC. | 齐次重心 `(a²qr:b²rp:c²pq)`；保留现有有向面积算法。位于边内部时延拓至对顶点，顶点处未定。 | S029 S437 S489 |
| Existing | `IsotomicConjugate(A,B,C,P) → point` | Isotomic conjugate of P with respect to triangle ABC. | 齐次重心 `(qr:rp:pq)`；保留现有实现，不作边上圆交点。 | S030 S438 |
| Implemented (P1) | `IsogonalComplement(A,B,C,P) → point` | Isogonal conjugate of the complement of P. | 先 Complement，再 IsogonalConjugate；内联齐次公式以避免中间仿射极点。不要误称 complementary conjugate。 | S443 |
| Defer | `ComplementOfIsotomicConjugate(A,B,C,P) → point` | Complement of the isotomic conjugate of P. | 命名太长。暂时不实现。 | S465 |
| P2 | `AntigonalConjugate(A,B,C,P) → point` | Antigonal image of P with respect to triangle ABC. | 等角共轭 → 关于外接圆反演 → 等角共轭。先在重心齐次层合成并约掉公共因子，使外接圆上的一般点可延拓到 H；H 等本质基点仍未定。不能只依赖可能非唯一的五点双曲线。 | S467 |
| Implemented (P1) | `TrilinearPolar(A,B,C,P) → line` | Trilinear polar of P with respect to triangle ABC. | P 的重心为 `(p:q:r)`，线在重心变量 X,Y,Z 中为 `qr X+rp Y+pq Z=0`。名称虽含 trilinear，系数必须与当前坐标制一致；保留符号。 | S369 |
| Implemented (P1) | `TrilinearPole(A,B,C,l) → point` | Trilinear pole of l with respect to triangle ABC. | 将 l 写成重心线系数 `(u:v:w)`，输出重心 `(vw:wu:uv)`；先化简再有限化。是上一行在一般位置的逆；非二次曲线的 Pole。 | S377 |
| Implemented (P1) | `HarmonicConjugate(A,B,P) → point` | Point Q with complex cross-ratio (A,B;P,Q)=-1, including the collinear case. | 取局部复数 u=B−A、v=P−A，输出 `A+uv/(2v−u)`。显式 ToComplex 后乘除，再 ToPoint；非共线时四点共圆且交比 −1，共线时连续退化为有向调和共轭。2v=u 时结果在无穷远。 | S403 |
| Implemented (P1) | `TransferRatio(A,B,C,D,P) → point` | Transfer the directed division parameter of P on AB to CD. | t=((P−A)·(B−A))/|B−A|²，输出 C+t(D−C)，要求 P∈AB；保留外分和反向。A=B 未定，C=D 可连续返回 C。 | S415 |
| Implemented (P1) | `TrisectionPoint(A,B) → point` | Trisection point one third of the way from A to B. | `(2A+B)/3`；两点重合仍有效。另一点由交换输入得到。 | S106 |
| Implemented (P1) | `GoldenSectionPoint(A,B) → point` | Internal golden-section point at parameter (sqrt(5)-1)/2 from A to B. | `A+((√5−1)/2)(B−A)`；描述明确取靠近 B 的分点，替代旧式正方形和圆交点。另一点交换 A、B。 | S436 |
| Implemented (P1) | `DirectSimilarity(A,B,C,D) → point` | Image of D under the direct similarity fixing A and sending B to C. | 局部复数 `A+(C−A)(D−A)/(B−A)`；B≠A。C=A 时为常值映射，D=A 时该作用点返回 A。 | S455 |
| Implemented (P1) | `DirectSimilarity(A,B,C,D,E) → point` | Point F such that there is a direct similarity sending A,B,C to D,E,F. | 输出 `D+(E−D)(C−A)/(B−A)`；四点版是固定 A 的特例。 | S455 |
| Implemented (P1) | `OppositeSimilarity(A,B,C,D) → point` | Image of D under the opposite similarity fixing A and sending B to C. | 局部复数 `A+(C−A) conjugate((D−A)/(B−A))`；B≠A。 | S456 |
| Implemented (P1) | `OppositeSimilarity(A,B,C,D,E) → point` | Point F such that there is an opposite similarity sending A,B,C to D,E,F. | 输出 `D+(E−D) conjugate((C−A)/(B−A))`；四点版是固定 A 的特例。 | S456 |
| P2 | `CevianAffineMap(A,B,C,X,P) → point` | Image of P under the affine map sending ABC to the cevian triangle of X. | 先求 X 的三个 cevian 顶点 D,E,F；P 的归一化重心为 α,β,γ，返回 αD+βE+γF。某个目标顶点在无穷远时不是仿射映射；不要用复杂交点链绕过此前提。 | S406 |
| P2 | `PedalAffineMap(A,B,C,X,P) → point` | Image of P under the affine map sending ABC to the pedal triangle of X. | 将上一行目标 D,E,F 换成 X 的三垂足；共线目标允许降秩仿射映射。纠正 Pedian 的含混命名及原参数说明。 | S416 |
| P2 | `Isoconjugate(A,B,C,X,P) → point` | Isoconjugate of P under the diagonal reciprocal map fixing X. | 设 X 重心 `(u:v:w)`，P 为 `(p:q:r)`，取 `(u²qr:v²rp:w²pq)`。这是 barycentric fixed-point convention；与某些文献用 P 命名的 isoconjugate 不同，描述必须保留 “fixing X”。需用源宏一般位置核对，而不是直接沿用 X_fixed 名称。 | S414 |
| P2 | `Isoconjugate(A,B,C,X,Y,P) → point` | Isoconjugate of P under the diagonal reciprocal map sending X to Y. | 重载。上一条是这一条的特例。 | S414 |
| P2 | `Crosspoint(A,B,C,P,Q) → point` | Intersection of the tangents at P and Q to the circumconic through ABCPQ. | 原生五点 Conic，再分别取 P、Q 的极线求交；比通过自由点求 Pole 稳定。优先推导重心乘积式以延拓可消去退化；P=Q 的一般切线极限不唯一，不能任取一点。 | S412 |
| P2 | `Cevapoint(A,B,C,P,Q) → point` | Cevapoint of P and Q with respect to triangle ABC. | 作 Q 的反 cevian 三角形；按定义从 P 向其顶点连线取得 ABC 边上的迹，求所得三角形与 ABC 的透视中心。用齐次叉积和公共因子消除实现；最终核验三条透视线共点与 P/Q 对称性。 | S408 |
| P2 | `CevaConjugate(A,B,C,X,P) → point` | X-Ceva conjugate of P with respect to triangle ABC. | 取 X 的 cevian 三角形和 P 的 anticevian 三角形的对应顶点连线之透视中心；在齐次层实现。明确 X 是参数、P 是被作用点，验证一般位置为对合。 | S409 |
| P2 | `CrossConjugate(A,B,C,X,P) → point` | X-cross conjugate of P with respect to triangle ABC. | 取 P 的 cevian 三角形 T，再取 X 对 T 的 cevian 三角形 U；求 ABC 与 U 的透视中心。全部用齐次运算，不能被中间迹在无穷远打断；验证对合。 | S413 |
| P2 | `CyclocevianConjugate(A,B,C,P) → point` | Cyclocevian conjugate of P with respect to triangle ABC. | 采用等截共轭 → 在 ABC 的 anticomplementary triangle 中等角共轭 → 回到 ABC 等截共轭的复合。先把三个三角形的坐标变换合成；另以两个 cevian 三角形六点共圆及对合性质核验。 | S418 |

### 圆上的 A 专属点

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| Implemented (P1) | `ArcMidpoint(A,B,C) → point` | Midpoint of the BC arc not containing A on the circumcircle. | 从 A 沿内部角平分线方向取外接圆的第二点；用单位方向 `u=(B−A)/c+(C−A)/b` 和圆的已知根公式，不需要 I≠A 或求交编号。两相邻点对径等临界位置由 A 所在半平面定义。 | S018 |
| Implemented (P1) | `SouthPole(A,B,C) → point` | South pole of triangle ABC. | 与上一条相同，SouthPole是三角形几何学中常用俗称。| S018 |
| Implemented (P1) | `OppositeArcMidpoint(A,B,C) → point` | Midpoint of the BC arc containing A on the circumcircle. | 对上一点作关于 O 的中心对称。 | S019 |
| Implemented (P1) | `NorthPole(A,B,C) → point` | North pole of triangle ABC. | 与上一条相同，NorthPole是三角形几何学中常用俗称。| S019 |
| Implemented (P1) | `Antipode(q:conic,P) → point`; `Antipode(A,B,C) → point` | Antipode of P on a central conic, or of A on the triangle circumcircle. | 二次曲线版作 P 关于 Center(q) 的中心反射，前提 P∈q；支持圆、椭圆、双曲线，抛物线无有限中心。三点版复用此命令求 A 的外接圆对径点。 | S020 |
| Implemented (P1) | `CircumcevianPoint(A,B,C,P) → point` | Second intersection of AP with the triangle circumcircle. | A 是已知根，用 SecondIntersection；此命令是 CircumcevianTriangle 的 A 分量，便于只取一个输出。 | S092 |
| Defer | `CircumsymmedianPoint(A,B,C) → point` | Second intersection of the A-symmedian with the circumcircle. | 不实现。请查看 HarmonicConjugate。 | S026 |

旧 `Circumortho Point`、`CircumMixtilinear Conjugate` 名称的公认定义尚未核定，见暂缓区；不能仅凭词根猜测。

## 6. 圆、相切与二次曲线

### 6.1 已有工具和小型圆工具

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| Existing | `Conic(o1:pointOrLine,...,o5:pointOrLine[,i]) → conic(s)` | Conics satisfying five point and tangent-line constraints. | 保留当前混合约束算法与输出槽；不新增 Conic0P5L 等组合名。所有直线类取支撑线。 | S079 S080 S081 S082 |
| Existing | `SecondIntersection(q,P,Q) → point` | Other intersection of q with line PQ, given P on q. | 保留当前共轭直径求弦中点后反射的算法；普通相切返回 P。包含直线或第二点在无穷远时允许 undefined。 | S104 |
| Implemented (P1) | `RadicalCenter(c1,c2,c3) → point` | Radical center of three circles. | 取两组原生根轴再求交，或将归一化圆幂方程相减解 2×2 线性系统；共轴时不唯一、根轴平行时在无穷远。 | S221 S366 |
| Implemented (P1) | `SimilarityCenter(c1,c2,s) → point` | External (s=1) or internal (s=-1) center of similitude of two circles. | O1,O2 半径 r1,r2，输出 `(r1 O2−s r2 O1)/(r1−s r2)`。s 仅允许 ±1；外位似等半径时一般在无穷远，内位似中心正常。不要通过任意圆上点确定相似。 | S361 S362 |
| P2 | `CommonTangents(c1,c2,s[,i]) → line × 2 / line` | Common direct (s=1) or transverse (s=-1) tangents of two circles. | 以单位法向 n 写 `n·(O2−O1)=r1−s r2`，由中心差方向及其 90°方向构造两个 n，线为 `n·(X−O1)=r1`。平方根只用于真正的二分支；等半径外公切线仍有限。普通相切两槽可重合，不以无穷远位似中心为前提。需要全部公切线时直接用原生 Tangent。尽量考虑能否推广到二次曲线。 | S222 S223 S363 S364 |
| P2 | `MixtilinearIncircle(A,B,C) → circle` | Circle tangent to rays AB and AC and internally tangent to the circumcircle. | 取内部角平分线单位向量 u、k=sin(A/2)。圆心 X=A+t u、半径 ρ=tk；由 `|X−O|²=(R−ρ)²`，约去顶点零半径根后 `t=2((O−A)·u−Rk)/(1−k²)`。核验 t>0、ρ≤R 及射线接触。仅返回圆。 | S022 |
| P2 | `MixtilinearIncircles(A,B,C[,i]) → circle × 3 / circle` | A-, B- and C-mixtilinear incircles. | 对上式循环排列，不重复计算外心，不附送错序的圆心。 | S023 |
| P2 | `MixtilinearContactPoint(A,B,C) → point` | Contact point of the A-mixtilinear incircle with the circumcircle. | 由两圆内切关系用圆心径向比例求 `(R X−ρ O)/(R−ρ)`；不求相切圆交点。重合圆时接触不唯一。 | S024 |
| P2 | `MixtilinearExcircle(A,B,C) → circle` | Circle tangent to rays AB and AC and externally tangent to the circumcircle. | 与上式同一内部角平分线，用 `|X−O|²=(R+ρ)²` 得 `t=2((O−A)·u+Rk)/(1−k²)`，取正半径解。这里明确是外切外接圆的 A 支，不混同旁切圆或外角平分线分支。 | S130 |
| P2 | `MixtilinearExcircles(A,B,C[,i]) → circle × 3 / circle` | A-, B- and C-mixtilinear excircles. | 上一算法按 A、B、C 循环；与 incircle 是不同的相切语义，不依赖同一签名作隐式判别。 | S131 |
| P2 | `HaggeCircle(A,B,C,P) → circle` | Hagge circle of P with respect to triangle ABC. | Hagge圆的圆心为P的等角共轭点关于九点圆心（X(5)）的对称点。且经过垂心。 | S375 |
| P2 | `HaggeInverse(A,B,C,P) → point` | Inverse of P in its Hagge circle. | P对Hagge圆反演。 | S484 |
| P2 | `ApolloniusCircle(A,B,C) → conic` | Generalized circle defined by PB/PC = AB/AC. | 以 `b²|X−B|²−c²|X−C|²=0` 生成二次系数。b=c 时保留为 BC 的垂直平分线的退化 conic，而非除以 b²−c²；能否稳定保持原生 conic 类型须验证。不叫含混的 Apollinius。 | S378 |
| P2 | `ApolloniusCircles(A,B,C[,i]) → conic × 3 / conic` | Apollonius generalized circles associated with A, B and C. | 循环使用上一系数式，固定三个 conic 槽；不把等腰位置动态改成 line 返回类型。若原生不能保持类型，此家族暂缓，而非承诺不存在的圆。 | S379 |

原生 [Tangent](https://geogebra.github.io/docs/manual/en/commands/Tangent/) 已支持两圆的全部公切线。CommonTangents 仅作为“按内／外语义选两条”的补充，不能照搬取圆上自由点和过位似中心的方法。

### 6.2 三角形关联圆锥曲线

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| P2 | `IsogonalConjugate(A,B,C,l) → conic` | Isogonal image of the supporting line l. | **重载现有点版**。l 的重心线系数为 u,v,w；像的重心方程是 `u a² YZ+v b² ZX+w c² XY=0`。直接换算二次系数，不取两个自由点。直线过顶点时保留完整代数退化像并说明可能有基点附加分量，不能声称它始终是非退化轨迹。 | S368 |
| P2 | `IsotomicConjugate(A,B,C,l) → conic` | Isotomic image of the supporting line l. | 与上一重载平行，方程 `u YZ+v ZX+w XY=0`。这是从现有共轭家族自然补齐的新增项；退化语义同上。 | — |
| P2 | `KiepertHyperbola(A,B,C) → conic` | Kiepert rectangular circumhyperbola of triangle ABC. | 圆锥曲线ABCGH （显然定义良好，仅在ABC坍缩为三点共线或等边是自然无定义） | S007 |
| P2 | `JerabekHyperbola(A,B,C) → conic` | Jerabek rectangular circumhyperbola of triangle ABC. | 圆锥曲线ABCOH （显然定义良好，仅在ABC坍缩为三点共线或等边是自然无定义）  | S466 |
| P2 | `FeuerbachHyperbola(A,B,C) → conic` | Feuerbach rectangular circumhyperbola of triangle ABC. |圆锥曲线ABCIH （显然定义良好，仅在ABC坍缩为三点共线或等边是自然无定义）  | S012 |
| P2 | `SteinerInellipse(A,B,C) → conic` | Ellipse tangent to the triangle sidelines at their midpoints. | 对标准等边三角形的内切圆作仿射映射，或用重心二次型 `X²+Y²+Z²−2XY−2YZ−2ZX=0` 换算系数；中心 G。非共线 ABC 时稳定。 | S401 |
| P2 | `SteinerCircumellipse(A,B,C) → conic` | Circumellipse of ABC centered at the centroid. | 将 SteinerInellipse 关于 G 作倍率 −2 的位似；亦可用重心方程 `XY+YZ+ZX=0`。原名 Steiner Exellipse 改为标准 circumellipse。 | S402 |
| P2 | `SteinerFoci(A,B,C[,i]) → point × 2 / point` | Foci of the Steiner inellipse. | 从上一二次型取原生 Focus。正三角形时两焦点重合 G，保留两个输出；不命名为 Laofeng Points。 | S372 |
| P2 | `InconicWithFocus(A,B,C,P) → conic` | Real ellipse tangent to the three sidelines with P as a focus. | 仅在 P 为严格内点时承诺实内切椭圆：另一焦点 Q 是等角共轭；将 P 关于任一边反射，反射点到 Q 的距离为长轴长，得到中心和二次型。不凭固定一条边与 PQ 相交取椭圆上的点。外点可能对应其他实 conic，不自动称 ellipse。 | S371 |
| P2 | `InconicWithCenter(A,B,C,P) → conic` | Conic tangent to the three sidelines with center P. | 在边坐标中写一般内切二次型，中心条件是两条线性约束，连同尺度归一化解系数；可用其对偶矩阵的对角零形式降低次数。非唯一或退化时如实未定义。中点三角形内部对应实内切椭圆；其他位置可能为双曲线或虚曲线，不统一称 ellipse。 | S470 |
| P2 | `IsogonalPairWithMidpoint(A,B,C,P[,i]) → point × 2 / point` | Isogonal pair with prescribed midpoint P. | 作以P为中心的圆锥曲线的焦点。 | S471 |

**后端注意**：TriangleCurve 的标准重心方程可用于推导和验证；[官方手册](https://geogebra.github.io/docs/manual/en/commands/TriangleCurve/)明确其结果是隐式多项式。所有承诺返回 conic 的命令仍应转换为六系数原生 Conic。

## 7. 完全四边形、完全四点形与对合

术语约定：四条一般位置直线形成 complete quadrilateral；四个一般位置点形成 complete quadrangle。原工具混用这两个名称。四直线默认没有循环顺序；若某项确实依赖顺序，必须写在描述中，不能称其为无序不变量。

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| Implemented (P1) | `DiagonalPoints(A,B,C,D[,i]) → point × 3 / point` | Diagonal points of the complete quadrangle ABCD. | 固定顺序 AB∩CD、AC∩BD、AD∩BC。齐次叉积，无穷远对角点无法作为普通 point 输出。比 CompleteQuadrilateral 更准确。 | S091 |
| P2 | `MiquelPoint(A,B,C,D) → point` | Miquel point of a complete quadrilateral. | 选共享有限顶点 P 的两个三线三角形外接圆。P 是已知公共点，用根轴＋已知根反射得到另一点，不取交点编号。自适应选择非退化三角形；平行、三线共点等情况不保证存在唯一有限点。核验四个圆。 | S083 |
| P2 | `MiquelPoint(l1,l2,l3,l4) → point` | Miquel point of a complete quadrilateral. | 重载。 | S083 |
| Implemented (P1) | `NewtonLine(A,B,C,D) → line` | Newton line of the quadrilateral with ordered vertices ABCD. | 四点为循环顶点，输出 AC 与 BD 中点的连线；对应四线 AB、BC、CD、DA 版本。 | S084 |
| Implemented (P1) | `NewtonLine(l1,l2,l3,l4) → line` | Line through the midpoints of the three diagonals of a complete quadrilateral. | 取两组互补直线交点作为对角端点，算三个对角中点；只固定取其中两个。不讨论中点是否重合。 | S084 |
| P2 | `SteinerLine(l1,l2,l3,l4) → line` | Line containing the orthocenters of the four component triangles. | 与三角形＋外接圆点版本重载。求四个三线三角形垂心，选择不重合的一对连线，验证另两个在其上。不要与 Steiner/Simson 同名现象混成一个错误签名。 | S085 |
| P2 | `SteinerCircle(l1,l2,l3,l4) → circle` | Circle through the circumcenters of the four component triangles. | 暂不实现，等想到更好的算法。 | S086 |
| P2 | `TangentParabola(l1,l2,l3,l4) → conic` | Parabola tangent to four lines in general position. | 优先使用 MiquelPoint 为焦点、四线 SteinerLine 为准线的直接构造，核验四条线的对偶切线条件；也可在对偶 conic 中加入无穷远线为切线求解。焦点在准线上是退化，不擅自投影修正。 | S099 |
| P2 | `NinePointConic(A,B,C,D) → conic` | Conic through the six pairwise midpoints of four points. | 九点曲线的一个性质是它是经过ABCD四点圆锥曲线中心的轨迹，据此考虑直接推出其表达式。不用轨迹功能。在两点重合时尽量能退化为九点圆。 | S464 |
| P2 | `InvolutionFixedPoints(l,A,A1,B,B1[,i]) → point × 2 / point` | 不实现 | 函数API还需细究，暂不实现。 | S078 |

## 8. 代数曲线、极曲线与剩余交点

### 8.1 类型和命名决策

三次和四次曲线操作属于 P2，先解决 `implicitCurve` 类型和原生多项式系数获取。**禁止为了读取曲线而在曲线上创建九个自由点**。固定类型并不意味着所有 implicitCurve 都是三次；输入曲线次数是这些操作的几何前提，不满足时报告明确错误。

不保留 `CubicThirdIntersection2`、`CubicPolarLine2` 等后缀名字。九个点先构造成一个有标签的曲线，再传给操作；这种分步使用便于复用，避免每次重复展开九个大型行列式。若将来确有需要，可在相同名字下增加“九点＋作用点”的按个数重载，但本计划不优先实现这种长签名。

二次／三次的 **polar line** 合并为 `PolarLine(P,curve)` 的强类型重载；三次的第一极曲线是 conic，另称 `PolarConic`，不可用同一个不带阶数的 implicitCurve 签名猜测返回 line 或 conic。原生 `Polar(P,q)` 和 `Polar(l,q)` 继续可用，不改变其语义。GeoGebra 的 [Polar 手册](https://geogebra.github.io/docs/manual/en/commands/Polar/) 已同时覆盖二次曲线的极线和极点。

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| P2 | `Cubic(P1,...,P9) → implicitCurve` | Unique cubic through nine points, when the constraints are independent. | 增加**九点重载**，保留原生 `(A,B,C,index)`。优先原生 ImplicitCurve 的九点形式；若需自建，用含常数项的 9×10 次数≤3单项式矩阵求一维齐次核。平移尺度归一化，秩<9时拒绝无限解族，不用强定常数=1的仿射解。 | S424 S441 |
| Native | `ImplicitCurve({P1,...,P14}) → implicitCurve` | Implicit curve through fourteen points. | 原生已提供四次插值；不再新增 Quartic 的十四点同义包装。秩不足时不把“画出来某条曲线”当唯一解。 | S430 S442 |
| P2 | `PolarLine(P,q:conic) → line` | Polar line of P with respect to a conic. | 原生 Polar(P,q)；此短别名只为与三次版形成统一语义家族。 | S105 |
| P2 | `PolarLine(P,F:implicitCurve) → line` | Second polar of P with respect to a cubic. | 将 F 齐次化为次数 3 的 Fh(X,Y,Z)，P=(p,q,1)，令 DP=p∂X+q∂Y+∂Z；输出 `DP² Fh=0` 的线。也可用 ∇Fh(P) 作线系数。P 不必在曲线上；P 在曲线上且光滑时它才是切线。奇点梯度为零时不捏造切线。 | S474 S478 |
| P2 | `PolarConic(P,F:implicitCurve) → conic` | First polar conic of P with respect to a cubic. | 输出 `DP Fh=0` 的六系数二次型；不能只对非齐次 F 求 x、y 导数而漏掉 Z 方向的低次项。允许退化 conic，零多项式未定。 | S473 S479 |
| P2 | `SecondIntersection(q,P,l:lineLike) → point` | Other intersection of a conic and a line containing the known point P. | 在现有 `(q,P,Q:point)` 之外增加**直线重载**。以 l 的法向取稳定方向，再用弦中点／韦达算法；核验 P 在 l∩q。不改变现有三点接口。 | S104 |
| P2 | `ThirdIntersection(F,P,Q) → point` | Residual intersection of cubic F with line PQ, given P and Q on F. | 令 X=P+t(Q−P)，限制 F 得 `At³+Bt²+Ct+D`，已知根 t=0、1，剩余根为 `−B/A−1`；从最高次齐次项算 A，直接恢复第三点。避免斜率、求三根再删最近两根。A=0 时剩余点在无穷远；直线为分量时非唯一。 | S472 S476 |
| P2 | `TangentialPoint(F,P) → point` | Residual intersection of a cubic with its tangent at a smooth point P. | 用 PolarLine 得切线方向 v，限制 F(P+t v)，已知二重根 t=0，剩余根为 `−B/A`。普通拐点返回 P（三重交），P 奇异时不指定切向。不要把 Q=P 代入 ThirdIntersection 的零方向。 | S475 S477 |
| P2 | `PivotalIsogonalCubic(A,B,C,P) → implicitCurve` | Locus where a point, its isogonal conjugate and pivot P are collinear. | 在重心变量 X,Y,Z 中用行列式 `det[(X,Y,Z),(a²YZ,b²ZX,c²XY),(p,q,r)]`；整体次数 3，生成隐式多项式。无轨迹点、无分支扫掠。原生 TriangleCurve 可承载此方程。 | S389 |

原生 [ImplicitCurve](https://geogebra.github.io/docs/manual/en/commands/ImplicitCurve/) 已按点数支持不同次数；它不能保证秩退化时的唯一性。[Cubic](https://geogebra.github.io/docs/manual/en/commands/Cubic/) 已提供常用编号三次曲线，支持的编号随引擎版本变化。凡内置有对应编号就使用内置，不从九个中心再拟合。

### 8.2 编号曲线的处理

| 阶段 | 源名称 | 处理与算法依据 | Source |
|---|---|---|---|
| Native | Neuberg Cubic / K001 Neuberg | 使用原生 `Cubic(A,B,C,1)`；旧平行 Euler line 的 Locus 双分支删除，不新增另一个 Neuberg 命令。 | S390 S428 |
| Native | K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas | 使用原生 Cubic 编号 2、3、4、5、7。显示名规范为 Thomson, McCay, Darboux, Napoleon, Lucas；不复制九点插值。 | S425 S426 S427 S429 S469 |
| Defer | K028; K073; Q002 | 分别为源称 Musselman Third Cubic、Neuberg inverse cubic、Euler–Morley quartic。先核定目录方程、原生支持与编号；不凭九／十四个特殊点假定插值总有唯一正确结果。 | S461 S462 S480 |

## 9. 不新增的原生包装

以下不是漏项，而是建议直接使用内置命令。它们无需再维护一套自定义构造。

| 阶段 | 源工具 | 建议使用方式及理由 | Source |
|---|---|---|---|
| Native | Center of Conic | Center(q)。原宏用随机路径点及平行弦定中心，长且可能退化；抛物线本来没有有限中心。 | S004 |
| Native | Incircle / 内切圆 | 原生 Incircle(A,B,C)。只要圆时无需附带圆心和切点，切点另由 IntouchTriangle 获取。 | S011 S432 |
| Native | Foci / Asymptotes / Axes / Directrices | 分别使用 Focus、Asymptote、Axes、Directrix。圆、抛物线等不同情况遵循原生输出数，不包装成假定恒为两个的宏。 | S095 S096 S097 S098 |
| Native | Pedal | 垂足直接用原生最近点／点到直线投影；若需要展开，使用本文点积原语。不额外占用 Pedal 名称。 | S103 |
| Native | Intersection | Intersect(Line(A,B),Line(C,D))。不新增与原生 Intersect 平行的 Intersection。 | S093 |
| Native | Pole | 原生 Polar(l,q)。原宏任取线上的两个自由点再交极线没有必要；Pole 与 TrilinearPole 是不同对象。 | S105 |
| Native | Radical Axis / 根轴 | 原生 RadicalAxis(c1,c2)；四点版先 Circle(A,B)、Circle(C,D)。不保留附送垂足 H' 的混合输出。 | S220 S365 S431 |
| Native | Triangle Center X_57; Bevan Point; Schiffler Point | 直接 TriangleCenter 的 X(57)、X(40)、X(21)。这些非高频别名暂不增加库体积。 | S100 S101 S107 |

## 10. 暂缓定义与专题工具

这些工具不在 P1/P2 实现清单中。下表给出原有输入／输出和已知构造含义，供审阅时决定是否提升优先级；**未核定的定义明确标为未核定**，不编造算法。

| 源名称 / 暂定英文标识 | 源输入 → 输出 | 暂缓理由及已知信息 | Source |
|---|---|---|---|
| Circumortho Point | A,B,C → point | 未核定通行名称。原步骤：A 的对径点 D，M=BC 中点，再取 DM 与外接圆的另一个点。若要保留，宜按此明确描述命名，并用已知根法；不能仅凭 circumortho 一词定义。 | S021 |
| CircumMixtilinear Conjugate | A,B,C → point | 未核定“conjugate”的标准对象。原步骤从 A 的对径点连 A-mixtilinear 圆心，取外接圆第二点；只是一个 A 专属点，并未定义作用于任意 P 的共轭。 | S025 |
| Mixtilinear Circumcircle / Three Mixtilinear Circumcircles / Mixtilinear Circumcircle Tangency | A,B,C → circle(s) / point | 原构造得到过 B、C 且与内切圆相切的圆；在等腰位置构造用的交点会去无穷远。尚未核定 tangency 内／外分支和该术语的标准约定。若保留，应在 BC 垂直平分线上设圆心，代入与内切圆有符号相切条件，约去伪根；先明确是否返回所有解。 | S126 S127 S128 |
| Pseudocircumcenter / Poncelet Point | 四线或四点 → point | 不能证明同名两个版本定义等价。四点版的 Poncelet 构造是经过 A,B,C,D,H(ABC) 的直角双曲线中心；Pseudocircumcenter 将其关于四点重心反射。四线版使用循环交点／中点圆。先在 EPG 核定参考结构、顺序和适用域。 | S088 S090 S458 S459 |
| Isogonal Center | 四线或 A,B,C,P → point | 四线版是两圆的另一个公共点；四点版为 P 的等角共轭关于外接圆的反演像。后者可命名 InverseIsogonalImage，但尚不认为两者是同一通用函数。 | S089 S444 |
| NinePoint Conic (four lines) | 四线 → conic | 依赖循环四交点，排列会改变四点集合；建议显式取点后调用 NinePointConic，拒绝四线同名重载。 | S087 |
| Zosma Transform | A,B,C,P → point | 我尚未核定该定义。源式使用**无向**点到三边距离，再按角余弦给三线坐标；这会折叠外点，不能直接推广为有向代数变换。需确认是否确实要求绝对值。 | S391 |
| Orthopolar Conic | A,B,C,P → conic | 源以 AP、BP、CP 的 Orthopole 及关于 (H+P)/2 的反射点拟合。需要核定是否完整等于“过 P 的线的 orthopole 轨迹”，推导二次参数式再消参；仅凭五个样点不足以证明。 | S405 |
| Gergonne Conic | A,B,C,P → conic | 源取 P 的 cevian 三角形，以 Complement(Isotomic(P)) 为中心补反射点，构造过三迹的中心二次曲线。该命名与目标通用定义尚未核定；可先作为未来内切二次曲线算法的推导材料。 | S407 |
| Stammler Hyperbola | A,B,C → conic | 专名与源所用五点条件尚未核定；不以不明专名发布，需核对通行方程及等腰位置。 | S410 |
| Excenters Rectangular Hyperbola | A,B,C,P → conic | 源称“任意给定中心，经过 I 和三个旁心的直角双曲线”。这对任意 P 一般不成立：该四点是垂心四点组，经过它们的双曲线中心受相应九点圆约束。先推导可行中心条件和多解性，拒绝此错误的任意中心承诺。 | S420 |
| Orthopivotal Cubic | A,B,C,P → locus × 2 / implicitCurve | 两个定义差别明显；一个扫轨迹，一个取特殊九点拟合。需核对正交对应的标准有理式后由共线条件消参。不能把样点拟合与轨迹相似当成定义等价证明。 | S421 S450 |
| Perspective Cubic | A,B,C,D,E,F → implicitCurve | 源的紧凑方程可写成 `[X−D,X−B][X−E,X−C][X−F,X−A]+[X−D,X−C][X−E,X−A][X−F,X−B]=0`，括号为有向二倍面积，正负号不能擅改。其具体透视／射影对应定义尚未核定；先确认三角形对应顺序和通行名称，再决定是否实现此易生成的三次方程。 | S460 |
| Cundy–Parry Phi / Psi transforms | A,B,C,P → point | 源分别是 OP∩H(P*) 与 O(P*)∩HP。可用齐次叉积紧凑实现，但要先核定公认命名、源中的 P* 约定，以及 P、O、H 重合／Euler line 情况的可约极点；本轮优先级低。 | S422 S423 |
| QA-Cu1 / Anti QA-Cu1 | A,B,C,P → implicitCurve | 保留 EPG 目录名作为查询标识，未核定四点的无序／有序语义及 anti 变换。原宏用特殊九点拟合，不足以保证在对称配置正确。需取目录方程。 | S445 S463 |
| QL-Cu1 / Dragon Cubic | 四线 / 四点 → implicitCurve | 已确认 [EPG QL-Cu1](https://www.chrisvantienhoven.nl/epg/n-geometry/quadri-figures/ql-items/ql-cu1/) 是标准目录对象；但四点 Dragon 与其对应关系及输入排列未核定。未来优先用目录 CT/DT 方程转换，核验六线交点和 Miquel 点，不拟合九点。不能直接让四点和四线两个版本共用名字。 | S446 S488 |
| QL-Isogonal Pair | 四线 → point × 2 | EPG QL-Cu1 相关 Newton line 上的一对等角共轭点；源内部调用被排除的 PoC 名称。可由 Newton line 与经核定的辅助圆／共轭方程求解；当前未核定辅助圆定义。 | S447 |
| QL-P21 | 四线 → point | 标准目录标识可以保留，但确切参考系和特例尚未核定。先查对应独立条目，不能仅靠源的极线交点接受。 | S448 |
| QL-Cu1-Double | 四线,P∈QL-Cu1 → point | 未核定 “double” 的群律单位元。不能认为曲线切线的剩余交点就自动是群论 2P；必须说明群律原点及符号。 | S449 |
| QL-Quartic1 | 四线 → implicitCurve | 原构造有多处分支交点，再由十四点拟合。需要独立方程和分支不变性证明，避免其中一交点交换就改变曲线。 | S451 |
| Dimidium Circle / QL-Ci6 | 四线 → conic | 可识别为 EPG 目录项，但本轮未核定通用定义；原链大量嵌套 Miquel 构造。将来先验证线排列对称性和紧凑圆心公式。 | S452 |
| QL-P17 / Tf1-QLP17 | 四线 → point | EPG 目录及变换型，确切定义未核定。必须区分基本点与其变换像，不因词相似合并。 | S453 S454 |
| QL-Cu1Vertical | A,B,C → implicitCurve | 原构造先按编号选圆线交点再作四线 QL-Cu1。未核定 vertical 的坐标无关定义；输入实际只有三点。 | S486 |
| QL Eigenvalue | 四点（源顺序 B,I,C,H）→ number | 源式是循环边长的半周长型乘积除以四边长积及常数 16。尚未核定所指算子的 eigenvalue，不能把一个标量直接宣传为通用 quadrilateral eigenvalue。 | S487 |
| Liang–Zelich Perspector | A,B,C,P → point | 源取过 I、三个旁心、P 的 conic，再取 OP 的极点；专门定义及与给定 P 的关系尚未核定。若保留，先验证非退化域和名称。 | S468 |
| Strophoid | A,B,C → implicitCurve | 源描述“∠PAB=∠CAP”含义不足，单独此角关系不能唯一指定一条三次曲线；原反演及九点链也不能补足定义。需重新给出定点、定线、焦点／结点的标准定义。 | S481 |
| CoTf3 / AntiCoTf3 | conic,P → point | 我尚未核定目录变换的标准定义。源依赖主轴和 Center；圆的轴不唯一，抛物线无有限中心。不能宣传为任意 conic 的变换；需由二次型直接推导适用域。 | S482 S483 |
| Hagge Infinity Cubic | A,B,C,P∈circumcircle → implicitCurve | 专名未核定；源通过辅助第四线调用 QL-Cu1。需明确参数位置、分支及与一般 HaggeCircle 的连续关系，取得直接方程再考虑。 | S485 |

这里的“未核定”不是声称定义不存在，而是本轮没有取得足够证据将其作为稳定的公开接口。EPG 的 QA/QL 编号有公开目录意义，与已经按用户要求排除的 PoC/PoE 私有命名不同。

## 11. 实现次序与验收要点（待审阅后执行）

1. 先实现 P1 中的中心、投影、三角形、线性变换；统一参数顺序和同类型多输出元数据。保持现有五个命令兼容。
2. 再实现 P2 的圆和二次型家族；所有 conic 输出都核验原生类型、退化类型及下游重载，不仅检查画面。
3. 补齐 implicitCurve 类型、精确系数读取与数学次数前提，再实现极曲线、三次剩余交点、九点 Cubic 重载。不要用 unknown 通配绕过强类型。
4. 最后再从暂缓区逐项提升，不把它们作为已承诺批量任务。

后续每个工具只需围绕真实数学性质验证：一般三角形、交换 B/C、镜像、平移和尺度变换；钝角／直角／等腰／正三角形；边上点、顶点、切点、平行和重合。变换检查对合或逆关系，圆检查幂／切线距离，conic 检查齐次代入，极线检查极化恒等式。拖动时观察唯一极限能否恢复、undefined 槽能否重新显现。

还应检查导出重开后的原生依赖、辅助标签数量为零、表达式长度与现有编译器预算。**本轮未能运行实际引擎验证：当前会话浏览器清单为空。已提供 P1 验证页，尚不声称其几何检查已通过。**

### P1 实现记录

- `library.json` 已升至 0.1.0，新增 **52 个命令、70 个重载**；原有 5 个命令保留。明确写了“不实现”的 ComplementOfIsotomicConjugate、CircumsymmedianPoint 未加入；其他 P2 项目未提前实现。
- 新增显式 `compose` 定义。可复用其他自定义工具、原生命令及按顺序声明的局部表达式；`expression` 仍只调用原生命令。按重载检测循环依赖，保留嵌套及 500,000 字符上限；文件同名宏不改变内部依赖，调用入口仍尊重文件工具优先级。
- 多输出直接发出独立几何表达式；匿名列表或 Zip 只作内部实现，不返回列表对象。末尾整数 i 在 GeoGebra 中动态选取，不读取数值到 JavaScript。
- SpiekerCenter 使用 X(10)；HarmonicConjugate 使用圆上／直线统一的复数交比公式；两个 Similarity 均完成四点、五点重载；Antipode 接受中心二次曲线。X(13) 的英文描述也已纠正，它不是 first isodynamic point；FermatPoint 仍为 P2。
- 已运行 Vitest：6 个测试文件、78 项通过；生产构建通过。TypeScript 检查仍受未改动的 MarkdownRenderer、TriplesPage 中已有错误阻挡。实际引擎入口为 `/scripts/geogebra-smoke.html?suite=p1`，涵盖所有新增重载、对象类型、辅助对象计数、几何恒等式、拖动及导出重开，**尚未运行**。

### 后续计划的勘误

五点 Conic 的一般位置描述不保证所有非共线三角形均稳定：直角时 H 与顶点重合，ABCGH／ABCOH／ABCIH 会重复输入点，条件可能失秩。P2 实现前仍须核定可化简的等价系数，不能断言仅共线或等边时才有问题。

四点的 NinePointConic 在两点重合时一般也不能退化为九点圆：重合点必须落在极限 conic 上，却通常不在其余三点的九点圆上。需核查极限是否依赖靠近方向，不能任意补成九点圆。

## 12. 参考资料与本轮查阅情况

- [ETC glossary](https://faculty.evansville.edu/ck6/encyclopedia/glossary.html)：用于核对 triangle、conjugate、pole 等术语；其坐标默认是三线坐标。
- [Bernard Gibert glossary](https://bernard-gibert.fr/glossary.html)：本轮直接请求返回 502，未将其未读取内容作为已验证依据。编号曲线暂缓项需后续补查目录原方程。
- [Encyclopedia of Poly Geometry](https://www.chrisvantienhoven.nl/epg/) 与 [QL-Cu1 条目](https://www.chrisvantienhoven.nl/epg/n-geometry/quadri-figures/ql-items/ql-cu1/)：用于确认目录名称存在；不代表本轮已核实全部 QA/QL 条目。
- GeoGebra 官方手册：[TriangleCenter](https://geogebra.github.io/docs/manual/en/commands/TriangleCenter/)、[Cubic](https://geogebra.github.io/docs/manual/en/commands/Cubic/)、[ImplicitCurve](https://geogebra.github.io/docs/manual/en/commands/ImplicitCurve/)、[TriangleCurve](https://geogebra.github.io/docs/manual/en/commands/TriangleCurve/)、[Polar](https://geogebra.github.io/docs/manual/en/commands/Polar/)、[Tangent](https://geogebra.github.io/docs/manual/en/commands/Tangent/)。


## 13. 源名称审计表

下表按源文件首次出现顺序列出所有未排除的显示名称；同名重复导入合并在一行，变体编号单列。中文名称保留在此仅用于溯源，不是最终英文工具名。Source 列的 S 编号可在本文搜索到设计或处置条目。

| Source | Original display name | Entries / definitions | Decision / target |
|---|---|---|---|
| S001 | Centroid | 6 / 1 | Implemented (P1): `Centroid(A,B,C) → point` |
| S002 | Orthocenter | 6 / 1 | Implemented (P1): `Orthocenter(A,B,C) → point` |
| S003 | Excenter | 6 / 1 | Implemented (P1): `Excenter(A,B,C) → point` |
| S004 | Center of Conic | 6 / 1 | Native: Center of Conic |
| S005 | Fermat Point | 6 / 1 | Defer: `IsogonicCenter(A,B,C,i) → point`; P2: `FermatPoint(A,B,C) → point` |
| S006 | Brocard Point | 6 / 1 | Implemented (P1): `BrocardPoints(A,B,C[,i]) → point × 2 / point` |
| S007 | Kiepert Hyperbola | 6 / 1 | P2: `KiepertHyperbola(A,B,C) → conic` |
| S008 | Euler Line | 6 / 1 | Implemented (P1): `EulerLine(A,B,C) → line` |
| S009 | Incenter | 6 / 1 | Existing: `Incenter(A,B,C) → point` |
| S010 | Circumcenter | 6 / 1 | Implemented (P1): `Circumcenter(A,B,C) → point` |
| S011 | Incircle | 6 / 1 | Native: Incircle / 内切圆 |
| S012 | Feuerbach Hyperbola | 6 / 1 | P2: `FeuerbachHyperbola(A,B,C) → conic` |
| S013 | Midpoints | 6 / 1 | Implemented (P1): `MedialTriangle(A,B,C[,i]) → point × 3 / point` |
| S014 | Pedals | 6 / 1 | Implemented (P1): `OrthicTriangle(A,B,C[,i]) → point × 3 / point` |
| S015 | NinePoint Circle | 6 / 1 | Implemented (P1): `NinePointCircle(A,B,C) → circle` |
| S016 | Feuerbach Point | 6 / 1 | P2: `FeuerbachPoint(A,B,C) → point` |
| S017 | NinePoint Center | 6 / 1 | Implemented (P1): `NinePointCenter(A,B,C) → point` |
| S018 | South Pole | 6 / 1 | Implemented (P1): `ArcMidpoint(A,B,C) → point`; Implemented (P1): `SouthPole(A,B,C) → point` |
| S019 | North Pole | 6 / 1 | Implemented (P1): `OppositeArcMidpoint(A,B,C) → point`; Implemented (P1): `NorthPole(A,B,C) → point` |
| S020 | Antipodal Point | 6 / 1 | Implemented (P1): `Antipode(q:conic,P) → point`; `Antipode(A,B,C) → point` |
| S021 | Circumortho Point | 6 / 1 | Defer: See deferred-definition notes |
| S022 | Mixtilinear Incircle | 6 / 1 | P2: `MixtilinearIncircle(A,B,C) → circle` |
| S023 | Three Mixtilinear Incircles | 6 / 1 | P2: `MixtilinearIncircles(A,B,C[,i]) → circle × 3 / circle` |
| S024 | CicumMixtilinear Tangency | 6 / 1 | P2: `MixtilinearContactPoint(A,B,C) → point` |
| S025 | CircumMixtilinear Conjugate | 6 / 1 | Defer: See deferred-definition notes |
| S026 | Circumsymmedian Point | 6 / 1 | Defer: `CircumsymmedianPoint(A,B,C) → point` |
| S027 | Three Excenters | 6 / 1 | Implemented (P1): `Excenters(A,B,C[,i]) → point × 3 / point` |
| S028 | Three Excircles | 6 / 1 | Implemented (P1): `Excircles(A,B,C[,i]) → circle × 3 / circle` |
| S029 | Isogonal Point | 6 / 1 | Existing: `IsogonalConjugate(A,B,C,P) → point` |
| S030 | Isotomic Point | 6 / 1 | Existing: `IsotomicConjugate(A,B,C,P) → point` |
| S031 | Symmedian point | 6 / 1 | Implemented (P1): `SymmedianPoint(A,B,C) → point` |
| S032 | Spieker Center | 6 / 1 | Implemented (P1): `SpiekerCenter(A,B,C) → point` |
| S033 | Ceva Triangle | 7 / 2; variants S033, S387 | Implemented (P1): `CevianTriangle(A,B,C,P[,i]) → point × 3 / point` |
| S034 | Pedal Triangle | 6 / 1 | Implemented (P1): `PedalTriangle(A,B,C,P[,i]) → point × 3 / point` |
| S035 | Orthopole | 6 / 1 | Implemented (P1): `Orthopole(A,B,C,l) → point` |
| S036 | Simson Line | 6 / 1 | P2: `SimsonLine(A,B,C,P) → line` |
| S037 | Mirrorimage Line | 6 / 1 | P2: `SteinerLine(A,B,C,P) → line` |
| S066 | Gergonne | 6 / 2; variants S066, S382 | Implemented (P1): `GergonnePoint(A,B,C) → point` |
| S067 | Nagel | 6 / 2; variants S067, S383 | Implemented (P1): `NagelPoint(A,B,C) → point` |
| S072 | Mittenpunkt | 6 / 2; variants S072, S384 | Implemented (P1): `Mittenpunkt(A,B,C) → point` |
| S078 | 对合不动点 | 3 / 1 | P2: `InvolutionFixedPoints(l,A,A1,B,B1[,i]) → point × 2 / point` |
| S079 | Conic 0P5L | 3 / 1 | Existing: `Conic(o1:pointOrLine,...,o5:pointOrLine[,i]) → conic(s)` |
| S080 | Conic 1P4L | 3 / 1 | Existing: `Conic(o1:pointOrLine,...,o5:pointOrLine[,i]) → conic(s)` |
| S081 | Conic 2P3L | 3 / 1 | Existing: `Conic(o1:pointOrLine,...,o5:pointOrLine[,i]) → conic(s)` |
| S082 | Conic 3P2L | 3 / 1 | Existing: `Conic(o1:pointOrLine,...,o5:pointOrLine[,i]) → conic(s)` |
| S083 | Miquel Point | 2 / 1 | P2: `MiquelPoint(A,B,C,D) → point`; P2: `MiquelPoint(l1,l2,l3,l4) → point` |
| S084 | Newton Line | 2 / 1 | Implemented (P1): `NewtonLine(A,B,C,D) → line`; Implemented (P1): `NewtonLine(l1,l2,l3,l4) → line` |
| S085 | Steiner Line | 2 / 1 | P2: `SteinerLine(l1,l2,l3,l4) → line` |
| S086 | Steiner Circle | 2 / 1 | P2: `SteinerCircle(l1,l2,l3,l4) → circle` |
| S087 | NinePoint Conic | 2 / 1 | Defer: See deferred-definition notes |
| S088 | Pseudocircumcenter | 3 / 2; variants S088, S459 | Defer: See deferred-definition notes |
| S089 | Isogonal Center | 3 / 2; variants S089, S444 | Defer: See deferred-definition notes |
| S090 | Poncelet Point | 3 / 2; variants S090, S458 | Defer: See deferred-definition notes |
| S091 | Complete Quadrilateral | 2 / 1 | Implemented (P1): `DiagonalPoints(A,B,C,D[,i]) → point × 3 / point` |
| S092 | Circumcevian Triangle | 2 / 1 | Implemented (P1): `CircumcevianTriangle(A,B,C,P[,i]) → point × 3 / point`; Implemented (P1): `CircumcevianPoint(A,B,C,P) → point` |
| S093 | Intersection | 2 / 1 | Native: Intersection |
| S094 | Complementary | 2 / 1 | Implemented (P1): `Complement(A,B,C,P) → point` |
| S095 | Foci | 2 / 1 | Native: Foci / Asymptotes / Axes / Directrices |
| S096 | Asymptotes | 2 / 1 | Native: Foci / Asymptotes / Axes / Directrices |
| S097 | Axes | 2 / 1 | Native: Foci / Asymptotes / Axes / Directrices |
| S098 | Directrices | 2 / 1 | Native: Foci / Asymptotes / Axes / Directrices |
| S099 | Tangent Parabola | 2 / 1 | P2: `TangentParabola(l1,l2,l3,l4) → conic` |
| S100 | Triangle Center X_57 | 2 / 1 | Native: Triangle Center X_57; Bevan Point; Schiffler Point |
| S101 | Bevan Point | 2 / 1 | Native: Triangle Center X_57; Bevan Point; Schiffler Point |
| S102 | Intouch Triangle | 2 / 1 | Implemented (P1): `IntouchTriangle(A,B,C[,i]) → point × 3 / point` |
| S103 | Pedal | 2 / 1 | Native: Pedal |
| S104 | Intersection on Circle | 2 / 1 | Existing: `SecondIntersection(q,P,Q) → point`; P2: `SecondIntersection(q,P,l:lineLike) → point` |
| S105 | Pole | 2 / 1 | P2: `PolarLine(P,q:conic) → line`; Native: Pole |
| S106 | Trisection Point | 2 / 1 | Implemented (P1): `TrisectionPoint(A,B) → point` |
| S107 | Schiffler Point | 2 / 1 | Native: Triangle Center X_57; Bevan Point; Schiffler Point |
| S126 | Mixtilinear Circumcircle Tangency | 2 / 1 | Defer: See deferred-definition notes |
| S127 | Mixtilinear Circumcircle | 2 / 1 | Defer: See deferred-definition notes |
| S128 | Three Mixtilinear Circumcircles | 2 / 1 | Defer: See deferred-definition notes |
| S130 | Mixtilinear Excircle | 2 / 1 | P2: `MixtilinearExcircle(A,B,C) → circle` |
| S131 | Three Mixtilinear Excircles | 2 / 1 | P2: `MixtilinearExcircles(A,B,C[,i]) → circle × 3 / circle` |
| S220 | Radical Axis | 2 / 2; variants S220, S365 | Native: Radical Axis / 根轴 |
| S221 | Radical Center | 2 / 2; variants S221, S366 | Implemented (P1): `RadicalCenter(c1,c2,c3) → point` |
| S222 | Outer Tangent | 2 / 2; variants S222, S363 | P2: `CommonTangents(c1,c2,s[,i]) → line × 2 / line` |
| S223 | Inner tangent | 1 / 1 | P2: `CommonTangents(c1,c2,s[,i]) → line × 2 / line` |
| S361 | External Center of Similitude | 1 / 1 | Implemented (P1): `SimilarityCenter(c1,c2,s) → point` |
| S362 | Internal Center of Similitude | 1 / 1 | Implemented (P1): `SimilarityCenter(c1,c2,s) → point` |
| S364 | Inner Tangent | 1 / 1 | P2: `CommonTangents(c1,c2,s[,i]) → line × 2 / line` |
| S367 | Anti-Steiner Point | 1 / 1 | P2: `AntiSteinerPoint(A,B,C,l) → point` |
| S368 | Isogonal Conic | 1 / 1 | P2: `IsogonalConjugate(A,B,C,l) → conic` |
| S369 | Trilinear Polar | 1 / 1 | Implemented (P1): `TrilinearPolar(A,B,C,P) → line` |
| S370 | Orthotransversal | 1 / 1 | P2: `Orthotransversal(A,B,C,P) → line` |
| S371 | Inner Tangent Ellipse | 1 / 1 | P2: `InconicWithFocus(A,B,C,P) → conic` |
| S372 | Laofeng Points | 1 / 1 | P2: `SteinerFoci(A,B,C[,i]) → point × 2 / point` |
| S373 | Fuhrmann Circle | 1 / 1 | Implemented (P1): `FuhrmannCircle(A,B,C) → circle` |
| S374 | Brocard Circle | 1 / 1 | Implemented (P1): `BrocardCircle(A,B,C) → circle` |
| S375 | Hagge Circle | 1 / 1 | P2: `HaggeCircle(A,B,C,P) → circle` |
| S376 | Taylor Circle | 1 / 1 | P2: `TaylorCircle(A,B,C) → circle` |
| S377 | Trilinear Pole | 1 / 1 | Implemented (P1): `TrilinearPole(A,B,C,l) → point` |
| S378 | Apollinius Circle | 1 / 1 | P2: `ApolloniusCircle(A,B,C) → conic` |
| S379 | Three Apollinious Circle | 1 / 1 | P2: `ApolloniusCircles(A,B,C[,i]) → conic × 3 / conic` |
| S380 | Second Isodynamic Point | 1 / 1 | Implemented (P1): `IsodynamicPoint(A,B,C,i) → point` |
| S381 | First Isodynamic Point | 1 / 1 | Implemented (P1): `IsodynamicPoint(A,B,C,i) → point` |
| S385 | Orthic Triangle | 1 / 1 | Implemented (P1): `OrthicTriangle(A,B,C[,i]) → point × 3 / point`; Implemented (P1): `PedalTriangle(A,B,C,P[,i]) → point × 3 / point` |
| S386 | Orthic Circle | 1 / 1 | Implemented (P1): `PedalCircle(A,B,C,P) → circle` |
| S388 | Tangential Triangle | 1 / 1 | Implemented (P1): `TangentialTriangle(A,B,C[,i]) → point × 3 / point` |
| S389 | Cubic With Pivot | 1 / 1 | P2: `PivotalIsogonalCubic(A,B,C,P) → implicitCurve` |
| S390 | Neuberg Cubic | 1 / 1 | Native: Neuberg Cubic / K001 Neuberg |
| S391 | Zosma Transform | 1 / 1 | Defer: See deferred-definition notes |
| S401 | Steiner Inellipse | 1 / 1 | P2: `SteinerInellipse(A,B,C) → conic` |
| S402 | Steiner Exellipse | 1 / 1 | P2: `SteinerCircumellipse(A,B,C) → conic` |
| S403 | Harmonious Conjugate | 1 / 1 | Implemented (P1): `HarmonicConjugate(A,B,P) → point` |
| S404 | Anticevian Triangle | 1 / 1 | Implemented (P1): `AnticevianTriangle(A,B,C,P[,i]) → point × 3 / point` |
| S405 | Orthopolar Conic | 1 / 1 | Defer: See deferred-definition notes |
| S406 | Cevian Affine Mapping | 1 / 1 | P2: `CevianAffineMap(A,B,C,X,P) → point` |
| S407 | Gergonne Conic | 1 / 1 | Defer: See deferred-definition notes |
| S408 | Cevapoint | 1 / 1 | P2: `Cevapoint(A,B,C,P,Q) → point` |
| S409 | Cevaconjugate | 1 / 1 | P2: `CevaConjugate(A,B,C,X,P) → point` |
| S410 | Stammler Hyperbola | 1 / 1 | Defer: See deferred-definition notes |
| S411 | Anticomplementary | 1 / 1 | Implemented (P1): `Anticomplement(A,B,C,P) → point` |
| S412 | Crosspoint | 1 / 1 | P2: `Crosspoint(A,B,C,P,Q) → point` |
| S413 | Crossconjugate | 1 / 1 | P2: `CrossConjugate(A,B,C,X,P) → point` |
| S414 | X_fixed isoconjugate | 1 / 1 | P2: `Isoconjugate(A,B,C,X,P) → point`; P2: `Isoconjugate(A,B,C,X,Y,P) → point` |
| S415 | Ratio Point | 1 / 1 | Implemented (P1): `TransferRatio(A,B,C,D,P) → point` |
| S416 | Pedian Affine Mapping | 1 / 1 | P2: `PedalAffineMap(A,B,C,X,P) → point` |
| S417 | Carnot Triangle | 1 / 1 | Implemented (P1): `CarnotTriangle(A,B,C,P[,i]) → point × 3 / point` |
| S418 | Cyclocevian Conjugate | 1 / 1 | P2: `CyclocevianConjugate(A,B,C,P) → point` |
| S419 | Orthocorrespondence | 1 / 1 | P2: `Orthocorrespondent(A,B,C,P) → point` |
| S420 | Excenters Rectangular Hyperbola | 1 / 1 | Defer: See deferred-definition notes |
| S421 | Orthopivotal Cubic | 2 / 2; variants S421, S450 | Defer: See deferred-definition notes |
| S422 | Cundy-Parry-Phi Transform | 1 / 1 | Defer: See deferred-definition notes |
| S423 | Cundy-Parry-Psi Transform | 1 / 1 | Defer: See deferred-definition notes |
| S424 | Cubic | 1 / 1 | P2: `Cubic(P1,...,P9) → implicitCurve` |
| S425 | K003 McCAY | 1 / 1 | Native: K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas |
| S426 | K004 Darboux | 1 / 1 | Native: K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas |
| S427 | K005 Napolean | 1 / 1 | Native: K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas |
| S428 | K001 Neuberg | 1 / 1 | Native: Neuberg Cubic / K001 Neuberg |
| S429 | K002 Thomson | 1 / 1 | Native: K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas |
| S430 | Quartic | 1 / 1 | Native: `ImplicitCurve({P1,...,P14}) → implicitCurve` |
| S431 | 根轴 | 1 / 1 | Native: Radical Axis / 根轴 |
| S432 | 内切圆 | 1 / 1 | Implemented (P1): `IntouchTriangle(A,B,C[,i]) → point × 3 / point`; Native: Incircle / 内切圆 |
| S433 | 旁切圆 | 1 / 1 | Implemented (P1): `Excircle(A,B,C) → circle` |
| S434 | 三点重心 | 1 / 1 | Implemented (P1): `Centroid(A,B,C) → point` |
| S435 | 垂心 | 1 / 1 | Implemented (P1): `Orthocenter(A,B,C) → point` |
| S436 | 黄金分割 | 1 / 1 | Implemented (P1): `GoldenSectionPoint(A,B) → point` |
| S437 | 等角共轭 | 1 / 1 | Existing: `IsogonalConjugate(A,B,C,P) → point` |
| S438 | 等截共轭 | 1 / 1 | Existing: `IsotomicConjugate(A,B,C,P) → point` |
| S439 | 补点 | 1 / 1 | Implemented (P1): `Anticomplement(A,B,C,P) → point` |
| S440 | 反补点 | 1 / 1 | Implemented (P1): `Complement(A,B,C,P) → point` |
| S441 | 九点三次曲线 | 1 / 1 | P2: `Cubic(P1,...,P9) → implicitCurve` |
| S442 | 十四点四次曲线 | 1 / 1 | Native: `ImplicitCurve({P1,...,P14}) → implicitCurve` |
| S443 | IsogonalComplementary | 1 / 1 | Implemented (P1): `IsogonalComplement(A,B,C,P) → point` |
| S445 | QA-Cu1 | 1 / 1 | Defer: See deferred-definition notes |
| S446 | QL-Cu1 | 1 / 1 | Defer: See deferred-definition notes |
| S447 | QL-Isogonal Pair | 1 / 1 | Defer: See deferred-definition notes |
| S448 | QL-P21 | 1 / 1 | Defer: See deferred-definition notes |
| S449 | QL-Cu1-Double | 1 / 1 | Defer: See deferred-definition notes |
| S451 | QL-Quartic1 | 1 / 1 | Defer: See deferred-definition notes |
| S452 | Dimidium Circle | 1 / 1 | Defer: See deferred-definition notes |
| S453 | QL-P17 | 1 / 1 | Defer: See deferred-definition notes |
| S454 | Tf1-QLP17 | 1 / 1 | Defer: See deferred-definition notes |
| S455 | Spiral Similarity | 1 / 1 | Implemented (P1): `DirectSimilarity(A,B,C,D) → point`; Implemented (P1): `DirectSimilarity(A,B,C,D,E) → point` |
| S456 | Inverse Similarity | 1 / 1 | Implemented (P1): `OppositeSimilarity(A,B,C,D) → point`; Implemented (P1): `OppositeSimilarity(A,B,C,D,E) → point` |
| S457 | Antipedal Triangle | 1 / 1 | Implemented (P1): `AntipedalTriangle(A,B,C,P[,i]) → point × 3 / point` |
| S460 | Perspective Cubic | 1 / 1 | Defer: See deferred-definition notes |
| S461 | Q002 | 1 / 1 | Defer: K028; K073; Q002 |
| S462 | K028 | 1 / 1 | Defer: K028; K073; Q002 |
| S463 | Anti QA-Cu1 | 1 / 1 | Defer: See deferred-definition notes |
| S464 | Nine-Point Conic | 1 / 1 | P2: `NinePointConic(A,B,C,D) → conic` |
| S465 | Isotocomplementary | 1 / 1 | Defer: `ComplementOfIsotomicConjugate(A,B,C,P) → point` |
| S466 | Jerabek Hyperbola | 1 / 1 | P2: `JerabekHyperbola(A,B,C) → conic` |
| S467 | Antigonal Conjugate | 1 / 1 | P2: `AntigonalConjugate(A,B,C,P) → point` |
| S468 | LiangZelich Perspector | 1 / 1 | Defer: See deferred-definition notes |
| S469 | K007 Lucas | 1 / 1 | Native: K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas |
| S470 | Tangent Conic | 1 / 1 | P2: `InconicWithCenter(A,B,C,P) → conic` |
| S471 | Isogonal Pair with Center | 1 / 1 | P2: `IsogonalPairWithMidpoint(A,B,C,P[,i]) → point × 2 / point` |
| S472 | Cubic Third Intersection 2 | 1 / 1 | P2: `ThirdIntersection(F,P,Q) → point` |
| S473 | Cubic Polar Conic 2 | 1 / 1 | P2: `PolarConic(P,F:implicitCurve) → conic` |
| S474 | Cubic Polar Line 2 | 1 / 1 | P2: `PolarLine(P,F:implicitCurve) → line` |
| S475 | Cubic Tangential 2 | 1 / 1 | P2: `TangentialPoint(F,P) → point` |
| S476 | Cubic Third Intersection | 1 / 1 | P2: `ThirdIntersection(F,P,Q) → point` |
| S477 | Cubic Tangential | 1 / 1 | P2: `TangentialPoint(F,P) → point` |
| S478 | Cubic Polar Line | 1 / 1 | P2: `PolarLine(P,F:implicitCurve) → line` |
| S479 | Cubic Polar Conic | 1 / 1 | P2: `PolarConic(P,F:implicitCurve) → conic` |
| S480 | K073 | 1 / 1 | Defer: K028; K073; Q002 |
| S481 | Strophoid | 1 / 1 | Defer: See deferred-definition notes |
| S482 | CoTf3 | 1 / 1 | Defer: See deferred-definition notes |
| S483 | AntiCoTf3 | 1 / 1 | Defer: See deferred-definition notes |
| S484 | Inverse in Hagge Circle | 1 / 1 | P2: `HaggeInverse(A,B,C,P) → point` |
| S485 | Hagge Infinity Cubic | 1 / 1 | Defer: See deferred-definition notes |
| S486 | QL-Cu1Vertical | 1 / 1 | Defer: See deferred-definition notes |
| S487 | QL Eigenvalue | 1 / 1 | Defer: See deferred-definition notes |
| S488 | Dragon Cubic | 1 / 1 | Defer: See deferred-definition notes |
| S489 | Isogonal Conjugate | 1 / 1 | Existing: `IsogonalConjugate(A,B,C,P) → point` |
