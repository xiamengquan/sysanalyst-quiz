/**
 * 建模语法链 · 知识点索引（分解层展示数据）
 *
 * 39 个考点配置项是「词汇」，SA / OOA 建模是「语法」——本索引把站点已建仓的建模知识清单化：
 * 每个芯片直链 /drill 步骤链卡组或已审计速查（quick-sao-learn / quick-uml-learn / quick-compare），
 * title 为高频易错点。纯展示层数据：不新增知识点，全部指向既有已审计内容。
 */

export type ModelingGroup = "sa" | "ooa" | "bridge";

export type ModelingItem = {
  id: string;
  name: string;
  group: ModelingGroup;
  /** 层级标注（L0–L4 对齐 quick-sao-learn；「链」= /drill 步骤链步骤位） */
  level: string;
  href: string;
  /** 高频易错点（芯片 hover 提示） */
  trap: string;
};

const DRILL_UML = "/drill/?deck=UML-%E5%BB%BA%E6%A8%A1%E6%AD%A5%E9%AA%A4%E9%93%BE";
const DRILL_DB = "/drill/?deck=%E6%95%B0%E6%8D%AE%E5%BA%93%E8%AE%BE%E8%AE%A1%E6%AD%A5%E9%AA%A4%E9%93%BE";
const DRILL_REQ = "/drill/?deck=%E9%9C%80%E6%B1%82%E5%B7%A5%E7%A8%8B%E6%AD%A5%E9%AA%A4%E9%93%BE";
const SAO = "/kb/quick-sao-learn/";
const UML_GUIDE = "/kb/quick-uml-learn/";
const COMPARE = "/kb/quick-compare/";

export const MODELING_GROUPS: { id: ModelingGroup; label: string; hint: string }[] = [
  { id: "sa", label: "结构化分析 SA", hint: "功能分解 · 数据流视角" },
  { id: "ooa", label: "面向对象分析 OOA", hint: "对象交互 · 职责视角" },
  { id: "bridge", label: "通识与对比迁移", hint: "选范式选图的元技能" },
];

export const MODELING_ITEMS: ModelingItem[] = [
  // —— SA（L1–L2）——
  { id: "sa-dfd-4", name: "DFD 四要素", group: "sa", level: "L1", href: SAO, trap: "外部实体在边界外；存储与加工必有数据流接触" },
  { id: "sa-dfd-naming", name: "命名规则与 0/1 层图", group: "sa", level: "L1", href: SAO, trap: "改错题常考：加工要动宾命名；父图-子图平衡" },
  { id: "sa-dfd-steps", name: "DFD 绘制五步骤 + 三作用", group: "sa", level: "L1", href: SAO, trap: "需求阶段标准流程；选择/简答双料考点" },
  { id: "sa-dd", name: "数据字典", group: "sa", level: "L2", href: SAO, trap: "DFD 的文字版说明书；词条类型与写法" },
  { id: "sa-logic", name: "加工逻辑三写法", group: "sa", level: "L2", href: SAO, trap: "结构化语言/判定表/判定树，按逻辑复杂度选型" },
  { id: "sa-std", name: "状态转换图 STD", group: "sa", level: "L2", href: SAO, trap: "状态/迁移/事件三要素；与 UML 状态图同源不同符号" },
  { id: "sa-balance", name: "父子图平衡 + 绘制六规则", group: "sa", level: "L2", href: SAO, trap: "案例改错核心：失衡 = 黑洞/奇迹图" },
  { id: "sa-3model", name: "SA 三模型关系", group: "sa", level: "L2", href: SAO, trap: "功能 DFD + 数据 ER + 行为 STD，各答什么问题" },
  { id: "sa-rtsad", name: "RTSAD 环境/行为模型", group: "sa", level: "L2", href: SAO, trap: "实时扩展：控制流图与事件流；答卷写法" },
  // —— OOA（L3）——
  { id: "ooa-def", name: "系统分析建模定义/作用", group: "ooa", level: "L3", href: SAO, trap: "定义/作用两段式，论文案例通用开头" },
  { id: "ooa-uc3", name: "用例模型三要素", group: "ooa", level: "L3", href: SAO, trap: "include 必然包含 / extend 可选扩展，箭头方向常写反" },
  { id: "ooa-uc-vs", name: "业务用例 vs 系统用例", group: "ooa", level: "L3", href: SAO, trap: "粒度与目的差异；别把系统边界画进业务用例" },
  { id: "ooa-spec", name: "用例规约", group: "ooa", level: "L3", href: SAO, trap: "主成功场景 + 扩展流程；案例写规约的模板" },
  { id: "ooa-bce", name: "分析类三角色 BCE", group: "ooa", level: "L3", href: SAO, trap: "边界/控制/实体职责划分；顺序图消息与之对应" },
  { id: "ooa-crc", name: "CRC 建模", group: "ooa", level: "L3", href: SAO, trap: "类–责任–协作者；责任分配表述法" },
  { id: "ooa-artifact", name: "分析模型产物", group: "ooa", level: "L3", href: SAO, trap: "用例模型 + 分析类图 + 交互概览，衔接 OOD" },
  // —— 通识与对比迁移（L0 / L4）——
  { id: "br-map", name: "两范式坐标系", group: "bridge", level: "L0", href: SAO, trap: "SA=功能分解（数据流视角），OOA=对象交互（职责视角）" },
  { id: "br-signal", name: "题干信号 → 范式与选图", group: "bridge", level: "L4", href: SAO, trap: "考试最高频元技能：题干关键词定范式" },
  { id: "br-4step", name: "案例填空四步法", group: "bridge", level: "L4", href: SAO, trap: "SA/OOA 通用：先骨架后细节" },
  { id: "br-uml", name: "UML 六图衔接链", group: "bridge", level: "链", href: DRILL_UML, trap: "用例→类→顺序→状态→活动→部署，先写作用句再对答案" },
  { id: "br-uml-guide", name: "UML 体系化学习指南", group: "bridge", level: "速查", href: UML_GUIDE, trap: "由简入深 L1–L3；六关系与五图边界" },
  { id: "br-db-chain", name: "数据库设计六阶段链", group: "bridge", level: "链", href: DRILL_DB, trap: "概念设计=ER、逻辑设计=关系模式；范式判断" },
  { id: "br-req-chain", name: "需求工程五步链", group: "bridge", level: "链", href: DRILL_REQ, trap: "获取→分析→定义→验证→管理，每步作用句先写后对" },
  { id: "br-compare", name: "架构风格对比表", group: "bridge", level: "网", href: COMPARE, trap: "论文选型论证主力：风格对比 + 质量属性场景" },
];
