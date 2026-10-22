# 向量积计划：本轮实验记录与复现

日期：2026-10-22。调研基线：仓库 HEAD `b5bb566`，开始时工作区干净。关联 [联合计划](vector-products-plan.md)、[数学推导](vector-products-math.md)。

## 1. 做了什么与没有验证什么

本轮阅读了 TypeScript 发现／条件建议／IR／AG2 编译／证明协议，以及 Python 桥接、精确来源消元、DDAR 适配和固定上游源码。使用本地 Python 3.14.2、现有 NumPy 和 SymPy，执行了不落地为代码文件的分析脚本。

- 未修改运行实现、测试、配置或固定上游。
- 未打开或修改用户的 GGB 构图，没有辅助点。
- 下面的基准是手工编码几何前提后的原生桥接输入，**不是已经跑通的“GGB 命令 → 自动发现 → 自动建议 → 新向量证明”端到端测试**。
- 数学恒等式核验使用形式坐标，不用数值看起来正确冒充恒等证明。
- 未运行全仓库测试、构建或浏览器 Worker 回归；文档变化不需要用这些运行结果声称新增能力已实现。

所有导入均使用 `python -B` 或 `sys.dont_write_bytecode=True`，避免在静态资源目录生成缓存。

## 2. 原生 DDAR 对照

### 2.1 问题 A

六点：

```text
a=(1/3,4/3), b=(−1,0), c=(1,0), m=(0,0),
h=(1/3,2/3), d=(3/17,12/17).
```

前提：

```text
coll b m c
cong b m m c
perp a h b c
perp b h a c
coll a m d
perp h d a m
```

两个独立的边比目标：

```text
distmeq b m a m m d m b 1 -1 -1 1 1
distmeq b m a m b d a b 1 -1 -1 1 1
```

分别表达 `BM/AM=MD/MB` 和 `BM/AM=BD/AB`。当前 `check` 与 `proof` 均返回 `[false,false]`，单次约 27 ms，不含 GGB 或浏览器初始化。

结果不表示目标为假，也不表示加入任意别的前提后仍不可解；它给出这组有明确几何意义前提的当前基线。数学文档给出不添加额外结论的向量推导。

### 2.2 问题 B

八点：

```text
a=(1,0), b=(0,0), c=(0,7/5), d=(11/5,3/5),
e=(34/25,57/25), f=(11/10,3/10), g=(17/25,46/25),
h=(374/545,627/545).
```

前提包括 B 处直角、ABC 与 ADE 的两条边比、F/G 的中点，以及 H 的两条共线关联。

第一轮只有边比，当前引擎基于坐标朝向处理相似：`BG=DG, AH∥FG, FG⊥BD, AH⊥BD` 的 checks 全为 false；但可推出 `DA⊥DE`。这里当前朝向分支属于既有引擎的条件性语义，不能据此当作未来逆相似 IR 的替代品。

第二轮显式再加入两条逆向有向角约束：

```text
angeq a b a c a d a e 1 -1 1 -1 0
angeq b a b c d a d e 1 -1 1 -1 0
```

检查结果依旧为：

| BG=DG | AH∥FG | FG⊥BD | AH⊥BD | DA⊥DE |
| --- | --- | --- | --- | --- |
| false | false | false | false | true |

`proof` 单次约 84 ms。再将未来线性积层能得到的 `BG=DG`、`FG⊥BD` 作为**对照实验中的额外输入**，输出变为 `[true,false,true,false,true]`，约 93 ms。新增输入对应的 true 是“已给定”，不应被称为新推导。

这说明不能把 AH 垂直的能力承诺建立在“先给 DDAR 这两个结果，它大概会解出来”的猜测上。数学文档为 AH 垂直提供了额外的精确四次证书。

这些测试未推出的目标没有被转换成前提。`gapIds` 在这些运行中为零也不说明失败目标已有完整证明：未推出的目标本身没有可供回放的证明图。

### 2.3 可复现的原生输入脚本

在仓库根目录将以下内容交给 `python -B -`。这是文档中的复现实验，不是新增的项目脚本：

```python
import json
import sys
from fractions import Fraction as F
from pathlib import Path

sys.dont_write_bytecode = True
root = Path.cwd()
sys.path[:0] = [str(root / "public/geometry-reasoning"),
                str(root / "public/vendor/alphageometry2")]
from ag2_bridge import solve_json


def run(name, points, assumptions, goals, operation="proof"):
    declarations = "; ".join(
        f"{key}@{float(x)}_{float(y)} = "
        for key, (x, y) in points.items())
    data = {"version": 1, "operation": operation, "goalId": "test",
            "premise": declarations + ", ".join(assumptions),
            "goals": goals}
    answer = json.loads(solve_json(json.dumps(data)))
    print(name, operation, answer["checks"], answer["elapsedMs"])


points_a = {
    "a": (F(1, 3), F(4, 3)), "b": (-1, 0), "c": (1, 0),
    "m": (0, 0), "h": (F(1, 3), F(2, 3)),
    "d": (F(3, 17), F(12, 17)),
}
assumptions_a = [
    "coll b m c", "cong b m m c", "perp a h b c",
    "perp b h a c", "coll a m d", "perp h d a m",
]
goals_a = [
    "distmeq b m a m m d m b 1 -1 -1 1 1",
    "distmeq b m a m b d a b 1 -1 -1 1 1",
]
for operation in ("check", "proof"):
    run("A", points_a, assumptions_a, goals_a, operation)

points_b = {
    "a": (1, 0), "b": (0, 0), "c": (0, F(7, 5)),
    "d": (F(11, 5), F(3, 5)), "e": (F(34, 25), F(57, 25)),
    "f": (F(11, 10), F(3, 10)), "g": (F(17, 25), F(46, 25)),
    "h": (F(374, 545), F(627, 545)),
}
assumptions_b = [
    "perp b a b c",
    "distmeq a b a d a c a e 1 -1 -1 1 1",
    "distmeq a b a d b c d e 1 -1 -1 1 1",
    "angeq a b a c a d a e 1 -1 1 -1 0",
    "angeq b a b c d a d e 1 -1 1 -1 0",
    "coll b f d", "cong b f f d", "coll c g e", "cong c g g e",
    "coll b e h", "coll c d h",
]
goals_b = ["cong b g d g", "para a h f g", "perp f g b d",
           "perp a h b d", "perp a d d e"]
run("B-directed", points_b, assumptions_b, goals_b)
run("B-extra-givens", points_b,
    assumptions_b + ["perp f g b d", "cong b g d g"], goals_b)
```

预期 checks 依次为：

```text
A check:        [False, False]
A proof:        [False, False]
B-directed:     [False, False, False, False, True]
B-extra-givens: [True,  False, True,  False, True]
```

性能数值是本机单次观察，不是基准统计或运行时保证。

## 3. 符号恒等式核验

以下项目本轮已核验：

| 项目 | 方法 | 结果 |
| --- | --- | --- |
| 逆相似二式的正负号 | 一般反向相似矩阵 `[[r,t],[t,−r]]` 作用于向量，符号展开 | 点乘差、叉乘差均为 0 |
| A 的高线、投影与目标积 | `A=(p,q), B=(−1,0), C=(1,0)` 的一般参数代入 | 四个有理余式均为 0 |
| B 的 BG²−DG² | 一般 x,y,k，按题面构造 E 和 G | 严格为 0 |
| B 的 FG·BD | 同上 | 严格为 0 |
| B 的 AH·BD | 一般 x,y,k，符号求 BE/CD 交点 | 在分母非零的定义域内严格为 0 |
| B 的线性证书 `S=R−T+f₀` | 独立形式坐标展开 | 严格为 0 |
| B 的四次证书 | a,c,d,e,h 共十个独立形式坐标展开 | 严格为 0 |

最后一项不依赖 B 的数值实例，也不依赖用构造公式消去 E/H 后才成立：它本身就是任意五个平面向量的恒等式，因此适合作为规则证书。

下面是核心证书核验的完整短脚本（需要本地 SymPy，仅用于研究）：

```python
import sympy as s

ax, ay, cx, cy, dx, dy, ex, ey, hx, hy = s.symbols(
    "ax ay cx cy dx dy ex ey hx hy")
a = s.Matrix([ax, ay])
c = s.Matrix([cx, cy])
d = s.Matrix([dx, dy])
e = s.Matrix([ex, ey])
h = s.Matrix([hx, hy])


def cross(u, v):
    return u[0] * v[1] - u[1] * v[0]


f0 = a.dot(c)
R = a.dot(e) - a.dot(d) + c.dot(d) - a.dot(c)
X = cross(a, e) + cross(c, d) + cross(a, c) - cross(a, d)
C1 = cross(h, e)
C2 = cross(h - c, d - c)
K = cross(a, c)
Q = (h - a).dot(d)
rhs = (a.dot(a) * (C1 - C2) - R * cross(h, a) - X * h.dot(a)
       - f0 * (cross(h, 2 * a - d) + cross(a, d)))
assert s.expand(K * Q - rhs) == 0

T = (a - d).dot(e - d)
S = d.dot(c + e - d)
assert s.expand(S - (R - T + f0)) == 0
print("Both certificate identities are exact.")
```

恒等式核验不自动证明非零消去合法；`K≠0` 和 AH、BD 等方向非零的条件另见数学文档。也不据此宣称现有引擎已有高次回放器。

## 4. 尚待实施后的验证

需要将以上研究实例变成真正的结构化条件 fixture，再接发现、采样、混合证明与浏览器 Worker。尤其应加入：

- A 的一般三角形形变与镜像，且不命名反射点；H=A 或 D=H 时改用合法积条件。
- B 的一般 D 及退化 D，明确区分多项式零积和无效直线目标。
- 证明中删除任一必要条件、非零 guard 或篡改乘子后的拒绝结果。
- 没有接受条件时，即使坐标恰好满足目标也不得证明。
- 正相似与逆相似分支、单独点乘／叉乘判据的反例。
- 纯 AG2、混合检查、可读证明与 coverage 的一致性。

本轮仅提供可复核基线与数学证书，不把这些未来检查写为已通过。
