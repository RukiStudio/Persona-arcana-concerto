// ============================================================
// 人格面具合体系统：合体表查询、技能继承、合体执行
// ============================================================
import {
  PERSONAS, ARCANA, getFusionArcana, RANK, RANK_LABEL, SKILLS,
} from "./data.js?v=18";

/**
 * 获取合体结果的人格面具
 * @param {string} keyA - 素材A的persona key
 * @param {string} keyB - 素材B的persona key
 * @returns {object|null} - { key, name, arcana, rank, inheritedSkills } 或 null
 */
export function getFusionResult(keyA, keyB) {
  const pA = PERSONAS[keyA];
  const pB = PERSONAS[keyB];
  if (!pA || !pB || pA.skill || pB.skill) return null; // 神通法卡不可合体

  const resultArcana = getFusionArcana(pA.arcana, pB.arcana);
  if (!resultArcana) return null;

  // 结果等阶 = ceil((rankA + rankB) / 2)，同阿尔卡那则 +1
  const sameArcana = pA.arcana === pB.arcana;
  let resultRank = Math.ceil((pA.rank + pB.rank) / 2);
  if (sameArcana) resultRank = Math.min(pA.rank, pB.rank) + 1;
  resultRank = Math.min(resultRank, RANK.S);

  // 从结果阿尔卡那池中找到最接近 resultRank 的人格面具
  const candidates = Object.entries(PERSONAS)
    .filter(([k, p]) => p.arcana === resultArcana && !p.skill) // 排除神通法卡池
    .map(([k, p]) => ({ key: k, ...p }));

  if (candidates.length === 0) return null;

  // 找到最匹配的（rank ≤ resultRank 中最大的，若没有则取最小的）
  let best = null;
  for (const c of candidates) {
    if (c.rank <= resultRank) {
      if (!best || c.rank > best.rank) best = c;
    }
  }
  if (!best) best = candidates.reduce((a, b) => a.rank < b.rank ? a : b);

  // 技能继承：从两个素材中各随机继承1个技能
  const inheritedSkills = [];
  const poolA = [pA.upright, pA.reversed].filter(Boolean);
  const poolB = [pB.upright, pB.reversed].filter(Boolean);
  if (poolA.length) inheritedSkills.push(poolA[Math.floor(Math.random() * poolA.length)]);
  if (poolB.length) inheritedSkills.push(poolB[Math.floor(Math.random() * poolB.length)]);

  // 去重
  const seen = new Set();
  const uniqueInherited = inheritedSkills.filter(s => {
    const key = s.name + s.element + s.power;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    key: best.key,
    name: best.name,
    icon: best.icon,
    arcana: resultArcana,
    arcanaName: ARCANA[resultArcana]?.name ?? resultArcana,
    rank: best.rank,
    rankLabel: RANK_LABEL[best.rank],
    inheritedSkills: uniqueInherited,
    cost: 300 * (pA.rank + pB.rank),
  };
}

/**
 * 执行合体（消耗资金，解锁结果人格面具）
 * @param {MetaState} meta - 局外养成状态
 * @param {string} keyA
 * @param {string} keyB
 * @returns {{ok: boolean, msg: string, result?: object}}
 */
export function executeFusion(meta, keyA, keyB) {
  const result = getFusionResult(keyA, keyB);
  if (!result) return { ok: false, msg: "合体失败：无法找到合适的结果" };

  if (meta.money < result.cost) {
    return { ok: false, msg: `资金不足，需要 ◈${result.cost}` };
  }

  // 如果已经解锁了，提示
  if (meta.isUnlocked(result.key)) {
    return { ok: false, msg: `${result.name} 已解锁，请尝试其他组合` };
  }

  meta.money -= result.cost;
  meta.unlockPersona(result.key);
  return { ok: true, msg: `合体成功！解锁了 ${result.name}（${result.arcanaName}）`, result };
}

/**
 * 获取所有可用合体配方预览
 * @param {MetaState} meta
 * @returns {Array} - 可用合体列表
 */
export function getAvailableFusions(meta) {
  const unlocked = meta.getUnlockedList();
  const results = [];
  const seen = new Set();

  for (let i = 0; i < unlocked.length; i++) {
    for (let j = i + 1; j < unlocked.length; j++) {
      const r = getFusionResult(unlocked[i], unlocked[j]);
      if (r && !meta.isUnlocked(r.key)) {
        const id = `${unlocked[i]}+${unlocked[j]}`;
        if (seen.has(r.key)) continue;
        seen.add(r.key);
        results.push({
          matA: unlocked[i],
          matB: unlocked[j],
          matAName: PERSONAS[unlocked[i]].name,
          matBName: PERSONAS[unlocked[j]].name,
          ...r,
        });
      }
    }
  }
  return results;
}
