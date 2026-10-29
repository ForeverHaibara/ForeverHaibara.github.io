# Related Curves 来源与格式审计（P1）

2026-10-29。直接读取 [总目录](http://bernard-gibert.fr/relatedcurves.html)，得到 Q000–Q202 共 203 个不同目录 URL，编号连续。完整清单在 [catalogue.json](../data/related-curves/catalogue.json)，其中 10 项未从标题确定次数，保留 null。目录项数不等于实际曲线数。

按用户要求只记录可维护的来源、数学定义与处置，不保存网页快照、哈希、请求元数据或自动更新记录。以下是实际读过的 15 个代表页面，不表示已检查所有 203 页的附件。

| 页面 | 读取结果 | 处置 |
| --- | --- | --- |
| [Q000](http://bernard-gibert.fr/curves/q000.html) | H3/aH3 两个 deltoid；页面给出有理对偶切线条件，非可直接粘贴的隐式点方程。提到文本但未找到附件链接。特征点主要是高编号。 | 暂缓，不猜等价隐式式。 |
| [Q001](http://bernard-gibert.fr/curves/q001.html) | 七次式有 [Q001.txt](http://bernard-gibert.fr/curves/Resources/Q001.txt)，已读；冒号后为展开多项式。 | 下一批高次性能样本。 |
| [Q002](http://bernard-gibert.fr/curves/q002.html) | 两个短循环重心式、丰富特征点。 | 已入小库，两个方程比例核对。 |
| [Q003](http://bernard-gibert.fr/curves/q003.html) | 两个五次循环式，与 Q002 等角共轭相关。 | 已入小库，两个方程比例核对。 |
| [Q005](http://bernard-gibert.fr/curves/q005.html) | 明确称 circular cubic，提供 TXT 链接。 | 已按用户要求纳入统一接口。 |
| [Q012](http://bernard-gibert.fr/curves/q012.html) | 两个等价五次式与多个有限点。 | 已入小库；不把目录标题中的 circular 一词当成已验证分类。 |
| [Q015](http://bernard-gibert.fr/curves/q015.html) | 十二次 Lang curve；引用论文的判别式，未给可直接使用的公式。 | 暂缓。 |
| [Q033](http://bernard-gibert.fr/curves/q033.html) | 一般式 cyclic(p(v²−w²)vw)，令 P=外心；页面还有中点、反中三角形顶点。 | 已入小库；区分有限、无穷远与当前未定义点。 |
| [Q035](http://bernard-gibert.fr/curves/q035.html) | 曲线图、特征点和 Q035-A 说明；公式区域空白，未找到可下载公式。 | 暂缓。不能把标题图当公式图。 |
| [Q036](http://bernard-gibert.fr/curves/q036.html) | [Q036.txt](http://bernard-gibert.fr/curves/Resources/Q036.txt) 已读，直接分列 Q036A/B/C，式间没有可靠换行。 | 三个成员已接入，不能只按行拆文件。 |
| [Q039](http://bernard-gibert.fr/curves/q039.html) | 页面有紧凑六次式和 [Q039.txt](http://bernard-gibert.fr/curves/Resources/Q039.txt) 的展开式，TXT 已读。 | 已入小库，紧凑式与 TXT 符号核对。 |
| [Q106](http://bernard-gibert.fr/curves/q106.html) | 十次式称可下载 TXT，但本次 HTML 没有对应 href；图和几何刻画可读。 | 缺公式资源，暂缓。 |
| [Q110](http://bernard-gibert.fr/curves/q110.html) | 同样提及 TXT，但本次 HTML 未找到实际链接。 | 缺公式资源，暂缓。 |
| [Q142](http://bernard-gibert.fr/curves/q142.html) | 短四次循环式与 TXT 链接；有多个有限低编号点。 | 已接入。 |
| [Q202](http://bernard-gibert.fr/curves/q202.html) | Jerabek 四次式、TXT 链接、低编号和高编号特征点。 | 已接入。 |

[Downloads](http://bernard-gibert.fr/downloads.html) 实际主要链接至论文介绍 HTML 页。本次检查的总目录、Downloads 和上述样本中，没有发现统一的全部曲线 GeoGebra／GGT／ZIP 作图包；没有穷举所有论文落地页或站外资源，因此不宣称整个网站绝无合集。

资料读取为单并发、请求间隔至少五秒，robots.txt 返回 404。没有执行全站爬虫，也没有安装自动采集或更新任务。以后人工按需维护即可。
