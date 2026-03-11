
import { Job, Character, Rarity } from './types';

export const INITIAL_JOB: Job = {
  name: 'Novice Adventurer',
  description: 'A beginner seeking glory in the endless spire.',
  perk: 'Adaptability: Gains slightly more EXP.',
  statMultipliers: {
    attack: 1,
    defense: 1,
    hp: 1,
    speed: 1
  }
};

export const INITIAL_CHARACTER: Character = {
  level: 1,
  exp: 0,
  nextLevelExp: 100,
  currentHp: 100,
  maxHp: 100,
  baseAttack: 15,
  baseDefense: 10,
  baseSpeed: 10,
  job: INITIAL_JOB,
  equipment: {},
  inventory: [],
  skills: [
    {
      id: 'slash',
      name: 'Slash',
      description: 'A basic strike.',
      cooldown: 0,
      power: 1.2,
      type: 'Attack'
    }
  ]
};

export const RARITIES: Rarity[] = [
  Rarity.COMMON,
  Rarity.UNCOMMON,
  Rarity.RARE,
  Rarity.EPIC,
  Rarity.LEGENDARY,
  Rarity.MYSTIC,
  Rarity.DIVINE,
  Rarity.ETHEREAL
];

export const getRarityByChance = (): Rarity => {
  const roll = Math.random() * 100;
  if (roll > 99) return Rarity.ETHEREAL;
  if (roll > 97) return Rarity.DIVINE;
  if (roll > 93) return Rarity.MYSTIC;
  if (roll > 85) return Rarity.LEGENDARY;
  if (roll > 70) return Rarity.EPIC;
  if (roll > 50) return Rarity.RARE;
  if (roll > 25) return Rarity.UNCOMMON;
  return Rarity.COMMON;
};
