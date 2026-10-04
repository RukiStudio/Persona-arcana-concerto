// ============================================================
// 本地 AI 对战系统（通关主线关卡 5 后在 Hub 解锁）
// BO3：玩家依次选择 3 个阵营，AI 随机选择 3 个阵营
// 独立规则引擎，不复用、也不修改主线关卡状态机
// ============================================================
import {
  ARCANA,
  ARCANA_LIST,
  THEURGY_POOL,
  CARD_TYPE,
  POWER,
  RANGE,
  ELEMENT,
  AFFINITY,
  AFFINITY_MULTIPLIER,
  ELEMENT_INFO,
  POWER_INFO,
  POWER_MULTIPLIER,
  DEFAULT_THEURGY_CONFIG,
  STARTING_PERSONAS,
  PERSONAS,
} from "./data.js?v=20";
import { composeSkill, calculateDamage, getActiveSkill, calcBaseDamage, getAffinity } from "./core.js?v=19";
import {
  makePersonaCard,
  makeMinorCard,
  makeAttackCard,
} from "./game.js?v=20";
import { playElementBurst } from "./vfx.js?v=2";

const BASE_HP = 300;
const BASE_ATTACK = 18;
const BASE_CRIT_RATE = 0.03;
const BASE_HAND_LIMIT = 5;
const BASE_MAX_REVERSED = 2;
const BASE_THEURGY_MAX = 2;
const BASE_MONEY = 120;
const SHIELD_HP_COST_PCT = 0.20;
const SHIELD_MAX_PER_ROUND = 2;
const WEAK_REWARD_MONEY = 50;
const MAX_COMPOSE_SLOTS = 5;
// 牌堆升级费用（适配决斗局内 ¥ 经济）：Lv1→2 / 2→3 / 3→4 / 4→5
const DUEL_UPGRADE_COSTS = [120, 240, 480, 900];

let duelCardSeq = 0;
function nextDuelCardId(prefix) {
  duelCardSeq += 1;
  return `duel-${prefix}-${Date.now().toString(36)}-${duelCardSeq}`;
}

function makeDuelTheurgyCard(id) {
  const t = THEURGY_POOL.find(item => item.id === id) || THEURGY_POOL[0];
  return {
    id: nextDuelCardId("the"),
    type: CARD_TYPE.THEURGY,
    cardKey: t.id,
    name: t.name,
    icon: t.icon,
    skill: { ...t.skill },
  };
}

class Fighter {
  constructor(arcanaKey, isAI, meta, name, icon) {
    const arcana = ARCANA[arcanaKey];
    this.arcanaKey = arcana.id;
    this.arcana = arcana;
    this.isAI = isAI;
    this.meta = meta;
    this.name = name || arcana.name;
    this.icon = icon || arcana.icon;

    // 固定初始值：局外属性、牌库等级不生效；阵营特性以其基础等级（Lv.1）生效
    this.maxHp = BASE_HP;
    this.hp = BASE_HP;
    this.attack = BASE_ATTACK;
    this.critRate = BASE_CRIT_RATE;
    this.maxReversed = BASE_MAX_REVERSED;
    this.handLimit = BASE_HAND_LIMIT;
    this.theurgyMax = BASE_THEURGY_MAX;
    this.deckLevel = 1;
    this.arcanaLv = 1;
    this.arcanaBonus = arcana.bonusKey; // 应用阵营特性（基础等级）
    // 局内即时生效的属性类特性（基础 Lv.1）
    if (this.arcanaBonus === "FLAT_ATK") this.attack = Math.round(this.attack * 1.05);
    if (this.arcanaBonus === "CRIT_UP") this.critRate += 0.05;

    this.money = BASE_MONEY;
    this.drawCost = 60;
    this.affinities = { ...(arcana.affinities || {}) };
    this.is_knocked_down = false;
    this.cupStack = 0;

    this.theurgy = 0;
    this.theurgyUses = 0;
    this.theurgyConfig = [...DEFAULT_THEURGY_CONFIG];
    this.pendingTheurgyId = null;

    this.shield = false;
    this.shieldCount = 0;
    this.shieldExpiresTurn = 0;

    this.deck = [];
    this.hand = [];
    this.composeSlots = [];
    this.firstComposeThisTurn = true;
  }
}

export class Duel {
  constructor(meta, playerKeys) {
    this.meta = meta;
    this.playerKeys = playerKeys.slice(0, 3);
    this.aiKeys = this.pickRandomArcana(3);

    this.round = 0;
    this.playerWins = 0;
    this.aiWins = 0;
    this.turn = 0;
    this.state = "SETUP";

    this.environment = ["COMPOSE_COST_UP"];
    this.difficulty = 5;
    this.enemyDamageMultiplier = 0.5 + this.difficulty * 0.1;

    this.pending = [];
    this.logs = [];
    this.listeners = [];
    this.timers = new Set();
    this.destroyed = false;
  }

  pickRandomArcana(n) {
    const keys = ARCANA_LIST.slice();
    const picked = [];
    while (picked.length < n && keys.length) {
      const i = Math.floor(Math.random() * keys.length);
      picked.push(keys.splice(i, 1)[0]);
    }
    return picked;
  }

  on(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== fn);
    };
  }

  emit(type, data) {
    this.listeners.slice().forEach(fn => fn(type, data));
  }

  log(msg, cls = "info") {
    this.logs.push({ msg, cls });
    this.emit("log", { msg, cls });
  }

  wait(ms) {
    return new Promise(resolve => {
      const id = setTimeout(() => {
        this.timers.delete(id);
        resolve();
      }, ms);
      this.timers.add(id);
    });
  }

  destroy() {
    this.destroyed = true;
    this.state = "MATCH_END";
    this.timers.forEach(id => clearTimeout(id));
    this.timers.clear();
    this.listeners = [];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  opponentOf(f) {
    return f === this.player ? this.ai : this.player;
  }

  startMatch() {
    this.round = 0;
    this.playerWins = 0;
    this.aiWins = 0;
    this.startRound();
  }

  startRound() {
    if (this.destroyed) return;
    if (this.playerWins >= 2 || this.aiWins >= 2) {
      this.state = "MATCH_END";
      return;
    }

    const pKey = this.playerKeys[this.round];
    const aKey = this.aiKeys[this.round];
    this.player = new Fighter(pKey, false, this.meta, "玩家", "🧙");
    this.ai = new Fighter(aKey, true, this.meta, `宿敌·${ARCANA[aKey].name}`, ARCANA[aKey].icon);

    this.buildInitialDeck(this.player);
    this.buildInitialDeck(this.ai);
    this.drawCards(this.player, this.player.handLimit);
    this.drawCards(this.ai, this.ai.handLimit);

    this.turn = 0;
    this.pending = [];
    this.logs = [];
    this.state = "SETUP";

    this.log(`—— 第 ${this.round + 1} 局 ——`, "gold");
    this.log(`你：${ARCANA[pKey].icon} ${ARCANA[pKey].name}　vs　AI：${ARCANA[aKey].icon} ${ARCANA[aKey].name}`, "gold");
    this.log("固定环境：构筑需多一张 · 固定难度 Lv.5 · 阵营特性以基础等级生效", "info");
    this.emit("roundStart", { round: this.round });
    this.startPlayerTurn();
  }

  goToNextRound() {
    if (this.destroyed || this.state !== "ROUND_END") return;
    if (this.playerWins >= 2 || this.aiWins >= 2) return;
    this.round += 1;
    this.startRound();
  }

  getPersonaPool(f) {
    let pool = (f.arcana.persona_pool || []).slice();
    if (!f.isAI) {
      pool = pool.filter(key => this.meta.isUnlocked(key));
      // 与主线一致：该阵营没有任何已收集人格面具时，回退到初始人格面具
      if (pool.length === 0) pool = STARTING_PERSONAS.slice();
    }
    return pool;
  }

  buildInitialDeck(f) {
    const deck = [];
    const pool = this.getPersonaPool(f).slice(0, 10);
    pool.forEach(key => deck.push(makePersonaCard(key)));
    this.addMinorCardsTo(deck);
    f.deck = this.shuffle(deck);
  }

  replenishDeck(f) {
    const deck = [];
    this.addMinorCardsTo(deck);
    f.deck = this.shuffle(deck);
    if (!f.isAI) this.log("牌库已空，重新洗入小阿尔卡那", "info");
  }

  addMinorCardsTo(deck) {
    deck.push(makeMinorCard("wand"));
    deck.push(makeMinorCard("cup"));
    deck.push(makeMinorCard("cup"));
    deck.push(makeMinorCard("pentacle"));
    deck.push(makeMinorCard("pentacle"));
    deck.push(makeMinorCard("sword_sm"));
    deck.push(makeMinorCard("sword_md"));
  }

  drawCard(f) {
    if (f.hand.length >= f.handLimit) return false;
    if (f.deck.length === 0) this.replenishDeck(f);
    f.hand.push(f.deck.pop());
    return true;
  }

  drawCards(f, n) {
    for (let i = 0; i < n; i++) this.drawCard(f);
  }

  returnComposeCards(f) {
    while (f.composeSlots.length) f.hand.push(f.composeSlots.pop());
  }

  discardAttackCards(f) {
    f.hand = f.hand.filter(card => card.type !== CARD_TYPE.ATTACK);
  }

  expireShield(f) {
    if (f.shield && this.turn >= f.shieldExpiresTurn) {
      f.shield = false;
      this.log(`${f.name} 的护盾失效`, "info");
    }
  }

  async startPlayerTurn() {
    if (this.destroyed) return;
    this.turn += 1;
    this.expireShield(this.player);

    if (this.player.is_knocked_down) {
      this.state = "PLAYER_DOWN";
      this.player.is_knocked_down = false;
      this.player.cupStack = 0;
      this.discardAttackCards(this.player);
      this.log("你处于倒地状态，无法行动，跳过本回合", "dmg");
      this.emit("state");
      await this.wait(950);
      if (this.destroyed) return;

      this.state = "RESOLVING";
      this.resolvePending(this.player);
      this.emit("state");
      if (this.checkRoundEnd()) return;
      this.aiTurn();
      return;
    }

    this.state = "PLAYER_ACTION";
    this.beginTurn(this.player);
    this.emit("state");
  }

  beginTurn(f) {
    f.cupStack = 0;
    f.drawCost = 60;
    f.firstComposeThisTurn = true;
    this.deliverPendingTheurgy(f);

    const income = 80 + this.turn * 15 + (f.arcanaBonus === "EXTRA_INCOME" ? 30 : 0);
    f.money += income;
    let drawNum = Math.min(4, 1 + f.deckLevel);
    this.drawCards(f, drawNum);
    this.discardAttackCards(f);
    this.log(`回合 ${this.turn} · ${f.name} 获得 ¥${income}`, "info");
  }

  buyDraw() {
    const f = this.player;
    if (this.state !== "PLAYER_ACTION") return;
    if (f.money < f.drawCost) {
      this.log("资金不足", "info");
      return;
    }
    if (f.hand.length >= f.handLimit) {
      this.log("手牌已满", "info");
      return;
    }
    const cost = f.drawCost;
    this.doDrawFor(f);
    this.log(`花费 ¥${cost} 抽取一张牌`, "gold");
    this.emit("state");
  }

  buyShield() {
    const f = this.player;
    if (this.state !== "PLAYER_ACTION") return;
    if (f.shield) {
      this.log("护盾仍在生效中", "info");
      return;
    }
    if (f.shieldCount >= SHIELD_MAX_PER_ROUND) {
      this.log("本局护盾购买次数已用尽（限 2 次）", "info");
      return;
    }
    const cost = Math.round(f.maxHp * SHIELD_HP_COST_PCT);
    if (f.hp <= cost) {
      this.log("当前血量不足以购买护盾", "info");
      return;
    }

    f.hp -= cost;
    f.shield = true;
    f.shieldCount += 1;
    f.shieldExpiresTurn = this.turn + 1;
    this.log(`消耗 ${cost} HP 购买护盾：将免疫下一次伤害及附带效果`, "gold");
    this.emit("state");
  }

  // 牌堆升级：花费 ¥ 提升牌堆等级，手牌上限+1，并补入更高阶人格面具
  upgradeDeck(f) {
    const allowed = f.isAI ? this.state === "AI_ACTION" : this.state === "PLAYER_ACTION";
    if (!allowed) return false;
    if (f.deckLevel >= 5) {
      if (!f.isAI) this.log("牌库已满级", "info");
      return false;
    }
    let baseCost = DUEL_UPGRADE_COSTS[f.deckLevel - 1] || 99999;
    // 命运阵营：升级费用 -20%
    if (f.arcanaBonus === "FORTUNE_ECONOMY") baseCost = Math.round(baseCost * 0.8);
    if (f.money < baseCost) {
      if (!f.isAI) this.log(`资金不足！升级牌库需 ¥${baseCost}`, "info");
      return false;
    }
    const pool = this.getPersonaPool(f);
    const high = pool.filter(key => PERSONAS[key] && PERSONAS[key].rank >= 3);
    const low = pool.filter(key => PERSONAS[key] && PERSONAS[key].rank <= 2);
    const choices = high.length ? high : low;
    const key = choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;

    f.money -= baseCost;
    f.deckLevel += 1;
    f.handLimit = Math.min(8, f.handLimit + 1);
    if (key) {
      f.deck.push(makePersonaCard(key));
      this.shuffle(f.deck);
    }
    this.log(
      `${f.name} 牌库升至 Lv.${f.deckLevel}！解锁 ${key ? PERSONAS[key].name : "新卡"}，手牌上限+1`,
      "gold"
    );
    this.emit("state");
    return true;
  }

  // 调理：带有伤害减轻阵营特性的战士，承受伤害按比例降低
  mitigateDamage(f, dmg) {
    if (!dmg) return 0;
    if (f.arcanaBonus === "DAMAGE_REDUCE") dmg = Math.round(dmg * 0.9);
    return dmg;
  }

  // 首次构筑加成：愚者/女教皇 基础等级时，本回合首次构筑力度+1
  applyComposeBonus(f, skill) {
    if (!skill) return skill;
    if (f.arcanaBonus === "FOOL_FIRST" || f.arcanaBonus === "PRIESTESS_COMPOSE") {
      if (f.firstComposeThisTurn) {
        const refund = f.arcanaBonus === "PRIESTESS_COMPOSE" ? 30 : 0;
        return { ...skill, power: Math.min(POWER.UL, skill.power + 1), foolBonus: true, priestessBonus: !!refund, priestessRefund: refund };
      }
    }
    return skill;
  }

  flipCard(cardId) {
    const f = this.player;
    if (this.state !== "PLAYER_ACTION") return;
    const card = f.hand.find(c => c.id === cardId) ||
      f.composeSlots.find(c => c.id === cardId);
    if (!card || card.type !== CARD_TYPE.PERSONA) return;

    if (!card.is_reversed && this.getReversedCount(f) >= f.maxReversed) {
      this.log(`场上逆位牌已达上限（${f.maxReversed} 张）`, "info");
      return;
    }
    card.is_reversed = !card.is_reversed;
    this.log(`${card.name} 切换为${card.is_reversed ? "逆位" : "正位"}`, "info");
    this.emit("state");
  }

  getReversedCount(f) {
    return [...f.hand, ...f.composeSlots].filter(card => card.is_reversed).length;
  }

  useCard(cardId) {
    const f = this.player;
    if (this.state !== "PLAYER_ACTION") return;
    const card = f.hand.find(c => c.id === cardId);
    if (!card) return;

    switch (card.type) {
      case CARD_TYPE.WAND:
      case CARD_TYPE.CUP:
      case CARD_TYPE.PENTACLE:
        this.useMinorFighter(f, card);
        break;
      case CARD_TYPE.THEURGY:
        this.useTheurgyFighter(f, card);
        break;
      case CARD_TYPE.ATTACK:
        this.useAttackFighter(f, card);
        break;
      case CARD_TYPE.PERSONA:
      case CARD_TYPE.SWORD:
        this.addToCompose(f, card.id);
        break;
      default:
        break;
    }
    this.emit("state");
  }

  addToCompose(f, cardId) {
    if (f.composeSlots.length >= MAX_COMPOSE_SLOTS) {
      this.log("构筑槽已满", "info");
      return;
    }
    const idx = f.hand.findIndex(card => card.id === cardId);
    if (idx < 0) return;
    const card = f.hand[idx];
    f.hand.splice(idx, 1);
    f.composeSlots.push(card);
    this.deliverPendingTheurgy(f);
  }

  removeFromCompose(slotIdx) {
    const f = this.player;
    if (this.state !== "PLAYER_ACTION") return;
    const card = f.composeSlots.splice(slotIdx, 1)[0];
    if (card) f.hand.push(card);
    this.emit("state");
  }

  clearCompose() {
    this.returnComposeCards(this.player);
    this.emit("state");
  }

  confirmCompose() {
    const f = this.player;
    if (this.state !== "PLAYER_ACTION") return;
    if (f.composeSlots.length === 0) {
      this.log("构筑区为空", "info");
      return;
    }
    if (this.environment.includes("COMPOSE_COST_UP") && f.composeSlots.length < 2) {
      this.log("固定环境要求构筑至少 2 张牌", "info");
      return;
    }

    const skill = this.applyComposeBonus(f, composeSkill(f.composeSlots));
    if (!skill) return;
    const names = f.composeSlots.map(card => card.name).join(" + ");
    f.composeSlots = [];
    f.hand.push(makeAttackCard(skill));
    f.firstComposeThisTurn = false;
    this.log(`构筑：${names} → 攻击牌已生成`, "info");
    this.emit("state");
  }

  useMinorFighter(f, card) {
    const idx = f.hand.findIndex(c => c.id === card.id);
    if (idx < 0) return;
    f.hand.splice(idx, 1);

    if (card.type === CARD_TYPE.CUP) {
      f.cupStack += 1;
      this.log(`${f.name} 使用圣杯：本回合伤害 +40%（当前 ${f.cupStack} 层）`, "gold");
    } else if (card.type === CARD_TYPE.PENTACLE) {
      const gain = 200 + this.turn * 10;
      f.money += gain;
      this.log(`${f.name} 使用星币：获得 ¥${gain}`, "gold");
    } else if (card.type === CARD_TYPE.WAND) {
      const pool = this.getPersonaPool(f);
      if (pool.length === 0) {
        this.log(`${f.name} 使用权杖：当前阵营没有已收集人格面具`, "info");
      } else {
        const key = pool[Math.floor(Math.random() * pool.length)];
        const card = makePersonaCard(key);
        f.hand.push(card);
        this.log(`${f.name} 使用权杖：获得 ${card.name}`, "gold");
      }
    }
    this.deliverPendingTheurgy(f);
  }

  useTheurgyFighter(f, card) {
    if (f.theurgyUses >= f.theurgyMax) {
      this.log("神通法使用次数已达上限", "info");
      return;
    }
    const idx = f.hand.findIndex(c => c.id === card.id);
    if (idx < 0) return;

    f.hand.splice(idx, 1);
    f.theurgyUses += 1;
    this.log(`${f.name} 发动神通法：${card.name}`, f.isAI ? "dmg" : "gold");
    this.execSkill(f, card.skill);
    this.deliverPendingTheurgy(f);
  }

  useAttackFighter(f, card) {
    const idx = f.hand.findIndex(c => c.id === card.id);
    if (idx < 0) return;
    f.hand.splice(idx, 1);
    this.log(`${f.name} 发动攻击牌：${card.name}`, "info");
    playElementBurst(card.skill && card.skill.element);
    this.execSkill(f, card.skill);
    this.deliverPendingTheurgy(f);
  }

  execSkill(f, skill) {
    if (!skill) return;

    if (skill.element === ELEMENT.SUPPORT) {
      this.log("辅助技能在塔罗决斗中不产生额外效果", "info");
      return;
    }

    if (skill.element === ELEMENT.HEAL) {
      const mult = POWER_MULTIPLIER[skill.power] ?? 1;
      let amount = Math.round(
        f.attack * mult * (skill.range === RANGE.ALL ? 1.2 : 1)
      );
      if (f.arcanaBonus === "HEAL_UP") amount = Math.round(amount * 1.10);
      this.healFighter(f, amount);
      return;
    }

    const target = this.opponentOf(f);
    this.pending.push({ source: f, target, skill });
    this.emit("queued", { source: f, target, skill });
  }

  healFighter(f, amount) {
    const before = f.hp;
    f.hp = Math.min(f.maxHp, f.hp + Math.round(amount));
    const real = f.hp - before;
    if (real > 0) this.log(`${f.name} 恢复 ${real} HP`, "heal");
  }

  gainTheurgy(f, amount) {
    if (f.theurgyUses >= f.theurgyMax || f.pendingTheurgyId) return;
    f.theurgy = Math.min(100, f.theurgy + amount);
    if (f.theurgy < 100) return;

    f.theurgy = 0;
    const id = f.theurgyConfig[Math.floor(Math.random() * f.theurgyConfig.length)];
    if (f.hand.length < f.handLimit) {
      f.hand.push(makeDuelTheurgyCard(id));
      f.pendingTheurgyId = null;
    } else {
      f.pendingTheurgyId = id;
    }

    if (f.isAI) {
      this.log("⚠ 杀意感知：对手的神通法已经准备完成！", "dmg");
      this.emit("killSense");
    } else {
      const t = THEURGY_POOL.find(item => item.id === id);
      this.log(`神通法准备完成：${t ? t.name : id}`, "gold");
    }
  }

  deliverPendingTheurgy(f) {
    if (!f.pendingTheurgyId || f.hand.length >= f.handLimit) return false;
    const id = f.pendingTheurgyId;
    f.pendingTheurgyId = null;
    f.hand.push(makeDuelTheurgyCard(id));
    return true;
  }

  endTurn() {
    if (this.state !== "PLAYER_ACTION") return;
    this.returnComposeCards(this.player);
    this.discardAttackCards(this.player);
    // 注意：圣杯层数必须等 resolvePending 计算完伤害后才清零
    this.state = "RESOLVING";
    this.emit("state");

    this.resolvePending(this.player);
    this.emit("state");
    if (this.checkRoundEnd()) return;
    this.aiTurn();
  }

  resolvePending(source) {
    const entries = this.pending.filter(entry => entry.source === source);
    this.pending = this.pending.filter(entry => entry.source !== source);

    entries.forEach(entry => {
      if (this.destroyed) return;
      // 关键规则：伤害、相性、暴击、倒地都在回合结束时才计算和施加
      const result = calculateDamage(entry.skill, source, entry.target, this.environment);
      const applied = this.applyEntry(entry, result);
      if (applied) {
        this.gainTheurgy(source, 15 + (result.isCrit ? 10 : 0));
      }
    });
    source.cupStack = 0;
  }

  applyDamage(f, amount) {
    if (amount <= 0) return false;
    if (f.shield) {
      f.shield = false;
      this.log(`🛡 ${f.name} 的护盾挡下了本次伤害与附带效果！`, "gold");
      this.emit("shieldBlock", { target: f });
      return false;
    }
    f.hp = Math.max(0, f.hp - amount);
    return true;
  }

  applyEntry(entry, result) {
    const { source, target, skill } = entry;
    const elementInfo = ELEMENT_INFO[skill.element] || { name: "?", icon: "?" };

    if (result.isHeal) {
      this.healFighter(source, result.damage);
      return false;
    }

    // 倒悬者阵营：攻击被耐性/无效/反弹/吸收时增加神通法充能
    if (source.arcanaBonus === "HANGED_RESIST_CHARGE") {
      const blocked = result.affinity === AFFINITY.RESIST || result.affinity === AFFINITY.NULL ||
        result.isRepel || result.isDrain;
      if (blocked) {
        source.theurgy = Math.min(100, source.theurgy + 15);
        this.log(`倒悬者加成：${source.name} 神通法 +15`, "gold");
      }
    }

    if (result.damage === 0 && result.affinity === AFFINITY.NULL) {
      this.log(`${target.name} 无效化了${elementInfo.name}属性攻击`, "info");
      return false;
    }

    if (result.isRepel) {
      const dealt = this.applyDamage(source, this.mitigateDamage(source, result.damage));
      if (dealt) this.log(`${target.name} 反弹了${elementInfo.name}属性伤害！`, "dmg");
      return dealt;
    }

    if (result.isDrain) {
      // 护盾需要在吸收前拦截，因此先检查目标护盾
      if (target.shield) {
        target.shield = false;
        this.log(`🛡 ${target.name} 的护盾挡下了本次伤害与吸收效果！`, "gold");
        this.emit("shieldBlock", { target });
        return false;
      }
      this.healFighter(target, result.damage);
      this.log(`${target.name} 吸收了${elementInfo.name}属性攻击`, "heal");
      return false;
    }

    const dealt = this.applyDamage(target, this.mitigateDamage(target, result.damage));
    if (!dealt) return false;

    const affinityText = result.affinity === AFFINITY.WEAK ? "（弱点！）" :
      result.affinity === AFFINITY.RESIST ? "（耐性）" : "";
    this.log(
      `${target.name} 受到 ${result.damage} 点${elementInfo.name}伤害${affinityText}${result.isCrit ? "（暴击！）" : ""}`,
      result.affinity === AFFINITY.WEAK ? "dmg" : "info"
    );

    if (result.affinity === AFFINITY.WEAK) {
      target.is_knocked_down = true;
      source.hand.push(makeMinorCard("wand"));
      source.money += WEAK_REWARD_MONEY;
      this.log(`弱点击破！${source.name} 固定获得权杖，并恢复 ¥${WEAK_REWARD_MONEY}`, "gold");
    }
    // 女教皇阵营：首次构筑造成伤害后返还资金
    if (skill.priestessBonus && skill.priestessRefund) {
      source.money += skill.priestessRefund;
      this.log(`女教皇加成：${source.name} 返还 ¥${skill.priestessRefund}`, "gold");
      skill.priestessBonus = false;
    }
    return true;
  }

  checkRoundEnd() {
    if (this.ai.hp <= 0 || this.player.hp <= 0) {
      this.roundEnd(this.ai.hp <= 0 && this.player.hp > 0);
      return true;
    }
    return false;
  }

  roundEnd(playerWin) {
    this.state = "ROUND_END";
    this.pending = [];
    if (playerWin) {
      this.playerWins += 1;
      this.log(`🎉 你赢得了第 ${this.round + 1} 局`, "gold");
    } else {
      this.aiWins += 1;
      this.log(`💀 你输掉了第 ${this.round + 1} 局`, "dmg");
    }

    this.emit("roundEnd", {
      playerWin,
      round: this.round,
      playerWins: this.playerWins,
      aiWins: this.aiWins,
    });

    if (this.playerWins >= 2 || this.aiWins >= 2) {
      this.state = "MATCH_END";
      this.emit("matchEnd", { playerWin: this.playerWins >= 2 });
    }
  }

  async aiTurn() {
    if (this.destroyed) return;
    this.state = "AI_ACTION";
    this.expireShield(this.ai);

    if (this.ai.is_knocked_down) {
      this.state = "AI_DOWN";
      this.ai.is_knocked_down = false;
      this.ai.cupStack = 0;
      this.log("AI 处于倒地状态，无法行动，跳过本回合", "gold");
      this.emit("state");
      await this.wait(950);
      if (this.destroyed) return;
      this.startPlayerTurn();
      return;
    }

    const ai = this.ai;
    this.beginTurn(ai);
    this.emit("state");
    await this.wait(550);

    // 策略大脑：每场对战复用同一个实例（含持久性格与历史记忆）
    if (!this.brain) this.brain = new DuelAIBrain(this);
    await this.brain.playTurn(ai);

    this.returnComposeCards(ai);
    this.discardAttackCards(ai);
    // 注意：圣杯层数必须等 resolvePending 计算完伤害后才清零
    this.state = "RESOLVING";
    this.emit("state");
    await this.wait(260);
    if (this.destroyed) return;

    this.resolvePending(ai);
    this.emit("state");
    if (this.checkRoundEnd()) return;
    this.startPlayerTurn();
  }

  getWeakElements(f) {
    return Object.entries(f.affinities || {})
      .filter(([, affinity]) => affinity === AFFINITY.WEAK)
      .map(([element]) => element);
  }

  // 目标会减免/反弹/吸收/无效的属性（AI 决策时应主动规避）
  avoidElements(f) {
    return Object.entries(f.affinities || {})
      .filter(([, affinity]) =>
        affinity === AFFINITY.RESIST || affinity === AFFINITY.NULL ||
        affinity === AFFINITY.REPEL || affinity === AFFINITY.DRAIN
      )
      .map(([element]) => element);
  }

  // 计算某战士下一级牌库升级费用（含命运阵营减免）；已满级返回 Infinity
  getUpgradeCost(f) {
    if (f.deckLevel >= 5) return Infinity;
    let cost = DUEL_UPGRADE_COSTS[f.deckLevel - 1] || 99999;
    if (f.arcanaBonus === "FORTUNE_ECONOMY") cost = Math.round(cost * 0.8);
    return cost;
  }

  // 通用「花费资金抽牌」，适用于任意战士（玩家与 AI 共用经济体）
  doDrawFor(f) {
    if (f.hand.length >= f.handLimit) return false;
    const cost = f.drawCost;
    if (f.money < cost) return false;
    f.money -= cost;
    // 命运阵营：抽卡费用增长变慢
    if (f.arcanaBonus === "FORTUNE_ECONOMY") {
      f.drawCost = Math.round(f.drawCost * 1.5);
    } else {
      f.drawCost *= 2;
    }
    this.drawCard(f);
    // 隐者阵营：花钱抽卡 30% 概率多抽一张
    if (f.arcanaBonus === "HERMIT_LUCKY_DRAW" && Math.random() < 0.30 && f.hand.length < f.handLimit) {
      this.drawCard(f);
    }
    return true;
  }

  cardOrientationOptions(card) {
    if (card.type === CARD_TYPE.PERSONA) {
      return [
        { skill: card.skill_upright, reversed: false },
        { skill: card.skill_reversed, reversed: true },
      ].filter(option => option.skill);
    }
    if (card.type === CARD_TYPE.SWORD) {
      return [{ skill: card.skill, reversed: false }];
    }
    return [];
  }

  plannedSkill(planned) {
    const first = planned[0].option.skill;
    const result = {
      element: first.element,
      power: first.power,
      range: first.range,
    };
    for (let i = 1; i < planned.length; i++) {
      const skill = planned[i].option.skill;
      if (skill.element === ELEMENT.ALMIGHTY) {
        result.element = ELEMENT.ALMIGHTY;
      } else if (skill.element !== result.element) {
        result.element = skill.element;
      }
      result.power = Math.min(result.power + skill.power, POWER.UL);
      result.range = skill.range;
    }
    return result;
  }

  plannedReversedCount(planned) {
    return planned.reduce((sum, item) => sum + (item.option.reversed ? 1 : 0), 0);
  }

  async executeComposePlan(f, plan) {
    f.composeSlots = [];
    plan.planned.forEach(item => {
      const idx = f.hand.findIndex(card => card.id === item.card.id);
      if (idx >= 0) {
        f.hand.splice(idx, 1);
        item.card.is_reversed = item.option.reversed;
        f.composeSlots.push(item.card);
      }
    });

    if (f.composeSlots.length < 2) {
      this.returnComposeCards(f);
      return;
    }

    this.emit("state");
    await this.wait(320);
    if (this.destroyed) return;

    const skill = this.applyComposeBonus(f, composeSkill(f.composeSlots));
    if (!skill) {
      this.returnComposeCards(f);
      return;
    }
    const names = f.composeSlots.map(card => card.name).join(" + ");
    f.composeSlots = [];
    f.firstComposeThisTurn = false;
    const attackCard = makeAttackCard(skill);
    f.hand.push(attackCard);
    this.log(`${f.name} 构筑：${names} → 攻击牌`, "info");
    this.useAttackFighter(f, attackCard);
  }
}

// ============================================================
// 策略型 AI 大脑：多维度感知 → 动态策略选择 → 候选评估 → 加权执行
// 具备：性格随机（不可预测性）、历史对战记忆、进攻/防守/资源管理策略库、
//       收益-风险量化评估模块
// ============================================================

// 多层策略库：每项策略定义一组决策权重（dmg=伤害 / weak=弱点 / eco=经济 /
// safe=安全 / heal=治疗 / tempo=节奏），权重经评估模块合成单一效用分数
const STRATEGIES = {
  ASSAULT: { key: "ASSAULT", label: "强攻斩杀", w: { dmg: 1.0, weak: 0.6, eco: 0.1, safe: 0.0, heal: 0.0, tempo: 0.4 } },
  EXPLOIT: { key: "EXPLOIT", label: "弱点压制", w: { dmg: 0.6, weak: 1.0, eco: 0.2, safe: 0.2, heal: 0.1, tempo: 0.3 } },
  TEMPO:   { key: "TEMPO",   label: "节奏掌控", w: { dmg: 0.5, weak: 0.4, eco: 0.5, safe: 0.5, heal: 0.3, tempo: 0.5 } },
  GROWTH:  { key: "GROWTH",  label: "蓄势发展", w: { dmg: 0.3, weak: 0.3, eco: 1.0, safe: 0.4, heal: 0.2, tempo: 0.2 } },
  SURVIVE: { key: "SURVIVE", label: "防守保命", w: { dmg: 0.2, weak: 0.2, eco: 0.2, safe: 1.0, heal: 1.0, tempo: 0.1 } },
};

class DuelAIBrain {
  constructor(duel) {
    this.duel = duel;
    // 每场对战开局随机性格，决定长期倾向，制造不可预测的对手风格
    this.personality = {
      aggression: 0.25 + Math.random() * 0.75, // 进攻倾向
      greed:      0.25 + Math.random() * 0.75, // 经济/囤积倾向
      caution:    0.25 + Math.random() * 0.75, // 风险规避
      variance:   0.15 + Math.random() * 0.55, // 决策抖动幅度
    };
    // 历史对战记忆：用于威胁评估与动态策略修正
    this.memory = {
      turns: [],
      dmgTaken: [],      // 近 12 回合承受伤害观测
      oppWeaknessHits: 0,
      aiWeaknessHits: 0,
    };
    this.lastAiHp = undefined;
  }

  // ---------- 感知：构建战场上下文 ----------
  perceive(ai) {
    const opp = this.duel.opponentOf(ai);
    return {
      ai, opp,
      turn: this.duel.turn,
      aiHpPct: ai.maxHp ? ai.hp / ai.maxHp : 1,
      oppHpPct: opp.maxHp ? opp.hp / opp.maxHp : 1,
      weakElements: this.duel.getWeakElements(opp),
      avoidElements: this.duel.avoidElements(opp),
      pendingIn: this.duel.pending.filter(e => e.target === ai),
      environment: this.duel.environment,
    };
  }

  // ---------- 确定性伤害预估（用期望暴击替代随机，供决策参考） ----------
  estimateDamage(skill, source, target) {
    if (!skill) return { damage: 0, type: "none", affinity: AFFINITY.NORMAL };
    if (skill.element === ELEMENT.HEAL) {
      const mult = POWER_MULTIPLIER[skill.power] ?? 1;
      const amount = Math.round(source.attack * mult * (skill.range === RANGE.ALL ? 1.2 : 1));
      return { damage: amount, type: "heal", affinity: AFFINITY.NORMAL };
    }
    if (skill.element === ELEMENT.SUPPORT) return { damage: 0, type: "support", affinity: AFFINITY.NORMAL };

    const base = calcBaseDamage(skill, source);
    const affinity = getAffinity(skill.element, target);
    const cupScale = source.arcanaBonus === "CUP_DOUBLE" ? 1.5 : 1;
    const cupMult = 1 + 0.4 * (source.cupStack || 0) * cupScale;
    const kdMult = target.is_knocked_down ? 1.25 : 1;
    const critExp = 1 + 0.5 * (source.critRate || 0);
    const raw = base * cupMult * kdMult * critExp;

    if (affinity === AFFINITY.NULL) return { damage: 0, type: "null", affinity };
    if (affinity === AFFINITY.REPEL) return { damage: Math.round(raw), type: "repel", affinity };
    if (affinity === AFFINITY.DRAIN) return { damage: Math.round(raw), type: "drain", affinity };
    return { damage: Math.round(raw * AFFINITY_MULTIPLIER[affinity]), type: "damage", affinity };
  }

  // ---------- 威胁分析：量化对手下一回合终结我方的风险 ----------
  threatAnalysis(ctx) {
    let queued = 0;
    for (const e of ctx.pendingIn) {
      const est = this.estimateDamage(e.skill, e.source, ctx.ai);
      if (est.type === "damage") queued += est.damage;
    }
    const projected = queued + this.oppBurstEstimate();
    return {
      queued,
      projected,
      dangerPct: ctx.ai.maxHp ? projected / ctx.ai.maxHp : 0,
      lethalNext: projected >= ctx.ai.hp,
    };
  }

  // 基于历史承受伤害估算对手单体回合爆发；无历史时用对称属性保守估计
  oppBurstEstimate() {
    const hist = this.memory.dmgTaken;
    if (hist.length) {
      const avg = hist.reduce((s, v) => s + v, 0) / hist.length;
      return Math.max(Math.max(...hist), avg * 1.4);
    }
    return BASE_ATTACK * (POWER_MULTIPLIER[POWER.XH] || 3.2) * 1.4;
  }

  // ---------- 斩杀/威胁预判 ----------
  canLethal(ctx) {
    const ai = ctx.ai;
    for (const card of ai.hand) {
      if (card.type === CARD_TYPE.THEURGY) {
        const est = this.estimateDamage(card.skill, ai, ctx.opp);
        if (est.type === "damage" && est.damage >= ctx.opp.hp) return true;
      }
    }
    return this.rankComposePlans(ai, ctx, {}).some(
      p => p.est.type === "damage" && p.est.damage >= ctx.opp.hp
    );
  }

  // ---------- 动态策略选择：根据战局实时调整 ----------
  selectStrategy(ctx) {
    const p = this.personality;
    const threat = this.threatAnalysis(ctx);

    // 不可预测性：偶尔以低概率偏离主策略
    if (Math.random() < p.variance * 0.16) {
      return this.weightedPick(Object.values(STRATEGIES), 5, 0.3);
    }

    if (this.canLethal(ctx) && p.aggression > 0.35) return STRATEGIES.ASSAULT;
    if (threat.lethalNext && ctx.aiHpPct < 0.6) return STRATEGIES.SURVIVE;
    if (ctx.aiHpPct < 0.32) return STRATEGIES.SURVIVE;
    if (ctx.weakElements.length && p.aggression > 0.25 && ctx.oppHpPct < 0.55) return STRATEGIES.EXPLOIT;

    const upCost = this.duel.getUpgradeCost(ctx.ai);
    if (ctx.turn <= 2 || (upCost !== Infinity && ctx.ai.money >= upCost * 1.6 && p.greed > 0.4)) {
      return STRATEGIES.GROWTH;
    }
    return STRATEGIES.TEMPO;
  }

  // ---------- 评估模块：对候选构筑方案做收益-风险量化 ----------
  scoreComposePlan(skill, est, ctx, strategy, forcedElement) {
    const w = (strategy || STRATEGIES.TEMPO).w;

    if (forcedElement === ELEMENT.HEAL || est.type === "heal") {
      const healNeed = est.damage / Math.max(1, ctx.ai.maxHp);
      return healNeed * 60 * w.heal + (ctx.aiHpPct < 0.4 ? 30 : 0);
    }
    if (est.type === "support") return -50;

    let s = 0;
    const dmgRatio = est.damage / Math.max(1, ctx.opp.maxHp);
    s += dmgRatio * 55 * w.dmg;
    // 斩杀奖励（收益极值）
    if (est.type === "damage" && est.damage >= ctx.opp.hp) s += 120;
    // 弱点命中奖励
    if (ctx.weakElements.includes(skill.element)) s += 45 * w.weak;
    // 风险惩罚：反弹（自伤）/吸收（回敌）/无效（零收益）
    if (est.type === "repel") s -= 90;
    else if (est.type === "drain") s -= 70;
    else if (est.type === "null") s -= 60;
    else if (ctx.avoidElements.includes(skill.element)) s -= 18;
    // 全体范围节奏价值 + 力度基础价值
    if (skill.range === RANGE.ALL) s += 8 * w.tempo;
    s += skill.power * 2.5 * w.dmg;
    return s;
  }

  // ---------- 候选枚举：枚举手牌中所有可行的构筑组合并打分排序 ----------
  rankComposePlans(ai, ctx, opts = {}) {
    const { forcedElement = null, strategy = null } = opts;
    const candidates = ai.hand.filter(c =>
      c.type === CARD_TYPE.PERSONA || c.type === CARD_TYPE.SWORD
    );
    if (candidates.length < 2) return [];

    const results = [];
    for (const anchorCard of candidates) {
      const anchorOptions = this.duel.cardOrientationOptions(anchorCard).filter(o => {
        if (forcedElement) return o.skill.element === forcedElement;
        return o.skill.element !== ELEMENT.HEAL && o.skill.element !== ELEMENT.SUPPORT;
      });

      for (const anchorOption of anchorOptions) {
        let reversedCount = candidates
          .filter(c => c !== anchorCard)
          .reduce((sum, c) => sum + (c.is_reversed ? 1 : 0), 0)
          + (anchorOption.reversed ? 1 : 0);

        const others = candidates
          .filter(c => c !== anchorCard)
          .map(c => ({
            card: c,
            options: this.duel.cardOrientationOptions(c).filter(o => {
              if (forcedElement) return o.skill.element === forcedElement;
              return o.skill.element !== ELEMENT.HEAL && o.skill.element !== ELEMENT.SUPPORT;
            }),
          }))
          .filter(item => item.options.length)
          .sort((a, b) => {
            const ap = Math.max(...a.options.map(o => o.skill.power));
            const bp = Math.max(...b.options.map(o => o.skill.power));
            return bp - ap;
          });

        const chosen = [];
        for (const item of others.slice(0, MAX_COMPOSE_SLOTS - 1)) {
          const allowed = item.options.filter(o => {
            const oldC = item.card.is_reversed ? 1 : 0;
            const newC = o.reversed ? 1 : 0;
            return reversedCount - oldC + newC <= ai.maxReversed;
          });
          if (!allowed.length) continue;
          allowed.sort((a, b) => {
            const pd = b.skill.power - a.skill.power;
            if (pd) return pd;
            const ae = a.skill.element === forcedElement ? 1 : 0;
            const be = b.skill.element === forcedElement ? 1 : 0;
            if (be - ae) return be - ae;
            return (b.skill.range === RANGE.ALL ? 1 : 0) - (a.skill.range === RANGE.ALL ? 1 : 0);
          });
          const option = allowed[0];
          reversedCount -= item.card.is_reversed ? 1 : 0;
          reversedCount += option.reversed ? 1 : 0;
          chosen.push({ card: item.card, option });
        }

        if (chosen.length < 1) continue;
        const planned = [...chosen, { card: anchorCard, option: anchorOption }];
        if (this.duel.plannedReversedCount(planned) > ai.maxReversed) continue;

        const skill = this.duel.plannedSkill(planned);
        const est = this.estimateDamage(skill, ai, ctx.opp);
        const score = this.scoreComposePlan(skill, est, ctx, strategy, forcedElement);
        results.push({ planned, skill, est, score });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  // ---------- 加权采样：在 Top-N 候选中带随机性选择，兼顾最优与不可预测 ----------
  weightedPick(items, topN = 2, extraNoise = 0) {
    if (!items || !items.length) return null;
    const pool = items.slice(0, Math.min(Math.max(1, topN), items.length));
    const weights = pool.map((item, i) =>
      Math.exp(-i * (1.0 + this.personality.variance)) + extraNoise * Math.random()
    );
    const total = weights.reduce((s, v) => s + v, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  trackDamageTaken(ai) {
    if (this.lastAiHp === undefined) { this.lastAiHp = ai.hp; return; }
    const taken = this.lastAiHp - ai.hp;
    if (taken > 0) {
      this.memory.dmgTaken.push(taken);
      if (this.memory.dmgTaken.length > 12) this.memory.dmgTaken.shift();
    }
    this.lastAiHp = ai.hp;
  }

  recordTurn(ctx, strategy) {
    this.memory.turns.push({
      turn: ctx.turn, strat: strategy.key,
      hp: Math.round(ctx.aiHpPct * 100), oppHp: Math.round(ctx.oppHpPct * 100),
    });
    if (this.memory.turns.length > 60) this.memory.turns.shift();
  }

  // ---------- 主入口：编排一整回合的决策与执行 ----------
  async playTurn(ai) {
    this.trackDamageTaken(ai);
    const ctx = this.perceive(ai);
    const strategy = this.selectStrategy(ctx);
    this.recordTurn(ctx, strategy);
    this.duel.log(`AI 思考：${strategy.label}`, "info");

    await this.phaseGrowth(ctx, strategy);
    await this.phaseResource(ctx, strategy);
    await this.phaseTheurgy(ctx, strategy);
    await this.phaseHeal(ctx, strategy);
    await this.phaseAttack(ctx, strategy);
  }

  // 阶段 1：成长 —— 牌库升级（经济允许 + 策略倾向 + 保留储备）
  async phaseGrowth(ctx, strategy) {
    const ai = ctx.ai;
    const cost = this.duel.getUpgradeCost(ai);
    if (cost === Infinity) return;
    const reserve = Math.round(ai.drawCost * (1.6 - this.personality.greed * 0.7));
    const eager = strategy.key === "GROWTH";
    if (ai.money >= cost && (eager || ai.money >= cost + reserve)) {
      this.duel.upgradeDeck(ai);
      this.duel.emit("state");
      await this.duel.wait(360);
    }
  }

  // 阶段 2：资源 —— 抽牌补充、星币增收、权杖补料
  async phaseResource(ctx, strategy) {
    const ai = ctx.ai;
    const material = ai.hand.filter(c => c.type === CARD_TYPE.PERSONA || c.type === CARD_TYPE.SWORD).length;

    if (material < 3 && ai.hand.length < ai.handLimit && ai.money >= ai.drawCost) {
      this.duel.doDrawFor(ai);
      this.duel.log(`${ai.name} 花费资金抽取一张牌`, "info");
      this.duel.emit("state");
      await this.duel.wait(300);
    }

    for (const card of [...ai.hand]) {
      if (this.duel.destroyed) return;
      if (card.type === CARD_TYPE.PENTACLE) {
        this.duel.useMinorFighter(ai, card);
        this.duel.emit("state");
        await this.duel.wait(300);
      }
    }

    const mat2 = ai.hand.filter(c => c.type === CARD_TYPE.PERSONA || c.type === CARD_TYPE.SWORD).length;
    const wand = ai.hand.find(c => c.type === CARD_TYPE.WAND);
    if (wand && (mat2 < 2 || (strategy.key === "GROWTH" && ai.hand.length < ai.handLimit))) {
      this.duel.useMinorFighter(ai, wand);
      this.duel.emit("state");
      await this.duel.wait(300);
    }
  }

  // 阶段 3：神通法 —— 按收益/风险阈值释放，治疗型仅在低血量时使用
  async phaseTheurgy(ctx, strategy) {
    const ai = ctx.ai;
    let card = ai.hand.find(c => c.type === CARD_TYPE.THEURGY);
    while (card && ai.theurgyUses < ai.theurgyMax) {
      if (this.duel.destroyed) return;
      const est = this.estimateDamage(card.skill, ai, ctx.opp);
      let release = false;
      if (est.type === "heal") {
        release = ctx.aiHpPct < 0.45;
      } else if (est.type === "damage") {
        const lethality = est.damage >= ctx.opp.hp;
        const weakHit = ctx.weakElements.includes(card.skill.element);
        const aggressive = strategy.key === "ASSAULT" || strategy.key === "EXPLOIT";
        release = lethality || weakHit || aggressive || ctx.oppHpPct < 0.35;
      }
      if (!release) break;
      this.duel.useTheurgyFighter(ai, card);
      this.duel.emit("state");
      await this.duel.wait(420);
      card = ai.hand.find(c => c.type === CARD_TYPE.THEURGY);
    }
  }

  // 阶段 4：保命 —— 低血量时构筑治疗牌
  async phaseHeal(ctx, strategy) {
    const ai = ctx.ai;
    const threshold = 0.4 + this.personality.caution * 0.25;
    if (!(ctx.aiHpPct < threshold || strategy.key === "SURVIVE")) return;

    const plans = this.rankComposePlans(ai, ctx, { forcedElement: ELEMENT.HEAL });
    if (!plans.length) return;
    const plan = plans[0];
    const lost = ai.maxHp - ai.hp;
    if (plan.est.damage >= Math.min(60, lost * 0.5)) {
      await this.duel.executeComposePlan(ai, plan);
      this.duel.emit("state");
      await this.duel.wait(420);
    }
  }

  // 阶段 5：进攻 —— 圣杯放大后，按预算构筑并释放攻击牌
  async phaseAttack(ctx, strategy) {
    const ai = ctx.ai;
    if (strategy.key === "SURVIVE" && this.threatAnalysis(ctx).lethalNext && ctx.aiHpPct < 0.35) return;

    // 圣杯：本回合准备进攻时放大最终伤害
    if (strategy.w.dmg >= 0.3) {
      const cup = ai.hand.find(c => c.type === CARD_TYPE.CUP);
      const mat = ai.hand.filter(c => c.type === CARD_TYPE.PERSONA || c.type === CARD_TYPE.SWORD).length;
      if (cup && mat >= 2) {
        this.duel.useMinorFighter(ai, cup);
        this.duel.emit("state");
        await this.duel.wait(280);
      }
    }

    const budget = this.attackBudget(ctx, strategy);
    for (let i = 0; i < budget; i++) {
      if (this.duel.destroyed) return;
      const plans = this.rankComposePlans(ai, ctx, { strategy });
      if (!plans.length) break;
      const plan = this.weightedPick(plans, 2 + Math.floor(this.personality.variance * 3));
      await this.duel.executeComposePlan(ai, plan);
      this.duel.emit("state");
      await this.duel.wait(460);
    }
  }

  attackBudget(ctx, strategy) {
    const ai = ctx.ai;
    const material = ai.hand.filter(c => c.type === CARD_TYPE.PERSONA || c.type === CARD_TYPE.SWORD).length;
    const maxByMaterial = Math.floor(material / 2);
    let n;
    if (strategy.key === "ASSAULT") n = Math.min(3, maxByMaterial);
    else if (strategy.key === "EXPLOIT" || strategy.key === "TEMPO") n = Math.min(2, maxByMaterial);
    else n = Math.min(1, maxByMaterial);
    return Math.max(0, n);
  }
}

// ============================================================
// UI
// ============================================================
const DUEL_CSS = `
#duel-screen{position:fixed;inset:0;z-index:8000;background:#080d20;color:#e6e9f2;overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#duel-screen *{box-sizing:border-box}
#duel-screen .duel-inner{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:top left;background:
  radial-gradient(circle at 50% 0%,rgba(42,58,110,.35),transparent 45%),#080d20}
#duel-screen .duel-header{height:72px;display:flex;justify-content:space-between;align-items:center;gap:22px;padding:0 30px;background:linear-gradient(180deg,#13224f,#0a1532);border-bottom:2px solid #2a3a6e}
#duel-screen .duel-title{font-size:27px;letter-spacing:4px;color:#d4af37;font-weight:800;white-space:nowrap}
#duel-screen .duel-hint{font-size:16px;color:#aab6dc;white-space:nowrap}
#duel-screen .duel-body{display:flex;gap:14px;padding:12px 22px;height:calc(100% - 72px);min-height:0}
#duel-screen .duel-left{width:560px;flex:0 0 560px;display:flex;flex-direction:column;gap:13px;min-height:0}
#duel-screen .duel-mid{flex:1;display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0}
#duel-screen .fighter-panel{background:#111a3a;border:1px solid #2a3a6e;border-radius:13px;padding:16px 18px;box-shadow:inset 0 0 24px rgba(20,35,80,.45)}
#duel-screen .fighter-panel.enemy{border-color:#853044;background:linear-gradient(135deg,rgba(80,20,35,.35),rgba(17,26,58,.9))}
#duel-screen .fighter-panel.self{background:linear-gradient(135deg,rgba(20,55,90,.38),rgba(17,26,58,.95))}
#duel-screen .fp-head{display:flex;align-items:center;gap:10px;margin-bottom:9px;min-width:0}
#duel-screen .fp-icon{font-size:42px;line-height:1}
#duel-screen .fp-name{font-size:23px;font-weight:800;white-space:nowrap}
#duel-screen .fp-arcana{font-size:14px;color:#9aa8d4;white-space:nowrap}
#duel-screen .fp-tags{margin-left:auto;display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
#duel-screen .fp-tag{font-size:13px;padding:5px 9px;border-radius:7px;background:#1d2a4f;color:#c3cdf0;white-space:nowrap}
#duel-screen .fp-tag.shield{background:#0f3d2a;color:#78f0b0;font-weight:700}
#duel-screen .fp-tag.down{background:#5a1f28;color:#ff9ca8;font-weight:800}
#duel-screen .hbar{height:20px;background:#111936;border:1px solid #2c3a68;border-radius:9px;overflow:hidden}
#duel-screen .hbar-fill{height:100%;width:0;background:linear-gradient(90deg,#2ecc71,#27ae60);transition:width .25s}
#duel-screen .hbar-fill.low{background:linear-gradient(90deg,#e74c3c,#c0392b)}
#duel-screen .hp-text{font-size:14px;margin-top:5px;color:#b8c4e8}
#duel-screen .theurgy-track{height:10px;margin-top:8px;border-radius:6px;background:#151d3d;border:1px solid #4a316f;overflow:hidden}
#duel-screen .theurgy-fill{height:100%;background:linear-gradient(90deg,#8e44ad,#d4af37)}
#duel-screen .aff-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
#duel-screen .aff-badge{font-size:11px;padding:2px 6px;border-radius:5px;background:#18244a;color:#aab6dc}
#duel-screen .aff-WEAK{background:#4d1a25;color:#ff94a0}
#duel-screen .aff-RESIST{background:#1c3557;color:#9fd0ff}
#duel-screen .aff-NULL{background:#303448;color:#d5d8e8}
#duel-screen .aff-REPEL,#duel-screen .aff-DRAIN{background:#453013;color:#ffd27d}
#duel-screen .duel-log{flex:1;min-height:0;overflow-y:auto;background:#080e24;border:1px solid #22305c;border-radius:10px;padding:10px 12px;font-size:14px;line-height:1.45}
#duel-screen .log-e{margin:2px 0}.duel-log .log-info{color:#aab6dc}.duel-log .log-gold{color:#e7c55a}.duel-log .log-dmg{color:#ff7a7a}.duel-log .log-heal{color:#6ee7a8}
#duel-screen .compose-wrap{border:1px solid #263769;border-radius:12px;background:#0d1634;padding:14px;min-height:256px}
#duel-screen .compose-title{font-size:15px;color:#d4af37;margin-bottom:9px;display:flex;justify-content:space-between;gap:10px}
#duel-screen .compose{display:flex;gap:10px;justify-content:center;align-items:flex-start}
#duel-screen .slot,#duel-screen .duel-card{width:132px;height:188px;border-radius:9px}
#duel-screen .slot{border:2px dashed #3a4b86;display:flex;align-items:center;justify-content:center;color:#596aa3;font-size:30px;background:#0b122c}
#duel-screen .slot.filled{border-style:solid;border-color:#d4af37;padding:0;overflow:hidden;cursor:pointer}
#duel-screen .duel-preview{min-height:30px;text-align:center;color:#b8c4e8;font-size:14px;margin-top:8px}
#duel-screen .duel-preview.gold{color:#e7c55a;font-weight:700}
#duel-screen .duel-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
#duel-screen .cut-btn{background:#1d2a4f;border:1px solid #3d4d88;color:#e6e9f2;padding:12px 18px;border-radius:9px;cursor:pointer;font-size:16px;font-weight:700;min-height:48px}
#duel-screen .cut-btn:hover:not(:disabled){filter:brightness(1.18)}
#duel-screen .cut-btn:disabled{opacity:.38;cursor:not-allowed}
#duel-screen .cut-btn.confirm{background:#174d32;border-color:#2ecc71}
#duel-screen .cut-btn.danger{background:#5a1f28;border-color:#e74c3c}
#duel-screen .cut-btn.gold{background:#4a3a10;border-color:#d4af37}
#duel-screen .hand-wrap{flex:1;min-height:0;display:flex;flex-direction:column;border:1px solid #263769;border-radius:12px;background:#0b122c;padding:12px}
#duel-screen .hand-title{font-size:15px;color:#d4af37;margin-bottom:9px}
#duel-screen .hand{flex:1;min-height:0;overflow-y:auto;display:flex;gap:10px;flex-wrap:wrap;align-content:flex-start;justify-content:center;padding-bottom:4px}
#duel-screen .duel-card{position:relative;background:#1a2448;border:2px solid #3d4c86;padding:8px;cursor:pointer;user-select:none;transition:transform .1s,border-color .1s,box-shadow .1s;overflow:hidden}
#duel-screen .duel-card:hover{transform:translateY(-4px)}
#duel-screen .duel-card.selected{border-color:#d4af37;box-shadow:0 0 14px rgba(212,175,55,.65)}
#duel-screen .duel-card.reversed{filter:hue-rotate(170deg) saturate(.85)}
#duel-screen .dc-icon{font-size:36px;text-align:center;line-height:1.15}
#duel-screen .dc-name{font-size:13px;text-align:center;margin-top:4px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#duel-screen .dc-skill{font-size:11px;text-align:center;margin-top:6px;color:#c9d3f0;line-height:1.4;min-height:33px}
#duel-screen .dc-type{position:absolute;left:0;right:0;bottom:5px;text-align:center;font-size:10px;color:#8494c8}
#duel-screen .dc-rank{position:absolute;top:5px;right:7px;font-size:13px;color:#d4af37;font-weight:800}
#duel-screen .type-ATTACK{border-color:#c0392b;background:#2a1420}
#duel-screen .type-THEURGY{border-color:#9b59b6;background:#251639}
#duel-screen .type-WAND{border-color:#d4af37}
#duel-screen .type-CUP{border-color:#58b7ff}
#duel-screen .type-PENTACLE{border-color:#f39c12}
#duel-screen .select-scroll{height:calc(100% - 72px);overflow-y:auto;padding:22px 58px 30px}
#duel-screen .rules{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:14px}
#duel-screen .rule-chip{font-size:13px;color:#c9d3f0;background:#13204a;border:1px solid #33427c;border-radius:999px;padding:6px 11px}
#duel-screen .arcana-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
#duel-screen .arcana-pick{background:#111a3a;border:2px solid #2a3a6e;border-radius:12px;padding:14px;text-align:center;cursor:pointer;min-height:112px;transition:border-color .1s,background .1s,transform .1s}
#duel-screen .arcana-pick:hover{transform:translateY(-2px);border-color:#6f82c6}
#duel-screen .arcana-pick.chosen{border-color:#d4af37;background:#1d2b17;box-shadow:0 0 12px rgba(212,175,55,.28)}
#duel-screen .ap-icon{font-size:31px}.duel-screen .ap-name{font-size:15px;margin-top:5px;font-weight:700}.duel-screen .ap-idx{font-size:11px;color:#e7c55a;margin-top:3px;min-height:15px}
#duel-screen .select-actions{margin-top:24px;display:flex;gap:13px;justify-content:flex-end}
#duel-screen .kill-sense{position:absolute;top:43%;left:50%;transform:translate(-50%,-50%);font-size:64px;font-weight:900;color:#ff3344;text-shadow:0 0 26px #f00,0 0 8px #fff;letter-spacing:7px;pointer-events:none;opacity:0;transition:opacity .15s;z-index:95}
#duel-screen .kill-sense.show{opacity:1;animation:killshake .48s}
@keyframes killshake{0%,100%{transform:translate(-50%,-50%)}25%{transform:translate(-50%,-58%)}75%{transform:translate(-50%,-42%)}}
#duel-screen .duel-flash{position:absolute;top:120px;left:50%;transform:translateX(-50%);font-size:38px;font-weight:900;color:#8ef5ba;text-shadow:0 0 18px #2ecc71;pointer-events:none;opacity:0;transition:opacity .25s;z-index:94}
#duel-screen .round-banner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(3,7,20,.62);opacity:0;pointer-events:none;transition:opacity .2s;z-index:92}
#duel-screen .round-banner.show{opacity:1}
#duel-screen .round-banner h2{margin:0;font-size:64px;letter-spacing:8px;color:#d4af37}
#duel-screen .round-banner p{margin:0;font-size:23px;color:#c9d3f0}
#duel-screen .overlay{position:absolute;inset:0;background:rgba(0,0,0,.86);display:flex;flex-direction:column;justify-content:center;align-items:center;gap:20px;z-index:100}
#duel-screen .overlay h1{font-size:68px;color:#d4af37;letter-spacing:8px;margin:0}
#duel-screen .overlay p{font-size:22px;color:#c9d3f0;margin:0}
#duel-screen .overlay-actions{display:flex;gap:14px}
.duel-entry-card{display:flex;align-items:center;justify-content:space-between;gap:18px;background:#111a3a;border:1px solid #d4af37;border-radius:12px;padding:16px 20px;margin-top:12px}
.duel-entry-name{font-size:18px;font-weight:800;color:#d4af37}.duel-entry-desc{font-size:13px;color:#aab6dc;margin-top:4px}.duel-enter-btn{min-width:140px}
/* ============================================================
   可读性增强：对战界面非标题文字适度放大（大标题保持原字号）
   ============================================================ */
#duel-screen .duel-hint{font-size:18px}
#duel-screen .fp-name{font-size:25px}
#duel-screen .fp-arcana{font-size:16px}
#duel-screen .fp-tag{font-size:15px;padding:6px 10px}
#duel-screen .hp-text{font-size:16px}
#duel-screen .aff-badge{font-size:12px;padding:3px 7px}
#duel-screen .duel-log{font-size:16px;line-height:1.5}
#duel-screen .compose-title{font-size:17px}
#duel-screen .duel-preview{font-size:16px}
#duel-screen .cut-btn{font-size:18px;padding:13px 20px;min-height:50px}
#duel-screen .hand-title{font-size:17px}
#duel-screen .dc-name{font-size:15px}
#duel-screen .dc-skill{font-size:13px;min-height:38px}
#duel-screen .dc-type{font-size:12px}
#duel-screen .dc-rank{font-size:15px}
#duel-screen .round-banner p{font-size:25px}
#duel-screen .overlay p{font-size:24px}
.duel-entry-name{font-size:20px}
.duel-entry-desc{font-size:15px}
/* AI 对战选择界面：按钮与字号进一步放大，增加可读性 */
#duel-screen .select-scroll{padding:28px 64px 36px}
#duel-screen .rule-chip{font-size:16px;padding:8px 14px}
#duel-screen .arcana-pick{min-height:140px;padding:18px}
#duel-screen .ap-icon{font-size:42px}
#duel-screen .ap-name{font-size:19px;margin-top:7px}
#duel-screen .ap-idx{font-size:14px;min-height:18px}
#duel-screen .select-actions{margin-top:28px;gap:16px}
#duel-screen .select-actions .cut-btn{font-size:20px;padding:14px 34px;min-height:58px;border-radius:11px}
`;

(function injectDuelCSS() {
  if (typeof document !== "undefined" && !document.getElementById("duel-style")) {
    const style = document.createElement("style");
    style.id = "duel-style";
    style.textContent = DUEL_CSS;
    document.head.appendChild(style);
  }
})();

const TYPE_LABELS = {
  [CARD_TYPE.PERSONA]: "人格面具",
  [CARD_TYPE.SWORD]: "宝剑",
  [CARD_TYPE.WAND]: "权杖",
  [CARD_TYPE.CUP]: "圣杯",
  [CARD_TYPE.PENTACLE]: "星币",
  [CARD_TYPE.THEURGY]: "神通法",
  [CARD_TYPE.ATTACK]: "攻击牌",
};

const AFFINITY_LABELS = {
  [AFFINITY.WEAK]: "弱",
  [AFFINITY.RESIST]: "耐",
  [AFFINITY.NULL]: "无",
  [AFFINITY.REPEL]: "反",
  [AFFINITY.DRAIN]: "吸",
};

export class DuelUI {
  constructor(meta, onExit) {
    this.meta = meta;
    this.onExit = onExit;
    this.selectedId = null;
    this.picked = [];
    this.duel = null;
    this.timers = new Set();
    this.buildDOM();
    this.bindResize();
    this.renderSelect();
  }

  buildDOM() {
    let el = document.getElementById("duel-screen");
    if (!el) {
      el = document.createElement("div");
      el.id = "duel-screen";
      el.className = "duel-screen hidden";
      document.body.appendChild(el);
    }
    el.innerHTML = '<div class="duel-inner" id="duel-inner"></div>';
    this.root = el;
    this.inner = el.querySelector("#duel-inner");
  }

  bindResize() {
    this.resize = () => {
      const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      this.inner.style.transform = `scale(${scale})`;
      this.inner.style.left = `${(window.innerWidth - 1920 * scale) / 2}px`;
      this.inner.style.top = `${(window.innerHeight - 1080 * scale) / 2}px`;
    };
    window.addEventListener("resize", this.resize);
  }

  setTimeout(fn, ms) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  clearTimers() {
    this.timers.forEach(id => clearTimeout(id));
    this.timers.clear();
  }

  show() {
    this.root.classList.remove("hidden");
    this.resize();
  }

  hide() {
    this.root.classList.add("hidden");
  }

  reset() {
    if (this.duel) this.duel.destroy();
    this.clearTimers();
    this.duel = null;
    this.selectedId = null;
    this.picked = [];
    this.renderSelect();
  }

  exitToHub() {
    if (this.duel) this.duel.destroy();
    this.clearTimers();
    this.duel = null;
    this.hide();
    if (this.onExit) this.onExit();
  }

  esc(text) {
    return String(text ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  renderSelect() {
    if (this.duel) this.duel.destroy();
    this.clearTimers();
    this.duel = null;
    this.inner.innerHTML = `
      <div class="duel-header">
        <div class="duel-title">AI 对 战 · 塔罗决斗</div>
        <div class="duel-hint">三局两胜 · 按选择顺序依次出战 · AI 将随机选择 3 个阵营</div>
      </div>
      <div class="select-scroll">
        <div class="rules">
          <span class="rule-chip">通关关卡 5 后开放</span>
          <span class="rule-chip">固定环境：构筑需多一张</span>
          <span class="rule-chip">固定难度：Lv.5</span>
          <span class="rule-chip">局外养成属性无效，阵营特性以基础等级生效</span>
          <span class="rule-chip">弱点击破：固定获得权杖 + ¥${WEAK_REWARD_MONEY}</span>
          <span class="rule-chip">护盾：${Math.round(BASE_HP * SHIELD_HP_COST_PCT)} HP / 次，每局限购 2 次</span>
          <span class="rule-chip">伤害与倒地在回合结束统一结算</span>
        </div>
        <div id="duel-select-info" style="font-size:25px;color:#d4af37;margin-bottom:18px;font-weight:800"></div>
        <div class="arcana-grid" id="duel-arcana-grid"></div>
        <div class="select-actions">
          <button class="cut-btn" id="duel-clear">清空选择</button>
          <button class="cut-btn confirm" id="duel-start" disabled>开始对战</button>
          <button class="cut-btn" id="duel-exit">返回 Hub</button>
        </div>
      </div>
    `;

    const grid = this.inner.querySelector("#duel-arcana-grid");
    ARCANA_LIST.forEach(key => {
      const arcana = ARCANA[key];
      const el = document.createElement("div");
      el.className = "arcana-pick";
      el.dataset.key = key;
      el.innerHTML = `
        <div class="ap-icon">${arcana.icon}</div>
        <div class="ap-name">${this.esc(arcana.name)}</div>
        <div class="ap-idx" data-idx></div>
      `;
      el.onclick = () => this.togglePick(key);
      grid.appendChild(el);
    });

    this.inner.querySelector("#duel-clear").onclick = () => {
      this.picked = [];
      this.renderPickState();
    };
    this.inner.querySelector("#duel-start").onclick = () => this.startBattle();
    this.inner.querySelector("#duel-exit").onclick = () => this.exitToHub();
    this.renderPickState();
  }

  togglePick(key) {
    const idx = this.picked.indexOf(key);
    if (idx >= 0) {
      this.picked.splice(idx, 1);
    } else if (this.picked.length < 3) {
      this.picked.push(key);
    }
    this.renderPickState();
  }

  renderPickState() {
    const info = this.inner.querySelector("#duel-select-info");
    info.textContent = `已选 ${this.picked.length} / 3 —— ${
      this.picked.length ? "选择顺序即第 1、2、3 局出战顺序" : "请选择第 1 个出战阵营"
    }`;
    this.inner.querySelectorAll(".arcana-pick").forEach(el => {
      const idx = this.picked.indexOf(el.dataset.key);
      el.classList.toggle("chosen", idx >= 0);
      el.querySelector("[data-idx]").textContent = idx >= 0 ? `第 ${idx + 1} 局` : "";
    });
    this.inner.querySelector("#duel-start").disabled = this.picked.length !== 3;
  }

  startBattle() {
    if (this.picked.length !== 3) return;
    if (this.duel) this.duel.destroy();
    this.clearTimers();
    this.selectedId = null;

    const duel = new Duel(this.meta, this.picked);
    this.duel = duel;
    duel.on((type, data) => this.handleEvent(type, data));
    this.renderBattleShell();
    duel.startMatch();
  }

  handleEvent(type, data) {
    switch (type) {
      case "state":
        this.renderAll();
        break;
      case "log":
        this.renderLog();
        break;
      case "queued":
        if (data.source === this.duel.player) this.showFlash("伤害已蓄住：结束回合时结算");
        break;
      case "killSense":
        this.showKillSense();
        break;
      case "roundStart":
        this.hideRoundBanner();
        this.renderAll();
        break;
      case "roundEnd":
        this.renderAll();
        this.onRoundEnd(data);
        break;
      case "matchEnd":
        this.onMatchEnd(data);
        break;
      case "shieldBlock":
        this.showFlash("🛡 护盾挡下攻击");
        this.renderAll();
        break;
      default:
        break;
    }
  }

  renderBattleShell() {
    this.inner.innerHTML = `
      <div class="duel-header">
        <div class="duel-title">AI 对 战</div>
        <div class="duel-hint" id="duel-round-tag"></div>
        <button class="cut-btn danger" id="duel-giveup">放弃本场</button>
      </div>
      <div class="duel-body">
        <div class="duel-left">
          <div id="duel-ai-panel"></div>
          <div id="duel-player-panel"></div>
          <div class="duel-log" id="duel-log"></div>
        </div>
        <div class="duel-mid">
          <div class="compose-wrap">
            <div class="compose-title">
              <span>构筑区（固定环境：至少 2 张）</span>
              <span id="duel-pending-count"></span>
            </div>
            <div class="compose" id="duel-compose"></div>
            <div class="duel-preview" id="duel-preview"></div>
          </div>
          <div class="duel-actions" id="duel-actions"></div>
          <div class="hand-wrap">
            <div class="hand-title">玩家手牌（点击选中，再点一次使用 / 入构筑）</div>
            <div class="hand" id="duel-hand"></div>
          </div>
        </div>
      </div>
      <div class="kill-sense" id="kill-sense">⚠ 杀意感知</div>
      <div class="duel-flash" id="duel-flash"></div>
      <div class="round-banner" id="duel-round-banner"><h2></h2><p></p></div>
      <div id="duel-overlay"></div>
    `;
    this.inner.querySelector("#duel-giveup").onclick = () => this.exitToHub();
  }

  arcanaSchedule(keys, activeIndex) {
    return keys.map((key, i) => {
      const arcana = ARCANA[key];
      return `<span style="${i === activeIndex ? "color:#d4af37;font-weight:900" : ""}">${arcana.icon}${this.esc(arcana.name)}</span>`;
    }).join(" → ");
  }

  renderRoundTag() {
    const d = this.duel;
    const el = this.inner.querySelector("#duel-round-tag");
    if (!el || !d) return;
    el.innerHTML = `
      第 ${d.round + 1} 局　比分 ${d.playerWins}:${d.aiWins}　
      你［${this.arcanaSchedule(d.playerKeys, d.round)}］　
      AI［${this.arcanaSchedule(d.aiKeys, d.round)}］
    `;
  }

  fighterPanelHTML(f, isAI) {
    const hpPct = Math.max(0, Math.min(100, f.hp / f.maxHp * 100));
    const tags = isAI ? `
      <div class="fp-tags">
        <span class="fp-tag">手牌 ${f.hand.length}</span>
        ${f.shield ? '<span class="fp-tag shield">🛡 护盾</span>' : ""}
        ${f.is_knocked_down ? '<span class="fp-tag down">DOWN</span>' : ""}
      </div>
    ` : `
      <div class="fp-tags">
        <span class="fp-tag">¥${f.money}</span>
        <span class="fp-tag">牌堆 Lv.${f.deckLevel}</span>
        <span class="fp-tag">手牌 ${f.hand.length}/${f.handLimit}</span>
        <span class="fp-tag">神通 ${f.theurgyUses}/${f.theurgyMax}</span>
        ${f.shield ? '<span class="fp-tag shield">🛡 护盾</span>' : ""}
        ${f.is_knocked_down ? '<span class="fp-tag down">DOWN</span>' : ""}
      </div>
    `;

    const affinities = isAI ? "" : this.affinityHTML(f);
    const theurgy = isAI ? "" : `
      <div class="theurgy-track"><div class="theurgy-fill" style="width:${f.theurgy}%"></div></div>
      <div class="hp-text">${f.pendingTheurgyId ? "神通法卡待入手牌空位" : `神通法槽 ${f.theurgy}%`}</div>
    `;

    return `
      <div class="fighter-panel ${isAI ? "enemy" : "self"}">
        <div class="fp-head">
          <span class="fp-icon">${f.icon}</span>
          <span class="fp-name">${this.esc(f.name)}</span>
          <span class="fp-arcana">${f.arcana.icon} ${this.esc(f.arcana.name)}</span>
          ${tags}
        </div>
        <div class="hbar"><div class="hbar-fill ${hpPct < 30 ? "low" : ""}" style="width:${hpPct}%"></div></div>
        <div class="hp-text">HP ${f.hp} / ${f.maxHp}</div>
        ${theurgy}
        ${affinities}
      </div>
    `;
  }

  affinityHTML(f) {
    const entries = Object.entries(f.affinities || {})
      .filter(([, affinity]) => affinity !== AFFINITY.NORMAL);
    if (!entries.length) return "";
    return `
      <div class="aff-row">
        ${entries.map(([element, affinity]) => `
          <span class="aff-badge aff-${affinity}">
            ${ELEMENT_INFO[element]?.icon || ""}${AFFINITY_LABELS[affinity] || affinity}
          </span>
        `).join("")}
      </div>
    `;
  }

  renderAll() {
    if (!this.duel || !this.inner.querySelector("#duel-ai-panel")) return;
    this.renderRoundTag();
    this.renderFighters();
    this.renderHand();
    this.renderButtons();
  }

  renderFighters() {
    const d = this.duel;
    const aiEl = this.inner.querySelector("#duel-ai-panel");
    const playerEl = this.inner.querySelector("#duel-player-panel");
    if (aiEl) aiEl.innerHTML = this.fighterPanelHTML(d.ai, true);
    if (playerEl) playerEl.innerHTML = this.fighterPanelHTML(d.player, false);
    this.renderLog();
  }

  renderLog() {
    if (!this.duel) return;
    const el = this.inner.querySelector("#duel-log");
    if (!el) return;
    el.innerHTML = this.duel.logs
      .map(item => `<div class="log-e log-${item.cls}">${this.esc(item.msg)}</div>`)
      .join("");
    el.scrollTop = el.scrollHeight;
  }

  renderButtons() {
    const d = this.duel;
    const bar = this.inner.querySelector("#duel-actions");
    if (!bar) return;

    const canAct = d.state === "PLAYER_ACTION";
    const f = d.player;
    const shieldCost = Math.round(f.maxHp * SHIELD_HP_COST_PCT);
    const shieldDisabled = !canAct ||
      f.shield ||
      f.shieldCount >= SHIELD_MAX_PER_ROUND ||
      f.hp <= shieldCost;

    let stateText = "你的行动";
    if (d.state === "AI_ACTION") stateText = "AI 行动中……";
    else if (d.state === "AI_DOWN") stateText = "AI 倒地，跳过行动";
    else if (d.state === "PLAYER_DOWN") stateText = "你已倒地，跳过行动";
    else if (d.state === "RESOLVING") stateText = "正在结算回合伤害";
    else if (d.state === "ROUND_END") stateText = "本局结束";

    const upCost = f.deckLevel >= 5 ? 0 : (DUEL_UPGRADE_COSTS[f.deckLevel - 1] || 99999);
    const upDisabled = !canAct || upCost <= 0 || f.money < upCost;

    bar.innerHTML = `
      <span class="fp-tag" style="align-self:center;font-size:16px;padding:8px 12px">${stateText}</span>
      <button class="cut-btn" id="d-draw" ${canAct ? "" : "disabled"}>抽牌 ¥${f.drawCost}</button>
      <button class="cut-btn" id="d-flip" ${canAct ? "" : "disabled"}>翻转选中牌</button>
      <button class="cut-btn confirm" id="d-confirm" ${canAct && f.composeSlots.length >= 2 ? "" : "disabled"}>合成攻击牌</button>
      <button class="cut-btn" id="d-clear" ${canAct && f.composeSlots.length ? "" : "disabled"}>清空构筑</button>
      <button class="cut-btn" id="d-upgrade" ${upDisabled ? "disabled" : ""}>牌库升级 ${f.deckLevel >= 5 ? "MAX" : "¥" + upCost}</button>
      <button class="cut-btn gold" id="d-shield" ${shieldDisabled ? "disabled" : ""}>护盾 -${shieldCost}HP（${f.shieldCount}/${SHIELD_MAX_PER_ROUND}）</button>
      <button class="cut-btn danger" id="d-end" ${canAct ? "" : "disabled"}>结束回合 / 结算伤害</button>
    `;

    bar.querySelector("#d-draw").onclick = () => d.buyDraw();
    bar.querySelector("#d-flip").onclick = () => this.tryFlip();
    bar.querySelector("#d-confirm").onclick = () => d.confirmCompose();
    bar.querySelector("#d-clear").onclick = () => d.clearCompose();
    bar.querySelector("#d-upgrade").onclick = () => d.upgradeDeck(d.player);
    bar.querySelector("#d-shield").onclick = () => d.buyShield();
    bar.querySelector("#d-end").onclick = () => d.endTurn();
  }

  tryFlip() {
    if (!this.selectedId) {
      this.duel.log("请先选中一张人格面具牌", "info");
      return;
    }
    this.duel.flipCard(this.selectedId);
  }

  renderHand() {
    const d = this.duel;
    const composeEl = this.inner.querySelector("#duel-compose");
    const handEl = this.inner.querySelector("#duel-hand");
    const previewEl = this.inner.querySelector("#duel-preview");
    const pendingEl = this.inner.querySelector("#duel-pending-count");
    if (!composeEl || !handEl) return;

    composeEl.innerHTML = "";
    for (let i = 0; i < MAX_COMPOSE_SLOTS; i++) {
      const slot = document.createElement("div");
      const card = d.player.composeSlots[i];
      slot.className = `slot${card ? " filled" : ""}`;
      if (card) {
        slot.innerHTML = this.cardInnerHTML(card);
        slot.onclick = () => d.removeFromCompose(i);
      } else {
        slot.innerHTML = "<span>+</span>";
      }
      composeEl.appendChild(slot);
    }

    if (previewEl) {
      if (d.player.composeSlots.length === 0) {
        previewEl.textContent = "将人格面具或宝剑放入构筑区";
        previewEl.classList.remove("gold");
      } else if (d.player.composeSlots.length < 2) {
        previewEl.textContent = `还需 ${2 - d.player.composeSlots.length} 张牌才能构筑`;
        previewEl.classList.remove("gold");
      } else {
        const skill = composeSkill(d.player.composeSlots);
        const info = ELEMENT_INFO[skill.element] || { icon: "?", name: "?" };
        previewEl.textContent = `${info.icon} ${info.name} · ${POWER_INFO[skill.power]?.label || skill.power} · ${skill.range === RANGE.ALL ? "全体" : "单体"}`;
        previewEl.classList.add("gold");
      }
    }

    if (pendingEl) {
      const count = d.pending.filter(entry => entry.source === d.player).length;
      pendingEl.textContent = count ? `已蓄住攻击 ${count} 次` : "";
    }

    handEl.innerHTML = "";
    d.player.hand.forEach(card => {
      const el = document.createElement("div");
      el.className = this.cardClassNames(card);
      if (this.selectedId === card.id) el.classList.add("selected");
      el.innerHTML = this.cardInnerHTML(card);
      el.onclick = () => this.onCardClick(card);
      handEl.appendChild(el);
    });
  }

  cardClassNames(card) {
    return [
      "duel-card",
      `type-${card.type}`,
      card.type === CARD_TYPE.PERSONA && card.is_reversed ? "reversed" : "",
    ].filter(Boolean).join(" ");
  }

  cardInnerHTML(card) {
    const skill = getActiveSkill(card);
    let skillHtml = "";
    if (card.type === CARD_TYPE.PERSONA) {
      const active = card.is_reversed ? card.skill_reversed : card.skill_upright;
      const info = ELEMENT_INFO[active.element] || { icon: "?" };
      skillHtml = `<div class="dc-skill">${card.is_reversed ? "▼" : "▲"} ${info.icon} ${POWER_INFO[active.power]?.label || ""}</div>`;
    } else if (skill) {
      const info = ELEMENT_INFO[skill.element] || { icon: "?", name: "" };
      skillHtml = `<div class="dc-skill">${info.icon} ${this.esc(skill.name || info.name)}<br>${POWER_INFO[skill.power]?.label || ""}</div>`;
    } else if (card.desc) {
      skillHtml = `<div class="dc-skill">${this.esc(card.desc)}</div>`;
    }

    const rank = card.rank
      ? `<span class="dc-rank">${["", "C", "B", "A", "S"][card.rank] || ""}</span>`
      : "";

    return `
      ${rank}
      <div class="dc-icon">${card.icon}</div>
      <div class="dc-name">${this.esc(card.name)}</div>
      ${skillHtml}
      <div class="dc-type">${TYPE_LABELS[card.type] || card.type}</div>
    `;
  }

  onCardClick(card) {
    if (this.selectedId === card.id) {
      const id = card.id;
      this.selectedId = null;
      this.duel.useCard(id);
    } else {
      this.selectedId = card.id;
      this.renderHand();
    }
  }

  showKillSense() {
    const el = this.inner.querySelector("#kill-sense");
    if (!el) return;
    el.classList.add("show");
    const oldId = el.dataset.timerId;
    if (oldId) {
      clearTimeout(Number(oldId));
      this.timers.delete(Number(oldId));
    }
    const id = this.setTimeout(() => el.classList.remove("show"), 1700);
    el.dataset.timerId = String(id);
  }

  showFlash(text) {
    const el = this.inner.querySelector("#duel-flash");
    if (!el) return;
    el.textContent = text;
    el.style.opacity = "1";
    const id = this.setTimeout(() => {
      el.style.opacity = "0";
    }, 1100);
    el.dataset.flashTimerId = String(id);
  }

  showRoundBanner(title, sub) {
    const el = this.inner.querySelector("#duel-round-banner");
    if (!el) return;
    el.querySelector("h2").textContent = title;
    el.querySelector("p").textContent = sub;
    el.classList.add("show");
  }

  hideRoundBanner() {
    const el = this.inner.querySelector("#duel-round-banner");
    if (el) el.classList.remove("show");
  }

  onRoundEnd(data) {
    const d = this.duel;
    if (d.playerWins >= 2 || d.aiWins >= 2) return;
    const nextRound = data.round + 1;
    const p = ARCANA[d.playerKeys[nextRound]];
    const ai = ARCANA[d.aiKeys[nextRound]];
    this.showRoundBanner(
      data.playerWin ? "本 局 胜 利" : "本 局 败 北",
      `下一局：${p.icon}${p.name} vs ${ai.icon}${ai.name}`
    );
    this.setTimeout(() => d.goToNextRound(), 1700);
  }

  onMatchEnd(data) {
    const d = this.duel;
    const over = this.inner.querySelector("#duel-overlay");
    if (!over) return;
    over.innerHTML = `
      <div class="overlay">
        <h1>${data.playerWin ? "胜 利" : "败 北"}</h1>
        <p>最终比分：你 ${d.playerWins} : ${d.aiWins} AI</p>
        <div class="overlay-actions">
          <button class="cut-btn confirm" id="d-rematch-same">同阵营再战</button>
          <button class="cut-btn gold" id="d-rematch-new">更换阵营</button>
          <button class="cut-btn" id="d-tohub">返回 Hub</button>
        </div>
      </div>
    `;
    over.querySelector("#d-rematch-same").onclick = () => this.startBattle();
    over.querySelector("#d-rematch-new").onclick = () => this.renderSelect();
    over.querySelector("#d-tohub").onclick = () => this.exitToHub();
  }
}

export function startDuel(meta, onExit) {
  if (!meta || !meta.isStageCleared(5)) return null;

  let ui = window.__duelUI;
  if (!ui) {
    ui = new DuelUI(meta, onExit);
    window.__duelUI = ui;
  } else {
    ui.meta = meta;
    ui.onExit = onExit;
  }
  ui.reset();
  ui.show();
  return ui;
}
