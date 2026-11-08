# GeoGebra Studio 结构

GeoGebra 页面入口在 `src/pages/geogebra/GeoGebraStudioPage.tsx`，负责把工作区状态交给界面。功能代码集中在本目录：

| 目录 | 职责 |
| --- | --- |
| `studio/` | 工作区编排：引擎生命周期、偏好、草稿、导入导出和分析状态。 |
| `components/studio/` | 工作区外壳、画布、侧栏、文件操作和共享图标。 |
| `components/command/` | 命令输入、补全与拼写提示界面。 |
| `components/settings/` | 工作区、对象样式和证明设置界面。 |
| `components/analysis/` | 依赖图、发现关系及筛选、详情的展示。 |
| `components/reasoning/` | 条件选择、推理工作区和证明展示。 |
| `adapters/` | GeoGebra 嵌入、脚本加载和引擎适配。 |
| `persistence/` | 本地草稿存储和 GGB 文件编解码。 |
| `commands/` | 命令解析、执行、补全及自定义工具编译。 |
| `analysis/` | 作图依赖图与数值关系发现；算法和 Worker 见该目录 README。 |
| `commands/reference/`、`components/reference/` | 工具参考的数据索引和共享阅读界面。 |
| `reasoning/` | 推理问题、中间表示、条件选择、证明和后端；详见该目录 README。 |
| `settings/`、`interaction/`、`geometry/` | 对象偏好、画布联动和共享几何运算。 |

数据从引擎适配器进入分析与推理，再由各自的界面组件呈现；工作区编排负责连接这些部分。组件按用户界面职责归类，算法和持久化不放入组件目录。新增功能应优先放在所属领域，测试与实现放在同一领域附近；公共类型和配置仍保留在功能目录根部。

本次整理保留现有算法、持久化键、引擎协议和用户交互。`useGeoGebraStudio` 仍集中管理工作区生命周期及异步操作，未来若继续拆分，需要特别保持恢复、重置和自动保存之间的顺序及取消机制。

## 维护工具参考

普通工具来自 `studioToolCatalog`。新增工具时在工具库里维护名称、描述、别名和重载，参考页会自动显示这些信息。分类在 `commands/reference/referenceNotes.ts` 的 `toolGroups` 中维护，嵌套对象表示子分类，叶节点数组列出正式名称。跨领域命令可以加入多个顶级分类，搜索结果只显示一条。同一顶级分类内不要重复列出工具，分类检查会报告完整路径。暂未归类的工具会出现在 Other constructions。

在同一文件的 `referenceNotes` 中按正式名称补充示例、限制、相关工具和常用搜索词。搜索已覆盖名称、别名、分类和描述，补充词只需填写这些字段里没有的术语。示例使用 Studio 命令栏可执行的语法，并说明依赖的点或对象。

在 `advancedCommands` 注册特殊命令后，参考页会自动将其放进 Special commands，签名从注册数据读取。可选说明以带 `!` 的命令名作为键，例如 `!nearestTriangleCenter`。普通命令和特殊命令各自保留可分享的链接。

需要按分类整理工具库时，运行 `node scripts/geogebra/tools/sort_tool_library.mjs` 预览，再加 `--write` 写入。脚本按分类树的首次出现顺序排列，报告跨分类重复项，将未分类工具按原顺序放在末尾。分类引用不存在的工具时会停止，并在写入前验证工具数据完整。使用 `--check` 可以在需要排序时返回非零退出码。
