"""案例分析题 · 列表标题（point）格式化。"""
from __future__ import annotations

_EXAM_CN = ("", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十")


def exam_no_label(exam_no: int) -> str:
    if 1 <= exam_no <= 10:
        return f"试题{_EXAM_CN[exam_no]}"
    return f"试题{exam_no}"


def format_real_case_point(row: dict) -> str:
    """真题列表用：年份卷面 + 领域 + 题型。"""
    year = str(row.get("year") or "")
    half = str(row.get("half") or "")
    exam = int(row.get("exam_no") or 0)
    domain = str(row.get("domain") or "Web")
    case_type = str(row.get("case_type") or "分析改进")
    return f"{year}{half}·{exam_no_label(exam)} · {domain} · {case_type}"
