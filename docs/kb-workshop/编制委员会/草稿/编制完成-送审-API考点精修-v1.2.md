# 编制完成 · API 考点精修 v1.2（送审）

| 字段 | 内容 |
|------|------|
| **状态** | 送审 |
| **范围** | `content/kb/points/kp-*.md`（174 篇，不含手工保留 `kp-2-7`） |
| **依据** | `答卷写法准则-v1.1.md`、`知识点API参考模型.md` |
| **程序** | `scripts/python/refine_kb_api_points.py` |

## 编制声明

- **编制甲**：六节版式、索引 `meta.version = v1.2-api`、知识地图与 API 主入口一致。  
- **编制乙**：自归档篇章按标题关键词重切正文；提取答卷定义句；易混表按考点关键词过滤。  
- **编制丙**：科目3 论文专题组补「可选专题清单 + 第22章评分摘录」；跨章题补应试钩子摘要。

## 审计关注

1. 少数章节（第7章 7.3 开发环境等）教程原文缺失处已用 **SYNTHETIC** 提纲，审计乙请核对口径。  
2. 关键词切分仍可能错配相邻小节，优先抽查：第7章 CMMI、第13章 WFMS/RTSAD、第11章需求获取。  
3. `kp-2-7` REST 试点为手工精编，不纳入本次批量覆盖。

## 发布后

```bash
python3 scripts/python/refine_kb_api_points.py   # 可重复精修
npm run sync:kb
npm run check:release
```
