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
| `reasoning/` | 推理问题、中间表示、条件选择、证明和后端；详见该目录 README。 |
| `settings/`、`interaction/`、`geometry/` | 对象偏好、画布联动和共享几何运算。 |

数据从引擎适配器进入分析与推理，再由各自的界面组件呈现；工作区编排负责连接这些部分。组件按用户界面职责归类，算法和持久化不放入组件目录。新增功能应优先放在所属领域，测试与实现放在同一领域附近；公共类型和配置仍保留在功能目录根部。

本次整理保留现有算法、持久化键、引擎协议和用户交互。`useGeoGebraStudio` 仍集中管理工作区生命周期及异步操作，未来若继续拆分，需要特别保持恢复、重置和自动保存之间的顺序及取消机制。
