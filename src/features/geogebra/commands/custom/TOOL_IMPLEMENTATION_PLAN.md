# Custom geometry tools — implementation review plan

状态：**P1、P2、P3 已实现；完整 P3 实机验收尚未完成**。P1 已人工运行实际 GeoGebra 引擎验证，完整 P2 实机验证待运行；兼容性专项和 P3 本次已验证范围见第 11 节。P3 按已确认的第 10.2 节计划实现，共新增 34 个工具名、42 个重载。工具名称和面向用户的描述使用英文；设计理由和算法说明使用中文。

## 1. 范围、来源和取舍

已读取当前 `README.md`、`library.json`、类型与环境代码，以及 `.agents/ggb_tools/001/tools.json` 中的工具元数据、构造步骤和相关 XML 对象。源文件有 **489 个条目、219 个不同显示名称、230 种忽略顶层 cmdName 后的定义**。其中 **31 个不同名称以 PoC/PoE 开头，全部排除**；余下 **188 个名称**的去向见末尾审计表。这里的源编号是 JSON 的 `index`，不是三角形中心或 EPG 编号。

本计划不逐项复制原宏，也不为重复导入产生的数字后缀创建别名。保留常用语义快捷命令，但不重复包装本身已经易用的原生命令。涉及尚未核定的专门定义，明确暂缓，不能用一个貌似合理的构造冒充原定义。

阶段约定：

- **Existing**：当前网站已实现，保留接口；本轮不重写。
- **Implemented (P1)**：首批工具，自动测试通过，用户已人工运行原生引擎验收脚本。
- **Implemented (P2)**：第二批工具，自动测试通过；原生引擎验收脚本已补充但本会话未运行。
- **Implemented (compatibility)**：内置指令核对后补充的兼容性实现，验收范围见第 11 节。
- **Native**：使用 GeoGebra 内置功能，不新增同义工具。
- **Planned (P3)**：已列出新增接口和候选算法；推导、表达式预算与实机验收仍须在实现阶段完成，不能视为已上线。
- **Implemented (P3)**：工具已进入版本 0.3.0，自动验证通过；实机验证仅限第 11 节记录的实际通过项目，不代表完整 P3 验收通过。
- **Defer**：记录定义问题或性价比问题，不进入当前实现队列。

下表记录当前实现算法及暂缓方案，公式不一定是可直接粘贴的 GeoGebra 命令。实际原生表达式以 `library.json` 及 `geometryBuilders.ts`、`triangleBuilders.ts`、`curveBuilders.ts` 为准，共用表达式原语见 `expressionGeometry.ts`。

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
| #89 / #444 Isogonal Center | 一个输入四直线，一个输入三角形加点，不能因名称相同合并。#444 的点版几何定义在 P3 以 QAP4 接纳；#89 的四线旧接口继续暂缓。 |
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
- `implicitCurve`：已补齐对象映射、构造器推断和返回元数据，识别原生 `implicitpoly` / `implicitcurve`。本文的 cubic 指此类型且多项式总次数为 3；次数条件由 GeoGebra 动态检验，不改变输入类型。
- 原生 `getObjectType` 会把退化 conic 报成 line 或 point；对这两类结果额外读取对象 XML 的几何类，将 `<element type="conic">` 仍视为 conic。不读取坐标数值，也不将圆外形的任意 conic 随意提升为 circle。
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
| Implemented (P2) | `FermatPoint(A,B,C) → point` | First isogonic center (X13). | 只返回X(13)，避免讨论。 | S005 |
| Implemented (P1) | `IsodynamicPoint(A,B,C,i) → point` | First or second isodynamic point. | i=1/2 分别采用 X(15)/X(16)，不提供 First/Second 两个函数名；引擎对正三角形的约定须实测。 | S380 S381 |
| Implemented (P1) | `FuhrmannCircle(A,B,C) → circle` | Circle with diameter joining the orthocenter and Nagel point. | 圆心 `(H+Na)/2`，半径 `|H−Na|/2`。 | S373 |
| Implemented (P1) | `BrocardCircle(A,B,C) → circle` | Circle with diameter joining the circumcenter and symmedian point. | 圆心 `(O+K)/2`，半径 `|O−K|/2`；两点重合时遵循原生零半径圆语义。 | S374 |
| Implemented (P2) | `FeuerbachPoint(A,B,C) → point` | Contact point of the incircle and nine-point circle. | 用 X(11) | S016 |

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
| Implemented (P2) | `SimsonLine(A,B,C,P) → line` | Simson line of a point P on the circumcircle. | P关于AB,AC垂足连线。当P不在外接圆上时，仍然默认使用这一行为保持连续性。 | S036 |
| Implemented (P2) | `SteinerLine(A,B,C,P) → line` | Line of the reflections of P in the three sidelines. | P关于AB,AC对称点连线。当P不在外接圆上时，仍然默认使用这一行为保持连续性。  | S037 |
| Implemented (P1) | `Orthopole(A,B,C,l) → point` | Orthopole of line l with respect to triangle ABC. | A、B、C 投影到 l 得 U,V,W；分别过 U,V,W 作垂直 BC、CA、AB 的线，求其中两条交点。非退化 ABC 的前两条目标线不平行；只要 l 有定义就不需要自由点。 | S035 |
| Implemented (P2) | `AntiSteinerPoint(A,B,C,l) → point` | Circumcircle point whose Steiner line is parallel to l. | 过 H 作 l 平行线（即只考虑 l 的方向）。对l关于AB,AC的对称直线求交点。 | S367 |
| Implemented (P2) | `Orthotransversal(A,B,C,P) → line` | Line through the sideline traces perpendicular to AP, BP and CP. | A 迹点是 BC 与过 P 垂直 AP 的线的交点，B、C 类推。用齐次表达式求三迹共线的线，避免仅连两个恰好重合的迹点；P=A 等零方向位置先判断是否有唯一化简延拓。 | S370 |
| Implemented (P2) | `Orthocorrespondent(A,B,C,P) → point` | Trilinear pole of the orthotransversal of P. | 与上一行共享齐次系数生成器，直接取其重心线坐标 u,v,w，返回重心 `(vw:wu:uv)`；不先创建普通 line。因此一般三角形 P=H、orthotransversal 为无穷远线时，仍可延拓为 G。直角时 H 为顶点等本质基点仍可能未定义。 | S419 |
| Implemented (P2) | `TaylorCircle(A,B,C) → circle` | Circle through the six projections of altitude feet onto the other sidelines. | 作一个高足，投影到另一条边。圆心直接用 X(389)。 | S376 |

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
| Implemented (P2) | `AntigonalConjugate(A,B,C,P) → point` | Antigonal image of P with respect to triangle ABC. | 等角共轭 → 关于外接圆反演 → 等角共轭。先在重心齐次层合成并约掉公共因子，使外接圆上的一般点可延拓到 H；H 等本质基点仍未定。不能只依赖可能非唯一的五点双曲线。 | S467 |
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
| Implemented (P2) | `CevianAffineMap(A,B,C,X,P) → point` | Image of P under the affine map sending ABC to the cevian triangle of X. | 先求 X 的三个 cevian 顶点 D,E,F；P 的归一化重心为 α,β,γ，返回 αD+βE+γF。某个目标顶点在无穷远时不是仿射映射；不要用复杂交点链绕过此前提。 | S406 |
| Implemented (P2) | `PedalAffineMap(A,B,C,X,P) → point` | Image of P under the affine map sending ABC to the pedal triangle of X. | 将上一行目标 D,E,F 换成 X 的三垂足；共线目标允许降秩仿射映射。纠正 Pedian 的含混命名及原参数说明。 | S416 |
| Implemented (P2) | `Isoconjugate(A,B,C,X,P) → point` | Isoconjugate of P under the diagonal reciprocal map fixing X. | 设 X 重心 `(u:v:w)`，P 为 `(p:q:r)`，取 `(u²qr:v²rp:w²pq)`。这是 barycentric fixed-point convention；与某些文献用 P 命名的 isoconjugate 不同，描述必须保留 “fixing X”。需用源宏一般位置核对，而不是直接沿用 X_fixed 名称。 | S414 |
| Implemented (P2) | `Isoconjugate(A,B,C,X,Y,P) → point` | Isoconjugate of P under the diagonal reciprocal map sending X to Y. | 重载。上一条是这一条的特例。 | S414 |
| Implemented (P2) | `Crosspoint(A,B,C,P,Q) → point` | Intersection of the tangents at P and Q to the circumconic through ABCPQ. | P、Q 重心分别为 p、q；输出第 i 个齐次分量 `p_i q_i(p_j q_k+p_k q_j)`（循环 i,j,k）。直接约去拟合圆锥曲线／切线交点的公共因子，P=Q 且各分量非零时连续延拓为 P；基点全零仍未定。 | S412 |
| Implemented (P2) | `Cevapoint(A,B,C,P,Q) → point` | Cevapoint of P and Q with respect to triangle ABC. | 作 Q 的反 cevian 三角形；按定义从 P 向其顶点连线取得 ABC 边上的迹，求所得三角形与 ABC 的透视中心。用齐次叉积和公共因子消除实现；最终核验三条透视线共点与 P/Q 对称性。 | S408 |
| Implemented (P2) | `CevaConjugate(A,B,C,X,P) → point` | X-Ceva conjugate of P with respect to triangle ABC. | 取 X 的 cevian 三角形和 P 的 anticevian 三角形的对应顶点连线之透视中心；在齐次层实现。明确 X 是参数、P 是被作用点，验证一般位置为对合。 | S409 |
| Implemented (P2) | `CrossConjugate(A,B,C,X,P) → point` | X-cross conjugate of P with respect to triangle ABC. | 取 P 的 cevian 三角形 T，再取 X 对 T 的 cevian 三角形 U；求 ABC 与 U 的透视中心。全部用齐次运算，不能被中间迹在无穷远打断；验证对合。 | S413 |
| Implemented (P2) | `CyclocevianConjugate(A,B,C,P) → point` | Cyclocevian conjugate of P with respect to triangle ABC. | 采用等截共轭 → 在 ABC 的 anticomplementary triangle 中等角共轭 → 回到 ABC 等截共轭的复合。齐次合成：x=(qr,rp,pq)，y_i=x_j+x_k；z_i=a_i² y_j y_k；w_i=z_j+z_k−z_i，最终权重 w_j w_k。没有中间仿射除法，`pq+qr+rp=0` 时仍可有有限像；对合与连续极限已作代数验证。 | S418 |

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
| Implemented (compatibility) | `RadicalAxis(c1,c2) → line` | Line of equal powers to two circles. | GeoGebra 的公开命令表没有 RadicalAxis，不能直接发给原生输入栏。设圆心 O1、O2、半径 r1、r2，作过 `(O1+O2)/2+(r1²−r2²)(O2−O1)/(2 Distance(O1,O2)²)` 且垂直 O1O2 的直线。相离、相交、相切均有效；同心时没有唯一有限根轴，undefined。四点输入先显式构造两个圆。 | S220 S365 S431 |
| Implemented (P1) | `RadicalCenter(c1,c2,c3) → point` | Radical center of three circles. | 通过 compose 展开两个自定义 RadicalAxis 后用原生 Intersect 求交；共轴时不唯一、根轴平行时在无穷远。 | S221 S366 |
| Implemented (P1) | `SimilarityCenter(c1,c2,s) → point` | External (s=1) or internal (s=-1) center of similitude of two circles. | O1,O2 半径 r1,r2，输出 `(r1 O2−s r2 O1)/(r1−s r2)`。s 仅允许 ±1；外位似等半径时一般在无穷远，内位似中心正常。不要通过任意圆上点确定相似。 | S361 S362 |
| Implemented (P2) | `CommonTangents(c1,c2,s[,i]) → line × 2 / line` | Common direct (s=1) or transverse (s=-1) tangents of two circles. | 以单位法向 n 写 `n·(O2−O1)=r1−s r2`，由中心差方向及其 90°方向构造两个 n，线为 `n·(X−O1)=r1`。平方根只用于真正的二分支；等半径外公切线仍有限。普通相切两槽可重合，不以无穷远位似中心为前提。需要全部公切线时直接用原生 Tangent。尽量考虑能否推广到二次曲线。 | S222 S223 S363 S364 |
| Implemented (P2) | `MixtilinearIncircle(A,B,C) → circle` | Circle tangent to rays AB and AC and internally tangent to the circumcircle. | 用短几何构造：I 为内心，e=AI；F=AB 与过 I 垂直 e 的线的交点，X=e 与过 F 垂直 AB 的线的交点；返回 Circle(X,F)。等价于角平分线单位向量 u、k=sin(A/2) 下 `X=A+t u`、`t=2((O−A)·u−Rk)/(1−k²)` 的非零根，无需实际展开该式。非退化 ABC 中两次交点均唯一。 | S022 |
| Implemented (P2) | `MixtilinearIncircles(A,B,C[,i]) → circle × 3 / circle` | A-, B- and C-mixtilinear incircles. | 对上式循环排列，不重复计算外心，不附送错序的圆心。 | S023 |
| Implemented (P2) | `MixtilinearContactPoint(A,B,C) → point` | Contact point of the A-mixtilinear incircle with the circumcircle. | 由两圆内切关系用圆心径向比例求 `(R X−ρ O)/(R−ρ)`；不求相切圆交点。重合圆时接触不唯一。 | S024 |
| Implemented (P2) | `MixtilinearExcircle(A,B,C) → circle` | Circle tangent to rays AB and AC and externally tangent to the circumcircle. | 复用上一短构造，将参考内心换成 A 旁心。等价于外切条件给出的 `t=2((O−A)·u+Rk)/(1−k²)`。这里明确是外切外接圆的 A 支，不混同旁切圆或外角平分线分支。 | S130 |
| Implemented (P2) | `MixtilinearExcircles(A,B,C[,i]) → circle × 3 / circle` | A-, B- and C-mixtilinear excircles. | 上一算法按 A、B、C 循环；与 incircle 是不同的相切语义，不依赖同一签名作隐式判别。 | S131 |
| Implemented (P2) | `HaggeCircle(A,B,C,P) → circle` | Hagge circle of P with respect to triangle ABC. | Hagge圆的圆心为P的等角共轭点关于九点圆心（X(5)）的对称点。且经过垂心。 | S375 |
| Implemented (P2) | `HaggeInverse(A,B,C,P) → point` | Inverse of P in its Hagge circle. | P对Hagge圆反演。 | S484 |
| Implemented (P2) | `ApolloniusCircle(A,B,C) → conic` | Generalized circle defined by PB/PC = AB/AC. | 以 `b²|X−B|²−c²|X−C|²=0` 生成二次系数。b=c 时保留为 BC 的垂直平分线的退化 conic，而非除以 b²−c²；能否稳定保持原生 conic 类型须验证。不叫含混的 Apollinius。 | S378 |
| Implemented (P2) | `ApolloniusCircles(A,B,C[,i]) → conic × 3 / conic` | Apollonius generalized circles associated with A, B and C. | 循环使用上一系数式，固定三个 conic 槽；不把等腰位置动态改成 line 返回类型。若原生不能保持类型，此家族暂缓，而非承诺不存在的圆。 | S379 |

原生 [Tangent](https://geogebra.github.io/docs/manual/en/commands/Tangent/) 已支持两圆的全部公切线。CommonTangents 仅作为“按内／外语义选两条”的补充，不能照搬取圆上自由点和过位似中心的方法。

### 6.2 三角形关联圆锥曲线

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| Implemented (P2) | `IsogonalConjugate(A,B,C,l) → conic` | Isogonal image of the supporting line l. | **重载现有点版**。l 的重心线系数为 u,v,w；像的重心方程是 `u a² YZ+v b² ZX+w c² XY=0`。直接换算二次系数，不取两个自由点。直线过顶点时保留完整代数退化像并说明可能有基点附加分量，不能声称它始终是非退化轨迹。 | S368 |
| Implemented (P2) | `IsotomicConjugate(A,B,C,l) → conic` | Isotomic image of the supporting line l. | 与上一重载平行，方程 `u YZ+v ZX+w XY=0`。这是从现有共轭家族自然补齐的新增项；退化语义同上。 | — |
| Implemented (P2) | `KiepertHyperbola(A,B,C) → conic` | Kiepert rectangular circumhyperbola of triangle ABC. | 调用直线版 IsogonalConjugate，取 Brocard axis（O、K 连线）的等角共轭像。纠正审阅稿的 ABCGK 五点拟合：K 一般不在 Kiepert 双曲线上。此法不因直角时 H 与顶点重合而丢失约束；O=K 且轴不唯一时未定义。 | S007 |
| Implemented (P2) | `JerabekHyperbola(A,B,C) → conic` | Jerabek rectangular circumhyperbola of triangle ABC. | 圆锥曲线ABCOK 。避免直接取ABC垂心导致直角三角形不良定。 | S466 |
| Implemented (P2) | `FeuerbachHyperbola(A,B,C) → conic` | Feuerbach rectangular circumhyperbola of triangle ABC. |经过ABCIX(7)的圆锥曲线。避免直接取ABC垂心导致直角三角形不良定。 | S012 |
| Implemented (P2) | `SteinerInellipse(A,B,C) → conic` | Ellipse tangent to the triangle sidelines at their midpoints. | 对标准等边三角形的内切圆作仿射映射，或用重心二次型 `X²+Y²+Z²−2XY−2YZ−2ZX=0` 换算系数；中心 G。非共线 ABC 时稳定。 | S401 |
| Implemented (P2) | `SteinerCircumellipse(A,B,C) → conic` | Circumellipse of ABC centered at the centroid. | 将 SteinerInellipse 关于 G 作倍率 −2 的位似；亦可用重心方程 `XY+YZ+ZX=0`。原名 Steiner Exellipse 改为标准 circumellipse。 | S402 |
| Implemented (P2) | `SteinerFoci(A,B,C[,i]) → point × 2 / point` | Foci of the Steiner inellipse. | 从上一二次型取原生 Focus。正三角形时两焦点重合 G，保留两个输出；不命名为 Laofeng Points。 | S372 |
| Implemented (P2) | `InconicWithFocus(A,B,C,P) → conic` | Real ellipse tangent to the three sidelines with P as a focus. | 仅在 P 为严格内点时承诺实内切椭圆：另一焦点 Q 是等角共轭；将 P 关于任一边反射，反射点到 Q 的距离为长轴长，得到中心和二次型。不凭固定一条边与 PQ 相交取椭圆上的点。外点可能对应其他实 conic，不自动称 ellipse。 | S371 |
| Implemented (P2) | `InconicWithCenter(A,B,C,P) → conic` | Conic tangent to the three sidelines with center P. | P 重心 p,q,r，令 u=p+q−r、v=p+r−q、w=q+r−p。对偶矩阵取零对角、非对角 u,v,w，其行和为 2p,2q,2r；取 adjugate 得原生六系数 `(-w²,-v²,-u²,2vw,2uw,2uv)` 后仿射变换到世界平面。中点三角形内部对应实内切椭圆；其他位置可能为双曲线或退化，不统一称 ellipse。 | S470 |
| Implemented (P2) | `IsogonalPairWithMidpoint(A,B,C,P[,i]) → point × 2 / point` | Isogonal pair with prescribed midpoint P. | 作以P为中心的圆锥曲线的焦点。 | S471 |

**后端注意**：TriangleCurve 的标准重心方程可用于推导和验证；[官方手册](https://geogebra.github.io/docs/manual/en/commands/TriangleCurve/)明确其结果是隐式多项式。所有承诺返回 conic 的命令仍应转换为六系数原生 Conic。

## 7. 完全四边形、完全四点形与对合

术语约定：四条一般位置直线形成 complete quadrilateral；四个一般位置点形成 complete quadrangle。原工具混用这两个名称。四直线默认没有循环顺序；若某项确实依赖顺序，必须写在描述中，不能称其为无序不变量。

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| Implemented (P1) | `DiagonalPoints(A,B,C,D[,i]) → point × 3 / point` | Diagonal points of the complete quadrangle ABCD. | 固定顺序 AB∩CD、AC∩BD、AD∩BC。齐次叉积，无穷远对角点无法作为普通 point 输出。比 CompleteQuadrilateral 更准确。 | S091 |
| Implemented (P2) | `MiquelPoint(A,B,C,D) → point` | Miquel point of the complete quadrilateral with ordered vertices ABCD. | 局部复数公式 `A+(B−A)(D−A)/(B+D−C−A)`，为 AB 到 DC 的顺相似中心；显式 ToComplex / ToPoint。对应四边支撑线 AB、BC、CD、DA；平行四边形时分母零，无有限唯一点。 | S083 |
| Implemented (P2) | `MiquelPoint(l1,l2,l3,l4) → point` | Miquel point of four supporting lines. | 支撑线交点依次 A=l4∩l1、B=l1∩l2、C=l2∩l3、D=l3∩l4，调用四点版；相邻平行且交点在无穷远时不承诺普通 point。 | S083 |
| Implemented (P1) | `NewtonLine(A,B,C,D) → line` | Newton line of the quadrilateral with ordered vertices ABCD. | 四点为循环顶点，输出 AC 与 BD 中点的连线；对应四线 AB、BC、CD、DA 版本。 | S084 |
| Implemented (P1) | `NewtonLine(l1,l2,l3,l4) → line` | Line through the midpoints of the three diagonals of a complete quadrilateral. | 取两组互补直线交点作为对角端点，算三个对角中点；只固定取其中两个。不讨论中点是否重合。 | S084 |
| Implemented (P2) | `SteinerLineQ(A,B,C,D) → line` | Line containing the orthocenters of the four component triangles. | 不与三角形版本重载。直接发出 `(Bx+Dx−Ax−Cx)x+(By+Dy−Ay−Cy)y+A·C−B·D=0`，等价于 AC、BD 直径圆的幂差为零；不构造圆、不调用 RadicalAxis。 | S085 |
| Implemented (P2) | `SteinerLineQ(l1,l2,l3,l4) → line` | Line containing the orthocenters of the four component triangles. | 重载。同上。 | S085 |
| Defer | `SteinerCircle(l1,l2,l3,l4) → circle` | Circle through the circumcenters of the four component triangles. | 按审阅意见暂不实现，等待更好的算法。 | S086 |
| Implemented (P2) | `TangentParabola(A,B,C,D) → conic` | Parabola tangent to the ordered sidelines AB, BC, CD and DA. | 使用 MiquelPoint 为焦点、SteinerLineQ 为准线的原生 Parabola 构造。 | S099 |
| Implemented (P2) | `TangentParabola(l1,l2,l3,l4) → conic` | Parabola tangent to four lines in general position. | 优先使用 MiquelPoint 为焦点、  SteinerLineQ 为准线的直接构造。   | S099 |
| Implemented (P2) | `NinePointConic(A,B,C,D) → conic` | Conic through the six pairwise midpoints of four points. | 以 N=(A+B+C+D)/4 为中心，三个相反中点对可写为 ±U、±V、±W；对 `R(U)=(Ux²,Uy²,UxUy)` 取 `(R(V)−R(U))×(R(W)−R(U))` 得二次项系数，常数取负内积。原生 Conic 后平移 N，无轨迹、无任选五个中点。平行四边形时仍得到两条相交直线的退化 conic。 | S464 |
| Defer | `InvolutionFixedPoints(l,A,A1,B,B1[,i]) → point × 2 / point` | Fixed points of a projective involution. | 函数 API 还需细究，按审阅意见暂不实现。 | S078 |

## 8. 代数曲线、极曲线与剩余交点

### 8.1 类型和命名决策

P2 已补齐 `implicitCurve` 类型和原生多项式系数获取。**禁止为了读取曲线而在曲线上创建九个自由点**。固定类型并不意味着所有 implicitCurve 都是三次；次数条件在 GeoGebra 内动态检查，不满足时结果 undefined，移动后可恢复。

具体读取 `LeftSide(F)−RightSide(F)` 的原生二元函数 f，以 `f(x,x^4)+0*x` 编码三次单项式，再对一元函数用 Coefficients 提取并补零，取得十个次数≤3系数。用原生 AreEqual 检查重建二元多项式与完整原函数一致，并要求三次部分非零；比较和容差均属于 GeoGebra。不能直接使用 Coefficients(F)：当前原生命令不接受 implicitCurve。此前零点处偏导方案已由第 11 节的兼容性修复替换；没有曲线上取样或 JavaScript 数值快照。P3 若支持四次输入，必须扩展编码和全多项式核对，不能越过现有三次守卫。

不保留 `CubicThirdIntersection2`、`CubicPolarLine2` 等后缀名字。九个点先构造成一个有标签的曲线，再传给操作；这种分步使用便于复用，避免每次重复展开九个大型行列式。若将来确有需要，可在相同名字下增加“九点＋作用点”的按个数重载，但本计划不优先实现这种长签名。

二次／三次的 **polar line** 合并为 `Polar(P,curve)` 的强类型重载；三次的第一极曲线是 conic，另称 `PolarConic`，不可用同一个不带阶数的 implicitCurve 签名猜测返回 line 或 conic。原生 `Polar(P,q)` 和 `Polar(l,q)` 继续可用，不改变其语义。GeoGebra 的 [Polar 手册](https://geogebra.github.io/docs/manual/en/commands/Polar/) 已同时覆盖二次曲线的极线和极点。缺秩时可视为 undefined。

| 阶段 | English name / signature → output | English description | 大致算法与边界 | Source |
|---|---|---|---|---|
| Implemented (P2) | `Cubic(P1,...,P9) → implicitCurve` | Unique cubic through nine points, when the constraints are independent. | 增加**九点重载**，保留原生 `(A,B,C,index)`。先按九点均值平移、均方根距离缩放，再在 GeoGebra 内对含常数项的 9×10 单项式矩阵做 MatrixRank==9 检查；通过后调用原生 ImplicitCurve 并逆变换。缺秩返回 undefined，避免原生插值器悄悄降阶选曲线。 | S424 S441 |
| Native | `ImplicitCurve({P1,...,P14}) → implicitCurve` | Implicit curve through fourteen points. | 原生已提供四次插值；不再新增 Quartic 的十四点同义包装。秩不足时不把“画出来某条曲线”当唯一解。 | S430 S442 |
| Native | `PolarLine(P,q:conic) → line` | Use native Polar(P,q). | 按审阅意见不实现别名；二次／三次均使用 Polar。 | S105 |
| Implemented (P2) | `Polar(P,F:implicitCurve) → line` | Second polar of P with respect to a cubic. | 重载。 将 F 齐次化为次数 3 的 Fh(X,Y,Z)，P=(p,q,1)，令 DP=p∂X+q∂Y+∂Z；输出 `DP² Fh=0` 的线。也可用 ∇Fh(P) 作线系数。P 不必在曲线上；P 在曲线上且光滑时它才是切线。奇点梯度为零时不捏造切线。 | S474 S478 |
| Implemented (P2) | `PolarConic(P,F:implicitCurve) → conic` | First polar conic of P with respect to a cubic. | 输出 `DP Fh=0` 的六系数二次型；不能只对非齐次 F 求 x、y 导数而漏掉 Z 方向的低次项。允许退化 conic，零多项式未定。 | S473 S479 |
| Implemented (P2) | `SecondIntersection(q,P,l:lineLike) → point` | Other intersection of a conic and a line containing the known point P. | 在现有 `(q,P,Q:point)` 之外增加**直线重载**。以 l 的法向取稳定方向，再用弦中点／韦达算法；核验 P 在 l∩q。不改变现有三点接口。 | S104 |
| Implemented (P2) | `ThirdIntersection(F,P,Q) → point` | Residual intersection of cubic F with line PQ, given P and Q on F. | 令 X=P+t(Q−P)，限制 F 得 `At³+Bt²+Ct+D`，已知根 t=0、1，剩余根为 `−B/A−1`；从最高次齐次项算 A，直接恢复第三点。避免斜率、求三根再删最近两根。A=0 时剩余点在无穷远；直线为分量时非唯一。 | S472 S476 |
| Implemented (P2) | `ThirdIntersection(F,P) → point` | Residual intersection of a cubic with its tangent at a smooth point P. | 重载。用齐次梯度得到切线方向 v，限制 F(P+t v)，已知二重根 t=0，剩余根为 `−B/A`。普通拐点返回 P（三重交），P 奇异时不指定切向。三参数版不能直接代入 Q=P，应调用此二参数版。 | S472 S475 S476 S477 |
| Defer | `TangentialPoint(F,P) → point` | Use the two-argument ThirdIntersection overload. | 按审阅意见不实现别名，源工具已由上一重载承接。 | S475 S477 |
| Implemented (P2) | `PivotalIsogonalCubic(A,B,C,P) → implicitCurve` | Locus where a point, its isogonal conjugate and pivot P are collinear. | 在重心变量 X,Y,Z 中用行列式 `det[(X,Y,Z),(a²YZ,b²ZX,c²XY),(p,q,r)]`；整体次数 3，生成隐式多项式。无轨迹点、无分支扫掠。原生 TriangleCurve 可承载此方程。 | S389 |

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
| Native | Triangle Center X_57; Bevan Point; Schiffler Point | 直接 TriangleCenter 的 X(57)、X(40)、X(21)。这些非高频别名暂不增加库体积。 | S100 S101 S107 |

## 10. 暂缓定义与专题工具

### 10.1 P1/P2 时的暂缓记录

这些工具不在 P1/P2 实现清单中。下表保留当时的暂缓理由，作为审计历史；**其中提升至 P3 的项目，以第 10.2 节的新接口、算法和边界为准**。未被 P3 明确接纳的旧别名、四线接口、anti／double 变体继续暂缓，不能因一个相关工具入选而全部恢复。未核定的定义明确标为未核定。

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


### 10.2 P3 接口与算法计划（2026-10-16）

本节承接人工草案的全部新增工具，现为 **Implemented (P3)**；表中保留设计理由与原候选方案，实际采用的简化及验收范围见第 11 节。公式用于解释算法，最终表达式以版本 0.3.0 的工具库及 builder 为准。优先采用短几何复合；只有中间对象的无穷远／重合会破坏最终有限极限时，才改用约分后的齐次公式。所有退化判断留在 GeoGebra 内动态计算，不在 JavaScript 读取坐标、挑选分支或缓存数值。

#### 10.2.1 接入规则和参考结构

- 新工具最终进入 `library.json`，英文名称、英文 description、参数类型、返回类型、可选编号须一起定义。三选一：原生短式用 `expression`；调用网站工具用 `compose`；符号消元／系数生成用 `builder`。`expression` 内写 `QAP2(...)` 等网站名字不会递归展开。Builder 只收表达式、类型和卫生变量分配器，不接收引擎。
- 模板 `locals` 是文本展开；真正共用 O、H、重心坐标、M、κ、外心等量，使用现有 `bind` 的原生匿名单元素 Zip。顶层只产生承诺的独立输出，不产生命名辅助点、列表、宏或脚本。参数名避免与 `TriangleCurve` 自带的 A/B/C 多项式变量混淆。
- QA 的 `A,B,C,D` 表示四点组；目标对象应核验 24 种排列的不变性。QL 的 `A,B,C,D` 表示四条支撑线 `AB,BC,CD,DA` 的循环交点，允许交叉四边形，不要求凸性或顺／逆时针。循环移位及反序对应同一组线；其他排列通常改变四线结构，不能承诺同一结果。本批暂不新增四线重载，也不恢复含混的 PonceletPoint、SteinerCircle 等旧名字。
- QL 中统一记 `E=AB∩CD`、`F=BC∩DA`，三对对顶点为 `(A,C),(B,D),(E,F)`。`AC∩BD` 是另一对象，**不能替代 F**；这修正人工草案 QLQu3 的配对。四个分量三角形固定为 `ABF,BCE,CDF,DAE`，不是任取四点中的三个。一般位置要求四条线互异、无三线共点、相关交点有限；平行的可去极点能约则约，不能用换一组三角形的动态选路掩盖缺失定义。
- 下文 `P*` 专指 ABC 中的等角共轭，使用有向面积重心 `(a²qr:b²rp:c²pq)`。外点不取绝对值；直线求交不使用斜率；有向角由向量／复数给出，不用 `Angle` 的无向值选择内外角平分线。线段／射线参数仍取无限支撑线，取点只用有限内部路径参数 1/4、1/2。
- `QL2P1/QL2P2/QL2P3(A,B,C,D[,i])` 固定两点槽，末尾 `i=1,2`；无实点时 undefined，相切时允许两槽重合。复数只作内部代数，不把虚点包装成实 point。两个槽不承诺绕过分支碰撞、根号割线或闭合参数回路后仍保留全局身份；不按坐标排序、去重或压缩列表。
- `CoTf3(P,q)` 与 `InvCoTf3(P,q)` 按草案采用被作用点在前、conic 在后；这是新接口，不兼容地继承源宏 `conic,P` 顺序没有必要。`QLP5` 改正为 `point`，因为它是圆心。目录编号先作正式命令名，别名留待以后。

#### 10.2.2 三角形工具

这里 `S_A=(b²+c²−a²)/2`，其余循环；`X,Y,Z` 表示重心变量，不是世界坐标。

| English name / signature → output | English description | 候选算法、连续性与复杂度 |
|---|---|---|
| `BrocardAxis(A,B,C) → line` | Line joining the circumcenter and symmedian point. | 短 `compose`：连接 O 与 K=X(6)。普通等腰位置仍有效；正三角形 O=K，方向随趋近方式变化，不补造轴。只需两个中心和一条线。 |
| `LemoineAxis(A,B,C) → line` | Polar of the symmedian point in the circumcircle. | 原生 `Polar(K,Circle(A,B,C))`，或重心线系数 `(b²c²,c²a²,a²b²)`。优先短构造；K=O 时极线在无穷远，没有普通 line 输出。不要以一组可能平行的切线交点构造。 |
| `OrthicAxis(A,B,C) → line` | Trilinear polar of the orthocenter, with its right-triangle limit. | 直接发重心直线 `S_A X+S_B Y+S_C Z=0`，转换为世界线系数。H 的重心为 `(S_B S_C:S_C S_A:S_A S_B)`，先约掉三线极线中的公共因子 `S_A S_B S_C`，因此直角时仍有明确极限；不能直接 compose `TrilinearPolar(...,H)` 而留下 0/0。等边时为无穷远线。 |
| `SoddyPoint(A,B,C,i) → point` | Outer (i=1, X175) or inner (i=2, X176) Soddy point. | 在引擎中以整数 i 选择 `TriangleCenter(...,175)`／`TriangleCenter(...,176)`；不解三个相切圆或按半径排序。[ETC](https://faculty.evansville.edu/ck6/encyclopedia/) 确认 X175 为外、X176 为内，仍须核验所用引擎支持。外 Soddy 圆退化为直线时中心可去无穷远，不强求有限；正三角形等特殊位置检查中心约定。 |
| `LiangZelichPerspector(A,B,C,P) → point` | Pole of OP in the conic through P and the in/excenters. | 以草案的极点构造为公开定义。P 的有向三线坐标为 `(u:v:w)=(p/a:q/b:r/c)`，过 I 和三个旁心的 conic 可写 `d1 α²+d2 β²+d3 γ²=0`，其中 `d=(v²−w²,w²−u²,u²−v²)`。转为重心对角矩阵 `diag(d1/a²,d2/b²,d3/c²)`，求 OP 的齐次极点 `adj(Q)·l`，约公共因子后才有限化。避免构造四旁心和五点拟合。P=I 或任一旁心时 d 全零，P=O 时 OP 未给方向；退化 conic、极点在无穷远也需单独识别，不能声称“除了 I、O 一概良定”。透视解释及位似倍率仍须独立核验，不能把另一篇 Liang–Zelich 定理里的 Carnot 透视中心直接等同此点。 |
| `StammlerHyperbola(A,B,C) → conic` | Stammler rectangular hyperbola through the in/excenters and circumcenter. | 用重心二次型 `(b²−c²)X²/a²+(c²−a²)Y²/b²+(a²−b²)Z²/c²=0`，原生六系数 Conic 后仿射变换。不依赖切线三角形或 O 是否与某辅助点重合。非等边等腰时连续成为两直线；等边时所有系数为零，族不唯一。它也可由过 I、三个旁心、O 定义，但不以五点拟合作稳定后端。 |
| `OrthopolarConic(A,B,C,P) → conic` | Conic traced by orthopoles of lines through P. | 用下述二倍角参数消元；中心 N=(H+P)/2，并核验经过 P 的三个垂足。不使用 AP/BP/CP 作为三条采样线，否则 P 在顶点、边上时会丢失方向或产生重复点。主要开销是一个固定 2×2 线性解和二次系数。 |
| `CundyParryPhi(A,B,C,P) → point` | Cundy–Parry Phi image: OP intersected with H(P*). | 将 P* 保持为齐次重心 q，直接 `(O×p)×(H×q)`；不先输出可能在无穷远的 P*。对整个多项式三元组约公共因子，特别核查 P 在外接圆、Euler line 及 P=O/H 的极限。只有最终三元组全零或在无穷远才 undefined，不能见到中间共轭无穷远就退出。 |
| `CundyParryPsi(A,B,C,P) → point` | Cundy–Parry Psi image: O(P*) intersected with HP. | 同一 builder 的另一组 join/meet：`(O×q)×(H×p)`。一般位置应满足 `Psi(P)=Phi(P*)`，并检查各自的对合关系。不要与 orthopivotal 文献中同样记作 Ψ 的另一变换混用；无法约去的重合连线不任取交点。 |

**OrthopolarConic 的消参草图。** 取由 AB 决定的正交局部坐标，不按世界水平／竖直方向选稳定分支。对单位法向 `n=(cos θ,sin θ)`，过 P 的线中 A 的投影为 `A+n nᵀ(P−A)`，其 orthopole T 满足

```text
(C−B)·T = (C−B)·[A+n nᵀ(P−A)]
(A−C)·T = (A−C)·[B+n nᵀ(P−B)] .
```

两行法向对非共线 ABC 独立。利用 `n nᵀ=I/2+[[cos 2θ,sin 2θ],[sin 2θ,−cos 2θ]]/2`，一次求出 `T=N+U cos 2θ+V sin 2θ`；这是恒等式推导，无自由点／数值采样。令 `J=[U V]`，候选方程为 `‖adj(J)(X−N)‖²−det(J)²=0`，直接输出 conic 系数。rank 2 时为椭圆，rank 1 的代数极限是双直线，不能把实际参数像的一段线段宣称为整个轨迹；rank 0 时该式全零，需从解析系数确认是否存在唯一点圆极限再承诺支持。等边、直角及 P 为顶点必须核验，不能靠选五个点规避此事。

两种 Cundy–Parry 定义已对照 [ETC extended glossary](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html)；CL037 直连本轮返回 502，不把它当作已阅读全文。Stammler 的五点定义另见 [Steve Phelps 的构造说明](https://www.geogebra.org/m/rSgkR6MP)；上表对角二次型由四个 in/excenter 的三线坐标平方相同独立推导。

#### 10.2.3 Co-Tf3 与逆变换：不选主轴的统一公式

[EPG Co-Tf3](https://www.chrisvantienhoven.nl/co-tf3) 将其定义为 Scimemi transformation，并明确给出圆、直角双曲线及抛物线的极限。源宏的主轴／交点构造在轴上会变成重合线，不能直接复制。以下系数公式由其轴向定义独立推导；它还自然消除了 Center 和主轴选择。

按 [原生 Coefficients(q) 的顺序](https://geogebra.github.io/docs/manual/en/commands/Coefficients/)，写

```text
q(X) = Xᵀ S X + 2 dᵀ X + f,
S = [[a,dxy/2],[dxy/2,b]],  d=(ex/2,fy/2),
Coefficients(q) = {a,b,f,dxy,ex,fy}.
t=tr(S), R=t I−2S, Δ=(a−b)²+dxy²;  R²=Δ I.

CoTf3(P,q)    = (R P−2d)/t
InvCoTf3(P,q) = R(t P+2d)/Δ .
```

| English name / signature → output | English description | 连续性与实现 |
|---|---|---|
| `CoTf3(P,q:conic) → point` | Scimemi image of P with respect to q. | 一个六系数读取及 2×2 仿射式；不依赖 f、半轴长度或特征向量。圆时 R=0，返回圆心；抛物线无需特殊分支，例如 `y=x²` 给 `(-Px,Py+1)`。t=0 的直角双曲线一般无有限像；中心等 0/0 位置不编造连续值。 |
| `InvCoTf3(P,q:conic) → point` | Inverse Scimemi image of P, including finite limits. | 同一系数块共用 R、t、Δ。直角双曲线 Δ≠0 时直接得到中心；圆时 Δ=0，无单值逆。抛物线例为 `(-Px,Py−1)`。一般位置验证两次复合为恒等，圆／直角双曲线处仅称极限映射，不称可逆。 |

公式对整体非零系数倍乘不变，也不要求固定系数正号。对点圆、双线和相交线对，先验证该系数延拓与目录的退化约定是否一致；不假定任意奇异 conic 都有标准的 Scimemi 逆。整个二次部分为零时没有二次曲线前提，应 undefined；类型判断和 t、Δ 的零检验均在原生表达式内，禁止固定 epsilon 或按主轴长度选式。

#### 10.2.4 QA 四点工具

统一 `G4=(A+B+C+D)/4`；齐次对角点 `U=AD∩BC,V=BD∩CA,W=CD∩AB`，即 D 的 cevian 三角形，顺序只用于公式。不要把 QAP2 与 QL-P2 混为一谈。

| English name / signature → output | English description | 候选算法、连续性与复杂度 |
|---|---|---|
| `QAP2(A,B,C,D) → point` | Euler–Poncelet point of the four-point set. | 直接求过四点的直角双曲线：在平移、尺度归一化坐标中取四行 `(x²−y²,2xy,x,y,1)` 的 4×5 矩阵，用五个 4×4 余子式得核向量 `(u,v,l,m,k)`。曲线为 `u(x²−y²)+2vxy+lx+my+k=0`；中心由 `2[[u,v],[v,−u]]N=−(l,m)` 得到。无须额外取 H(ABC)，因此直角三角形不会因 H 与顶点重合而丢约束。rank<4（含垂心四点组的非唯一曲线族）或没有有限唯一中心时 undefined。不作 SVD 数值快照；若预算过大，改推导同一约束的短重心式。 |
| `QAP3(A,B,C,D) → point` | Gergonne–Steiner point of the four-point set. | 短 `compose`：`2G4−QAP2(...)`。依赖方向单一，无需重建最小离心率圆锥曲线；QAP2 本质未定时此式不补造值。 |
| `QAP4(A,B,C,D) → point` | Isogonal center of the four-point set. | D 对 ABC 的等角共轭保持齐次世界坐标 q。以 O 为原点写 q=(qx:qy:qw)，直接做外接圆反演的齐次合成 `(R² qw qx:R² qw qy:qx²+qy²)`，最后才有限化并平移回 O。D 在外接圆上一般使 qw=0、(qx,qy)≠0，因此结果**连续返回 O**，不经过 undefined 的仿射共轭。q=O 时反演无有限像；共轭基点全零须看约分后是否仍未定。核验换掉被排除顶点后结果不变。 |
| `QAP5(A,B,C,D) → point` | Isotomic center of the four-point set. | 草案的反补再反射化简为 `4G4−U−V−W`。三个对角点有限时只有求交和线性组合。也可直接用 D 的重心 `(p:q:r)` 给输出权重 `qr(q+r)(2p+q+r)` 及循环项；该多项式不先除 `q+r` 等量，优先用来处理对角点去无穷远的可约情形。最终权重和零、三元组全零区分无穷远与未定，不能把平行四边形中心随意当成结果。 |

QAP2 的余子式法只作为固定尺寸精确代数方案：绑定归一化四点及低阶单项式，避免同一余子式在中心分子／分母反复展开。QAP4 需要内部的齐次共轭原语，不能仅 `compose Reflect(IsogonalConjugate(...),Circle(...))`。本组定义与 [QA-P2](https://www.chrisvantienhoven.nl/qa-p2)、[QA-P3](https://www.chrisvantienhoven.nl/qa-p3)、[QA-P4](https://www.chrisvantienhoven.nl/qa-p4)、[QA-P5](https://www.chrisvantienhoven.nl/qa-p5) 对照；QA-P5 多项式作为几何公式的独立验证路径。

#### 10.2.5 QL 共用内核：复数对合及广义圆

取 M=`MiquelPoint(A,B,C,D)`。以 M 为复原点，记 `κ=(A−M)(C−M)=u+iv`，同时核验等于 `(B−M)(D−M)`。则草案的反演加角平分线反射化简为

```text
T(z)=M+κ/(z−M).
```

这里两个复数都须显式 ToComplex；没有根号、绝对值或角平分线内／外分支。反演与反射的两次反向作用合成上述直接 Möbius 对合，不能误写成 `κ/conjugate(z−M)`。此式固定 A↔C、B↔D 的有向约定。κ=0 或 M 无有限唯一值是参考结构退化，不换另一顺序重算。

在相同实坐标中记 `w=X−M`，`ρ=w·w`，`K=[[u,v],[v,−u]]`，则 `T(X)−M=Kw/ρ`，`K²=|κ|²I`。原广义圆 `aρ+b·w+c=0` 的像为

```text
cρ+(K b)·w+a|κ|²=0 .
```

这是对整个对象的代数像，不能反演线段的两个端点后仍返回线段，也不能把普通 conic 的反演像称作 conic。

| English name / signature → output | English description | 候选算法及类型契约 |
|---|---|---|
| `QLTf1(A,B,C,D,P:point) → point` | Clawson–Schmidt conjugate of P. | 上述复数短式／等价实有理式。P=M 没有普通有限像；两次复合应回到 P。不调用 `Reflect` 对未知类型猜测输出。 |
| `QLTf1(A,B,C,D,l:lineLike) → conic` | Generalized-circle image of the supporting line. | 将 l 写成相对 M 的 `b·w+c=0`，代入广义圆式；返回原生六系数 Conic。过 M 的直线仍为直线型退化 conic，避免拖动时 circle/line 返回类型改变。 |
| `QLTf1(A,B,C,D,c:circle) → conic` | Generalized-circle image of the circle. | 同一系数核；圆过 M 时退化为直线，保留 conic 元数据。必须比 `conic` 参数重载更具体。不能用三个像点定圆，否则其中点恰到 M 会失效。 |
| `QLTf1(A,B,C,D,q:conic) → implicitCurve` | Algebraic image of a conic under the conjugation. | 用齐次二次代换 `(wx:wy:1)→((Kw)x:(Kw)y:ρ)`，得到至多四次方程；原 conic 的六系数直接读取。圆型输入走上一个强类型重载，不能让同一签名随位置改类型。对圆形状但元数据为一般 conic 的输入，在系数层消掉可证明的公共 ρ，仍输出 implicitCurve。 |
| `QLTf1(A,B,C,D,F:implicitCurve) → implicitCurve` | Algebraic image of a polynomial curve of degree at most four. | 将 “anything” 收敛为可验证的多项式重载：在原生中提取并核对至多四次的 15 项，齐次代换后至多八次。扩展现有三次系数提取器的符号编码，不能把它直接当通用接口；以基数 5 编码并比较重建的完整二元多项式，拒绝非多项式及更高次。公共 ρ 只在代数上证实整除时消去，真实分量与重数保留。需先满足表达式预算和实机性能再发布此重载，不能以 `unknown` 兜底。 |

点、支撑线、圆、conic、至多四次隐式多项式覆盖本批有用的 “anything”；number、text、list、polygon、任意 function 不接受。不新增宽泛动态返回类型。所有代数曲线像采用闭包语义，可能包含在变换极点出现的极限点；不声称每个闭包点都有有限原像。定义对照 [EPG QL-Tf1](https://www.chrisvantienhoven.nl/epg/n-geometry/quadri-figures/ql-items/ql-tf1/)。

#### 10.2.6 QL 点对、圆及圆心

记四个分量三角形的外心依次为 `O1=O(ABF),O2=O(BCE),O3=O(CDF),O4=O(DAE)`，`ΣO=O1+O2+O3+O4`。它们与 M 共圆，见 [QL-Ci3](https://www.chrisvantienhoven.nl/epg/n-geometry/quadri-figures/ql-items/ql-ci3/)。一般位置中，任意两个分量圆共用一个顶点；若外心也相同则两圆重合，从而一个圆含三个互异共线交点，矛盾。因此外心两两不同，任取三个可唯一作圆；证明依赖“一般位置”，不能延伸到三线共点或平行配置。

| English name / signature → output | English description | 候选算法、连续性与复杂度 |
|---|---|---|
| `QL2P1(A,B,C,D[,i]) → point × 2 / point` | Plücker points of the complete quadrilateral. | 作 AC、BD 直径圆，取它们根轴（亦为 SteinerLineQ）与第一个圆的两交点。可用“圆心投影到根轴 ± 有向单位切向量×弦半长”显式二根；弦半长负平方值时两槽 undefined，零时重合。不使用循环边的无向长度来判断交点顺序。 |
| `QL2P2(A,B,C,D[,i]) → point × 2 / point` | Conjugate pair on the Newton line. | Newton line 相对 M 写成 `n·w+c=0`，其 T 像的方程是 `cρ+(K n)·w=0`。固定线参数 `w=w0+t d` 后解一个实二次方程，或原生线/conic 求交；不拟合三点圆。若像为直线，仍保留两输出槽；重合导致无限解时不任取两点，有限实根／无穷远根按原生行为核验。 |
| `QL2P3(A,B,C,D[,i]) → point × 2 / point` | Fixed points of the Clawson–Schmidt conjugation. | 解 `(z−M)²=κ`，输出 `M±ToPoint(sqrt(κ))`；平方根运算必须在复数域。κ≠0 时总有两个实平面点，负实 κ 也不代表“虚点”；切勿用实数 sqrt 误删它们。点对无序，分支割线处不承诺逐槽全局连续。 |
| `QLCi3(A,B,C,D) → circle` | Miquel circle through the four component circumcenters. | 短几何构造：`Circle(O1,O2,O3)`；O4 及 M 仅作为验收冗余条件。不新增旧名 SteinerCircle，也不取 ABC、BCD、CDA 三个外心冒充分量外心。 |
| `QLP4(A,B,C,D) → point` | Center of the Miquel circle. | `Center(QLCi3(...))`；先允许 compose。如展开重复，内部绑定 O1,O2,O3 后调用原生外心即可，不绕回 QLP4 引起循环依赖。 |
| `QLP5(A,B,C,D) → point` | Clawson center, the center of the Plücker circle. | 由 [QL-P5](https://www.chrisvantienhoven.nl/epg/n-geometry/quadri-figures/ql-items/ql-p5/) 的共用 `(Oi+Hi)/2` 定义化简为 `ΣO/2−QLP4`。不从两个可能无实解／重合的 Plücker 点拟合圆心。返回类型纠正为 point。 |
| `QLP3(A,B,C,D) → point` | Kantor–Hervey point of the complete quadrilateral. | `2QLP5−QLP4`，短 compose；无需作四个外心三角形的垂心圆。 |
| `QLP6(A,B,C,D) → point` | Midpoint of the Miquel and Clawson centers. | `(QLP4+QLP5)/2=ΣO/4`，优先直接取四外心平均，省去两次圆心依赖；此化简也便于检查反射关系。 |
| `QLP7(A,B,C,D) → point` | Newton–Steiner point. | `Intersect(NewtonLine(...),SteinerLineQ(...))`；两条线用已实现的简式。平行而不重合则无有限结果，重合则不唯一；不靠非常接近的点估计交点。 |
| `QLP19(A,B,C,D) → point` | Midpoint of the Miquel and Newton–Steiner points. | `(M+QLP7)/2`。若最终齐次式能约去依赖的公共因子，可在 builder 中合成；本质无穷远不取截断坐标。 |
| `QLP20(A,B,C,D) → point` | Intersection of the Newton line and the tangent at M to its conjugate circle. | Newton line 为 `n·w+c=0`；其像在 M 的切线为 `(K n)·w=0`，直接求这两线交点。不必先创建 QLTf1 的 conic，也不在圆的重根处调用 Intersect。c=0 时像成为直线，该切线式仍是自然延拓；两线重合仍未定。见 [QL-P20](https://www.chrisvantienhoven.nl/ql-p20) 供独立性质核验。 |
| `QLP21(A,B,C,D) → point` | Reflection of the Miquel point in QL-P20. | `2QLP20−M`。无需重复极线、圆或三次曲线操作。 |
| `QLCi5(A,B,C,D) → circle` | Plücker circle centered at the Clawson center through M. | `Circle(QLP5,M)`；不用 `Circle(M,Plucker1,Plucker2)`，所以 Plücker 点无实解时仍能得到实圆。检查在点对有实时二点都在此圆上；零半径按原生圆语义。 |
| `QLCi6(A,B,C,D) → circle` | Dimidium circle centered at QL-P6 through M. | `Circle(QLP6,M)`。圆心直接用 ΣO/4，避免源宏中的嵌套密克点构造；不伪装成一般 conic 返回。 |

QLCi3 与 QLP4 的依赖选一条单向路线；其余先建外心块，再派生 P5/P3/P6 和两个圆。多次引用不会因写进 `locals` 自动缓存。对 E/F 去无穷远但目标仍可能有极限的配置，应先化简整体式；不能承诺简单外心链已经覆盖所有平行特例。点对定义另见 [QL-2P1](https://www.chrisvantienhoven.nl/ql-2p1)、[QL-2P2](https://www.chrisvantienhoven.nl/epg/n-geometry/quadri-figures/ql-items/ql-2p2/)、[QL-2P3](https://www.chrisvantienhoven.nl/epg/n-geometry/quadri-figures/ql-items/ql-2p3/)。

#### 10.2.7 隐式曲线：直接方程，不采样拟合

以下始终返回 `implicitCurve`，容许其代数族出现结点、分解或降次，不因显示形状变化切换类型；零多项式表示未唯一指定曲线，不能显示为整个平面。曲线的完整代数闭包与原始作图中因三点共线而缺失的点分别说明。三次操作 `Polar/PolarConic/ThirdIntersection` 的“输入须为三次”条件仍保留；尤其不能对 QLQu3 或一般 QLTf1 四／八次像调用三次剩余根公式。

| English name / signature → output | English description | 候选算法、连续性与复杂度 |
|---|---|---|
| `QLCu1(A,B,C,D) → implicitCurve` | Quasi-isogonal cubic of the ordered quadrilateral. | 在 M 局部坐标中，Newton line 为 `n·w+c=0`，直接输出 `F(w)=(n·w+2c)ρ+n·K w=0`。由 `(X+T(X))/2` 在线上清一次分母得到，通常只有十个以内单项式；不调用 Locus 或九点 Cubic。四边有内切圆时照算同一式，允许出现结点／斜环索线，不加“非奇异三次”守卫。用内心是结点及其梯度为零核验该连续族。 |
| `QLCu1(A,B,l:lineLike) → implicitCurve` | Circular cubic whose conjugate-pair midpoints lie on l. | A 为反演中心，`r²=Distance(A,B)²`，反射轴 AB。令 `e=B−A`、`w=X−A`，无需单位化即可取 `K=2e eᵀ−r²I`；l 在 A 局部为 `n·w+c=0`，复用上一 F。B≠A；不能令 A=B 后还从遗失的轴猜一个方向。描述写明这是广义的同类圆环三次族，不保证任意 A/B/l 都来自某个实非退化四线配置。 |
| `QACu1(A,B,C,D) → implicitCurve` | Circular cubic of coaxal circles through corresponding diagonal pairs. | 取 D 的重心 `(p:q:r)`；令 `T_a=a²(p+q)(p+r)−b²p(p+q)−c²p(p+r)`，T_b、T_c 循环。候选式为 `a²T_a YZ(rY−qZ)+b²T_b ZX(pZ−rX)+c²T_c XY(qX−pY)=0`，用 TriangleCurve 发出，无中间 cevian 除法。须与下述三圆共轴恒等式核对，尤其第二循环项符号；网页 CT 式中间项按原样抄写与独立例子不符，暂以几何定义为准。三角形共线未定，某个迹在无穷远时通过多项式处理极限。 |
| `QLQu3(A,B,C,D) → implicitCurve` | Schmidt quartic of coaxal circles through opposite intersection pairs. | 正确配对为 `(A,C),(B,D),(E,F)`，E=AB∩CD、F=BC∩DA。为三个含变量 P 的圆生成齐次系数行 `(s,d,e,f)`，用 `det[[s1,d1,e1],[s2,d2,e2],[s3,d3,e3]]=0` 消元；它们已共用 P，故圆心共线等价于共轴。消去恒等相消的最高项后为四次，不生成“圆心函数求交”的长有理式，不用十四点拟合。E/F 先齐次保留，参考参数公共因子须预先约掉，不能在平行处由全零行列式产生伪曲线。 |
| `OrthopivotalCubic(A,B,C,P) → implicitCurve` | Orthopivotal cubic with orthopivot P. | P 的重心为 `(p:q:r)`，按 Gibert 的共线定义 `P,X,oc(X)` 及现有 Orthocorrespondent 齐次式得到三次；候选短式为 `Σ_cyclic X[(c²p−2S_B r)Y²−(b²p−2S_C q)Z²]=0`，原生 TriangleCurve。只有六项，避免真实轨迹和九点拟合。P=O 对照 Neuberg cubic；P=G 时容许 Kiepert 双曲线加无穷远线的射影退化，其仿射方程可降为二次，不因总次数变化造出辅助点补三次。 |

**共轴消元的可复用小原语。** 对固定有限 U,V 和变量 P=(x,y)，圆方程可由下列 3×4 矩阵的带符号 3×3 余子式直接取得：

```text
[ x²+y²   x   y   1 ]
[ U·U     Ux  Uy  1 ]   -> (s,d,e,f),
[ V·V     Vx  Vy  1 ]      s(X²+Y²)+dX+eY+f=0 .
```

三圆共同经过 P，故只需前三个系数的 3×3 行列式检查同属一个圆束；无需除以 s 得圆心。QACu1 用 `(A,U),(B,V),(C,W)`，三条固定弦所在直线交于 D，最高次项进一步相消为三次；QLQu3 通常为四次。对 U/V/W 等无穷远点，齐次行写为 `(Ux²+Uy²,UxUw,UyUw,Uw²)`，但**不能认为清分母就自动解决了所有退化**：必须预先去掉只依赖参考点的可约因子，并核查多项式是否仍非零。此原语用于推导／验证；实际生成优先使用已简化的十项／十五项系数，不反复内联大行列式。

本轮用精确有理数例 `A=(0,0),B=(4,0),C=(3,3),D=(−1,2)`，独立计算三圆系数，确认 QACu1 共轴式总次数为 3、QLQu3 为 4；上述 QACu1 循环式与共轴式相差非零常数，而网页 CT 式中间项按其显示符号使用则不成比例。这只是排除符号错误的一个独立例子，**尚不构成一般恒等式证明或实机验收**；实现时须对符号参数和更多一般位置验证。同例还通过 QAP2/QAP4/QAP5/QACu1 的 24 种排列检查、QAP2 在四个九点圆上、QL 的两组对顶点复数积相等及四外心与 M 共圆检查；CoTf3／InvCoTf3 的互逆关系已作一般系数的符号恒等式检查。Orthopolar 二倍角式另以 `ABC=(0,0),(4,0),(3,3)`、`P=(1,1)` 精确检查中心及三垂足代入残差为零。上述均为一次性离线推导校验，本轮未新增工具代码或测试文件。

定义来源：[QL-Cu1](https://www.chrisvantienhoven.nl/epg/n-geometry/quadri-figures/ql-items/ql-cu1/) 的共轭中点条件、[QA-Cu1](https://www.chrisvantienhoven.nl/epg/n-geometry/quadri-figures/qa-items/qa-cu1/) 的目录方程、[QL-Qu3](https://www.chrisvantienhoven.nl/epg/n-geometry/quadri-figures/ql-items/ql-qu3/) 的三对相对交点及圆心共线定义、[Gibert orthopivotal](https://bernard-gibert.fr/gloss/orthopivotalcubi.html) 的短式与退化例。网页中的四次长式有排版缺项风险，优先独立消元。Orthopivotal 的 S_A/S_B/S_C 必须与本节定义一致，不混用二倍余弦量。

#### 10.2.8 表达式预算、实施顺序与验收约定

本节给出设计时的复杂度与验收要求。现已生成 P3 命令并补充自动测试及实机专项入口；已经完成的验收与仍待验证的项目分别在第 11 节记录。

1. **先实现小原语和短式家族**：三轴、Soddy、CoTf3 两式、QA 四点，再建 QL 的 M/κ／广义圆系数与四外心共用块。随后派生 QL 点对、圆、中心；最后接曲线及 QLTf1 多项式重载。OrthopolarConic 的二倍角消元和 LiangZelich 的专名／透视解释单独复核。不能因后一重载尚待预算而阻挡已满足定义与验收的独立工具。
2. **预算看最终展开表达式**：短 compose 目标为几百到数千字符；中等 builder 尽量控制在约 10k 字符内；QAP2／QLTf1 曲线等可先设 30k 字符的审阅线。这些是设计目标，不是新的编译器硬限制。记录代表性标识符和长嵌套调用的字符数、匿名绑定数、原生几何操作数及生成耗时；若超过审阅线，先绑定复用、改为六／十／十五系数或 ApplyMatrix，再决定是否需要更大预算。不能把符号上的一个 `det`、一个 compose 当成恒定成本。
3. **一般位置与有向性**：内外点、锐／钝／直角、顺逆方向、镜像、旋转、平移、大坐标与小尺度；QA 全排列、QL 循环／反序及改变线结构的非等价排列。几何残差用相对尺度；不以固定坐标 epsilon 判重。线段／射线与支撑线一致，且不因端点反序换错定义。
4. **有限极限和真正未定分别验收**：OrthicAxis 穿越直角、Stammler 非等边等腰线对、CoTf3 圆／抛物线／直角双曲线及中心／轴上输入、QAP4 四点共圆返回共同圆心、QAP2 垂心四点组、Orthopolar 在 P 为顶点／边上、QL 相切点对与虚实转换、Newton line 过 M、四边有内切圆时 QLCu1 的结点；无穷远和无限解族保留 undefined。对尚未证明可去的基点不承诺连续扩张。
5. **独立数学交叉校验**：QAP2 四个九点圆同过一点；QAP4 四种排除顶点方式一致；P5 的反补反射式与重心多项式一致；T(A)=C、T(B)=D、T²=id；QL2P3 固定、QL2P2 互换；四外心及 M 在 QLCi3、QL2P1 在 QLCi5；Orthopolar 参数恒等式、LiangZelich 极点关系、曲线方程与共轴／共线条件对应。不要只把生成公式原样拷到测试中自证。
6. **后端和持久依赖**：静态测试检查重载匹配、独立输出和 i、卫生变量、最终原生命令名、无命名辅助对象、无 Locus／采样拟合、预算；实际嵌入引擎检查原生语法／签名、conic 的 XML 类、动态定义恢复、拖动、导出重开后的依赖。增加 P3 专项入口，仍不替代完整 P2 验收。网页公式核实、离线代数校验、编译器测试、实机测试的结论分别记录。

## 11. 实现记录与验收要点

### P3 实现记录（2026-10-16）

- `library.json` 升至 **0.3.0**，从 103 增至 **137 个工具名**，P3 新增 **34 名／42 重载**，包含 QLTf1 的五种强类型重载和三组点对的可选编号。工具补全、文件宏优先、独立输出与原生持久依赖沿用现有编译器；没有安装宏、命名辅助对象、脚本或 JavaScript 坐标快照。
- 新增 `p3TriangleBuilders.ts`、`quadrilateralBuilders.ts`、`polynomialGeometry.ts`、`qlCurveTransforms.ts`，只负责符号表达式生成。短组合仍通过 compose 调用已有工具。QAP2 将候选 4×5 求核进一步简化：平移到 D 并归一化，消掉常数项，以 3×4 矩阵的四个 3×3 余子式求中心，避免冗余的垂心输入。OrthicAxis 在右角之前约因子，Co-Tf3 不选主轴，QAP4 不先有限化等角共轭。
- QLTf1 曲线变换先将实系数转换为 `z^i conjugate(z)^j` 系数。反演交换相应幂，原生动态选 `m=max(i,j)` 后清分母，恰好消去人工引入的所有 `rho=(x−Mx)²+(y−My)²` 因子；随后将共轭项合并为实多项式。不需要符号 CAS、曲线采样或数值多项式插值。输入至多四次时输出至多八次，使用基数 5 编码与原生完整多项式相等检查，支持动态次数／圆型极限。
- QL-Qu3 保留 E、F 的齐次坐标，将固定点转换为圆方程行 `(Ux²+Uy²,UxUw,UyUw,Uw²)`。各圆系数先匿名绑定，再作稀疏多项式行列式；恒等为零的五次项直接去除。一对边平行时无需生成无穷远仿射交点，第三个圆允许作为直线型代数极限；多个约束同时消失、全零多项式仍 undefined。QL 圆心链仍要求有限的分量三角形外心，不宣称全部平行配置都有有限结果。
- 点对编号重载直接将 i 传入原生交点指令，或直接用符号 `(3−2i)` 选择复平方根分支，避免先求两个完整分支再从匿名列表抽取。双输出仍是两个独立对象；无实交点保留 undefined 槽。
- 最终展开预算（代表性长输入标签）：QLQu3 **9,327 字符**，QLTf1 四次多项式重载 **4,618 字符**，其他重载均不足 2k 字符；全部低于 30k 审阅线。此长度检查不证明原生求值或绘制耗时。
- 自动检查：新增 `p3Commands.test.ts` 的 9 项测试，覆盖所有新重载与预算、独立输出、强类型／卫生作用域、Co-Tf3 相似及互逆、完整四次复系数重建、共轴四次式、无穷远对角点延拓及 QA-Cu1 的独立符号例子。现有全库原生命令名检查自动涵盖新增工具。全套 Vitest **10 个文件、108 项通过**，`npx tsc --noEmit` 与生产构建均通过；构建仍有现有 Gradio Node 模块外置及大包提示。
- 实机入口为 `/scripts/geogebra-smoke.html?suite=p3`，可附 `&tool=QL2P3` 等确切工具名只测其重载。脚本检查全部 42 重载的输出类与辅助对象计数，以及共轭、退化、拖动、导出重开。测试时暂关重绘并隐藏诊断输出，完成后恢复重绘，避免叠画多条隐式曲线。
- **已取得的实机证据**：整批运行前 20 项通过，包括三轴、Soddy、LiangZelich、Stammler／Orthopolar、Cundy–Parry、两种 Co-Tf3、QAP2/3/4/5、Plücker／Newton 点对重载和固定点双输出的类型／对象数检查。CoTf3 专项及修订后的 QL2P3 双输出／编号单输出专项分别得到 **COMPLETE**。
- **尚未完成的实机验收**：整批运行及 QLTf1 曲线专项随后遇到浏览器 CDP 控制超时，无法读取最终状态；这不是明确的几何失败，也不能据此确认通过。QL 中心／圆、各曲线重载、完整几何残差、动态恢复及导出重开仍需完成整批专项。特别是高次曲线变换的实际引擎性能尚未验证；本轮未发布、提交或部署这些改动。

1. 先实现 P1 中的中心、投影、三角形、线性变换；统一参数顺序和同类型多输出元数据。保持现有五个命令兼容。
2. 再实现 P2 的圆和二次型家族；所有 conic 输出都核验原生类型、退化类型及下游重载，不仅检查画面。
3. 补齐 implicitCurve 类型、精确系数读取与数学次数前提，再实现极曲线、三次剩余交点、九点 Cubic 重载。不要用 unknown 通配绕过强类型。
4. 最后再从暂缓区逐项提升，不把它们作为已承诺批量任务。

后续每个工具只需围绕真实数学性质验证：一般三角形、交换 B/C、镜像、平移和尺度变换；钝角／直角／等腰／正三角形；边上点、顶点、切点、平行和重合。变换检查对合或逆关系，圆检查幂／切线距离，conic 检查齐次代入，极线检查极化恒等式。拖动时观察唯一极限能否恢复、undefined 槽能否重新显现。

还应检查导出重开后的原生依赖、辅助标签数量为零、表达式长度与现有编译器预算。P1 已人工检查；P2 需运行下述独立验收脚本。

### P1 实现记录

- `library.json` 已升至 0.1.0，新增 **52 个命令、70 个重载**；原有 5 个命令保留。明确写了“不实现”的 ComplementOfIsotomicConjugate、CircumsymmedianPoint 未加入；其他 P2 项目未提前实现。
- 新增显式 `compose` 定义。可复用其他自定义工具、原生命令及按顺序声明的局部表达式；`expression` 仍只调用原生命令。按重载检测循环依赖，保留嵌套及 500,000 字符上限；文件同名宏不改变内部依赖，调用入口仍尊重文件工具优先级。
- 多输出直接发出独立几何表达式；匿名列表或 Zip 只作内部实现，不返回列表对象。末尾整数 i 在 GeoGebra 中动态选取，不读取数值到 JavaScript。
- SpiekerCenter 使用 X(10)；HarmonicConjugate 使用圆上／直线统一的复数交比公式；两个 Similarity 均完成四点、五点重载；Antipode 接受中心二次曲线。X(13) 的英文描述也已纠正，它不是 first isodynamic point；FermatPoint 仍为 P2。
- 已运行 Vitest：6 个测试文件、78 项通过；生产构建通过。TypeScript 检查仍受未改动的 MarkdownRenderer、TriplesPage 中已有错误阻挡。实际引擎入口为 `/scripts/geogebra-smoke.html?suite=p1`，涵盖所有新增重载、对象类型、辅助对象计数、几何恒等式、拖动及导出重开，已人工运行。

### P2 实现记录

- `library.json` 已升至 **0.2.0**，新增 **45 个命令名、59 个重载**（含 IsogonalConjugate、IsotomicConjugate、SecondIntersection 三个既有命令的新增重载），工具库现有 102 个命令名。SteinerCircle、InvolutionFixedPoints、PolarLine、TangentialPoint 按审阅意见未添加。
- 保留并使用 P1 的 `compose` 跨工具复用；Hagge、mixtilinear、inconic、四边形抛物线等复用已有自定义工具和原生命令。复杂齐次代数集中到三角形／曲线 builder，共用匿名绑定与矩阵原语抽出至 `expressionGeometry.ts`。
- 所有几何分支、次数／秩检查、索引选择均在 GeoGebra 表达式内部动态计算。JavaScript 只根据固定对象类型与参数个数选择重载、生成表达式；没有坐标快照或采样拟合。多输出保持独立对象。CyclocevianConjugate、Orthocorrespondent 特别在齐次层复合，避免中间无穷远对象中断有限结果。
- 自动测试覆盖共轭对合、Ceva／cross 关系、有向外点、边上及中间无穷远极限、六中点曲线和平行四边形退化、公切线等半径／相切极限、齐次极化、剩余根、类型映射、原生重载兼容及表达式预算。Vitest 全套 **8 个文件、94 项通过**；生产构建通过。TypeScript 全量检查仍有 P1 已记录的未改动文件错误。
- 实机入口：`/scripts/geogebra-smoke.html?suite=p2`。脚本包含全部 59 个新增重载、几何类 XML、辅助对象计数、共轭关系、相切／焦点性质、直角／等腰／平行四边形退化、三次次数检查、拖动及导出重开。本会话浏览器清单为空，**尚未运行此脚本，不能将自动表达式测试视作原生引擎已验收**。

### 内置指令兼容性审计（2026-10-16）

- 以本地 `GEOGEBRA_COMMAND_NAMES`、[官方 All Commands](https://geogebra.github.io/docs/manual/en/commands/All_Commands/) 和 [Commands.java](https://github.com/geogebra/geogebra/blob/main/source/shared/common/src/main/java/org/geogebra/common/kernel/commands/Commands.java) 核对原生命令名。`RadicalAxis` 不在公开命令表中，也不是 Commands 枚举中的输入命令；本计划此前将它列为 Native 是错误的。
- `library.json` 升至 **0.2.1**，新增 `RadicalAxis(circle,circle)`，工具库现有 **103 个命令名**。`RadicalCenter` 改为 compose 展开根轴。四点 `SteinerLineQ` 最终直接使用坐标线性方程，四线 SteinerLineQ 及两个 TangentParabola 重载复用此坐标实现。`expression` 不展开自定义工具的规则保持不变。
- 实机进一步发现 `Point(l,0)` 对完整直线给出无穷远点，不能把射线／线段上参数 0 有限的约定直接用于 lineLike。支撑线提取统一使用参数 **1/4、1/2**，修复 SecondIntersection、Orthopole、NewtonLine、AntiSteinerPoint、MiquelPoint、SteinerLineQ、TangentParabola 的相应重载；共用齐次 builder 的线段／射线提取同步使用这组参数。依据见 [PathParameter 官方映射](https://geogebra.github.io/docs/manual/en/commands/PathParameter/)。
- `nativeCommands.test.ts` 静态检查工具库所有重载的最终展开表达式（含 builder、locals、compose、多输出、conic/circle、line/segment/ray 和混合 Conic 点线组合）。只允许指令表中的名称、明确列出的标量／坐标函数和编译器匿名局部调用；不把自定义名称混入原生命令表。未发现其他缺失的原生命令名。此检查**不证明参数签名、几何结果或所有引擎版本可用性**。
- 专项实机入口：`/scripts/geogebra-smoke.html?suite=radical`，覆盖相离／相交／内外相切／竖直圆心线／同心重合、根心等幂关系、两个 SteinerLineQ 与 TangentParabola 重载，以及其他受影响的支撑线工具和 line/segment/ray 一致性、拖动和导出重开。完整 P2 验收状态仍按上节记录。
- 前一版（SteinerLineQ 复用根轴时）已在实际嵌入式 GeoGebra 运行此专项脚本并得到 **COMPLETE**，包括根轴经过同心退化后恢复，以及其他受影响重载的拖动／导出重开。该版 Vitest **9 个文件、97 项通过**，生产构建通过；全量 TypeScript 检查仍仅报告既有 MarkdownRenderer、TriplesPage 错误。此次专项验收不替代完整 P2 验收。
- 后续按审阅意见将 SteinerLineQ 四点版改为上述直接坐标方程，并补充方程与两直径圆幂差的代数一致性测试，包含水平／竖直和同心退化；相关自动测试 **4 个文件、48 项通过**，按用户要求不再运行真实引擎验收。

### 三次曲线调用兼容性修复（2026-10-16）

- 实机复现 `Polar`、`PolarConic`、两个 `ThirdIntersection` 重载共用的 `Derivative(...)(0,0)` 写法被原生解析器拒绝。命令名出现在指令表中不能证明这种命令结果后缀调用合法；导数构造还涉及 CAS 计算，原检查只覆盖命令名，未覆盖这层语法。
- `library.json` 升至 **0.2.2**。共享系数提取改为原生一元多项式展开：对 `f=LeftSide(F)-RightSide(F)` 作符号代入 `f(x,x^4)+0*x`，将三次单项式 `x^i y^j` 编码为互异的 `x^(i+4j)`，再由 `Coefficients` 提取。该命令只接收一元函数，不直接接收 implicitCurve 或二元函数；原生实现的多项式展开分支不需要 CAS。没有采样曲线点、插值或 JavaScript 系数快照。
- 将降幂系数表 Reverse 后补零，支持稀疏多项式及动态最高项消失。仍用 `AreEqual` 比较重建二元多项式与完整原函数，并要求三次项非零；例如 `x^4-y+x^3` 的高次项在代入时相消，仍会被完整二元比较拒绝。
- 专项入口为 `/scripts/geogebra-smoke.html?suite=cubic`。自动测试覆盖编码无碰撞、稀疏系数补零、表达式中不再包含 Derivative；实机脚本覆盖四个重载、全部十个系数、竖直割线／拐点、非三次输入、动态次数、三种构造来源及导出重开。完整 P2 验收仍单独记录。
- 本轮专项实机脚本已得到 **COMPLETE**，系数变动与导出重开后的依赖检查通过。Vitest **9 个文件、99 项通过**，生产构建通过；全量 TypeScript 检查仍仅报告原有 MarkdownRenderer、TriplesPage 错误。
- 源码核对：[CmdCoefficients](https://github.com/geogebra/geogebra/blob/main/source/shared/common/src/main/java/org/geogebra/common/kernel/cas/CmdCoefficients.java)、[AlgoCoefficients](https://github.com/geogebra/geogebra/blob/main/source/shared/common/src/main/java/org/geogebra/common/kernel/cas/AlgoCoefficients.java)、[AlgoLeftRightSide](https://github.com/geogebra/geogebra/blob/main/source/shared/common/src/main/java/org/geogebra/common/kernel/advanced/AlgoLeftRightSide.java)。


## 12. 参考资料与本轮查阅情况

- [ETC glossary](https://faculty.evansville.edu/ck6/encyclopedia/glossary.html)：用于核对 triangle、conjugate、pole 等术语；其坐标默认是三线坐标。
- [Bernard Gibert glossary](https://bernard-gibert.fr/glossary.html)：早期直接请求返回 502。本次 P3 的 [Orthopivotal 页面](https://bernard-gibert.fr/gloss/orthopivotalcubi.html) 通过搜索索引读到定义、短方程及 P=O/G 退化例；CL037 直连仍失败，Cundy–Parry 定义由 ETC extended glossary 交叉核对。未读取部分不视为已验证。
- [Encyclopedia of Poly Geometry](https://www.chrisvantienhoven.nl/epg/)：P3 本次实际读取 Co-Tf3、QL-Tf1、QA-P2/P3/P4/P5、QL-P5/P20、QL-Ci3、QL-2P1/2P2/2P3、QA-Cu1、QL-Cu1 和 QL-Qu3 的页面内容，具体链接及采用条件在第 10.2 节就近给出；部分旧长路径超时后由站内短链接读取。不代表全部 QA/QL 条目已核实，也不代表目录的每个显示公式均无排版问题。
- GeoGebra 官方手册：[TriangleCenter](https://geogebra.github.io/docs/manual/en/commands/TriangleCenter/)、[Cubic](https://geogebra.github.io/docs/manual/en/commands/Cubic/)、[ImplicitCurve](https://geogebra.github.io/docs/manual/en/commands/ImplicitCurve/)、[TriangleCurve](https://geogebra.github.io/docs/manual/en/commands/TriangleCurve/)、[Polar](https://geogebra.github.io/docs/manual/en/commands/Polar/)、[Tangent](https://geogebra.github.io/docs/manual/en/commands/Tangent/)。


## 13. 源名称审计表

下表按源文件首次出现顺序列出所有未排除的显示名称；同名重复导入合并在一行，变体编号单列。中文名称保留在此仅用于溯源，不是最终英文工具名。Source 列的 S 编号可在本文搜索到设计或处置条目。

| Source | Original display name | Entries / definitions | Decision / target |
|---|---|---|---|
| S001 | Centroid | 6 / 1 | Implemented (P1): `Centroid(A,B,C) → point` |
| S002 | Orthocenter | 6 / 1 | Implemented (P1): `Orthocenter(A,B,C) → point` |
| S003 | Excenter | 6 / 1 | Implemented (P1): `Excenter(A,B,C) → point` |
| S004 | Center of Conic | 6 / 1 | Native: Center of Conic |
| S005 | Fermat Point | 6 / 1 | Defer: `IsogonicCenter(A,B,C,i) → point`; Implemented (P2): `FermatPoint(A,B,C) → point` |
| S006 | Brocard Point | 6 / 1 | Implemented (P1): `BrocardPoints(A,B,C[,i]) → point × 2 / point` |
| S007 | Kiepert Hyperbola | 6 / 1 | Implemented (P2): `KiepertHyperbola(A,B,C) → conic` |
| S008 | Euler Line | 6 / 1 | Implemented (P1): `EulerLine(A,B,C) → line` |
| S009 | Incenter | 6 / 1 | Existing: `Incenter(A,B,C) → point` |
| S010 | Circumcenter | 6 / 1 | Implemented (P1): `Circumcenter(A,B,C) → point` |
| S011 | Incircle | 6 / 1 | Native: Incircle / 内切圆 |
| S012 | Feuerbach Hyperbola | 6 / 1 | Implemented (P2): `FeuerbachHyperbola(A,B,C) → conic` |
| S013 | Midpoints | 6 / 1 | Implemented (P1): `MedialTriangle(A,B,C[,i]) → point × 3 / point` |
| S014 | Pedals | 6 / 1 | Implemented (P1): `OrthicTriangle(A,B,C[,i]) → point × 3 / point` |
| S015 | NinePoint Circle | 6 / 1 | Implemented (P1): `NinePointCircle(A,B,C) → circle` |
| S016 | Feuerbach Point | 6 / 1 | Implemented (P2): `FeuerbachPoint(A,B,C) → point` |
| S017 | NinePoint Center | 6 / 1 | Implemented (P1): `NinePointCenter(A,B,C) → point` |
| S018 | South Pole | 6 / 1 | Implemented (P1): `ArcMidpoint(A,B,C) → point`; Implemented (P1): `SouthPole(A,B,C) → point` |
| S019 | North Pole | 6 / 1 | Implemented (P1): `OppositeArcMidpoint(A,B,C) → point`; Implemented (P1): `NorthPole(A,B,C) → point` |
| S020 | Antipodal Point | 6 / 1 | Implemented (P1): `Antipode(q:conic,P) → point`; `Antipode(A,B,C) → point` |
| S021 | Circumortho Point | 6 / 1 | Defer: See deferred-definition notes |
| S022 | Mixtilinear Incircle | 6 / 1 | Implemented (P2): `MixtilinearIncircle(A,B,C) → circle` |
| S023 | Three Mixtilinear Incircles | 6 / 1 | Implemented (P2): `MixtilinearIncircles(A,B,C[,i]) → circle × 3 / circle` |
| S024 | CicumMixtilinear Tangency | 6 / 1 | Implemented (P2): `MixtilinearContactPoint(A,B,C) → point` |
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
| S036 | Simson Line | 6 / 1 | Implemented (P2): `SimsonLine(A,B,C,P) → line` |
| S037 | Mirrorimage Line | 6 / 1 | Implemented (P2): `SteinerLine(A,B,C,P) → line` |
| S066 | Gergonne | 6 / 2; variants S066, S382 | Implemented (P1): `GergonnePoint(A,B,C) → point` |
| S067 | Nagel | 6 / 2; variants S067, S383 | Implemented (P1): `NagelPoint(A,B,C) → point` |
| S072 | Mittenpunkt | 6 / 2; variants S072, S384 | Implemented (P1): `Mittenpunkt(A,B,C) → point` |
| S078 | 对合不动点 | 3 / 1 | Defer: `InvolutionFixedPoints(l,A,A1,B,B1[,i]) → point × 2 / point` |
| S079 | Conic 0P5L | 3 / 1 | Existing: `Conic(o1:pointOrLine,...,o5:pointOrLine[,i]) → conic(s)` |
| S080 | Conic 1P4L | 3 / 1 | Existing: `Conic(o1:pointOrLine,...,o5:pointOrLine[,i]) → conic(s)` |
| S081 | Conic 2P3L | 3 / 1 | Existing: `Conic(o1:pointOrLine,...,o5:pointOrLine[,i]) → conic(s)` |
| S082 | Conic 3P2L | 3 / 1 | Existing: `Conic(o1:pointOrLine,...,o5:pointOrLine[,i]) → conic(s)` |
| S083 | Miquel Point | 2 / 1 | Implemented (P2): `MiquelPoint(A,B,C,D) → point`; Implemented (P2): `MiquelPoint(l1,l2,l3,l4) → point` |
| S084 | Newton Line | 2 / 1 | Implemented (P1): `NewtonLine(A,B,C,D) → line`; Implemented (P1): `NewtonLine(l1,l2,l3,l4) → line` |
| S085 | Steiner Line | 2 / 1 | Implemented (P2): `SteinerLineQ(A,B,C,D) → line`; Implemented (P2): `SteinerLineQ(l1,l2,l3,l4) → line` |
| S086 | Steiner Circle | 2 / 1 | Implemented (P3): `QLCi3 (four-point interface only)`; see section 10.2 |
| S087 | NinePoint Conic | 2 / 1 | Defer: See deferred-definition notes |
| S088 | Pseudocircumcenter | 3 / 2; variants S088, S459 | Implemented (P3): `QAP3; legacy line variant remains deferred`; see section 10.2 |
| S089 | Isogonal Center | 3 / 2; variants S089, S444 | Implemented (P3): S444 point construction via `QAP4`; S089 line interface remains deferred |
| S090 | Poncelet Point | 3 / 2; variants S090, S458 | Implemented (P3): `QAP2; legacy line variant remains deferred`; see section 10.2 |
| S091 | Complete Quadrilateral | 2 / 1 | Implemented (P1): `DiagonalPoints(A,B,C,D[,i]) → point × 3 / point` |
| S092 | Circumcevian Triangle | 2 / 1 | Implemented (P1): `CircumcevianTriangle(A,B,C,P[,i]) → point × 3 / point`; Implemented (P1): `CircumcevianPoint(A,B,C,P) → point` |
| S093 | Intersection | 2 / 1 | Native: Intersection |
| S094 | Complementary | 2 / 1 | Implemented (P1): `Complement(A,B,C,P) → point` |
| S095 | Foci | 2 / 1 | Native: Foci / Asymptotes / Axes / Directrices |
| S096 | Asymptotes | 2 / 1 | Native: Foci / Asymptotes / Axes / Directrices |
| S097 | Axes | 2 / 1 | Native: Foci / Asymptotes / Axes / Directrices |
| S098 | Directrices | 2 / 1 | Native: Foci / Asymptotes / Axes / Directrices |
| S099 | Tangent Parabola | 2 / 1 | Implemented (P2): `TangentParabola(A,B,C,D) → conic`; Implemented (P2): `TangentParabola(l1,l2,l3,l4) → conic` |
| S100 | Triangle Center X_57 | 2 / 1 | Native: Triangle Center X_57; Bevan Point; Schiffler Point |
| S101 | Bevan Point | 2 / 1 | Native: Triangle Center X_57; Bevan Point; Schiffler Point |
| S102 | Intouch Triangle | 2 / 1 | Implemented (P1): `IntouchTriangle(A,B,C[,i]) → point × 3 / point` |
| S103 | Pedal | 2 / 1 | Native: Pedal |
| S104 | Intersection on Circle | 2 / 1 | Existing: `SecondIntersection(q,P,Q) → point`; Implemented (P2): `SecondIntersection(q,P,l:lineLike) → point` |
| S105 | Pole | 2 / 1 | Native: `PolarLine(P,q:conic) → line`; Native: Pole |
| S106 | Trisection Point | 2 / 1 | Implemented (P1): `TrisectionPoint(A,B) → point` |
| S107 | Schiffler Point | 2 / 1 | Native: Triangle Center X_57; Bevan Point; Schiffler Point |
| S126 | Mixtilinear Circumcircle Tangency | 2 / 1 | Defer: See deferred-definition notes |
| S127 | Mixtilinear Circumcircle | 2 / 1 | Defer: See deferred-definition notes |
| S128 | Three Mixtilinear Circumcircles | 2 / 1 | Defer: See deferred-definition notes |
| S130 | Mixtilinear Excircle | 2 / 1 | Implemented (P2): `MixtilinearExcircle(A,B,C) → circle` |
| S131 | Three Mixtilinear Excircles | 2 / 1 | Implemented (P2): `MixtilinearExcircles(A,B,C[,i]) → circle × 3 / circle` |
| S220 | Radical Axis | 2 / 2; variants S220, S365 | Implemented (compatibility): `RadicalAxis(c1,c2) → line` |
| S221 | Radical Center | 2 / 2; variants S221, S366 | Implemented (P1): `RadicalCenter(c1,c2,c3) → point` |
| S222 | Outer Tangent | 2 / 2; variants S222, S363 | Implemented (P2): `CommonTangents(c1,c2,s[,i]) → line × 2 / line` |
| S223 | Inner tangent | 1 / 1 | Implemented (P2): `CommonTangents(c1,c2,s[,i]) → line × 2 / line` |
| S361 | External Center of Similitude | 1 / 1 | Implemented (P1): `SimilarityCenter(c1,c2,s) → point` |
| S362 | Internal Center of Similitude | 1 / 1 | Implemented (P1): `SimilarityCenter(c1,c2,s) → point` |
| S364 | Inner Tangent | 1 / 1 | Implemented (P2): `CommonTangents(c1,c2,s[,i]) → line × 2 / line` |
| S367 | Anti-Steiner Point | 1 / 1 | Implemented (P2): `AntiSteinerPoint(A,B,C,l) → point` |
| S368 | Isogonal Conic | 1 / 1 | Implemented (P2): `IsogonalConjugate(A,B,C,l) → conic` |
| S369 | Trilinear Polar | 1 / 1 | Implemented (P1): `TrilinearPolar(A,B,C,P) → line` |
| S370 | Orthotransversal | 1 / 1 | Implemented (P2): `Orthotransversal(A,B,C,P) → line` |
| S371 | Inner Tangent Ellipse | 1 / 1 | Implemented (P2): `InconicWithFocus(A,B,C,P) → conic` |
| S372 | Laofeng Points | 1 / 1 | Implemented (P2): `SteinerFoci(A,B,C[,i]) → point × 2 / point` |
| S373 | Fuhrmann Circle | 1 / 1 | Implemented (P1): `FuhrmannCircle(A,B,C) → circle` |
| S374 | Brocard Circle | 1 / 1 | Implemented (P1): `BrocardCircle(A,B,C) → circle` |
| S375 | Hagge Circle | 1 / 1 | Implemented (P2): `HaggeCircle(A,B,C,P) → circle` |
| S376 | Taylor Circle | 1 / 1 | Implemented (P2): `TaylorCircle(A,B,C) → circle` |
| S377 | Trilinear Pole | 1 / 1 | Implemented (P1): `TrilinearPole(A,B,C,l) → point` |
| S378 | Apollinius Circle | 1 / 1 | Implemented (P2): `ApolloniusCircle(A,B,C) → conic` |
| S379 | Three Apollinious Circle | 1 / 1 | Implemented (P2): `ApolloniusCircles(A,B,C[,i]) → conic × 3 / conic` |
| S380 | Second Isodynamic Point | 1 / 1 | Implemented (P1): `IsodynamicPoint(A,B,C,i) → point` |
| S381 | First Isodynamic Point | 1 / 1 | Implemented (P1): `IsodynamicPoint(A,B,C,i) → point` |
| S385 | Orthic Triangle | 1 / 1 | Implemented (P1): `OrthicTriangle(A,B,C[,i]) → point × 3 / point`; Implemented (P1): `PedalTriangle(A,B,C,P[,i]) → point × 3 / point` |
| S386 | Orthic Circle | 1 / 1 | Implemented (P1): `PedalCircle(A,B,C,P) → circle` |
| S388 | Tangential Triangle | 1 / 1 | Implemented (P1): `TangentialTriangle(A,B,C[,i]) → point × 3 / point` |
| S389 | Cubic With Pivot | 1 / 1 | Implemented (P2): `PivotalIsogonalCubic(A,B,C,P) → implicitCurve` |
| S390 | Neuberg Cubic | 1 / 1 | Native: Neuberg Cubic / K001 Neuberg |
| S391 | Zosma Transform | 1 / 1 | Defer: See deferred-definition notes |
| S401 | Steiner Inellipse | 1 / 1 | Implemented (P2): `SteinerInellipse(A,B,C) → conic` |
| S402 | Steiner Exellipse | 1 / 1 | Implemented (P2): `SteinerCircumellipse(A,B,C) → conic` |
| S403 | Harmonious Conjugate | 1 / 1 | Implemented (P1): `HarmonicConjugate(A,B,P) → point` |
| S404 | Anticevian Triangle | 1 / 1 | Implemented (P1): `AnticevianTriangle(A,B,C,P[,i]) → point × 3 / point` |
| S405 | Orthopolar Conic | 1 / 1 | Implemented (P3): `OrthopolarConic`; see section 10.2 |
| S406 | Cevian Affine Mapping | 1 / 1 | Implemented (P2): `CevianAffineMap(A,B,C,X,P) → point` |
| S407 | Gergonne Conic | 1 / 1 | Defer: See deferred-definition notes |
| S408 | Cevapoint | 1 / 1 | Implemented (P2): `Cevapoint(A,B,C,P,Q) → point` |
| S409 | Cevaconjugate | 1 / 1 | Implemented (P2): `CevaConjugate(A,B,C,X,P) → point` |
| S410 | Stammler Hyperbola | 1 / 1 | Implemented (P3): `StammlerHyperbola`; see section 10.2 |
| S411 | Anticomplementary | 1 / 1 | Implemented (P1): `Anticomplement(A,B,C,P) → point` |
| S412 | Crosspoint | 1 / 1 | Implemented (P2): `Crosspoint(A,B,C,P,Q) → point` |
| S413 | Crossconjugate | 1 / 1 | Implemented (P2): `CrossConjugate(A,B,C,X,P) → point` |
| S414 | X_fixed isoconjugate | 1 / 1 | Implemented (P2): `Isoconjugate(A,B,C,X,P) → point`; Implemented (P2): `Isoconjugate(A,B,C,X,Y,P) → point` |
| S415 | Ratio Point | 1 / 1 | Implemented (P1): `TransferRatio(A,B,C,D,P) → point` |
| S416 | Pedian Affine Mapping | 1 / 1 | Implemented (P2): `PedalAffineMap(A,B,C,X,P) → point` |
| S417 | Carnot Triangle | 1 / 1 | Implemented (P1): `CarnotTriangle(A,B,C,P[,i]) → point × 3 / point` |
| S418 | Cyclocevian Conjugate | 1 / 1 | Implemented (P2): `CyclocevianConjugate(A,B,C,P) → point` |
| S419 | Orthocorrespondence | 1 / 1 | Implemented (P2): `Orthocorrespondent(A,B,C,P) → point` |
| S420 | Excenters Rectangular Hyperbola | 1 / 1 | Defer: See deferred-definition notes |
| S421 | Orthopivotal Cubic | 2 / 2; variants S421, S450 | Implemented (P3): `OrthopivotalCubic (direct equation; old variants not copied)`; see section 10.2 |
| S422 | Cundy-Parry-Phi Transform | 1 / 1 | Implemented (P3): `CundyParryPhi`; see section 10.2 |
| S423 | Cundy-Parry-Psi Transform | 1 / 1 | Implemented (P3): `CundyParryPsi`; see section 10.2 |
| S424 | Cubic | 1 / 1 | Implemented (P2): `Cubic(P1,...,P9) → implicitCurve` |
| S425 | K003 McCAY | 1 / 1 | Native: K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas |
| S426 | K004 Darboux | 1 / 1 | Native: K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas |
| S427 | K005 Napolean | 1 / 1 | Native: K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas |
| S428 | K001 Neuberg | 1 / 1 | Native: Neuberg Cubic / K001 Neuberg |
| S429 | K002 Thomson | 1 / 1 | Native: K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas |
| S430 | Quartic | 1 / 1 | Native: `ImplicitCurve({P1,...,P14}) → implicitCurve` |
| S431 | 根轴 | 1 / 1 | Implemented (compatibility): `RadicalAxis(c1,c2) → line` |
| S432 | 内切圆 | 1 / 1 | Implemented (P1): `IntouchTriangle(A,B,C[,i]) → point × 3 / point`; Native: Incircle / 内切圆 |
| S433 | 旁切圆 | 1 / 1 | Implemented (P1): `Excircle(A,B,C) → circle` |
| S434 | 三点重心 | 1 / 1 | Implemented (P1): `Centroid(A,B,C) → point` |
| S435 | 垂心 | 1 / 1 | Implemented (P1): `Orthocenter(A,B,C) → point` |
| S436 | 黄金分割 | 1 / 1 | Implemented (P1): `GoldenSectionPoint(A,B) → point` |
| S437 | 等角共轭 | 1 / 1 | Existing: `IsogonalConjugate(A,B,C,P) → point` |
| S438 | 等截共轭 | 1 / 1 | Existing: `IsotomicConjugate(A,B,C,P) → point` |
| S439 | 补点 | 1 / 1 | Implemented (P1): `Anticomplement(A,B,C,P) → point` |
| S440 | 反补点 | 1 / 1 | Implemented (P1): `Complement(A,B,C,P) → point` |
| S441 | 九点三次曲线 | 1 / 1 | Implemented (P2): `Cubic(P1,...,P9) → implicitCurve` |
| S442 | 十四点四次曲线 | 1 / 1 | Native: `ImplicitCurve({P1,...,P14}) → implicitCurve` |
| S443 | IsogonalComplementary | 1 / 1 | Implemented (P1): `IsogonalComplement(A,B,C,P) → point` |
| S445 | QA-Cu1 | 1 / 1 | Implemented (P3): `QACu1`; see section 10.2 |
| S446 | QL-Cu1 | 1 / 1 | Implemented (P3): `QLCu1 (four-point interface only)`; see section 10.2 |
| S447 | QL-Isogonal Pair | 1 / 1 | Implemented (P3): `QL2P2 (four-point interface only)`; see section 10.2 |
| S448 | QL-P21 | 1 / 1 | Implemented (P3): `QLP21 (four-point interface only)`; see section 10.2 |
| S449 | QL-Cu1-Double | 1 / 1 | Defer: See deferred-definition notes |
| S451 | QL-Quartic1 | 1 / 1 | Defer: See deferred-definition notes |
| S452 | Dimidium Circle | 1 / 1 | Implemented (P3): `QLCi6 (four-point interface only)`; see section 10.2 |
| S453 | QL-P17 | 1 / 1 | Defer: See deferred-definition notes |
| S454 | Tf1-QLP17 | 1 / 1 | Defer: See deferred-definition notes |
| S455 | Spiral Similarity | 1 / 1 | Implemented (P1): `DirectSimilarity(A,B,C,D) → point`; Implemented (P1): `DirectSimilarity(A,B,C,D,E) → point` |
| S456 | Inverse Similarity | 1 / 1 | Implemented (P1): `OppositeSimilarity(A,B,C,D) → point`; Implemented (P1): `OppositeSimilarity(A,B,C,D,E) → point` |
| S457 | Antipedal Triangle | 1 / 1 | Implemented (P1): `AntipedalTriangle(A,B,C,P[,i]) → point × 3 / point` |
| S460 | Perspective Cubic | 1 / 1 | Defer: See deferred-definition notes |
| S461 | Q002 | 1 / 1 | Defer: K028; K073; Q002 |
| S462 | K028 | 1 / 1 | Defer: K028; K073; Q002 |
| S463 | Anti QA-Cu1 | 1 / 1 | Defer: See deferred-definition notes |
| S464 | Nine-Point Conic | 1 / 1 | Implemented (P2): `NinePointConic(A,B,C,D) → conic` |
| S465 | Isotocomplementary | 1 / 1 | Defer: `ComplementOfIsotomicConjugate(A,B,C,P) → point` |
| S466 | Jerabek Hyperbola | 1 / 1 | Implemented (P2): `JerabekHyperbola(A,B,C) → conic` |
| S467 | Antigonal Conjugate | 1 / 1 | Implemented (P2): `AntigonalConjugate(A,B,C,P) → point` |
| S468 | LiangZelich Perspector | 1 / 1 | Implemented (P3): `LiangZelichPerspector (polarity definition; perspectivity interpretation pending)`; see section 10.2 |
| S469 | K007 Lucas | 1 / 1 | Native: K002 Thomson; K003 McCAY; K004 Darboux; K005 Napolean; K007 Lucas |
| S470 | Tangent Conic | 1 / 1 | Implemented (P2): `InconicWithCenter(A,B,C,P) → conic` |
| S471 | Isogonal Pair with Center | 1 / 1 | Implemented (P2): `IsogonalPairWithMidpoint(A,B,C,P[,i]) → point × 2 / point` |
| S472 | Cubic Third Intersection 2 | 1 / 1 | Implemented (P2): `ThirdIntersection(F,P,Q) → point`; Implemented (P2): `ThirdIntersection(F,P) → point` |
| S473 | Cubic Polar Conic 2 | 1 / 1 | Implemented (P2): `PolarConic(P,F:implicitCurve) → conic` |
| S474 | Cubic Polar Line 2 | 1 / 1 | Implemented (P2): `Polar(P,F:implicitCurve) → line` |
| S475 | Cubic Tangential 2 | 1 / 1 | Implemented (P2): `ThirdIntersection(F,P) → point`; Defer: `TangentialPoint(F,P) → point` |
| S476 | Cubic Third Intersection | 1 / 1 | Implemented (P2): `ThirdIntersection(F,P,Q) → point`; Implemented (P2): `ThirdIntersection(F,P) → point` |
| S477 | Cubic Tangential | 1 / 1 | Implemented (P2): `ThirdIntersection(F,P) → point`; Defer: `TangentialPoint(F,P) → point` |
| S478 | Cubic Polar Line | 1 / 1 | Implemented (P2): `Polar(P,F:implicitCurve) → line` |
| S479 | Cubic Polar Conic | 1 / 1 | Implemented (P2): `PolarConic(P,F:implicitCurve) → conic` |
| S480 | K073 | 1 / 1 | Defer: K028; K073; Q002 |
| S481 | Strophoid | 1 / 1 | Defer: See deferred-definition notes |
| S482 | CoTf3 | 1 / 1 | Implemented (P3): `CoTf3(P,q)`; see section 10.2 |
| S483 | AntiCoTf3 | 1 / 1 | Implemented (P3): `InvCoTf3(P,q)`; see section 10.2 |
| S484 | Inverse in Hagge Circle | 1 / 1 | Implemented (P2): `HaggeInverse(A,B,C,P) → point` |
| S485 | Hagge Infinity Cubic | 1 / 1 | Defer: See deferred-definition notes |
| S486 | QL-Cu1Vertical | 1 / 1 | Defer: See deferred-definition notes |
| S487 | QL Eigenvalue | 1 / 1 | Defer: See deferred-definition notes |
| S488 | Dragon Cubic | 1 / 1 | Defer: See deferred-definition notes |
| S489 | Isogonal Conjugate | 1 / 1 | Existing: `IsogonalConjugate(A,B,C,P) → point` |
