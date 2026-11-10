# ETC 工具扩展计划

本轮为设计审阅。沿用 [扩展计划](tool-expansion-plan.md) 的分类、输入类型和连续性约定。参考三角形输入为三个独立点 A、B、C。三顶点输出按 A、B、C 对应的 BC、CA、AB 顺序，顶层分别创建三个点，末尾可加 1-based 编号 `i`。以下签名中的 P、Q 是点，`t` 是可拖动的实数。

## 取舍

| ETC 对象 | 当前入口与本轮安排 |
| --- | --- |
| 等角、等截、Ceva、Cross、Cyclocevian 共轭 | 已有专名。ETC 的 cevian product 在扩展词汇表指向 Ceva-point，先沿用 `Cevapoint`。逐项按定义区分新候选。[扩展词汇表](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html) |
| ETC 的 P-isoconjugate | 当前六点 `Isoconjugate(A,B,C,X,Y,U)` 以重心分量 `XᵢYᵢ` 为权。ETC 的参数 P 表示倒数权。按三线坐标约定换算后，在重心坐标中权为 `aᵢ³/Pᵢ`。已有工具可以表示同一映射，暂缓增加另一套参数约定。具体定义以条目坐标为准。[ETC Glossary](https://faculty.evansville.edu/ck6/encyclopedia/Glossary.html) |
| Bevan circle、第二 Brocard 圆、cevian circle | 分别可用三个旁心的外接圆、以外心为心且过任一 Brocard 点的圆，以及三个塞瓦迹点的外接圆。优先用现有命令组合。[扩展词汇表](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html) |
| 旁心三角形、反补三角形、Gemini 三角形 | 分别用 `Excenters`、逐点反补及 `GeminiTriangle`。Extouch 已有组合，保留为低成本快捷项。其余有编号或短组合的命名三角形先核对等价关系。[三角形索引](https://faculty.evansville.edu/ck6/encyclopedia/IndexOfTrianglesReferencedInETC.html)、[Gemini 表](https://faculty.evansville.edu/ck6/encyclopedia/gemini.html) |

## 实施队列

| 批次 | 现有分类 | 候选签名 → 输出 | 英文描述底稿 |
| --- | --- | --- | --- |
| 首批 | Triangle centers → Point constructions and maps | `Crosssum(A,B,C,P,Q)` → point | Crosssum of P and Q with respect to ABC. |
| 首批 | 同上 | `Crossdifference(A,B,C,P,Q)` → point | Crossdifference of P and Q with respect to ABC. |
| 首批 | 同上 | `AlephConjugate(A,B,C,P,Q)` → point | P-aleph conjugate of Q with respect to ABC. |
| 首批 | Triangle constructions → Circles → Circles of the triangle | `ConwayCircle(A,B,C)` → circle | Conway circle through the six side extensions of ABC. |
| 首批 | 同上 | `DrozFarnyCircles(A,B,C[,i])` → circle × 2／circle | First and second Droz–Farny circles, centered at the orthocenter and circumcenter. |
| 首批 | Triangle constructions → Triangles → Triangles from a point | `HaimovTriangle(A,B,C,P[,i])` → point × 3／point | Haimov triangle of P, formed by the residual intersections of the paired cevian circles. |
| 首批 | 同上 | `CrossCevianTriangle(A,B,C,P,Q[,i])` → point × 3／point | Intersections of the cevians of Q with the corresponding opposite sides of the cevian triangle of P. |
| 后续 | Triangle centers → Point constructions and maps | `BethConjugate(A,B,C,P,Q)` → point | P-beth conjugate of Q with respect to ABC. |
| 后续 | Triangle constructions → Circles → Circles of the triangle | `AdamsCircle(A,B,C)` → circle | Adams circle from the intouch triangle and the Gergonne point. |
| 后续 | 同上，可同时列入参数圆子类 | `TuckerCircle(A,B,C,t)` → circle | Tucker circle starting at the directed affine parameter t on BC. |
| 后续 | Triangle constructions → Triangles → Triangles of the triangle | `ExtouchTriangle(A,B,C[,i])` → point × 3／point | Contacts of the three excircles with their opposite sides. |

## 共轭与点运算

设 `p=(p₁:p₂:p₃)`、`q=(q₁:q₂:q₃)` 为 P、Q 的有向齐次重心，`(a₁,a₂,a₃)=(|BC|,|CA|,|AB|)`。从重心转三线时逐项除以边长，转回重心时逐项乘边长。下式的 i、j、k 按循环取值。

- **Crosssum** 的重心分量为 `aᵢ²(pⱼqₖ+pₖqⱼ)`，可用两个等角共轭的 `Crosspoint` 作独立对照。P=Q 且不在边线时还原 P 的等角共轭。直接多项式在边线及某些顶点仍有有限像。
- **Crossdifference** 将同一式中的加号改为减号，可用直线 PQ 的三线极点再等角共轭作对照。交换 P、Q 只改变总符号，P、Q 沿同一支撑线改变时结果不变。P=Q 时方向缺失，三分量全零。拖动验收应包括同一条线上的重新取点以及过三角形顶点的支撑线。[两项定义与例子](https://faculty.evansville.edu/ck6/encyclopedia/Glossary.html)
- **AlephConjugate** 先在三线坐标中计算。令 P 的三线分量为 u，Q 的三线分量为 v，`Bᵢ=uⱼ²uₖ²(vᵢ+vⱼ)(vᵢ+vₖ)`。第 i 个三线输出为 `−Bᵢ+Bⱼ+Bₖ`。这是 ETC 循环式的因式化形式，对 P 为四次，对 Q 为二次。先乘相应边长再有限化，保留基点全零和无穷远像。对照 X(2)-aleph of X(63) = X(1)，并在一般可逆区域测试两次作用返回原点。[公式](https://faculty.evansville.edu/ck6/encyclopedia/Glossary.html)、[Aleph 对照表](https://faculty.evansville.edu/ck6/encyclopedia/AlephConjugates.html)
- **BethConjugate** 在三线坐标设 `S` 的对角为零、非对角为一，`M=diag(u)S`。以外心 O 的三线向量 o 和无穷远线协向量 `l∞=(a,b,c)` 写中心反射矩阵 `K=2o l∞ᵀ−(l∞·o)I`，计算 `M K adj(M) v`。实现前与 ETC 显式式和 Beth 对照表各核一遍。这样无需反复有限化，且外心反射的有限点映射在等边三角形仍有定义。P 在边上时 M 可降秩，约去符号公共因子后才判断是否存在唯一延拓。[公式](https://faculty.evansville.edu/ck6/encyclopedia/Glossary.html)、[Beth 对照表](https://faculty.evansville.edu/ck6/encyclopedia/BethConjugates.html)

建议复用 `builders/triangle.ts` 的重心映射与齐次内核。Crosssum 和 Crossdifference 可共用一条带符号的循环公式，用户入口保留各自名称。验收 ETC 中心时先核对现有 `TriangleCenter` 对相关编号的覆盖，另用一般点验证代数身份，避免只凭几个中心的巧合放行。

## 圆

- **ConwayCircle** 设内心 I、内切半径 r、半周长 s。以 I 为心、`sqrt(r²+s²)` 为半径。由 A 沿 AB 的反向延长长度 a 后，所得点到 AB 的内切足距离为 `a+(s−a)=s`，其余五点循环同理。可用 `Incenter` 和点到 BC 的距离取得 r，正三角形和镜像用同一式。[Conway 定义](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html#conway-circle)
- **DrozFarnyCircles** 依次输出垂心 H、外心 O 为圆心的两圆，共用半径 `sqrt((|OH|²+R²)/2)`，R 为外接半径。用定义作独立验收。第一圆取以 A 为心、半径 R 的圆与平行 BC 的中位线交点，第二圆取以 BC 中点为心且过 H 的圆与 BC 的交点，另外两侧循环。ETC 扩展词汇表的边线和中点记号与这一构造存在出入，实施用上述有圆心、半径恒等式可核验的版本。第一圆上 `|X−H|²−|X−A|²=(|OH|²−R²)/2`，因为中位线垂直 AH；第二圆半径平方是 `|M−H|²+|M−O|²`，M 为 BC 中点。直接半径式也覆盖中间圆相切、没有实交点或 O=H 的情形，后者保留两个相同的槽。[ETC 条目](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html#droz-farny-circles)、[第一圆定理](https://mathshistory.st-andrews.ac.uk/Extras/Droz-Farny_circle/)、[第二圆的证明](https://fs.unm.edu/ScArt/AboutDrozFarnyCircle.pdf)
- **AdamsCircle** 取 Gergonne 点 G。内切圆在 AB、AC 的切点互为角平分线 AI 的镜像，故对应切点弦垂直 AI。过 G 作该垂线，交 AB 于 X，输出 `Circle(I,X)`。核对其余五点都在圆上。可用向量短式 `X=A+((G−A)·(I−A))/((B−A)·(I−A))·(B−A)`，分母在非退化三角形非零，无需在三组候选点中选择。[Adams 圆定义](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html#adams-circle)
- **TuckerCircle** 固定 ETC 的顺序，起点 `A₁=B+t(C−B)`。令 `u=t b²/c²`、`v=t a²/c²`，两条边上的弦端点为 `A₁, A₂=B+(1−u)(C−B)` 和 `B₁=C+(1−t)(A−C), B₂=C+v(A−C)`。由两弦中点分别作 BC、CA 的垂线，交点为圆心，半径取到 A₁ 的距离。两弦中任一对端点重合时中点及其法向仍在定义中，无需用三点重新定圆。验收 t=0 的外接圆、等边 t=1/2 的内切圆、负参数及外分；按六步平行／反平行作图独立检查余下两点。t 依赖起始边和方向，换序时按新起点的有向比例解释。[Tucker 构造](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html#tucker-circles)

## 派生三角形

- **HaimovTriangle** 设 `b⃗=B−A`、`c⃗=C−A`、`B₂=|b⃗|²`、`C₂=|c⃗|²`。A 槽对应圆 `(A,B,B′)` 和 `(A,C,C′)` 除 A 外的交点，其中 B′、C′ 是 P 的塞瓦迹点。以 A 为局部原点时，两圆的二次项相同，幂差的两个线性系数均含 `p₁`。约去该公共因子并清分母，取方向 `v=C₂(p₁+p₂)b⃗+B₂(p₁+p₃)c⃗`，输出 `A+B₂ C₂ (p₁+p₂+p₃)v/|v|²`。P 穿过 BC 时照用此式，避免中间两圆重合；塞瓦迹点到无穷远也无需先造点。v=0 时没有有限的唯一交点。另两槽循环。以一般位置的两圆版 `SecondIntersection` 对照，并测 P 在边线、顶点、反补顶点及外点。[Haimov 定义](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html#haimov-triangle)
- **CrossCevianTriangle** A 槽是 Q 的 A-塞瓦线与 P 的塞瓦三角形对边之交。P 的对边在重心中系数为 `(−p₂p₃,p₁p₃,p₁p₂)`，Q 的 A-塞瓦线为 `(0,q₃,−q₂)`。叉积给 `(p₁(p₃q₂+p₂q₃):p₂p₃q₂:p₂p₃q₃)`。P=Q 且各分量非零时简为 `(2p₁:p₂:p₃)`。P、Q 一般不可交换；若叉积全零，该槽没有唯一交点。对照用现有 `CevianTriangle` 生成 P 的两个相邻顶点，再与 AQ 求交。[Cross-cevian 定义](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html#cross-cevian-triangle)
- **ExtouchTriangle** A 槽取 `B+(s−c)(C−B)/a`，余槽循环。用关于边中点反射对应内切点作对照，避免先计算近共线时可能很远的旁心。BC 两端合并时该槽有共同端点的唯一极限，可在零边长的输出处补上。[Extouch 条目](https://faculty.evansville.edu/ck6/encyclopedia/IndexOfTrianglesReferencedInETC.html#extouch)

## 暂缓

- **PolarConjugate** 先复用 `Isoconjugate(A,B,C,G,H,P)`，G、H 分别为重心与垂心。极圆在重心中的对角二次型是 `diag(S_A,S_B,S_C)`，其中 `S_A=(B−A)·(C−A)`，其余循环。其对极与三线极线组合后，倒数权为 `(S_B S_C,S_C S_A,S_A S_B)`，即垂心的齐次重心。若以后增加 `PolarCircle`，可用 `|X−H|²−(H−A)·(H−B)=0` 连续覆盖实圆、点圆和无实点三种情况，先核定原生 conic 在急角配置的可用性。[Polar circle 与 polar conjugate](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html#polar-circle)
- **Napoleon、Vecten、Morley 和其它目录三角形** 先按三角形索引及已收录的 Gemini 配方核重。Napoleon 与 Vecten 可共同研究边中点沿法向按边长比例偏移的参数族；内外约定要与镜像一致，越过参考三角形共线时应记录何处方向无唯一延拓。
- **Cocevian、更多字母共轭和中心函数接口** 等定义对应核定后再定签名。以 cocevian 为例，两份词汇表给出的构造不同，应明确选哪一项并检验等价关系，避免同名覆盖。中心函数入口需先处理公式尺度与可用函数表达式，仍优先用现有编号配方。[词汇表](https://faculty.evansville.edu/ck6/encyclopedia/Glossary.html)、[扩展词汇表](https://faculty.evansville.edu/ck6/encyclopedia/ext_glossary.html)

## 验收顺序

1. 先用词汇表、专表和三角形索引定名与参数次序，检查规范名、别名及原生重载冲突。多输出的圆和三角形分别验收槽位与编号。
2. 离线对照原定义和短式。覆盖一般钝角、直角、等腰、等边、外点与大坐标平移。对 P、Q 穿过边线的轨迹，验证有唯一极限的情形不受中间除零影响。齐次全零或无穷远像按既有约定处理。
3. 实机核对 GeoGebra 输出类、独立选择、拖动、导出重开与辅助对象清理。构造优先复用既有命令和 `bind`，数值计算留在 GeoGebra。用耗时数据决定复杂式是否需要现有命名中间量机制。
