#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""补全案例分析真题 rubric.sample（「见解析」占位 → 参考答案正文）。"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

from seven_steps_lib import build_seven_steps

ROOT = Path(__file__).resolve().parents[2]
JSONL = ROOT / "content/banks/real/案例分析/all.jsonl"
REF = ROOT / "content/banks/real/案例分析/reference"
RAW = ROOT / "content/banks/real/案例分析/raw"

PLACEHOLDER = {"见解析", "（参考答案待补）", ""}


def strip_html(s: str) -> str:
    if not s:
        return ""
    s = html.unescape(s)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("\xa0", " ").replace("&nbsp;", " ")
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def split_answers_blob(blob: str) -> dict[int, str]:
    """按【问题 n】切分答案块。"""
    blob = blob.strip()
    if not blob or blob in PLACEHOLDER:
        return {}
    matches = list(re.finditer(r"【问题\s*(\d+)】", blob))
    if not matches:
        matches = list(re.finditer(r"(?:^|\n)\s*问题\s*(\d+)\s*[（(]", blob))
    if not matches:
        if len(blob) > 15:
            return {1: blob}
        return {}
    out: dict[int, str] = {}
    for i, m in enumerate(matches):
        qn = int(m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(blob)
        body = blob[start:end].strip()
        if len(body) > 8:
            out[qn] = body
    return out


def parse_qicoder_file(text: str) -> dict[int, dict[int, str]]:
    """exam_no -> qnum -> sample"""
    result: dict[int, dict[int, str]] = {}
    chunks = re.split(r"###\s*第\s*(\d+)\s*题", text)
    if len(chunks) < 2:
        return result
    for idx in range(1, len(chunks), 2):
        exam = int(chunks[idx])
        body = chunks[idx + 1]
        ans_m = re.search(
            r"试题答案[：:]\s*([\s\S]*?)(?:-\s*试题解析|###\s*第|\Z)",
            body,
            re.I,
        )
        if not ans_m:
            continue
        ans_text = ans_m.group(1).strip()
        # 去掉 markdown 噪声行
        ans_text = re.sub(r"^\*\*.*?\*\*\s*$", "", ans_text, flags=re.M)
        blocks = split_answers_blob(ans_text)
        if not blocks:
            # 尝试 （a）式无【问题】标题
            if exam == 2 and "（a）" in ans_text:
                blocks = {2: ans_text}
        result[exam] = blocks
    return result


def load_qicoder_bank(year: str, half: str) -> dict[int, dict[int, str]]:
    yymm = f"{year}{'05' if half == '上' else '11'}"
    fp = REF / f"qicoder-{yymm}-afternoon.md"
    if not fp.exists():
        return {}
    return parse_qicoder_file(fp.read_text(encoding="utf-8"))


def merge_raw_answers(year: str, half: str) -> dict[int, dict[int, str]]:
    """从 raw JSON 按 exam 合并（单卡多问题）。"""
    yymm = f"{year}{'05' if half == '上' else '11'}"
    fp = RAW / f"{yymm}.json"
    if not fp.exists():
        return {}
    rows = json.loads(fp.read_text(encoding="utf-8"))
    by_parent: dict[str, list] = {}
    for r in rows:
        pid = str(r.get("new_parent_id") or r.get("question_id"))
        by_parent.setdefault(pid, []).append(r)
    out: dict[int, dict[int, str]] = {}
    exam = 0
    for pid in sorted(by_parent.keys(), key=lambda x: by_parent[x][0].get("index", 0)):
        items = by_parent[pid]
        exam += 1
        blob = ""
        for it in items:
            ans = it.get("answer")
            if isinstance(ans, list):
                blob += "\n" + strip_html("\n".join(str(a) for a in ans))
            else:
                blob += "\n" + strip_html(str(ans or ""))
        blocks = split_answers_blob(blob)
        # 201905 案例1：Q2/Q3 在同一段
        if year == "2019" and exam == 1:
            extra = {}
            m_path = re.search(r"关键路径为[：:]\s*([A-Z]+)\s*,?\s*工期为?\s*(\d+)", blob)
            if m_path:
                extra[2] = f"关键路径：{m_path.group(1)}；项目工期：{m_path.group(2)}周。"
            m_slack = re.search(r"\(a\)\s*(\d+).*?\(b\)\s*(\d+).*?\(c\)\s*(\d+).*?\(d\)\s*(\d+).*?\(e\)\s*(\d+)", blob, re.S)
            if m_slack:
                extra[3] = (
                    f"松弛时间：(a){m_slack.group(1)} (b){m_slack.group(2)} "
                    f"(c){m_slack.group(3)} (d){m_slack.group(4)} (e){m_slack.group(5)}"
                )
            blocks = {**blocks, **extra}
        if blocks:
            out[exam] = blocks
    return out


# 手工补 qicoder 未收录或表格式答案
MANUAL: dict[str, dict[int, str]] = {
    "ZT-2014上-案例05": {
        2: (
            "【问题2】表5-1 技术手段可行性（要点）：\n"
            "HTML 静态化：可行，商品/促销页读多写少，静态化可抗并发；需解决更新及时性。\n"
            "缓存：可行，热点商品与会话数据适合内存缓存；需缓存失效与一致性策略。\n"
            "库表散列：可行，按类别分库分表匹配原则(a)；需跨类别查询与事务处理。\n"
            "集群与镜像：可行，热备份满足(b)；镜像便于故障切换。\n"
            "负载均衡：可行，地域集中访问适合 LB 分摊；需会话保持或无状态设计。"
        ),
    },
    "ZT-2015上-案例03": {
        3: (
            "表3-2 宇航设备嵌入式软件与移动智能终端软件差异（要点）：\n"
            "（1）安全性：宇航软件按失效对系统安全（Safety）影响分 A～E 等级，各级开发过程要求不同；"
            "智能终端软件多辅助工作生活，一般不直接危及生命，不适用该分级。\n"
            "（2）实时性：宇航软件需与硬件紧密协同，将实时需求分解到各软件部件；"
            "智能终端属弱实时，对时间特性不敏感，设计上尽量避免软硬件紧耦合。\n"
            "（3）交互性：宇航软件多为非人机交互系统，侧重安全与可靠；"
            "智能终端侧重界面友好、简洁与用户体验。\n"
            "（4）编码：宇航软件须遵守语言标准及高级语言安全子集，对语句条数、扇入扇出、圈复杂度等有严格规定；"
            "智能终端虽也遵循编码规范，但在安全编码与复杂度控制等方面要求相对宽松。"
        ),
    },
    "ZT-2015上-案例05": {
        1: (
            "表5-1 功能归入子系统：\n"
            "网站子系统：首页、商品列表、频道、搜索\n"
            "交易子系统：订单中心、订单结算、支付、购物车\n"
            "业务服务子系统：商品促销、商品库存、商品价格、用户管理"
        ),
    },
    "ZT-2017上-案例03": {
        3: (
            "表3-1 关于多核和单核体系结构的说明（判题）：\n"
            "（1）正确 （2）正确 （3）错误 （4）正确 （5）错误 （6）错误 （7）正确"
        ),
    },
}


def pack_role(row: dict) -> str:
    exam = int(row.get("exam_no") or 0)
    year = f"{row.get('year', '')}{row.get('half', '')}"
    if exam == 1:
        return f"真题 {year} · 试题一（建议必答）"
    return f"真题 {year} · 试题{exam}（选答候选；60 秒扫标题再定）"


def is_placeholder(sample: str | None) -> bool:
    s = (sample or "").strip()
    return s in PLACEHOLDER or len(s) < 12


def main() -> None:
    rows = [json.loads(line) for line in JSONL.read_text(encoding="utf-8").splitlines() if line.strip()]
    qicoder_cache: dict[str, dict[int, dict[int, str]]] = {}
    raw_cache: dict[str, dict[int, dict[int, str]]] = {}
    filled = 0
    touched_cases: set[str] = set()

    for row in rows:
        cid = row.get("id") or ""
        year, half = str(row.get("year")), str(row.get("half"))
        exam = int(row.get("exam_no") or 0)
        key = f"{year}{half}"
        if key not in qicoder_cache:
            qicoder_cache[key] = load_qicoder_bank(year, half)
            raw_cache[key] = merge_raw_answers(year, half)
        q_bank = qicoder_cache[key].get(exam, {})
        r_bank = raw_cache[key].get(exam, {})
        manual = MANUAL.get(cid, {})

        changed = False
        for q in row.get("questions") or []:
            qn = int(q.get("qnum") or 0)
            if not is_placeholder((q.get("rubric") or {}).get("sample")):
                continue
            sample = manual.get(qn) or q_bank.get(qn) or r_bank.get(qn)
            if sample and not is_placeholder(sample):
                q.setdefault("rubric", {})["sample"] = sample.strip()
                filled += 1
                changed = True
        if changed:
            touched_cases.add(cid)
            row["seven_steps"] = build_seven_steps(
                case_id=cid,
                domain=row.get("domain") or "Web",
                case_type=row.get("case_type") or "分析改进",
                stem=row.get("stem") or "",
                questions=row.get("questions") or [],
                pack_role=pack_role(row),
            )

    JSONL.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    remaining = sum(
        1
        for row in rows
        for q in row.get("questions") or []
        if is_placeholder((q.get("rubric") or {}).get("sample"))
    )
    print(
        {
            "filled": filled,
            "touched_cases": len(touched_cases),
            "remaining_placeholders": remaining,
        }
    )


if __name__ == "__main__":
    main()
