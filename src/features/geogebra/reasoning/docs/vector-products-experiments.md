# 向量积扩展：验证记录与复现

2026-10-23。调研与实现基线为用户提交的 `facd4e0`（vector plan）。关联 [修订计划](vector-products-plan.md)、[数学推导](vector-products-math.md)。

## 1. 数学路径的修正

2026-10-22 的原生基线：在记录的几何前提下，原 DDAR 未推出问题 A 的两条相似边比，也未推出问题 B 的三个题面目标；B 中 DA⊥DE 可以推出。该结果不是命题的否证。

上一版提出了一个可验证的四次恒等式，但错误地将它视作 B 的必要算法支持。2026-10-23 用户指出先证 AH∥FG 的线性叉乘链；当前数学文档已改为

```text
2 AH×FG = C₁−C₂−X = 0
```

其中 C₁、C₂ 是 H 的两条关联叉乘，X 是逆相似混合叉乘等式。当前引擎只执行关于二次积量的有理线性消元，不实现四次证书或多项式求解器。

## 2. 本轮新增验证

`geogebra-vector-smoke.py` 先运行真实 TypeScript 导出器，再把实际 JSON 交给未修改上游源码加站点混合适配器。它不是手工伪造导出结果。

| 用例 | 核查结果 |
| --- | --- |
| A，6 个已有点 | 两条相似边比推出；来源含积消元与逆相似，无反射辅助点 |
| B，长度／角前提 | BG=DG、AH∥FG、FG⊥BD 全部推出 |
| B，改从两个积前提开始 | 积域恢复相似并回写 DDAR，题面三项目标全部推出 |
| B，反馈专用目标 DA·DE=0 | 先由积式恢复相似，DDAR 推出直角，再返回点乘基；至少两轮同步，来源图含实际转换链 |
| B，六构型采样建议 | 从黑盒局部建议及题设直角条件出发，三项目标全部推出 |
| B，一般 D、镜像、旋转、平移及 1e−10／1e10 单位 | 几何和积前提两条路径均推出目标 |
| 缺少必要积条件、没有接受条件 | 不借坐标真值补前提，相关目标未推出 |
| 正长度乘积＋模 π 夹角，实际射线相差 π | 正确推出负号关系；错误符号的目标不推出 |
| 独立原点位置积 | 归一化后仍正确，4 个实际点不会变成 5 个 |
| 零向量积 | 有定义，不伪造非零方向或 guard |
| 实验假设模式 | 可接受数值不匹配的积式，保留诊断并作符号线性推导，不补数值非退化条件 |
| 篡改叉乘消元系数 | 独立代数回放拒绝 |
| 普通检查与 coverage | 共享同一混合闭包，真／假目标逐项隔离 |

新增原生套件目前 13 项测试。推出的 A/B 目标均无解释缺口，所用代数步骤回放通过；这仍不是对所有几何模板和坐标 guard 的完整独立形式化认证，`certificate` 保持 null。

前端另有 11 项新测试，覆盖原子规范化、对称／反对称、平移镜像缩放、独立原点、零向量、发现候选、局部秩、预算、结构化检索以及混合 JSON 导出。镜像测试曾发现等值簇代表受舍入影响，已改为按稳定符号键选择代表。

## 3. 旧回归与记录预算

初次集成无条件展开积后果，占用了既有 1600 节点的证明记录预算，导致扩展垂足构型的旧可读证明退化。已经改为按需激活：先运行 DDAR，对已经完成的目标保留其证明；仍需新能力时才展开积行并进入双向闭包。

原有中位线、角、长度、假设模式与垂足测试继续保留，不删除或放宽旧断言。垂足套件覆盖 14 个完整构型输入及缺少中心／圆心条件的反例检查。最终检查：46 个 TypeScript 测试文件、430 项测试通过；类型检查与生产构建通过；13 项新增原生测试、15 项既有 proof 测试、3 项 pedal 测试及 reasoning 脚本（含两个上游 IMO 例）通过。构建保留原有 Gradio 浏览器兼容及主包体积提示。

## 4. 可阅读的实际证明

- [问题 A 的证明步骤](examples/vector-problem-a.md)：聚焦 18 步，2 个代数回放步骤、2 个 guard。
- [问题 B 的平行结论](examples/vector-problem-b.md)：聚焦 21 步，3 个代数回放步骤、2 个 guard。
- 对应 JSON 与 Markdown 同目录，JSON 保存完整三项目标（B）的实际输入和结果，可独立回放。

这些文件由真实求解器和站点现有格式化器生成，不是手写模仿程序输出。短的手工数学链仍见数学文档；自动推导可能采用其他已证中间事实。

## 5. 性能与浏览器范围

有界发现已运行 20/40/80 点散点、同圆、网格样本。一次同时有其他回归运行的本机测量为：

| 点数 | 散点 ms | 同圆 ms | 网格 ms |
| --- | --- | --- | --- |
| 20 | 516 | 665 | 845 |
| 40 | 1430 | 3730 | 2458 |
| 80 | 1571 | 2519 | 2625 |

这是预算截断后的有限搜索，存在候选／输出／行空间 partial 诊断；不是完整召回率测量或时延保证。密集样本原先达到输出上限后仍重复消元，现已提前停止该类输出处理。

本轮尝试通过应用浏览器访问本地开发页，但浏览器报告连接超时，未完成实际页面／Pyodide Worker 回归。因此不宣称真实浏览器交互已通过。TypeScript 的 Worker 入口参与构建，新增 Python 模块已进入生产公共资源；取消／超时／复用仍沿用已有客户端路径。

## 6. 复现命令

从仓库根目录执行：

```sh
npm test -- --run --maxWorkers=2
npx tsc --noEmit
npm run build
python -B scripts/geogebra/reasoning/geogebra-vector-smoke.py
python -B scripts/geogebra/reasoning/geogebra-proof-smoke.py
python -B scripts/geogebra/reasoning/geogebra-reasoning-smoke.py
python -B scripts/geogebra/reasoning/geogebra-pedal-smoke.py
node node_modules/vite-node/vite-node.mjs scripts/geogebra/reasoning/geogebra-vector-examples.ts
node node_modules/vite-node/vite-node.mjs scripts/geogebra/analysis/geogebra-discovery-benchmark.ts --scale
```

原生脚本使用本地 Python 与 NumPy；示例生成器还会写入上述 examples 文件。新实现不依赖 SymPy，也不会创建 GeoGebra 辅助对象。
