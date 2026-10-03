// ============================================================
// 局外养成状态管理：经验、等级、属性点、图鉴、商店、存档
// ============================================================
import {
  PERSONAS, ARCANA, STAGES, SHOP_ITEMS,
  EXP_CURVE, MAX_PLAYER_LEVEL, STAT_POINTS_PER_LEVEL,
  STAT_UPGRADE_COSTS, STAT_INCREMENTS,
  STARTING_PERSONAS, RANK,
  DEFAULT_THEURGY_CONFIG, THEURGY_POOL,
} from "./data.js?v=19";

const SAVE_KEY = "persona_concerto_save_v1";        // 旧版单存档（迁移用）
const PROFILES_KEY = "persona_concerto_profiles_v1"; // 多玩家档案（每个玩家独立存档）

// 读取所有玩家档案
function readProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function writeProfiles(profiles) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch (e) { /* ignore */ }
}

// 旧版存档迁移：将单存档转为"默认玩家"档案
function migrateLegacySave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  const profiles = readProfiles();
  if (!profiles["默认玩家"]) {
    try {
      profiles["默认玩家"] = JSON.parse(raw);
      writeProfiles(profiles);
    } catch (e) { /* ignore */ }
  }
  localStorage.removeItem(SAVE_KEY);
}

export class MetaState {
  constructor(profileName = "默认玩家") {
    // 首次加载时迁移旧存档
    migrateLegacySave();
    this.profileName = profileName;
    this.load();
  }

  // ---------- 玩家档案管理（静态方法） ----------
  static listProfiles() {
    migrateLegacySave();
    const profiles = readProfiles();
    return Object.keys(profiles);
  }

  static createProfile(name) {
    const profiles = readProfiles();
    if (profiles[name]) return { ok: false, msg: "该玩家名已存在" };
    profiles[name] = null; // null 表示新存档，load 时使用默认值
    writeProfiles(profiles);
    return { ok: true };
  }

  static deleteProfile(name) {
    const profiles = readProfiles();
    delete profiles[name];
    writeProfiles(profiles);
  }

  // ---------- 存档 ----------
  load() {
    const profiles = readProfiles();
    const saved = profiles[this.profileName] || null;

    this.playerLevel = saved?.playerLevel ?? 1;
    this.exp = saved?.exp ?? 0;
    this.money = saved?.money ?? 200;
    this.statPoints = saved?.statPoints ?? 0;
    this.arcanaId = saved?.arcanaId ?? "FOOL";
    this.unlockedPersonas = new Set(saved?.unlockedPersonas ?? STARTING_PERSONAS);
    this.compendium = new Set(saved?.compendium ?? STARTING_PERSONAS);
    this.clearedStages = saved?.clearedStages ?? [];
    // 永久属性加成（来自属性点分配，仅攻击/HP/暴击率三项；逆位/神通法/手牌上限不再可养成）
    this.bonusStats = saved?.bonusStats ?? { attack: 0, maxHp: 0, critRate: 0 };
    // 永久购买加成（历史字段，保留以防旧存档读取，但不再产生效果）
    this.bonusHandLimit = saved?.bonusHandLimit ?? 0;
    this.bonusTheurgyMax = saved?.bonusTheurgyMax ?? 0;
    // 难度等级（0~10，影响敌方伤害倍率）
    this.difficulty = saved?.difficulty ?? 0;
    // 神通法配置（必须 3 个，从 THEURGY_POOL 中选取）
    this.theurgyConfig = saved?.theurgyConfig ?? [...DEFAULT_THEURGY_CONFIG];
    // 阵营特性等级表（每个阵营 1~3 级，初始 1）
    const defaultLevels = {};
    Object.keys(ARCANA).forEach(k => { defaultLevels[k] = 1; });
    this.arcanaLevels = saved?.arcanaLevels ?? defaultLevels;
  }

  save() {
    const data = {
      playerLevel: this.playerLevel,
      exp: this.exp,
      money: this.money,
      statPoints: this.statPoints,
      arcanaId: this.arcanaId,
      unlockedPersonas: [...this.unlockedPersonas],
      compendium: [...this.compendium],
      clearedStages: this.clearedStages,
      bonusStats: this.bonusStats,
      bonusHandLimit: this.bonusHandLimit,
      bonusTheurgyMax: this.bonusTheurgyMax,
      difficulty: this.difficulty,
      theurgyConfig: this.theurgyConfig,
      arcanaLevels: this.arcanaLevels,
    };
    const profiles = readProfiles();
    profiles[this.profileName] = data;
    writeProfiles(profiles);
  }

  reset() {
    const profiles = readProfiles();
    profiles[this.profileName] = null;
    writeProfiles(profiles);
    this.load();
  }

  // ---------- 经验/等级 ----------
  addExp(amt) {
    this.exp += amt;
    let leveled = false;
    while (this.playerLevel < MAX_PLAYER_LEVEL && this.exp >= EXP_CURVE[this.playerLevel]) {
      this.exp -= EXP_CURVE[this.playerLevel];
      this.playerLevel++;
      this.statPoints += STAT_POINTS_PER_LEVEL;
      leveled = true;
    }
    if (this.playerLevel >= MAX_PLAYER_LEVEL) {
      this.exp = Math.min(this.exp, EXP_CURVE[MAX_PLAYER_LEVEL - 1]);
    }
    this.save();
    return leveled;
  }

  getExpProgress() {
    if (this.playerLevel >= MAX_PLAYER_LEVEL) return { cur: 0, next: 0, pct: 100 };
    const cur = this.exp;
    const next = EXP_CURVE[this.playerLevel];
    return { cur, next, pct: Math.round(cur / next * 100) };
  }

  // ---------- 属性点分配 ----------
  getStatCost(stat) { return STAT_UPGRADE_COSTS[stat] || 1; }

  upgradeStat(stat) {
    const cost = this.getStatCost(stat);
    if (this.statPoints < cost) return false;
    this.statPoints -= cost;
    this.bonusStats[stat] = (this.bonusStats[stat] ?? 0) + 1;
    this.save();
    return true;
  }

  getStatDisplay(stat) {
    const inc = STAT_INCREMENTS[stat];
    const lvl = this.bonusStats[stat] ?? 0;
    // 难度压缩后的基础值
    if (stat === "critRate") return { base: "3%", bonus: `+${(lvl * inc * 100).toFixed(0)}%`, total: `${(Math.min(0.03 + lvl * inc, 0.6) * 100).toFixed(0)}%` };
    if (stat === "maxHp") return { base: "300", bonus: `+${lvl * inc}`, total: String(300 + lvl * inc) };
    if (stat === "attack") return { base: "18", bonus: `+${lvl * inc}`, total: String(Math.min(18 + lvl * inc, 180)) };
    return { base: "0", bonus: "", total: "0" };
  }

  // 计算战斗中的实际玩家属性（难度压缩后基础值；阵营特性按等级应用）
  // 逆位上限/神通法次数/手牌上限不再可养成，固定为基础值
  getBattlePlayerStats() {
    const s = this.bonusStats;
    const arcana = ARCANA[this.arcanaId];
    const arcanaLv = this.getArcanaLevel(this.arcanaId);
    let attack = 18 + (s.attack ?? 0) * STAT_INCREMENTS.attack;
    let maxHp = 300 + (s.maxHp ?? 0) * STAT_INCREMENTS.maxHp;
    let critRate = 0.03 + (s.critRate ?? 0) * STAT_INCREMENTS.critRate;
    // 固定值（不受局外养成影响）
    const maxReversed = 2;
    const theurgyMax = 2;
    const handLimit = 5;

    // 阵营特性按等级应用（仅基础属性部分；其它效果在 game.js/core.js 内分级应用）
    if (arcana?.bonusKey === "FLAT_ATK") {
      // 力量：攻击 +5%/+10%/+15%
      const pct = [0.05, 0.10, 0.15][arcanaLv - 1] || 0.05;
      attack = Math.round(attack * (1 + pct));
    }
    if (arcana?.bonusKey === "CRIT_UP") {
      // 正义：暴击 +5%/+10%/+15%
      critRate += [0.05, 0.10, 0.15][arcanaLv - 1] || 0.05;
    }

    // 攻击力与暴击率加成上限（防止数值膨胀）
    attack = Math.min(attack, 180);
    critRate = Math.min(critRate, 0.6);

    return { attack, maxHp, critRate, maxReversed, theurgyMax, handLimit, arcanaLv };
  }

  // ---------- 阵营特性升级 ----------
  getArcanaLevel(arcanaId) {
    const lv = this.arcanaLevels[arcanaId] ?? 1;
    return Math.min(3, Math.max(1, lv));
  }

  upgradeArcana(arcanaId) {
    const cur = this.getArcanaLevel(arcanaId);
    if (cur >= 3) return { ok: false, msg: "已满级" };
    const cost = cur * 800; // Lv1→2: 800 精魄；Lv2→3: 1600 精魄
    if (this.money < cost) return { ok: false, msg: `精魄不足（需 ◈${cost}）` };
    this.money -= cost;
    this.arcanaLevels[arcanaId] = cur + 1;
    this.save();
    return { ok: true, msg: `${ARCANA[arcanaId]?.name} 升至 Lv.${cur + 1}`, newLevel: cur + 1 };
  }

  // ---------- 图鉴 ----------
  registerPersona(key) {
    if (PERSONAS[key]) this.compendium.add(key);
  }

  unlockPersona(key) {
    if (PERSONAS[key]) {
      this.unlockedPersonas.add(key);
      this.compendium.add(key);
      this.save();
    }
  }

  // 通关奖励：根据关卡进度解锁一张对应等阶的人格面具
  // 使正常游玩全流程即可解锁大部分人格面具
  grantStageRewardPersona(stageIndex) {
    let targetRank;
    if (stageIndex <= 1) targetRank = RANK.C;
    else if (stageIndex <= 3) targetRank = RANK.B;
    else targetRank = RANK.A;

    // 优先目标等阶，没有则降级查找未解锁的人格面具
    for (let rank = targetRank; rank >= RANK.C; rank--) {
      const candidates = Object.keys(PERSONAS)
        .filter(k => !PERSONAS[k].skill)
        .filter(k => PERSONAS[k].rank === rank)
        .filter(k => !this.isUnlocked(k));
      if (candidates.length > 0) {
        const key = candidates[Math.floor(Math.random() * candidates.length)];
        this.unlockPersona(key);
        return { key, name: PERSONAS[key].name, rank };
      }
    }
    return null;
  }

  isUnlocked(key) { return this.unlockedPersonas.has(key); }
  isInCompendium(key) { return this.compendium.has(key); }

  getCompendiumList() {
    return Object.keys(PERSONAS)
      .filter(k => !PERSONAS[k].skill) // 排除神通法卡池
      .map(k => ({
        key: k,
        ...PERSONAS[k],
        unlocked: this.isUnlocked(k),
        seen: this.isInCompendium(k),
      }));
  }

  getUnlockedList() {
    return [...this.unlockedPersonas].filter(k => PERSONAS[k] && !PERSONAS[k].skill);
  }

  // ---------- 阵营选择 ----------
  setArcana(arcanaId) {
    if (ARCANA[arcanaId]) {
      this.arcanaId = arcanaId;
      this.save();
    }
  }

  getArcana() { return ARCANA[this.arcanaId]; }

  // ---------- 主角相性（随阵营改变） ----------
  getPlayerAffinities() {
    return ARCANA[this.arcanaId]?.affinities || {};
  }

  // ---------- 难度（0~10，敌方伤害倍率 0.5~1.5） ----------
  getDifficulty() { return this.difficulty; }
  setDifficulty(level) {
    const lv = Math.max(0, Math.min(10, parseInt(level) || 0));
    this.difficulty = lv;
    this.save();
  }
  // 敌方伤害最终倍率：0级=0.5，每级+0.1，10级=1.5
  getEnemyDamageMultiplier() {
    return 0.5 + this.difficulty * 0.1;
  }

  // ---------- 神通法配置（必须 3 个） ----------
  getTheurgyConfig() { return [...this.theurgyConfig]; }
  setTheurgyConfig(ids) {
    // 校验：必须是 THEURGY_POOL 中的 id，且恰好 3 个（去重后）
    const validIds = new Set(THEURGY_POOL.map(t => t.id));
    const unique = [...new Set((ids || []).filter(id => validIds.has(id)))];
    if (unique.length !== 3) return { ok: false, msg: "必须选择 3 个不同的神通法" };
    this.theurgyConfig = unique;
    this.save();
    return { ok: true, msg: "神通法配置已保存" };
  }

  // ---------- 关卡进度 ----------
  clearStage(stageId) {
    if (!this.clearedStages.includes(stageId)) {
      this.clearedStages.push(stageId);
    }
    this.save();
  }

  isStageCleared(stageId) { return this.clearedStages.includes(stageId); }

  getNextStage() {
    for (let i = 0; i < STAGES.length; i++) {
      if (!this.isStageCleared(STAGES[i].id)) return i;
    }
    return -1; // all cleared
  }

  // ---------- 商店 ----------
  buyItem(itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return { ok: false, msg: "无效商品" };
    if (this.money < item.cost) return { ok: false, msg: "资金不足" };

    switch (item.type) {
      case "PERSONA_UNLOCK": {
        const candidates = Object.keys(PERSONAS)
          .filter(k => !PERSONAS[k].skill)
          .filter(k => PERSONAS[k].rank === item.filter.rank)
          .filter(k => !this.isUnlocked(k));
        if (candidates.length === 0) return { ok: false, msg: "该阶位已全部解锁" };
        const key = candidates[Math.floor(Math.random() * candidates.length)];
        this.money -= item.cost;
        this.unlockPersona(key);
        return { ok: true, msg: `解锁人格面具：${PERSONAS[key].name}`, key };
      }
      case "STAT_POINTS":
        this.money -= item.cost;
        this.statPoints += item.amount;
        this.save();
        return { ok: true, msg: `获得 ${item.amount} 属性点` };
      case "GOLD":
        this.money -= item.cost;
        this.money += item.amount;
        this.save();
        return { ok: true, msg: `获得 ◈${item.amount} 精魄` };
      default:
        return { ok: false, msg: "未知商品类型" };
    }
  }
}
