#!/usr/bin/env python3
"""M2-T3: 为 50 篇正式三件套追加「模板」深链（按 case-map 域主导题型映射速查三模板）。
一次性脚本。"""
import pathlib, json

ROOT = pathlib.Path(__file__).resolve().parent.parent

# 域 -> 主导题型（case-map points 域×题型 count 最大项）
T = {
 "案例-技术方案论证-答题模板.md": ["Web","需求","集成","嵌入式","微服务","大数据"],
 "案例-问题诊断与改进-答题模板.md": ["移动"],
 "案例系统设计类-答题Checklist.md": ["数据库","CPS"],
}
# 50 篇显式域映射（避免前缀歧义）
DOM = {}
for k in ['kp-1-1-2','kp-1-2-2','kp-1-3-2','kp-1-4-2','kp-1-5-2']: DOM[k]='Web'
for k in [f'kp-9-{i}' for i in range(1,9)]: DOM[k]='需求'
for k in ['kp-3-1','kp-3-2','kp-3-3','kp-3-4','kp-3-5','kp-3-6','kp-3-7','kp-3-8']: DOM[k]='数据库'
for k in ['kp-10-1','kp-10-2','kp-10-3','kp-10-4','kp-10-5','kp-10-6']: DOM[k]='集成'
for k in ['kp-2-1-2','kp-2-2-2','kp-2-3-2','kp-2-4-2','kp-2-5-2']: DOM[k]='嵌入式'
for k in ['kp-3-1-2','kp-3-2-2','kp-3-3-2','kp-3-4-2','kp-3-5-2']: DOM[k]='移动'
for k in ['kp-5-1','kp-5-2-2','kp-5-3-2','kp-5-4-2']: DOM[k]='微服务'
for k in ['kp-4-1-2','kp-4-2-2','kp-4-3-2']: DOM[k]='大数据'
for k in ['kp-6-1-2','kp-6-2-2','kp-6-3-2','kp-6-4-2','kp-6-5-2','kp-6-6-2']: DOM[k]='CPS'

def domain_of(kid):
    return DOM.get(kid)

def template_for(kid):
    d = domain_of(kid)
    for fname, doms in T.items():
        if d in doms:
            return fname
    return None

def main():
    ok, skipped = [], []
    for f in sorted((ROOT/"content/kb/points").glob("kp-*.md")):
        t = f.read_text(encoding="utf-8")
        if "案例三件套（审计通过 v0.19" not in t:
            continue
        kid = f.stem
        fname = template_for(kid)
        if not fname:
            skipped.append((kid, "no-domain")); continue
        if "- 模板：" in t:
            skipped.append((kid, "has-link")); continue
        i = t.index("## 相关考点")
        pre = t[:i].rstrip("\n")
        label = fname.rsplit(".", 1)[0]
        pre += f"\n- 模板：[{label}](../速查/{fname})"
        f.write_text(pre + "\n\n" + t[i:], encoding="utf-8")
        ok.append(kid)
    print(f"template-links: {len(ok)}, skipped: {skipped}")

if __name__ == "__main__":
    main()