# GibertCurve 批量接入的验证范围

批量接入时，离线检查覆盖方程次数、齐次性、命名执行预算，以及来源中可独立构造的特征点；部分条目另有符号恒等式或坐标方程比较。特征点复现脚本为 `scripts/geogebra/tools/check_related_curve_points.py`。各编号的来源和当前状态以 [数据维护说明](../../data/related-curves/README.md) 和 [来源审计](../related-curves-source-audit.md) 为准。

GeoGebra 5.4.920.0 在 Windows Chrome 上抽测了 Q005、Q014、Q036A、Q202、Q021、Q023、Q029、Q032、Q034、Q064、Q074、Q075、Q099、Q114、Q120、Q121、Q155、Q171、Q200 和 Q201。抽样检查了曲线类型、适用的来源特征点、输入更新、退化恢复、导出重开与辅助对象清理。Q005 和 Q202 在正三角形样本中退化为零式，按 undefined 处理。**抽样不代表所有目录条目均已实机验证**；多曲线共存和移动设备也未覆盖。

这些实验中，复杂曲线的创建耗时可达数秒，且受设备、视口及构图影响；一次性计时不能视作性能保证。有关分阶段系数、平移精度限制及复现方法，见 [相似坐标扩展](gibert-similarity-expansion.md) 和 [垂足曲线方案](gibert-pedal-integration.md)。
