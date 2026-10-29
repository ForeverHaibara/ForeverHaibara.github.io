# 命名非几何中间量：首版实现

日期：2026-10-29。实验与设计背景分别见 [性能记录](benchmarks/named-intermediates-performance.md) 和 [历史规划](named-intermediates-plan.md)。未来允许几何辅助对象的调查与分阶段方案见 [几何扩展计划](named-intermediates-geometry-plan.md)。

## 用户行为

Workspace settings → Behavior → Custom tool performance 使用 **Low / Medium / High** 三档，当前默认 High，保存在浏览器本地。旧版关闭／开启偏好分别迁移到 Low／Medium。Medium 沿用下面的非几何辅助对象；High 额外允许经过验证的几何辅助对象。设置只影响以后从本站命令栏执行的合格自定义工具；已有构造、原生 GeoGebra 输入栏、文件工具和 `.ggb` 文件本身的语义不变。输出依然是原生 GeoGebra 对象，保存后不依赖本站脚本更新。

当前启用命名路径的 builder 重载：五条直线／射线／线段输入的 `Conic`，带编号 `i` 的 `Pretangential(F,P,i)`，以及 `PolarConic(P,F)`、`HessianCubic(F)`、`MixedPolar(P,Q,F)`、`JacobianCubic(q1,q2,q3)`、三次曲线输入的 `OrthicAxis(F)`、`Poloconic(l,F)`、方向约束重载 `CircularCubic(A,B,C,D,E,F,l)`、五点及七点重载 `NodalCubic(...)`。这是按 builder／重载选择的白名单，不按输入文本中的命令名称替换。`QACu1Inv` 的实验收益不稳定，`QLQu3` 含点值绑定，继续用匿名路径；其它较快或尚未验证的工具也保持原状。

High 档的首个几何试点是 `QLCi3(A,B,C,D)`（别名 `MiquelCircle`）：把两个交点与四个三角形中心建成六个隐藏的点型 auxiliary 对象。实机对照保持圆的类型、方程和动态更新一致；样本创建约 56→11 ms。关系图在验证 XML auxiliary 元数据后收缩这六个点，构造源不再为它们读取坐标。实机还验证了 `.ggb` 导出重开后辅助点与输出仍在、删除输出后孤儿辅助点被清理。其它含几何绑定的重载尚未启用。

## 编译与安全边界

`bind()` 只维护一套公式；编译时捕获绑定节点，匿名降低器保留原来的 `Element(Zip(...),1)`，命名降低器生成有依赖顺序的辅助赋值。只有全部绑定均有显式类型、节点数不超过 128、没有 `Zip`／`KeepIf`／`Sequence`／`Curve`／`Sum`／`Product` 作用域时，才物化整个调用。未通过检查则完整回退匿名路径。Medium 只允许数值、数值列表与函数；High 可接受经过重载白名单审核的几何绑定。未知类型、未验证的几何值、含几何元素的列表不进入命名路径。输出重定义也回退匿名，避免改变原生替换语义。

辅助标签含每次调用随机生成的 16 位十六进制组 ID。执行前检查现有标签是否冲突；执行后核对对象类型和正式输出是否确实存在。原生 API 可能在最终输出失败后仍报告多行命令成功，因此执行器会清除本次新增对象并返回错误。辅助对象被标为 auxiliary，隐藏图形与标签，且不进入命令结果、补全、样式管理和自定义工具重载环境。依赖分析会收缩辅助节点，保留用户对象之间的依赖。

一次成功调用在前后建立 GeoGebra 撤销点。删除或重命名对象后，生命周期协调器依据 `.ggb` 中的辅助标记和实际对象定义检查整个组；只在没有外部引用时删除孤儿。用户对象引用任一辅助标签时保留该组。清理过程跳过正在执行的组。若原生元数据或定义无法读取，放弃清理，不猜测删除。原生输入栏直接重定义输出但不发出删除／重命名事件时，孤儿要等下一次相关事件才会检查。

## 验证与后续扩展

真实引擎对普通、混合线型与平行线退化的五线 `Conic`，`Pretangential` 的四个编号，以及 `PolarConic`、`HessianCubic`、`MixedPolar`、`JacobianCubic` 比较了开关前后的类型、显示结果和输入变化后的更新。第二阶段还比较了 `OrthicAxis(F)`、`Poloconic(l,F)`、方向约束 `CircularCubic`、五点及七点 `NodalCubic`；测试脚本对这些新增路径逐字核对创建前后及输入变化后的显示方程。还验证了部分执行失败的回滚、撤销／重做、`.ggb` 导出重开、用户引用保护与孤儿清理。单元测试覆盖默认匿名文本、白名单、重载限制、作用域回退、输出校验和语义图收缩。第二阶段的筛选数据见 [扩展实验](benchmarks/named-intermediates-expansion.md)。

以后增加工具时，在 builder 的 `bind()` 声明值类型，先补普通／退化／动态／文件重开等价测试和创建、更新性能数据，再把已验证的重载加入 `NAMED_OVERLOADS`。不要仅因表达式长就启用命名路径。首版不自动物化某些绑定而保留其它绑定，也不写 CAS；这两项需要独立的作用域与依赖语义验证。
