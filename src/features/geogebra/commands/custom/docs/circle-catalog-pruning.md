# 圆工具精简计划

以下替代式使用[拟议的多输出展开语法](multi-output-syntax.md)。待展开语法可用，再按一般位置和退化构形核对替代式。保留原有三角形命令和顶点编号。用户可以直接生成圆，也可以先解包三个顶点以便后续构造。

## 建议移除

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
| `IntangentsCircle` | `Circle(...IntangentsTriangle(A,B,C))` |
| `ExtangentsCircle` | `Circle(...ExtangentsTriangle(A,B,C))` |
| `YffCentralCircle` | `Circle(...YffCentralTriangle(A,B,C))` |
| `MacBeathCircle` | `Circle(...MacBeathTriangle(A,B,C))` |

YffCentral 和 MacBeath 的坐标计算由对应三角形提供。现有圆 builder 在一次构造中共享三槽中间量，移除前要确认展开式也能共享。外 Napoleon 圆目前用重心和一个顶点定圆，移除前比较其短式与三点式的拖动成本。第一、第二 Lemoine 圆各有独立定义，表中只涉及第三 Lemoine 圆。`YiuCircles` 输出的是用来定义 Yiu 三角形的三个圆，也继续保留。

## 建议保留的边界项

| 圆命令 | 保留理由 |
| --- | --- |
| `BevanCircle` | 有独立名称的经典圆，保留直接入口。现有命令也可用 Bevan 点与 (2R) 定圆。 |
| `FuhrmannCircle` | 有独立名称的经典圆，保留直接入口及垂心、Nagel 点作直径的短构造。 |
| `PedalCircle` | 常用的随点变化圆，保留直接入口。 |
| `InnerNapoleonCircle` | 等边时内 Napoleon 三角形三个顶点重合。现有重心加半径写法仍能表达半径为零的极限。 |
| `OrthocentroidalCircle` | 直接以垂心和重心作直径。两点重合时可保留点圆极限，三点式此时三槽重合。 |
| `CevianCircle` | 直接用齐次条件生成 conic，保留塞瓦迹点在无穷远和迹点共线时的直线极限。 |
| `SpiekerRadicalCircle` | 是三个旁切圆的根圆，独立于拟移除的 `SpiekerCircle`，并保留有符号半径平方。 |

其余圆命令本轮保留。典型的有九点圆、Brocard 圆、Lester 圆等具名圆，极圆、根圆、正交视圆等保留退化的构造，以及 Conway、Adams、Tucker、ApolloniusProblem 和各相切圆族。它们没有表中那种由已有三点命令直接给出的替代。

实施时先验证展开，再移除表中的目录项，并同步处理分类、补全、交叉引用和现有调用。旧命令名可在迁移说明中配对应的展开写法。退化行为或性能尚未核对的项留待核验。
