# High 阶段：共享多输出与三次曲线筛选

日期：2026-10-29。入口：`/scripts/geogebra/browser/geogebra-smoke.html?suite=named-execution&tool=commonTangentsMulti`，另有 `commonTangents`（编号）及 `commonTangentsCrossed`（交叉）样本。浏览器内的同一构造分别运行 Low 与 High；创建时间包含辅助对象和正式输出，更新时间包含改变输入与读取结果。下面是单次筛选样本，不能当作整页负载或稳定统计结论。

| 工具与样本 | Low 创建 | High／候选创建 | Low 更新 | High／候选更新 | 判定 |
|---|---:|---:|---:|---:|---|
| `CommonTangents(c1,c2,1,1)`，共享前 | 100.8 ms | 47.3 ms，28 个辅助对象 | 19.9 ms | 0.9 ms | 结果一致；还有重复前置量 |
| `CommonTangents(c1,c2,1,1)`，共享后 | 44.7 ms | 22.9 ms，19 个辅助对象 | 8.9 ms | 0.8 ms | 启用 High |
| `CommonTangents(c1,c2,1)`，双输出 | 38.2 ms | 19.1 ms，19 个辅助对象 | 11.1 ms | 1.2 ms | 启用 High |
| `CommonTangents(c1,c2,-1)`，交叉双输出 | 42.2 ms | 20.2 ms，19 个辅助对象 | 10.2 ms | 1.0 ms | 启用 High |
| `QACu1(A,B,C,D)`，逐层数值命名候选 | 332.1 ms | 3132.4 ms，11 个辅助对象 | 154.0 ms | 148.0 ms | 保持 Low／High 下的匿名路径 |
| `OrthopivotalCubic(A,B,C,P)`，逐层数值命名候选 | 255.4 ms | 2076.4 ms，8 个辅助对象 | 131.5 ms | 135.5 ms | 保持 Low／High 下的匿名路径 |

`CommonTangents` 的共同前置绑定依次包含两个圆心（点）、两个半径和五个数值；两个输出私有的法向量与直线系数各自保留。两个圆心要求 High，不能因为其余绑定是数值就把整个调用加入 Medium。实机检查了两条线的标签、原生 `line` 类型、创建及输入变化后的显示方程；辅助对象隐藏、XML auxiliary 标记、关系图收缩、`.ggb` 导出重开和删除输出后的孤儿清理均通过。编号样本也保留原有结果。`bind()` 的多输出包装在匿名后端仍分别生成 `Element(Zip(...),1)`，命名后端复用同一组前置标签。

`QACu1` 与 `OrthopivotalCubic` 的候选都只需非几何中间量，因此若有效应进入 Medium，而不是 High 专用表。它们的类型与方程在这组普通、动态输入上与匿名路径一致，但创建成本大幅上升，已撤回白名单。两者的 builder 已拆为独立入口，便于以后只挑真正复用的系数节点做实验。`QLQu3` 的旧匿名基线在本轮再次让浏览器求值超时，未获得可信比较值，也没有启用 High。
