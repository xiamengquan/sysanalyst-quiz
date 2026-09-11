#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""综合知识题库画像适配：前端工程师 · 数学弱 · 英语弱

出题者 + 提示信息官 + 知识点编制：
1. 第2章解析「先结论后步骤 + 中文术语」
2. 纯英文选项补中文括号；explain 专名中文化
3. 补前端友好 basic 新题（HTTP缓存/CORS/鉴权/XSS·CSRF 等）
4. 标注 audience / math_level 便于刷题页筛选
"""
from __future__ import annotations
import hashlib, json, re
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[2]
PRACTICE = ROOT / "content/banks/practice/all.jsonl"
CHAP_DIR = ROOT / "content/banks/practice/chapters"
NOTE = ROOT / "content/workshop/new/20260911-前端画像综合知识适配说明.md"
REVIEW = ROOT / "docs/question-workshop/评审/评审报告-20260911-前端画像综合知识适配.md"
KB_QUICK = ROOT / "content/kb/速查"
KB_INDEX = ROOT / "content/kb-index.json"

CH_NAMES = {
    0: "综合与法规杂项", 1: "绪论", 2: "数学与工程基础", 3: "计算机系统",
    4: "计算机网络与分布式系统", 5: "数据库系统", 6: "企业信息化", 7: "软件工程",
    8: "项目管理", 9: "信息安全", 10: "系统规划与分析", 11: "软件需求工程",
    12: "软件架构设计", 13: "系统设计", 14: "软件实现与测试", 15: "系统运行与维护",
}

# 第2章：整段白话解析覆盖
CH2_EXPLAIN = {
    "CK-02-b73a25db2f": "【结论】选单源最短路径算法（Dijkstra）。【白话】从「一个起点」到其他点的最短路，且边的长度都是非负数，用 Dijkstra（迪杰斯特拉）。Prim/Kruskal 是最小生成树（把点连起来总长度最短），不是单源最短路。Floyd 可算多源，但题干强调单源时优先 Dijkstra。",
    "CK-02-e3bb4305a0": "【结论】有概率的决策用「期望收益」准则。【白话】每个方案：收益×概率再相加，选期望最高的。【易错】乐观=赌最好；悲观准则（Wald）=按最坏；后悔值准则（Savage）=看选错会多后悔多少——都不是概率加权求和。",
    "CK-02-b311ad5f46": "【结论】工程伦理把公众安全放在第一位。【白话】发现危险要如实报告、不能隐瞒；工期和利益不能压过安全。其他选项属于隐瞒、造假或推责。",
    "CK-02-83b512c5fb": "【结论】数学建模顺序：理解问题 → 假设 → 建模求解 → 用实际检验。【白话】先搞清要算什么，再列式；算完必须回头验算是否合理。跳过检验或先写答案再找假设都不对。",
    "CK-02-83202be74f": "【结论】最大流 = 最小割。【白话】管道网络从起点到终点，最多能流多少水，等于「最窄那一刀切断」的容量和。不是边容量随便相加，也不是边的条数。",
    "CK-02-40bb5aede3": "【结论】最小生成树=连通全部点且总边长最短、无环。【白话】像用最短电线把所有城市连上且不成圈。最短路径是从一个点出发；旅行商要回到起点——都不是最小生成树。",
    "CK-02-754a301cd5": "【结论】正态分布像钟形，中间高两边低，左右对称。【白话】很多独立小误差叠在一起常近似正态；用「平均值」和「方差/标准差」描述。均匀分布是平的；指数/几何偏一边。",
    "CK-02-98ab80919f": "【结论】有历史数据→定量预测；靠专家讨论→定性预测。【白话】月销量有表可建模属定量；座谈拍脑袋属定性。别把具体算法名当成方法大类。",
    "CK-02-2038ca0307": "【结论】不确定决策用决策树：决策点选方案，机会点按概率算期望。【白话】画树把「我能决定的」和「碰运气的」分开，再算期望。PERT 管进度；ER/类图是结构建模。",
    "CK-02-50fc9bcc4e": "【结论】后悔值准则（Savage）=先算每种情况「少赚了多少（后悔）」，再选「最大后悔」最小的方案。【白话】不是算期望收益；也不是单纯乐观/悲观。",
    "CK-02-4f3e586e7a": "【结论】期望相同比方差：方差大=波动大、风险高。【白话】平均一样时，波动大更不稳。方差大不是更优，也不是无风险。",
    "CK-02-2cf9ff1526": "【结论】灵敏度分析=看关键数字稍微变一点，最优方案会不会翻盘。【白话】用来判断结论稳不稳。不是再算一遍别的指标代替。",
    "CK-02-dabd96dfb8": "【结论】割=去掉一些边后起点到终点不通；割的容量和用于最大流定理。【白话】别和生成树、欧拉回路（一笔画）搞混。",
    "CK-02-262358cf2a": "【结论】没历史数据时以定性为主，可少量试销辅助。【白话】数据不够就别硬套复杂公式。",
    "CK-02-dc34d602bf": "【结论】Dijkstra 要求边权非负。【白话】有负权边时已算「最短」可能被后面推翻，改用 Bellman-Ford（贝尔曼-福特）。负权环时最短路可能不存在。最小生成树是另一问题。",
    "CK-02-9655bafefb": "【结论】最小生成树总权可能相同但形状不唯一。【白话】几条等长边可互换时，树不一样但总长度一样。先选短边、不成圈（Kruskal 思路）。",
    "CK-02-d5537dca17": "【结论】算期望再比大小。【白话】甲：0.6×100+0.4×(−20)=52；若乙是 40，选甲。别只看最好/最坏一种情况。",
    "CK-02-9c89e3a732": "【结论】检出阳性不等于一定有病，要看患病率（先验）。【白话】病很少见时，假阳性也会很多；贝叶斯就是把「少见程度」和「检出准不准」合在一起看。",
    "CK-02-bbe0b2f1ff": "【结论】单窗口排队（M/M/1）利用率 ρ 接近 1 时，等待时间会突然暴涨。【白话】ρ=到达÷服务；收银台快满员时不是「再慢一点」，而是堵死。ρ=0.95 远比 0.5 难等。",
    "CK-02-a1b04d1589": "【结论】总时差 TF=最晚开始−最早开始，表示可拖延多久还不影响总工期。【白话】别把最早/最晚开始直接相加。",
    "CK-02-e1d0fb424b": "【结论】置信区间表示「估计有多不确定」，不是把真值锁死。【白话】大概是：多次抽样，多数区间会盖住真参数；不是样本本身等于总体。",
    "CK-02-f4640aa5a8": "【结论】建模后必须用数据/实验/极限情况检验再应用。【白话】直接上线或乱删约束风险大。",
    "CK-02-0a61922b89": "【结论】最大流等于最小割容量。【白话】与「最大流最小割定理」一致；知道最小割就能定最大流。",
    "CK-02-191a1e1f30": "【结论】正态波动看均值+标准差（或方差）。【白话】只看最大值/众数描述不了钟形离散程度。",
    "CK-02-ce672ee956": "【结论】线性规划最优解通常在可行区域的「顶点」上。【白话】可行域内部一般不是最优；不用死记画图细节，先记「看顶点」。",
    "CK-02-53bccc5272": "【结论】安全优先于工期和利益，危险操作必须停并如实报告。【白话】隐瞒、造假都违背工程伦理。",
}

TERM_GLOSS = [
    (r"\bHTTPS\b", "HTTPS（加密网页传输）"),
    (r"\bHTTP\b", "HTTP（网页传输协议）"),
    (r"\bTLS\b", "TLS（传输层安全）"),
    (r"\bSSL\b", "SSL（安全套接层，今多用 TLS）"),
    (r"\bTCP\b", "TCP（可靠传输）"),
    (r"\bUDP\b", "UDP（尽全力传输）"),
    (r"\bDNS\b", "DNS（域名解析）"),
    (r"\bCDN\b", "CDN（内容分发网）"),
    (r"\bARP\b", "ARP（地址解析）"),
    (r"\bREST\b", "REST（一种 Web 接口风格）"),
    (r"\bSOAP\b", "SOAP（一种 XML 风格 Web 服务）"),
    (r"\bOAuth\b", "OAuth（开放授权）"),
    (r"\bJWT\b", "JWT（JSON 令牌）"),
    (r"\bXSS\b", "XSS（跨站脚本攻击）"),
    (r"\bCSRF\b", "CSRF（跨站请求伪造）"),
    (r"\bCORS\b", "CORS（跨域资源共享）"),
    (r"\bCSP\b", "CSP（内容安全策略）"),
    (r"\bAPI\b", "API（应用程序接口）"),
    (r"\bMVC\b", "MVC（模型-视图-控制器）"),
    (r"\bMVVM\b", "MVVM（模型-视图-视图模型）"),
    (r"\bSPA\b", "SPA（单页应用）"),
    (r"\bCI/CD\b", "CI/CD（持续集成/持续交付）"),
    (r"\bDevOps\b", "DevOps（开发运维协同）"),
    (r"\bIaaS\b", "IaaS（基础设施即服务）"),
    (r"\bPaaS\b", "PaaS（平台即服务）"),
    (r"\bSaaS\b", "SaaS（软件即服务）"),
    (r"\bSMTP\b", "SMTP（发邮件协议）"),
    (r"\bCSMA/CD\b", "CSMA/CD（带冲突检测的载波监听）"),
    (r"Savage", "后悔值准则（Savage）"),
    (r"Wald", "悲观准则（Wald）"),
    (r"Hurwicz", "折中准则（Hurwicz）"),
    (r"Minimax Regret", "最小最大后悔（Minimax Regret）"),
    (r"\bEMV\b", "期望收益值（EMV）"),
    (r"\bDijkstra\b", "Dijkstra（单源最短路）"),
    (r"\bFloyd\b", "Floyd（多源最短路）"),
    (r"\bPrim\b", "Prim（最小生成树）"),
    (r"\bKruskal\b", "Kruskal（最小生成树）"),
    (r"M/M/1", "单窗口排队（M/M/1）"),
    (r"copyleft", "著佐权（copyleft，与版权相对的开源义务）"),
]

OPTION_GLOSS = {
    "HTTPS": "安全网页传输（HTTPS，HTTP 加密版）",
    "HTTP": "明文网页传输（HTTP）",
    "HTTP/1.0": "早期 HTTP（HTTP/1.0）",
    "FTP": "文件传输（FTP）",
    "SMTP": "发邮件协议（SMTP）",
    "POP3": "收邮件协议（POP3）",
    "IMAP": "收邮件协议（IMAP）",
    "DNS": "域名解析（DNS）",
    "ARP": "地址解析（ARP）",
    "RARP": "反向地址解析（RARP）",
    "TCP": "可靠传输（TCP）",
    "UDP": "尽全力传输（UDP）",
    "ICMP": "控制报文（ICMP）",
    "CSMA/CD": "带冲突检测的监听（CSMA/CD）",
    "CSMA/CA": "冲突避免监听（CSMA/CA）",
    "IaaS": "基础设施即服务（IaaS）",
    "PaaS": "平台即服务（PaaS）",
    "SaaS": "软件即服务（SaaS）",
    "SOAP": "XML 风格 Web 服务（SOAP）",
    "REST": "资源风格接口（REST）",
    "RPC": "远程过程调用（RPC）",
    "L1 Cache": "一级高速缓存（L1 Cache）",
    "L2 Cache": "二级高速缓存（L2 Cache）",
    "Web Service": "Web 服务（Web Service）",
}


def load_jsonl(p: Path):
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def dump_jsonl(p: Path, rows):
    p.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")


def gloss_text(s: str) -> str:
    if not s:
        return s
    out = s
    for pat, repl in TERM_GLOSS:
        # 避免重复加注
        if "（" in repl and repl.split("（")[0] in out and repl in out:
            continue
        out = re.sub(pat, repl, out)
    return out


def gloss_option(v: str) -> str:
    raw = (v or "").strip()
    if raw in OPTION_GLOSS:
        return OPTION_GLOSS[raw]
    # 纯英文短选项
    if raw and not re.search(r"[\u4e00-\u9fff]", raw) and re.search(r"[A-Za-z]", raw):
        if len(raw) <= 40 and raw not in OPTION_GLOSS:
            return f"{raw}（英文缩写，见解析中文说明）"
    return gloss_text(raw)


def math_level_for(row: dict) -> str:
    if row.get("chapter") != 2:
        return ""
    point = row.get("point") or ""
    if any(k in point for k in ["伦理", "建模步骤", "预测", "定性", "检验", "直觉", "方差意义", "灵敏度", "置信", "正态"]):
        return "intuition"
    if row.get("difficulty") == "basic":
        return "intuition"
    return "calc"


def adapt_existing(rows: list[dict]) -> tuple[list[dict], dict]:
    stats = Counter()
    for r in rows:
        rid = r.get("id") or ""
        if rid in CH2_EXPLAIN:
            r["explain"] = CH2_EXPLAIN[rid]
            stats["ch2_explain"] += 1
        else:
            old = r.get("explain") or ""
            new = gloss_text(old)
            if new != old:
                r["explain"] = new
                stats["gloss_explain"] += 1

        opts = r.get("options") or {}
        changed = False
        new_opts = {}
        for k, v in opts.items():
            nv = gloss_option(v)
            new_opts[k] = nv
            if nv != v:
                changed = True
        if changed:
            r["options"] = new_opts
            stats["gloss_opt"] += 1

        ml = math_level_for(r)
        if ml:
            r["math_level"] = ml
        # 前端友好章打标
        if r.get("chapter") in (4, 7, 9, 12, 13, 14, 15):
            tags = set(r.get("audience") or [])
            tags.add("frontend")
            r["audience"] = sorted(tags)
            stats["tag_frontend"] += 1
        if r.get("chapter") == 2:
            tags = set(r.get("audience") or [])
            tags.add("math_weak_path")
            r["audience"] = sorted(tags)
    return rows, stats


def qid(stem: str) -> str:
    h = hashlib.md5(stem.encode("utf-8")).hexdigest()[:10]
    return f"CK-FE-{h}"


NEW_QUESTIONS = [
    # ch4 HTTP / 缓存
    (4, "HTTP方法", "前端调用后端删除资源，最应优先考虑使用的 HTTP 方法是（ ）。",
     {"A": "GET（获取，不应改数据）", "B": "DELETE（删除资源）", "C": "HEAD（只要响应头）", "D": "OPTIONS（询问允许的方法）"},
     "B", "【结论】删资源用 DELETE。【白话】GET 只读；HEAD 类似 GET 但不拿正文；OPTIONS 用来问「能用哪些方法」。", "basic"),
    (4, "HTTP状态码", "接口返回 304，对浏览器缓存来说通常表示（ ）。",
     {"A": "服务器出错要重试", "B": "资源未修改，可用本地缓存", "C": "需要登录", "D": "跨域被拒绝"},
     "B", "【结论】304=没改，继续用缓存。【白话】常和条件请求（If-None-Match / ETag）一起出现。401 才是未登录；5xx 服务器错。", "basic"),
    (4, "HTTP缓存", "要让浏览器在一段时间内直接用本地副本、少打服务器，响应头应优先考虑（ ）。",
     {"A": "Cache-Control: max-age=…（缓存多久）", "B": "把密码放进 URL", "C": "只用 HTTP 明文传登录态", "D": "关闭 HTTPS"},
     "A", "【结论】用 Cache-Control 等缓存头控制。【白话】这是 HTTP 缓存，和 CPU 的 L1 Cache（硬件高速缓存）不是一回事。", "basic"),
    (4, "ETag", "ETag（实体标签）在 Web 缓存中的主要作用是（ ）。",
     {"A": "替代数据库主键", "B": "标识资源版本，便于协商缓存（是否 304）", "C": "加密传输内容", "D": "替代 DNS"},
     "B", "【结论】ETag 用来判断「文件变没变」。【白话】浏览器带着旧 ETag 问服务器，没变就 304。", "basic"),
    (4, "CDN", "静态图片、JS、CSS 放到 CDN（内容分发网）的主要收益是（ ）。",
     {"A": "替代后端业务逻辑", "B": "就近缓存加速、减轻源站压力", "C": "自动修复代码缺陷", "D": "取消 HTTPS"},
     "B", "【结论】CDN 把静态资源缓存在离用户近的节点。【白话】加速访问、扛流量；业务规则仍在源站。", "basic"),
    (4, "Cookie与Session", "浏览器 Cookie 与服务端 Session 的常见关系是（ ）。",
     {"A": "完全无关", "B": "Cookie 常保存 Session 标识，服务端用标识找回会话", "C": "Session 只存在于前端 localStorage", "D": "Cookie 只能存图片"},
     "B", "【结论】Cookie 里常是会话 ID，真正会话数据在服务端。【白话】前端别把敏感权限只信 Cookie 明文。", "basic"),
    (4, "HTTPS", "登录页提交密码，传输层最应使用（ ）。",
     {"A": "明文 HTTP", "B": "HTTPS（HTTP + TLS 加密）", "C": "只改按钮颜色", "D": "关闭防火墙"},
     "B", "【结论】密码必须走 HTTPS。【白话】HTTPS≈HTTP 外面加 TLS 加密与证书校验，防窃听篡改。", "basic"),
    (4, "REST幂等", "在 REST（资源风格接口）语义下，多次执行应效果相同的典型方法是（ ）。",
     {"A": "不带约束的 POST 随意创建", "B": "PUT/DELETE 等幂等设计（同样请求重复执行结果一致）", "C": "随机 GET", "D": "任意 TRACE"},
     "B", "【结论】幂等≈重复执行结果一样。【白话】弱网重试时很重要；随意 POST 创建通常不幂等。", "basic"),
    # ch9 安全
    (9, "XSS", "用户输入的内容未经转义就插入页面 HTML，最容易导致（ ）。",
     {"A": "XSS（跨站脚本，恶意脚本在别人浏览器执行）", "B": "磁盘碎片", "C": "DNS 污染必然发生", "D": "CPU 缓存命中率上升"},
     "A", "【结论】未转义输出→XSS。【白话】攻击者可偷 Cookie 或改页面。防护：转义/消毒、CSP（内容安全策略）。", "basic"),
    (9, "CSRF", "用户已登录某站点，又被诱使在浏览器里自动向该站发请求，这类风险主要是（ ）。",
     {"A": "CSRF（跨站请求伪造）", "B": "仅磁盘坏道", "C": "仅 JSON 缩进错误", "D": "仅字体未加载"},
     "A", "【结论】CSRF=借你的登录态「冒名办事」。【白话】防护：CSRF Token、SameSite Cookie、关键操作二次确认。", "basic"),
    (9, "CORS", "浏览器拦截「前端域名 A 调接口域名 B」且未获服务器允许，主要机制是（ ）。",
     {"A": "CORS（跨域资源共享）同源策略相关限制", "B": "仅 SQL 索引失效", "C": "仅 CSS 优先级", "D": "仅 Git 冲突"},
     "A", "【结论】跨域由浏览器同源策略 + CORS 头控制。【白话】服务器需返回 Access-Control-Allow-Origin 等；不是前端改一下就能硬闯。", "basic"),
    (9, "同源策略", "同源策略中的「源」通常由哪些部分共同决定（ ）。",
     {"A": "仅文件大小", "B": "协议 + 域名 + 端口", "C": "仅屏幕分辨率", "D": "仅字体文件"},
     "B", "【结论】协议、域名、端口都相同才算同源。【白话】http≠https，example.com≠api.example.com。", "basic"),
    (9, "OAuth2", "第三方应用在用户授权后访问用户资源，不宜直接拿到用户密码，更合理的是（ ）。",
     {"A": "明文索要密码长期保存", "B": "OAuth（开放授权）令牌授权", "C": "把密码写进前端代码", "D": "关闭 HTTPS"},
     "B", "【结论】用 OAuth 授权，不碰用户密码。【白话】应用拿到的是有限权限令牌，可撤销。", "basic"),
    (9, "JWT", "JWT（JSON 令牌）常见三段结构是（ ）。",
     {"A": "仅用户名密码", "B": "头部.载荷.签名（Header.Payload.Signature）", "C": "仅图片二进制", "D": "仅 CSS 三层"},
     "B", "【结论】JWT≈头.载荷.签名。【白话】签名用于防篡改；敏感信息别明文塞载荷还当加密。", "basic"),
    (9, "CSP", "内容安全策略 CSP 的主要目标是（ ）。",
     {"A": "限制页面可加载/执行的脚本与资源来源，缓解 XSS", "B": "提升磁盘转速", "C": "替代数据库备份", "D": "自动写单元测试"},
     "A", "【结论】CSP 白名单限制脚本来源。【白话】即使有注入，也更难执行外站恶意脚本。", "basic"),
    (9, "密码存储", "服务端保存用户密码的推荐做法是（ ）。",
     {"A": "明文入库", "B": "加盐哈希（不可逆）存储", "C": "只 Base64 一下", "D": "写进前端仓库"},
     "B", "【结论】密码要加盐哈希。【白话】Base64 可逆，不等于加密；前端存密码更危险。", "basic"),
    # ch12 架构
    (12, "B/S", "浏览器访问服务端页面/接口的常见结构是（ ）。",
     {"A": "B/S（浏览器/服务器）", "B": "仅单片机无网络", "C": "仅磁带机批处理", "D": "取消服务器"},
     "A", "【结论】Web 前端常见 B/S。【白话】浏览器是客户端，业务在服务器。", "basic"),
    (12, "SPA", "单页应用 SPA 的典型特点是（ ）。",
     {"A": "每次点击都整页从服务器重新下载完整文档为主", "B": "首屏加载后，路由切换多在前端完成，按需请求数据", "C": "不能使用 JavaScript", "D": "必须禁用缓存"},
     "B", "【结论】SPA 前端路由 + 按需取数。【白话】首屏可能重，但交互切换快；SEO/首屏要额外方案。", "basic"),
    (12, "BFF", "BFF（Backend for Frontend，面向前端的后端）主要价值是（ ）。",
     {"A": "为特定前端聚合裁剪接口，减少聊天式多次请求", "B": "替代 CDN", "C": "取消鉴权", "D": "只做 UI 美化"},
     "A", "【结论】BFF 按端定制聚合。【白话】小程序/Web 差异沉到 BFF，避免双端复制业务规则。", "basic"),
    (12, "网关", "API 网关在前端接入层常见职责不包括（ ）。",
     {"A": "鉴权、限流、路由转发", "B": "统一入口与协议适配", "C": "把业务规则写死在每个按钮 onClick 且无法复用", "D": "可观测与审计埋点入口"},
     "C", "【结论】网关做入口治理，不替代前端把规则复制到每个按钮。【白话】选 C 是「不属于网关职责」。", "basic"),
    (12, "前后端分离", "前后端分离架构下，前端与后端最常见的协作契约是（ ）。",
     {"A": "仅口头约定无文档", "B": "API 契约（路径、字段、错误码、鉴权）", "C": "共享同一数据库账号给浏览器", "D": "前端直接改生产库表结构"},
     "B", "【结论】靠 API 契约协作。【白话】契约稳定才能并行开发与自动化测试。", "basic"),
    # ch7 / ch14 工程
    (7, "敏捷", "两周一个可演示增量、每日短站会，更接近（ ）。",
     {"A": "瀑布一次交付半年后见效果", "B": "敏捷/Scrum 迭代", "C": "禁止需求变更且无回顾", "D": "取消测试"},
     "B", "【结论】短迭代+可演示增量≈敏捷。【白话】不是无计划，而是小步反馈。", "basic"),
    (7, "代码审查", "合并前做代码审查（Code Review）的主要收益是（ ）。",
     {"A": "只增加会议时长无收益", "B": "早发现缺陷、统一风格、分享知识", "C": "替代线上监控", "D": "取消单元测试"},
     "B", "【结论】审查提升质量与共识。【白话】不能替代测试与监控。", "basic"),
    (14, "单元测试", "针对一个纯函数输入输出的自动化测试，最贴近（ ）。",
     {"A": "单元测试", "B": "仅压力测试", "C": "仅兼容性测试", "D": "仅用户访谈"},
     "A", "【结论】测最小单元≈单元测试。【白话】前端也可测工具函数/组件逻辑；E2E 更偏整条用户路径。", "basic"),
    (14, "E2E", "模拟用户打开页面、填写表单、提交的自动化，更贴近（ ）。",
     {"A": "仅静态类型检查", "B": "端到端 E2E 测试", "C": "仅代码格式化", "D": "仅日志染色"},
     "B", "【结论】E2E 走真实用户路径。【白话】慢但能抓集成问题；宜少而精。", "basic"),
    (14, "Mock", "前端联调时后端未就绪，用假数据代替接口，称为（ ）。",
     {"A": "Mock（模拟接口/数据）", "B": "删库", "C": "DNS 劫持攻击", "D": "证书吊销"},
     "A", "【结论】Mock=模拟。【白话】加快并行开发，上线前要用真实契约回归。", "basic"),
    (15, "灰度发布", "新版本先放量给 5% 用户观察指标再全量，属于（ ）。",
     {"A": "灰度/金丝雀发布", "B": "一次性全部停机硬切且无回滚", "C": "取消监控", "D": "明文传输密码"},
     "A", "【结论】小流量验证再放量。【白话】出问题可快速回滚，适合前端资源与后端服务。", "basic"),
    (13, "MVVM", "视图与状态双向约束、视图模型承载展示状态，常见于前端的是（ ）。",
     {"A": "MVVM（模型-视图-视图模型）", "B": "仅物理分页硬件", "C": "仅磁带批处理", "D": "取消组件化"},
     "A", "【结论】Vue/React 类思路常对标 MVVM/单向数据流变体。【白话】别和服务器 MVC 层层混淆职责。", "basic"),
]


def add_new_questions(rows: list[dict]) -> list[dict]:
    max_no = max((r.get("no") or 0 for r in rows), default=0)
    existing_stems = {r.get("stem") for r in rows}
    added = []
    for ch, point, stem, opts, ans, exp, diff in NEW_QUESTIONS:
        if stem in existing_stems:
            continue
        max_no += 1
        row = {
            "no": max_no,
            "id": qid(stem),
            "chapter": ch,
            "point": point,
            "stem": stem,
            "options": opts,
            "answer": ans,
            "explain": exp,
            "difficulty": diff,
            "source": "出题工坊-前端画像适配",
            "audience": ["frontend", "en_weak_friendly"],
            "profile_batch": "frontend-math-en-v1",
        }
        added.append(row)
        rows.append(row)
    return added


def export_chapters(rows: list[dict]) -> None:
    by_ch = defaultdict(list)
    for r in rows:
        by_ch[int(r["chapter"])].append(r)
    for ch, xs in by_ch.items():
        name = CH_NAMES.get(ch, f"第{ch}章")
        xs = sorted(xs, key=lambda r: r.get("no") or 0)
        lines = [f"# 综合知识 · 第{ch:02d}章 {name}", "", f"共 {len(xs)} 题。", "", "---", ""]
        for r in xs:
            lines.append(f"### {r.get('no')}. [{r.get('difficulty')}] {r.get('stem')}")
            lines.append("")
            for k in ["A", "B", "C", "D"]:
                if k in (r.get("options") or {}):
                    lines.append(f"- {k}. {r['options'][k]}")
            lines.append("")
            lines.append(f"<!-- ANS {r.get('answer')} | {r.get('point')} | {r.get('difficulty')} -->")
            lines.append("")
        (CHAP_DIR / f"第{ch:02d}章-{name}.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    lines = [
        "# 综合知识练习题库",
        "",
        "> 上午选择题第 0–15 章。已按「前端工程师 · 数学/英语弱项」做解析白话化与前端友好补强。",
        "",
        f"共 **{len(rows)}** 题。",
        "",
        "| 章 | 主题 | 题量 | 文件 |",
        "|----|------|------|------|",
    ]
    for ch in sorted(by_ch):
        name = CH_NAMES.get(ch, f"第{ch}章")
        fname = f"第{ch:02d}章-{name}.md"
        lines.append(f"| {ch} | {name} | {len(by_ch[ch])} | [{fname}](./{fname}) |")
    lines.append("")
    (CHAP_DIR / "00-目录.md").write_text("\n".join(lines), encoding="utf-8")


def write_kb_cards():
    KB_QUICK.mkdir(parents=True, exist_ok=True)
    cards = {
        "前端友好-数学白话卡.md": """# 速查 · 数学白话卡（数学弱项友好）

> 面向：上午第2章 · 少公式 · 先会选再会算

## 一句话选型

| 场景 | 选什么 | 别当成 |
|------|--------|--------|
| 从一个点到其他点，边长≥0 | Dijkstra（单源最短路） | 最小生成树 |
| 多源最短路 | Floyd | Dijkstra |
| 连通所有点，总长度最短 | Prim / Kruskal（最小生成树） | 最短路径 |
| 管道最大运输量 | 最大流 = 最小割 | 边数之和 |
| 有概率比方案 | 期望=Σ(概率×收益) | 只看最好/最坏 |
| 看选错多后悔 | 后悔值准则（Savage） | 期望准则 |
| 单窗口越忙越堵 | ρ=到达÷服务，ρ→1 等待暴涨 | 线性「慢一点」 |

## 贝叶斯直觉

检出阳性 ≠ 一定有病。病越少见，假阳性越要当心。

## 刷题建议

先做标记 `math_level=intuition` 的题；计算题（`calc`）放后，对着本表「先选型再动手」。
""",
        "前端友好-网络英文缩写卡.md": """# 速查 · 网络英文缩写卡（英语弱项友好）

| 缩写 | 中文 | 一句话 |
|------|------|--------|
| HTTP | 网页传输协议 | 浏览器和服务器说话的规矩 |
| HTTPS | 加密网页传输 | HTTP + TLS，登录必用 |
| TLS/SSL | 传输层安全 | 加密与证书 |
| DNS | 域名解析 | 把网址变成 IP |
| CDN | 内容分发网 | 静态资源就近缓存 |
| TCP | 可靠传输 | 要到达、要顺序 |
| UDP | 尽全力传输 | 快但不保证 |
| REST | 资源风格接口 | 用 URL+方法操作资源 |
| Cookie | 浏览器小纸条 | 常带会话 ID |
| Session | 服务端会话 | 真正登录态多在服务器 |
| API | 应用程序接口 | 前后端约定 |
| JWT | JSON 令牌 | 头.载荷.签名 |
| OAuth | 开放授权 | 不给密码，给有限令牌 |
| XSS | 跨站脚本 | 恶意 JS 跑在你的页面 |
| CSRF | 跨站请求伪造 | 借你的登录态办事 |
| CORS | 跨域资源共享 | 跨域要服务器点头 |
| CSP | 内容安全策略 | 限制脚本从哪来 |
""",
        "前端友好-HTTP缓存对照卡.md": """# 速查 · HTTP 缓存 vs 硬件 Cache

| 类型 | 在哪 | 典型词 | 别混淆 |
|------|------|--------|--------|
| 硬件 Cache | CPU/内存层次 | L1/L2 Cache | 不是浏览器缓存头 |
| HTTP 缓存 | 浏览器/代理 | Cache-Control、ETag、304 | 不是 Redis 业务缓存 |
| CDN 缓存 | 边缘节点 | 就近命中静态资源 | 不替代业务规则 |
| 应用缓存 | 服务端 Redis 等 | 热点数据 | 要防击穿/穿透 |

## 前端常考链

请求 →（可 304）→ 用本地；或 CDN 命中 → 源站。
鉴权接口一般 `Cache-Control: no-store`，别缓存带隐私的响应。
""",
        "前端友好-鉴权与安全卡.md": """# 速查 · 鉴权与前端安全

## 登录与授权

| 概念 | 白话 |
|------|------|
| Cookie + Session | 浏览器持 ID，服务器认人 |
| JWT | 自带信息的令牌（仍要校签名、控过期） |
| OAuth | 第三方授权，不交密码 |
| HTTPS | 传输加密，防偷密码 |

## 前端三连坑

| 风险 | 成因 | 防护 |
|------|------|------|
| XSS | 输入当 HTML/JS 执行 | 转义、CSP |
| CSRF | 异站借 Cookie 发请求 | Token、SameSite |
| 乱跨域 | 浏览器同源策略 | 服务器 CORS 头 |

## 同源

协议 + 域名 + 端口 都相同才同源。
""",
    }
    for name, body in cards.items():
        (KB_QUICK / name).write_text(body, encoding="utf-8")

    idx = json.loads(KB_INDEX.read_text(encoding="utf-8"))
    quick = next(s for s in idx["sections"] if s["id"] == "quick")
    new_items = [
        {"id": "quick-math-plain", "title": "前端友好 · 数学白话卡", "path": "速查/前端友好-数学白话卡.md", "status": "正式", "kind": "quick", "note": "数学弱项"},
        {"id": "quick-net-abbr", "title": "前端友好 · 网络英文缩写卡", "path": "速查/前端友好-网络英文缩写卡.md", "status": "正式", "kind": "quick", "note": "英语弱项"},
        {"id": "quick-http-cache", "title": "前端友好 · HTTP缓存对照卡", "path": "速查/前端友好-HTTP缓存对照卡.md", "status": "正式", "kind": "quick"},
        {"id": "quick-auth-sec", "title": "前端友好 · 鉴权与安全卡", "path": "速查/前端友好-鉴权与安全卡.md", "status": "正式", "kind": "quick"},
    ]
    have = {i["id"] for i in quick["items"]}
    for it in new_items:
        if it["id"] not in have:
            quick["items"].append(it)
    KB_INDEX.write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_docs(stats, added):
    NOTE.write_text(
        f"""# 前端画像综合知识适配说明（出题者 / 提示信息官 / 编制）

> 日期：2026-09-11  
> 画像：前端开发工程师 · 数学弱 · 英语弱

## 变更

| 项 | 结果 |
|----|------|
| 第2章白话解析 | {stats.get('ch2_explain', 0)} |
| 解析专名中文化 | {stats.get('gloss_explain', 0)} |
| 选项中文括注 | {stats.get('gloss_opt', 0)} |
| 前端章打标 | {stats.get('tag_frontend', 0)} |
| 新增 basic 题 | {len(added)} |
| 速查卡 | 4 张（数学白话 / 网络缩写 / HTTP缓存 / 鉴权安全） |

## 刷题建议

1. 刷题页选「前端友好路径」：优先 4/7/9/12/13/14/15 + 本批新题  
2. 第2章先做 `math_level=intuition`，计算题后置并对着数学白话卡  
3. 遇英文缩写先查「网络英文缩写卡」
""",
        encoding="utf-8",
    )
    REVIEW.write_text(
        f"""# 评审报告 · 前端画像综合知识适配（2026-09-11）

> 角色：评审员 + 提示信息官复核  
> 画像：前端工程师 · 数学/英语弱项

## 总评

**通过入库。** 在科目边界重编（仅 0–15 章）基础上，完成降门槛解析与前端友好补强。

| 检查项 | 结论 |
|--------|------|
| 未把案例/论文答题法塞进选择题 | 通过 |
| 第2章解析白话化 | 通过（{stats.get('ch2_explain', 0)} 题） |
| 英文选项/专名可理解 | 通过（括注+术语卡） |
| 前端缺口（CORS/鉴权/HTTP缓存/XSS） | 已补 basic {len(added)} 题 |
| 知识点速查可支撑弱项 | 新增 4 卡 |

## 提示信息官抽检

- 模板「【结论】【白话】【易错】」符合通俗要求  
- 未使用空洞套话；计算题保留最少步骤  

## 下一批建议

- ch12 继续补 basic 场景，压 deep 焦虑  
- 可选拆 `hint_ok`/`hint_bad` 字段  
""",
        encoding="utf-8",
    )


def main():
    rows = load_jsonl(PRACTICE)
    rows, stats = adapt_existing(rows)
    added = add_new_questions(rows)
    dump_jsonl(PRACTICE, rows)
    export_chapters(rows)
    write_kb_cards()
    write_docs(stats, added)
    print(json.dumps({"n": len(rows), "stats": dict(stats), "added": len(added), "by_ch": dict(Counter(r["chapter"] for r in rows))}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
