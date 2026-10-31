# 分阶段系数后端：七条暂缓曲线的复查

2026-10-30–31。正式接入 **Q070、Q109**；Q007、Q031、Q072、Q092、Q106 保留为可复现的实验候选。当前正式库为 194 个记录、192 个目录编号，11 个编号仍暂缓。沿用现有 500,000 字符、128 个绑定节点与 Medium/High 限制。

七条均已解决原先的生成/编译预算障碍，通过来源特征点和完整多项式恒等式检查，也都完成了普通位置的原生主流程。但其中五条没有通过平移后的数值精度检查，未因此放宽原有测试阈值，也没有将它们作为正式命令发布。

## 来源与离线结果

逐页读取来源和明确链接的 TXT/RTF，有效资料请求单并发、间隔至少五秒。来源定义保留在轻量 JSON 中；没有自动采集更新或快照核验系统。

| 来源 | 次数 | 约去的局部 `h` 次数 | 边长平方齐次次数 | 标准编译计划字符数 / 辅助数值对象 |
| --- | ---: | ---: | ---: | ---: |
| [Q007](http://bernard-gibert.fr/curves/q007.html) / [TXT](http://bernard-gibert.fr/curves/Resources/Q007.txt) | 8 | 5 | 6 | 100,789 / 213 |
| [Q031](http://bernard-gibert.fr/curves/q031.html) / [TXT](http://bernard-gibert.fr/curves/Resources/Q031.txt) | 9 | 5 | 5 | 149,378 / 244 |
| [Q070](http://bernard-gibert.fr/curves/q070.html) / [TXT](http://bernard-gibert.fr/curves/Resources/Q070.txt) | 7 | 6 | 7 | 73,158 / 198 |
| [Q072](http://bernard-gibert.fr/curves/q072.html) / [TXT](http://bernard-gibert.fr/curves/Resources/Q072.txt) | 9 | 9 | 6 | 142,925 / 254 |
| [Q092](http://bernard-gibert.fr/curves/q092.html) / [TXT](http://bernard-gibert.fr/curves/Resources/Q092.txt) | 8 | 8 | 8 | 108,682 / 220 |
| [Q106](http://bernard-gibert.fr/curves/q106.html) / [RTF](http://bernard-gibert.fr/curves/Resources/Q106.rtf) | 10 | 8 | 14 | 269,417 / 269 |
| [Q109](http://bernard-gibert.fr/curves/q109.html) / [RTF](http://bernard-gibert.fr/curves/Resources/Q109.rtf) | 8 | 5 | 4 | 80,828 / 162 |

计划长度按输出及辅助赋值的名称、表达式求和，使用固定长度组标签，不含最终命令分隔符。下面原生表格的 `expandedLength` 另含完整执行文本，口径稍有不同。辅助对象数不是绑定组节点数。

来源有限点在边长 13/14/15、5/6/7、7/8/9 三组三角形上精确核验。使用 X1、X3、X4、X20 以及 Q109 的三个垂足，不依赖高编号 TriangleCenter 的可用性。Q007 另核对反角共轭关系：将 Q008 代入 `(a2*v*w,b2*w*u,c2*u*v)`，除去 `(u*v*w)^2` 后，恰为 Q007 乘 `-a2^2*b2^2*c2^2`。这是完整符号系数比较，不代表反角映射在三边上逐点有定义。

## 生成算法的改进

[最初的相似坐标方案](gibert-pedal-integration.md)运行时已经分阶段，但离线生成仍把边长替换与重心框架替换一次性放进大表达式。Q106 的整体展开长时间未完成；仅把输出写成更短的 Horner 形式解决不了这部分作者侧成本。

新生成器先按重心单项式分组，然后在精确有理多项式环中：

1. 预计算 `(t²+h²)^j`、`((t−1)²+h²)^i`，先合并每个来源系数中的边长替换，消去这一步的重复项。
2. 预计算三个局部重心线性式的幂，在 `QQ[t,h][x,y]` 中复合。避免将尚未合并的巨大边长表达式反复与坐标幂分配相乘。
3. 通过多项式指数直接除去已确认的公共 `h` 次数，随后提取局部系数、因式分解和公共子表达式。无需对一个本来就是多项式的结果调用通用有理式约分。

这使七条都能完成生成；Q018/Q020 的既有生成数据也通过逐字一致性检查。运行时仍为同一分阶段系数后端，未改变旧 190 条世界系数配方或引入运行时 CAS。新生成器的 `--source` / `--output` 参数允许在独立候选文件上实验，不必先改正式支持列表。

## 独立恒等式与测试推广

次数不再假定为八次。令来源次数为 d、局部公共因子为 `h^k`，局部结果为 L；逆变换为：

```text
S=u+v+w
X=(v+t*w)/S, Y=h*w/S
L_hom = S^d * L(X,Y)
h^k * L_hom = h^d * F((t-1)^2+h^2,t^2+h^2,1;u,v,w)
```

检查器从电路重建 L，独立地沿逆变换恢复齐次重心式，比较完整多项式；没有复用生成器的正向复合过程。还检查数值节点不含曲线变量、系数数量、一般/等腰/反射/等边特化与非轴向世界坐标。三角形特化若使来源成为零多项式，应由系数守卫拒绝，而不是假定所有曲线在等边时都必须非零。

修正了原检查器世界尺度因子中只适用于八次的常数；转换单元测试现覆盖七至十次。原生夹具仍从来源方程用精确有理数计算，只在存储数值时舍入。顶点也记录其真正的来源值，不能对 Q070 这样的非 circum 曲线一律断言 A/B/C 在曲线上。

## 原生实测

GeoGebra 5.4.920.0，Windows / Chrome 156。均为单次观察；有其他离线检查和实验页运行，不是独占性能基准。移动计时为 `setCoords` API 返回时间，不是完整绘制帧率。

| 曲线 / 档位 | 完整执行文本 | 创建 | 移动中位数 | 总对象数 | 最终处置 |
| --- | ---: | ---: | ---: | ---: | --- |
| Q070 / Medium | 73,556 | 7.54 s | 29.0 ms | 202 | 正式接入 |
| Q109 / High | 81,154 | 9.30 s | 34.8 ms | 166 | 正式接入 |
| Q007 / Medium | 101,217 | 12.29 s | 38.4 ms | 217 | 实验候选 |
| Q031 / High | 149,868 | 14.06 s | 37.8 ms | 248 | 实验候选 |
| Q072 / Medium | 143,435 | 19.42 s | 51.5 ms | 258 | 实验候选 |
| Q092 / High | 109,124 | 8.95 s | 26.9 ms | 224 | 实验候选 |
| Q106 / High | 269,957 | 26.35 s | 55.2 ms | 273 | 实验候选 |

七条普通位置主流程均通过：原生隐式曲线类型、随 C 移动、来源点、共线/重合恢复、等边、原子撤销重做、导出重开后的动态依赖、辅助清理。总对象数另含三个输入点和输出。Q106 首次创建仍明显偏慢；主流程成功不等于所有位置和支线都已稳定。

### 平移暴露的数值限制

专项使用旋转、反射、平移缩放、近等腰和近共线五组三角形；每组比较八个普通/边/外接圆及其附近位置，并比较三个顶点的来源值。沿用普通采样归一化差异 `<1e-6`、顶点归一化差异 `<1e-8` 的阈值。

在 `A=(10,-7), B=(13,-7), C=(10.5,-5)` 上：

| 曲线 | 普通采样最大差异 | 三顶点最大差异 | 专项结果 |
| --- | ---: | ---: | --- |
| Q070 | 1.57×10⁻⁹ | 8.15×10⁻¹⁰ | 五组全部通过 |
| Q109 | 3.88×10⁻⁹ | 2.69×10⁻⁹ | 五组全部通过 |
| Q007 | 3.62×10⁻⁸ | 2.80×10⁻⁸ | 平移组未过顶点阈值 |
| Q031 | 8.25×10⁻⁷ | 7.52×10⁻⁷ | 平移组未过顶点阈值 |
| Q072 | 1.43×10⁻⁷ | 1.26×10⁻⁷ | 平移组未过顶点阈值 |
| Q092 | 9.34×10⁻⁸ | 7.42×10⁻⁸ | 平移组未过顶点阈值 |
| Q106 | 4.32×10⁻⁷ | 4.47×10⁻⁷ | 平移组未过顶点阈值 |

五条候选在旋转、反射组通过，在第三组失败即停止；没有宣称已完成后续两组。以上是按方程尺度归一化的数值差异，不是点到曲线的距离，也不能单凭它断言支线或拓扑丢失。这些观察与高次世界单项式的消差一致；目前尚未分别量化局部系数计算、平移系数形成及原生方程求值各自的误差。

另尝试让 Q106 的旋转后系数直接乘 `(x-Ax)^i*(y-Ay)^j`，交给原生引擎处理平移，以减少显式辅助量。该页长时间无响应，未通过原生验收；实验开关与运行时代码已移除。没有仅凭文本变短、对象减少就采用它。

原始数据：[主流程、专项和编译测量](gibert-similarity-expansion.json)。[Q106 截图](gibert-similarity-expansion.png)仅展示实验候选的普通位置主流程，不能作为稳定接入的证据。

正式集合定稿后，Q109 主流程再次通过（创建 6.32 s、更新中位数 21.9 ms），[截图](gibert-similarity-supported.png)展示其重建结果；独立实验入口也成功复现 Q007 的平移残差失败。两次 Q109 测量存在波动，不据此作严格的性能倍数比较。

## 正式库与实验库

- `curves.json` / `relatedCurveCircuits.json`：正式支持；本轮增加 Q070/Q109。
- `deferred.json` / `relatedCurveCandidates.json`：保留五条数学定义与生成电路，默认不注册到命令目录，不增加生产包的候选数据。
- 两个隔离原生验证页接受 `experimental=1`，只在该实验页的内存表中开启选定候选；生产页面不导入这个入口。这样可以复现失败，不需要反复下载或手改正式文件。

后续先分离并改善数值误差，再考虑这五条正式接入。Q007 的反角共轭关系已严格成立，可以继续研究更适合引擎的变换或几何后端；关系本身不能消除最后的世界坐标消差。其余 Q000/Q013/Q015/Q035/Q077/Q078 的障碍仍是来源、族成员或独立特征点核验，本轮未将它们当作系数性能问题处理。

最终检查：正式集与实验集生成一致性、各自的完整符号恒等式、全部来源点、精确原生夹具检查通过；Vitest 58 个文件 / 528 项通过，TypeScript 和生产构建通过。正式电路 JSON 为 25,851 字节，实验电路为 62,576 字节；实验数据只由作者验证页和测试导入。生产主包约 7.134 MB、gzip 1.330 MB，仍有既有的大 chunk 与 Gradio 浏览器兼容提示。临时网页缓存和剖析脚本已清理。

## 复现

正式集使用原有生成/检查命令；实验集使用：

```text
python scripts/geogebra/tools/generate_related_curve_circuits.py --source src/features/geogebra/commands/custom/data/related-curves/deferred.json --output src/features/geogebra/commands/custom/generated/relatedCurveCandidates.json --check
python scripts/geogebra/tools/check_related_curve_circuits.py --source src/features/geogebra/commands/custom/data/related-curves/deferred.json --circuits src/features/geogebra/commands/custom/generated/relatedCurveCandidates.json
python scripts/geogebra/tools/check_related_curve_points.py --include-deferred
python scripts/geogebra/tools/experiment_related_curve_transforms.py src/features/geogebra/commands/custom/data/related-curves/deferred.json
```

启动 Vite 后，正式主流程使用 `/scripts/geogebra/browser/geogebra-gibert-smoke.html?id=70&mode=medium&history=1` 或 `id=109&mode=high&history=1`。专项使用 `/scripts/geogebra/browser/geogebra-gibert-structured-smoke.html?id=70` 或 109。对实验候选添加 `experimental=1`；例如 `id=106&experimental=1` 可复现其专项精度失败。
