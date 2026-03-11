
export enum Rarity {
  COMMON = 'Common',
  UNCOMMON = 'Uncommon',
  RARE = 'Rare',
  EPIC = 'Epic',
  LEGENDARY = 'Legendary',
  MYSTIC = 'Mystic',
  DIVINE = 'Divine',
  ETHEREAL = 'Ethereal'
}

export const RarityColors: Record<Rarity, string> = {
  [Rarity.COMMON]: 'text-gray-400 border-gray-400',
  [Rarity.UNCOMMON]: 'text-green-400 border-green-400',
  [Rarity.RARE]: 'text-blue-400 border-blue-400',
  [Rarity.EPIC]: 'text-purple-400 border-purple-400',
  [Rarity.LEGENDARY]: 'text-orange-400 border-orange-400',
  [Rarity.MYSTIC]: 'text-cyan-400 border-cyan-400',
  [Rarity.DIVINE]: 'text-yellow-400 border-yellow-400',
  [Rarity.ETHEREAL]: 'text-white border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]'
};

export interface Equipment {
  id: string;
  name: string;
  type: 'Weapon' | 'Armor' | 'Accessory';
  rarity: Rarity;
  level: number;
  stats: {
    attack?: number;
    defense?: number;
    hp?: number;
    speed?: number;
  };
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  power: number;
  type: 'Attack' | 'Buff' | 'Heal';
}

export interface Job {
  name: string;
  description: string;
  perk: string;
  statMultipliers: {
    attack: number;
    defense: number;
    hp: number;
    speed: number;
  };
}

export interface Character {
  level: number;
  exp: number;
  nextLevelExp: number;
  currentHp: number;
  maxHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  job: Job;
  equipment: {
    weapon?: Equipment;
    armor?: Equipment;
    accessory?: Equipment;
  };
  inventory: Equipment[];
  skills: Skill[];
}

export interface Enemy {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  description: string;
}

export interface GameState {
  stage: number;
  character: Character;
  currentEnemy?: Enemy;
  logs: string[];
  isBattleActive: boolean;
  canEvolve: boolean;
  evolutionOptions: Job[];
}
