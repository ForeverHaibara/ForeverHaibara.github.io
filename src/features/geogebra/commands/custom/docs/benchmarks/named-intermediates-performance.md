# 命名中间量原生性能记录（2026-10-29）

本文件合并首轮、第二阶段和 High 阶段的筛选记录。表中单次浏览器样本与下文首轮交错运行中位数**方法不同，不宜直接横向比较**；均未覆盖完整页面的绘图帧、自动保存、内存和文件体积。

## 目的与方法

首轮评估是否值得给自定义工具增加命名非几何中间量选项；当时只增加可重复运行的基准页，尚未改正式执行路径。后续阶段已实施 Low／Medium／High，当前白名单见 [主文档](../named-intermediates-implementation.md)。

在嵌入式 GeoGebra Classic 中比较三种表达式：

1. **现状**：所有 `bind()` 都是单行 `Element(Zip(...),1)`。
2. **共享列表**：只把一份完整的列表表达式建成一个工作区对象，内部仍用 `Element/Zip`。
3. **逐层命名**：把 `bind()` 中的数值／列表（`Pretangential` 还包括函数）逐层建成依赖对象，最终输出引用它们，不再通过匿名单元素 `Zip` 传值。

创建计时包括所有辅助对象和最终对象的原生命令执行。更新计时包括修改输入及读取最终对象的 `getValueString`；不包括完整绘图帧、代数栏渲染或人工拖动延迟。每种方案先预热，再按交错顺序各测两次创建和每次三次更新。每次重建构造。以下为这台机器的本次中位数，样本量很小，不代表跨设备速度。

| 工具与方案 | 创建 | 更新 | 辅助对象 |
|---|---:|---:|---:|
| `Conic(f,g,h,j,k)` 现状 | 921 ms | 828 ms | 0 |
| `Conic` 共享整个系数列表 | 939 ms | 830 ms | 1 个列表 |
| `Conic` 逐层命名 | **32 ms** | **1.2 ms** | 36 个数值 |
| `Pretangential(W,X,1)` 现状 | 993 ms | 654 ms | 0 |
| `Pretangential` 逐层命名 | **133 ms** | **13 ms** | 93 个数值／列表／多变量函数 |
| `QACu1Inv(A,B,C,P)` 现状 | 676 ms | 368 ms | 0 |
| `QACu1Inv` 共享系数列表 | 658 ms | 375 ms | 1 个列表 |
| `QACu1Inv` 逐层命名 | 628 ms | 390 ms | 8 个数值／列表 |

`Conic` 是五条切线输入，线 `f` 由数值 `shift` 控制。逐层命名的六个圆锥曲线系数在初始状态及三次输入变化后都与现状成比例，且确实随 `shift` 改变。`Pretangential` 测试的是第一输出分支；由 `shape` 控制输入三次曲线，四个状态下输出点坐标与现状在 `1e-5` 内相同。`QACu1Inv` 的三次更新后方程文本与现状逐字相同。逐层命名方案还核对了实际创建的辅助对象数及 GeoGebra 对象类型，没有产生点、直线或曲线辅助对象。

`QLQu3(A,B,C,D)` 也尝试了现状与共享列表对照；现状第一次求值即使浏览器长时间无响应，未取得可靠计时。这与既有记录中该工具容易卡死的现象一致，不能从此次超时推出命名方案的改善幅度。该工具内部还绑定了点值，若严格只允许非几何辅助对象，不能直接把所有匿名绑定机械地写入工作区。

## 判断

**值得继续做选择性原型。** 对五切线 `Conic` 和 `Pretangential`，逐层命名的收益远高于测试噪声；单纯把现有嵌套表达式装进一个列表对象几乎没有收益。`QACu1Inv` 已经用较短的七系数式，继续命名中间量没有稳定改善，因此不宜对全部工具统一启用。

正式方案至少需要处理辅助标签命名、隐藏、删除／重定义联动、撤销和 `.ggb` 保存恢复；还应确认发现算法确实忽略数值、列表和函数对象。`Pretangential` 的结果依赖允许多变量函数辅助对象；若开关只允许数值／列表，它的这组结果不能直接套用。实验没有测试 CAS 中间变量，也没有测渲染帧耗时或多工具叠加后的构造规模。

复现入口：`/scripts/geogebra/browser/verification.html?page=smoke&suite=materialization&tool=conic`、`tool=pretangential`、`tool=inverse`。基准实现见 `scripts/geogebra/browser/geogebra-materialization-performance.ts`。执行两次构造、三次输入更新后会自动检查结果等价性和辅助对象类型。

## 第二阶段：Medium 筛选

以下使用 `geogebra-named-execution-smoke.ts` 在同一输入上分别运行匿名与命名路径；表中是单次浏览器样本，创建时间含辅助对象与输出，更新时间含设置输入与读取结果。输出原生类型、定义状态、显示方程及动态更新均做了对照。

| 候选重载 | 匿名／命名创建 | 匿名／命名更新 | 结论 |
|---|---:|---:|---|
| 三次曲线 `OrthicAxis(F)` | 89／41 ms | 12／8 ms | 已启用；退化样本一致 |
| `Poloconic(l,F)` | 423／279 ms | 36／10 ms | 已启用；退化与线段输入一致 |
| 方向约束 `CircularCubic(A,B,C,D,E,F,l)` | 418／257 ms | 40／7 ms | 已启用；线段输入一致 |
| 七点 `NodalCubic` | 774／656 ms | 337／33 ms | 已启用 |
| 五点 `NodalCubic` | 496／419 ms；另一次 741／747 ms | 341／56 ms | 已启用；创建收益有波动 |

`ThirdIntersection`、`CircularPolarPoint`、`CayleyBacharachPoint` 的候选曾把点输出变为向量；`CircularPolarPoint` 还改变一个样本的定义状态。三次曲线 `Polar(P,F)` 在退化输入上与匿名执行语义不同。`CubicPencil` 创建约 125→171 ms，`PivotalCubic` 约 466→3019 ms，`NonpivotalCubic` 约 575→4700 ms。这些候选均未启用。数值或函数型 `bind()` 不能单独保证结果类型、执行语义或性能。

## High 阶段：多输出共享与回退

复现入口为 `?suite=named-execution&tool=commonTangents`（编号）、`commonTangentsMulti`（无编号）及 `commonTangentsCrossed`（交叉）；仍是单次浏览器筛选样本。

| 工具与样本 | Low 创建 | High／候选创建 | Low 更新 | High／候选更新 | 结论 |
|---|---:|---:|---:|---:|---|
| `CommonTangents(c1,c2,1,1)`，共享前 | 100.8 ms | 47.3 ms，28 个辅助对象 | 19.9 ms | 0.9 ms | 结果一致，但前置量重复 |
| `CommonTangents(c1,c2,1,1)`，共享后 | 44.7 ms | 22.9 ms，19 个辅助对象 | 8.9 ms | 0.8 ms | 已启用 High |
| `CommonTangents(c1,c2,1)`，双输出 | 38.2 ms | 19.1 ms，19 个辅助对象 | 11.1 ms | 1.2 ms | 已启用 High |
| `CommonTangents(c1,c2,-1)`，交叉双输出 | 42.2 ms | 20.2 ms，19 个辅助对象 | 10.2 ms | 1.0 ms | 已启用 High |
| `QACu1(A,B,C,D)`，逐层数值命名 | 332.1 ms | 3132.4 ms，11 个辅助对象 | 154.0 ms | 148.0 ms | 回退匿名 |
| `OrthopivotalCubic(A,B,C,P)`，逐层数值命名 | 255.4 ms | 2076.4 ms，8 个辅助对象 | 131.5 ms | 135.5 ms | 回退匿名 |

`CommonTangents` 的两个圆心为点，因此它的整体命名方案属于 High；无编号两条线共用前置辅助对象。实机核对两个结果标签、原生 `line` 类型、创建及拖动后的显示方程、辅助对象隐藏与 XML auxiliary 标记、关系图收缩、`.ggb` 导出重开和删除输出后的孤儿清理。`QACu1` 与 `OrthopivotalCubic` 候选全部为非几何值，理论上属于 Medium，但创建显著退步，正式白名单未启用。

### `QLQu3`：High 可用性验证

Low 匿名基线多次使浏览器求值长时间无响应；按本轮约定视为无限时基线，不再为对照而运行。`QLQu3(A,B,C,D)` 的完整绑定链含一个中心向量、四个归一化向量及数值／列表，因此当前全物化机制下只适用于 High，Medium 仍保持匿名。两组一般位置样本中，High 分别约 5.39 s 和 5.47 s 创建 55 个辅助对象及有定义的原生 `implicitpoly`，输入变化后约 48–51 ms 更新且方程变化。代表性更新后方程含 `x⁴` 与 `y⁴` 项。测试还检查全部辅助对象隐藏和 XML auxiliary 标记、关系图收缩、`.ggb` 导出重开、删除输出后的孤儿清理。静态代数测试已将九项径向系数与独立完整共轴行列式在多组数值输入上比较。

这足以证明 High 在所测一般位置能代替不可用的 Low，**不表示 Low 的精确耗时或全域语义已测得**。退化输入、整页拖动与自动保存、文件体积和多条四次曲线叠加成本仍需继续测；若出现不合格重载，应缩小策略或选择性物化。

### `PrehessianCubic` 与 `CuspidalCubic`：此前卡顿候选的命名实现

复现入口为 `?suite=named-execution&tool=prehessianMulti`、`cuspidalGeneral`、`cuspidalCircularMulti`、`cuspidalDirection`。以下均为一次性原生引擎样本，创建时间含辅助对象与输出，更新时间含参数设置与读取；不据此估算 Low 的精确加速比。此前内联 `PrehessianCubic` 和两种 `CuspidalCubic` 原型会卡顿，故没有再运行 Low 对照。

| 样本 | 档位 | 创建 | 更新 | 辅助对象 | 核验 |
|---|---|---:|---:|---:|---|
| `PrehessianCubic(F)` 三槽 | High | 4.44–5.77 s | 47–50 ms | 46 | 输出 Hessian 与 F 成非零比例；三槽、文件重开与清理通过 |
| 一般六点 `CuspidalCubic` | Medium | 4.18 s | 102 ms | 18 | 六点关联、A 处切锥判别式为零，文件重开与清理通过 |
| 圆环四点 `CuspidalCubic` 双槽 | Medium | 1.92 s | 59 ms | 14 | 两条不同实曲线，点关联与切锥条件通过 |
| 两点加方向 `CuspidalCubic` | Medium | 2.00 s | 63 ms | 14 | 有定义三次曲线及点关联通过 |

这两类工具共用现有 `bind` 捕获和隐藏辅助对象生命周期；测试还检查 XML auxiliary 标记、图形隐藏和本站依赖图收缩。`CuspidalCubic` 当前用固定枢轴行列式生成核；枢轴奇异但整体约束满秩的输入可能返回 undefined。`PrehessianCubic` 的重根、Hessian 恒零及射影无穷远退化尚未系统扫描。多条曲线叠加时的页面交互、文件体积及真实用户输入分布仍待测。
