# -*- coding: utf-8 -*-
"""
《女神异闻录：阿尔卡那协奏》文字版 - 核心数据定义
元素、力度、相性、卡牌、阵营、敌人数据
"""
from __future__ import annotations
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional


# ===================== 枚举定义 =====================

class Element(str, Enum):
    PHYSICAL = "物理"
    FIRE = "火焰"
    ICE = "冰冻"
    WIND = "疾风"
    ELEC = "电击"
    BLESS = "祝福"
    CURSE = "咒怨"
    ALMIGHTY = "万能"
    HEAL = "恢复"
    SUPPORT = "辅助"

    @property
    def icon(self) -> str:
        return ELEMENT_ICON[self]


class Power(int, Enum):
    SM = 1   # 少量
    MD = 2   # 中等
    LG = 3   # 大量
    HV = 4   # 特大
    XH = 5   # 超特大

    @property
    def name_cn(self) -> str:
        return POWER_NAME[self]


class Range(str, Enum):
    SINGLE = "单体"
    ALL = "全体"


class Affinity(str, Enum):
    WEAK = "弱点"
    NORMAL = "普通"
    RESIST = "耐性"
    NULL = "无效"
    REPEL = "反弹"
    DRAIN = "吸收"

    @property
    def multiplier(self) -> float:
        return AFFINITY_MULTIPLIER[self]


class CardType(str, Enum):
    PERSONA = "PERSONA"
    SWORD = "SWORD"
    WAND = "WAND"
    CUP = "CUP"
    PENTACLE = "PENTACLE"
    THEURGY = "THEURGY"
    ALL_OUT = "ALL_OUT"


# ===================== 常量映射 =====================

ELEMENT_ICON = {
    Element.PHYSICAL: "⚔️",
    Element.FIRE: "🔥",
    Element.ICE: "❄️",
    Element.WIND: "💨",
    Element.ELEC: "⚡",
    Element.BLESS: "✨",
    Element.CURSE: "💀",
    Element.ALMIGHTY: "🌟",
    Element.HEAL: "💚",
    Element.SUPPORT: "🛡️",
}

POWER_NAME = {
    Power.SM: "少量",
    Power.MD: "中等",
    Power.LG: "大量",
    Power.HV: "特大",
    Power.XH: "超特大",
}

# 力度倍率
POWER_MULTIPLIER = {
    Power.SM: 0.5,
    Power.MD: 1.0,
    Power.LG: 1.8,
    Power.HV: 2.8,
    Power.XH: 4.0,
}

# 相性倍率
AFFINITY_MULTIPLIER = {
    Affinity.WEAK: 1.5,
    Affinity.NORMAL: 1.0,
    Affinity.RESIST: 0.5,
    Affinity.NULL: 0.0,
    Affinity.REPEL: -1.0,   # 反噬
    Affinity.DRAIN: -1.0,   # 吸收（转为治疗，这里用负数标记）
}

# 相性图标
AFFINITY_ICON = {
    Affinity.WEAK: "🔺弱点",
    Affinity.RESIST: "🔷耐性",
    Affinity.NULL: "⚪无效",
    Affinity.REPEL: "🔶反弹",
    Affinity.DRAIN: "💧吸收",
}

# 等阶
RANK_NAME = {1: "C", 2: "B", 3: "A", 4: "S"}


# ===================== 技能数据 =====================

@dataclass
class SkillData:
    element: Element
    power: Power
    range: Range
    name: str = ""

    def __str__(self) -> str:
        return f"{self.element.icon}{self.element.value}·{self.range.value}·{self.power.name_cn}"


# ===================== 卡牌定义 =====================

@dataclass
class Card:
    card_id: str
    name: str
    card_type: CardType
    rank: int = 1
    arcana: str = ""
    # 人格面具卡：正逆位双技能
    skill_upright: Optional[SkillData] = None
    skill_reversed: Optional[SkillData] = None
    is_reversed: bool = False
    # 宝剑/神通法/总攻击：固定技能
    skill: Optional[SkillData] = None
    # 小阿尔卡那描述
    desc: str = ""

    @property
    def active_skill(self) -> Optional[SkillData]:
        """获取当前生效的技能"""
        if self.card_type == CardType.PERSONA:
            return self.skill_reversed if self.is_reversed else self.skill_upright
        return self.skill

    @property
    def is_composable(self) -> bool:
        """是否可参与构筑"""
        return self.card_type in (CardType.PERSONA, CardType.SWORD)

    def flip(self) -> None:
        if self.card_type == CardType.PERSONA:
            self.is_reversed = not self.is_reversed

    def short_desc(self) -> str:
        if self.card_type == CardType.PERSONA:
            sk = self.active_skill
            pos = "逆位▼" if self.is_reversed else "正位▲"
            return f"[{RANK_NAME[self.rank]}]{self.name} {pos} {sk}"
        elif self.card_type == CardType.SWORD:
            return f"[{RANK_NAME[self.rank]}]{self.name} {self.skill}"
        elif self.card_type == CardType.WAND:
            return f"[{RANK_NAME[self.rank]}]{self.name} 权杖：获得高阶卡牌"
        elif self.card_type == CardType.CUP:
            return f"[{RANK_NAME[self.rank]}]{self.name} 圣杯：本回合伤害+50%"
        elif self.card_type == CardType.PENTACLE:
            return f"[{RANK_NAME[self.rank]}]{self.name} 星币：获得资金"
        elif self.card_type == CardType.THEURGY:
            return f"[{RANK_NAME[self.rank]}]{self.name} 神通法 {self.skill}"
        elif self.card_type == CardType.ALL_OUT:
            return f"{self.name} 总攻击 {self.skill}"
        return self.name


# ===================== 阵营定义 =====================

@dataclass
class ArcanaFaction:
    id: str
    name: str
    bonus_name: str
    bonus_desc: str
    persona_pool: list[str]  # 人格面具卡ID列表


# ===================== 敌人定义 =====================

@dataclass
class EnemyTemplate:
    name: str
    level: int
    max_hp: int
    attack: int
    affinities: dict[Element, Affinity]  # 仅列出非普通相性
    intent_pool: list[str]  # 行动意图池


# ===================== 卡牌数据库 =====================

def build_card_db() -> dict[str, Card]:
    db: dict[str, Card] = {}

    # ---------- 愚者阵营 ----------
    db["orpheus"] = Card(
        card_id="orpheus", name="俄耳甫斯", card_type=CardType.PERSONA,
        rank=1, arcana="愚者",
        skill_upright=SkillData(Element.FIRE, Power.SM, Range.SINGLE, "阿基"),
        skill_reversed=SkillData(Element.HEAL, Power.MD, Range.SINGLE, "迪奥拉"),
    )
    db["slime"] = Card(
        card_id="slime", name="软泥怪", card_type=CardType.PERSONA,
        rank=1, arcana="愚者",
        skill_upright=SkillData(Element.PHYSICAL, Power.MD, Range.SINGLE, "斩击"),
        skill_reversed=SkillData(Element.ICE, Power.SM, Range.SINGLE, "布芙"),
    )
    db["evil_legion"] = Card(
        card_id="evil_legion", name="恶灵军团", card_type=CardType.PERSONA,
        rank=1, arcana="愚者",
        skill_upright=SkillData(Element.CURSE, Power.SM, Range.SINGLE, "邪眼"),
        skill_reversed=SkillData(Element.PHYSICAL, Power.SM, Range.ALL, "音速拳"),
    )

    # ---------- 魔术师阵营 ----------
    db["jack_frost"] = Card(
        card_id="jack_frost", name="杰克霜精", card_type=CardType.PERSONA,
        rank=1, arcana="魔术师",
        skill_upright=SkillData(Element.ICE, Power.SM, Range.SINGLE, "布芙"),
        skill_reversed=SkillData(Element.HEAL, Power.SM, Range.SINGLE, "迪奥拉"),
    )
    db["jack_lantern"] = Card(
        card_id="jack_lantern", name="杰克灯笼", card_type=CardType.PERSONA,
        rank=1, arcana="魔术师",
        skill_upright=SkillData(Element.FIRE, Power.SM, Range.SINGLE, "阿基"),
        skill_reversed=SkillData(Element.FIRE, Power.SM, Range.ALL, "玛哈阿基"),
    )
    db["nekomata"] = Card(
        card_id="nekomata", name="猫又", card_type=CardType.PERSONA,
        rank=1, arcana="魔术师",
        skill_upright=SkillData(Element.FIRE, Power.MD, Range.SINGLE, "阿基拉"),
        skill_reversed=SkillData(Element.PHYSICAL, Power.MD, Range.SINGLE, "斩击"),
    )
    db["hua_po"] = Card(
        card_id="hua_po", name="花魄", card_type=CardType.PERSONA,
        rank=1, arcana="魔术师",
        skill_upright=SkillData(Element.FIRE, Power.SM, Range.ALL, "玛哈阿基"),
        skill_reversed=SkillData(Element.HEAL, Power.MD, Range.SINGLE, "迪拉翰"),
    )

    # ---------- 恋爱阵营 ----------
    db["pixie"] = Card(
        card_id="pixie", name="皮克西", card_type=CardType.PERSONA,
        rank=1, arcana="恋爱",
        skill_upright=SkillData(Element.ELEC, Power.SM, Range.SINGLE, "吉欧"),
        skill_reversed=SkillData(Element.HEAL, Power.SM, Range.SINGLE, "迪奥拉"),
    )
    db["sylph"] = Card(
        card_id="sylph", name="希路奇", card_type=CardType.PERSONA,
        rank=1, arcana="恋爱",
        skill_upright=SkillData(Element.WIND, Power.MD, Range.SINGLE, "加尔"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.SINGLE, "拉坤达"),
    )
    db["naga"] = Card(
        card_id="naga", name="娜迦", card_type=CardType.PERSONA,
        rank=1, arcana="恋爱",
        skill_upright=SkillData(Element.ELEC, Power.SM, Range.ALL, "玛哈吉欧"),
        skill_reversed=SkillData(Element.WIND, Power.SM, Range.SINGLE, "加尔"),
    )

    # ---------- 宝剑卡（通用） ----------
    db["sword_c"] = Card(
        card_id="sword_c", name="宝剑", card_type=CardType.SWORD, rank=1,
        skill=SkillData(Element.ELEC, Power.SM, Range.SINGLE, "电击斩"),
    )
    db["sword_b"] = Card(
        card_id="sword_b", name="宝剑·改", card_type=CardType.SWORD, rank=2,
        skill=SkillData(Element.WIND, Power.MD, Range.SINGLE, "疾风斩"),
    )

    # ---------- 小阿尔卡那（通用） ----------
    db["wand_c"] = Card(card_id="wand_c", name="权杖", card_type=CardType.WAND, rank=1, desc="获得一张高阶卡牌")
    db["cup_c"] = Card(card_id="cup_c", name="圣杯", card_type=CardType.CUP, rank=1, desc="本回合最终伤害+50%")
    db["pentacle_c"] = Card(card_id="pentacle_c", name="星币", card_type=CardType.PENTACLE, rank=1, desc="获得资金")

    # ---------- 神通法卡 ----------
    db["theurgy_fire"] = Card(
        card_id="theurgy_fire", name="烈焰神通法", card_type=CardType.THEURGY, rank=2,
        skill=SkillData(Element.FIRE, Power.HV, Range.ALL, "炼狱"),
    )
    db["theurgy_ice"] = Card(
        card_id="theurgy_ice", name="极寒神通法", card_type=CardType.THEURGY, rank=2,
        skill=SkillData(Element.ICE, Power.HV, Range.ALL, "绝对零度"),
    )
    db["theurgy_wind"] = Card(
        card_id="theurgy_wind", name="疾风神通法", card_type=CardType.THEURGY, rank=2,
        skill=SkillData(Element.WIND, Power.HV, Range.ALL, "真空波"),
    )
    db["theurgy_elec"] = Card(
        card_id="theurgy_elec", name="雷霆神通法", card_type=CardType.THEURGY, rank=2,
        skill=SkillData(Element.ELEC, Power.HV, Range.ALL, "雷霆暴雨"),
    )
    db["theurgy_bless"] = Card(
        card_id="theurgy_bless", name="圣光神通法", card_type=CardType.THEURGY, rank=2,
        skill=SkillData(Element.BLESS, Power.HV, Range.ALL, "神圣审判"),
    )

    # ---------- 女教皇阵营 ----------
    db["juno"] = Card(
        card_id="juno", name="朱诺", card_type=CardType.PERSONA,
        rank=1, arcana="女教皇",
        skill_upright=SkillData(Element.BLESS, Power.SM, Range.SINGLE, "哈玛"),
        skill_reversed=SkillData(Element.HEAL, Power.MD, Range.ALL, "玛哈迪奥拉"),
    )
    db["kohryu"] = Card(
        card_id="kohryu", name="皇广龙", card_type=CardType.PERSONA,
        rank=2, arcana="女教皇",
        skill_upright=SkillData(Element.ELEC, Power.LG, Range.ALL, "玛哈吉欧达因"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.ALL, "玛哈拉坤达"),
    )

    # ---------- 女皇阵营 ----------
    db["narasimha"] = Card(
        card_id="narasimha", name="那罗辛哈", card_type=CardType.PERSONA,
        rank=1, arcana="女皇",
        skill_upright=SkillData(Element.FIRE, Power.MD, Range.SINGLE, "阿基拉"),
        skill_reversed=SkillData(Element.PHYSICAL, Power.MD, Range.SINGLE, "斩击"),
    )
    db["titania"] = Card(
        card_id="titania", name="缇坦妮亚", card_type=CardType.PERSONA,
        rank=2, arcana="女皇",
        skill_upright=SkillData(Element.ICE, Power.LG, Range.ALL, "玛哈布芙达因"),
        skill_reversed=SkillData(Element.HEAL, Power.LG, Range.ALL, "迪亚拉翰"),
    )

    # ---------- 皇帝阵营 ----------
    db["houdai"] = Card(
        card_id="houdai", name="法王鼎", card_type=CardType.PERSONA,
        rank=1, arcana="皇帝",
        skill_upright=SkillData(Element.FIRE, Power.MD, Range.ALL, "玛哈阿基"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.ALL, "玛哈塔尔卡加"),
    )
    db["thor"] = Card(
        card_id="thor", name="托尔", card_type=CardType.PERSONA,
        rank=2, arcana="皇帝",
        skill_upright=SkillData(Element.ELEC, Power.LG, Range.SINGLE, "吉欧达因"),
        skill_reversed=SkillData(Element.ELEC, Power.HV, Range.ALL, "雷霆万钧"),
    )

    # ---------- 教皇阵营 ----------
    db["flauros"] = Card(
        card_id="flauros", name="弗劳洛斯", card_type=CardType.PERSONA,
        rank=1, arcana="教皇",
        skill_upright=SkillData(Element.PHYSICAL, Power.LG, Range.SINGLE, "猛击"),
        skill_reversed=SkillData(Element.CURSE, Power.MD, Range.SINGLE, "姆多"),
    )
    db["anubis"] = Card(
        card_id="anubis", name="阿努比斯", card_type=CardType.PERSONA,
        rank=2, arcana="教皇",
        skill_upright=SkillData(Element.CURSE, Power.LG, Range.SINGLE, "姆多翁"),
        skill_reversed=SkillData(Element.BLESS, Power.LG, Range.SINGLE, "哈玛翁"),
    )

    # ---------- 战车阵营 ----------
    db["athena"] = Card(
        card_id="athena", name="雅典娜", card_type=CardType.PERSONA,
        rank=2, arcana="战车",
        skill_upright=SkillData(Element.PHYSICAL, Power.LG, Range.ALL, "大斩击"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.SINGLE, "特拉法拉"),
    )
    db["agathion"] = Card(
        card_id="agathion", name="阿伽忒亚斯", card_type=CardType.PERSONA,
        rank=1, arcana="战车",
        skill_upright=SkillData(Element.ELEC, Power.SM, Range.SINGLE, "吉欧"),
        skill_reversed=SkillData(Element.PHYSICAL, Power.SM, Range.SINGLE, "突击"),
    )

    # ---------- 正义阵营 ----------
    db["angel"] = Card(
        card_id="angel", name="天使", card_type=CardType.PERSONA,
        rank=1, arcana="正义",
        skill_upright=SkillData(Element.BLESS, Power.SM, Range.SINGLE, "哈玛"),
        skill_reversed=SkillData(Element.HEAL, Power.SM, Range.SINGLE, "迪奥拉"),
    )
    db["archangel"] = Card(
        card_id="archangel", name="大天使", card_type=CardType.PERSONA,
        rank=2, arcana="正义",
        skill_upright=SkillData(Element.BLESS, Power.MD, Range.ALL, "玛哈哈玛"),
        skill_reversed=SkillData(Element.PHYSICAL, Power.MD, Range.SINGLE, "大斩击"),
    )

    # ---------- 隐者阵营 ----------
    db["mojo"] = Card(
        card_id="mojo", name="莫乔", card_type=CardType.PERSONA,
        rank=1, arcana="隐者",
        skill_upright=SkillData(Element.CURSE, Power.SM, Range.SINGLE, "姆多"),
        skill_reversed=SkillData(Element.HEAL, Power.SM, Range.SINGLE, "迪奥拉"),
    )
    db["kumbhanda"] = Card(
        card_id="kumbhanda", name="俱毗罗大", card_type=CardType.PERSONA,
        rank=2, arcana="隐者",
        skill_upright=SkillData(Element.ICE, Power.MD, Range.ALL, "玛哈布芙"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.ALL, "玛哈斯坤达"),
    )

    # ---------- 命运阵营 ----------
    db["kushinada"] = Card(
        card_id="kushinada", name="奇稻田姬", card_type=CardType.PERSONA,
        rank=2, arcana="命运",
        skill_upright=SkillData(Element.WIND, Power.LG, Range.ALL, "加尔达因"),
        skill_reversed=SkillData(Element.HEAL, Power.LG, Range.ALL, "迪亚拉翰"),
    )
    db["fortuna"] = Card(
        card_id="fortuna", name="福尔图娜", card_type=CardType.PERSONA,
        rank=1, arcana="命运",
        skill_upright=SkillData(Element.BLESS, Power.MD, Range.ALL, "玛哈哈玛"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.SINGLE, "特拉法拉"),
    )

    # ---------- 力量阵营 ----------
    db["valkyrie"] = Card(
        card_id="valkyrie", name="女武神", card_type=CardType.PERSONA,
        rank=1, arcana="力量",
        skill_upright=SkillData(Element.PHYSICAL, Power.MD, Range.SINGLE, "斩击"),
        skill_reversed=SkillData(Element.HEAL, Power.SM, Range.SINGLE, "迪奥拉"),
    )
    db["matador"] = Card(
        card_id="matador", name="斗牛士", card_type=CardType.PERSONA,
        rank=2, arcana="力量",
        skill_upright=SkillData(Element.WIND, Power.MD, Range.SINGLE, "加尔拉"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.SINGLE, "斯坤达"),
    )

    # ---------- 倒悬者阵营 ----------
    db["bed_of_nails"] = Card(
        card_id="bed_of_nails", name="钉床", card_type=CardType.PERSONA,
        rank=1, arcana="倒悬者",
        skill_upright=SkillData(Element.PHYSICAL, Power.MD, Range.SINGLE, "斩击"),
        skill_reversed=SkillData(Element.PHYSICAL, Power.SM, Range.ALL, "音速拳"),
    )
    db["oni"] = Card(
        card_id="oni", name="鬼神", card_type=CardType.PERSONA,
        rank=2, arcana="倒悬者",
        skill_upright=SkillData(Element.PHYSICAL, Power.HV, Range.SINGLE, "鬼神斩"),
        skill_reversed=SkillData(Element.FIRE, Power.MD, Range.ALL, "玛哈阿基拉"),
    )

    # ---------- 死神阵营 ----------
    db["pale_rider"] = Card(
        card_id="pale_rider", name="苍白骑士", card_type=CardType.PERSONA,
        rank=2, arcana="死神",
        skill_upright=SkillData(Element.CURSE, Power.LG, Range.SINGLE, "姆多翁"),
        skill_reversed=SkillData(Element.WIND, Power.MD, Range.ALL, "玛哈加尔"),
    )
    db["thanatos"] = Card(
        card_id="thanatos", name="塔纳托斯", card_type=CardType.PERSONA,
        rank=3, arcana="死神",
        skill_upright=SkillData(Element.CURSE, Power.HV, Range.ALL, "深夜之帏"),
        skill_reversed=SkillData(Element.PHYSICAL, Power.HV, Range.SINGLE, "死神斩"),
    )

    # ---------- 节制阵营 ----------
    db["mitra"] = Card(
        card_id="mitra", name="密特拉", card_type=CardType.PERSONA,
        rank=2, arcana="节制",
        skill_upright=SkillData(Element.ICE, Power.LG, Range.SINGLE, "布芙达因"),
        skill_reversed=SkillData(Element.BLESS, Power.MD, Range.SINGLE, "哈玛翁"),
    )
    db["sukunahime"] = Card(
        card_id="sukunahime", name="酒解姬", card_type=CardType.PERSONA,
        rank=1, arcana="节制",
        skill_upright=SkillData(Element.BLESS, Power.SM, Range.SINGLE, "哈玛"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.SINGLE, "拉坤达"),
    )

    # ---------- 恶魔阵营 ----------
    db["lilim"] = Card(
        card_id="lilim", name="莉莉姆", card_type=CardType.PERSONA,
        rank=1, arcana="恶魔",
        skill_upright=SkillData(Element.CURSE, Power.MD, Range.SINGLE, "姆多拉"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.SINGLE, "塔尔卡加"),
    )
    db["belial"] = Card(
        card_id="belial", name="彼列", card_type=CardType.PERSONA,
        rank=2, arcana="恶魔",
        skill_upright=SkillData(Element.FIRE, Power.HV, Range.ALL, "炼狱"),
        skill_reversed=SkillData(Element.CURSE, Power.LG, Range.ALL, "玛哈姆多翁"),
    )

    # ---------- 塔阵营 ----------
    db["rakshasa"] = Card(
        card_id="rakshasa", name="罗刹", card_type=CardType.PERSONA,
        rank=1, arcana="塔",
        skill_upright=SkillData(Element.WIND, Power.MD, Range.SINGLE, "加尔拉"),
        skill_reversed=SkillData(Element.PHYSICAL, Power.LG, Range.SINGLE, "猛击"),
    )
    db["yoshitsune"] = Card(
        card_id="yoshitsune", name="义经", card_type=CardType.PERSONA,
        rank=3, arcana="塔",
        skill_upright=SkillData(Element.PHYSICAL, Power.XH, Range.ALL, "大胜利"),
        skill_reversed=SkillData(Element.WIND, Power.HV, Range.SINGLE, "加尔达因"),
    )

    # ---------- 星阵营 ----------
    db["hancock"] = Card(
        card_id="hancock", name="哈奴克斯", card_type=CardType.PERSONA,
        rank=1, arcana="星",
        skill_upright=SkillData(Element.WIND, Power.SM, Range.SINGLE, "加尔"),
        skill_reversed=SkillData(Element.HEAL, Power.SM, Range.SINGLE, "迪奥拉"),
    )
    db["kaiwan"] = Card(
        card_id="kaiwan", name="凯湾", card_type=CardType.PERSONA,
        rank=2, arcana="星",
        skill_upright=SkillData(Element.ALMIGHTY, Power.LG, Range.SINGLE, "米吉多拉"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.ALL, "玛哈塔尔卡加"),
    )

    # ---------- 月亮阵营 ----------
    db["saki_mitama"] = Card(
        card_id="saki_mitama", name="咲魂", card_type=CardType.PERSONA,
        rank=1, arcana="月亮",
        skill_upright=SkillData(Element.HEAL, Power.MD, Range.SINGLE, "迪奥拉"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.SINGLE, "塔尔卡加"),
    )
    db["ara_habaki"] = Card(
        card_id="ara_habaki", name="荒霸吐", card_type=CardType.PERSONA,
        rank=2, arcana="月亮",
        skill_upright=SkillData(Element.PHYSICAL, Power.HV, Range.SINGLE, "破坏神拳"),
        skill_reversed=SkillData(Element.WIND, Power.LG, Range.ALL, "玛哈加尔拉"),
    )

    # ---------- 太阳阵营 ----------
    db["tamamo"] = Card(
        card_id="tamamo", name="玉藻前", card_type=CardType.PERSONA,
        rank=1, arcana="太阳",
        skill_upright=SkillData(Element.FIRE, Power.MD, Range.SINGLE, "阿基拉"),
        skill_reversed=SkillData(Element.HEAL, Power.LG, Range.ALL, "迪亚拉翰"),
    )
    db["horus"] = Card(
        card_id="horus", name="荷鲁斯", card_type=CardType.PERSONA,
        rank=2, arcana="太阳",
        skill_upright=SkillData(Element.BLESS, Power.LG, Range.ALL, "玛哈哈玛翁"),
        skill_reversed=SkillData(Element.ALMIGHTY, Power.LG, Range.SINGLE, "米吉多拉"),
    )

    # ---------- 审判阵营 ----------
    db["yamata_no_orochi"] = Card(
        card_id="yamata_no_orochi", name="八岐大蛇", card_type=CardType.PERSONA,
        rank=2, arcana="审判",
        skill_upright=SkillData(Element.ICE, Power.HV, Range.ALL, "玛哈布芙达因"),
        skill_reversed=SkillData(Element.PHYSICAL, Power.HV, Range.SINGLE, "八岐斩"),
    )
    db["messiah"] = Card(
        card_id="messiah", name="救世主", card_type=CardType.PERSONA,
        rank=3, arcana="审判",
        skill_upright=SkillData(Element.ALMIGHTY, Power.XH, Range.ALL, "终焉之刻"),
        skill_reversed=SkillData(Element.HEAL, Power.XH, Range.ALL, "全员完全恢复"),
    )

    # ---------- 永劫阵营 ----------
    db["lal_beg"] = Card(
        card_id="lal_beg", name="拉尔贝格", card_type=CardType.PERSONA,
        rank=2, arcana="永劫",
        skill_upright=SkillData(Element.ALMIGHTY, Power.LG, Range.ALL, "米吉多拉"),
        skill_reversed=SkillData(Element.SUPPORT, Power.MD, Range.ALL, "玛哈塔尔卡加"),
    )
    db["shiva"] = Card(
        card_id="shiva", name="湿婆", card_type=CardType.PERSONA,
        rank=3, arcana="永劫",
        skill_upright=SkillData(Element.ALMIGHTY, Power.XH, Range.ALL, "毁灭之舞"),
        skill_reversed=SkillData(Element.FIRE, Power.XH, Range.ALL, "暗夜火焰"),
    )

    # ---------- 愚者扩展（亚森） ----------
    db["arsene"] = Card(
        card_id="arsene", name="亚森", card_type=CardType.PERSONA,
        rank=2, arcana="愚者",
        skill_upright=SkillData(Element.CURSE, Power.MD, Range.SINGLE, "耶加翁"),
        skill_reversed=SkillData(Element.PHYSICAL, Power.LG, Range.ALL, "黑色闪光"),
    )

    # ---------- 恋爱扩展（那耳喀索斯） ----------
    db["narssis"] = Card(
        card_id="narssis", name="那耳喀索斯", card_type=CardType.PERSONA,
        rank=2, arcana="恋爱",
        skill_upright=SkillData(Element.ICE, Power.LG, Range.SINGLE, "布芙达因"),
        skill_reversed=SkillData(Element.ELEC, Power.LG, Range.SINGLE, "吉欧达因"),
    )

    # ---------- 魔术师扩展（赫耳墨斯） ----------
    db["hermes"] = Card(
        card_id="hermes", name="赫耳墨斯", card_type=CardType.PERSONA,
        rank=1, arcana="魔术师",
        skill_upright=SkillData(Element.WIND, Power.MD, Range.SINGLE, "加尔"),
        skill_reversed=SkillData(Element.FIRE, Power.SM, Range.SINGLE, "阿基"),
    )

    return db


# ===================== 阵营数据库 =====================

def build_arcana_db() -> dict[str, ArcanaFaction]:
    return {
        "愚者": ArcanaFaction(
            id="愚者", name="愚者",
            bonus_name="无拘之人",
            bonus_desc="每回合首次构筑技能力度+1阶",
            persona_pool=["orpheus", "slime", "evil_legion", "arsene"],
        ),
        "魔术师": ArcanaFaction(
            id="魔术师", name="魔术师",
            bonus_name="炎之契约者",
            bonus_desc="火焰属性伤害+20%",
            persona_pool=["jack_frost", "jack_lantern", "nekomata", "hua_po", "hermes"],
        ),
        "女教皇": ArcanaFaction(
            id="女教皇", name="女教皇",
            bonus_name="神圣女祭司",
            bonus_desc="祝福属性伤害+15%",
            persona_pool=["juno", "kohryu"],
        ),
        "女皇": ArcanaFaction(
            id="女皇", name="女皇",
            bonus_name="丰饶之母",
            bonus_desc="资金获取+50%",
            persona_pool=["narasimha", "titania"],
        ),
        "皇帝": ArcanaFaction(
            id="皇帝", name="皇帝",
            bonus_name="霸者之统",
            bonus_desc="攻击力+15%",
            persona_pool=["houdai", "thor"],
        ),
        "教皇": ArcanaFaction(
            id="教皇", name="教皇",
            bonus_name="咒祝之主",
            bonus_desc="咒怨属性伤害+15%",
            persona_pool=["flauros", "anubis"],
        ),
        "恋爱": ArcanaFaction(
            id="恋爱", name="恋爱",
            bonus_name="爱之守护者",
            bonus_desc="恢复技能效果+30%",
            persona_pool=["pixie", "sylph", "naga", "narssis"],
        ),
        "战车": ArcanaFaction(
            id="战车", name="战车",
            bonus_name="战场先锋",
            bonus_desc="物理伤害+15%",
            persona_pool=["athena", "agathion"],
        ),
        "正义": ArcanaFaction(
            id="正义", name="正义",
            bonus_name="审判之光",
            bonus_desc="祝福伤害+20%，暴击+5%",
            persona_pool=["angel", "archangel"],
        ),
        "隐者": ArcanaFaction(
            id="隐者", name="隐者",
            bonus_name="孤独智者",
            bonus_desc="抽牌费用-30%",
            persona_pool=["mojo", "kumbhanda"],
        ),
        "命运": ArcanaFaction(
            id="命运", name="命运",
            bonus_name="命运抉择",
            bonus_desc="暴击率+10%",
            persona_pool=["kushinada", "fortuna"],
        ),
        "力量": ArcanaFaction(
            id="力量", name="力量",
            bonus_name="百战之勇",
            bonus_desc="物理伤害+20%",
            persona_pool=["valkyrie", "matador"],
        ),
        "倒悬者": ArcanaFaction(
            id="倒悬者", name="倒悬者",
            bonus_name="逆位之解",
            bonus_desc="每回合翻转次数+1",
            persona_pool=["bed_of_nails", "oni"],
        ),
        "死神": ArcanaFaction(
            id="死神", name="死神",
            bonus_name="终焉之刃",
            bonus_desc="咒怨伤害+25%，对倒地敌人+30%",
            persona_pool=["pale_rider", "thanatos"],
        ),
        "节制": ArcanaFaction(
            id="节制", name="节制",
            bonus_name="中和之力",
            bonus_desc="神通法槽+1，恢复+15%",
            persona_pool=["mitra", "sukunahime"],
        ),
        "恶魔": ArcanaFaction(
            id="恶魔", name="恶魔",
            bonus_name="暗契约者",
            bonus_desc="咒怨伤害+20%，削弱效果+50%",
            persona_pool=["lilim", "belial"],
        ),
        "塔": ArcanaFaction(
            id="塔", name="塔",
            bonus_name="崩天之塔",
            bonus_desc="总攻击伤害+50%",
            persona_pool=["rakshasa", "yoshitsune"],
        ),
        "星": ArcanaFaction(
            id="星", name="星",
            bonus_name="希望之光",
            bonus_desc="圣杯加成+50%",
            persona_pool=["hancock", "kaiwan"],
        ),
        "月亮": ArcanaFaction(
            id="月亮", name="月亮",
            bonus_name="幽月之梦",
            bonus_desc="每回合额外抽1张牌",
            persona_pool=["saki_mitama", "ara_habaki"],
        ),
        "太阳": ArcanaFaction(
            id="太阳", name="太阳",
            bonus_name="光辉之阳",
            bonus_desc="HP恢复+50%",
            persona_pool=["tamamo", "horus"],
        ),
        "审判": ArcanaFaction(
            id="审判", name="审判",
            bonus_name="终末审判",
            bonus_desc="万能属性伤害+20%",
            persona_pool=["yamata_no_orochi", "messiah"],
        ),
        "永劫": ArcanaFaction(
            id="永劫", name="永劫",
            bonus_name="永恒轮回",
            bonus_desc="全属性伤害+8%",
            persona_pool=["lal_beg", "shiva"],
        ),
    }


# 初始解锁阵营
INITIAL_FACTIONS = ["愚者", "魔术师", "恋爱"]


# ===================== 局外养成数据 =====================

@dataclass
class PersonaRecipe:
    """合成配方：将2-3张人格面具合成为新的高阶人格面具"""
    recipe_id: str
    materials: list[str]          # 材料 persona 的 card_id 列表
    result: str                   # 合成产物的 card_id
    cost: int = 0                 # 合成费用


@dataclass
class PassiveSkill:
    """被动技能：装备人格面具后生效"""
    skill_id: str
    name: str
    desc: str
    # 数值参数，由 engine 解析
    attack_bonus: int = 0
    crit_bonus: float = 0.0
    hp_bonus: int = 0
    fire_mult: float = 1.0
    ice_mult: float = 1.0
    wind_mult: float = 1.0
    elec_mult: float = 1.0
    bless_mult: float = 1.0
    curse_mult: float = 1.0
    phys_mult: float = 1.0
    heal_bonus: float = 0.0


def build_persona_recipes() -> dict[str, PersonaRecipe]:
    """合成配方库（天鹅绒房间）"""
    return {
        "recipe_slime_to_high": PersonaRecipe(
            recipe_id="recipe_slime_to_high",
            materials=["slime", "orpheus"], result="arsene", cost=500,
        ),
        "recipe_pixie_to_high": PersonaRecipe(
            recipe_id="recipe_pixie_to_high",
            materials=["pixie", "sylph"], result="narssis", cost=500,
        ),
        "recipe_jack_fusion": PersonaRecipe(
            recipe_id="recipe_jack_fusion",
            materials=["jack_frost", "jack_lantern"], result="hua_po", cost=800,
        ),
        "recipe_warriors": PersonaRecipe(
            recipe_id="recipe_warriors",
            materials=["valkyrie", "matador"], result="oni", cost=1200,
        ),
        "recipe_judgement": PersonaRecipe(
            recipe_id="recipe_judgement",
            materials=["thanatos", "shiva"], result="messiah", cost=3000,
        ),
        "recipe_paladin": PersonaRecipe(
            recipe_id="recipe_paladin",
            materials=["athena", "houdai"], result="yoshitsune", cost=2000,
        ),
        "recipe_archmage": PersonaRecipe(
            recipe_id="recipe_archmage",
            materials=["thor", "titania"], result="kohryu", cost=1500,
        ),
    }


def build_passive_skills() -> dict[str, PassiveSkill]:
    """被动技能库：人格面具装备时提供的被动"""
    return {
        "passive_fire_resist": PassiveSkill(
            skill_id="passive_fire_resist", name="火焰耐性",
            desc="火焰受到伤害减少50%",
            fire_mult=0.5,
        ),
        "passive_ice_resist": PassiveSkill(
            skill_id="passive_ice_resist", name="冰冻耐性",
            desc="冰冻受到伤害减少50%",
            ice_mult=0.5,
        ),
        "passive_elec_resist": PassiveSkill(
            skill_id="passive_elec_resist", name="电击耐性",
            desc="电击受到伤害减少50%",
            elec_mult=0.5,
        ),
        "passive_wind_resist": PassiveSkill(
            skill_id="passive_wind_resist", name="疾风耐性",
            desc="疾风受到伤害减少50%",
            wind_mult=0.5,
        ),
        "passive_bless_boost": PassiveSkill(
            skill_id="passive_bless_boost", name="祝福强化",
            desc="祝福伤害+25%",
            bless_mult=1.25,
        ),
        "passive_curse_boost": PassiveSkill(
            skill_id="passive_curse_boost", name="咒怨强化",
            desc="咒怨伤害+25%",
            curse_mult=1.25,
        ),
        "passive_phys_boost": PassiveSkill(
            skill_id="passive_phys_boost", name="物理强化",
            desc="物理伤害+25%",
            phys_mult=1.25,
        ),
        "passive_attack_up": PassiveSkill(
            skill_id="passive_attack_up", name="攻击强化",
            desc="攻击力+30",
            attack_bonus=30,
        ),
        "passive_crit_up": PassiveSkill(
            skill_id="passive_crit_up", name="暴击强化",
            desc="暴击率+10%",
            crit_bonus=0.10,
        ),
        "passive_hp_up": PassiveSkill(
            skill_id="passive_hp_up", name="生命强化",
            desc="最大HP+200",
            hp_bonus=200,
        ),
        "passive_heal_boost": PassiveSkill(
            skill_id="passive_heal_boost", name="恢复强化",
            desc="恢复技能效果+30%",
            heal_bonus=0.30,
        ),
    }


# 人格面具 → 被动技能映射（默认每张人格面具卡提供1个被动）
def build_persona_passive_map() -> dict[str, str]:
    """人格面具card_id → 被动技能skill_id"""
    return {
        "orpheus": "passive_fire_resist",
        "jack_frost": "passive_ice_resist",
        "jack_lantern": "passive_fire_resist",
        "hua_po": "passive_fire_resist",
        "pixie": "passive_elec_resist",
        "sylph": "passive_wind_resist",
        "naga": "passive_elec_resist",
        "arsene": "passive_curse_boost",
        "narssis": "passive_ice_resist",
        "hermes": "passive_wind_resist",
        "juno": "passive_bless_boost",
        "kohryu": "passive_elec_resist",
        "narasimha": "passive_fire_resist",
        "titania": "passive_ice_resist",
        "houdai": "passive_fire_resist",
        "thor": "passive_elec_resist",
        "flauros": "passive_curse_boost",
        "anubis": "passive_curse_boost",
        "athena": "passive_phys_boost",
        "agathion": "passive_elec_resist",
        "angel": "passive_bless_boost",
        "archangel": "passive_bless_boost",
        "mojo": "passive_curse_boost",
        "kumbhanda": "passive_ice_resist",
        "kushinada": "passive_wind_resist",
        "fortuna": "passive_crit_up",
        "valkyrie": "passive_phys_boost",
        "matador": "passive_wind_resist",
        "bed_of_nails": "passive_phys_boost",
        "oni": "passive_attack_up",
        "pale_rider": "passive_curse_boost",
        "thanatos": "passive_curse_boost",
        "mitra": "passive_ice_resist",
        "sukunahime": "passive_heal_boost",
        "lilim": "passive_curse_boost",
        "belial": "passive_curse_boost",
        "rakshasa": "passive_wind_resist",
        "yoshitsune": "passive_phys_boost",
        "hancock": "passive_wind_resist",
        "kaiwan": "passive_attack_up",
        "saki_mitama": "passive_heal_boost",
        "ara_habaki": "passive_phys_boost",
        "tamamo": "passive_fire_resist",
        "horus": "passive_bless_boost",
        "yamata_no_orochi": "passive_ice_resist",
        "messiah": "passive_hp_up",
        "lal_beg": "passive_hp_up",
        "shiva": "passive_attack_up",
        "slime": "passive_phys_boost",
        "evil_legion": "passive_curse_boost",
        "nekomata": "passive_fire_resist",
    }


# 升级所需经验表（player_level → 升到下一级所需经验）
PLAYER_LEVEL_EXP = [100, 250, 500, 900, 1500, 2200, 3200, 4500, 6000, 8000]


# 大阿尔卡那顺序（用于UI显示）
ARCANA_ORDER = [
    "愚者", "魔术师", "女教皇", "女皇", "皇帝", "教皇",
    "恋爱", "战车", "正义", "隐者", "命运", "力量",
    "倒悬者", "死神", "节制", "恶魔", "塔", "星",
    "月亮", "太阳", "审判", "永劫",
]


# 各阵营解锁条件（默认解锁3个，其他通过波次进度解锁）
def get_unlocked_factions(wave: int, owned_arcana: list[str] | None = None) -> list[str]:
    """根据波次和已拥有的人格面具，返回已解锁的阵营列表"""
    unlocked = list(INITIAL_FACTIONS)
    # 每过3波解锁一个新阵营（按ARCANA_ORDER顺序）
    extra = wave // 3
    for i in range(min(extra, len(ARCANA_ORDER) - 3)):
        arc = ARCANA_ORDER[i + 3]  # 跳过初始3个
        if arc not in unlocked:
            unlocked.append(arc)
    # 拥有对应人格面具的阵营也解锁
    if owned_arcana:
        for arc in owned_arcana:
            if arc not in unlocked:
                unlocked.append(arc)
    return unlocked


# ===================== 敌人数据库 =====================

def build_enemy_db() -> dict[str, EnemyTemplate]:
    return {
        "maya": EnemyTemplate(
            name="暗影·怯懦的玛雅", level=3, max_hp=180, attack=35,
            affinities={Element.ELEC: Affinity.WEAK},
            intent_pool=["ATTACK_SINGLE", "ATTACK_SINGLE", "BUFF_SELF"],
        ),
        "crying_table": EnemyTemplate(
            name="暗影·哭泣的桌子", level=4, max_hp=220, attack=40,
            affinities={Element.ICE: Affinity.WEAK},
            intent_pool=["ATTACK_SINGLE", "ATTACK_SINGLE", "DEBUFF_PLAYER"],
        ),
        "jack_frost_shadow": EnemyTemplate(
            name="暗影·杰克霜精", level=12, max_hp=420, attack=70,
            affinities={Element.FIRE: Affinity.WEAK, Element.ICE: Affinity.RESIST, Element.ELEC: Affinity.NULL},
            intent_pool=["ATTACK_SINGLE", "ATTACK_ALL", "BUFF_SELF"],
        ),
        "pixie_shadow": EnemyTemplate(
            name="暗影·皮克西", level=10, max_hp=380, attack=60,
            affinities={Element.ELEC: Affinity.WEAK, Element.WIND: Affinity.NULL},
            intent_pool=["ATTACK_SINGLE", "DEBUFF_PLAYER", "HEAL_SELF"],
        ),
        "orc_avatar": EnemyTemplate(
            name="暗影·兽人化身", level=6, max_hp=300, attack=55,
            affinities={Element.FIRE: Affinity.WEAK, Element.PHYSICAL: Affinity.RESIST},
            intent_pool=["ATTACK_SINGLE", "ATTACK_ALL"],
        ),
        "obsidian_mage": EnemyTemplate(
            name="暗影·黑曜石魔导师", level=15, max_hp=520, attack=85,
            affinities={Element.PHYSICAL: Affinity.WEAK, Element.FIRE: Affinity.RESIST, Element.CURSE: Affinity.NULL},
            intent_pool=["ATTACK_ALL", "DEBUFF_PLAYER", "BUFF_SELF"],
        ),
        "frost_queen": EnemyTemplate(
            name="暗影·霜之女王", level=18, max_hp=680, attack=100,
            affinities={Element.FIRE: Affinity.WEAK, Element.ICE: Affinity.DRAIN, Element.ELEC: Affinity.RESIST},
            intent_pool=["ATTACK_ALL", "ATTACK_SINGLE", "HEAL_SELF", "DEBUFF_PLAYER"],
        ),
        "reaper": EnemyTemplate(
            name="死神·塔纳托斯", level=30, max_hp=1800, attack=160,
            affinities={Element.CURSE: Affinity.DRAIN, Element.BLESS: Affinity.WEAK, Element.PHYSICAL: Affinity.RESIST, Element.FIRE: Affinity.NULL},
            intent_pool=["ATTACK_ALL", "ATTACK_SINGLE", "DEBUFF_PLAYER", "HEAL_SELF"],
        ),
    }


# ===================== 波次配置 =====================

@dataclass
class WaveConfig:
    wave: int
    enemy_ids: list[str]
    is_boss: bool = False
    hp_mult: float = 1.0
    atk_mult: float = 1.0


def get_wave_config(wave: int) -> WaveConfig:
    """根据波次返回敌人配置（难度递增）"""
    # 每5波出现BOSS
    if wave % 5 == 0:
        return WaveConfig(wave=wave, enemy_ids=["reaper"], is_boss=True,
                          hp_mult=1.0 + (wave - 5) * 0.15, atk_mult=1.0 + (wave - 5) * 0.1)

    # 普通波次：敌人组合随波次变化
    pools = [
        ["maya", "crying_table"],                              # 波1
        ["maya", "crying_table", "orc_avatar"],                 # 波2
        ["orc_avatar", "orc_avatar", "pixie_shadow"],           # 波3
        ["jack_frost_shadow", "pixie_shadow", "orc_avatar"],    # 波4
        ["obsidian_mage", "pixie_shadow"],                      # 波6
        ["obsidian_mage", "frost_queen"],                       # 波7
        ["frost_queen", "obsidian_mage", "orc_avatar"],         # 波8
        ["frost_queen", "frost_queen", "jack_frost_shadow"],    # 波9
    ]
    idx = min(wave - 1, len(pools) - 1)
    base_hp = 1.0 + (wave - 1) * 0.12
    base_atk = 1.0 + (wave - 1) * 0.08
    return WaveConfig(wave=wave, enemy_ids=pools[idx], is_boss=False,
                      hp_mult=base_hp, atk_mult=base_atk)
