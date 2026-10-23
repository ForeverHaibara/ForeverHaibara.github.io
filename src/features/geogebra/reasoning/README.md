# 条件性几何推理

2026-10-23：点乘／叉乘的线性积域已接入发现、条件建议与 DDAR 双向闭包。
原点可以是独立框架，不新增作图对象；题 A/B 使用无辅助点的线性推导。
见 [修订设计与实现](docs/vector-products-plan.md)、[数学路径](docs/vector-products-math.md) 和
[验证记录](docs/vector-products-experiments.md)。完整积条件通过项目 JSON 导出。

从 GGB 黑盒输出的数值性质出发，明确选择承认的条件，再用无语言模型的
AlphaGeometry2 DDAR 检查目标。总体路线、性质刻画与后续算法见
[实施计划](docs/implementation-plan.md)。XML 语义还原不是本模块的前置依赖。

## 已实现的第一阶段

- 版本化问题表示：完整对象依赖、原始定义、坐标、候选及观测来源。
- 从当前发现结果读取基础关系、中点、普通角关系、长度关系、相似／全等、
  方向／长度生成模型及有限性质族。每个实例单独展开，不补全未观测的绑定。
- 在 Analysis & Proof 面板的 Relations & proof 区域，人工接受条件组、
  选择目标、查看组内具体性质。初始无任何自动接受的性质。
- AG2 文本导出和 JSON 项目导出。文本的每一行是一道独立问题，合取目标
  拆为多个共用前提的问题。JSON 保留条件选择、原始依赖、名称映射、坐标
  归一化、角分支和本次运行结果，供复核与研究；尚无项目导入界面。
- 按需运行 Pyodide + NumPy + DDAR 的 module Worker，支持停止、超时、
  重复运行复用解释器、旧响应隔离。实际求解状态不与发现状态共用。
- 检查直接接受的目标、常见对称写法、长度等式与共线／共圆子集，避免将
  明确输入的目标作为新推导报告。这不是完整的几何等价判定器。

自动局部条件建议、多构型检查与覆盖评估已加入，详见 [P2 首批实现](docs/local-characterization.md)。
角条件默认采用直线有向角（模 π），显示为 `∡`；无向角 `∠` 仍独立保留。
具体标准和等角共轭回归见 [角语义规范](docs/angle-semantics.md)。
第一阶段仍允许从一次快照直接选择／承认条件；它不声称已自动找到充分刻画。
单快照发现、接受为条件和引擎推出分别记录。`derivedFrom` 不会自动变成前提。

## 使用

1. 在 Relations & proof 点击 Discover relations，或使用自动发现。
2. 直接在关系卡片勾选 Accept condition，需要指定目标时点 Use as goal。
   All／Accepted／Goal／Rejected 共用一个目录，每个视图独立记住筛选；显示筛选不取消条件。
   查询支持 `AO CO`、`(O,A)=(O,C)`、`ABC DEF` 等结构化写法，Reset filters 重置当前视图。
3. 点 Generate readable proof，可不选目标。第一次运行需联网下载固定版本 Python
   与 NumPy；之后同一面板的独立运行复用已加载的解释器。单独 Check goal
   入口位于同一操作卡下方；Export 菜单提供两种导出。
4. 查看是否已接受、在给定条件下推出或未推出。未推出不表示目标为假。
5. Export AG2 下载后端文本，Export project 保存本次条件、见证和来源。

也可以先点击 Suggest conditions，默认在独立副本上检查六个变化构型。
有效建议完成后自动合并到已接受条件，保留手工条件和已选目标，并排除把当前目标本身作为自动前提。
在 Accepted 视图手动移除不需要的条件；重绘目录不会重新接受它，只有新的建议运行或
Add suggestions again 会再次添加。失败的数值检查仍需手动假设，绝不自动加入。
逐对象建议、检查不足和 Evaluate coverage 收在 Suggested conditions 详情中。
Evaluate coverage 可检查建议集能推出多少额外性质，不会自动增加条件。
局部建议与全局发现中的同一命题合并显示采样证据，接受状态和来源 ID 保留映射。
具体语义、数值精度及界面检查见 [统一关系目录](../analysis/docs/precision-and-unified-catalog.md)。
计算范围与条件角色的分离、检索语法及扩展方式见 [结构化检索与筛选](docs/catalog-search-and-filters.md)。

现在优先使用 **Generate readable proof**：接受条件后即可生成可读后果，不必
先选目标；也可选目标来聚焦其证明。阅读界面可以切换结论，显示逐步来源、
精确消元系数、几何规则与坐标分支，并导出当前证明的 Markdown。
完整项目 JSON 保留整批证明图和实际使用的导出输入。
可直接阅读生成的 [中位线证明样例](docs/examples/midsegment-proof.md)。
新增 [九点圆](docs/examples/orthocenter-nine-point.md) 和
[内心辅助点长度乘积](docs/examples/incenter-contact-polar.md) 的真实推导；
构型、条件、对照结果与复现方法见 [垂足构型基准](docs/pedal-benchmarks.md)。

**Explore hypotheses** 允许显式接受采样失败或出现反例的保留候选。此模式
使用符号代数，不强迫当前坐标满足假设；报告可检测的矛盾，不使用爆炸律。
数值拒绝不会自动取消用户选择；结构错误仍单独报告。项目可在后端无法导出
时保存条件、诊断和失败原因。详见 [P4 可读证明与实验假设](docs/readable-proofs.md)。
Rejected 视图可以单独查看被拒绝的保留候选；搜索也会匹配诊断文字。
假设开关和建议采样/搜索范围位于默认折叠的 Reasoning options。

`ReasoningActions` 只负责固定操作卡和进度/结果呈现；`proofOutcome` 从实际后端结果区分
目标已给定、已推出、未推出、部分解释、代数回放失败和矛盾。无目标时显示记录的新结论数。
结果跳转按操作卡的实际高度留出空间，并把键盘焦点移到结果区域。`acceptSuggestedConditions`
独立处理条件合并与目标排除；组件按 proposal 身份只自动应用一次。

构图变化后，旧选择和结果失效；同快照计算范围缩小仍保留明确选择，池扩展映射语义未变的选择。停止会终止
Worker，下次重新初始化。不使用远程推理服务，构图数据不发送到模型端。

## 语义与资源边界

当前导出名称为 `p0`、`p1` 等，用户对象名从不插入后端语法。
坐标按引用点平移和统一缩放，保留原始数值和变换。仅导出实际引用的点。
每次最多 40 点、250 个展开后谓词，整数系数绝对值最多 32。
初始化限时 120 秒，求解限时 30 秒；取消／超时没有否证含义。

普通角先复核原方程，再在当前射线方向分支下转换。项目保存每个角的
方向符号和 lift；这些分支也是本次条件的一部分。保留倍角的整数因子，
不在模 π 关系里直接约掉因子。模方程的整周分支以及上游数值判断仍属于
后续证明审计内容，当前不宣称具有跨分支的形式化证明证书。

自动建议独立发现有向角，不把无向角候选直接改义。普通角前提可以导出模 π
后果；尚无射线／不等式证明器，因此新普通角目标会被拒绝，仅明确接受过的
同一普通角条件可标为已接受。覆盖评估会单独说明跳过的普通角目标。

AG2 的坐标检查可能比数值发现严格得多。普通模式的桥接层及内核拒绝不满足见证容差的
条件，不修改坐标、不放宽容差、不将近似共线／重合冒充精确输入。
实验假设模式另走符号路径。JSON 项目中的 `certificate` 仍为 null：代数步骤
可以独立回放，几何规则实例与数值分支仍属于当前检查器的明确可信输入。

首批候选来自已有发现器保留的结果，有预算和压缩，不是完整性质库。
不解释 `Element/Zip/If` 等复杂表达式，不根据函数名推断三角形中心语义。
多构型检查、局部条件建议及可读来源图已实现首批；全局充分性、辅助点搜索、
完整几何检查器仍待后续阶段。线、圆等保留为依赖对象；推理条件目前以二维点为载体。

## 文件

| 位置 | 职责 |
| --- | --- |
| `ir/types.ts`、`formatPredicate.ts` | 几何问题和数学条件，不依赖 AG2 文本 |
| `sources/discoveryProblem.ts` | 观测转候选，保留黑盒来源及有限实例 |
| `selection/` | 局部候选池、依赖范围、数值 Jacobian、贪心选择、覆盖及 Worker |
| `sampling/`、根目录 `public/geometry-reasoning/sampling.*` | 只读主引擎、隔离副本与可复现样本 |
| `backends/ag2/capabilities.ts` | 上游版本、能力及资源预算 |
| `backends/ag2/exportProblem.ts` | 语义展开、校验、角分支、名称与坐标映射 |
| `backends/ag2/Ag2WorkerClient.ts`、`ag2.worker.ts` | 加载、通信、取消及超时 |
| `proof/`、`components/ReadableProofView.tsx` | 证明图协议、原始名称展示、聚焦和 Markdown |
| 根目录 `public/geometry-reasoning/proof_algebra.py`、`proof_ddar.py` | 精确来源消元、独立代数回放、带记录的 DDAR 适配 |
| `../../../../public/geometry-reasoning/ag2_bridge.py` | 原生与浏览器共用的 Python 桥 |
| `../../../../public/vendor/alphageometry2/` | 未修改的固定上游源码与许可 |

公共资源位于仓库根目录的 public/。
新增谓词应先确定 IR 语义与前提／目标展开，再修改后端能力和检查。

## 检查

```sh
npm test -- --run src/features/geogebra/reasoning --maxWorkers=2
python scripts/geogebra-reasoning-smoke.py
python scripts/geogebra-proof-smoke.py
python scripts/geogebra-pedal-smoke.py
npx tsc --noEmit
npm run build
```

原生脚本需要 Python 和 NumPy，先运行 TypeScript 导出器，再将实际输出传给
固定上游内核。覆盖中位线、有数值观察却无前提、错误目标、已接受目标、
黑盒发现到推理、长度比、每个保留的性质组、镜像角和倍角，另跑两个上游
IMO 样例。生命周期测试覆盖取消、旧响应、求解超时和解释器复用。

2026-10-19：原生端上述回归通过；浏览器真实 Worker 已验证“无前提不推出，
接受两个中点条件后推出中位线平行”，求解约 14–108 ms（五点小构型，
不含首次下载／初始化），并检查初始化取消、构图变化后的选择与结果失效。
实际下载的项目 JSON 在原生 Python 回放，双方均推出相同目标。
全仓库 31 个测试文件、330 项测试通过，TypeScript 检查及生产构建通过；
构建包含独立 AG2 Worker 和所需 Python 公共资源。构建仍有原有主包体积提示。

同日 P2 回归：全仓库 34 个文件、346 项测试通过，TypeScript 与生产构建通过。
新增回归覆盖黑盒局部条件、特殊位置反例、留出验证失败、副本取消与超时清理，
以及共享 DDAR 闭包查询中的真／假目标隔离。原生端自动建议的两个中点条件
可推出中位线平行；浏览器端的六构型检查、建议接受和覆盖查询也已实测。

角语义更新后：36 个测试文件、359 项测试、TypeScript、生产构建及原生
DDAR 回归通过；真实 GGB 等角共轭长表达式的三个有向候选通过 4+2 构型检查。
浏览器的第三条等式仍未由两个建议推出，按未覆盖报告；详情见角语义规范。

2026-10-20：P4 首批可读推导与实验假设完成。全仓库 37 文件、363 项测试及
12 项原生证明回归通过，既有 AG2 回归、TypeScript、生产构建通过。浏览器
实测无目标证明、按结论聚焦、显式选用被采样拒绝的命题，以及构图更新后失效。

## 上游

[AG2](https://github.com/google-deepmind/alphageometry2) 固定提交
`251e7e16f0bba8ac7c83cdea789fccc195d0c0c7`，代码 Apache-2.0。
详见根目录 `public/vendor/alphageometry2/UPSTREAM.md` 和 LICENSE。
Pyodide 固定为 `314.0.7`，运行时从 jsDelivr 按需加载。
