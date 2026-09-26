// ============================================================
// 游戏数据定义：阿尔卡那阵营、人格面具卡、敌人
// ============================================================

// 属性枚举
export const ELEMENT = {
  PHYSICAL: "PHYSICAL",
  FIRE: "FIRE",
  ICE: "ICE",
  WIND: "WIND",
  ELEC: "ELEC",
  BLESS: "BLESS",
  CURSE: "CURSE",
  ALMIGHTY: "ALMIGHTY",
  HEAL: "HEAL",
  SUPPORT: "SUPPORT",
};

export const ELEMENT_INFO = {
  PHYSICAL: { name: "物理", icon: "⚔", color: "#e0e0e0" },
  FIRE: { name: "火焰", icon: "🔥", color: "#ff5722" },
  ICE: { name: "冰冻", icon: "❄", color: "#4fc3f7" },
  WIND: { name: "疾风", icon: "💨", color: "#81c784" },
  ELEC: { name: "电击", icon: "⚡", color: "#ffeb3b" },
  BLESS: { name: "祝福", icon: "✨", color: "#fff59d" },
  CURSE: { name: "咒怨", icon: "💀", color: "#b39ddb" },
  ALMIGHTY: { name: "万能", icon: "🌟", color: "#d4af37" },
  HEAL: { name: "恢复", icon: "💚", color: "#00a86b" },
  SUPPORT: { name: "辅助", icon: "🛡", color: "#ce93d8" },
};

// 力度阶数
export const POWER = { SM: 1, MD: 2, LG: 3, HV: 4, XH: 5 };
export const POWER_INFO = {
  1: { name: "SMALL", label: "SM" },
  2: { name: "MEDIUM", label: "MD" },
  3: { name: "LARGE", label: "LG" },
  4: { name: "HEAVY", label: "HV" },
  5: { name: "COLOSSAL", label: "XH" },
};
export const POWER_MULTIPLIER = { 1: 0.5, 2: 1.0, 3: 1.8, 4: 2.8, 5: 4.0 };

export const RANGE = { SINGLE: "SINGLE", ALL: "ALL" };

// 相性
export const AFFINITY = {
  WEAK: "WEAK", NORMAL: "NORMAL", RESIST: "RESIST",
  NULL: "NULL", REPEL: "REPEL", DRAIN: "DRAIN",
};
export const AFFINITY_MULTIPLIER = {
  WEAK: 1.5, NORMAL: 1.0, RESIST: 0.5, NULL: 0, REPEL: -1, DRAIN: -2,
};

// 卡牌类型
export const CARD_TYPE = {
  PERSONA: "PERSONA", SWORD: "SWORD",
  WAND: "WAND", CUP: "CUP", PENTACLE: "PENTACLE",
  THEURGY: "THEURGY", ALL_OUT: "ALL_OUT",
};

// 等阶
export const RANK = { C: 1, B: 2, A: 3, S: 4 };
export const RANK_LABEL = { 1: "C", 2: "B", 3: "A", 4: "S" };

let _cardId = 0;
export const nextId = (p = "c") => `${p}_${++_cardId}`;

// ============================================================
// 阿尔卡那阵营
// ============================================================
export const ARCANA = {
  FOOL: {
    id: "FOOL", name: "愚者",
    bonus: "每回合首次构筑技能力度+1阶",
    persona_pool: ["orpheus", "slime", "ghost_brigade"],
  },
  MAGICIAN: {
    id: "MAGICIAN", name: "魔术师",
    bonus: "火焰属性伤害+20%",
    persona_pool: ["jack_frost", "jack_o_lantern", "nekomata", "hua_po"],
  },
  LOVERS: {
    id: "LOVERS", name: "恋爱",
    bonus: "恢复技能效果+30%",
    persona_pool: ["pixie", "sylph"],
  },
};

// ============================================================
// 人格面具技能库
// ============================================================
export const SKILLS = {
  // 物理
  cleave: { name: " Cleave", element: ELEMENT.PHYSICAL, power: POWER.MD, range: RANGE.SINGLE },
  mighty_swing: { name: "Mighty Swing", element: ELEMENT.PHYSICAL, power: POWER.LG, range: RANGE.SINGLE },
  fatal_end: { name: "Fatal End", element: ELEMENT.PHYSICAL, power: POWER.HV, range: RANGE.SINGLE },
  blade_of_fury: { name: "Blade of Fury", element: ELEMENT.PHYSICAL, power: POWER.LG, range: RANGE.ALL },
  // 火焰
  agi: { name: "Agi", element: ELEMENT.FIRE, power: POWER.SM, range: RANGE.SINGLE },
  agilao: { name: "Agilao", element: ELEMENT.FIRE, power: POWER.MD, range: RANGE.SINGLE },
  agidyne: { name: "Agidyne", element: ELEMENT.FIRE, power: POWER.LG, range: RANGE.SINGLE },
  maragi: { name: "Maragi", element: ELEMENT.FIRE, power: POWER.SM, range: RANGE.ALL },
  // 冰冻
  bufu: { name: "Bufu", element: ELEMENT.ICE, power: POWER.SM, range: RANGE.SINGLE },
  mabufu: { name: "Mabufu", element: ELEMENT.ICE, power: POWER.SM, range: RANGE.ALL },
  // 疾风
  garu: { name: "Garu", element: ELEMENT.WIND, power: POWER.SM, range: RANGE.SINGLE },
  magaru: { name: "Magaru", element: ELEMENT.WIND, power: POWER.SM, range: RANGE.ALL },
  // 电击
  zio: { name: "Zio", element: ELEMENT.ELEC, power: POWER.SM, range: RANGE.SINGLE },
  mazio: { name: "Mazio", element: ELEMENT.ELEC, power: POWER.SM, range: RANGE.ALL },
  // 祝福
  hama: { name: "Hama", element: ELEMENT.BLESS, power: POWER.SM, range: RANGE.SINGLE },
  // 咒怨
  mudo: { name: "Mudo", element: ELEMENT.CURSE, power: POWER.SM, range: RANGE.SINGLE },
  // 万能
  megido: { name: "Megido", element: ELEMENT.ALMIGHTY, power: POWER.MD, range: RANGE.ALL },
  // 恢复
  dia: { name: "Dia", element: ELEMENT.HEAL, power: POWER.SM, range: RANGE.SINGLE },
  media: { name: "Media", element: ELEMENT.HEAL, power: POWER.MD, range: RANGE.ALL },
};

// ============================================================
// 人格面具卡定义（基础卡牌池）
// ============================================================
export const PERSONAS = {
  orpheus: {
    name: "俄耳甫斯", arcana: "FOOL", rank: RANK.B, icon: "🎵",
    upright: SKILLS.cleave, reversed: SKILLS.agi,
  },
  slime: {
    name: "软泥怪", arcana: "FOOL", rank: RANK.C, icon: "🟢",
    upright: SKILLS.cleave, reversed: SKILLS.bufu,
  },
  ghost_brigade: {
    name: "恶灵军团", arcana: "FOOL", rank: RANK.C, icon: "👻",
    upright: SKILLS.mudo, reversed: SKILLS.cleave,
  },
  jack_frost: {
    name: "杰克霜精", arcana: "MAGICIAN", rank: RANK.C, icon: "⛄",
    upright: SKILLS.bufu, reversed: SKILLS.dia,
  },
  jack_o_lantern: {
    name: "杰克灯笼", arcana: "MAGICIAN", rank: RANK.C, icon: "🎃",
    upright: SKILLS.agi, reversed: SKILLS.maragi,
  },
  nekomata: {
    name: "猫又", arcana: "MAGICIAN", rank: RANK.C, icon: "🐱",
    upright: SKILLS.agilao, reversed: SKILLS.cleave,
  },
  hua_po: {
    name: "花魄", arcana: "MAGICIAN", rank: RANK.C, icon: "🌸",
    upright: SKILLS.maragi, reversed: SKILLS.dia,
  },
  pyro_jack: {
    name: "火焰杰克", arcana: "MAGICIAN", rank: RANK.B, icon: "🔥",
    upright: SKILLS.agi, reversed: SKILLS.maragi,
  },
  pixie: {
    name: "皮克西", arcana: "LOVERS", rank: RANK.C, icon: "🧚",
    upright: SKILLS.dia, reversed: SKILLS.garu,
  },
  sylph: {
    name: "希路奇", arcana: "LOVERS", rank: RANK.B, icon: "🌪",
    upright: SKILLS.garu, reversed: SKILLS.magaru,
  },
  // 高阶卡
  high_pixie: {
    name: "高阶皮克西", arcana: "LOVERS", rank: RANK.A, icon: "✨",
    upright: SKILLS.media, reversed: SKILLS.magaru,
  },
  orpheus_tel: {
    name: "俄耳甫斯·改", arcana: "FOOL", rank: RANK.A, icon: "🎶",
    upright: SKILLS.mighty_swing, reversed: SKILLS.agilao,
  },
  // 神通法卡池
  theurgy_maragi: { name: "神通·玛拉基", icon: "🌋", skill: { name: "Theurgy Maragi", element: ELEMENT.FIRE, power: POWER.HV, range: RANGE.ALL } },
  theurgy_mabufu: { name: "神通·玛布芙", icon: "❄", skill: { name: "Theurgy Mabufu", element: ELEMENT.ICE, power: POWER.HV, range: RANGE.ALL } },
  theurgy_mazio: { name: "神通·玛齐奥", icon: "⚡", skill: { name: "Theurgy Mazio", element: ELEMENT.ELEC, power: POWER.HV, range: RANGE.ALL } },
  theurgy_media: { name: "神通·梅迪亚", icon: "💚", skill: { name: "Theurgy Media", element: ELEMENT.HEAL, power: POWER.HV, range: RANGE.ALL } },
};

// ============================================================
// 小阿尔卡那 / 宝剑卡
// ============================================================
export const MINOR_CARDS = {
  wand: { type: CARD_TYPE.WAND, name: "权杖", icon: "🪄", desc: "获得一张高阶卡牌" },
  cup: { type: CARD_TYPE.CUP, name: "圣杯", icon: "🏆", desc: "本回合最终伤害 +50%" },
  pentacle: { type: CARD_TYPE.PENTACLE, name: "星币", icon: "🪙", desc: "获得资金" },
  sword_sm: { type: CARD_TYPE.SWORD, name: "宝剑·小", icon: "🗡", skill: { name: "Sword SM", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE } },
  sword_md: { type: CARD_TYPE.SWORD, name: "宝剑·中", icon: "⚔", skill: { name: "Sword MD", element: ELEMENT.PHYSICAL, power: POWER.MD, range: RANGE.SINGLE } },
};

// ============================================================
// 敌人定义
// ============================================================
export const ENEMIES = {
  cowardly_maya: {
    name: "怯懦的玛雅", icon: "🗿", level: 3, hp: 180,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.NORMAL, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.WEAK, ALMIGHTY: AFFINITY.NORMAL },
    skills: [{ name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE }],
    attack: 18,
  },
  crying_table: {
    name: "哭泣的桌子", icon: "🪑", level: 4, hp: 220,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.WEAK, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.NORMAL, ALMIGHTY: AFFINITY.NORMAL },
    skills: [{ name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE }],
    attack: 20,
  },
  slime_shadow: {
    name: "暗影软泥", icon: "🟣", level: 5, hp: 120,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.WEAK, ICE: AFFINITY.RESIST, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.NORMAL, ALMIGHTY: AFFINITY.NORMAL },
    skills: [{ name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE }],
    attack: 18,
  },
  maya: {
    name: "玛雅", icon: "🗿", level: 8, hp: 180,
    affinities: { PHYSICAL: AFFINITY.RESIST, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.WEAK, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.NORMAL, ALMIGHTY: AFFINITY.NORMAL },
    skills: [
      { name: "Bufu", element: ELEMENT.ICE, power: POWER.SM, range: RANGE.SINGLE },
      { name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE },
    ],
    attack: 22,
  },
  fang_of_desire: {
    name: "欲望之牙", icon: "🦷", level: 10, hp: 220,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.NORMAL, WIND: AFFINITY.WEAK, ELEC: AFFINITY.RESIST, ALMIGHTY: AFFINITY.NORMAL },
    skills: [
      { name: "Garu", element: ELEMENT.WIND, power: POWER.SM, range: RANGE.SINGLE },
      { name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.MD, range: RANGE.SINGLE },
    ],
    attack: 25,
  },
  dancing_hand: {
    name: "舞动之手", icon: "✋", level: 12, hp: 160,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.NORMAL, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.WEAK, ALMIGHTY: AFFINITY.NORMAL },
    skills: [
      { name: "Zio", element: ELEMENT.ELEC, power: POWER.SM, range: RANGE.SINGLE },
      { name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE },
    ],
    attack: 28,
  },
  // Boss
  reaper: {
    name: "死神", icon: "💀", level: 20, hp: 800,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.NORMAL, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.NORMAL, ALMIGHTY: AFFINITY.NORMAL, BLESS: AFFINITY.WEAK, CURSE: AFFINITY.DRAIN },
    skills: [
      { name: "Megido", element: ELEMENT.ALMIGHTY, power: POWER.MD, range: RANGE.ALL },
      { name: "Fatal End", element: ELEMENT.PHYSICAL, power: POWER.LG, range: RANGE.SINGLE },
      { name: "Mudo", element: ELEMENT.CURSE, power: POWER.MD, range: RANGE.SINGLE },
    ],
    attack: 40,
  },
};

// ============================================================
// 关卡配置
// ============================================================
export const STAGES = [
  { id: 1, name: "第一章：暗影领域", enemies: ["cowardly_maya", "crying_table"], reward: { exp: 50, money: 300 } },
  { id: 2, name: "第二章：扭曲迷宫", enemies: ["maya", "fang_of_desire", "dancing_hand"], reward: { exp: 80, money: 500 } },
  { id: 3, name: "BOSS：死神降临", enemies: ["reaper"], reward: { exp: 200, money: 1500 } },
];
