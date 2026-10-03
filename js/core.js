// ============================================================
// 核心规则引擎：技能合成、相性、伤害计算
// ============================================================
import {
  ELEMENT, POWER, POWER_MULTIPLIER, AFFINITY, AFFINITY_MULTIPLIER,
  RANGE, CARD_TYPE,
} from "./data.js?v=20";

/**
 * 获取卡牌当前生效的技能数据
 * - 人格面具卡：根据正逆位返回对应技能
 * - 宝剑/神通法/总攻击：返回固定技能
 */
export function getActiveSkill(card) {
  if (card.type === CARD_TYPE.PERSONA) {
    return card.is_reversed ? card.skill_reversed : card.skill_upright;
  }
  return card.skill;
}

/**
 * 叠牌合成算法（严格按计划书实现）
 * 规则：
 *  1. 同属性 → 力度叠加（上限 XH=5）
 *  2. 异属性 → 改变属性，力度叠加
 *  3. 范围由最后一张卡决定
 *  4. 万能属性同时改变属性和力度
 */
export function composeSkill(cards) {
  if (!cards || cards.length === 0) return null;

  const result = { element: null, power: 0, range: null };
  const first = getActiveSkill(cards[0]);
  result.element = first.element;
  result.power = first.power;
  result.range = first.range;

  for (let i = 1; i < cards.length; i++) {
    const skill = getActiveSkill(cards[i]);

    // 规则4：万能属性同时改变属性和力度
    if (skill.element === ELEMENT.ALMIGHTY) {
      result.element = ELEMENT.ALMIGHTY;
      result.power = Math.min(result.power + skill.power, POWER.UL);
      result.range = skill.range;
      continue;
    }

    // 规则2 & 1：异属性改变属性；同属性力度叠加（两者力度都叠加）
    if (skill.element !== result.element) {
      result.element = skill.element;
    }
    result.power = Math.min(result.power + skill.power, POWER.UL);

    // 规则3：范围由最后一张卡决定
    result.range = skill.range;
  }

  return result;
}

/**
 * 计算合成技能的基础伤害（不含相性/圣杯/倒地/暴击）
 * 阵营伤害加成按等级缩放：MAGICIAN 火焰 / EMPEROR 电击 / CHARIOT 物理
 */
export function calcBaseDamage(skill, player) {
  const atk = player.attack;
  const mult = POWER_MULTIPLIER[skill.power] ?? 1;
  const lv = player.arcanaLv || 1;
  let arcanaBonus = 1;
  if (player.arcanaBonus === "FIRE_DMG" && skill.element === ELEMENT.FIRE)
    arcanaBonus = [1.10, 1.20, 1.30][lv - 1] || 1.10;
  else if (player.arcanaBonus === "ELEC_DMG" && skill.element === ELEMENT.ELEC)
    arcanaBonus = [1.10, 1.20, 1.30][lv - 1] || 1.10;
  else if (player.arcanaBonus === "PHYS_DMG" && skill.element === ELEMENT.PHYSICAL)
    arcanaBonus = [1.05, 1.10, 1.15][lv - 1] || 1.05;
  return Math.round(atk * mult * arcanaBonus);
}

/**
 * 获取敌人对某属性的相性
 */
export function getAffinity(element, enemy) {
  return enemy.affinities[element] ?? AFFINITY.NORMAL;
}

/**
 * 伤害计算（计划书公式）
 *  final = base × affinity × cup × knockdown × crit
 *  env 支持：CRIT_DOWN（玩家暴击率减半）
 *  REPEL: 反噬玩家；DRAIN: 转化为治疗；NULL: 0 伤害
 */
export function calculateDamage(skill, player, enemy, env) {
  env = env || [];
  const base = calcBaseDamage(skill, player);
  const affinity = getAffinity(skill.element, enemy);
  const mult = AFFINITY_MULTIPLIER[affinity];

  // 恢复/辅助技能不触发相性
  if (skill.element === ELEMENT.HEAL || skill.element === ELEMENT.SUPPORT) {
    return { damage: base, affinity: AFFINITY.NORMAL, isCrit: false, isHeal: true };
  }

  // NULL：0 伤害
  if (affinity === AFFINITY.NULL) {
    return { damage: 0, affinity, isCrit: false };
  }

  // 圣杯加成：基础 0.4/层；女皇阵营按等级再放大
  const lv = player.arcanaLv || 1;
  const cupScale = player.arcanaBonus === "CUP_DOUBLE" ? ([1.5, 2.0, 2.5][lv - 1] || 1.5) : 1;
  const cupMult = 1 + 0.4 * (player.cupStack || 0) * cupScale;
  const kdMult = enemy.is_knocked_down ? 1.25 : 1.0;
  let critRate = player.critRate || 0;
  // 环境减益：暴击率减半
  if (env.includes("CRIT_DOWN")) critRate *= 0.5;
  const isCrit = Math.random() < critRate;
  const critMult = isCrit ? 1.5 : 1.0;

  // REPEL：反弹给玩家
  if (affinity === AFFINITY.REPEL) {
    const reflect = Math.round(base * cupMult * kdMult * critMult);
    return { damage: reflect, affinity, isCrit, isRepel: true };
  }

  // DRAIN：敌人吸收为治疗
  if (affinity === AFFINITY.DRAIN) {
    const drained = Math.round(base * cupMult * kdMult * critMult);
    return { damage: drained, affinity, isCrit, isDrain: true };
  }

  // 正义 Lv3：暴击时无视耐性（RESIST 视为 NORMAL）
  let finalMult = mult;
  if (player.arcanaBonus === "CRIT_UP" && (player.arcanaLv || 1) >= 3 && isCrit && affinity === AFFINITY.RESIST) {
    finalMult = AFFINITY_MULTIPLIER[AFFINITY.NORMAL];
  }
  const final = Math.round(base * finalMult * cupMult * kdMult * critMult);
  return { damage: final, affinity, isCrit };
}

/**
 * 生成合成结果的描述文本（用于贡献明细条）
 */
export function describeCompose(cards) {
  if (!cards.length) return "";
  return cards.map(c => {
    const s = getActiveSkill(c);
    return `[${s.element.slice(0,4)} ${POWER_LABEL(s.power)}]`;
  }).join(" → ");
}

function POWER_LABEL(p) {
  return { 1: "SM", 2: "MD", 3: "LG", 4: "HV", 5: "XH" }[p];
}
