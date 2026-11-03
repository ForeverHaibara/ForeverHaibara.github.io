# ETC TriangleCenter 工具

从仓库根运行。脚本位于本目录，默认读取全部 Part 1–37。`build` 完成选择和检查后写入正式全量 chunks；`check` 重算并比对同一全量库。`dry-run` 保留为可选诊断入口，不再维护独立的小实验库。

```sh
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py build --report .cache/triangle-centers/runs/current/build.jsonl
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py verify
python scripts/geogebra/tools/triangle_centers/triangle_center_import.py check --report .cache/triangle-centers/runs/current/check.jsonl
python -m unittest discover -s scripts/geogebra/tools/triangle_centers -p 'test_*.py'
```

## A. 语法与入口

配方行的完整形式是 `n 操作 参数...`。下表省略共同前缀 `n`；`p/q/r/t` 表示中心编号，`f/wi` 表示经检查的标量公式。扩展编号须大于3053；1–3053中仅native-patches.txt明确登记的编号允许作为补丁配方。引用须为正且不能引用自身。原生点的可用性、有限/理想类型、依赖闭合、预算和数值检查仍适用。

| 语法 / 入口 | 含义 | 约束 / 所在文件 |
| --- | --- | --- |
| `M p q` | X(p)、X(q) 的中点 | 两个有限点 |
| `R p q` | X(p) 关于 X(q) 的中心反射 | 两个有限点；q 为反射中心 |
| `C p` | 补点 | 相对 ABC，重心为位似中心，比例 -1/2 |
| `A p` | 反补点 | 相对 ABC，比例 -2 |
| `P p q r` | X(p) 在直线 X(q)X(r) 上的正交投影 | p 有限；q/r 定义的线至多一个有已知方向的理想输入 |
| `R p q r` | X(p) 关于直线 X(q)X(r) 的反射 | p 有限；q/r 定义的线至多一个有已知方向的理想输入 |
| `I p q` | 沿有限直线 X(p)X(q) 方向的理想点 | p、q 有限且不重合；可供支持理想输入的操作引用 |
| `I` | 理想点已确认，方向未知或当前不可用 | 状态覆盖；不能作为其它构造的输入，不伪造有限坐标 |
| `J p q r t` | 直线 X(p)X(q) 与 X(r)X(t) 的交点 | 每条线至多一个有方向理想输入；平行线不会作为有限 J 准入 |
| `G p` | 等角共轭 | 支持有限点及有方向的理想点 |
| `T p` | 等截共轭 | 支持有限点及有方向的理想点 |
| `V p` | 关于 ABC 外接圆的反演 | 有限输入 |
| `V p q r` | 关于以 X(q) 为圆心、过 X(r) 的圆的反演 | 三个有限点；半径非零。与上一行共用 V，无 K 操作 |
| `O p q r` | 过三个有限点的圆的圆心 | 三点须能确定非退化圆 |
| `F p:w1 q:w2 ...` | 加权有限点组合，结果为 Σwi·X(i)/Σwi | 2–6 个互异输入；权重同量纲，权重和非零；公式不含空白 |
| 双输入 F 中的 `d` | 两个输入点之间的距离 | 仅 F 恰有两个输入时可用；边长量纲；运行时只绑定一次输入与距离 |
| `B f` | 循环重心坐标 `f(a,b,c):f(b,c,a):f(c,a,b)` | 纯坐标公式，须满足齐次性；有限锚点与理想状态分开处理 |
| `B p f` | 使用 X(p) 重心坐标的循环变换 | 仅此作用域增加 `x,y,z`，随循环一起替换；仅 x²/x³ 模板可接收有方向理想输入，其余须有限 |
| `B p q f` | 使用两个输入重心坐标的循环变换 | 第一输入 `x,y,z`，第二输入 `u,v,w`；两个输入分别检查射影缩放齐次性 |
| `native-patches.txt` 中 `n 操作 参数...` | 原生修复的权威清单，复用全部配方语法 | 手动审阅，不从Part1–3自动提取；前端读取同一清单判断字面量分派，build生成对应chunks；普通未登记原生编号不能写入配方 |
| `n DOMAIN nonreal` | 已审阅、一般位置下非实的点 | seeds 元数据，不生成实平面配方；列入 `resolved_nonreal`，不计未覆盖 |
| `n DOMAIN conditional_complex` | 在不同三角形域上可能为实或复 | seeds 元数据；保留实域构造资格，不等同 SKIP 或永久非实 |
| `n SKIP 原因文字` | 明确排除已审阅的目标 | seeds；常用原因前缀 `source-error:`。与该点配方、DOMAIN 不得冲突 |
| `# 注释`、行尾 `# 注释`、空行 | 审阅理由、实验说明或分组 | seeds 等维护文本支持；生成的运行时 chunks 不携带这些说明 |
| 公式 `+ - * / ^`、括号、数值字面量 | 经 AST 检查的算术 | 存储公式显式乘号、无空白；不允许任意代码或未知名称 |
| `a,b,c,A,B,C` | 边长及角度（弧度） | 对应 ABC；按循环替换 |
| `s,sa,sb,sc` | 半周长、s-a、s-b、s-c | 按边长量纲处理 |
| `S,SA,SB,SC,SW` | S 为**两倍面积**；SA=(b²+c²-a²)/2 等；SW=(a²+b²+c²)/2 | SA/SB/SC 循环替换，S/SW 不变 |
| `r,R,E,F,pi` | 内切半径、外接半径、4R²、SW-4R²、圆周率 | 这里的公式变量 F 与操作码 F 分属不同位置 |
| `sqrt,sin,cos,tan,cot,sec,csc,sinh,asinh,atan,ln,abs` | 允许的单参函数 | 角函数参数与 ln 参数须无量纲；abs 保持量纲 |
| ETC `Barycentrics ...` / `Trilinears ...` | 导入坐标标签；可有前导等号 | 三线坐标先乘 a 转为重心坐标；循环三元组须核对一致 |
| ETC `: :`、循环完整三元组、括号/方括号/算术花括号 | 导入时的坐标缩写与分组 | 不放宽未知符号、括号不平衡或非循环表达式 |
| ETC `sin A` 等有界裸函数、`log(...)`、绝对值、`min/max` | 导入时规范化为存储公式 | 裸函数只读明确边界的原子；log 规范化为 ln；维度相关对数差须有严格恒等变换 |
| ETC `cevapoint of X(p) and X(q)` / `crosspoint of X(p) and X(q)` | 两种齐次双输入重心变换，复用 `B p q f` | 两个有限输入；可交换参数，仅匹配无其它参考三角形/条件的完整关系 |
| ETC `X(p)-Ceva conjugate of X(q)` / `X(p)-cross conjugate of X(q)` | 复用 `B p q f`；与本站 `CevaConjugate(ABC,X,P)`、`CrossConjugate(ABC,X,P)` 的参数顺序一致 | 两个有限输入；p/q 不可交换 |
| 上述四类的 `for these (i,j): ...` | 多行等价参数表，逐对提取同一种变换 | 必须完整读完参数表；拒绝损坏参数及 wrt/in/条件后缀，不改变原参数顺序 |
| ETC `barycentric square/cube of X(p)` | 逐重心坐标平方/立方，复用单输入 B | 有方向理想输入从方向向量计算齐次重心坐标；裸 I 禁止作输入，非有限结果不冒认有限点 |
| ETC `OH` | ABC 的长度 ∣OH∣，按 Euler 恒等式展开为 `sqrt(abs(9*R^2-2*SW))` | 原式对真实三角形非负，abs 仅保护消去误差；不新增运行时符号，不猜测未定义的 J |
| ETC `where T^2=..., T1^2=..., T2^2=...` | 完整局部声明的无环依赖图，可前向引用；取非负平方根 | 拒绝环、重复绑定、全局变量遮蔽、未知后缀和其它幂次；局部根式不加 abs，负被开方量仍无实定义 |
| ETC `where J=\|OH\|/R` | 显式局部声明按 Euler 长度恒等式展开 | 不把 J 或 OH 添加为未绑定全局变量；不会据另一条目的约定猜本条 J |
| ETC `where p=..., q=..., t=...` | 最多三个独立局部标量，可换行 | 不允许全局名称遮蔽、未定义引用、局部定义链 |
| ETC `where x:y:z=...` / `where x=..., y and z are defined cyclically` | 明确声明的局部循环三元组 | 须验证循环等价；不由单独 x 定义猜测 y/z |
| ETC `where f(a,b,c)=...` | 一个显式局部循环函数，可嵌于首坐标表达式 | 不允许递归、未知函数或非循环调用；不能泛化解释任意自然语言定义 |
| ETC `Steiner-circumellipse-inverse` / `Steiner-inellipse-inverse of X(p)` | 关于重心的相应椭圆反演，复用单输入 B | 只匹配无参考三角形/条件后缀的完整关系；反演中心 X(2) 没有有限逆像 |
| ETC 关系、线表及交点标题 | 提取 M/R/... 等配方及共享入射线族 | 自身编号必须匹配；`{30,511}` 或与 X(30)X(511) 的明确交点识别理想状态，再从其它有限线提取方向 |
| `native-status.txt` 中 `n` / `lo-hi` | 不可用原生编号或连续范围 | 原生数据维护输入；不是扩展配方 |
| `native-status.txt` 中 `n p q` | 原生理想点的有限方向 | p/q 为其方向所依据的原生有限点 |
| `coordinate-priority.txt` 中 `n` | 优先保留该点自动解析的坐标锚点 | 每行一个扩展编号，可注释；不复制坐标公式 |
| `triangle_center_consensus.py --ids n ...` | 对指定中心及其解析性质作批量多数审阅 | 读取当前正式 chunks 和缓存 Part 1–37；只读 seeds/chunks，输出建议，不新增配方字母 |
| 审阅 `--from-report path.json` | 合并报告 entries/checks/intersection_title_hints 中的编号 | 可重复指定；与 --ids 取并集 |
| 审阅 `--upstream` | 增加当前选中 DAG 的扩展上游 | 无截断深度；性质中来自目标自身下游的证据不投票 |
| 审阅 `--settle` | 仅在内存中分轮修复独立根节点并重新投票 | 沿用深度6、长度不限、共轭1预算及类型检查，不引入新的样本无定义/类型变化；已有种子和本轮锁定值不自动覆盖 |
| 审阅 `--report path.json` / `--markdown path.md` | 输出详细票据与可读建议 | 含输入/代码摘要、来源降重、未定义/循环忽略项、线对搜索与构造统计 |
| 审阅 `--no-coordinate-cache` | 绕过仅保存数值位置的缓存 | 默认 review-cache/coordinates；配方、atlas、原生方向或数值实现改变即失效，投票和选择每次重算 |
| `fetch` | 手动下载指定 ETC 页 | 唯一需要网络的普通数据入口；不自动同步 |
| `audit` | 源页标题与边界预检 | 不做配方选择；文件级歧义须先解决 |
| `native` | 从原生 atlas 推导/更新理想方向表 | 写 native-status；弱或冲突方向不冒认 |
| `build` / `check` | 生成并写 chunks / 重算并比对已提交 chunks | 都做源预检、图选择和数值检查；check 不写数据 |
| `dry-run` | 全流程选择、检查与摘要比较 | 不写正式 chunks；可选诊断入口 |
| `verify` | 检查现有 chunks 的图、类型、位置及排除状态 | 不重新解析 ETC 或重建选择 |
| `--parts n ...` | 明确指定源 Part | 默认 1–37；依赖图会随输入集合改变 |
| `--auto-operations MRCAPIVJGTFBO` | 允许自动提取的操作 | 已审阅 seeds 独立保留 |
| `--max-depth` / `--max-length` / `--max-conjugates` | 深度 / 估计展开长度 / 共轭层数预算 | 默认 6 / 不限制 / 1；不能靠缩小预算代替效率改进 |
| `--max-coordinate-anchors-per-component` | 可选的每未闭合分量坐标锚点上限 | 默认不限制；0 禁用该类锚点 |
| `--report path.jsonl` | 分阶段、缓存、闭包与心跳事件 | 每次运行带 run ID；长阶段约每 5 秒输出心跳 |
| `--uncovered-report path.json` | 当前输入范围的未覆盖诊断 | 包含条目标题、来源提示、候选阻塞及标题族；不复制已选配方表 |
| `--no-cache` | 绕过磁盘提取缓存 | 不会固定或复用图选择结果 |
| `--skip-ideal-audit` | 跳过额外的全公式理想点库存统计 | 仅在相同公式池/atlas 已审计时复用；图选择、类型、几何及最终数值检查照常进行 |

裸 I 只记录已证实的理想状态。自动候选中若存在可闭合且通过数值校验的有限方向线，优先选用带参数的 I；显式裸 I seed 则维持审阅指定的状态。单凭两个样本的重心坐标和接近零不足以自动下结论；本批额外理想点的坐标和已作精确恒等式审阅。已知非实根也不能从“两个样本均无定义”获得坐标锚点。

## B. uncovered 与批量审阅诊断代码

`entries` 只收集尚待解决的目标，`count` 与 `summary` 只统计这些条目。一个点可有多个候选、每个候选各有阻塞原因；`primary` 按当前诊断优先级选一个摘要原因，并不表示其它原因不存在。`formulas[].blocker` 与 `candidate_blockers` 使用同一套候选原因。

| 代码 / 字段 | 含义与判断范围 | 后续处理方向 |
| --- | --- | --- |
| `intersection_title_hints` | 报告顶层的结构性审阅提示，包含已覆盖点；标题线与保留的线族共享端点但另一端编号不同 | 不计入 count/primary，不自动纠正编号或判源错误；结合坐标、多条独立入射及端点定义复核。使用现有保留线族，非穷尽全页线表审计 |
| 审阅 `confirmed` / `consistent_weak` | 当前点与最优候选相符；前者满足多数/独立权重/差距要求，后者证据尚弱 | 数值相容，不等于独立几何证明；不因弱证据擅自改点 |
| 审阅 `proposal` | 有严格多数，支持权重至少2，且比次选或未枚举上界至少多1 | 建议须经正式构建；优先改根节点，重新投票后再判断下游 |
| 审阅 `ambiguous` | 没有达到全部采纳条件 | decision_reason 区分无严格多数、独立权重不足、差距不足 |
| 审阅 `reviewed_seed_conflict` | 多数与 seeds 或本轮内存锁定的点冲突 | 保留冲突供复核，不自动覆盖；该名字不表示已经做过文字几何证明 |
| 审阅 `no_finite_candidate` / `missing_source` | 没有全部样本有限可比的候选 / 缺少源条目 | 区别于非实证明、未实现语法及缺页；不自动写 DOMAIN 或 SKIP |
| 审阅 `application_blocked` | 数值多数建议未通过图/数值准入 | 分别报告循环、缺依赖、深度/长度/共轭预算、输入类型、新数值失败、数值类型变化等原因 |
| 审阅 `applied_in_memory` / `pending_geometry` | 内存暂定修改及仍待独立几何核验的点 | 正式数据通过 seeds + build 发布；几何待办另见批量审阅文档 |
| 原生补丁缺失 / 与seeds冲突 / 生成配方过期 | 构建或verify的硬错误，不是uncovered分类 | 不允许回退原生；清单改动后重新build。原生方向若引用补丁节点，须重建方向或显式登记方向配方 |
| `no_parsed_candidate` | 本次源输入未提取到候选；并非数学不可构造的结论 | 检查描述、标题、局部定义及源笔误；补通用规则或审阅 seed |
| `unclosed_dependency` | 候选引用了本次有源条目、尚未选中的扩展点 | 查依赖簇、锚点及另一种构造；不能简单按编号先后判断 |
| `missing_source_dependency` | 所需扩展编号不在本次候选集合，也未由配方提供 | 扩大 Part 或检查缺页/边界；区别于已有源但未闭合 |
| `reviewed_skip_dependency` | 候选引用了 seeds 明确 SKIP 的点 | 核对排除理由，寻找独立构造；不默默忽略 SKIP |
| `blocked_native` | 候选依赖不可用、且无已核实方向的原生点 | 复核原生状态或寻找替代依赖 |
| `input_type` | 输入类型与操作不符 | 例如把理想点当有限点、两理想点确定普通线、引用裸 I；应换合法表达 |
| `depth_budget` | 新候选的依赖深度超过本次预算 | 优化构造/锚点并观察图；不是源解析失败 |
| `length_budget` | 估计展开表达式超过显式长度上限 | 改善共享与构造成本；默认没有长度上限 |
| `conjugate_budget` | 路径共轭层数超过本次预算 | 优先找直接关系或坐标替代；不是所有非线性操作的统一计数 |
| `nonhomogeneous_formula` | 纯 B 候选的边长缩放齐次性未通过 | 查缺项、额外因子、局部变量及 ETC 笔误，不能直接放宽 |
| `ideal_formula` | 纯 B 的样本结果含理想值且没有有限样本，不能当有限 B 准入 | 精确检验循环坐标和及非零性；确认后用 I，尽量保留方向。此代码本身不是恒等式证明 |
| `coordinate_admission_or_variants` | 公式通过上述粗筛，但未作为有限锚点选入；可能涉及入射核验、变体或锚点准入 | 检查具体候选、数值样本、线表及替代定义；不可笼统解释为语法错误 |
| `geometry_or_transaction` | 输入和静态预算可用，但几何筛选或替换事务未通过/未选入 | 核查退化、入射冲突及后继影响；此分类不宣称更精确的失败根因 |
| `confirmed_ideal` | 当前理想方向与所有可比较线表一致 | 保留带方向 I；不进入有限点投票 |
| `ideal_direction_outliers` | 理想方向有支持也有反对线 | 审阅反对线及端点上游 |
| `ideal_direction_conflict` | 可比较线全部反对当前方向 | 核验方向定义及端点 |
| `ideal_direction_unavailable` | 无可比较方向或仅有裸 I | 不改成有限候选；两理想点连线不提供仿射方向证据 |
| `reviewed_nonreal_domain` | **已解决状态**：已审阅的一般位置非实根 | 位于 `resolved_nonreal[].reason`，不在 entries/count/summary，不生成实平面绘图配方 |
| `possible_complex_dependencies` | **风险字段**：所选依赖或候选依赖可能涉及复数域根 | 不等于结果非实；复共轭抵消、独立实构造与条件实域须分别判断 |
| `skipped` | seeds 中明确 SKIP 的编号及原始原因文字 | 已排除的目标不计 entries/count；依赖它的其它点仍可标 reviewed_skip_dependency |
| `domains` / `resolved_nonreal` | 域注记原表 / 本次范围内已处理的非实目标 | 用于审计状态去向；DOMAIN 不增加运行时配方数量 |

解析异常、源标题重复、配方环、非法 seeds 或最终数值审计失败会直接使命令失败；这些硬错误不能通过生成一份 uncovered 报告来掩盖。已审阅非实根只排除根本身，不把“非实”结论沿引用传播；例如 X(5002)/X(5003) 在某些域为复点，其平均值仍可能为实点。

关系解析要求消费完整表达式。终止标点、已知署名和多余的末尾闭括号可规范化；参考三角形、复合共轭、条件及未知数学后缀不能被截掉。未实现的复合表达式整体不生成简单前缀构造，可用线表、坐标或 seeds 的已有定义替代。`reflection of X(p) in X(q)X(r)` 使用原有三参数 R；`complement X(p)` 与 `complement of X(p)` 等价。

## 工程与审阅说明

测试集中在三个文件：`test_triangle_center_import.py` 覆盖语法、公式、IO、域与标题诊断；`test_selected_graph.py` 覆盖图和数值事务；`test_source_errors.py` 集中独立几何与源错误审阅。后续不要按每个错误新建测试文件。

缓存按 `sources/`、`native/`、`extracted/`、`runs/<batch>/`、`reports/uncovered/`、`reports/reviews/`、`planning/`、`research/`、`experiments/` 组织。原始 HTML 保留不动；文件级边界修复在 `triangle_center_sources.py` 按快照 hash 限定，单点数学错误优先写入 seeds。`selected.tsv` 已退役。`compact_topology_cache.py` 为诊断拓扑使用范围、共享索引、差分及 gzip，迁移前后逐值核对。

提取缓存 schema 3 保留显式候选、共享线族及源标题提示。图选择只在需要时展开推断线对，不删除备选搜索空间；每次仍根据完整 Part 集合重新选择。反向依赖索引和缓存图指标用于局部事务，数值 overlay 只提交变化量；失败事务不污染旧快照。修复队列在静止后做独立全图审计，不用固定轮数掩盖未收敛。

指纹按解析入口及其实际辅助函数调用图失效，纯数值求值/齐次性修改不会使所有源页重解析。标题族相似度仅用于诊断，不把一条目的数学证据转移到另一条目。日志保留实际冷提取/热缓存差别，避免将重复统计时间误判为选择算法成本。

Steiner 长轴规则从形状矩阵和曲率独立推导，复用重心与实焦点的 F 组合；短轴 seed 采用短轴投影向量的正范数归一化，并以实曲率位移求圆心；部分等腰分支仍保留无定义。VU PCC、VU 双圆与 Vietnamese 等有输入公式均须检查每个输入的独立射影缩放；圆反演仅明确映射未经参考三角形修改的 ABC 圆。

正式数据与最新全量进展分别见数据目录 README 和 `src/features/geogebra/commands/custom/docs/triangle-centers-uncovered.md`、`triangle-centers-scaling-plan.md`。全量 dry-run 不等于已经发布全量运行时数据。

按复核优先级整理的源定义冲突、端点数值证据与已确认修复见 `src/features/geogebra/commands/custom/docs/triangle-centers-source-review.md`。诊断代码不是源错误证明。


坐标锚点会在初始选择后对尚未闭合的小集合重试：早期线端点定义可能已改善，不能永久沿用早期拒绝结论。每次试选仍使用完整候选池和全部图/几何约束；只提交严格增加覆盖且不丢当前旧覆盖的结果，直至静止，不使用固定轮数。显式每分量锚点上限按初始分量保留预算，0 仍禁用此机制；`late-coordinate-anchors` 事件记录提议、增加和丢失编号，拒绝的试选不替换旧快照。

PB 用户复核已扩大为全部 36 个透视中心的独立几何审计；星号组通过直径圆条件确定 U 也随 S 重算。现有 32 个已选位置均正确，仅为四个根增加 seeds。12025/32584 按原始几何核验记 SKIP，而不是猜测同次式或悄悄重定向到 11/115。51539/51540 经直接射影实性检验记 nonreal，没有按依赖传播结论。

构建在所有检查通过后发布已在内存中分好的块：逐文件比较，内容未变则不写；有变化则写临时文件后替换，并清理过期块。替换是逐文件原子的，整批发布期间应避免同时启动另一个构建或读取混合版本。`chunks-written` 报告写入/未变/删除文件数和写入字节数，`write_chunks` 阶段报告耗时。

个别条目的错误关系不在 Python 中维护排除表：保留原始源文本，人工确认正确定义后写入 seeds，错误理由写入源复核文档。14821 已由其审阅种子固定；其 6–9–13 近共线只是一个特例的证据，不作为一般筛查或自动判错依据。

明确交点与线表推断交点均接受额外入射检查：有足够线表时，额外的非平行线可以提供支持。明确交点若没有额外支持，且至少两条不同几何线明确反对，则拒绝该候选；一条坏线、同一直线的重复端点对、未闭合端点或全部平行的证据不单独否决明确交点。这是数值一致性筛选，不裁决哪段源文字错误。已确认的个别例外仍用 seeds 固定。

批量审阅的完整说明及待核验清单见 [triangle-centers-consensus-review.md](../../../../src/features/geogebra/commands/custom/docs/triangle-centers-consensus-review.md)。同一直线、同输入证据和共享扩展上游会降重；相同坐标变体不重复计票。先评已有候选，能用保守支配界决定时跳过剩余线对，否则完整枚举；共享端点也参与。位置确定后找一个简洁构造即可，不求最优路径。坐标缓存只保存位置，不冻结选择；该缓存目录可独立清理后重算。

```sh
python scripts/geogebra/tools/triangle_centers/triangle_center_consensus.py --from-report .cache/triangle-centers/reports/uncovered/uncovered-consensus.json --upstream --settle --report .cache/triangle-centers/reports/reviews/consensus-next.json --markdown .cache/triangle-centers/reports/reviews/consensus-next.md
```


此前可解析证据相容、仅文字几何未独立核验的13项已按用户要求结束复核，不再作为待办。隐式求解类5373/5394/5626/40139保留未覆盖状态、推迟到最后；15276的fd12已由用户核验为12并加入seeds。四个暂缓点在seeds中仅作注释，不用SKIP隐藏未完成工作。少量格式损坏、隐式循环变量或多局部函数直接用已说明来源的seeds处理，避免为个例增加解析语言。


原生准确性补丁与native-status的缺失/理想状态分开：保留原始引擎观测，数值求值先屏蔽清单中的旧atlas值，再计算补丁。requires_recipe统一依赖闭合、深度、长度、共轭预算和类型；SelectedGraph以native_overrides声明必须存在的节点，missing/cycle不能因编号小而跳过。补丁类型优先于原生状态。当前方向锚点不引用补丁；后续清单若改变这个条件，会拒绝构建，要求重新生成方向或登记显式节点。提取缓存计入补丁编号集，位置缓存同时计入实际配方和编号集。

前端仅将字面量扩展号或登记原生号送入同一配方构建器，括号/小数/科学计数法的整数等价字面量也适用；动态表达式仍由GeoGebra处理。下游prepare/render同样走补丁，不仅顶层命令替换。native-patches.txt为手动输入，修改后须build；verify会检查每条生成补丁与清单完全一致。已补13个准确性差异及369；368/370/1144保留原生未支持记录并暂缓隐式选根，不计作已修复。
