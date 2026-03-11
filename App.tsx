
import React, { useState, useEffect, useRef } from 'react';
import { 
  GameState, 
  Character, 
  Enemy, 
  Rarity, 
  RarityColors, 
  Equipment, 
  Skill, 
  Job 
} from './types';
import { 
  INITIAL_CHARACTER, 
  getRarityByChance 
} from './constants';
import { 
  generateStage_Enemy, 
  generateLoot, 
  generateJobEvolutions 
} from './geminiService';

interface EvolutionChoice {
  job: Job;
  skill: Skill;
}

const App: React.FC = () => {
  const [game, setGame] = useState<GameState>({
    stage: 1,
    character: INITIAL_CHARACTER,
    logs: ['Welcome to the Ethereal Ascent!'],
    isBattleActive: false,
    canEvolve: false,
    evolutionOptions: [] 
  });

  const [evolutionChoices, setEvolutionChoices] = useState<EvolutionChoice[]>([]);
  const [enemyPool, setEnemyPool] = useState<Enemy[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [game.logs]);

  const addLogs = (messages: string[]) => {
    setGame(prev => ({ ...prev, logs: [...prev.logs.slice(-(50 - messages.length)), ...messages] }));
  };

  const calculateStats = (char: Character) => {
    const { equipment, job, baseAttack, baseDefense, baseSpeed, maxHp } = char;
    let attack = baseAttack;
    let defense = baseDefense;
    let speed = baseSpeed;
    let hp = maxHp;

    Object.values(equipment).forEach(item => {
      if (item) {
        attack += item.stats.attack || 0;
        defense += item.stats.defense || 0;
        speed += item.stats.speed || 0;
        hp += item.stats.hp || 0;
      }
    });

    return {
      attack: Math.floor(attack * job.statMultipliers.attack),
      defense: Math.floor(defense * job.statMultipliers.defense),
      speed: Math.floor(speed * job.statMultipliers.speed),
      maxHp: Math.floor(hp * job.statMultipliers.hp)
    };
  };

  const checkLevelUp = (char: Character): { updatedChar: Character, levelUps: number } => {
    let updatedChar = { ...char };
    let levelUps = 0;
    while (updatedChar.exp >= updatedChar.nextLevelExp) {
      updatedChar.exp -= updatedChar.nextLevelExp;
      updatedChar.level += 1;
      updatedChar.nextLevelExp = Math.floor(updatedChar.nextLevelExp * 1.5);
      updatedChar.baseAttack += 5;
      updatedChar.baseDefense += 3;
      updatedChar.baseSpeed += 2;
      updatedChar.maxHp += 20;
      levelUps++;
    }
    return { updatedChar, levelUps };
  };

  const triggerEvolutionFetch = (jobName: string) => {
    generateJobEvolutions(jobName).then(choices => {
      setEvolutionChoices(choices);
      setGame(prev => ({ ...prev, evolutionOptions: choices.map(c => c.job), canEvolve: true }));
    });
  };

  const startNewStage = async () => {
    setIsLoading(true);
    try {
      let enemy: Enemy;
      if (enemyPool.length > 0 && game.stage % 3 !== 0) {
        const baseEnemy = enemyPool[Math.floor(Math.random() * enemyPool.length)];
        const scale = 1 + (game.stage * 0.1);
        enemy = {
          ...baseEnemy,
          level: game.stage,
          hp: Math.floor(baseEnemy.maxHp * scale / (1 + (baseEnemy.level * 0.12))),
          maxHp: Math.floor(baseEnemy.maxHp * scale / (1 + (baseEnemy.level * 0.12))),
          attack: Math.floor(baseEnemy.attack * scale / (1 + (baseEnemy.level * 0.12))),
          defense: Math.floor(baseEnemy.defense * scale / (1 + (baseEnemy.level * 0.12))),
          speed: Math.floor(baseEnemy.speed * scale / (1 + (baseEnemy.level * 0.12))),
        };
      } else {
        enemy = await generateStage_Enemy(game.stage);
        setEnemyPool(prev => [...prev.slice(-4), enemy]); 
      }

      const stats = calculateStats(game.character);
      let playerHp = stats.maxHp;
      let enemyHp = enemy.maxHp;
      const battleLogs: string[] = [`Stage ${game.stage}: A ${enemy.name} appears!`];
      const playerSpeed = stats.speed;
      const enemySpeed = enemy.speed;

      while (playerHp > 0 && enemyHp > 0) {
        if (playerSpeed >= enemySpeed) {
          const pDmg = Math.max(1, stats.attack - enemy.defense);
          enemyHp -= pDmg;
          battleLogs.push(`You hit ${enemy.name} for ${pDmg} damage.`);
          if (enemyHp <= 0) break;
          const eDmg = Math.max(1, enemy.attack - stats.defense);
          playerHp -= eDmg;
          battleLogs.push(`${enemy.name} hits you for ${eDmg} damage.`);
        } else {
          const eDmg = Math.max(1, enemy.attack - stats.defense);
          playerHp -= eDmg;
          battleLogs.push(`${enemy.name} hits you for ${eDmg} damage.`);
          if (playerHp <= 0) break;
          const pDmg = Math.max(1, stats.attack - enemy.defense);
          enemyHp -= pDmg;
          battleLogs.push(`You hit ${enemy.name} for ${pDmg} damage.`);
        }
      }

      if (playerHp > 0) {
        await handleVictory(battleLogs, { ...enemy, hp: 0 }, playerHp);
      } else {
        const minorExp = Math.max(5, Math.floor((20 + game.stage * 10) * 0.25));
        battleLogs.push("You were defeated... retreating to recover.");
        battleLogs.push(`Study your foe: +${minorExp} EXP.`);
        setGame(prev => {
          const charWithExp = { ...prev.character, currentHp: 0, exp: prev.character.exp + minorExp };
          const { updatedChar, levelUps } = checkLevelUp(charWithExp);
          if (levelUps > 0) battleLogs.push(`Level Up! You are now level ${updatedChar.level}.`);
          const canEvolveNow = updatedChar.level % 10 === 0 && updatedChar.level > prev.character.level;
          if (canEvolveNow) triggerEvolutionFetch(prev.character.job.name);
          return { ...prev, logs: [...prev.logs, ...battleLogs], isBattleActive: false, currentEnemy: { ...enemy, hp: Math.max(0, enemyHp) }, character: updatedChar, canEvolve: canEvolveNow || prev.canEvolve };
        });
      }
    } catch (error) {
      addLogs(["Error in the Fabric of Reality... try again."]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVictory = async (existingLogs: string[], enemy: Enemy, finalPlayerHp: number) => {
    const expGained = 20 + game.stage * 10;
    existingLogs.push(`Victory! You gained ${expGained} EXP.`);
    try {
      const rarity = getRarityByChance();
      const loot = await generateLoot(game.stage, rarity);
      existingLogs.push(`Loot Found: ${loot.name} (${loot.rarity})`);
      setGame(prev => {
        const charWithExp = { ...prev.character, currentHp: finalPlayerHp, exp: prev.character.exp + expGained, inventory: [...prev.character.inventory, loot] };
        const { updatedChar, levelUps } = checkLevelUp(charWithExp);
        if (levelUps > 0) existingLogs.push(`Level Up! You are now level ${updatedChar.level}.`);
        const canEvolveNow = updatedChar.level % 10 === 0 && updatedChar.level > prev.character.level;
        if (canEvolveNow) triggerEvolutionFetch(prev.character.job.name);
        return { ...prev, stage: prev.stage + 1, isBattleActive: false, currentEnemy: enemy, logs: [...prev.logs, ...existingLogs], character: updatedChar, canEvolve: canEvolveNow || prev.canEvolve };
      });
    } catch (e) {
      existingLogs.push("The loot dissolved into mist.");
      setGame(prev => ({ ...prev, logs: [...prev.logs, ...existingLogs] }));
    }
  };

  const sellItem = (item: Equipment) => {
    const rarityMultipliers: Record<Rarity, number> = {
      [Rarity.COMMON]: 5, [Rarity.UNCOMMON]: 15, [Rarity.RARE]: 40, [Rarity.EPIC]: 100, [Rarity.LEGENDARY]: 300, [Rarity.MYSTIC]: 800, [Rarity.DIVINE]: 2000, [Rarity.ETHEREAL]: 5000,
    };
    const expValue = item.level * rarityMultipliers[item.rarity];
    const logMsg = `Sold ${item.name} for ${expValue} EXP.`;
    setGame(prev => {
      const newInventory = prev.character.inventory.filter(i => i.id !== item.id);
      const charWithExp = { ...prev.character, exp: prev.character.exp + expValue, inventory: newInventory };
      const { updatedChar, levelUps } = checkLevelUp(charWithExp);
      let finalLogs = [...prev.logs, logMsg];
      if (levelUps > 0) finalLogs.push(`Level Up! You are now level ${updatedChar.level}.`);
      const canEvolveNow = updatedChar.level % 10 === 0 && updatedChar.level > prev.character.level;
      if (canEvolveNow) triggerEvolutionFetch(prev.character.job.name);
      return { ...prev, logs: finalLogs, character: updatedChar, canEvolve: canEvolveNow || prev.canEvolve };
    });
  };

  const selectEvolution = (choice: EvolutionChoice) => {
    setGame(prev => ({ ...prev, canEvolve: false, evolutionOptions: [], character: { ...prev.character, job: choice.job, skills: [...prev.character.skills, choice.skill] }, logs: [...prev.logs, `Ascended to ${choice.job.name}. Mastery gained: ${choice.skill.name}`] }));
    setEvolutionChoices([]);
  };

  const equipItem = (item: Equipment) => {
    setGame(prev => {
      const slot = item.type.toLowerCase() as 'weapon' | 'armor' | 'accessory';
      const currentEquipped = prev.character.equipment[slot];
      const newInventory = prev.character.inventory.filter(i => i.id !== item.id);
      if (currentEquipped) {
        newInventory.push(currentEquipped);
      }
      return {
        ...prev,
        logs: [...prev.logs, `Equipped ${item.name}.`],
        character: { ...prev.character, equipment: { ...prev.character.equipment, [slot]: item }, inventory: newInventory }
      };
    });
  };

  const getStatDiff = (invItem: Equipment, stat: keyof Equipment['stats']) => {
    const slot = invItem.type.toLowerCase() as 'weapon' | 'armor' | 'accessory';
    const equipped = game.character.equipment[slot];
    const invVal = invItem.stats[stat] || 0;
    const equippedVal = equipped ? (equipped.stats[stat] || 0) : 0;
    const diff = invVal - equippedVal;
    return diff;
  };

  const stats = calculateStats(game.character);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 p-4 md:p-8 flex flex-col gap-6 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-center bg-[#15151a] p-4 rounded-xl border border-slate-800 shadow-xl sticky top-4 z-50">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-indigo-400">
            {game.character.level}
          </div>
          <div>
            <h1 className="text-xl font-bold text-indigo-300">{game.character.job.name}</h1>
            <div className="w-48 h-2 bg-slate-800 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(game.character.exp / game.character.nextLevelExp) * 100}%` }} />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">Exp: {game.character.exp} / {game.character.nextLevelExp}</p>
          </div>
        </div>
        <div className="flex gap-8 text-center mt-4 md:mt-0">
          <div><p className="text-xs text-slate-500 uppercase">Stage</p><p className="text-2xl font-fantasy text-yellow-500">{game.stage}</p></div>
          <div><p className="text-xs text-slate-500 uppercase">Health</p><p className="text-2xl font-fantasy text-red-500">{game.character.currentHp} / {stats.maxHp}</p></div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#15151a] rounded-xl border border-slate-800 p-6 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
            {isLoading ? (
              <div className="text-center animate-pulse">
                <div className="text-4xl mb-4 text-indigo-500">🌌</div>
                <h2 className="text-xl font-fantasy text-indigo-300">Shaping Reality...</h2>
                <p className="text-[10px] text-slate-600 mt-2 uppercase tracking-[0.2em]">Quota Optimized Generation</p>
              </div>
            ) : !game.currentEnemy ? (
              <div className="text-center">
                <h2 className="text-3xl font-fantasy mb-4 text-slate-100">The path is clear...</h2>
                <button onClick={startNewStage} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-full font-bold text-xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95 border-b-4 border-indigo-800">
                  Enter Stage {game.stage}
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-6">
                <div className="text-center"><h2 className="text-2xl font-fantasy text-slate-400">Last Encounter: {game.currentEnemy.name}</h2><p className="text-xs text-slate-600 uppercase mt-1">Stage {game.stage - 1} Log</p></div>
                <div className="w-full grid grid-cols-2 gap-8 items-center max-w-md">
                   <div className="flex flex-col items-center gap-2">
                        <div className="w-20 h-20 bg-slate-900 rounded-lg flex items-center justify-center border-2 border-indigo-500/30">🛡️</div>
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-tighter">Status: {game.character.currentHp > 0 ? 'ALIVE' : 'RECOVERING'}</div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)] transition-all duration-700" style={{ width: `${(game.character.currentHp / stats.maxHp) * 100}%` }}></div>
                        </div>
                   </div>
                   <div className="flex flex-col items-center gap-2">
                        <div className="w-20 h-20 bg-slate-900 rounded-lg flex items-center justify-center border-2 border-red-500/30">👹</div>
                        <div className="text-xs font-bold text-red-400 uppercase tracking-tighter">Status: {game.currentEnemy.hp <= 0 ? 'SLAIN' : 'ALIVE'}</div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)] transition-all duration-700" style={{ width: `${(game.currentEnemy.hp / game.currentEnemy.maxHp) * 100}%` }}></div>
                        </div>
                   </div>
                </div>
                <button onClick={startNewStage} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg font-bold transition-all shadow-md active:scale-95 mt-4 border-b-4 border-indigo-800">
                  {game.character.currentHp <= 0 ? 'Retry Challenge' : `Ascend to Stage ${game.stage}`}
                </button>
              </div>
            )}
          </div>

          {game.canEvolve && evolutionChoices.length > 0 && (
            <div className="bg-[#0a0a0f]/95 border-2 border-indigo-500/50 rounded-2xl p-8 absolute inset-0 z-[100] flex flex-col items-center justify-center backdrop-blur-xl m-4 overflow-y-auto shadow-[0_0_100px_rgba(79,70,229,0.3)]">
              <div className="max-w-4xl w-full flex flex-col items-center">
                <div className="text-indigo-400 text-sm uppercase tracking-[0.3em] font-bold mb-2">Threshold Reached</div>
                <h2 className="text-4xl font-fantasy text-white mb-8 text-center bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">Select Evolution</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                  {evolutionChoices.map((choice, idx) => (
                    <div key={idx} className="bg-[#15151e] p-6 rounded-xl border border-slate-800 flex flex-col gap-4 shadow-2xl hover:border-indigo-500/50 transition-all hover:scale-[1.02] group">
                      <h3 className="text-xl font-bold text-indigo-300">{choice.job.name}</h3>
                      <p className="text-sm text-slate-400 italic flex-grow leading-relaxed">{choice.job.description}</p>
                      <div className="space-y-3">
                        <div className="text-[10px] text-yellow-400 font-semibold bg-yellow-400/5 p-2 rounded border border-yellow-400/20">PERK: {choice.job.perk}</div>
                        <div className="text-[10px] text-cyan-400 font-semibold bg-cyan-400/5 p-2 rounded border border-cyan-400/20">SKILL: {choice.skill.name} - {choice.skill.description}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 bg-black/40 p-2 rounded border border-white/5">
                        <div className="flex justify-between"><span>ATK</span> <span className="text-slate-300">x{choice.job.statMultipliers.attack}</span></div>
                        <div className="flex justify-between"><span>DEF</span> <span className="text-slate-300">x{choice.job.statMultipliers.defense}</span></div>
                        <div className="flex justify-between"><span>HP</span> <span className="text-slate-300">x{choice.job.statMultipliers.hp}</span></div>
                        <div className="flex justify-between"><span>SPD</span> <span className="text-slate-300">x{choice.job.statMultipliers.speed}</span></div>
                      </div>
                      <button onClick={() => selectEvolution(choice)} className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold transition-all shadow-lg active:scale-95 group-hover:shadow-indigo-500/20">Accept Destiny</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#15151a] rounded-xl border border-slate-800 flex flex-col h-[350px] shadow-inner">
            <div className="p-3 border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-widest font-bold flex justify-between items-center">
                <span className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>Adventure Log</span>
                <span className="text-indigo-500/50 bg-indigo-500/5 px-2 py-1 rounded">V2 Engine | No Quota Waste</span>
            </div>
            <div ref={logContainerRef} className="p-4 overflow-y-auto custom-scroll flex flex-col gap-1 text-xs font-mono flex-grow bg-black/20">
              {game.logs.map((log, i) => (
                <div key={i} className="flex gap-2 border-b border-white/5 pb-1"><span className="text-slate-600 w-8">[{i}]</span><span className={log.includes('Victory') ? 'text-yellow-400 font-bold' : log.includes('defeated') ? 'text-orange-400 italic' : log.includes('hits') ? 'text-red-400' : log.includes('Sold') ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>{log}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 h-full">
          <div className="bg-[#15151a] rounded-xl border border-slate-800 p-6 shadow-xl">
            <h3 className="text-sm font-bold mb-4 text-indigo-300 flex items-center gap-2 uppercase tracking-widest"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> Character</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="text-slate-500 uppercase tracking-tighter">Attack</span><span className="font-bold text-slate-100">{stats.attack}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500 uppercase tracking-tighter">Defense</span><span className="font-bold text-slate-100">{stats.defense}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500 uppercase tracking-tighter">Speed</span><span className="font-bold text-slate-100">{stats.speed}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500 uppercase tracking-tighter">Inventory</span><span className="font-bold text-slate-100">{game.character.inventory.length} / 50</span></div>
              </div>
              <div className="pt-4 border-t border-slate-800">
                <h4 className="text-[10px] text-slate-500 uppercase font-bold mb-2">Mastered Skills</h4>
                <div className="space-y-2">
                  {game.character.skills.map(skill => (
                    <div key={skill.id} className="bg-black/30 p-2 rounded border border-white/5 hover:border-indigo-500/30 transition-colors">
                      <div className="flex justify-between items-center"><span className="text-xs font-bold text-indigo-300">{skill.name}</span><span className="text-[9px] text-slate-600 bg-white/5 px-1 rounded">{skill.type}</span></div>
                      <div className="text-[9px] text-slate-500 mt-1 italic">{skill.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#15151a] rounded-xl border border-slate-800 p-6 shadow-xl">
            <h3 className="text-sm font-bold mb-4 text-indigo-300 flex items-center gap-2 uppercase tracking-widest"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> Loadout</h3>
            <div className="space-y-3">
              {(['weapon', 'armor', 'accessory'] as const).map(slot => {
                const item = game.character.equipment[slot];
                return (
                  <div key={slot} className="flex items-center gap-4 bg-black/40 p-3 rounded-lg border border-white/5">
                    <div className="w-10 h-10 bg-[#1a1a24] rounded-lg flex items-center justify-center text-lg border border-white/10 shadow-inner">{slot === 'weapon' ? '⚔️' : slot === 'armor' ? '🛡️' : '💍'}</div>
                    <div className="flex-grow">
                      <p className="text-[9px] uppercase font-bold text-slate-600">{slot}</p>
                      {item ? <p className={`text-xs font-bold ${RarityColors[item.rarity].split(' ')[0]}`}>{item.name}</p> : <p className="text-xs text-slate-700 italic">Empty</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#15151a] rounded-xl border border-slate-800 p-6 flex flex-col min-h-[300px] shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2 uppercase tracking-widest"><span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> Inventory</h3>
              <span className="text-[10px] text-slate-600">{game.character.inventory.length}/50</span>
            </div>
            <div className="grid grid-cols-1 gap-2 overflow-y-auto custom-scroll max-h-[400px] pr-1">
              {game.character.inventory.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 opacity-20"><div className="text-3xl mb-2">📦</div><p className="text-[10px] uppercase font-bold">Empty</p></div>
              )}
              {game.character.inventory.map(item => (
                <div key={item.id} className={`bg-black/30 p-3 rounded border ${RarityColors[item.rarity]} flex flex-col gap-2 group relative transition-all hover:bg-indigo-500/10 hover:border-indigo-500/50 shadow-inner`}>
                  <div className="flex justify-between items-start">
                    <div><span className="text-xs font-bold block leading-tight">{item.name}</span><span className="text-[9px] uppercase opacity-50 tracking-tighter">Lv.{item.level} {item.type}</span></div>
                    <div className="flex gap-1.5">
                      <button onClick={() => equipItem(item)} className="opacity-0 group-hover:opacity-100 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] px-2 py-1 rounded transition-all font-bold">EQUIP</button>
                      <button onClick={() => sellItem(item)} className="opacity-0 group-hover:opacity-100 bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white text-[9px] px-2 py-1 rounded transition-all font-bold border border-red-500/30">SELL</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {(['attack', 'defense', 'hp', 'speed'] as const).map(stat => {
                      const val = item.stats[stat];
                      if (!val) return null;
                      const diff = getStatDiff(item, stat);
                      return (
                        <div key={stat} className="flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded border border-white/5 text-[8px] font-mono uppercase tracking-tighter">
                          <span className="text-slate-500">{stat[0]}:</span>
                          <span className="text-slate-300">+{val}</span>
                          {diff !== 0 && (
                            <span className={diff > 0 ? 'text-green-500' : 'text-red-500'}>
                              ({diff > 0 ? '▲' : '▼'}{Math.abs(diff)})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <footer className="text-center py-6 text-slate-700 text-[10px] uppercase tracking-[0.4em] border-t border-slate-900 flex justify-between px-4"><span>Ascent Engine v2.1</span><span>AI-Generated Infinite Content</span></footer>
    </div>
  );
};

export default App;
