# TriangleCenter：批量性质多数与待核验几何

2026-11-03。按用户授权，优先采用多数可解析性质相容的位置，文字几何定义的独立核验单列待办。当前正式库 70,162 条，未覆盖 41；本轮重点是修正已有点的位置。

首批审阅 778 点（历史差异、标题提示、未覆盖点及其选中上游），先修 13 个根节点，再重新投票；另外 6 个下游差异随之消失，无需增加种子。发布后并集复查 808 点，没有新增可自动采纳的变更或种子冲突。37 个旧点的两样本位置改变：35 个由不符打印坐标变为符合，2 个缺少可直接解析坐标但多数性质相符；没有原先符合而新增失配、覆盖退出或样本类型变化。

## 本轮采用的 13 个根节点

权重已合并同一直线、同输入性质、坐标变体及共享选中上游的证据；目标自身下游不投票。下表为采用前的审阅快照。“次选上界”取已枚举次选得分与未枚举候选保守上界的较大值。权重和比例不代表数学证明或概率。

| 点 | 原构造 | 采用构造 | 支持/总权重 | 次选上界 |
| --- | --- | --- | --- | --- |
| 21910 | `21910 J 154 511 523 4855` | `21910 J 154 511 523 4885` | 4/5 | 2 |
| 25408 | `25408 R 24650 13414` | `25408 R 24651 13415` | 6.75/7 | 1.5 |
| 31608 | `31608 M 5 5` | `31608 M 3 14867` | 10/11 | 3.5 |
| 34367 | `34367 J 2 249 14559 24875` | `34367 J 2 249 14559 24975` | 2.5/3 | 1.5 |
| 38941 | `38941 A 101` | `38941 J 1 7 2 514` | 40/41 | 3 |
| 72140 | `72140 M 41314 71890` | `72140 J 75 244 514 661` | 18.5/20 | 3.5 |
| 72141 | `72141 C 71892` | `72141 J 2 668 10 63508` | 22/23 | 3 |
| 72147 | `72147 C 71897` | `72147 J 1 2229 2 668` | 34/36 | 4 |
| 72150 | `72150 C 71900` | `72150 J 2 668 6 43` | 34/37 | 5 |
| 72152 | `72152 C 71903` | `72152 J 1 7275 2 668` | 34/35 | 3 |
| 72160 | `72160 R 71931 17123` | `72160 J 1 312 2 3996` | 144.6/150 | 8.528 |
| 72780 | `72780 R 100 1` | `72780 A 14027` | 22/23 | 4.433 |
| 72968 | `72968 R 72498 34590` | `72968 J 1 901 244 513` | 54.5/59 | 15 |

只在 seeds 固定这 13 项。31748、46166、51406、72418、72479、73060 通过正确上游重新获得相容位置；正常构建仍可选择另一种相容构造。13 项批量种子的注释明确保留“多数性质暂定”身份，后续几何核验可继续修订。

## 仍待独立核验的文字几何定义与坐标

对全部 37 个位置变化点检查标题，得到以下 12 项。它们当前构造、打印坐标及可解析性质均相容；这里暂缓的是独立几何构造的核验。全部 12 项的批量审阅状态为 confirmed，下表保留证据数量，便于区分 2/2 与 40/40 的证据规模。对应 cyclic B 坐标在后面的附录中完整列出，S 仍为两倍面积。

| 点 / ETC 定位 | 需要核验的几何定义 | 当前构造 | 支持/总权重 |
| --- | --- | --- | --- |
| [X(31731)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart16.html#X31731) | CENTER OF THE ORTHOPOLAR CIRCLE OF THESE TRIANGLES: ABC-X3 REFLECTIONS AND CIRCUMSYMMEDIAL | `31731 R 18440 31742` | 9/9 |
| [X(31733)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart16.html#X31733) | CENTER OF THE ORTHOPOLAR CIRCLE OF THESE TRIANGLES: CIRCUMORTHIC AND CIRCUMSYMMEDIAL | `31733 R 5562 31608` | 3/3 |
| [X(31739)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart16.html#X31739) | CENTER OF THE ORTHOPOLAR CIRCLE OF THESE TRIANGLES: 1st ANTI-CIRCUMPERP AND CIRCUMSYMMEDIAL | `31739 R 52 31608` | 5/5 |
| [X(31740)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart16.html#X31740) | CENTER OF THE ORTHOPOLAR CIRCLE OF THESE TRIANGLES: 1st CIRCUMPERP AND CIRCUMSYMMEDIAL | `31740 R 946 31608` | 7/7 |
| [X(31741)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart16.html#X31741) | CENTER OF THE ORTHOPOLAR CIRCLE OF THESE TRIANGLES: 2nd CIRCUMPERP AND CIRCUMSYMMEDIAL | `31741 R 10 31608` | 5/5 |
| [X(31748)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart16.html#X31748) | CENTER OF THE ORTHOPOLAR CIRCLE OF THESE TRIANGLES: CIRCUMMEDIAL AND CIRCUMSYMMEDIAL | `31748 J 4 575 597 14856` | 4/4 |
| [X(31820)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart16.html#X31820) | CENTER OF THE ORTHOPOLAR CIRCLE OF THESE TRIANGLES: ASCELLA AND CIRCUMSYMMEDIAL | `31820 F 353:3 31793:-1` | 2/2 |
| [X(31826)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart16.html#X31826) | CENTER OF THE ORTHOPOLAR CIRCLE OF THESE TRIANGLES: CIRCUMSYMMEDIAL AND INNER-GARCIA | `31826 F 353:3 15071:-1` | 2/2 |
| [X(31827)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart16.html#X31827) | CENTER OF THE ORTHOPOLAR CIRCLE OF THESE TRIANGLES: CIRCUMSYMMEDIAL AND X3-ABC REFLECTIONS | `31827 R 550 31608` | 5/5 |
| [X(31959)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart16.html#X31959) | ORTHOCENTER OF THE 2nd BROCARD TRIANGLE | `31959 M 69 31962` | 8/8 |
| [X(35890)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart18.html#X35890) | X(4)-OF-MOSES-STEINER REFLECTION TRIANGLE | `35890 R 31959 35707` | 4/4 |
| [X(61673)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart31.html#X61673) | CENTROID OF THE PEDAL TRIANGLE OF X(103) | `61673 R 51406 2` | 40/40 |

其中九项是 circum-symmedial 相关的 orthopolar circle 圆心族；可优先选择该族的一两个代表核验，再判断是否需要整族审查。31959、35890、61673 分别是第二 Brocard 三角形垂心、Moses–Steiner reflection triangle 的 X(4)、X(103) 踏足三角形重心。当前暂定位置使用多数性质；尚未用这些文字定义重新独立作图。

## 多数仍不足以决定的 9 项

保持当前状态，不强改坐标，不增加 SKIP/nonreal。18131/34419 虽有 1.67/2 的折算支持，但尚不足两份完整独立票；其余未形成严格多数。没有有限候选、部分样本无定义和性质冲突在 JSON 中分开记录。

| 点 | 标题 / 定义 | 最高支持/总权重 | 暂缓原因 |
| --- | --- | --- | --- |
| [X(18131)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart10.html#X18131) | X(226)X(14597)∩X(1445)X(15487) | 1.667/2 | 共享上游降重后支持不足 |
| [X(32472)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart17.html#X32472) | X(2)X(8644)∩X(3)X(9489) | 2/21 | 没有严格多数 |
| [X(34307)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart18.html#X34307) | (name pending) | 1/2 | 没有严格多数 |
| [X(34419)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart18.html#X34419) | X(3)X(3648)∩X(46)X(16553) | 1.667/2 | 共享上游降重后支持不足 |
| [X(34575)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart18.html#X34575) | (name pending) | 1/2 | 没有严格多数 |
| [X(34863)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart18.html#X34863) | (name pending) | 1/2 | 没有严格多数 |
| [X(40473)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart21.html#X40473) | CENTER OF THE (X(75),X(512))-CEVAPOINT CONIC | 1/2 | 没有严格多数 |
| [X(40497)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart21.html#X40497) | CENTER OF THE (X(10),X(522))-CEVAPOINT CONIC | 1/2 | 没有严格多数 |
| [X(55092)](https://faculty.evansville.edu/ck6/encyclopedia/ETCPart28.html#X55092) | (name pending) | 1/2 | 没有严格多数 |

32472 的最高候选仅获 2/21，不足以相信任一当前位置；需继续定位条目或上游的不一致。34307、34575、34863、40473、40497、55092 主要是可解析坐标与线表的对立，当前没有多数。40473/40497 这类 conic center 的文字几何可由独立构造提供新的裁决依据。

## 方法与复现

工具为 `scripts/geogebra/tools/triangle_centers/triangle_center_consensus.py`，只读运行时与 seeds，输出报告及可失效的位置缓存。`--settle` 只在内存更新根节点，保留正常图预算、输入类型和已有样本可定义性，再对下游重投票；写入正式数据仍通过 seeds 和正常 build。

典型入口：

```sh
python scripts/geogebra/tools/triangle_centers/triangle_center_consensus.py --from-report .cache/triangle-centers/reports/uncovered/uncovered-consensus.json --from-report .cache/triangle-centers/reports/reviews/consensus-final-comparison.json --upstream --settle --report .cache/triangle-centers/reports/reviews/consensus-next.json --markdown .cache/triangle-centers/reports/reviews/consensus-next.md
```

每个依赖连通证据组总权重不超过 1；同一坐标族的数值相同变体先合并。一个候选须严格超过一半权重、支持至少 2、比次选/未枚举上界至少多 1，才作为建议。当前 seeds 与本轮暂定锁定值不被自动覆盖。这里的独立性是选中 DAG 的来源独立性，不声称 ETC 性质数学独立。

先评价现有构造和坐标；若入射支持已超过任何其它点的保守上界，可跳过剩余线对。界中把各样本近似平行线的全部权重都算作可能共享支持，确保保守；无法支配时继续完整枚举。共享端点的线对也参与，可构成已有点的别名。位置确定后，只需找到一个可用的简洁构造，不追求最优路径。初批潜在线对 1,314,674，实际搜索 3,431；另外少量线对用于构造已经确定的位置。报告将搜索计数与构造计数分列。

位置缓存位于 `.cache/triangle-centers/review-cache/coordinates/`，以实际运行时配方、atlas、原生方向和数值实现为键；不缓存投票或选择。源性质、权重和依赖改变后仍重新审阅。初批冷缓存约 49 秒，同输入缓存命中约 15 秒；发布后的并集复查约 11 秒。此计时不代表一般算法的受控性能对照。

证据（相对 `.cache/triangle-centers/`）：`reports/reviews/consensus-settled.json` 保留采用前票据与内存修复轮次；`consensus-final-union.json` 为发布后 808 点复查；`consensus-pending-geometry.json` 为 12 点补充审阅；`consensus-final-comparison.json` 为全量位置/类型对照。日志在 `runs/consensus/`。

## 待核验几何点的坐标附录

各行 `B` 是循环重心坐标首项：f(a,b,c):f(b,c,a):f(c,a,b)。以下来自工作区源快照，供与独立几何定义比较。

### X(31731)

```text
31731 B 8*a^10-21*(b^2+c^2)*a^8+(10*b^4+13*b^2*c^2+10*c^4)*a^6+(b^2+c^2)*(5*b^4+4*b^2*c^2+5*c^4)*a^4-(b^4-c^4)*(b^2-c^2)*(b^2-2*c^2)*(2*b^2-c^2)
```

### X(31733)

```text
31733 B (SB+SC)*((36*R^2-9*SW)*S^4+(6*R^2*(18*R^2*SA-21*SA*SW-SW^2)+(9*SA^2+18*SA*SW-SW^2)*SW)*S^2-(4*R^2-SA-2*SW)*SA*SW^3)
```

### X(31739)

```text
31739 B (SB+SC)*(9*(-SW+2*R^2)*S^4+(216*SA*R^4-6*(9*SA^2+15*SA*SW-SW^2)*R^2+(9*SA^2+18*SA*SW-SW^2)*SW)*S^2-(8*R^2-SA-2*SW)*SA*SW^3)
```

### X(31740)

```text
31740 B a*(8*a^6+12*(b+c)*a^5-6*(b^2+c^2)*a^4-12*(b+c)*(b^2+c^2)*a^3-3*(b+c)*(2*b^4+b^2*c^2+2*c^4)*a-2*(2*b^2-c^2)*(b^2-2*c^2)*(b^2+c^2))
```

### X(31741)

```text
31741 B a*(8*a^9-4*(b+c)*a^8-2*(13*b^2-4*b*c+13*c^2)*a^7+2*(b+c)*(5*b^2-4*b*c+5*c^2)*a^6+3*(b+c)*(4*b^2-3*b*c+4*c^2)*a^4*b*c+6*(5*b^4+5*c^4-2*(b^2-b*c+c^2)*b*c)*a^5-(10*b^6+10*c^6+3*(4*b^4+4*c^4-(9*b^2-2*b*c+9*c^2)*b*c)*b*c)*a^3-(b+c)*(10*b^6+10*c^6-3*(4*b^4+4*c^4-(b-c)^2*b*c)*b*c)*a^2-(2*b^6+2*c^6-3*(4*b^2+3*b*c+4*c^2)*(b-c)^2*b*c)*(b+c)^2*a+2*(b^4-c^4)*(b-c)*(b^2-2*c^2)*(2*b^2-c^2))
```

### X(31748)

```text
31748 B 3*(36*R^2-7*SW+3*SA)*S^4-9*(12*R^2-SW)*(SB+SC)*SA*S^2-4*SB*SC*SW^3
```

### X(31820)

```text
31820 B a*(4*(b+c)*a^11-4*(b^2-4*b*c+c^2)*a^10-2*(b+c)*(7*b^2-4*b*c+7*c^2)*a^9+2*(7*b^4+7*c^4-6*(6*b^2-b*c+6*c^2)*b*c)*a^8+(b+c)*(10*b^4+10*c^4-(20*b^2-29*b*c+20*c^2)*b*c)*a^7-(10*b^6+10*c^6-(140*b^4+140*c^4+(b^2+20*b*c+c^2)*b*c)*b*c)*a^6+2*(b+c)*(5*b^6+5*c^6-3*(b^2-3*b*c+c^2)*b^2*c^2)*a^5-2*(5*b^8+5*c^8+(40*b^6+40*c^6+(2*b^4+2*c^4-3*(21*b^2-4*b*c+21*c^2)*b*c)*b*c)*b*c)*a^4-(b+c)*(14*b^6+14*c^6-(20*b^4+20*c^4+(3*b^2-14*b*c+3*c^2)*b*c)*b*c)*(b^2+c^2)*a^3+(14*b^10+14*c^10-(12*b^8+12*c^8+(15*b^6+15*c^6-(42*b^4+42*c^4-(7*b^2+108*b*c+7*c^2)*b*c)*b*c)*b*c)*b*c)*a^2+2*(b^4-c^4)*(b^2+c^2)*(b-c)*(b^2-2*c^2)*(2*b^2-c^2)*a-2*(b^4-c^4)*(b^2-c^2)*(b-c)^2*(b^2-2*c^2)*(2*b^2-c^2))
```

### X(31826)

```text
31826 B a*(4*(b+c)*a^11-4*(b+c)^2*a^10-2*(b+c)*(7*b^2-6*b*c+7*c^2)*a^9+2*(7*b^4+7*c^4+(13*b^2+2*b*c+13*c^2)*b*c)*a^8+(b+c)*(10*b^4+10*c^4-(30*b^2-37*b*c+30*c^2)*b*c)*a^7-(10*b^6+10*c^6+(2*b^2-3*b*c+2*c^2)*(15*b^2+16*b*c+15*c^2)*b*c)*a^6+(b+c)*(10*b^6+10*c^6-9*(2*b^2-3*b*c+2*c^2)*b^2*c^2)*a^5-(10*b^8+10*c^8-(10*b^6+10*c^6+(8*b^4+8*c^4-9*(3*b^2+2*b*c+3*c^2)*b*c)*b*c)*b*c)*a^4-(b+c)*(14*b^8+14*c^8-(30*b^6+30*c^6-(23*b^4+23*c^4-9*(b^2+c^2)*b*c)*b*c)*b*c)*a^3+(14*b^8+14*c^8+(30*b^6+30*c^6+(23*b^4+23*c^4+9*(b^2+c^2)*b*c)*b*c)*b*c)*(b-c)^2*a^2+2*(b^3+c^3)*(b-c)^2*(b^2+c^2)*(b^2-2*c^2)*(2*b^2-c^2)*a-2*(b^4-c^4)^2*(2*b^2-c^2)*(b^2-2*c^2))
```

### X(31827)

```text
31827 B 9*(18*R^2-5*SW+SA)*S^4-3*(63*(SB+SC)*R^2+SW*(15*SA-16*SW))*SA*S^2-7*SB*SC*SW^3
```

### X(31959)

```text
31959 B 9*(6*R^2-SW)*(SA+SW)*S^4-(SB+SC)*(54*R^2*SA+SW^2)*SW*S^2-2*SB*SC*SW^4
```

### X(35890)

```text
35890 B 9*(3*R^2-SW)*(SA+SW)*S^4-(162*(SA-SW)*SA*R^4-3*(54*SA^2-57*SA*SW-SW^2)*SW*R^2+(36*SA^2-37*SA*SW-3*SW^2)*SW^2)*S^2+6*(R^2-SW)*SB*SC*SW^3
```

### X(61673)

```text
61673 B (b-c)^2*(a^2-3*b^2-2*b*c-3*c^2+2*a*(b+c))
```
