# -*- coding: utf-8 -*-
"""
《女神异闻录：阿尔卡那协奏》文字版 - 核心引擎
叠牌构筑合成、伤害计算、玩家/敌人、回合状态机
"""
from __future__ import annotations
import random
from dataclasses import dataclass, field
from typing import Optional

from data import (
    Element, Power, Range, Affinity, CardType, Card, SkillData,
    POWER_MULTIPLIER, AFFINITY_MULTIPLIER,
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
    theurgy_cards: list[Card] = field(default_factory=list)

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
    """从牌库抽牌到手牌"""
    drawn: list[Card] = []
    for _ in range(count):
        if len(player.hand) >= player.hand_limit:
            break
        if not player.deck:
            # 牌库空，重新洗牌（简化：从弃牌堆重洗，这里直接重置）
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
