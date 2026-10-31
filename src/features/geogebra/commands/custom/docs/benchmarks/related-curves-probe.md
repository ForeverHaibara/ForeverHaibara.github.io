# Related Curves：规划阶段原生实验

日期：2026-10-29。对应 [接入计划](../related-curves-roadmap.md)。这是可行性和候选后端实验，不是生产命令实现，也不是全部高次曲线性能承诺。

## 复现

仓库根目录运行 `npm run dev -- --host 127.0.0.1`，打开下列独立页面并点击 **Run probe**：

```text
/scripts/geogebra/browser/geogebra-related-curves-probe.html?q=12&variant=direct
/scripts/geogebra/browser/geogebra-related-curves-probe.html?q=12&variant=triangle
/scripts/geogebra/browser/geogebra-related-curves-probe.html?q=39&variant=direct
/scripts/geogebra/browser/geogebra-related-curves-probe.html?q=39&variant=triangle
```

配套 `geogebra-related-curves-probe.ts` 没有导入到正式页面，没有改动 library.json 或 builder 注册表。另预留 `variant=bound` 供后续比较，但本轮未据此得出结论。

环境：Windows、ChatGPT 内嵌浏览器，UA 报告 Chrome 156，实际 GeoGebra `getVersion` 返回 **5.4.920.0**；不能以项目配置 `GEOGEBRA_MIN_VERSION='6.0'` 代替真实版本。浏览器 viewport 为 450×567，画布外容器固定高 480、最大宽度为页面可用宽度，坐标范围 x∈[-2,8]、y∈[-2,6]。窄画布数据必须在完整工作区／较宽画布重新验证。没有收集硬件型号，不宣称跨设备可比。

每个变体一次 warmup、不计入统计；随后三次独立重建，每次八次移动 C，共 24 次更新。输入 A=(0,0)、B=(6,0)、C=(1,4)，依次移动 C 到 (1.2,3.8)、(0.8,4.2)、(1.4,4.1)、(1,4)，重复两轮。创建包括命令解析与原生求值；triangle 变体的三条数值辅助赋值也在创建计时内。

API 计时到 executeCommand／setCoords 返回；另记录随后两次 requestAnimationFrame 的耗时，作为绘制机会的近似，不能等同严格像素绘制完成或连续手拖帧率。每次更新后另检查 defined 和显示方程是否改变；检查本身不计入 API 时间。

初版实验曾让画布直接以 body 为尺寸参照，触发内容增高与 ResizeObserver 的尺寸反馈，相关计时全部丢弃。修正为固定尺寸的独立父容器后重新运行；Q012 有效样本开始前已显示实验浏览器，避免把后台节流混入有效样本。

## 方程与正确性检查

Q012（Stothers quintic）采用

```text
Σ_cyclic a²(v-w)(u²-vw)vw = 0
```

来源：[Gibert, Simmons conics, Forum Geometricorum 6 (2006), p.219](https://www.bernard-gibert.fr/files/Resources/volume6b.pdf)，并以 [Table 28](https://bernard-gibert.fr/Tables/table28.html) 的点与族信息交叉核对。`direct` 将 u/v/w 换为现有 `barycentricVariables` 的有向二倍面积线性式，边长平方保留动态 `Distance`；`triangle` 创建 aa=a²、bb=b²、cc=c²，再传入原生 TriangleCurve 的重心方程。后者使用了三个可见实验辅助数值，不是已验证的生产命名中间量 lowering。

Q039 采用 [原页面给出的紧凑六次式](https://www.bernard-gibert.fr/curves/q039.html)：令 `S_A=(b²+c²-a²)/2`，循环定义 S_B/S_C，`D_A=c²v²-b²w²`，则

```text
4uvw Σ_cyclic (a²S_A-S_BS_C)u D_A + D_A D_B D_C = 0
```

检查范围：原生输出 XML 为 implicit 类型；方程随 C 改变；Q012 的 X(2)、X(6)、X(13)、X(14)，Q039 的 X(1)、X(13)、X(14)、X(15)、X(16) 为候选关联点；五个离曲线网格点用于检查非零量级；导出 `.ggb`、重开，再次移动 C 检查依赖。诊断函数和中心点在性能采样结束后才创建。

本轮残差以五个网格点函数值的最大绝对值作归一化；这不是正式数学验证所需的单项式贡献归一化，也没有证明这些点足以唯一确定曲线。三次创建、24 次更新仅为探索样本，p95 的统计稳定性有限。尚未完成符号等价证明、全部退化、平移／缩放与连续拖动测试。

## 已核实结果

Q012、Q039 的两条路径均通过上述点关联、动态性、非零控制、原生类型和导出重开检查。

| 曲线／后端 | 命令字符数 | 创建中位数 | 更新中位数 | 更新 p95 | 更新含帧等待中位数 | 更新含帧等待 p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Q012 / direct | 1188 | 717.1 ms | 703.3 ms | 739.2 ms | 713.2 ms | 751.1 ms |
| Q012 / native TriangleCurve + 3 numbers | 206 | 204.1 ms | 153.9 ms | 166.3 ms | 166.4 ms | 182.1 ms |
| Q039 / direct | 1834 | 1336.8 ms | 1308.5 ms | 1351.4 ms | 1318.1 ms | 1365.6 ms |
| Q039 / native TriangleCurve + 3 numbers | 489 | 1130.5 ms | 808.6 ms | 871.9 ms | 822.0 ms | 886.0 ms |

这组样本中原生重心后端创建约减少 72%、更新约减少 78%。可行性成立，但约 154 ms 的离散更新仍不能称为流畅连续拖动；应继续比较稀疏系数与可安全复用的绑定。不能以此推断所有曲线都应改用原生 TriangleCurve。

Q039 换为原生后端后创建只减少约 15%、更新约 38%，仍需约 809 ms 一次更新。没有卡死，但不适合作为未经优化的默认批量交互路径，下一阶段应研究稀疏系数和更简洁的等价构造，未达到预算前暂缓默认发布。这也是不能以 Q012 的收益推广全部目录的实际反例。

Q012 direct 性能结束时只有 A、B、C、out 四个对象；native 变体多 aa、bb、cc 三个数值。诊断后导出的文件约 4845／4810 字节，包含额外诊断函数与点，因此不能作为纯曲线文件大小的严格比较。

本轮另实测 `TriangleCenter`：3053 已定义；3054、3585、5456、73048 **命令被接受但点为 undefined**。这与[官方文档的 n<3054](https://geogebra.github.io/docs/manual/en/commands/TriangleCenter/) 边界相符；没有穷举 1–3053，不能据此断言所有范围内编号都支持。

命名实验使用局部 synthetic ToolDefinition，没有注册站点命令：数字字面量 12 和数字对象 n 都命中 number 重载，原生重心方程形式回落原生。说明这种重载技术上可行，同时证明只有 number 类型不足以实现“只接受字面量”的契约；完整原生兼容性尚未验证。

Q039 direct／native 诊断后导出文件为 5006／4868 字节，同样不能作为纯输出大小的严格比较。

计时环境使用上述固定容器；相关采样为单次实验，不能当作跨设备性能保证。



## 对计划的影响

- 不能把“>3 次”当成原生引擎不支持；至少已有五次式的真实动态构造路径。
- 同一数学公式的后端对延迟有显著影响，先选后端和系数表示，再批量生成。
- 字符数短并不能代替性能测试，曲线次数也不能单独预测解析／绘制成本。
- 目录选择器静态分发解决命令池和分支规模问题，不能解决每条曲线本身的求值成本。
- 下一轮需在生产 GeoGebra 页复核较宽画布、同时存在多条曲线、自动保存、关系分析、撤销与删除等成本；本轮的实验辅助数值不能直接进入正式路径。
