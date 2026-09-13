# 速查 · UML 体系化学习指南（由简入深）

> **对齐**：大纲 §5.7 统一建模语言 UML（教程第7章）+ 面向对象分析用例（第11章）  
> **规范依据**：OMG UML 2.5.1（结构 / 行为图分类、关系语义）  
> **本站旧稿**：第7章仅列图种与关系名；第11章仅有用例模型要点——本指南补全「读法、画法、易混、案例填空」并配**图形解释**  
> **读者画像**：前端向、弱数学；先看图再记口诀

---

## 0. 怎么用（15 分钟地图）

| 关卡 | 目标 | 建议用时 | 过关标准 |
|------|------|----------|----------|
| **L0 入门** | UML 是什么、两类图、考试考什么 | 20 分钟 | 能说「结构看静态、行为看动态」 |
| **L1 积木** | 事物 / 关系 / 图种总表 | 30 分钟 | 闭卷写出 5 种关系 + 5 种必考图 |
| **L2 必考五图** | 用例 / 类 / 序列 / 状态 / 活动 | 2–3 小时 | 见题干能选对图、会填空 |
| **L3 加深** | 聚合组合、include/extend、包/组件/部署 | 1 小时 | 易混对比不翻车 |
| **L4 应试** | 案例填空套路、4+1、OOA→OOD | 45 分钟 | 真题卷能限时开做 |

```mermaid
flowchart TB
  L0[L0 坐标系] --> L1[L1 积木与关系]
  L1 --> L2[L2 必考五图]
  L2 --> L3[L3 易混与次高频]
  L3 --> L4[L4 案例填空]
  L2 --> Case[案例分析真题练手]
```

**终局口诀**

> 看清**谁** → **什么结构** → **怎么交互/变状态** → 空白处回扣题干名词。

---

## 1. L0 · 入门：先立坐标系

### 1.1 UML 是什么

**UML** = 统一建模语言：用**标准图形符号**描述软件的结构与行为。不是编程语言，也不是开发过程。

### 1.2 两大语义区（先看这张总图）

```mermaid
flowchart LR
  subgraph S["结构图 · 系统长什么样"]
    C[类图]
    P[包图]
    Cmp[组件图]
    D[部署图]
  end
  subgraph B["行为图 · 系统怎么动"]
    U[用例图]
    Seq[序列图]
    St[状态机图]
    Act[活动图]
  end
  S -.静态.-> Sys((系统模型))
  B -.动态.-> Sys
```

| 类别 | 回答的问题 | 考试关键词 |
|------|------------|------------|
| **结构图** | 有哪些零件？如何连接？ | 类、包、组件、部署 |
| **行为图** | 如何运作、交互、换状态？ | 用例、序列、活动、状态 |

**必考优先级**：用例 → 类 → 序列 → 状态 → 活动 → 组件/部署。

---

## 2. L1 · 积木：事物、关系、图种

### 2.1 三类积木

```mermaid
flowchart TB
  Things[事物 Things<br/>类 / 用例 / 状态 / 组件…]
  Rels[关系 Relationships<br/>关联·依赖·泛化…]
  Diags[图 Diagrams<br/>把积木投影成视图]
  Things --> Diags
  Rels --> Diags
```

### 2.2 六种关系 · 图形速查（菱形在整体侧）

<figure class="uml-figure">
<svg viewBox="0 0 720 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="UML六种关系符号">
  <style>
    .t{font:14px sans-serif;fill:#d7e0ea}
    .s{font:12px sans-serif;fill:#8b9bb0}
    .box{fill:#1a2330;stroke:#4a5d73;stroke-width:1.5;rx:6}
    .line{stroke:#c5d0dc;stroke-width:2;fill:none}
    .dash{stroke-dasharray:6 4}
  </style>
  <!-- 关联 -->
  <text class="t" x="24" y="28">1 关联 Association ·「认识」</text>
  <rect class="box" x="40" y="44" width="70" height="36"/><text class="t" x="58" y="67">A</text>
  <line class="line" x1="110" y1="62" x2="200" y2="62"/>
  <rect class="box" x="200" y="44" width="70" height="36"/><text class="t" x="218" y="67">B</text>
  <text class="s" x="300" y="66">实线连接</text>

  <!-- 依赖 -->
  <text class="t" x="24" y="110">2 依赖 Dependency ·「用一下」</text>
  <rect class="box" x="40" y="126" width="70" height="36"/><text class="t" x="58" y="149">A</text>
  <line class="line dash" x1="110" y1="144" x2="190" y2="144"/>
  <polygon points="200,144 188,138 188,150" fill="#c5d0dc"/>
  <rect class="box" x="200" y="126" width="70" height="36"/><text class="t" x="218" y="149">B</text>
  <text class="s" x="300" y="148">虚线 + 开放箭头（指向被依赖方）</text>

  <!-- 泛化 -->
  <text class="t" x="24" y="192">3 泛化 Generalization ·「是一种」</text>
  <rect class="box" x="40" y="208" width="70" height="36"/><text class="t" x="52" y="231">子类</text>
  <line class="line" x1="110" y1="226" x2="185" y2="226"/>
  <polygon points="200,226 185,216 185,236" fill="#0f141c" stroke="#c5d0dc" stroke-width="2"/>
  <rect class="box" x="200" y="208" width="70" height="36"/><text class="t" x="52" y="0"></text><text class="t" x="212" y="231">父类</text>
  <text class="s" x="300" y="230">空心三角 · 指向一般（父）</text>

  <!-- 实现 -->
  <text class="t" x="24" y="274">4 实现 Realization ·「兑现契约」</text>
  <rect class="box" x="40" y="290" width="70" height="36"/><text class="t" x="55" y="313">类</text>
  <line class="line dash" x1="110" y1="308" x2="185" y2="308"/>
  <polygon points="200,308 185,298 185,318" fill="#0f141c" stroke="#c5d0dc" stroke-width="2"/>
  <rect class="box" x="200" y="290" width="90" height="36" stroke-dasharray="5 3"/><text class="t" x="215" y="313">«接口»</text>
  <text class="s" x="310" y="312">空心三角 + 虚线</text>

  <!-- 聚合 / 组合 -->
  <text class="t" x="400" y="28">5 聚合 Aggregation ·「有一些」</text>
  <rect class="box" x="420" y="44" width="70" height="36"/><text class="t" x="432" y="67">整体</text>
  <polygon points="500,62 512,54 524,62 512,70" fill="#0f141c" stroke="#c5d0dc" stroke-width="2"/>
  <line class="line" x1="524" y1="62" x2="580" y2="62"/>
  <rect class="box" x="580" y="44" width="70" height="36"/><text class="t" x="592" y="67">部分</text>
  <text class="s" x="420" y="100">空心菱形在整体侧</text>

  <text class="t" x="400" y="140">6 组合 Composition ·「长在身上」</text>
  <rect class="box" x="420" y="156" width="70" height="36"/><text class="t" x="432" y="179">整体</text>
  <polygon points="500,174 512,166 524,174 512,182" fill="#c5d0dc"/>
  <line class="line" x1="524" y1="174" x2="580" y2="174"/>
  <rect class="box" x="580" y="156" width="70" height="36"/><text class="t" x="592" y="179">部分</text>
  <text class="s" x="420" y="212">实心菱形 · 同生共死</text>

  <text class="s" x="400" y="260">记忆：菱形永远贴着「整体」；</text>
  <text class="s" x="400" y="280">空心=可拆散；实心=拆不了。</text>
</svg>
<figcaption>图 L1 · UML 六种关系符号一览（考试默画用）</figcaption>
</figure>

| 关系 | 符号 | 口诀 |
|------|------|------|
| 关联 | 实线 | 「认识」 |
| 依赖 | 虚线箭头 | 「用一下」 |
| 泛化 | 空心三角实线 | 「是一种」 |
| 实现 | 空心三角虚线 | 「兑现契约」 |
| 聚合 | 空心菱 | 「有一些」 |
| 组合 | 实心菱 | 「长在身上」 |

### 2.2.1 六种关系 · 定义（考什么、怎么判）

> **关系（Relationship）**：模型元素之间有语义的连接。类图里最常考；用例图另有通信 / `«include»` / `«extend»`（见 L2.1）。

| 关系 | 英文 | 定义（一句话） | 方向 / 读法 | 典型例子 | 应试锚点 |
|------|------|----------------|-------------|----------|----------|
| **关联** | Association | 两类对象之间**稳定、可导航**的结构联系（「谁与谁有业务往来」） | 实线；可标角色名、多重性（1、\*、0..1、1..\*） | 读者 — 预约记录（1 对多） | 最普通的「连线」；先问有没有长期关系 |
| **依赖** | Dependency | 一个元素的变化**可能影响**另一元素；多为**临时、使用性**弱耦合 | 虚线 + 开放箭头，**指向被依赖方**（提供方） | 预约管理 → 座位管理（调接口查余量） | 「用一下对方的能力」，不强调长期持有 |
| **泛化** | Generalization | **一般—特殊**（父—子）：子继承父的特征并可特化；「是一种」 | 空心三角实线，**三角指向父（一般）** | 读者、管理员 → 用户 | 继承；不可与实现搞混（实现是虚线） |
| **实现** | Realization | 分类器**兑现**另一分类器规定的契约（常为接口） | 空心三角 + **虚线**，三角指向接口/规范 | `OrderService`  realization `«interface» IOrder` | 「实现接口」；符号=泛化三角 + 依赖虚线 |
| **聚合** | Aggregation | **整体—部分**，部分可脱离整体**独立存在**（共享聚合） | 空心菱形贴在**整体**侧 | 车队 ◇— 车辆；部门 ◇— 员工 | 空心菱=可拆散；删整体不必删部分 |
| **组合** | Composition | **强整体—部分**，部分的生命周期**从属于**整体（同生共死） | 实心菱形贴在**整体**侧 | 订单 ◆— 订单明细；窗户 ◆— 窗框 | 实心菱=拆不了；删订单→明细一起没 |

**强度从弱到强（结构联系）**：依赖 ＜ 关联 ＜ 聚合 ＜ 组合。  
**分类系谱**：泛化 / 实现管「类型与契约」，不走菱形那一套。

```mermaid
flowchart TB
  Dep[依赖 · 临时使用] --> Assoc[关联 · 稳定往来]
  Assoc --> Agg[聚合 · 可拆的整体部分]
  Agg --> Comp[组合 · 同生共死]
  Gen[泛化 · 是一种] -.->|类型层次| Class[类]
  Real[实现 · 兑现接口] -.->|契约| IF[«接口»]
```

**定义级易混（先背这四条）**

| 别混 | 怎么分 |
|------|--------|
| 关联 vs 依赖 | 关联偏**结构持有/长期往来**；依赖偏**使用/参数/临时调用** |
| 聚合 vs 组合 | 看**生命周期**：部分能否独立存活 → 空心 / 实心菱 |
| 泛化 vs 实现 | 都是空心三角；**实线=继承父类，虚线=实现接口** |
| 菱形方向 | 菱形永远在**整体**一端（车队/订单侧），不在零件侧 |

**多重性（常跟关联一起考）**：写在关联线两端，表示「对方可以有几个实例」。如 `读者 1 —— * 预约记录` = 一个读者可有多条预约。

**前端类比（帮助记忆，勿写进答案）**：关联≈模块间稳定引用；依赖≈临时 `import` 工具函数；泛化≈组件继承；实现≈实现某个 Props/接口约定；聚合≈列表里挂子项可挪走；组合≈表单字段随表单卸载一起销毁。

### 2.3 图种热度（结构 / 行为）

**结构**：类★★★★★ · 组件/部署★★★ · 包★★ · 对象/组合结构★  
**行为**：用例★★★★★ · 序列★★★★★ · 状态/活动★★★★ · 通信★★

---

## 3. L2 · 必考五图（精读 · 带图）

### 3.1 用例图 Use Case

**回答**：边界外有谁，系统内完成哪些有价值目标。

<figure class="uml-figure">
<svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="用例图示例">
  <style>
    .t{font:13px sans-serif;fill:#d7e0ea}
    .s{font:11px sans-serif;fill:#8b9bb0}
    .bound{fill:#15202b;stroke:#5b7c99;stroke-width:2;rx:4}
    .uc{fill:#1e2a38;stroke:#7eb8da;stroke-width:2}
    .line{stroke:#c5d0dc;stroke-width:1.6;fill:none}
    .dash{stroke-dasharray:5 4}
  </style>
  <!-- actor -->
  <circle cx="70" cy="90" r="14" fill="none" stroke="#c5d0dc" stroke-width="2"/>
  <line x1="70" y1="104" x2="70" y2="150" stroke="#c5d0dc" stroke-width="2"/>
  <line x1="50" y1="120" x2="90" y2="120" stroke="#c5d0dc" stroke-width="2"/>
  <line x1="70" y1="150" x2="52" y2="185" stroke="#c5d0dc" stroke-width="2"/>
  <line x1="70" y1="150" x2="88" y2="185" stroke="#c5d0dc" stroke-width="2"/>
  <text class="t" x="48" y="210">用户</text>
  <text class="s" x="40" y="228">参与者</text>

  <!-- system boundary -->
  <rect class="bound" x="160" y="40" width="360" height="240"/>
  <text class="t" x="280" y="62">通讯录系统</text>

  <ellipse class="uc" cx="300" cy="120" rx="78" ry="28"/>
  <text class="t" x="258" y="125">查询联系人</text>

  <ellipse class="uc" cx="300" cy="200" rx="70" ry="26"/>
  <text class="t" x="262" y="205">身份认证</text>

  <ellipse class="uc" cx="460" cy="120" rx="70" ry="26"/>
  <text class="t" x="422" y="125">发送短信</text>

  <line class="line" x1="90" y1="120" x2="222" y2="120"/>
  <line class="line dash" x1="300" y1="148" x2="300" y2="174"/>
  <polygon points="300,174 295,164 305,164" fill="#7eb8da"/>
  <text class="s" x="308" y="168">«include»</text>

  <line class="line dash" x1="390" y1="120" x2="378" y2="120"/>
  <line class="line dash" x1="390" y1="120" x2="422" y2="120"/>
  <polygon points="378,120 388,115 388,125" fill="#7eb8da"/>
  <text class="s" x="385" y="108">«extend»</text>

  <text class="s" x="170" y="290">边界内=用例；边界外=参与者</text>
</svg>
<figcaption>图 3-1 · 用例图：参与者、边界、用例、include / extend</figcaption>
</figure>

#### include vs extend（看箭头）

```mermaid
flowchart LR
  Base[基用例：查询联系人]
  Inc[被包含：身份认证]
  Ext[扩展：发送短信]
  Base -->|«include» 必做| Inc
  Ext -->|«extend» 可选| Base
```

| | include | extend |
|--|---------|--------|
| 时机 | **每次**都执行 | 条件满足才执行 |
| 箭头 | 基 → 被包含 | **扩展 → 基** |
| 话术 | 抽公共子流程 | 可选增值/异常 |

#### 案例填空看哪里

1. 边界外空白 → **参与者**  
2. 椭圆空白 → **用例名**（动宾）  
3. 虚线旁 → 先判必经/可选，再写 include 或 extend  

---

### 3.2 类图 Class

**回答**：有哪些类、属性/操作，类如何关联。

<figure class="uml-figure">
<svg viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="类图示例">
  <style>
    .t{font:12px sans-serif;fill:#d7e0ea}
    .s{font:11px sans-serif;fill:#8b9bb0}
    .box{fill:#1a2330;stroke:#7eb8da;stroke-width:1.6}
    .div{stroke:#4a5d73;stroke-width:1}
    .line{stroke:#c5d0dc;stroke-width:1.8;fill:none}
  </style>
  <!-- Order -->
  <rect class="box" x="40" y="40" width="150" height="120"/>
  <line class="div" x1="40" y1="68" x2="190" y2="68"/>
  <line class="div" x1="40" y1="110" x2="190" y2="110"/>
  <text class="t" x="88" y="60">订单</text>
  <text class="s" x="52" y="88">-订单号</text>
  <text class="s" x="52" y="104">-金额</text>
  <text class="s" x="52" y="130">+提交()</text>
  <text class="s" x="52" y="146">+支付()</text>

  <!-- OrderLine -->
  <rect class="box" x="360" y="50" width="150" height="100"/>
  <line class="div" x1="360" y1="78" x2="510" y2="78"/>
  <line class="div" x1="360" y1="112" x2="510" y2="112"/>
  <text class="t" x="398" y="70">订单明细</text>
  <text class="s" x="372" y="98">-数量</text>
  <text class="s" x="372" y="132">+小计()</text>

  <!-- composition -->
  <polygon points="200,95 212,87 224,95 212,103" fill="#c5d0dc"/>
  <line class="line" x1="224" y1="95" x2="360" y2="95"/>
  <text class="s" x="250" y="86">1</text>
  <text class="s" x="330" y="86">1..*</text>
  <text class="s" x="250" y="118">组合：删订单→明细没了</text>

  <!-- Boundary Control Entity -->
  <rect class="box" x="40" y="210" width="120" height="50" rx="4"/>
  <text class="t" x="62" y="240">边界 Boundary</text>
  <rect class="box" x="200" y="210" width="120" height="50" rx="4"/>
  <text class="t" x="225" y="240">控制 Control</text>
  <rect class="box" x="360" y="210" width="120" height="50" rx="4"/>
  <text class="t" x="388" y="240">实体 Entity</text>
  <text class="s" x="500" y="240">分析类三角色</text>
</svg>
<figcaption>图 3-2 · 类盒子三格 + 组合关系 + 分析类三角色</figcaption>
</figure>

**三格**：类名 / 属性 / 操作()。可见性：`+` public · `-` private · `#` protected。

**分析类口诀**：界面收发、控制编排、实体存业务。

**多重性读法**：靠近对端的数字 = 「一个本端对应几个对端」。

---

### 3.3 序列图 Sequence

**回答**：某场景下对象**按时间**发了哪些消息（时间从上往下）。

```mermaid
sequenceDiagram
  autonumber
  actor 用户
  participant UI as 订单界面
  participant Ctrl as 订单控制
  participant Ent as 订单
  用户->>UI: 提交订单
  UI->>Ctrl: 创建订单()
  Ctrl->>Ent: 保存()
  Ent-->>Ctrl: ok
  Ctrl-->>UI: 成功
  UI-->>用户: 显示结果
```

<figure class="uml-figure">
<pre class="uml-ascii">
  用户          订单界面         订单控制          订单
   │               │               │               │
   │  提交订单      │               │               │
   │──────────────►│               │               │
   │               │ 创建订单()    │               │
   │               │──────────────►│               │
   │               │               │   保存()      │
   │               │               │──────────────►│
   │               │               │◄─ ─ ─ ok ─ ─ ─│
   │               │◄── 成功 ──────│               │
   │◄── 显示结果 ──│               │               │
   ▼               ▼               ▼               ▼
              ↑ 生命线（时间向下）      激活条=正在干活
</pre>
<figcaption>图 3-3 · 序列图读法：生命线、消息、返回（虚线）</figcaption>
</figure>

| 元素 | 含义 |
|------|------|
| 生命线 | 对象在时间上的存在 |
| 同步消息 | 实心箭头，调用方等待 |
| 返回 | 虚线箭头（可省略） |
| `alt`/`opt`/`loop` | 分支 / 可选 / 循环片段 |

---

### 3.4 状态机图 State Machine

**回答**：**某一个对象**生命周期里有哪些状态、事件如何迁移。

<figure class="uml-figure">
<svg viewBox="0 0 700 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="订单状态机">
  <style>
    .t{font:12px sans-serif;fill:#d7e0ea}
    .s{font:11px sans-serif;fill:#8b9bb0}
    .st{fill:#1a2330;stroke:#7eb8da;stroke-width:1.8;rx:14}
    .line{stroke:#c5d0dc;stroke-width:1.6;fill:none}
  </style>
  <circle cx="30" cy="100" r="8" fill="#c5d0dc"/>
  <line class="line" x1="38" y1="100" x2="70" y2="100"/>
  <polygon points="70,100 60,95 60,105" fill="#c5d0dc"/>

  <rect class="st" x="70" y="78" width="90" height="44"/>
  <text class="t" x="88" y="105">待支付</text>

  <line class="line" x1="160" y1="100" x2="210" y2="100"/>
  <polygon points="210,100 200,95 200,105" fill="#c5d0dc"/>
  <text class="s" x="162" y="90">支付成功</text>

  <rect class="st" x="210" y="78" width="90" height="44"/>
  <text class="t" x="228" y="105">已支付</text>

  <line class="line" x1="300" y1="100" x2="350" y2="100"/>
  <polygon points="350,100 340,95 340,105" fill="#c5d0dc"/>
  <text class="s" x="312" y="90">发货</text>

  <rect class="st" x="350" y="78" width="90" height="44"/>
  <text class="t" x="368" y="105">已发货</text>

  <line class="line" x1="440" y1="100" x2="490" y2="100"/>
  <polygon points="490,100 480,95 480,105" fill="#c5d0dc"/>
  <text class="s" x="448" y="90">签收</text>

  <rect class="st" x="490" y="78" width="80" height="44"/>
  <text class="t" x="510" y="105">完成</text>

  <line class="line" x1="570" y1="100" x2="610" y2="100"/>
  <circle cx="620" cy="100" r="10" fill="none" stroke="#c5d0dc" stroke-width="2"/>
  <circle cx="620" cy="100" r="5" fill="#c5d0dc"/>

  <path class="line" d="M115 122 Q115 175 250 175 Q380 175 380 122"/>
  <polygon points="380,122 372,130 388,130" fill="#c5d0dc"/>
  <text class="s" x="200" y="192">超时 / 取消 → 也可画到「已取消」状态</text>
</svg>
<figcaption>图 3-4 · 订单状态机：初态● → 状态 → 终态◉；箭头旁写事件</figcaption>
</figure>

| 何时用状态图 | 何时用活动图 |
|--------------|--------------|
| 焦点是**一个对象**的状态 | 焦点是**业务流程**步骤/并行 |
| 「处于什么状态」 | 「下一步做什么」 |

迁移标注格式：`事件[条件]/动作`

---

### 3.5 活动图 Activity

**回答**：流程如何推进，哪里分支、合并、并行。

```mermaid
flowchart TB
  Start((●)) --> A[填写订单]
  A --> B{库存足够?}
  B -->|是| C[扣减库存]
  B -->|否| D[提示缺货]
  C --> E[支付]
  E --> F[发货]
  F --> End((◉))
  D --> End
```

| 元素 | 画法 |
|------|------|
| 动作 | 圆角矩形 |
| 决策 | 菱形 |
| 分叉/汇合 | 粗横线（并行） |
| 泳道 | 按角色分列 |

与流程图三区别：可表达**并行**、**对象流/泳道**、基于 **token** 语义（UML 2）。

---

## 4. L3 · 加深：易混与次高频

### 4.1 聚合 vs 组合（定义再钉死）

**聚合（Aggregation）定义**：表示整体与部分的关系，强调「整体拥有/包含部分」，但部分**可以脱离整体独立存在**（共享生命周期不强制绑定）。符号：空心菱形在整体侧。

**组合（Composition）定义**：更强的整体—部分关系，部分是整体的**构成要素**，其创建与消亡通常随整体而定（整体删除则部分无意义/一并删除）。符号：实心菱形在整体侧。

```mermaid
flowchart LR
  Team[车队] --o 车1[车辆]
  Order[订单] --* Line[订单明细]
```

| | 聚合 ○ | 组合 ● |
|--|--------|--------|
| 定义关键词 | 可共享、可独立 | 构成、同生共死 |
| 生命周期 | 部分可独立于整体 | 部分随整体消亡 |
| 例子 | 车队—车；书架—书 | 订单—明细；人体—心脏（考题常类比） |
| 判题句 | 「拆开后部分还在」 | 「删整体则部分没了 / 不能单独存在」 |

**与关联的关系**：聚合、组合都是**特殊的关联**（带整体—部分语义）；拿不准强度时，案例里有「删除级联」信号 → 优先组合。

### 4.2 组件 / 部署（一眼分清）

```mermaid
flowchart TB
  subgraph Comp["组件图 · 谁提供/需要接口"]
    Web[Web组件] -->|提供| API((订单API))
    App[App] -->|需求| API
  end
  subgraph Dep["部署图 · 跑在哪"]
    N1[应用服务器]
    N2[数据库节点]
    Art[order.war] -.->|部署到| N1
    DB[(DB)] -.-> N2
  end
```

---

## 5. L4 · 应试：看图填空

### 5.1 题干信号 → 选图

| 题干信号 | 优先图 |
|----------|--------|
| 角色、功能目标、边界 | 用例 |
| 概念类、属性、多重性 | 类图 |
| 调用顺序、消息 | 序列 |
| 状态、超时取消 | 状态机 |
| 流程、并行、审批 | 活动 |
| 部署到哪台机器 | 部署 |

### 5.2 填空四步

1. 圈题干名词  
2. 定空白语义（名 / 关系 / 消息 / 事件）  
3. 核对关系方向（include/extend、菱形在整体）  
4. **用题干原词**填

### 5.3 OOA→OOD 链条（图）

```mermaid
flowchart LR
  UC[用例模型] --> AC[分析类<br/>边界/控制/实体]
  AC --> SEQ[序列细化]
  SEQ --> DES[设计类/组件]
  DES --> DEP[部署]
```

### 5.4 30 秒默写

- [ ] 结构/行为各举 3 图  
- [ ] 六关系：**定义各一句** + 符号  
- [ ] 关联/依赖、聚合/组合、泛化/实现 三组易混  
- [ ] include 必含、extend 可选  
- [ ] 分析类三角色  
- [ ] 状态图 vs 活动图  

---

## 6. 迷你练习

**A** 共享单车：列出 ≥3 用例、≥2 参与者（先在纸上画小人+椭圆）。  
**B** 「删订单则明细一起删」→ 组合还是聚合？菱形在哪侧？各用一句话给出**定义**依据。  
**C** 订单待支付→已支付→已发货→完成，超时取消 → 用哪张图？  
**D** 用一句话区分：关联 vs 依赖；泛化 vs 实现。

**要点**：B 组合（部分生命周期从属整体）、实心菱在订单侧；C 状态机图；D 见 §2.2.1。

---

## 7. 与本站材料

| 材料 | 关系 |
|------|------|
| 第7章 UML 概要 | 考前 30 秒回忆 |
| 第11章 用例模型 | 规约与构建步骤 |
| 案例分析真题 | 五图实战场 |

站点知识点页已支持 **Mermaid 图形渲染**；本页 SVG / ASCII 图无需外网亦可看。

---

## 8. 规范说明

对齐 **OMG UML 2.5.1**。软考或用「顺序图/协作图」旧称，与序列图/通信图概念等价即可。
