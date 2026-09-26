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

    return db


# ===================== 阵营数据库 =====================

def build_arcana_db() -> dict[str, ArcanaFaction]:
    return {
        "愚者": ArcanaFaction(
            id="愚者", name="愚者",
            bonus_name="无拘之人",
            bonus_desc="每回合首次构筑技能力度+1阶",
            persona_pool=["orpheus", "slime", "evil_legion"],
        ),
        "魔术师": ArcanaFaction(
            id="魔术师", name="魔术师",
            bonus_name="炎之契约者",
            bonus_desc="火焰属性伤害+20%",
            persona_pool=["jack_frost", "jack_lantern", "nekomata", "hua_po"],
        ),
        "恋爱": ArcanaFaction(
            id="恋爱", name="恋爱",
            bonus_name="爱之守护者",
            bonus_desc="恢复技能效果+30%",
            persona_pool=["pixie", "sylph", "naga"],
        ),
    }


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
