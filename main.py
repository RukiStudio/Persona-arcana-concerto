# -*- coding: utf-8 -*-
"""
《女神异闻录：阿尔卡那协奏》文字版 - 主程序
回合制战术卡牌构筑游戏 - 多轮挑战模式
"""
from __future__ import annotations
import random
import copy

from data import (
    Element, Power, Range, Affinity, CardType, Card, SkillData,
    build_card_db, build_arcana_db, build_enemy_db, RANK_NAME,
    get_wave_config, WaveConfig,
)
from engine import (
    Player, Enemy, BattleLog, BattleState, compose_skill,
    calculate_damage, build_initial_deck, draw_cards,
    use_wand, use_cup, use_pentacle, use_theurgy, create_all_out_card,
    scale_enemy, calc_wave_reward, rest_heal,
)
from ui import (
    clear_screen, render_battlefield, find_card_by_input,
    parse_command, print_help,
)


# ===================== 初始化 =====================

CARD_DB = build_card_db()
ARCANA_DB = build_arcana_db()
ENEMY_DB = build_enemy_db()


def select_protagonist() -> tuple[str, list[str]]:
    """选择主人公"""
    print("""
╔══════════════════════════════════════════╗
║   《女神异闻录：阿尔卡那协奏》文字版        ║
║         — 多 轮 挑 战 模 式 —              ║
╠══════════════════════════════════════════╣
║  选择主人公：                             ║
║  A. 结城理（男）                          ║
║     初始阵营：愚者 / 魔术师 / 皇帝        ║
║  B. 汐见琴音（女）                        ║
║     初始阵营：愚者 / 恋爱 / 女教皇        ║
╚══════════════════════════════════════════╝
""")
    while True:
        choice = input("请选择 (A/B)：").strip().upper()
        if choice == "A":
            return "结城理", ["愚者", "魔术师", "皇帝"]
        elif choice == "B":
            return "汐见琴音", ["愚者", "恋爱", "女教皇"]
        else:
            print("请输入 A 或 B")


def select_faction(available: list[str]) -> str:
    """选择阵营"""
    print(f"\n可选阵营：{' / '.join(available)}")
    print("（已解锁阵营包含完整数据：愚者、魔术师、恋爱）")
    while True:
        choice = input("请选择阵营：").strip()
        if choice in ("愚者", "魔术师", "恋爱"):
            return choice
        else:
            print(f"无效阵营，请从以下选择：愚者 / 魔术师 / 恋爱")


def make_enemy(enemy_id: str, hp_mult: float = 1.0, atk_mult: float = 1.0) -> Enemy:
    """创建敌人并按波次缩放"""
    tpl = ENEMY_DB[enemy_id]
    enemy = Enemy(
        name=tpl.name, level=tpl.level, max_hp=tpl.max_hp, hp=tpl.max_hp,
        attack=tpl.attack, affinities=dict(tpl.affinities),
        intent_pool=list(tpl.intent_pool),
    )
    return scale_enemy(enemy, hp_mult, atk_mult)


def spawn_wave_enemies(wave: int) -> tuple[list[Enemy], bool]:
    """根据波次生成敌人，返回 (敌人列表, 是否BOSS波)"""
    cfg = get_wave_config(wave)
    enemies = [make_enemy(eid, cfg.hp_mult, cfg.atk_mult) for eid in cfg.enemy_ids]
    return enemies, cfg.is_boss


# ===================== 回合结算 =====================

def start_turn(player: Player, turn: int, log: BattleLog, enemies: list[Enemy]) -> None:
    """回合开始：发牌、资金结算"""
    money_gain = 100 + turn * 20
    player.money += money_gain
    log.add(f"💰 回合 {turn} 开始，获得资金 ¥{money_gain}")

    draw_count = max(0, player.hand_limit // 2 - len(player.hand))
    if draw_count > 0:
        drawn = draw_cards(player, draw_count)
        if drawn:
            log.add(f"🃏 抽到 {len(drawn)} 张牌")

    player.flip_remaining = 2
    player.first_compose_used = False
    player.draw_count_this_turn = 0

    for enemy in enemies:
        if enemy.alive:
            enemy.choose_intent()

    alive_enemies = [e for e in enemies if e.alive]
    if alive_enemies and all(e.is_knocked_down for e in alive_enemies):
        ao_card = create_all_out_card(player.deck_level)
        if len(player.hand) < player.hand_limit:
            player.hand.append(ao_card)
            log.add(f"🌟 所有敌人倒地！生成【总攻击】卡！")


def end_turn(player: Player, enemies: list[Enemy]) -> None:
    """回合结束：清除圣杯、总攻击卡、倒地状态"""
    player.cup_stack = 0
    player.hand = [c for c in player.hand if c.card_type != CardType.ALL_OUT]
    for enemy in enemies:
        enemy.is_knocked_down = False


def enemy_phase(player: Player, enemies: list[Enemy], log: BattleLog) -> bool:
    """敌人行动阶段，返回玩家是否存活"""
    for enemy in enemies:
        if not enemy.alive:
            continue
        if enemy.is_knocked_down:
            log.add(f"💤 {enemy.name} 处于倒地状态，无法行动")
            continue

        intent = enemy.current_intent
        if intent == "ATTACK_SINGLE":
            dmg = int(enemy.attack * (0.8 + random.random() * 0.4))
            player.hp = max(0, player.hp - dmg)
            log.add(f"👹 {enemy.name} 发动攻击，造成 {dmg} 伤害")
        elif intent == "ATTACK_ALL":
            dmg = int(enemy.attack * 0.7)
            player.hp = max(0, player.hp - dmg)
            log.add(f"👹 {enemy.name} 发动全体攻击，造成 {dmg} 伤害")
        elif intent == "BUFF_SELF":
            enemy.attack = int(enemy.attack * 1.2)
            log.add(f"▲ {enemy.name} 强化自身，攻击力提升至 {enemy.attack}")
        elif intent == "DEBUFF_PLAYER":
            player.attack = max(10, int(player.attack * 0.9))
            log.add(f"▼ {enemy.name} 削弱玩家，攻击力降至 {player.attack}")
        elif intent == "HEAL_SELF":
            heal = int(enemy.max_hp * 0.2)
            enemy.hp = min(enemy.max_hp, enemy.hp + heal)
            log.add(f"💚 {enemy.name} 恢复 {heal} HP")

        if player.hp <= 0:
            log.add("💀 玩家被击败...")
            return False
    return True


# ===================== 玩家操作处理 =====================

def handle_flip(player: Player, card_name: str, log: BattleLog) -> None:
    if player.flip_remaining <= 0:
        log.add("❌ 本回合翻转次数已用完")
        return
    card = find_card_by_input(player, card_name)
    if card is None:
        log.add(f"❌ 找不到卡牌：{card_name}")
        return
    if card.card_type != CardType.PERSONA:
        log.add(f"❌ {card.name} 不是人格面具卡，无法翻转")
        return
    card.flip()
    player.flip_remaining -= 1
    pos = "逆位" if card.is_reversed else "正位"
    log.add(f"🔄 {card.name} 翻转为{pos}：{card.active_skill}")


def handle_draw(player: Player, log: BattleLog) -> None:
    cost = 50 * (2 ** player.draw_count_this_turn)
    if player.money < cost:
        log.add(f"❌ 资金不足，需要 ¥{cost}")
        return
    if len(player.hand) >= player.hand_limit:
        log.add("❌ 手牌已满")
        return
    player.money -= cost
    player.draw_count_this_turn += 1
    drawn = draw_cards(player, 1)
    if drawn:
        log.add(f"🃏 花费 ¥{cost} 抽到：{drawn[0].name}")
    else:
        log.add("❌ 牌库已空")
        player.money += cost
        player.draw_count_this_turn -= 1


def handle_upgrade(player: Player, log: BattleLog) -> None:
    costs = [500, 1000, 2000, 4000]
    idx = player.deck_level - 1
    if idx >= len(costs):
        log.add("❌ 牌库已满级")
        return
    cost = costs[idx]
    if player.money < cost:
        log.add(f"❌ 资金不足，需要 ¥{cost}")
        return
    player.money -= cost
    player.deck_level += 1
    player.hand_limit = min(8, player.hand_limit + 1)
    log.add(f"⬆️ 牌库升级至 Lv.{player.deck_level}，手牌上限 {player.hand_limit}")


def handle_use_minor(player: Player, card_name: str, turn: int, log: BattleLog, enemies: list[Enemy]) -> None:
    card = find_card_by_input(player, card_name)
    if card is None:
        log.add(f"❌ 找不到卡牌：{card_name}")
        return

    if card.card_type == CardType.WAND:
        new_card = use_wand(player, CARD_DB)
        player.hand.remove(card)
        if new_card:
            log.add(f"🪄 权杖：获得 {new_card.name}")
        else:
            log.add("🪄 权杖：牌库中无可获得的高阶卡")
    elif card.card_type == CardType.CUP:
        use_cup(player)
        player.hand.remove(card)
        log.add(f"🏆 圣杯：本回合伤害 +50%（当前层数 {player.cup_stack}）")
    elif card.card_type == CardType.PENTACLE:
        gain = use_pentacle(player, turn)
        player.hand.remove(card)
        log.add(f"💰 星币：获得 ¥{gain}")
    elif card.card_type == CardType.THEURGY:
        if len(player.theurgy_cards) >= 3:
            log.add("❌ 本场战斗神通法使用次数已达上限")
            return
        msgs = use_theurgy(player, card, enemies)
        player.theurgy_cards.append(card)
        player.hand.remove(card)
        for m in msgs:
            log.add(m)
    elif card.card_type == CardType.ALL_OUT:
        skill = card.active_skill
        faction_mult = 1.2 if (player.faction == "魔术师" and skill.element == Element.FIRE) else 1.0
        for enemy in enemies:
            if not enemy.alive:
                continue
            res = calculate_damage(
                skill, player.attack, enemy.affinities, enemy.is_knocked_down,
                player.cup_stack, player.crit_rate, faction_mult,
            )
            enemy.hp = max(0, enemy.hp - res.damage)
            log.add(f"💥 总攻击对 {enemy.name} 造成 {res.damage} 伤害！")
        player.hand.remove(card)
    else:
        log.add(f"❌ {card.name} 不是辅助卡，请通过构筑使用")


def handle_put(player: Player, slots: list, card_ref: str, slot_ref: str, log: BattleLog) -> None:
    card = find_card_by_input(player, card_ref)
    if card is None:
        log.add(f"❌ 找不到手牌：{card_ref}")
        return
    if not card.is_composable and card.card_type not in (CardType.THEURGY, CardType.ALL_OUT):
        log.add(f"❌ {card.name} 不可参与构筑")
        return
    try:
        slot_idx = int(slot_ref) - 1
    except ValueError:
        log.add(f"❌ 无效槽位：{slot_ref}")
        return
    if not (0 <= slot_idx < 5):
        log.add("❌ 槽位需在 1-5 之间")
        return
    if card in slots:
        log.add(f"❌ {card.name} 已在构筑槽中")
        return
    if card in player.hand:
        player.hand.remove(card)
    slots[slot_idx] = card
    log.add(f"📥 {card.name} 放入 SLOT {slot_idx+1}")


def handle_put_batch(player: Player, slots: list, card_nums: list[int], log: BattleLog) -> None:
    """批量构筑：将多张卡依次放入空槽位"""
    placed = 0
    for num in card_nums:
        idx = num - 1
        if idx < 0 or idx >= len(player.hand):
            log.add(f"❌ 无效手牌序号：{num}")
            continue
        card = player.hand[idx]
        if not card.is_composable and card.card_type not in (CardType.THEURGY, CardType.ALL_OUT):
            log.add(f"❌ {card.name} 不可参与构筑，跳过")
            continue
        if card in slots:
            log.add(f"❌ {card.name} 已在构筑槽中，跳过")
            continue
        # 找下一个空槽
        empty_slot = next((i for i in range(5) if slots[i] is None), None)
        if empty_slot is None:
            log.add("❌ 构筑槽已满")
            break
        player.hand.remove(card)
        slots[empty_slot] = card
        placed += 1
        log.add(f"📥 {card.name} → SLOT {empty_slot+1}")
    if placed > 0:
        log.add(f"✅ 已放入 {placed} 张卡")


def handle_remove(player: Player, slots: list, slot_ref: str, log: BattleLog) -> None:
    try:
        slot_idx = int(slot_ref) - 1
    except ValueError:
        log.add(f"❌ 无效槽位：{slot_ref}")
        return
    if not (0 <= slot_idx < 5):
        log.add("❌ 槽位需在 1-5 之间")
        return
    card = slots[slot_idx]
    if card is None:
        log.add(f"❌ SLOT {slot_idx+1} 为空")
        return
    slots[slot_idx] = None
    if len(player.hand) < player.hand_limit:
        player.hand.append(card)
        log.add(f"📤 {card.name} 从 SLOT {slot_idx+1} 移回手牌")
    else:
        log.add(f"📤 {card.name} 从构筑槽移除（手牌已满，卡牌消失）")


def handle_clear(player: Player, slots: list, log: BattleLog) -> None:
    for i in range(5):
        if slots[i] is not None:
            if len(player.hand) < player.hand_limit:
                player.hand.append(slots[i])
            slots[i] = None
    log.add("🧹 构筑槽已清空")


def handle_confirm(player: Player, slots: list, target: int, turn: int, log: BattleLog, enemies: list[Enemy]) -> bool:
    """确认构筑并打出，返回是否成功"""
    cards = [c for c in slots if c is not None]
    if not cards:
        log.add("❌ 构筑槽为空")
        return False

    result = compose_skill(cards)
    if result is None:
        log.add("❌ 合成失败")
        return False

    if player.faction == "愚者" and not player.first_compose_used:
        result.power = Power(min(result.power.value + 1, 5))
        player.first_compose_used = True
        log.add(f"🌟 愚者阵营：首次构筑力度 +1 → {result.power.name_cn}")

    if result.element == Element.HEAL:
        heal_mult = 1.3 if player.faction == "恋爱" else 1.0
        heal = int(player.attack * 2.0 * heal_mult)
        player.hp = min(player.max_hp, player.hp + heal)
        log.add(f"💚 合成恢复技能，恢复 {heal} HP")
    else:
        alive_enemies = [e for e in enemies if e.alive]
        if not alive_enemies:
            log.add("❌ 没有存活的敌人")
            return False

        faction_mult = 1.2 if (player.faction == "魔术师" and result.element == Element.FIRE) else 1.0

        if result.range == Range.ALL:
            targets = alive_enemies
        else:
            if target is None:
                log.add("❌ 单体技能需指定目标敌人序号")
                return False
            if target < 1 or target > len(enemies):
                log.add(f"❌ 无效敌人序号：{target}")
                return False
            tgt = enemies[target - 1]
            if not tgt.alive:
                log.add(f"❌ 敌人 {target} 已被击败")
                return False
            targets = [tgt]

        for enemy in targets:
            res = calculate_damage(
                result, player.attack, enemy.affinities, enemy.is_knocked_down,
                player.cup_stack, player.crit_rate, faction_mult,
            )
            if res.affinity == Affinity.NULL:
                log.add(f"⚪ {enemy.name} 无效化了 {result.element.value} 攻击！")
                continue
            if res.affinity == Affinity.REPEL:
                reflect_dmg = int(res.damage * 0.5)
                player.hp = max(0, player.hp - reflect_dmg)
                log.add(f"🔶 {enemy.name} 反弹了攻击，玩家受到 {reflect_dmg} 伤害")
                continue
            if res.healed:
                enemy.hp = min(enemy.max_hp, enemy.hp + res.damage)
                log.add(f"💧 {enemy.name} 吸收了攻击，恢复 {res.damage} HP")
                continue

            enemy.hp = max(0, enemy.hp - res.damage)
            crit_tag = " 💥暴击！" if res.is_crit else ""
            aff_tag = f" [{res.affinity.value}]" if res.affinity != Affinity.NORMAL else ""
            log.add(f"⚔️ 对 {enemy.name} 造成 {res.damage} 伤害{aff_tag}{crit_tag}")

            if res.is_knockdown:
                enemy.is_knocked_down = True
                log.add(f"💥 {enemy.name} 被击倒！")
                player.theurgy_gauge = min(100, player.theurgy_gauge + 20)
                log.add(f"🌟 神通法计量槽 +20%（当前 {player.theurgy_gauge}%）")
                if player.theurgy_gauge >= 100:
                    player.theurgy_gauge = 0
                    theurgy_ids = ["theurgy_fire", "theurgy_ice"]
                    tid = random.choice(theurgy_ids)
                    new_card = copy.deepcopy(CARD_DB[tid])
                    if len(player.hand) < player.hand_limit:
                        player.hand.append(new_card)
                        log.add(f"✨ 神通法计量槽满！获得【{new_card.name}】")

            if not enemy.alive:
                log.add(f"🎉 {enemy.name} 被击败！")

    for i in range(5):
        slots[i] = None

    return True


# ===================== 单场战斗 =====================

def run_battle(player: Player, enemies: list[Enemy], log: BattleLog, wave: int) -> bool:
    """运行一场战斗，返回是否胜利"""
    turn = 0
    slots: list[Card | None] = [None] * 5
    state = BattleState.TURN_START

    while state != BattleState.BATTLE_END:
        if state == BattleState.TURN_START:
            turn += 1
            start_turn(player, turn, log, enemies)
            state = BattleState.PLAYER_ACTION

        elif state == BattleState.PLAYER_ACTION:
            draw_cost = 50 * (2 ** player.draw_count_this_turn)
            upgrade_costs = [500, 1000, 2000, 4000]
            upgrade_cost = upgrade_costs[min(player.deck_level - 1, 3)]
            clear_screen()
            print(f"═══════════════ 第 {wave} 波 ═══════════════")
            print(render_battlefield(player, enemies, turn, slots, log, draw_cost, upgrade_cost))

            cmd = input("\n请输入操作 (help查看帮助)：").strip()
            action, params = parse_command(cmd)

            if action == "quit":
                log.add("👋 退出挑战")
                return False
            elif action == "help":
                print_help()
                input("按回车继续...")
            elif action == "flip":
                if not params.get("card_name"):
                    print("\n手牌中的人格面具卡：")
                    for i, c in enumerate(player.hand, 1):
                        if c.card_type == CardType.PERSONA:
                            print(f"  {i}. {c.name}")
                    params["card_name"] = input("翻转哪张卡？(序号)：").strip()
                handle_flip(player, params["card_name"], log)
            elif action == "draw":
                handle_draw(player, log)
            elif action == "upgrade":
                handle_upgrade(player, log)
            elif action == "use_minor":
                if not params.get("card_name"):
                    print("\n手牌中的辅助卡（权杖/圣杯/星币/神通法/总攻击）：")
                    for i, c in enumerate(player.hand, 1):
                        if c.card_type in (CardType.WAND, CardType.CUP, CardType.PENTACLE,
                                           CardType.THEURGY, CardType.ALL_OUT):
                            print(f"  {i}. {c.name}")
                    params["card_name"] = input("使用哪张？(序号)：").strip()
                handle_use_minor(player, params["card_name"], turn, log, enemies)
            elif action == "put":
                if not params.get("slot"):
                    params["slot"] = input(f"放入哪个槽位？(1-5，当前卡={params.get('card_ref','')})：").strip()
                handle_put(player, slots, params.get("card_ref", ""), params.get("slot", ""), log)
            elif action == "put_batch":
                handle_put_batch(player, slots, params.get("card_nums", []), log)
            elif action == "remove":
                handle_remove(player, slots, params.get("slot", ""), log)
            elif action == "clear":
                handle_clear(player, slots, log)
            elif action == "confirm":
                if params.get("target") is None:
                    cards = [c for c in slots if c is not None]
                    if cards:
                        res = compose_skill(cards)
                        if res and res.range == Range.SINGLE and res.element != Element.HEAL:
                            t = input("攻击哪个敌人？(序号)：").strip()
                            params["target"] = int(t) if t.isdigit() else None
                success = handle_confirm(player, slots, params.get("target"), turn, log, enemies)
                if success:
                    state = BattleState.ENEMY_ACTION
            elif action == "end":
                state = BattleState.ENEMY_ACTION
            elif action == "noop":
                pass
            else:
                log.add(f"❓ 未知命令：{cmd}（输入 help 查看帮助）")

            if all(not e.alive for e in enemies):
                log.add("🎉🎉🎉 所有敌人被击败！")
                state = BattleState.BATTLE_END
            elif player.hp <= 0:
                state = BattleState.BATTLE_END

        elif state == BattleState.ENEMY_ACTION:
            alive = enemy_phase(player, enemies, log)
            if not alive:
                state = BattleState.BATTLE_END
            else:
                state = BattleState.TURN_END

        elif state == BattleState.TURN_END:
            end_turn(player, enemies)
            if all(not e.alive for e in enemies):
                state = BattleState.BATTLE_END
            else:
                state = BattleState.TURN_START

    return player.hp > 0


# ===================== 休整商店 =====================

def rest_phase(player: Player, wave: int, is_boss: bool, enemies_defeated: int, log: BattleLog) -> bool:
    """波次间休整阶段，返回是否继续挑战"""
    reward = calc_wave_reward(wave, is_boss, enemies_defeated)
    player.money += reward["money"]
    healed = rest_heal(player, reward["heal_pct"])

    clear_screen()
    print(f"""
╔══════════════════════════════════════════════╗
║         🏕️  休 整 阶 段  -  第 {wave} 波 结 束    ║
╠══════════════════════════════════════════════╣
║  🎁 波次奖励：                               ║
║     资金 +¥{reward['money']}                          ║
║     HP 恢复 +{healed}（{player.hp}/{player.max_hp}）        ║
║     得分 +{reward['score']}                         ║
╠══════════════════════════════════════════════╣
║  当前状态：                                   ║
║     HP {player.hp}/{player.max_hp}  |  ¥{player.money}  |  牌库 Lv.{player.deck_level}  ║
╠══════════════════════════════════════════════╣
║  选择休整行动：                               ║
║    1. 完全恢复 HP（¥300）                      ║
║    2. 升级牌库（¥500/1000/2000/4000）          ║
║    3. 额外抽 2 张卡（¥150）                   ║
║    4. 进入下一波 ▶                             ║
║    5. 结束挑战（查看最终成绩）                  ║
╚══════════════════════════════════════════════╝
""")
    while True:
        choice = input("请选择 (1-5)：").strip()
        if choice == "1":
            cost = 300
            if player.money < cost:
                print(f"❌ 资金不足，需要 ¥{cost}")
                continue
            player.money -= cost
            player.hp = player.max_hp
            print(f"✅ HP 已完全恢复！（{player.hp}/{player.max_hp}）")
        elif choice == "2":
            handle_upgrade(player, BattleLog())
        elif choice == "3":
            cost = 150
            if player.money < cost:
                print(f"❌ 资金不足，需要 ¥{cost}")
                continue
            player.money -= cost
            drawn = draw_cards(player, 2)
            if drawn:
                print(f"✅ 抽到：{', '.join(c.name for c in drawn)}")
            else:
                print("❌ 牌库已空或手牌已满")
                player.money += cost
        elif choice == "4":
            return True
        elif choice == "5":
            return False
        else:
            print("请输入 1-5")
    return True


# ===================== 主游戏循环 =====================

def main() -> None:
    clear_screen()
    name, factions = select_protagonist()
    faction = select_faction(factions)

    faction_data = ARCANA_DB[faction]
    player = Player(
        name=name, faction=faction,
        deck=build_initial_deck(faction_data.persona_pool, CARD_DB),
    )

    log = BattleLog()
    total_score = 0
    wave = 0

    print(f"\n⚔️ {name} 加入挑战！阵营：{faction}（{faction_data.bonus_desc}）")
    print("挑战规则：逐波击败敌人，每5波出现BOSS。坚持越久得分越高！")
    input("按回车开始挑战...")

    while True:
        wave += 1
        enemies, is_boss = spawn_wave_enemies(wave)
        log = BattleLog()
        log.add(f"━━━ 第 {wave} 波 {'（BOSS战！）' if is_boss else ''} ━━━")
        log.add(f"👹 敌人：{', '.join(e.name for e in enemies)}")

        victory = run_battle(player, enemies, log, wave)

        if not victory:
            if player.hp <= 0:
                clear_screen()
                print(f"\n💀 你在第 {wave} 波倒下了...")
            else:
                clear_screen()
                print(f"\n👋 你在第 {wave} 波退出了挑战")
            print(f"\n🏆 最终成绩：")
            print(f"   到达波次：{wave}")
            print(f"   总得分：{total_score}")
            break

        # 波次胜利
        enemies_defeated = len(enemies)
        reward = calc_wave_reward(wave, is_boss, enemies_defeated)
        total_score += reward["score"]
        log.add(f"🏆 第 {wave} 波胜利！得分 +{reward['score']}（累计 {total_score}）")

        clear_screen()
        print(render_battlefield(player, enemies, 0, [None]*5, log, 50, 500))
        input(f"\n🎉 第 {wave} 波胜利！按回车进入休整...")

        # 休整阶段
        should_continue = rest_phase(player, wave, is_boss, enemies_defeated, log)
        if not should_continue:
            clear_screen()
            print(f"\n🏁 挑战结束！")
            print(f"   到达波次：{wave}")
            print(f"   总得分：{total_score}")
            print(f"   最终 HP：{player.hp}/{player.max_hp}")
            break

    print("\n感谢游玩《女神异闻录：阿尔卡那协奏》文字版！")


if __name__ == "__main__":
    main()
