# -*- coding: utf-8 -*-
"""
《女神异闻录：阿尔卡那协奏》文字版 - 文字UI与输入解析
"""
from __future__ import annotations
import os
from typing import Optional

from data import (
    Element, Power, Range, Affinity, CardType, Card, SkillData,
    POWER_NAME, AFFINITY_ICON, RANK_NAME,
)
from engine import (
    Player, Enemy, compose_skill, BattleLog,
)


# ===================== 清屏 =====================

def clear_screen() -> None:
    os.system("cls" if os.name == "nt" else "clear")


# ===================== 分隔线 =====================

LINE = "═" * 70
THIN = "─" * 70


# ===================== 状态栏 =====================

def render_status_bar(player: Player, turn: int) -> str:
    gauge_blocks = int(player.theurgy_gauge / 10)
    gauge = "█" * gauge_blocks + "░" * (10 - gauge_blocks)
    return (
        f"╔{LINE}╗\n"
        f"║ 🌊 TURN {turn:02d}  |  ¥{player.money:<5}  |  DECK Lv.{player.deck_level}  "
        f"|  HAND {len(player.hand)}/{player.hand_limit}  |  "
        f"THEURGY [{gauge}] {player.theurgy_gauge}% ║\n"
        f"╚{LINE}╝"
    )


# ===================== 敌人区域 =====================

def render_enemies(enemies: list[Enemy]) -> str:
    lines = [f"┌{THIN}┐"]
    lines.append("│ ◆ 敌 人 区 域 ◆")
    for i, enemy in enumerate(enemies, 1):
        hp_pct = int(enemy.hp / enemy.max_hp * 20)
        hp_bar = "█" * hp_pct + "░" * (20 - hp_pct)
        aff_str = " ".join(
            f"{el.icon}{AFFINITY_ICON[af]}" for el, af in enemy.affinities.items()
        )
        status = "── DOWN ──" if enemy.is_knocked_down else "正常"
        intent_map = {
            "ATTACK_SINGLE": "▸ ATTACK(单体)",
            "ATTACK_ALL": "▸ ATTACK(全体)",
            "BUFF_SELF": "▲ BUFF(自身)",
            "DEBUFF_PLAYER": "▼ DEBUFF(玩家)",
            "HEAL_SELF": "💚 HEAL(自身)",
        }
        intent = intent_map.get(enemy.current_intent, "? UNKNOWN")
        dead = " 💀已击败" if not enemy.alive else ""
        lines.append(f"│ 【敌人{i}】{enemy.name} Lv.{enemy.level}{dead}")
        lines.append(f"│   HP [{hp_bar}] {enemy.hp}/{enemy.max_hp}")
        lines.append(f"│   相性：{aff_str if aff_str else '无特殊相性'}")
        lines.append(f"│   状态：{status}    意图：{intent}")
    lines.append(f"└{THIN}┘")
    return "\n".join(lines)


# ===================== 构筑槽 =====================

def render_compose_slots(slots: list[Optional[Card]]) -> str:
    slot_strs = []
    for i, card in enumerate(slots, 1):
        if card is None:
            slot_strs.append(f"[SLOT {i:02d}:空]")
        else:
            sk = card.active_skill
            slot_strs.append(f"[SLOT {i:02d}:{card.name} {sk}]")
    chain = " → ".join(slot_strs)
    return (
        f"┌{THIN}┐\n"
        f"│ ◆ 构 筑 槽 ◆\n"
        f"│ {chain}\n"
        f"└{THIN}┘"
    )


# ===================== 合成结果预览 =====================

def render_compose_preview(slots: list[Optional[Card]], player: Player) -> str:
    cards = [c for c in slots if c is not None]
    if not cards:
        return (
            f"┌{THIN}┐\n"
            f"│ ◆ 合 成 预 览 ◆\n"
            f"│   —— 等待构筑 ——\n"
            f"│   将卡牌放入构筑槽开始合成\n"
            f"└{THIN}┘"
        )
    result = compose_skill(cards)
    if result is None:
        return "│  合成失败"

    # 估算伤害（对普通相性敌人）
    import engine
    base = player.attack * engine.POWER_MULTIPLIER[result.power]
    cup_mult = 1.0 + 0.5 * player.cup_stack
    faction_mult = 1.2 if (player.faction == "魔术师" and result.element == Element.FIRE) else 1.0
    est_dmg = int(base * cup_mult * faction_mult)

    # 愚者阵营：首次构筑力度+1
    fool_bonus = ""
    if player.faction == "愚者" and not player.first_compose_used:
        boosted = Power(min(result.power.value + 1, 5))
        fool_bonus = f"  → 愚者加成后力度 {boosted.name_cn}"

    return (
        f"┌{THIN}┐\n"
        f"│ ◆ 合 成 预 览 ◆\n"
        f"│   最终技能：{result}\n"
        f"│   力度：{result.power.name_cn}{fool_bonus}\n"
        f"│   范围：{result.range.value}\n"
        f"│   预估伤害(普通相性)：约 {est_dmg}\n"
        f"│   圣杯加成：×{cup_mult:.1f}\n"
        f"│   消耗卡牌：{len(cards)} 张\n"
        f"└{THIN}┘"
    )


# ===================== 手牌区域 =====================

def render_hand(player: Player) -> str:
    lines = [f"┌{THIN}┐", "│ ◆ 手 牌 ◆"]
    for i, card in enumerate(player.hand, 1):
        if card.card_type == CardType.PERSONA:
            up = card.skill_upright
            rev = card.skill_reversed
            cur = "▼逆位" if card.is_reversed else "▲正位"
            lines.append(
                f"│ {i}. [{RANK_NAME[card.rank]}]{card.name}({card.arcana}) {cur}"
            )
            lines.append(f"│     正位▲：{up}")
            lines.append(f"│     逆位▼：{rev}")
        elif card.card_type == CardType.SWORD:
            lines.append(f"│ {i}. [{RANK_NAME[card.rank]}]{card.name}(宝剑) {card.skill}")
        elif card.card_type == CardType.WAND:
            lines.append(f"│ {i}. [{RANK_NAME[card.rank]}]{card.name}(权杖) → 获得高阶卡牌")
        elif card.card_type == CardType.CUP:
            lines.append(f"│ {i}. [{RANK_NAME[card.rank]}]{card.name}(圣杯) → 本回合伤害+50%")
        elif card.card_type == CardType.PENTACLE:
            lines.append(f"│ {i}. [{RANK_NAME[card.rank]}]{card.name}(星币) → 获得资金")
        elif card.card_type == CardType.THEURGY:
            lines.append(f"│ {i}. [{RANK_NAME[card.rank]}]{card.name}(神通法) {card.skill}")
        elif card.card_type == CardType.ALL_OUT:
            lines.append(f"│ {i}. ★{card.name}(总攻击) {card.skill}")
    lines.append(f"└{THIN}┘")
    return "\n".join(lines)


# ===================== 玩家状态栏 =====================

def render_player_status(player: Player) -> str:
    hp_pct = int(player.hp / player.max_hp * 20)
    hp_bar = "█" * hp_pct + "░" * (20 - hp_pct)
    return (
        f"┌{THIN}┐\n"
        f"│ 主人公：{player.name}  阵营：{player.faction}\n"
        f"│ HP [{hp_bar}] {player.hp}/{player.max_hp}  |  ATK {player.attack}  |  暴击 {int(player.crit_rate*100)}%\n"
        f"│ 击倒护盾：{player.knockdown_shield}  |  圣杯层数：{player.cup_stack}  |  翻转剩余：{player.flip_remaining}\n"
        f"└{THIN}┘"
    )


# ===================== 操作栏 =====================

def render_action_bar(player: Player, draw_cost: int, upgrade_cost: int) -> str:
    draw_ok = "✓" if player.money >= draw_cost else "✗"
    up_ok = "✓" if player.money >= upgrade_cost else "✗"
    return (
        f"┌{THIN}┐\n"
        f"│ [1]翻转  [2]抽牌¥{draw_cost}({draw_ok})  [3]升级¥{upgrade_cost}({up_ok})  "
        f"[4]用辅助  [5]确认构筑  [6]结束回合\n"
        f"│ ⚡快速构筑：直接输入手牌序号如 1,2,3 → 自动填入构筑槽\n"
        f"│ 单体技能确认时需指定敌号；help 查看完整说明\n"
        f"└{THIN}┘"
    )


# ===================== 战斗日志 =====================

def render_log(log: BattleLog) -> str:
    msgs = log.consume()
    if not msgs:
        return ""
    lines = [f"┌{THIN}┐", "│ 📜 战 斗 日 志"]
    for m in msgs[-6:]:  # 最近6条
        lines.append(f"│   {m}")
    lines.append(f"└{THIN}┘")
    return "\n".join(lines)


# ===================== 完整战场渲染 =====================

def render_battlefield(
    player: Player, enemies: list[Enemy], turn: int,
    slots: list[Optional[Card]], log: BattleLog,
    draw_cost: int, upgrade_cost: int,
) -> str:
    parts = [
        render_status_bar(player, turn),
        render_enemies(enemies),
        render_compose_slots(slots),
        render_compose_preview(slots, player),
        render_player_status(player),
        render_hand(player),
        render_action_bar(player, draw_cost, upgrade_cost),
    ]
    log_str = render_log(log)
    if log_str:
        parts.append(log_str)
    return "\n".join(parts)


# ===================== 输入解析 =====================

def find_card_by_input(player: Player, token: str) -> Optional[Card]:
    """根据输入（序号或名字）找到手牌中的卡"""
    token = token.strip()
    if token.isdigit():
        idx = int(token) - 1
        if 0 <= idx < len(player.hand):
            return player.hand[idx]
        return None
    # 按名字模糊匹配
    for card in player.hand:
        if token in card.name or card.name in token:
            return card
    return None


def parse_command(cmd: str):
    """
    解析玩家命令，返回 (action, params)
    action: flip/draw/upgrade/use_minor/put/put_batch/remove/clear/confirm/end/quit/help
    """
    cmd = cmd.strip()
    if not cmd:
        return ("noop", {})

    low = cmd.lower()

    if low in ("quit", "exit", "q"):
        return ("quit", {})
    if low in ("help", "h", "?"):
        return ("help", {})
    if low in ("clear", "清空"):
        return ("clear", {})
    if low.startswith("end") or low in ("结束回合", "结束", "end turn"):
        return ("end", {})

    # 批量构筑：1,2,3  或  1 2 3 （纯数字序列，无命令前缀）
    parts = cmd.replace(",", " ").split()
    if parts and all(p.isdigit() for p in parts) and len(parts) >= 2:
        nums = [int(p) for p in parts]
        return ("put_batch", {"card_nums": nums})

    # 翻转
    if low.startswith("flip") or low.startswith("翻转"):
        rest = cmd[cmd.find(" ")+1:] if " " in cmd else ""
        return ("flip", {"card_name": rest})

    # 抽牌
    if low.startswith("draw") or low.startswith("抽牌"):
        return ("draw", {})

    # 升级牌库
    if low.startswith("upgrade") or low.startswith("升级"):
        return ("upgrade", {})

    # 使用辅助卡
    if low.startswith("use") or low.startswith("使用"):
        rest = cmd[cmd.find(" ")+1:] if " " in cmd else ""
        return ("use_minor", {"card_name": rest})

    # 放入构筑槽（支持 put 1,2,3 批量）
    if low.startswith("put") or low.startswith("放") or "放入" in cmd:
        rest = cmd[cmd.find(" ")+1:] if " " in cmd else ""
        rest_parts = rest.replace(",", " ").split()
        if rest_parts and all(p.isdigit() for p in rest_parts):
            nums = [int(p) for p in rest_parts]
            if len(nums) >= 2:
                return ("put_batch", {"card_nums": nums})
            elif len(nums) == 1:
                return ("put", {"card_ref": str(nums[0]), "slot": ""})
        if len(rest_parts) >= 2:
            return ("put", {"card_ref": rest_parts[0], "slot": rest_parts[1]})
        return ("put", {"card_ref": rest_parts[0] if rest_parts else "", "slot": ""})

    # 移除构筑槽
    if low.startswith("remove") or low.startswith("移除") or low.startswith("拿"):
        rest = cmd[cmd.find(" ")+1:] if " " in cmd else ""
        return ("remove", {"slot": rest})

    # 确认构筑
    if low.startswith("confirm") or low.startswith("确认") or low.startswith("打出") or low.startswith("攻击"):
        rest = cmd[cmd.find(" ")+1:] if " " in cmd else ""
        target = None
        if rest.isdigit():
            target = int(rest)
        return ("confirm", {"target": target})

    # 数字快捷键（单个数字）
    if cmd in ("1", "2", "3", "4", "5", "6"):
        mapping = {"1": "flip", "2": "draw", "3": "upgrade", "4": "use_minor", "5": "confirm", "6": "end"}
        return (mapping[cmd], {})

    return ("unknown", {"raw": cmd})


def print_help() -> None:
    print("""
╔═══════════════════ 操 作 说 明 ═══════════════════╗
║  快捷键菜单（输入数字进入对应操作）：             ║
║    1 - 翻转卡牌（引导选择）                        ║
║    2 - 花费资金抽牌                                ║
║    3 - 升级牌库                                    ║
║    4 - 使用辅助卡（引导选择）                      ║
║    5 - 确认构筑并打出                              ║
║    6 - 结束回合                                    ║
║                                                   ║
║  快速构筑（最常用）：                             ║
║    直接输入手牌序号序列，如 1,2,3 或 1 2 3         ║
║    → 自动将这些卡依次放入构筑槽 1/2/3              ║
║                                                   ║
║  其他命令：                                       ║
║    put <卡序> <槽位>   单卡放入指定槽位            ║
║    remove <槽位>       从槽位移除卡牌              ║
║    clear                清空构筑槽                 ║
║    flip <卡序>          翻转人格面具正逆位         ║
║    use <卡序>           使用辅助卡                 ║
║    confirm <敌号>       确认构筑攻击指定敌人       ║
║    help                 显示帮助                   ║
║    quit                 退出游戏                   ║
╚═══════════════════════════════════════════════════╝
""")
