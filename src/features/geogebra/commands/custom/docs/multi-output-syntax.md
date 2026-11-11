# 多输出工具的参数展开与解包命名

已接入站内命令栏和工具库的 `compose` 定义。原生 GeoGebra 引擎验收待运行。

## 语法

```text
O1 = TriangleCenter(...IntouchTriangle(A,B,C), 3)
(D,E,F) = IntouchTriangle(A,B,C)
O2 = TriangleCenter(D,E,F,3)
I2 = Incenter(D,E,F)
```

`...` 将一个构造的各个输出按原顺序接到外层参数序列中。首批允许参数位置上的 `...Tool(...)`，也允许普通参数与多个展开项混用。每个展开项的操作数必须完整占据一个参数，前缀与命令之间可有空白。展开后的点按普通实参处理，外层命令可为原生命令或站内工具。

`(D,E,F) = Tool(...)` 将三个槽依次命名为 D、E、F。左侧仅含标签，右侧是一个完整的多输出工具调用。标签数必须等于槽数。首批采用不同且尚未占用的标签，便于把一条命令作为一组提交和撤销。保留现有的 `D = Tool(...)` 写法，它给首槽命名，其余槽由 GeoGebra 自动命名。

| 写法 | 结果 |
| --- | --- |
| `IntouchTriangle(A,B,C)` | 依次生成 BC、CA、AB 上的接触点，使用原生自动标签。 |
| `(D,E,F) = IntouchTriangle(A,B,C)` | 依次生成 D、E、F，可在图形区独立选中。 |
| `IntouchTriangle(A,B,C,2)` | 只生成 CA 上的接触点。 |
| `TriangleCenter(...IntouchTriangle(A,B,C),3)` | 生成内接触三角形的外心。三个接触点作为表达式参数使用，命令结果只有外心。 |
| `Midpoint(P,IntouchTriangle(A,B,C))` | 保持当前嵌套行为，第二个参数取 BC 上的接触点。 |

## 选择 `...`

Python 的 `f(*xs)` 和 JavaScript 的 `f(...xs)` 都能把迭代对象按顺序传成多个位置参数。两种写法在完整实参的开头都可以用局部语法消歧。这里借用的是参数展开的记号，展开项的数量由工具重载在编译时确定。[Python 调用规则](https://docs.python.org/3/reference/expressions.html#calls)、[ECMAScript 参数列表](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-argument-lists)

建议选 `...`。它在含乘法的数学表达式中更醒目，能保留 `2*Distance(A,B)` 的既有读法。GeoGebra 已用 `..` 表示整数区间，也用小数点。扫描时应先识别完整的三个 ASCII 点，只在一个实参的起始位置接受该前缀。测试应包含 `1..5`、`.5`、字符串中的 `"..."` 和带注释的多行命令。[GeoGebra 的列表语法](https://geogebra.github.io/docs/manual/en/Lists/)、[GeoGebra 的运算符](https://geogebra.github.io/docs/manual/en/Predefined_Functions_and_Operators/)

现有 `outerCalls` 会忽略前一字符为点的标识符，直接把 `...IntouchTriangle(...)` 交给它会漏掉内层调用。应在解析外层实参时先剥离明确的展开前缀，再解析剩余的调用。解包也应在语句层识别，检查圆括号里的标签和顶层等号，兼容 `P=(x,y)`、`f(x)=...` 和普通几何等式。

## 返回值与输出槽

编译器内部使用有序、固定长度的**类型化槽数组**。数组元素包含该槽的表达式、类型和所依赖的绑定。它类似 TypeScript 中保存表达式的元组。提交构造时，解包和独立调用分别生成各槽的原生对象。用户需要 GeoGebra 列表时，可在命名后自行写 `L={D,E,F}`。

现有 `outputExpressions` 可作为首批工具的来源。`outputCount/outputOffset` 也能表示从候选列表中提取多个对象，但列表后端、哨兵偏移及运行时的解排序均属于工具内部。建议按重载声明哪些输出可以展开和解包，编译时核对声明的长度和类型与 builder 产生的槽一致。首批以有固定几何顺序的三点工具为主，比如 Intouch、Extouch、Medial、Morley、YffCentral 和 MacBeath。仅有固定槽上限的求解工具，例如 `ApolloniusProblem`，继续沿用现有多解输出契约，待确立稳定槽语义后再考虑开放。

一个槽可以随拖动成为 undefined，也能随后恢复。长度、顺序和标签都应保持。对已启用的重载，三个槽有两个当前有定义时，编译器仍传三个点参数，由原生构造决定最终结果是否有定义。编译阶段无需读取坐标或收集当前实解。

首批展开的对象是直接工具调用。原生列表、原生多解命令、任意表达式和文件宏目前缺少足够的静态槽契约，可给出明确诊断。保留文件宏对同名站内工具的优先级，避免把用户文件中的同名工具当成目录中的固定三点工具。

## 编译与共享

1. **识别消费方式。** 在标量位置继续选择首槽。展开项和解包右侧要求保留多输出结构，直到外层实参拼接或输出命名完成。现有编译器在递归返回前就清掉 `outputExpressions`，需要把这一步推迟到消费位置。
2. **按类型分派。** 内层重载只解析和展开一次。把它的各槽接入外层的类型化实参序列后，再选择外层重载并推断返回类型。原生 `TriangleCenter` 和站内扩展编号共用入口，识别和预加载扩展配方时也应看到展开后的参数位置与字面量。例如展开后末位的中心编号仍应按现有规则处理。建议让预加载、工具调用检测和编译消费同一个语句结构。
3. **保留绑定身份。** 三个槽引用同一组内层 `bind` 节点。进入 `compose` 时，模板占位符替换要同时覆盖所有槽和共享绑定中的引用，并保留内外作用域隔离。应先保留节点及引用关系，再生成原生表达式。文本相同的两个独立调用仍有各自的作用域。
4. **按档位生成计划。** Low 内联各槽的原生表达式。一次内层编译会消除三次编号分派和重复的 `Element({…},i)` 包装，最终表达式仍可能重复求某些中间量。Medium 可把经允许的公共数值、数值列表和函数各生成一个命名辅助对象。High 可进一步复用经过原生验证的几何辅助对象，例如圆心、线和需要反复读取的顶点。对内层与外层的组合核对类型、作用域、对象预算和惰性分支，复用现有的匿名回落路径。特别注意 `Zip`、`Sequence`、`KeepIf` 的局部变量和 `If` 的分支，不能把依赖这些作用域的表达式提前提升到语句外。首批可只开放普通位置参数和经确认可保留语义的消费位置。[命名中间量设计](named-intermediates-implementation.md)

对目前只使用模板 `locals` 的工具，三个槽仍可能各自内联同一局部表达式。可先在确实重复求值的地方将局部量接到共享绑定图。例如 `IntouchTriangle` 的三个投影共用内心，Morley 的三个槽共用边长和角度。应分别记录内层编译次数和真实引擎求值成本，避免把表达式变短直接当成拖动加速。

## 圆工具的应用

```text
MandartCircle  = Circle(...ExtouchTriangle($A,$B,$C))
SpiekerCircle  = Incircle(...MedialTriangle($A,$B,$C))
MorleyCircle   = Circle(...MorleyTriangle($A,$B,$C,$k))
```

上面是旧圆命令的迁移写法。Morley 展开的是选定编号的三个顶点，原有额外顶点索引用于单点调用。MacBeath 和 YffCentral 通过对应三角形 builder 提供共享公式，展开路径保留这些绑定。目录的完整迁移表见下方圆工具精简计划。

## 命名执行与验收

- 解包先检查所有目标标签、右侧重载和槽数，然后按一个有序计划提交。成功时返回显式标签数组，并让后续命令直接引用这些对象。出现原生执行失败或某个预定标签未创建时，清理这条语句新增的输出及辅助对象。已有对象和本次语句之外的结果保持原有状态。解包应是一条撤销记录。
- 现有执行器只检查一个显式标签。解包计划需要携带完整标签表，在 Low 和命名路径上都核对全部输出。已创建的原生 undefined 对象仍算对应槽存在。内部辅助对象沿用隐藏、导出重开与孤儿清理机制。删除一个可见槽后，另外两个仍引用的公共辅助对象需要保留。
- 编译验收覆盖标准括号与既有方括号调用、嵌套展开、普通参数与展开混用、中心编号、错误槽数、标签重复、已占用标签、文件宏覆盖、编号单值误展开、字面量与注释，以及普通嵌套首槽兼容。
- 实机验收用 Intouch 测选择、命名、继续构造和撤销，用一个会出现 undefined 槽的三角形测试拖动恢复与槽顺序，用 Mandart、Spieker 和 Morley 比较原定义与展开写法。再检查三档的创建、拖动、辅助对象数和 `.ggb` 导出重开。

## 圆工具精简计划

以下替代式已通过编译检查。原有三角形命令和顶点编号继续可用。用户可以直接生成圆，也可以先解包三个顶点以便后续构造。

### 已移除的命令及迁移写法

| 圆命令 | 用户可输入的替代式 |
| --- | --- |
| `MandartCircle` | `Circle(...ExtouchTriangle(A,B,C))` |
| `SpiekerCircle` | `Incircle(...MedialTriangle(A,B,C))` |
| `MorleyCircle` | `Circle(...MorleyTriangle(A,B,C,k))`，省略 k 取第一种 |
| `TangentialCircle` | `Circle(...TangentialTriangle(A,B,C))` |
| `ReflectionCircle` | `Circle(...ReflectionTriangle(A,B,C))` 或 `Circle(...ReflectionTriangle(A,B,C,P))` |
| `MidheightCircle` | `Circle(...MidheightTriangle(A,B,C))` |
| `HexylCircle` | `Circle(...HexylTriangle(A,B,C))` |
| `IncentralCircle` | `Circle(...IncentralTriangle(A,B,C))` |
| `SymmedialCircle` | `Circle(...SymmedialTriangle(A,B,C))` |
| `ThirdLemoineCircle` | `Circle(...LemoineTriangle(A,B,C))` |
| `YffContactCircle` | `Circle(...YffContactTriangle(A,B,C))` |
| `TangentialMidArcCircle` | `Circle(...TangentialMidArcTriangle(A,B,C))` |
| `YiuCircle` | `Circle(...YiuTriangle(A,B,C))` |
| `InnerVectenCircle` | `Circle(...InnerVectenTriangle(A,B,C))` |
| `OuterVectenCircle` | `Circle(...OuterVectenTriangle(A,B,C))` |
| `OuterNapoleonCircle` | `Circle(...OuterNapoleonTriangle(A,B,C))` |
| `InnerNapoleonCircle` | `Circle(...InnerNapoleonTriangle(A,B,C))`。等边时若需要保留旧命令的零半径写法，可用 `Circle(Centroid(A,B,C),InnerNapoleonTriangle(A,B,C,1))`。 |
| `IntangentsCircle` | `Circle(...IntangentsTriangle(A,B,C))` |
| `ExtangentsCircle` | `Circle(...ExtangentsTriangle(A,B,C))` |
| `YffCentralCircle` | `Circle(...YffCentralTriangle(A,B,C))` |
| `MacBeathCircle` | `Circle(...MacBeathTriangle(A,B,C))` |

YffCentral 在 Medium／High 共享三槽数值，MacBeath 在 High 额外共享中心点。Napoleon 的三点写法与原重心短式的拖动成本待原生测量。第一、第二 Lemoine 圆各有独立定义，表中只涉及第三 Lemoine 圆。`YiuCircles` 输出的是用来定义 Yiu 三角形的三个圆，也继续保留。

### 建议保留的边界项

| 圆命令 | 保留理由 |
| --- | --- |
| `BevanCircle` | 有独立名称的经典圆，保留直接入口。现有命令也可用 Bevan 点与 (2R) 定圆。 |
| `FuhrmannCircle` | 有独立名称的经典圆，保留直接入口及垂心、Nagel 点作直径的短构造。 |
| `PedalCircle` | 常用的随点变化圆，保留直接入口。 |
| `OrthocentroidalCircle` | 直接以垂心和重心作直径。两点重合时可保留点圆极限，三点式此时三槽重合。 |
| `CevianCircle` | 直接用齐次条件生成 conic，保留塞瓦迹点在无穷远和迹点共线时的直线极限。 |
| `SpiekerRadicalCircle` | 是三个旁切圆的根圆，独立于拟移除的 `SpiekerCircle`，并保留有符号半径平方。 |

其余圆命令本轮保留。典型的有九点圆、Brocard 圆、Lester 圆等具名圆，极圆、根圆、正交视圆等保留退化的构造，以及 Conway、Adams、Tucker、ApolloniusProblem 和各相切圆族。它们没有表中那种由已有三点命令直接给出的替代。

站内命令目录、分类、补全来源和交叉引用已同步更新。已保存的原生构造按现有依赖关系加载。回放使用旧命令名的输入时，可按表替换。原生退化表现和创建、拖动性能待实机核对。
