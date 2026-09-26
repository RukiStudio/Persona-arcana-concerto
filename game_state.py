# -*- coding: utf-8 -*-
"""
游戏状态封装 - 供Web壳子调用
将main.py中的交互逻辑重构为状态机，状态可序列化为dict
"""
from __future__ import annotations
import random
import copy

from data import (
    Element, Power, Range, Affinity, CardType, Card, SkillData,
    build_card_db, build_arcana_db, build_enemy_db, RANK_NAME,
    get_wave_config,
)
from engine import (
    Player, Enemy, BattleLog, BattleState, compose_skill,
    calculate_damage, build_initial_deck, draw_cards,
    use_wand, use_cup, use_pentacle, use_theurgy, create_all_out_card,
    scale_enemy, calc_wave_reward, rest_heal,
)
from ui import find_card_by_input, parse_command


CARD_DB = build_card_db()
ARCANA_DB = build_arcana_db()
ENEMY_DB = build_enemy_db()


# 阶段常量
PHASE_PROTAGONIST = "protagonist_select"
PHASE_FACTION = "faction_select"
PHASE_BATTLE = "battle"
PHASE_REST = "rest"
PHASE_GAME_OVER = "game_over"


class GameState:
    def __init__(self):
        self.phase = PHASE_PROTAGONIST
        self.player: Player | None = None
        self.protagonist_name = ""
        self.available_factions: list[str] = []
        self.faction = ""

        self.wave = 0
        self.turn = 0
        self.enemies: list[Enemy] = []
        self.is_boss = False
        self.slots: list[Card | None] = [None] * 5
        self.battle_state = BattleState.TURN_START
        self.log = BattleLog()
        self.total_score = 0
        self.game_over_reason = ""

    # ---------- 序列化 ----------
    def to_dict(self) -> dict:
        d = {
            "phase": self.phase,
            "protagonist_name": self.protagonist_name,
            "available_factions": self.available_factions,
            "faction": self.faction,
            "wave": self.wave,
            "turn": self.turn,
            "is_boss": self.is_boss,
            "total_score": self.total_score,
            "log": list(self.log.messages),
            "game_over_reason": self.game_over_reason,
        }
        if self.player:
            p = self.player
            d["player"] = {
                "name": p.name,
                "max_hp": p.max_hp,
                "hp": p.hp,
                "attack": p.attack,
                "crit_rate": p.crit_rate,
                "knockdown_shield": p.knockdown_shield,
                "cup_stack": p.cup_stack,
                "theurgy_gauge": p.theurgy_gauge,
                "money": p.money,
                "deck_level": p.deck_level,
                "hand_limit": p.hand_limit,
                "flip_remaining": p.flip_remaining,
                "faction": p.faction,
                "faction_bonus": ARCANA_DB[p.faction].bonus_desc if p.faction in ARCANA_DB else "",
                "hand": [self._card_to_dict(c) for c in p.hand],
            }
        else:
            d["player"] = None

        d["enemies"] = [self._enemy_to_dict(e) for e in self.enemies]
        d["slots"] = [self._card_to_dict(c) if c else None for c in self.slots]

        # 构筑预览
        cards = [c for c in self.slots if c is not None]
        if cards:
            res = compose_skill(cards)
            if res:
                d["preview"] = {
                    "element": res.element.value,
                    "element_icon": res.element.icon,
                    "power": res.power.name_cn,
                    "range": res.range.value,
                }
                # 愚者加成
                if self.player and self.player.faction == "愚者" and not self.player.first_compose_used:
                    d["preview"]["power_fool"] = Power(min(res.power.value + 1, 5)).name_cn
                # 预估伤害
                import engine
                base = self.player.attack * engine.POWER_MULTIPLIER[res.power]
                cup_mult = 1.0 + 0.5 * self.player.cup_stack
                faction_mult = 1.2 if (self.player.faction == "魔术师" and res.element == Element.FIRE) else 1.0
                d["preview"]["est_damage"] = int(base * cup_mult * faction_mult)
                d["preview"]["cup_mult"] = f"{cup_mult:.1f}"
            else:
                d["preview"] = None
        else:
            d["preview"] = None

        return d

    def _card_to_dict(self, card: Card) -> dict:
        sk = card.active_skill
        return {
            "card_id": card.card_id,
            "name": card.name,
            "card_type": card.card_type.value,
            "rank": RANK_NAME[card.rank],
            "arcana": card.arcana,
            "is_reversed": card.is_reversed,
            "skill": f"{sk.element.icon}{sk.element.value}·{sk.range.value}·{sk.power.name_cn}" if sk else "",
            "skill_element": sk.element.value if sk else "",
            "skill_element_icon": sk.element.icon if sk else "",
            "skill_power": sk.power.name_cn if sk else "",
            "skill_range": sk.range.value if sk else "",
            "skill_upright": f"{card.skill_upright.element.icon}{card.skill_upright.element.value}·{card.skill_upright.range.value}·{card.skill_upright.power.name_cn}" if card.skill_upright else "",
            "skill_reversed": f"{card.skill_reversed.element.icon}{card.skill_reversed.element.value}·{card.skill_reversed.range.value}·{card.skill_reversed.power.name_cn}" if card.skill_reversed else "",
            "desc": card.desc,
        }

    def _enemy_to_dict(self, enemy: Enemy) -> dict:
        intent_map = {
            "ATTACK_SINGLE": "▸ 攻击(单体)",
            "ATTACK_ALL": "▸ 攻击(全体)",
            "BUFF_SELF": "▲ 强化自身",
            "DEBUFF_PLAYER": "▼ 削弱玩家",
            "HEAL_SELF": "💚 恢复自身",
        }
        affs = []
        for el, af in enemy.affinities.items():
            affs.append(f"{el.icon}{af.value}")
        return {
            "name": enemy.name,
            "level": enemy.level,
            "max_hp": enemy.max_hp,
            "hp": enemy.hp,
            "hp_pct": int(enemy.hp / enemy.max_hp * 100),
            "attack": enemy.attack,
            "affinities": affs,
            "is_knocked_down": enemy.is_knocked_down,
            "alive": enemy.alive,
            "intent": intent_map.get(enemy.current_intent, "? 未知"),
        }

    # ---------- 操作 ----------
    def select_protagonist(self, choice: str) -> dict:
        if choice.upper() == "A":
            self.protagonist_name = "结城理"
            self.available_factions = ["愚者", "魔术师", "恋爱"]
        else:
            self.protagonist_name = "汐见琴音"
            self.available_factions = ["愚者", "魔术师", "恋爱"]
        self.phase = PHASE_FACTION
        return self.to_dict()

    def select_faction(self, faction: str) -> dict:
        if faction not in ("愚者", "魔术师", "恋爱"):
            self.log.add("❌ 无效阵营")
            return self.to_dict()
        self.faction = faction
        faction_data = ARCANA_DB[faction]
        self.player = Player(
            name=self.protagonist_name, faction=faction,
            deck=build_initial_deck(faction_data.persona_pool, CARD_DB),
        )
        self.log = BattleLog()
        self.log.add(f"⚔️ {self.protagonist_name} 加入挑战！阵营：{faction}（{faction_data.bonus_desc}）")
        self.phase = PHASE_BATTLE
        self._start_next_wave()
        return self.to_dict()

    def _start_next_wave(self) -> None:
        self.wave += 1
        cfg = get_wave_config(self.wave)
        self.is_boss = cfg.is_boss
        self.enemies = []
        for eid in cfg.enemy_ids:
            tpl = ENEMY_DB[eid]
            e = Enemy(
                name=tpl.name, level=tpl.level, max_hp=tpl.max_hp, hp=tpl.max_hp,
                attack=tpl.attack, affinities=dict(tpl.affinities),
                intent_pool=list(tpl.intent_pool),
            )
            self.enemies.append(scale_enemy(e, cfg.hp_mult, cfg.atk_mult))
        self.slots = [None] * 5
        self.turn = 0
        self.battle_state = BattleState.TURN_START
        self.log.add(f"━━━ 第 {self.wave} 波 {'（BOSS战！）' if self.is_boss else ''} ━━━")
        self.log.add(f"👹 敌人：{', '.join(e.name for e in self.enemies)}")
        self._advance_turn()

    def _advance_turn(self) -> None:
        """推进回合状态机"""
        while True:
            if self.battle_state == BattleState.TURN_START:
                self.turn += 1
                self._start_turn()
                self.battle_state = BattleState.PLAYER_ACTION
                return
            elif self.battle_state == BattleState.ENEMY_ACTION:
                alive = self._enemy_phase()
                if not alive:
                    self.phase = PHASE_GAME_OVER
                    self.game_over_reason = "💀 你被击败了..."
                    return
                self.battle_state = BattleState.TURN_END
            elif self.battle_state == BattleState.TURN_END:
                self._end_turn()
                if all(not e.alive for e in self.enemies):
                    self._on_wave_victory()
                    return
                self.battle_state = BattleState.TURN_START
            else:
                return

    def _start_turn(self) -> None:
        p = self.player
        money_gain = 100 + self.turn * 20
        p.money += money_gain
        self.log.add(f"💰 回合 {self.turn} 开始，获得资金 ¥{money_gain}")

        draw_count = max(0, p.hand_limit // 2 - len(p.hand))
        if draw_count > 0:
            drawn = draw_cards(p, draw_count)
            if drawn:
                self.log.add(f"🃏 抽到 {len(drawn)} 张牌")

        p.flip_remaining = 2
        p.first_compose_used = False
        p.draw_count_this_turn = 0

        for enemy in self.enemies:
            if enemy.alive:
                enemy.choose_intent()

        alive = [e for e in self.enemies if e.alive]
        if alive and all(e.is_knocked_down for e in alive):
            ao = create_all_out_card(p.deck_level)
            if len(p.hand) < p.hand_limit:
                p.hand.append(ao)
                self.log.add("🌟 所有敌人倒地！生成【总攻击】卡！")

    def _end_turn(self) -> None:
        self.player.cup_stack = 0
        self.player.hand = [c for c in self.player.hand if c.card_type != CardType.ALL_OUT]
        for e in self.enemies:
            e.is_knocked_down = False

    def _enemy_phase(self) -> bool:
        for enemy in self.enemies:
            if not enemy.alive:
                continue
            if enemy.is_knocked_down:
                self.log.add(f"💤 {enemy.name} 处于倒地状态，无法行动")
                continue
            intent = enemy.current_intent
            if intent == "ATTACK_SINGLE":
                dmg = int(enemy.attack * (0.8 + random.random() * 0.4))
                self.player.hp = max(0, self.player.hp - dmg)
                self.log.add(f"👹 {enemy.name} 发动攻击，造成 {dmg} 伤害")
            elif intent == "ATTACK_ALL":
                dmg = int(enemy.attack * 0.7)
                self.player.hp = max(0, self.player.hp - dmg)
                self.log.add(f"👹 {enemy.name} 发动全体攻击，造成 {dmg} 伤害")
            elif intent == "BUFF_SELF":
                enemy.attack = int(enemy.attack * 1.2)
                self.log.add(f"▲ {enemy.name} 强化自身，攻击力提升至 {enemy.attack}")
            elif intent == "DEBUFF_PLAYER":
                self.player.attack = max(10, int(self.player.attack * 0.9))
                self.log.add(f"▼ {enemy.name} 削弱玩家，攻击力降至 {self.player.attack}")
            elif intent == "HEAL_SELF":
                heal = int(enemy.max_hp * 0.2)
                enemy.hp = min(enemy.max_hp, enemy.hp + heal)
                self.log.add(f"💚 {enemy.name} 恢复 {heal} HP")
            if self.player.hp <= 0:
                return False
        return True

    def _on_wave_victory(self) -> None:
        enemies_defeated = len(self.enemies)
        reward = calc_wave_reward(self.wave, self.is_boss, enemies_defeated)
        self.total_score += reward["score"]
        self.player.money += reward["money"]
        healed = rest_heal(self.player, reward["heal_pct"])
        self.log.add(f"🎉🎉🎉 第 {self.wave} 波胜利！")
        self.log.add(f"🎁 奖励：资金+¥{reward['money']}，HP恢复+{healed}，得分+{reward['score']}")
        self.phase = PHASE_REST

    # ---------- 玩家操作 ----------
    def execute_action(self, cmd: str) -> dict:
        if self.phase != PHASE_BATTLE or self.battle_state != BattleState.PLAYER_ACTION:
            return self.to_dict()

        action, params = parse_command(cmd)
        p = self.player

        if action == "quit":
            self.phase = PHASE_GAME_OVER
            self.game_over_reason = "👋 你退出了挑战"
            return self.to_dict()
        elif action == "flip":
            cn = params.get("card_name", "")
            if p.flip_remaining <= 0:
                self.log.add("❌ 本回合翻转次数已用完")
            else:
                card = find_card_by_input(p, cn)
                if card and card.card_type == CardType.PERSONA:
                    card.flip()
                    p.flip_remaining -= 1
                    pos = "逆位" if card.is_reversed else "正位"
                    self.log.add(f"🔄 {card.name} 翻转为{pos}：{card.active_skill}")
                else:
                    self.log.add(f"❌ 无效的翻转目标：{cn}")
        elif action == "draw":
            cost = 50 * (2 ** p.draw_count_this_turn)
            if p.money < cost:
                self.log.add(f"❌ 资金不足，需要 ¥{cost}")
            elif len(p.hand) >= p.hand_limit:
                self.log.add("❌ 手牌已满")
            else:
                p.money -= cost
                p.draw_count_this_turn += 1
                drawn = draw_cards(p, 1)
                if drawn:
                    self.log.add(f"🃏 花费 ¥{cost} 抽到：{drawn[0].name}")
                else:
                    p.money += cost
                    p.draw_count_this_turn -= 1
                    self.log.add("❌ 牌库已空")
        elif action == "upgrade":
            costs = [500, 1000, 2000, 4000]
            idx = p.deck_level - 1
            if idx >= len(costs):
                self.log.add("❌ 牌库已满级")
            else:
                cost = costs[idx]
                if p.money < cost:
                    self.log.add(f"❌ 资金不足，需要 ¥{cost}")
                else:
                    p.money -= cost
                    p.deck_level += 1
                    p.hand_limit = min(8, p.hand_limit + 1)
                    self.log.add(f"⬆️ 牌库升级至 Lv.{p.deck_level}，手牌上限 {p.hand_limit}")
        elif action == "use_minor":
            self._use_minor(params.get("card_name", ""))
        elif action == "put":
            self._put_card(params.get("card_ref", ""), params.get("slot", ""))
        elif action == "put_batch":
            self._put_batch(params.get("card_nums", []))
        elif action == "remove":
            self._remove_slot(params.get("slot", ""))
        elif action == "clear":
            for i in range(5):
                if self.slots[i] is not None:
                    if len(p.hand) < p.hand_limit:
                        p.hand.append(self.slots[i])
                    self.slots[i] = None
            self.log.add("🧹 构筑槽已清空")
        elif action == "confirm":
            self._confirm(params.get("target"))
        elif action == "end":
            self.battle_state = BattleState.ENEMY_ACTION
            self._advance_turn()
        elif action == "help":
            self.log.add("📖 操作：1,2,3批量构筑 | 1翻转 | 2抽牌 | 3升级 | 4用辅助 | 5确认 | 6结束")
        else:
            self.log.add(f"❓ 未知命令：{cmd}")

        # 检查胜负
        if all(not e.alive for e in self.enemies):
            self._on_wave_victory()
        elif p.hp <= 0:
            self.phase = PHASE_GAME_OVER
            self.game_over_reason = "💀 你被击败了..."

        return self.to_dict()

    def _use_minor(self, card_name: str) -> None:
        p = self.player
        card = find_card_by_input(p, card_name)
        if card is None:
            self.log.add(f"❌ 找不到卡牌：{card_name}")
            return
        if card.card_type == CardType.WAND:
            new_card = use_wand(p, CARD_DB)
            p.hand.remove(card)
            if new_card:
                self.log.add(f"🪄 权杖：获得 {new_card.name}")
            else:
                self.log.add("🪄 权杖：牌库中无可获得的高阶卡")
        elif card.card_type == CardType.CUP:
            use_cup(p)
            p.hand.remove(card)
            self.log.add(f"🏆 圣杯：本回合伤害 +50%（当前层数 {p.cup_stack}）")
        elif card.card_type == CardType.PENTACLE:
            gain = use_pentacle(p, self.turn)
            p.hand.remove(card)
            self.log.add(f"💰 星币：获得 ¥{gain}")
        elif card.card_type == CardType.THEURGY:
            if len(p.theurgy_cards) >= 3:
                self.log.add("❌ 本场战斗神通法使用次数已达上限")
                return
            msgs = use_theurgy(p, card, self.enemies)
            p.theurgy_cards.append(card)
            p.hand.remove(card)
            for m in msgs:
                self.log.add(m)
        elif card.card_type == CardType.ALL_OUT:
            skill = card.active_skill
            faction_mult = 1.2 if (p.faction == "魔术师" and skill.element == Element.FIRE) else 1.0
            for enemy in self.enemies:
                if not enemy.alive:
                    continue
                res = calculate_damage(skill, p.attack, enemy.affinities, enemy.is_knocked_down, p.cup_stack, p.crit_rate, faction_mult)
                enemy.hp = max(0, enemy.hp - res.damage)
                self.log.add(f"💥 总攻击对 {enemy.name} 造成 {res.damage} 伤害！")
            p.hand.remove(card)
        else:
            self.log.add(f"❌ {card.name} 不是辅助卡，请通过构筑使用")

    def _put_card(self, card_ref: str, slot_ref: str) -> None:
        p = self.player
        card = find_card_by_input(p, card_ref)
        if card is None:
            self.log.add(f"❌ 找不到手牌：{card_ref}")
            return
        if not card.is_composable and card.card_type not in (CardType.THEURGY, CardType.ALL_OUT):
            self.log.add(f"❌ {card.name} 不可参与构筑")
            return
        try:
            slot_idx = int(slot_ref) - 1
        except ValueError:
            self.log.add(f"❌ 无效槽位：{slot_ref}")
            return
        if not (0 <= slot_idx < 5):
            self.log.add("❌ 槽位需在 1-5 之间")
            return
        if card in self.slots:
            self.log.add(f"❌ {card.name} 已在构筑槽中")
            return
        if card in p.hand:
            p.hand.remove(card)
        self.slots[slot_idx] = card
        self.log.add(f"📥 {card.name} 放入 SLOT {slot_idx+1}")

    def _put_batch(self, card_nums: list[int]) -> None:
        p = self.player
        placed = 0
        for num in card_nums:
            idx = num - 1
            if idx < 0 or idx >= len(p.hand):
                self.log.add(f"❌ 无效手牌序号：{num}")
                continue
            card = p.hand[idx]
            if not card.is_composable and card.card_type not in (CardType.THEURGY, CardType.ALL_OUT):
                self.log.add(f"❌ {card.name} 不可参与构筑，跳过")
                continue
            if card in self.slots:
                self.log.add(f"❌ {card.name} 已在构筑槽中，跳过")
                continue
            empty = next((i for i in range(5) if self.slots[i] is None), None)
            if empty is None:
                self.log.add("❌ 构筑槽已满")
                break
            p.hand.remove(card)
            self.slots[empty] = card
            placed += 1
            self.log.add(f"📥 {card.name} → SLOT {empty+1}")
        if placed > 0:
            self.log.add(f"✅ 已放入 {placed} 张卡")

    def _remove_slot(self, slot_ref: str) -> None:
        try:
            slot_idx = int(slot_ref) - 1
        except ValueError:
            self.log.add(f"❌ 无效槽位：{slot_ref}")
            return
        if not (0 <= slot_idx < 5):
            self.log.add("❌ 槽位需在 1-5 之间")
            return
        card = self.slots[slot_idx]
        if card is None:
            self.log.add(f"❌ SLOT {slot_idx+1} 为空")
            return
        self.slots[slot_idx] = None
        if len(self.player.hand) < self.player.hand_limit:
            self.player.hand.append(card)
            self.log.add(f"📤 {card.name} 从 SLOT {slot_idx+1} 移回手牌")
        else:
            self.log.add(f"📤 {card.name} 从构筑槽移除（手牌已满，卡牌消失）")

    def _confirm(self, target: int | None) -> None:
        p = self.player
        cards = [c for c in self.slots if c is not None]
        if not cards:
            self.log.add("❌ 构筑槽为空")
            return
        result = compose_skill(cards)
        if result is None:
            self.log.add("❌ 合成失败")
            return

        if p.faction == "愚者" and not p.first_compose_used:
            result.power = Power(min(result.power.value + 1, 5))
            p.first_compose_used = True
            self.log.add(f"🌟 愚者阵营：首次构筑力度 +1 → {result.power.name_cn}")

        if result.element == Element.HEAL:
            heal_mult = 1.3 if p.faction == "恋爱" else 1.0
            heal = int(p.attack * 2.0 * heal_mult)
            p.hp = min(p.max_hp, p.hp + heal)
            self.log.add(f"💚 合成恢复技能，恢复 {heal} HP")
        else:
            alive_enemies = [e for e in self.enemies if e.alive]
            if not alive_enemies:
                self.log.add("❌ 没有存活的敌人")
                return
            faction_mult = 1.2 if (p.faction == "魔术师" and result.element == Element.FIRE) else 1.0
            if result.range == Range.ALL:
                targets = alive_enemies
            else:
                if target is None:
                    self.log.add("❌ 单体技能需指定目标敌人序号")
                    return
                if target < 1 or target > len(self.enemies):
                    self.log.add(f"❌ 无效敌人序号：{target}")
                    return
                tgt = self.enemies[target - 1]
                if not tgt.alive:
                    self.log.add(f"❌ 敌人 {target} 已被击败")
                    return
                targets = [tgt]

            for enemy in targets:
                res = calculate_damage(result, p.attack, enemy.affinities, enemy.is_knocked_down, p.cup_stack, p.crit_rate, faction_mult)
                if res.affinity == Affinity.NULL:
                    self.log.add(f"⚪ {enemy.name} 无效化了 {result.element.value} 攻击！")
                    continue
                if res.affinity == Affinity.REPEL:
                    reflect = int(res.damage * 0.5)
                    p.hp = max(0, p.hp - reflect)
                    self.log.add(f"🔶 {enemy.name} 反弹了攻击，玩家受到 {reflect} 伤害")
                    continue
                if res.healed:
                    enemy.hp = min(enemy.max_hp, enemy.hp + res.damage)
                    self.log.add(f"💧 {enemy.name} 吸收了攻击，恢复 {res.damage} HP")
                    continue
                enemy.hp = max(0, enemy.hp - res.damage)
                crit = " 💥暴击！" if res.is_crit else ""
                aff = f" [{res.affinity.value}]" if res.affinity != Affinity.NORMAL else ""
                self.log.add(f"⚔️ 对 {enemy.name} 造成 {res.damage} 伤害{aff}{crit}")
                if res.is_knockdown:
                    enemy.is_knocked_down = True
                    self.log.add(f"💥 {enemy.name} 被击倒！")
                    p.theurgy_gauge = min(100, p.theurgy_gauge + 20)
                    self.log.add(f"🌟 神通法计量槽 +20%（当前 {p.theurgy_gauge}%）")
                    if p.theurgy_gauge >= 100:
                        p.theurgy_gauge = 0
                        tid = random.choice(["theurgy_fire", "theurgy_ice"])
                        new_card = copy.deepcopy(CARD_DB[tid])
                        if len(p.hand) < p.hand_limit:
                            p.hand.append(new_card)
                            self.log.add(f"✨ 神通法计量槽满！获得【{new_card.name}】")
                if not enemy.alive:
                    self.log.add(f"🎉 {enemy.name} 被击败！")

        for i in range(5):
            self.slots[i] = None

        # 构筑成功后推进到敌人回合
        self.battle_state = BattleState.ENEMY_ACTION
        self._advance_turn()

    # ---------- 休整阶段 ----------
    def rest_action(self, choice: str) -> dict:
        if self.phase != PHASE_REST:
            return self.to_dict()
        p = self.player
        if choice == "1":
            cost = 300
            if p.money < cost:
                self.log.add(f"❌ 资金不足，需要 ¥{cost}")
            else:
                p.money -= cost
                p.hp = p.max_hp
                self.log.add(f"✅ HP 已完全恢复！（{p.hp}/{p.max_hp}）")
        elif choice == "2":
            costs = [500, 1000, 2000, 4000]
            idx = p.deck_level - 1
            if idx >= len(costs):
                self.log.add("❌ 牌库已满级")
            else:
                cost = costs[idx]
                if p.money < cost:
                    self.log.add(f"❌ 资金不足，需要 ¥{cost}")
                else:
                    p.money -= cost
                    p.deck_level += 1
                    p.hand_limit = min(8, p.hand_limit + 1)
                    self.log.add(f"⬆️ 牌库升级至 Lv.{p.deck_level}，手牌上限 {p.hand_limit}")
        elif choice == "3":
            cost = 150
            if p.money < cost:
                self.log.add(f"❌ 资金不足，需要 ¥{cost}")
            else:
                p.money -= cost
                drawn = draw_cards(p, 2)
                if drawn:
                    self.log.add(f"✅ 抽到：{', '.join(c.name for c in drawn)}")
                else:
                    p.money += cost
                    self.log.add("❌ 牌库已空或手牌已满")
        elif choice == "4":
            self.phase = PHASE_BATTLE
            self._start_next_wave()
        elif choice == "5":
            self.phase = PHASE_GAME_OVER
            self.game_over_reason = "🏁 你选择结束挑战"
        return self.to_dict()
