
import { GoogleGenAI, Type } from "@google/genai";
import { Job, Rarity, Equipment, Enemy, Skill } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates an enemy with minimal token overhead.
 */
export async function generateStage_Enemy(stage: number): Promise<Enemy> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Fantasy enemy for tower stage ${stage}. Return JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          hp: { type: Type.NUMBER },
          atk: { type: Type.NUMBER },
          def: { type: Type.NUMBER },
          spd: { type: Type.NUMBER }
        },
        required: ['name', 'description', 'hp', 'atk', 'def', 'spd']
      }
    }
  });

  const data = JSON.parse(response.text);
  // Apply stage scaling mathematically on top of AI base values to ensure infinite progression without AI bias
  const scale = 1 + (stage * 0.12);
  return {
    name: data.name,
    description: data.description,
    level: stage,
    hp: Math.floor(data.hp * scale),
    maxHp: Math.floor(data.hp * scale),
    attack: Math.floor(data.atk * scale),
    defense: Math.floor(data.def * scale),
    speed: Math.floor(data.spd * scale),
  };
}

/**
 * Generates loot with streamlined prompt.
 */
export async function generateLoot(level: number, rarity: Rarity): Promise<Equipment> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `${rarity} gear, level ${level}. Type: Weapon|Armor|Accessory. JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          type: { type: Type.STRING },
          atk: { type: Type.NUMBER },
          def: { type: Type.NUMBER },
          hp: { type: Type.NUMBER },
          spd: { type: Type.NUMBER }
        },
        required: ['name', 'type', 'atk', 'def', 'hp', 'spd']
      }
    }
  });

  const data = JSON.parse(response.text);
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: data.name,
    type: data.type as any,
    rarity,
    level,
    stats: {
      attack: data.atk,
      defense: data.def,
      hp: data.hp,
      speed: data.spd
    }
  };
}

/**
 * Batch generates jobs AND their associated skills in one single API call to save 50% quota on evolutions.
 */
export async function generateJobEvolutions(currentJob: string): Promise<{ job: Job, skill: Skill }[]> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Evolutions for a "${currentJob}". Return 3 paths. Each path needs a Job and 1 unique Skill. JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            desc: { type: Type.STRING },
            perk: { type: Type.STRING },
            multi: {
              type: Type.OBJECT,
              properties: {
                atk: { type: Type.NUMBER },
                def: { type: Type.NUMBER },
                hp: { type: Type.NUMBER },
                spd: { type: Type.NUMBER }
              },
              required: ['atk', 'def', 'hp', 'spd']
            },
            skill: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                desc: { type: Type.STRING },
                pow: { type: Type.NUMBER },
                type: { type: Type.STRING }
              },
              required: ['name', 'desc', 'pow', 'type']
            }
          },
          required: ['name', 'desc', 'perk', 'multi', 'skill']
        }
      }
    }
  });

  const data = JSON.parse(response.text);
  return data.map((d: any) => ({
    job: {
      name: d.name,
      description: d.desc,
      perk: d.perk,
      statMultipliers: {
        attack: d.multi.atk,
        defense: d.multi.def,
        hp: d.multi.hp,
        speed: d.multi.spd
      }
    },
    skill: {
      id: Math.random().toString(36).substr(2, 9),
      name: d.skill.name,
      description: d.skill.desc,
      power: d.skill.pow,
      type: d.skill.type as any,
      cooldown: 0
    }
  }));
}
