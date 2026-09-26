# -*- coding: utf-8 -*-
"""
《女神异闻录：阿尔卡那协奏》文字版 - 核心引擎
叠牌构筑合成、伤害计算、玩家/敌人、回合状态机、局外养成
"""
from __future__ import annotations
import random
import copy
from dataclasses import dataclass, field
from typing import Optional

from data import (
    Element, Power, Range, Affinity, CardType, Card, SkillData,
    POWER_MULTIPLIER, AFFINITY_MULTIPLIER,
    PersonaRecipe, PassiveSkill,
    build_passive_skills, build_persona_passive_map,
    PLAYER_LEVEL_EXP,
)


# ===================== 合成算法 =====================

def compose_skill(cards: list[Card]) -> Optional[SkillData]:
    """
    叠牌构筑合成算法（严格按计划书示例实现）
    规则1：同属性力度叠加（上限5）
    规则2：异属性改变属性，力度不叠加（保持当前力度）
    规则3：范围由最后一张卡决定
    规则4：万能属性改变属性为万能且力度叠加；万能属性一旦生效，
           后续非万能卡无法再改变属性（仅贡献范围）
    """
    if not cards:
        return None

    first = cards[0].active_skill
    if first is None:
        return None

    element = first.element
    power = first.power
    rng = first.range
    almighty_locked = (element == Element.ALMIGHTY)

    for card in cards[1:]:
        sk = card.active_skill
        if sk is None:
            continue

        # 规则4：万能属性同时改变属性和力度
        if sk.element == Element.ALMIGHTY:
            element = Element.ALMIGHTY
            power = Power(min(power.value + sk.power.value, 5))
            rng = sk.range
            almighty_locked = True
            continue

        # 万能属性已锁定，后续非万能卡仅贡献范围
        if almighty_locked:
            rng = sk.range
            continue

        # 规则2：异属性改变属性（力度不叠加）
        if sk.element != element:
            element = sk.element
            # 力度保持不变
        else:
            # 规则1：同属性力度叠加
            power = Power(min(power.value + sk.power.value, 5))

        # 规则3：范围由最后一张卡决定
        rng = sk.range

    return SkillData(element=element, power=power, range=rng, name="合成技")


# ===================== 伤害计算 =====================

@dataclass
class DamageResult:
    damage: int
    affinity: Affinity
    is_crit: bool
    is_knockdown: bool = False
    healed: bool = False   # 吸收/治疗标记


def get_affinity(element: Element, enemy_affinities: dict[Element, Affinity]) -> Affinity:
    return enemy_affinities.get(element, Affinity.NORMAL)


def calculate_damage(
    skill: SkillData, player_atk: int, enemy_affinities: dict[Element, Affinity],
    enemy_knocked_down: bool, cup_stack: int, crit_rate: float,
    faction_bonus_mult: float = 1.0,
) -> DamageResult:
    """计算伤害（攻击类技能）"""
    base = player_atk * POWER_MULTIPLIER[skill.power]
    affinity = get_affinity(skill.element, enemy_affinities)
    mult = affinity.multiplier

    # 圣杯加成
    cup_mult = 1.0 + 0.5 * cup_stack
    # 倒地加成
    kd_mult = 1.25 if enemy_knocked_down else 1.0
    # 暴击
    is_crit = random.random() < crit_rate
    crit_mult = 1.5 if is_crit else 1.0

    # 阵营增益（属性伤害加成）
    final = base * abs(mult) * cup_mult * kd_mult * crit_mult * faction_bonus_mult
    final = int(final)

    healed = False
    if affinity == Affinity.DRAIN:
        healed = True  # 敌人吸收，玩家的攻击反而治疗敌人
    elif affinity == Affinity.REPEL:
        # 反弹：标记由调用者处理反噬玩家
        pass

    return DamageResult(
        damage=final,
        affinity=affinity,
        is_crit=is_crit,
        is_knockdown=(affinity == Affinity.WEAK and not enemy_knocked_down),
        healed=healed,
    )


# ===================== 玩家 =====================

@dataclass
class Player:
    name: str = "结城理"
    max_hp: int = 900
    hp: int = 900
    attack: int = 120
    crit_rate: float = 0.05
    knockdown_shield: int = 0   # 击倒护盾
    cup_stack: int = 0          # 圣杯层数
    theurgy_gauge: int = 0      # 神通法计量槽 0-100
    money: int = 0
    deck_level: int = 1
    hand_limit: int = 6
    flip_remaining: int = 2     # 本回合剩余翻转次数
    faction: str = "愚者"
    first_compose_used: bool = False  # 愚者阵营：本回合首次构筑是否已用
    draw_count_this_turn: int = 0     # 本回合额外抽牌次数

    hand: list[Card] = field(default_factory=list)
    deck: list[Card] = field(default_factory=list)
    discard_pile: list[Card] = field(default_factory=list)   # 弃牌堆（牌库耗尽时自动洗回）
    theurgy_cards: list[Card] = field(default_factory=list)

    # ===== 局外养成属性 =====
    player_level: int = 1
    player_exp: int = 0
    owned_personas: list[str] = field(default_factory=list)      # 已收集的人格面具card_id（图鉴）
    equipped_persona: Optional[str] = None                       # 当前装备的人格面具card_id
    active_passives: list[str] = field(default_factory=list)      # 当前生效的被动技能ID

    @property
    def faction_bonus_mult(self) -> float:
        """阵营伤害加成倍率"""
        if self.faction == "魔术师":
            return 1.2
        return 1.0

    def faction_applies_to(self, element: Element) -> bool:
        """阵营增益是否适用于该属性"""
        if self.faction == "魔术师" and element == Element.FIRE:
            return True
        return False

    def recompute_passives(self, passive_db: dict[str, PassiveSkill], persona_passive_map: dict[str, str]) -> None:
        """根据当前装备的人格面具重算被动技能加成"""
        # 先重置基础属性
        self.attack = 120 + (self.player_level - 1) * 8
        self.max_hp = 900 + (self.player_level - 1) * 60
        self.crit_rate = 0.05
        # 永劫阵营：全属性+8%
        # 收集被动效果（这里只记录active_passives，实际伤害加成在calculate_damage时应用）
        self.active_passives = []
        if self.equipped_persona and self.equipped_persona in persona_passive_map:
            sid = persona_passive_map[self.equipped_persona]
            if sid in passive_db:
                self.active_passives.append(sid)
                ps = passive_db[sid]
                self.attack += ps.attack_bonus
                self.crit_rate += ps.crit_bonus
                self.max_hp += ps.hp_bonus
        # 不超过最大HP
        if self.hp > self.max_hp:
            self.hp = self.max_hp


# ===================== 敌人 =====================

@dataclass
class Enemy:
    name: str
    level: int
    max_hp: int
    hp: int
    attack: int
    affinities: dict[Element, Affinity]
    intent_pool: list[str]
    is_knocked_down: bool = False
    current_intent: str = "ATTACK_SINGLE"

    @property
    def alive(self) -> bool:
        return self.hp > 0

    def choose_intent(self) -> None:
        self.current_intent = random.choice(self.intent_pool)


# ===================== 战斗状态机 =====================

class BattleState:
    TURN_START = "TURN_START"
    PLAYER_ACTION = "PLAYER_ACTION"
    ENEMY_ACTION = "ENEMY_ACTION"
    TURN_END = "TURN_END"
    BATTLE_END = "BATTLE_END"


@dataclass
class BattleLog:
    messages: list[str] = field(default_factory=list)

    def add(self, msg: str) -> None:
        self.messages.append(msg)

    def consume(self) -> list[str]:
        msgs = self.messages[:]
        self.messages.clear()
        return msgs


# ===================== 牌库与发牌 =====================

def build_initial_deck(faction_persona_ids: list[str], card_db: dict[str, Card]) -> list[Card]:
    """构筑初始牌库：阵营人格面具 + 通用辅助卡"""
    import copy
    deck: list[Card] = []
    # 人格面具卡，每种2张
    for pid in faction_persona_ids:
        deck.append(copy.deepcopy(card_db[pid]))
        deck.append(copy.deepcopy(card_db[pid]))
    # 通用卡
    for cid in ["sword_c", "wand_c", "cup_c", "pentacle_c"]:
        deck.append(copy.deepcopy(card_db[cid]))
    random.shuffle(deck)
    return deck


def draw_cards(player: Player, count: int) -> list[Card]:
    """从牌库抽牌到手牌。
    牌库耗尽时自动将弃牌堆洗回牌库继续发牌（修复：原来直接break导致无法发牌）。
    """
    drawn: list[Card] = []
    for _ in range(count):
        if len(player.hand) >= player.hand_limit:
            break
        # 牌库空时，将弃牌堆洗回牌库
        if not player.deck and player.discard_pile:
            player.deck = player.discard_pile[:]
            player.discard_pile.clear()
            random.shuffle(player.deck)
        if not player.deck:
            # 牌库与弃牌堆都空，确实无牌可发
            break
        card = player.deck.pop()
        player.hand.append(card)
        drawn.append(card)
    return drawn


# ===================== 小阿尔卡那效果 =====================

def use_wand(player: Player, card_db: dict[str, Card]) -> Optional[Card]:
    """权杖：获得一张高阶卡牌（rank+1）"""
    import copy
    candidates = [c for c in card_db.values() if c.rank <= player.deck_level + 1 and c.is_composable]
    if not candidates:
        return None
    new_card = copy.deepcopy(random.choice(candidates))
    if len(player.hand) < player.hand_limit:
        player.hand.append(new_card)
        return new_card
    return None


def use_cup(player: Player) -> None:
    """圣杯：本回合伤害+50%"""
    player.cup_stack += 1


def use_pentacle(player: Player, turn: int) -> int:
    """星币：获得资金"""
    gain = 200 + turn * 10
    player.money += gain
    return gain


def use_theurgy(player: Player, card: Card, enemies: list[Enemy]) -> list[str]:
    """使用神通法卡"""
    logs: list[str] = []
    skill = card.active_skill
    if skill is None:
        return logs
    if skill.element == Element.HEAL:
        heal = int(player.max_hp * 0.3)
        player.hp = min(player.max_hp, player.hp + heal)
        logs.append(f"✨ 神通法「{card.name}」恢复 {heal} HP！")
    else:
        faction_mult = 1.2 if (player.faction == "魔术师" and skill.element == Element.FIRE) else 1.0
        targets = enemies if skill.range == Range.ALL else [enemies[0]] if enemies else []
        for enemy in targets:
            if not enemy.alive:
                continue
            res = calculate_damage(
                skill, player.attack, enemy.affinities, enemy.is_knocked_down,
                player.cup_stack, player.crit_rate, faction_mult,
            )
            if res.healed:
                enemy.hp = min(enemy.max_hp, enemy.hp + res.damage)
                logs.append(f"💧 {enemy.name} 吸收了攻击，恢复 {res.damage} HP")
            else:
                enemy.hp = max(0, enemy.hp - res.damage)
                crit_tag = "💥暴击！" if res.is_crit else ""
                logs.append(f"🌟 神通法「{card.name}」对 {enemy.name} 造成 {res.damage} 伤害 {crit_tag}")
                if res.is_knockdown:
                    enemy.is_knocked_down = True
                    logs.append(f"💥 {enemy.name} 被击倒！")
    return logs


# ===================== 总攻击 =====================

def create_all_out_card(deck_level: int) -> Card:
    """生成总攻击卡"""
    power = Power(min(3 + (deck_level - 1), 5))  # 初始LG，每级牌库+1阶，上限XH
    return Card(
        card_id="all_out", name="总攻击", card_type=CardType.ALL_OUT,
        skill=SkillData(Element.ALMIGHTY, power, Range.ALL, "总攻击"),
    )


# ===================== 波次系统 =====================

def scale_enemy(enemy: Enemy, hp_mult: float, atk_mult: float) -> Enemy:
    """按波次倍率缩放敌人属性"""
    enemy.max_hp = int(enemy.max_hp * hp_mult)
    enemy.hp = enemy.max_hp
    enemy.attack = int(enemy.attack * atk_mult)
    return enemy


def calc_wave_reward(wave: int, is_boss: bool, enemies_defeated: int) -> dict:
    """计算波次胜利奖励"""
    base_money = 150 + wave * 50
    bonus = 200 if is_boss else 0
    per_enemy = 30 * enemies_defeated
    total_money = base_money + bonus + per_enemy
    score = wave * 100 + (500 if is_boss else 0)
    return {
        "money": total_money,
        "score": score,
        "heal_pct": 0.25 if is_boss else 0.15,  # 恢复比例
    }


def rest_heal(player: Player, pct: float) -> int:
    """休整阶段恢复一定比例HP"""
    heal = int(player.max_hp * pct)
    player.hp = min(player.max_hp, player.hp + heal)
    return heal


# ===================== 局外养成系统 =====================

PASSIVE_DB: dict[str, PassiveSkill] = {}
PERSONA_PASSIVE_MAP: dict[str, str] = {}


def init_passive_db() -> None:
    """初始化被动技能DB（in-place 更新，确保已导入引用也能看到）"""
    PASSIVE_DB.clear()
    PASSIVE_DB.update(build_passive_skills())
    PERSONA_PASSIVE_MAP.clear()
    PERSONA_PASSIVE_MAP.update(build_persona_passive_map())


def gain_exp(player: Player, exp: int) -> dict:
    """玩家获得经验值，返回 {leveled_up, new_level, exp_gained}"""
    player.player_exp += exp
    leveled_up = False
    new_level = player.player_level
    while player.player_level - 1 < len(PLAYER_LEVEL_EXP) and player.player_exp >= PLAYER_LEVEL_EXP[player.player_level - 1]:
        player.player_exp -= PLAYER_LEVEL_EXP[player.player_level - 1]
        player.player_level += 1
        leveled_up = True
        new_level = player.player_level
    # 升级时重算被动
    if leveled_up:
        recompute_after_growth(player)
    return {"leveled_up": leveled_up, "new_level": new_level, "exp_gained": exp}


def recompute_after_growth(player: Player) -> None:
    """玩家升级/装备/卸下后重算所有被动加成"""
    if not PASSIVE_DB:
        init_passive_db()
    player.recompute_passives(PASSIVE_DB, PERSONA_PASSIVE_MAP)


def equip_persona(player: Player, persona_card_id: str, card_db: dict[str, Card]) -> dict:
    """装备人格面具获得其被动技能。
    要求该 persona 已收集在 owned_personas 中。返回 {success, message}
    """
    if persona_card_id not in player.owned_personas:
        return {"success": False, "message": f"❌ 尚未收集该人格面具：{persona_card_id}"}
    if persona_card_id not in card_db:
        return {"success": False, "message": f"❌ 卡牌库中找不到：{persona_card_id}"}
    player.equipped_persona = persona_card_id
    recompute_after_growth(player)
    name = card_db[persona_card_id].name
    return {"success": True, "message": f"✅ 装备人格面具「{name}」", "equipped": persona_card_id}


def unequip_persona(player: Player) -> dict:
    """卸下当前人格面具"""
    if not player.equipped_persona:
        return {"success": False, "message": "❌ 当前未装备人格面具"}
    player.equipped_persona = None
    recompute_after_growth(player)
    return {"success": True, "message": "✅ 已卸下人格面具"}


def collect_persona(player: Player, persona_card_id: str, card_db: dict[str, Card]) -> dict:
    """收集人格面具加入图鉴（战斗掉落、合成获得、商店购买时调用）"""
    if persona_card_id not in card_db:
        return {"success": False, "message": "❌ 无效的人格面具ID"}
    if persona_card_id in player.owned_personas:
        return {"success": False, "message": f"ⓘ 已拥有该人格面具（图鉴中已记录）"}
    player.owned_personas.append(persona_card_id)
    name = card_db[persona_card_id].name
    arcana = card_db[persona_card_id].arcana
    return {"success": True, "message": f"✨ 收集人格面具「{name}」({arcana})！已加入图鉴。", "persona_id": persona_card_id}


def fuse_personas(player: Player, recipe: PersonaRecipe, card_db: dict[str, Card]) -> dict:
    """天鹅绒房间合成：消耗配方中的人格面具（必须已收集），获得产物。
    会扣除合成费用。返回 {success, message, result_id}
    """
    if player.money < recipe.cost:
        return {"success": False, "message": f"❌ 合成费用不足，需要 ¥{recipe.cost}（当前 ¥{player.money}）"}
    missing = [m for m in recipe.materials if m not in player.owned_personas]
    if missing:
        names = ",".join(card_db[m].name if m in card_db else m for m in missing)
        return {"success": False, "message": f"❌ 缺少材料人格面具：{names}"}
    # 扣费、消耗材料
    player.money -= recipe.cost
    for m in recipe.materials:
        player.owned_personas.remove(m)
        # 如果当前装备的被消耗了，卸下
        if player.equipped_persona == m:
            player.equipped_persona = None
    # 加入产物
    if recipe.result not in player.owned_personas:
        player.owned_personas.append(recipe.result)
    recompute_after_growth(player)
    name = card_db[recipe.result].name if recipe.result in card_db else recipe.result
    return {
        "success": True,
        "message": f"✨ 合成成功！获得人格面具「{name}」",
        "result_id": recipe.result,
    }


def buy_persona(player: Player, persona_card_id: str, price: int, card_db: dict[str, Card]) -> dict:
    """天鹅绒房间商店购买人格面具"""
    if persona_card_id in player.owned_personas:
        return {"success": False, "message": "❌ 已拥有该人格面具"}
    if player.money < price:
        return {"success": False, "message": f"❌ 资金不足，需要 ¥{price}（当前 ¥{player.money}）"}
    if persona_card_id not in card_db:
        return {"success": False, "message": "❌ 无效的人格面具ID"}
    player.money -= price
    player.owned_personas.append(persona_card_id)
    name = card_db[persona_card_id].name
    return {"success": True, "message": f"✅ 购买人格面具「{name}」成功（¥{price}）", "persona_id": persona_card_id}


def get_persona_passive_bonus(player: Player, element: Element, passive_db: dict[str, PassiveSkill]) -> float:
    """计算装备被动对某属性的伤害倍率加成（伤害侧）"""
    mult = 1.0
    for sid in player.active_passives:
        ps = passive_db.get(sid)
        if not ps:
            continue
        if element == Element.FIRE and ps.fire_mult != 1.0:
            mult *= ps.fire_mult
        elif element == Element.ICE and ps.ice_mult != 1.0:
            mult *= ps.ice_mult
        elif element == Element.WIND and ps.wind_mult != 1.0:
            mult *= ps.wind_mult
        elif element == Element.ELEC and ps.elec_mult != 1.0:
            mult *= ps.elec_mult
        elif element == Element.BLESS and ps.bless_mult != 1.0:
            mult *= ps.bless_mult
        elif element == Element.CURSE and ps.curse_mult != 1.0:
            mult *= ps.curse_mult
        elif element == Element.PHYSICAL and ps.phys_mult != 1.0:
            mult *= ps.phys_mult
    return mult


def get_faction_damage_mult(faction: str, element: Element, against_knocked: bool = False) -> float:
    """阵营对属性的伤害倍率"""
    if faction == "魔术师" and element == Element.FIRE:
        return 1.2
    if faction == "女教皇" and element == Element.BLESS:
        return 1.15
    if faction == "教皇" and element == Element.CURSE:
        return 1.15
    if faction == "战车" and element == Element.PHYSICAL:
        return 1.15
    if faction == "正义" and element == Element.BLESS:
        return 1.20
    if faction == "力量" and element == Element.PHYSICAL:
        return 1.20
    if faction == "死神" and element == Element.CURSE:
        return 1.25 + (0.30 if against_knocked else 0)
    if faction == "恶魔" and element == Element.CURSE:
        return 1.20
    if faction == "审判" and element == Element.ALMIGHTY:
        return 1.20
    if faction == "永劫":
        return 1.08
    return 1.0


def get_faction_crit_bonus(faction: str) -> float:
    """阵营暴击加成"""
    if faction == "正义":
        return 0.05
    if faction == "命运":
        return 0.10
    return 0.0


def get_faction_money_mult(faction: str) -> float:
    """阵营资金加成"""
    if faction == "女皇":
        return 1.5
    return 1.0


def get_faction_attack_mult(faction: str) -> float:
    """阵营攻击力加成"""
    if faction == "皇帝":
        return 1.15
    return 1.0
