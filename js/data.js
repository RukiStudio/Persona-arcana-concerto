// ============================================================
// 游戏数据定义：阿尔卡那阵营、人格面具卡、敌人
// 含局外养成系统：人格面具图鉴、合体系统、经验曲线、商店
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
export const POWER = { SM: 1, MD: 2, LG: 3, HV: 4, XH: 5, UL: 6 };
export const POWER_INFO = {
  1: { name: "SMALL", label: "SM" },
  2: { name: "MEDIUM", label: "MD" },
  3: { name: "LARGE", label: "LG" },
  4: { name: "HEAVY", label: "HV" },
  5: { name: "COLOSSAL", label: "XH" },
  6: { name: "ULTRA", label: "UL" },
};
// 难度压缩：玩家技能力度系数整体下调
export const POWER_MULTIPLIER = { 1: 0.4, 2: 0.8, 3: 1.4, 4: 2.2, 5: 3.2, 6: 4.5 };

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
export const RANK_INFO = {
  1: { name: "COMMON", label: "C" },
  2: { name: "UNCOMMON", label: "B" },
  3: { name: "RARE", label: "A" },
  4: { name: "LEGENDARY", label: "S" },
};

let _cardId = 0;
export const nextId = (p = "c") => `${p}_${++_cardId}`;

// ============================================================
// 阿尔卡那阵营（扩展：3 → 15 种）
// ============================================================
// 阵营特性分 3 级（Lv.1 初始削弱 / Lv.2 / Lv.3 强化），用精魄升级
export const ARCANA = {
  FOOL: {
    id: "FOOL", name: "愚者", icon: "🃏",
    bonusLevels: ["首次构筑+1阶", "首次2次构筑+1阶", "所有构筑+1阶"],
    bonusKey: "FOOL_FIRST",
    persona_pool: ["orpheus", "slime", "ghost_brigade", "arsene", "izanagi"],
  },
  MAGICIAN: {
    id: "MAGICIAN", name: "魔术师", icon: "🪄",
    bonusLevels: ["火焰+10%", "火焰+20%且+1阶", "火焰+30%且+1阶且范围转ALL"],
    bonusKey: "FIRE_DMG",
    persona_pool: ["jack_frost", "jack_o_lantern", "nekomata", "hua_po", "pyro_jack", "hermes", "zorro"],
  },
  LOVERS: {
    id: "LOVERS", name: "恋爱", icon: "💞",
    bonusLevels: ["恢复+10%", "恢复+20%", "恢复+30%"],
    bonusKey: "HEAL_UP",
    persona_pool: ["pixie", "sylph", "io", "is_is", "carmen", "tam_lin", "narcissus"],
  },
  PRIESTESS: {
    id: "PRIESTESS", name: "女教皇", icon: "🌙",
    bonusLevels: ["首张手牌力度+1", "首张手牌力度+2", "首张手牌力度+2且首张免费"],
    bonusKey: "FIRST_CARD_UP",
    persona_pool: ["juno", "apsaras", "unicorn", "sarasvati", "skadi"],
  },
  EMPRESS: {
    id: "EMPRESS", name: "女皇", icon: "👑",
    bonusLevels: ["圣杯+50%", "圣杯效果翻倍", "圣杯+150%"],
    bonusKey: "CUP_DOUBLE",
    persona_pool: ["artemisia", "penthesilea", "leanan_sidhe", "yaksini", "hariti"],
  },
  EMPEROR: {
    id: "EMPEROR", name: "皇帝", icon: "⚡",
    bonusLevels: ["电击+10%", "电击+20%且+1阶", "电击+30%且+1阶且范围转ALL"],
    bonusKey: "ELEC_DMG",
    persona_pool: ["polydeuces", "oberon", "take_mikazuchi", "ose", "thor"],
  },
  HIEROPHANT: {
    id: "HIEROPHANT", name: "教皇", icon: "⛪",
    bonusLevels: ["+¥30/回合", "+¥60/回合", "+¥80/回合且起手+¥100"],
    bonusKey: "EXTRA_INCOME",
    persona_pool: ["berith", "shiisaa", "mokoi", "anubis", "mot"],
  },
  CHARIOT: {
    id: "CHARIOT", name: "战车", icon: "🛡",
    bonusLevels: ["物理+5%", "物理+10%", "物理+15%"],
    bonusKey: "PHYS_DMG",
    persona_pool: ["athena", "captain_kidd", "triglav", "siegfried", "futsunushi"],
  },
  JUSTICE: {
    id: "JUSTICE", name: "正义", icon: "⚖",
    bonusLevels: ["暴击+5%", "暴击+10%且暴击回5%HP", "暴击+15%且暴击回10%且无视抗性"],
    bonusKey: "CRIT_UP",
    persona_pool: ["kala_nemi", "archangel", "principality", "power", "dominion"],
  },
  HERMIT: {
    id: "HERMIT", name: "隐者", icon: "🔦",
    bonusLevels: ["多抽1张", "多抽2张", "多抽2张且可看牌顶"],
    bonusKey: "EXTRA_DRAW",
    persona_pool: ["naga", "mothman", "vasuki", "white_rider", "ananta"],
  },
  FORTUNE: {
    id: "FORTUNE", name: "命运", icon: "🎲",
    bonusLevels: ["逆位上限+1", "逆位上限+2", "逆位上限+3且逆位牌力度+1"],
    bonusKey: "EXTRA_REVERSE",
    persona_pool: ["fortuna", "sandman", "clotho", "atropos", "lachesis"],
  },
  STRENGTH: {
    id: "STRENGTH", name: "力量", icon: "💪",
    bonusLevels: ["攻击+5%", "攻击+10%", "攻击+15%"],
    bonusKey: "FLAT_ATK",
    persona_pool: ["valkyrie", "rakshasa", "matador", "kin_ki", "gurr"],
  },
  HANGED: {
    id: "HANGED", name: "倒悬者", icon: "🙃",
    bonusLevels: ["翻转不耗操作(1次/回合)", "翻转不耗操作(2次/回合)", "翻转不耗操作(3次/回合)"],
    bonusKey: "FREE_FLIP",
    persona_pool: ["inugami", "take_minakata", "yomotsu_shikome", "neko_shogun", "orlov"],
  },
  DEATH: {
    id: "DEATH", name: "死神", icon: "💀",
    bonusLevels: ["击杀回15%HP", "击杀回25%HP", "击杀回25%且<30%血处决+50%"],
    bonusKey: "KILL_HEAL",
    persona_pool: ["pisaca", "pale_rider", "samael", "alice", "thanatos"],
  },
  TEMPERANCE: {
    id: "TEMPERANCE", name: "节制", icon: "🌀",
    bonusLevels: ["减伤10%", "减伤15%且回合回5%HP", "减伤20%且回合回10%HP"],
    bonusKey: "DAMAGE_REDUCE",
    persona_pool: ["nigi_mitama", "mitra", "genbu", "byakko", "suzaku"],
  },
};

export const ARCANA_LIST = Object.keys(ARCANA);

// ============================================================
// 人格面具技能库（扩展）
// ============================================================
export const SKILLS = {
  // 物理
  cleave: { name: " Cleave", element: ELEMENT.PHYSICAL, power: POWER.MD, range: RANGE.SINGLE },
  mighty_swing: { name: "Mighty Swing", element: ELEMENT.PHYSICAL, power: POWER.LG, range: RANGE.SINGLE },
  igo: { name: "Igo", element: ELEMENT.PHYSICAL, power: POWER.LG, range: RANGE.SINGLE },
  fatal_end: { name: "Fatal End", element: ELEMENT.PHYSICAL, power: POWER.HV, range: RANGE.SINGLE },
  blade_of_fury: { name: "Blade of Fury", element: ELEMENT.PHYSICAL, power: POWER.LG, range: RANGE.ALL },
  gigantomachia: { name: "Gigantomachia", element: ELEMENT.PHYSICAL, power: POWER.HV, range: RANGE.ALL },
  god_hand: { name: "God Hand", element: ELEMENT.PHYSICAL, power: POWER.XH, range: RANGE.SINGLE },
  armageddon: { name: "Armageddon", element: ELEMENT.ALMIGHTY, power: POWER.UL, range: RANGE.ALL },
  brave_blade: { name: "Brave Blade", element: ELEMENT.PHYSICAL, power: POWER.LG, range: RANGE.SINGLE },
  // 火焰
  agi: { name: "Agi", element: ELEMENT.FIRE, power: POWER.SM, range: RANGE.SINGLE },
  agilao: { name: "Agilao", element: ELEMENT.FIRE, power: POWER.MD, range: RANGE.SINGLE },
  agidyne: { name: "Agidyne", element: ELEMENT.FIRE, power: POWER.LG, range: RANGE.SINGLE },
  maragi: { name: "Maragi", element: ELEMENT.FIRE, power: POWER.SM, range: RANGE.ALL },
  maragion: { name: "Maragion", element: ELEMENT.FIRE, power: POWER.MD, range: RANGE.ALL },
  raging_bull: { name: "Raging Bull", element: ELEMENT.FIRE, power: POWER.HV, range: RANGE.SINGLE },
  // 冰冻
  bufu: { name: "Bufu", element: ELEMENT.ICE, power: POWER.SM, range: RANGE.SINGLE },
  mabufu: { name: "Mabufu", element: ELEMENT.ICE, power: POWER.SM, range: RANGE.ALL },
  bufula: { name: "Bufula", element: ELEMENT.ICE, power: POWER.MD, range: RANGE.SINGLE },
  bufudyne: { name: "Bufudyne", element: ELEMENT.ICE, power: POWER.LG, range: RANGE.SINGLE },
  mabufudyne: { name: "Mabufudyne", element: ELEMENT.ICE, power: POWER.LG, range: RANGE.ALL },
  // 疾风
  garu: { name: "Garu", element: ELEMENT.WIND, power: POWER.SM, range: RANGE.SINGLE },
  magaru: { name: "Magaru", element: ELEMENT.WIND, power: POWER.SM, range: RANGE.ALL },
  garula: { name: "Garula", element: ELEMENT.WIND, power: POWER.MD, range: RANGE.SINGLE },
  garudyne: { name: "Garudyne", element: ELEMENT.WIND, power: POWER.LG, range: RANGE.SINGLE },
  magarudyne: { name: "Magarudyne", element: ELEMENT.WIND, power: POWER.LG, range: RANGE.ALL },
  // 电击
  zio: { name: "Zio", element: ELEMENT.ELEC, power: POWER.SM, range: RANGE.SINGLE },
  mazio: { name: "Mazio", element: ELEMENT.ELEC, power: POWER.SM, range: RANGE.ALL },
  zionga: { name: "Zionga", element: ELEMENT.ELEC, power: POWER.MD, range: RANGE.SINGLE },
  ziodyne: { name: "Ziodyne", element: ELEMENT.ELEC, power: POWER.LG, range: RANGE.SINGLE },
  maziodyne: { name: "Maziodyne", element: ELEMENT.ELEC, power: POWER.LG, range: RANGE.ALL },
  // 祝福
  hama: { name: "Hama", element: ELEMENT.BLESS, power: POWER.SM, range: RANGE.SINGLE },
  hamaon: { name: "Hamaon", element: ELEMENT.BLESS, power: POWER.MD, range: RANGE.SINGLE },
  mahama: { name: "Mahama", element: ELEMENT.BLESS, power: POWER.MD, range: RANGE.ALL },
  kouga: { name: "Kouga", element: ELEMENT.BLESS, power: POWER.LG, range: RANGE.SINGLE },
  kougaon: { name: "Kougaon", element: ELEMENT.BLESS, power: POWER.LG, range: RANGE.SINGLE },
  mahamaon: { name: "Mahamaon", element: ELEMENT.BLESS, power: POWER.LG, range: RANGE.ALL },
  // 咒怨
  mudo: { name: "Mudo", element: ELEMENT.CURSE, power: POWER.SM, range: RANGE.SINGLE },
  mudoon: { name: "Mudoon", element: ELEMENT.CURSE, power: POWER.MD, range: RANGE.SINGLE },
  mamudo: { name: "Mamudo", element: ELEMENT.CURSE, power: POWER.MD, range: RANGE.ALL },
  eiga: { name: "Eiga", element: ELEMENT.CURSE, power: POWER.LG, range: RANGE.SINGLE },
  eigaon: { name: "Eigaon", element: ELEMENT.CURSE, power: POWER.LG, range: RANGE.SINGLE },
  mamudoon: { name: "Mamudoon", element: ELEMENT.CURSE, power: POWER.LG, range: RANGE.ALL },
  // 万能
  megido: { name: "Megido", element: ELEMENT.ALMIGHTY, power: POWER.MD, range: RANGE.ALL },
  megidola: { name: "Megidola", element: ELEMENT.ALMIGHTY, power: POWER.HV, range: RANGE.ALL },
  megidolaon: { name: "Megidolaon", element: ELEMENT.ALMIGHTY, power: POWER.XH, range: RANGE.ALL },
  // 恢复
  dia: { name: "Dia", element: ELEMENT.HEAL, power: POWER.SM, range: RANGE.SINGLE },
  diarama: { name: "Diarama", element: ELEMENT.HEAL, power: POWER.MD, range: RANGE.SINGLE },
  media: { name: "Media", element: ELEMENT.HEAL, power: POWER.MD, range: RANGE.ALL },
  mediarama: { name: "Mediarama", element: ELEMENT.HEAL, power: POWER.LG, range: RANGE.ALL },
  samarecarm: { name: "Samarecarm", element: ELEMENT.HEAL, power: POWER.HV, range: RANGE.ALL },
  // 辅助
  tarukaja: { name: "Tarukaja", element: ELEMENT.SUPPORT, power: POWER.SM, range: RANGE.SINGLE, support: "ATK_UP" },
  rakukaja: { name: "Rakukaja", element: ELEMENT.SUPPORT, power: POWER.SM, range: RANGE.SINGLE, support: "DEF_UP" },
  debilitate: { name: "Debilitate", element: ELEMENT.SUPPORT, power: POWER.MD, range: RANGE.ALL, support: "ENEMY_DEBUFF" },
};

// ============================================================
// 人格面具卡定义（大幅扩展：参考 P3R 人格面具图鉴）
// ============================================================

// 相性简写 → AFFINITY 映射
const W = AFFINITY.WEAK, R = AFFINITY.RESIST, N = AFFINITY.NULL, RP = AFFINITY.REPEL, D = AFFINITY.DRAIN;

export const PERSONAS = {
  // ===== 愚者 FOOL =====
  orpheus: {
    name: "俄耳甫斯", arcana: "FOOL", rank: RANK.B, icon: "🎵", level: 1,
    affinities: { PHYSICAL: R, FIRE: R, ELEC: W, CURSE: W },
    upright: SKILLS.cleave, reversed: SKILLS.agi,
  },
  slime: {
    name: "软泥怪", arcana: "FOOL", rank: RANK.C, icon: "🟢", level: 12,
    affinities: { PHYSICAL: R, FIRE: W, WIND: W, CURSE: R },
    upright: SKILLS.cleave, reversed: SKILLS.bufu,
  },
  ghost_brigade: {
    name: "恶灵军团", arcana: "FOOL", rank: RANK.C, icon: "👻", level: 14,
    affinities: { CURSE: R },
    upright: SKILLS.mudo, reversed: SKILLS.cleave,
  },
  arsene: {
    name: "亚森", arcana: "FOOL", rank: RANK.A, icon: "🦊", level: 23,
    affinities: { BLESS: W, CURSE: R },
    upright: SKILLS.cleave, reversed: SKILLS.eiga,
  },
  izanagi: {
    name: "伊邪那岐", arcana: "FOOL", rank: RANK.B, icon: "⚔", level: 1,
    affinities: { PHYSICAL: R, ELEC: R, WIND: W },
    upright: SKILLS.zio, reversed: SKILLS.cleave,
  },
  // 高阶
  orpheus_tel: {
    name: "俄耳甫斯·改", arcana: "FOOL", rank: RANK.A, icon: "🎶", level: 30,
    affinities: { PHYSICAL: R, FIRE: R, ELEC: W, CURSE: W },
    upright: SKILLS.mighty_swing, reversed: SKILLS.agilao,
  },

  // ===== 魔术师 MAGICIAN =====
  jack_frost: {
    name: "杰克霜精", arcana: "MAGICIAN", rank: RANK.C, icon: "⛄", level: 11,
    affinities: { ICE: R, FIRE: W },
    upright: SKILLS.bufu, reversed: SKILLS.dia,
  },
  jack_o_lantern: {
    name: "杰克灯笼", arcana: "MAGICIAN", rank: RANK.C, icon: "🎃", level: 15,
    affinities: { FIRE: N, ICE: W },
    upright: SKILLS.agi, reversed: SKILLS.maragi,
  },
  nekomata: {
    name: "猫又", arcana: "MAGICIAN", rank: RANK.C, icon: "🐱", level: 16,
    affinities: {},
    upright: SKILLS.agilao, reversed: SKILLS.cleave,
  },
  hua_po: {
    name: "花魄", arcana: "MAGICIAN", rank: RANK.C, icon: "🌸", level: 19,
    affinities: { FIRE: N, ICE: W, CURSE: N },
    upright: SKILLS.maragi, reversed: SKILLS.dia,
  },
  pyro_jack: {
    name: "火焰杰克", arcana: "MAGICIAN", rank: RANK.B, icon: "🔥", level: 20,
    affinities: { FIRE: N, ICE: W },
    upright: SKILLS.agi, reversed: SKILLS.maragion,
  },
  hermes: {
    name: "赫耳墨斯", arcana: "MAGICIAN", rank: RANK.B, icon: "👟", level: 1,
    affinities: { FIRE: R, WIND: W },
    upright: SKILLS.zio, reversed: SKILLS.garu,
  },
  zorro: {
    name: "佐罗", arcana: "MAGICIAN", rank: RANK.B, icon: "🗡", level: 22,
    affinities: { ELEC: W, WIND: R },
    upright: SKILLS.garu, reversed: SKILLS.zio,
  },

  // ===== 恋爱 LOVERS =====
  pixie: {
    name: "皮克西", arcana: "LOVERS", rank: RANK.C, icon: "🧚", level: 2,
    affinities: { ICE: W, ELEC: R },
    upright: SKILLS.dia, reversed: SKILLS.garu,
  },
  sylph: {
    name: "希路奇", arcana: "LOVERS", rank: RANK.B, icon: "🌪", level: 10,
    affinities: { ELEC: W, WIND: R },
    upright: SKILLS.garu, reversed: SKILLS.magaru,
  },
  io: {
    name: "伊娥", arcana: "LOVERS", rank: RANK.B, icon: "🐄", level: 1,
    affinities: { ELEC: W, WIND: R },
    upright: SKILLS.zio, reversed: SKILLS.garu,
  },
  is_is: {
    name: "伊西斯", arcana: "LOVERS", rank: RANK.A, icon: "👁", level: 15,
    affinities: { ELEC: W, WIND: N },
    upright: SKILLS.media, reversed: SKILLS.magaru,
  },
  carmen: {
    name: "卡门", arcana: "LOVERS", rank: RANK.B, icon: "🌹", level: 19,
    affinities: { FIRE: R, ICE: W },
    upright: SKILLS.agilao, reversed: SKILLS.diarama,
  },
  tam_lin: {
    name: "塔姆林", arcana: "LOVERS", rank: RANK.A, icon: "🛡", level: 13,
    affinities: { PHYSICAL: R, ELEC: N, BLESS: R, CURSE: W },
    upright: SKILLS.cleave, reversed: SKILLS.tarukaja,
  },
  narcissus: {
    name: "那耳喀索斯", arcana: "LOVERS", rank: RANK.A, icon: "🪞", level: 23,
    affinities: { PHYSICAL: W, ICE: R, ELEC: R, WIND: R },
    upright: SKILLS.bufudyne, reversed: SKILLS.diarama,
  },
  // 高阶
  high_pixie: {
    name: "高阶皮克西", arcana: "LOVERS", rank: RANK.A, icon: "✨", level: 20,
    affinities: { ICE: N, WIND: W },
    upright: SKILLS.media, reversed: SKILLS.magarudyne,
  },

  // ===== 女教皇 PRIESTESS =====
  juno: {
    name: "朱诺", arcana: "PRIESTESS", rank: RANK.B, icon: "🐦", level: 1,
    affinities: {},
    upright: SKILLS.dia, reversed: SKILLS.garu,
  },
  apsaras: {
    name: "飞天", arcana: "PRIESTESS", rank: RANK.C, icon: "💃", level: 2,
    affinities: { FIRE: W, ICE: R },
    upright: SKILLS.bufu, reversed: SKILLS.dia,
  },
  unicorn: {
    name: "独角兽", arcana: "PRIESTESS", rank: RANK.B, icon: "🦄", level: 11,
    affinities: { ICE: N, WIND: W, BLESS: N, CURSE: W },
    upright: SKILLS.hama, reversed: SKILLS.diarama,
  },
  sarasvati: {
    name: "娑罗室伐底", arcana: "PRIESTESS", rank: RANK.C, icon: "🎵", level: 5,
    affinities: { ICE: W, ELEC: R },
    upright: SKILLS.dia, reversed: SKILLS.bufu,
  },
  skadi: {
    name: "斯卡蒂", arcana: "PRIESTESS", rank: RANK.A, icon: "❄", level: 22,
    affinities: { ICE: R, FIRE: W, ELEC: R },
    upright: SKILLS.bufudyne, reversed: SKILLS.mabufudyne,
  },

  // ===== 女皇 EMPRESS =====
  artemisia: {
    name: "阿尔特米西亚", arcana: "EMPRESS", rank: RANK.A, icon: "🏹", level: 1,
    affinities: { FIRE: W, ICE: N },
    upright: SKILLS.bufudyne, reversed: SKILLS.mabufudyne,
  },
  penthesilea: {
    name: "彭忒西勒亚", arcana: "EMPRESS", rank: RANK.B, icon: "⚔", level: 20,
    affinities: { FIRE: W, ICE: R },
    upright: SKILLS.cleave, reversed: SKILLS.bufula,
  },
  leanan_sidhe: {
    name: "拉南希", arcana: "EMPRESS", rank: RANK.B, icon: "🦋", level: 21,
    affinities: { FIRE: W, WIND: R },
    upright: SKILLS.magaru, reversed: SKILLS.diarama,
  },
  yaksini: {
    name: "夜支尼", arcana: "EMPRESS", rank: RANK.B, icon: "🗡", level: 14,
    affinities: { PHYSICAL: R, WIND: W },
    upright: SKILLS.cleave, reversed: SKILLS.garula,
  },
  hariti: {
    name: "诃利帝母", arcana: "EMPRESS", rank: RANK.A, icon: "👩‍👧", level: 24,
    affinities: { BLESS: R, CURSE: W, ICE: W },
    upright: SKILLS.diarama, reversed: SKILLS.hamaon,
  },

  // ===== 皇帝 EMPEROR =====
  polydeuces: {
    name: "波吕克斯", arcana: "EMPEROR", rank: RANK.B, icon: "👊", level: 14,
    affinities: { ICE: W, ELEC: R },
    upright: SKILLS.zio, reversed: SKILLS.cleave,
  },
  oberon: {
    name: "奥伯隆", arcana: "EMPEROR", rank: RANK.A, icon: "🧝", level: 16,
    affinities: { ICE: W, ELEC: N, BLESS: R, CURSE: R },
    upright: SKILLS.zionga, reversed: SKILLS.tarukaja,
  },
  take_mikazuchi: {
    name: "建御雷", arcana: "EMPEROR", rank: RANK.B, icon: "⛰", level: 23,
    affinities: { PHYSICAL: R, ELEC: N, WIND: W },
    upright: SKILLS.zionga, reversed: SKILLS.mighty_swing,
  },
  ose: {
    name: "欧塞", arcana: "EMPEROR", rank: RANK.B, icon: "👹", level: 12,
    affinities: { PHYSICAL: R, ELEC: W, ICE: W },
    upright: SKILLS.cleave, reversed: SKILLS.tarukaja,
  },
  thor: {
    name: "托尔", arcana: "EMPEROR", rank: RANK.A, icon: "🔨", level: 25,
    affinities: { PHYSICAL: R, ELEC: N, WIND: W },
    upright: SKILLS.ziodyne, reversed: SKILLS.maziodyne,
  },

  // ===== 教皇 HIEROPHANT =====
  berith: {
    name: "比利士", arcana: "HIEROPHANT", rank: RANK.C, icon: "🐂", level: 13,
    affinities: { FIRE: R, ELEC: W, WIND: R },
    upright: SKILLS.agi, reversed: SKILLS.cleave,
  },
  shiisaa: {
    name: "狮爷", arcana: "HIEROPHANT", rank: RANK.B, icon: "🦁", level: 23,
    affinities: { PHYSICAL: R, FIRE: W, ICE: N, BLESS: R },
    upright: SKILLS.agilao, reversed: SKILLS.hama,
  },
  mokoi: {
    name: "莫科伊", arcana: "HIEROPHANT", rank: RANK.C, icon: "🪃", level: 8,
    affinities: { PHYSICAL: R, FIRE: W },
    upright: SKILLS.cleave, reversed: SKILLS.agi,
  },
  anubis: {
    name: "阿努比斯", arcana: "HIEROPHANT", rank: RANK.B, icon: "🐺", level: 18,
    affinities: { BLESS: W, CURSE: R, PHYSICAL: R },
    upright: SKILLS.mudoon, reversed: SKILLS.cleave,
  },
  mot: {
    name: "莫特", arcana: "HIEROPHANT", rank: RANK.A, icon: "💀", level: 26,
    affinities: { BLESS: N, CURSE: N, PHYSICAL: R, FIRE: W },
    upright: SKILLS.eigaon, reversed: SKILLS.kougaon,
  },

  // ===== 战车 CHARIOT =====
  athena: {
    name: "雅典娜", arcana: "CHARIOT", rank: RANK.A, icon: "🛡", level: 1,
    affinities: { PHYSICAL: N, ELEC: W },
    upright: SKILLS.mighty_swing, reversed: SKILLS.rakukaja,
  },
  captain_kidd: {
    name: "船长基德", arcana: "CHARIOT", rank: RANK.B, icon: "🏴‍☠️", level: 18,
    affinities: { ELEC: R, WIND: W },
    upright: SKILLS.zionga, reversed: SKILLS.cleave,
  },
  triglav: {
    name: "特里格拉夫", arcana: "CHARIOT", rank: RANK.B, icon: "🛡", level: 13,
    affinities: { PHYSICAL: R, FIRE: W, ICE: W },
    upright: SKILLS.mighty_swing, reversed: SKILLS.tarukaja,
  },
  siegfried: {
    name: "齐格弗里德", arcana: "CHARIOT", rank: RANK.A, icon: "⚔", level: 25,
    affinities: { PHYSICAL: N, FIRE: W, ELEC: R },
    upright: SKILLS.igo, reversed: SKILLS.brave_blade,
  },
  futsunushi: {
    name: "经津主神", arcana: "CHARIOT", rank: RANK.A, icon: "🗡", level: 28,
    affinities: { PHYSICAL: R, WIND: N, FIRE: W },
    upright: SKILLS.god_hand, reversed: SKILLS.garudyne,
  },

  // ===== 正义 JUSTICE =====
  kala_nemi: {
    name: "伽罗尼弥", arcana: "JUSTICE", rank: RANK.A, icon: "⚖", level: 1,
    affinities: { BLESS: N, CURSE: W },
    upright: SKILLS.hamaon, reversed: SKILLS.mahama,
  },
  archangel: {
    name: "大天使", arcana: "JUSTICE", rank: RANK.B, icon: "👼", level: 10,
    affinities: { PHYSICAL: R, ELEC: W, BLESS: N, CURSE: W },
    upright: SKILLS.hama, reversed: SKILLS.cleave,
  },
  principality: {
    name: "权天使", arcana: "JUSTICE", rank: RANK.A, icon: "🔔", level: 16,
    affinities: { FIRE: R, BLESS: N, CURSE: W },
    upright: SKILLS.hamaon, reversed: SKILLS.mahama,
  },
  power: {
    name: "力天使", arcana: "JUSTICE", rank: RANK.B, icon: "💪", level: 12,
    affinities: { PHYSICAL: R, BLESS: R, CURSE: W },
    upright: SKILLS.hama, reversed: SKILLS.cleave,
  },
  dominion: {
    name: "座天使", arcana: "JUSTICE", rank: RANK.A, icon: "👼", level: 20,
    affinities: { BLESS: N, CURSE: W, ELEC: R },
    upright: SKILLS.kouga, reversed: SKILLS.mahamaon,
  },

  // ===== 隐者 HERMIT =====
  naga: {
    name: "那伽", arcana: "HERMIT", rank: RANK.B, icon: "🐉", level: 17,
    affinities: { PHYSICAL: W, ELEC: R, CURSE: R },
    upright: SKILLS.zionga, reversed: SKILLS.rakukaja,
  },
  mothman: {
    name: "天蛾人", arcana: "HERMIT", rank: RANK.C, icon: "🦋", level: 6,
    affinities: { WIND: R, ELEC: W },
    upright: SKILLS.garu, reversed: SKILLS.magaru,
  },
  vasuki: {
    name: "婆苏吉", arcana: "HERMIT", rank: RANK.B, icon: "🐍", level: 12,
    affinities: { ICE: R, ELEC: W, PHYSICAL: W },
    upright: SKILLS.bufula, reversed: SKILLS.zio,
  },
  white_rider: {
    name: "白骑士", arcana: "HERMIT", rank: RANK.A, icon: "🏇", level: 22,
    affinities: { BLESS: R, CURSE: W, ICE: N },
    upright: SKILLS.hamaon, reversed: SKILLS.mamudo,
  },
  ananta: {
    name: "阿南塔", arcana: "HERMIT", rank: RANK.A, icon: "🐲", level: 28,
    affinities: { PHYSICAL: R, ELEC: R, ICE: N, FIRE: W },
    upright: SKILLS.megido, reversed: SKILLS.debilitate,
  },

  // ===== 命运 FORTUNE =====
  fortuna: {
    name: "福尔图娜", arcana: "FORTUNE", rank: RANK.A, icon: "🍀", level: 15,
    affinities: { FIRE: N, ELEC: W, WIND: N },
    upright: SKILLS.megido, reversed: SKILLS.media,
  },
  sandman: {
    name: "睡魔", arcana: "FORTUNE", rank: RANK.B, icon: "😴", level: 20,
    affinities: { FIRE: N, ICE: W, ELEC: W, WIND: N },
    upright: SKILLS.megido, reversed: SKILLS.debilitate,
  },
  clotho: {
    name: "克洛托", arcana: "FORTUNE", rank: RANK.C, icon: "🧵", level: 8,
    affinities: { ELEC: W, WIND: R },
    upright: SKILLS.tarukaja, reversed: SKILLS.garu,
  },
  atropos: {
    name: "阿特洛波斯", arcana: "FORTUNE", rank: RANK.B, icon: "✂", level: 14,
    affinities: { FIRE: W, ELEC: R },
    upright: SKILLS.zionga, reversed: SKILLS.megido,
  },
  lachesis: {
    name: "拉刻西斯", arcana: "FORTUNE", rank: RANK.A, icon: "📏", level: 20,
    affinities: { FIRE: N, WIND: N, ELEC: W },
    upright: SKILLS.megidola, reversed: SKILLS.debilitate,
  },

  // ===== 力量 STRENGTH =====
  valkyrie: {
    name: "女武神", arcana: "STRENGTH", rank: RANK.B, icon: "🪶", level: 10,
    affinities: { PHYSICAL: R, FIRE: W, ICE: R },
    upright: SKILLS.cleave, reversed: SKILLS.tarukaja,
  },
  rakshasa: {
    name: "罗刹", arcana: "STRENGTH", rank: RANK.B, icon: "👹", level: 15,
    affinities: { PHYSICAL: R, WIND: W, BLESS: W },
    upright: SKILLS.mighty_swing, reversed: SKILLS.tarukaja,
  },
  matador: {
    name: "斗牛士", arcana: "STRENGTH", rank: RANK.A, icon: "🗡", level: 22,
    affinities: { FIRE: W, WIND: N, CURSE: RP },
    upright: SKILLS.garudyne, reversed: SKILLS.debilitate,
  },
  kin_ki: {
    name: "金鬼", arcana: "STRENGTH", rank: RANK.B, icon: "👺", level: 14,
    affinities: { PHYSICAL: R, FIRE: W, ELEC: R },
    upright: SKILLS.mighty_swing, reversed: SKILLS.zionga,
  },
  gurr: {
    name: "迦楼罗", arcana: "STRENGTH", rank: RANK.A, icon: "🦅", level: 24,
    affinities: { PHYSICAL: R, WIND: N, FIRE: R },
    upright: SKILLS.igo, reversed: SKILLS.garudyne,
  },

  // ===== 倒悬者 HANGED =====
  inugami: {
    name: "犬神", arcana: "HANGED", rank: RANK.B, icon: "🐕", level: 10,
    affinities: { FIRE: N, WIND: W, CURSE: R },
    upright: SKILLS.mudoon, reversed: SKILLS.cleave,
  },
  take_minakata: {
    name: "建御名方", arcana: "HANGED", rank: RANK.A, icon: "🌊", level: 20,
    affinities: { PHYSICAL: R, FIRE: R, ELEC: R, BLESS: W, CURSE: W },
    upright: SKILLS.agidyne, reversed: SKILLS.mabufudyne,
  },
  yomotsu_shikome: {
    name: "黄泉丑女", arcana: "HANGED", rank: RANK.C, icon: "👹", level: 6,
    affinities: { CURSE: R, BLESS: W },
    upright: SKILLS.mudo, reversed: SKILLS.cleave,
  },
  neko_shogun: {
    name: "猫将军", arcana: "HANGED", rank: RANK.B, icon: "🐈", level: 16,
    affinities: { PHYSICAL: R, CURSE: N, BLESS: W },
    upright: SKILLS.cleave, reversed: SKILLS.mudoon,
  },
  orlov: {
    name: "奥尔洛夫", arcana: "HANGED", rank: RANK.A, icon: "💎", level: 24,
    affinities: { BLESS: R, CURSE: R, PHYSICAL: W },
    upright: SKILLS.kougaon, reversed: SKILLS.eigaon,
  },

  // ===== 死神 DEATH =====
  pisaca: {
    name: "毕舍遮", arcana: "DEATH", rank: RANK.C, icon: "💀", level: 15,
    affinities: { PHYSICAL: R, FIRE: W, ELEC: R, BLESS: W, CURSE: N },
    upright: SKILLS.mudoon, reversed: SKILLS.debilitate,
  },
  pale_rider: {
    name: "苍白骑士", arcana: "DEATH", rank: RANK.A, icon: "🏇", level: 23,
    affinities: { WIND: R, BLESS: W, CURSE: RP },
    upright: SKILLS.eiga, reversed: SKILLS.mamudo,
  },
  samael: {
    name: "萨麦尔", arcana: "DEATH", rank: RANK.B, icon: "☠", level: 16,
    affinities: { CURSE: R, BLESS: W, FIRE: W },
    upright: SKILLS.mudoon, reversed: SKILLS.eiga,
  },
  alice: {
    name: "爱丽丝", arcana: "DEATH", rank: RANK.A, icon: "👧", level: 25,
    affinities: { CURSE: N, BLESS: N, FIRE: R, ICE: W },
    upright: SKILLS.eigaon, reversed: SKILLS.diarama,
  },
  thanatos: {
    name: "塔纳托斯", arcana: "DEATH", rank: RANK.A, icon: "💀", level: 30,
    affinities: { CURSE: R, BLESS: W, PHYSICAL: R, ELEC: R },
    upright: SKILLS.eigaon, reversed: SKILLS.megidola,
  },

  // ===== 节制 TEMPERANCE =====
  nigi_mitama: {
    name: "和魂", arcana: "TEMPERANCE", rank: RANK.B, icon: "🌿", level: 12,
    affinities: { ELEC: W, WIND: N, BLESS: R, CURSE: R },
    upright: SKILLS.diarama, reversed: SKILLS.rakukaja,
  },
  mitra: {
    name: "密特拉", arcana: "TEMPERANCE", rank: RANK.A, icon: "🔆", level: 22,
    affinities: { ICE: N, ELEC: W, BLESS: N },
    upright: SKILLS.mediarama, reversed: SKILLS.samarecarm,
  },
  genbu: {
    name: "玄武", arcana: "TEMPERANCE", rank: RANK.B, icon: "🐢", level: 14,
    affinities: { ICE: R, PHYSICAL: R, FIRE: W },
    upright: SKILLS.bufula, reversed: SKILLS.rakukaja,
  },
  byakko: {
    name: "白虎", arcana: "TEMPERANCE", rank: RANK.A, icon: "🐅", level: 24,
    affinities: { PHYSICAL: R, WIND: N, FIRE: W },
    upright: SKILLS.mighty_swing, reversed: SKILLS.garula,
  },
  suzaku: {
    name: "朱雀", arcana: "TEMPERANCE", rank: RANK.A, icon: "🐦", level: 22,
    affinities: { FIRE: R, BLESS: R, ICE: W },
    upright: SKILLS.agilao, reversed: SKILLS.media,
  },

  // ===== 神通法卡池 =====
  theurgy_maragi: { name: "神通·玛拉基", icon: "🌋", skill: { name: "Theurgy Maragi", element: ELEMENT.FIRE, power: POWER.HV, range: RANGE.ALL } },
  theurgy_mabufu: { name: "神通·玛布芙", icon: "❄", skill: { name: "Theurgy Mabufu", element: ELEMENT.ICE, power: POWER.HV, range: RANGE.ALL } },
  theurgy_mazio: { name: "神通·玛齐奥", icon: "⚡", skill: { name: "Theurgy Mazio", element: ELEMENT.ELEC, power: POWER.HV, range: RANGE.ALL } },
  theurgy_media: { name: "神通·梅迪亚", icon: "💚", skill: { name: "Theurgy Media", element: ELEMENT.HEAL, power: POWER.HV, range: RANGE.ALL } },
  theurgy_megido: { name: "神通·米吉多", icon: "💥", skill: { name: "Theurgy Megido", element: ELEMENT.ALMIGHTY, power: POWER.XH, range: RANGE.ALL } },
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
  sword_lg: { type: CARD_TYPE.SWORD, name: "宝剑·大", icon: "🪓", skill: { name: "Sword LG", element: ELEMENT.PHYSICAL, power: POWER.LG, range: RANGE.SINGLE } },
};

// ============================================================
// 敌人定义
// ============================================================
// 难度强化：HP ×1.3、attack ×1.25；shadow_priest/stone_golem/reaper 加恢复技能
export const ENEMIES = {
  tutorial_shadow: {
    name: "虚弱暗影", icon: "👤", level: 1, hp: 280,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.WEAK, ICE: AFFINITY.NORMAL, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.NORMAL, ALMIGHTY: AFFINITY.NORMAL },
    skills: [{ name: "虚弱攻击", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE }],
    attack: 8,
  },
  cowardly_maya: {
    name: "怯懦的玛雅", icon: "🗿", level: 3, hp: 234,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.NORMAL, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.WEAK, ALMIGHTY: AFFINITY.NORMAL },
    skills: [{ name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE }],
    attack: 23,
  },
  crying_table: {
    name: "哭泣的桌子", icon: "🪑", level: 4, hp: 286,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.WEAK, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.NORMAL, ALMIGHTY: AFFINITY.NORMAL },
    skills: [{ name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE }],
    attack: 25,
  },
  slime_shadow: {
    name: "暗影软泥", icon: "🟣", level: 5, hp: 156,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.WEAK, ICE: AFFINITY.RESIST, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.NORMAL, ALMIGHTY: AFFINITY.NORMAL },
    skills: [{ name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE }],
    attack: 23,
  },
  maya: {
    name: "玛雅", icon: "🗿", level: 8, hp: 234,
    affinities: { PHYSICAL: AFFINITY.RESIST, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.WEAK, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.NORMAL, ALMIGHTY: AFFINITY.NORMAL },
    skills: [
      { name: "Bufu", element: ELEMENT.ICE, power: POWER.SM, range: RANGE.SINGLE },
      { name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE },
    ],
    attack: 28,
  },
  fang_of_desire: {
    name: "欲望之牙", icon: "🦷", level: 10, hp: 286,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.NORMAL, WIND: AFFINITY.WEAK, ELEC: AFFINITY.RESIST, ALMIGHTY: AFFINITY.NORMAL },
    skills: [
      { name: "Garu", element: ELEMENT.WIND, power: POWER.SM, range: RANGE.SINGLE },
      { name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.MD, range: RANGE.SINGLE },
    ],
    attack: 31,
  },
  dancing_hand: {
    name: "舞动之手", icon: "✋", level: 12, hp: 208,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.NORMAL, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.WEAK, ALMIGHTY: AFFINITY.NORMAL },
    skills: [
      { name: "Zio", element: ELEMENT.ELEC, power: POWER.SM, range: RANGE.SINGLE },
      { name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.SM, range: RANGE.SINGLE },
    ],
    attack: 35,
  },
  shadow_priest: {
    name: "暗影祭司", icon: "🕯", level: 14, hp: 364,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.NORMAL, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.NORMAL, BLESS: AFFINITY.WEAK, CURSE: AFFINITY.RESIST, ALMIGHTY: AFFINITY.NORMAL },
    skills: [
      { name: "Mudo", element: ELEMENT.CURSE, power: POWER.SM, range: RANGE.SINGLE },
      { name: "Tackle", element: ELEMENT.PHYSICAL, power: POWER.MD, range: RANGE.SINGLE },
      { name: "Diarama", element: ELEMENT.HEAL, power: POWER.MD, range: RANGE.SINGLE },
    ],
    attack: 38,
  },
  stone_golem: {
    name: "石巨人", icon: "🗿", level: 16, hp: 520,
    affinities: { PHYSICAL: AFFINITY.RESIST, FIRE: AFFINITY.WEAK, ICE: AFFINITY.NORMAL, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.WEAK, ALMIGHTY: AFFINITY.NORMAL },
    skills: [
      { name: "Mighty Swing", element: ELEMENT.PHYSICAL, power: POWER.LG, range: RANGE.SINGLE },
      { name: "Dia", element: ELEMENT.HEAL, power: POWER.SM, range: RANGE.SINGLE },
    ],
    attack: 40,
  },
  // Boss
  reaper: {
    name: "死神", icon: "💀", level: 20, hp: 1040,
    affinities: { PHYSICAL: AFFINITY.NORMAL, FIRE: AFFINITY.NORMAL, ICE: AFFINITY.NORMAL, WIND: AFFINITY.NORMAL, ELEC: AFFINITY.NORMAL, ALMIGHTY: AFFINITY.NORMAL, BLESS: AFFINITY.WEAK, CURSE: AFFINITY.DRAIN },
    skills: [
      { name: "Megido", element: ELEMENT.ALMIGHTY, power: POWER.MD, range: RANGE.ALL },
      { name: "Fatal End", element: ELEMENT.PHYSICAL, power: POWER.LG, range: RANGE.SINGLE },
      { name: "Mudo", element: ELEMENT.CURSE, power: POWER.MD, range: RANGE.SINGLE },
      { name: "Samarecarm", element: ELEMENT.HEAL, power: POWER.HV, range: RANGE.ALL },
    ],
    attack: 50,
  },
};

// ============================================================
// 关卡配置（扩展：5 章 + Boss）
// ============================================================
// 多波次关卡 + 局内减益环境（environment 数组可叠加）
export const STAGES = [
  {
    id: 0, name: "新手教程：初次觉醒",
    enemies: ["tutorial_shadow"],
    waves: [["tutorial_shadow"]],
    environment: [],
    reward: { exp: 30, money: 150 }, recommendedLevel: 1,
    isTutorial: true,
  },
  {
    id: 1, name: "第一章：暗影领域",
    enemies: ["cowardly_maya", "crying_table"],
    waves: [["cowardly_maya"], ["crying_table"]],
    environment: ["POWER_MINUS_1"],
    reward: { exp: 50, money: 300 }, recommendedLevel: 1,
  },
  {
    id: 2, name: "第二章：扭曲迷宫",
    enemies: ["maya", "fang_of_desire", "dancing_hand"],
    waves: [["maya"], ["fang_of_desire", "dancing_hand"]],
    environment: ["COMPOSE_COST_UP"],
    reward: { exp: 80, money: 500 }, recommendedLevel: 8,
  },
  {
    id: 3, name: "第三章：诅咒回廊",
    enemies: ["shadow_priest", "slime_shadow", "dancing_hand"],
    waves: [["shadow_priest"], ["slime_shadow"], ["dancing_hand"]],
    environment: ["HEAL_HALVED"],
    reward: { exp: 120, money: 700 }, recommendedLevel: 12,
  },
  {
    id: 4, name: "第四章：巨石遗迹",
    enemies: ["stone_golem", "fang_of_desire", "shadow_priest"],
    waves: [["stone_golem"], ["fang_of_desire"], ["shadow_priest"]],
    environment: ["ENEMY_ATK_UP", "HEAL_HALVED"],
    reward: { exp: 160, money: 900 }, recommendedLevel: 16,
  },
  {
    id: 5, name: "BOSS：死神降临",
    enemies: ["reaper"],
    waves: [["dancing_hand", "shadow_priest"], ["stone_golem"], ["fang_of_desire", "shadow_priest"], ["reaper"]],
    environment: ["CRIT_DOWN", "ENEMY_ATK_UP", "HEAL_HALVED"],
    reward: { exp: 300, money: 2000 }, recommendedLevel: 20,
  },
];

// 环境描述表（供 UI 渲染徽章）
export const ENVIRONMENT_INFO = {
  POWER_MINUS_1: { name: "力度-1阶", icon: "⚠", desc: "所有玩家技能力度-1阶（下限SM）" },
  COMPOSE_COST_UP: { name: "构筑需多1张", icon: "⚠", desc: "构筑需至少2张牌" },
  HEAL_HALVED: { name: "恢复-50%", icon: "⚠", desc: "玩家恢复效果减半" },
  ENEMY_ATK_UP: { name: "敌方攻击+25%", icon: "⚠", desc: "敌方伤害提升" },
  CRIT_DOWN: { name: "暴击-50%", icon: "⚠", desc: "玩家暴击率减半" },
};

// ============================================================
// 经验曲线 & 玩家升级
// ============================================================
export const EXP_CURVE = [
  0,    // Lv.1
  100,  // Lv.2
  250,  // Lv.3
  500,  // Lv.4
  900,  // Lv.5
  1500, // Lv.6
  2400, // Lv.7
  3800, // Lv.8
  6000, // Lv.9
  9500, // Lv.10
  15000,// Lv.11
  22000,// Lv.12
  32000,// Lv.13
  46000,// Lv.14
  65000,// Lv.15
  90000,// Lv.16
  125000,// Lv.17
  170000,// Lv.18
  230000,// Lv.19
  310000,// Lv.20 (MAX)
];

export const MAX_PLAYER_LEVEL = 20;

// 每级获得的属性点
export const STAT_POINTS_PER_LEVEL = 3;

// 属性升级消耗
export const STAT_UPGRADE_COSTS = {
  attack: 2,      // 每点攻击力消耗2点属性点
  maxHp: 1,       // 每点HP消耗1点属性点（+50 HP per point）
  critRate: 3,    // 每点暴击率消耗3点（+2% per point）
  maxReversed: 5, // 每点逆位上限消耗5点
  theurgyMax: 4,  // 每点神通法上限消耗4点
};

// 属性升级增量
export const STAT_INCREMENTS = {
  attack: 15,
  maxHp: 50,
  critRate: 0.02,
  maxReversed: 1,
  theurgyMax: 1,
};

// ============================================================
// 合体系统：阿尔卡那融合表
// 简化版 P3R 融合表，输入两个阿尔卡那返回结果阿尔卡那
// ============================================================
const _FUSION = {
  FOOL:        { FOOL: "FOOL", MAGICIAN: "FOOL", PRIESTESS: "MAGICIAN", EMPRESS: "MAGICIAN", EMPEROR: "MAGICIAN", HIEROPHANT: "MAGICIAN", LOVERS: "MAGICIAN", CHARIOT: "MAGICIAN", JUSTICE: "MAGICIAN", HERMIT: "MAGICIAN", FORTUNE: "MAGICIAN", STRENGTH: "MAGICIAN", HANGED: "MAGICIAN", DEATH: "MAGICIAN", TEMPERANCE: "MAGICIAN" },
  MAGICIAN:    { FOOL: "FOOL", MAGICIAN: "MAGICIAN", PRIESTESS: "EMPEROR", EMPRESS: "JUSTICE", EMPEROR: "HIEROPHANT", HIEROPHANT: "LOVERS", LOVERS: "HIEROPHANT", CHARIOT: "HIEROPHANT", JUSTICE: "HERMIT", HERMIT: "PRIESTESS", FORTUNE: "HERMIT", STRENGTH: "HIEROPHANT", HANGED: "CHARIOT", DEATH: "CHARIOT", TEMPERANCE: "HIEROPHANT" },
  PRIESTESS:   { FOOL: "MAGICIAN", MAGICIAN: "EMPEROR", PRIESTESS: "PRIESTESS", EMPRESS: "HIEROPHANT", EMPEROR: "PRIESTESS", HIEROPHANT: "PRIESTESS", LOVERS: "PRIESTESS", CHARIOT: "PRIESTESS", JUSTICE: "PRIESTESS", HERMIT: "PRIESTESS", FORTUNE: "PRIESTESS", STRENGTH: "PRIESTESS", HANGED: "PRIESTESS", DEATH: "PRIESTESS", TEMPERANCE: "PRIESTESS" },
  EMPRESS:     { FOOL: "MAGICIAN", MAGICIAN: "JUSTICE", PRIESTESS: "HIEROPHANT", EMPRESS: "EMPRESS", EMPEROR: "LOVERS", HIEROPHANT: "JUSTICE", LOVERS: "STRENGTH", CHARIOT: "JUSTICE", JUSTICE: "EMPEROR", HERMIT: "JUSTICE", FORTUNE: "HERMIT", STRENGTH: "EMPRESS", HANGED: "JUSTICE", DEATH: "JUSTICE", TEMPERANCE: "JUSTICE" },
  EMPEROR:     { FOOL: "MAGICIAN", MAGICIAN: "HIEROPHANT", PRIESTESS: "PRIESTESS", EMPRESS: "LOVERS", EMPEROR: "EMPEROR", HIEROPHANT: "CHARIOT", LOVERS: "PRIESTESS", CHARIOT: "CHARIOT", JUSTICE: "CHARIOT", HERMIT: "CHARIOT", FORTUNE: "CHARIOT", STRENGTH: "CHARIOT", HANGED: "PRIESTESS", DEATH: "CHARIOT", TEMPERANCE: "CHARIOT" },
  HIEROPHANT:  { FOOL: "MAGICIAN", MAGICIAN: "LOVERS", PRIESTESS: "PRIESTESS", EMPRESS: "JUSTICE", EMPEROR: "CHARIOT", HIEROPHANT: "HIEROPHANT", LOVERS: "HIEROPHANT", CHARIOT: "HIEROPHANT", JUSTICE: "HIEROPHANT", HERMIT: "HIEROPHANT", FORTUNE: "HIEROPHANT", STRENGTH: "HIEROPHANT", HANGED: "PRIESTESS", DEATH: "HIEROPHANT", TEMPERANCE: "HIEROPHANT" },
  LOVERS:      { FOOL: "MAGICIAN", MAGICIAN: "HIEROPHANT", PRIESTESS: "PRIESTESS", EMPRESS: "STRENGTH", EMPEROR: "PRIESTESS", HIEROPHANT: "HIEROPHANT", LOVERS: "LOVERS", CHARIOT: "LOVERS", JUSTICE: "LOVERS", HERMIT: "LOVERS", FORTUNE: "LOVERS", STRENGTH: "LOVERS", HANGED: "LOVERS", DEATH: "LOVERS", TEMPERANCE: "LOVERS" },
  CHARIOT:     { FOOL: "MAGICIAN", MAGICIAN: "HIEROPHANT", PRIESTESS: "PRIESTESS", EMPRESS: "JUSTICE", EMPEROR: "CHARIOT", HIEROPHANT: "HIEROPHANT", LOVERS: "LOVERS", CHARIOT: "CHARIOT", JUSTICE: "CHARIOT", HERMIT: "CHARIOT", FORTUNE: "CHARIOT", STRENGTH: "CHARIOT", HANGED: "CHARIOT", DEATH: "CHARIOT", TEMPERANCE: "CHARIOT" },
  JUSTICE:     { FOOL: "MAGICIAN", MAGICIAN: "HERMIT", PRIESTESS: "PRIESTESS", EMPRESS: "EMPEROR", EMPEROR: "CHARIOT", HIEROPHANT: "HIEROPHANT", LOVERS: "LOVERS", CHARIOT: "CHARIOT", JUSTICE: "JUSTICE", HERMIT: "JUSTICE", FORTUNE: "JUSTICE", STRENGTH: "JUSTICE", HANGED: "JUSTICE", DEATH: "JUSTICE", TEMPERANCE: "JUSTICE" },
  HERMIT:      { FOOL: "MAGICIAN", MAGICIAN: "PRIESTESS", PRIESTESS: "PRIESTESS", EMPRESS: "JUSTICE", EMPEROR: "CHARIOT", HIEROPHANT: "HIEROPHANT", LOVERS: "LOVERS", CHARIOT: "CHARIOT", JUSTICE: "JUSTICE", HERMIT: "HERMIT", FORTUNE: "HERMIT", STRENGTH: "HERMIT", HANGED: "HERMIT", DEATH: "HERMIT", TEMPERANCE: "HERMIT" },
  FORTUNE:     { FOOL: "MAGICIAN", MAGICIAN: "HERMIT", PRIESTESS: "PRIESTESS", EMPRESS: "HERMIT", EMPEROR: "CHARIOT", HIEROPHANT: "HIEROPHANT", LOVERS: "LOVERS", CHARIOT: "CHARIOT", JUSTICE: "JUSTICE", HERMIT: "HERMIT", FORTUNE: "FORTUNE", STRENGTH: "FORTUNE", HANGED: "FORTUNE", DEATH: "FORTUNE", TEMPERANCE: "FORTUNE" },
  STRENGTH:    { FOOL: "MAGICIAN", MAGICIAN: "HIEROPHANT", PRIESTESS: "PRIESTESS", EMPRESS: "EMPRESS", EMPEROR: "CHARIOT", HIEROPHANT: "HIEROPHANT", LOVERS: "LOVERS", CHARIOT: "CHARIOT", JUSTICE: "JUSTICE", HERMIT: "HERMIT", FORTUNE: "FORTUNE", STRENGTH: "STRENGTH", HANGED: "STRENGTH", DEATH: "STRENGTH", TEMPERANCE: "STRENGTH" },
  HANGED:      { FOOL: "MAGICIAN", MAGICIAN: "CHARIOT", PRIESTESS: "PRIESTESS", EMPRESS: "JUSTICE", EMPEROR: "PRIESTESS", HIEROPHANT: "PRIESTESS", LOVERS: "LOVERS", CHARIOT: "CHARIOT", JUSTICE: "JUSTICE", HERMIT: "HERMIT", FORTUNE: "FORTUNE", STRENGTH: "STRENGTH", HANGED: "HANGED", DEATH: "HANGED", TEMPERANCE: "HANGED" },
  DEATH:       { FOOL: "MAGICIAN", MAGICIAN: "CHARIOT", PRIESTESS: "PRIESTESS", EMPRESS: "JUSTICE", EMPEROR: "CHARIOT", HIEROPHANT: "HIEROPHANT", LOVERS: "LOVERS", CHARIOT: "CHARIOT", JUSTICE: "JUSTICE", HERMIT: "HERMIT", FORTUNE: "FORTUNE", STRENGTH: "STRENGTH", HANGED: "HANGED", DEATH: "DEATH", TEMPERANCE: "DEATH" },
  TEMPERANCE:  { FOOL: "MAGICIAN", MAGICIAN: "HIEROPHANT", PRIESTESS: "PRIESTESS", EMPRESS: "JUSTICE", EMPEROR: "CHARIOT", HIEROPHANT: "HIEROPHANT", LOVERS: "LOVERS", CHARIOT: "CHARIOT", JUSTICE: "JUSTICE", HERMIT: "HERMIT", FORTUNE: "FORTUNE", STRENGTH: "STRENGTH", HANGED: "HANGED", DEATH: "DEATH", TEMPERANCE: "TEMPERANCE" },
};

export function getFusionArcana(arcanaA, arcanaB) {
  const row = _FUSION[arcanaA];
  if (!row) return null;
  return row[arcanaB] ?? null;
}

// ============================================================
// 商店数据
// ============================================================
export const SHOP_ITEMS = [
  // 人格面具（随机解锁池）
  { id: "shop_persona_c", name: "随机C阶人格面具", icon: "🎴", desc: "解锁一张随机C阶人格面具", cost: 500, type: "PERSONA_UNLOCK", filter: { rank: 1 } },
  { id: "shop_persona_b", name: "随机B阶人格面具", icon: "🎴", desc: "解锁一张随机B阶人格面具", cost: 1500, type: "PERSONA_UNLOCK", filter: { rank: 2 } },
  { id: "shop_persona_a", name: "随机A阶人格面具", icon: "🎴", desc: "解锁一张随机A阶人格面具", cost: 4000, type: "PERSONA_UNLOCK", filter: { rank: 3 } },
  // 属性点
  { id: "shop_stat_3", name: "属性点 ×3", icon: "⭐", desc: "获得3个可分配属性点", cost: 1000, type: "STAT_POINTS", amount: 3 },
  { id: "shop_stat_10", name: "属性点 ×10", icon: "⭐", desc: "获得10个可分配属性点", cost: 3000, type: "STAT_POINTS", amount: 10 },
  // 精魄包（原金币包，type=GOLD 仍累加到 meta.money = 精魄）
  { id: "shop_gold_500", name: "精魄 ◈500", icon: "💎", desc: "立即获得 500 精魄", cost: 200, type: "GOLD", amount: 500 },
  { id: "shop_gold_2000", name: "精魄 ◈2000", icon: "💎", desc: "立即获得 2000 精魄", cost: 700, type: "GOLD", amount: 2000 },
  // 手牌上限
  { id: "shop_hand_1", name: "手牌上限+1", icon: "✋", desc: "永久增加1点手牌上限", cost: 3000, type: "HAND_LIMIT", amount: 1 },
  // 神通法次数
  { id: "shop_theurgy_1", name: "神通法次数+1", icon: "🔮", desc: "永久增加1次神通法使用上限", cost: 5000, type: "THEURGY_MAX", amount: 1 },
];

// ============================================================
// 初始解锁的人格面具
// ============================================================
export const STARTING_PERSONAS = [
  "orpheus", "slime", "ghost_brigade",
  "jack_frost", "jack_o_lantern",
  "pixie",
];
