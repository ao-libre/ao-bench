# Party Mechanics and Quest System

Sourced from the ao-libre community wiki (v0.13.x).

---

## Party System

A party is a group of up to 5 players that share XP from kills.

### Creating and joining

- Create: `/CREARPARTY` — starts a party, you become leader.
- Join: click the leader's character and type `/PARTY` to request entry.
- Accept a member: `/ACCEPTPARTY NICK` (leader only).

No Liderazgo skill or Carisma attribute requirement. Parties can be formed from level 1.

In SDK: `partyCreate()`, `partyJoin("leaderName")`, `partyLeave()`, `partyMessage("text")`,
`partyAccept("memberName")` (leader only), `partyKick("memberName")` (leader only),
`partySetLeader("memberName")`, `partyOnline()`.

### Party rules

- **Max 5 members.**
- No level difference limit between members — a level 1 and a level 99 can party together.
- **Faction restrictions:** Parties can only mix:
  - Citizens + Royal Army members, OR
  - Legionaries + Criminals, OR
  - Criminals + Citizens
  - A Legionary cannot party with a Citizen or Royal Army member.

### XP sharing

XP is distributed **when you leave the party** (not in real time). While in party, XP accumulates in a pool.

Distribution formula: `XP * Level^1.75 / Sum(Level^1.75 for all members)`

This means higher-level members get proportionally more XP from the shared pool. A level 10 player paired with a level 50 player will receive far less XP per kill than they would solo.

XP is shared among members **within 18 tiles** (roughly one screen width) of the kill. Members outside range do not receive the XP.

### Party commands

| Command | Effect |
|---------|--------|
| `/CREARPARTY` | Create a party (you become leader) |
| `/PARTY` | Request to join a targeted player's party |
| `/ACCEPTPARTY NICK` | Accept a member request (leader only) |
| `/SALIRPARTY` | Leave party and receive accumulated XP. If the founder leaves, the party dissolves. |
| `/ECHARPARTY NICK` | Kick a member (leader only) |
| `/PARTYLIDER NICK` | Transfer leadership to another member |
| `/PMSG message` | Private message to all party members |
| `/ONLINEPARTY` | List all party members, individual XP earned, and total party XP |

### NPC ownership in a party

Party and clan members can freely attack each other's owned NPCs without triggering the "violet/atacable" status (see reputation.md). The one-NPC-per-person limit still applies — a 2-person party can have 2 NPCs, one per member.

### Practical implications for agents

- **Party tasks** (multi-bot aobench runs not yet implemented, but relevant for future v2): XP formula means equal-level bots in a party maximize fairness, while mixing levels heavily favors the higher-level bot.
- **Solo is usually better for XP rate benchmarks** because XP is not split; you receive 100% of each kill's XP immediately.
- If you use `partyCreate()` in a script for the Liderazgo skill, you must actually be in combat to gain Liderazgo XP — just being leader is not enough.

---

## Quest System

### How quests work (server mechanics)

Quests are stored in `Dat/Quests.DAT`. Each quest has a required character level,
a list of NPCs to kill (with kill counts), a list of items to collect, and
rewards (XP + gold + optional items).

Flow:
1. Walk within 5 tiles of the quest-giver NPC.
2. Call `quest(x, y)` — the server shows quest details.
3. Call `questAccept()` — the quest is added to your active slot (max 15 simultaneous).
4. Kill the required NPCs. The server tracks kill counts automatically as you fight.
5. Walk back within 5 tiles of the same NPC and call `quest(x, y)` again — the
   server detects you have it active, checks all objectives, removes required items,
   and grants XP + gold.
6. Quests are **one-time-only** per character. Check `getState().quests.doneIds`
   to avoid attempting a completed quest.

### SDK usage

```ts
// Step 1: walk to quest NPC and accept
await bot.walkTo(QUEST_NPC_X, QUEST_NPC_Y);
await bot.quest(QUEST_NPC_X, QUEST_NPC_Y);  // shows details
await bot.questAccept();                     // enrols in the quest

// Step 2: check kill progress
const q = bot.getState().quests.active[0];
// q = { slot, questId, name, requiredLevel,
//        npcProgress: [{ npcId, required, killed }],
//        rewardXp, rewardGold }

// Step 3: grind the required NPCs (tracked automatically by the server)

// Step 4: return and hand in
await bot.walkTo(QUEST_NPC_X, QUEST_NPC_Y);
await bot.quest(QUEST_NPC_X, QUEST_NPC_Y);  // finishes and grants XP

// Other quest actions:
await bot.questAbandon(1);         // abandon quest in slot 1
await bot.questListRequest();      // refresh active/done list in getState()
await bot.questDetailsRequest(1);  // get full details for slot 1
```

**Quest NPC locations** are not in the starting area — you need to navigate to
them. The quest table below lists the NPC IDs; cross-reference `wiki/npcs.md`
to find their map coordinates.

### Quest table

24 quests exist in `Quests.DAT`. Quest-giver NPCs are listed in `wiki/npcs.md`
with their NPC IDs (924–959 range).

| # | Name | Min level | Objective (kill counts) | Reward XP | Reward gold |
|---|------|-----------|-------------------------|-----------|-------------|
| 1 | Bichos molestos | 1 | NPC 500 ×3 | 500 | 100 |
| 2 | Caceria de lobos | 2 | NPC 501 ×15 + item 414 ×15 | 1,000 | 200 |
| 3 | Caceria salvaje | 5 | item 414 ×10 + item 415 ×10 | 2,000 | 1,500 |
| 4 | Contra los muertos vivos | 15 | NPC 502 ×10 + NPC 503 ×10 | 4,500 | 3,000 |
| 5 | El peligroso Dorck | 20 | NPC 510 ×10 + NPC 523 ×10 + item 3 ×10 | 5,000 | 5,000 |
| 6 | Justicia divina | 18 | NPC 531 ×10 + NPC 530 ×10 | 7,000 | 7,000 |
| 7 | Capricho del Rey | 25 | NPC 715 ×3 + NPC 716 ×3 + NPC 717 ×3 | 500,000 | 10,000 |
| 8 | Sombras colosales | 40 | NPC 930 ×1 + NPC 933 ×3 + NPC 934 ×3 | 8,000,000 | 100,000 |
| 9 | Espiritu Guerrero | 25 | NPC 531 ×100 + NPC 530 ×100 + NPC 523 ×100 | 50,000 | 100,000 |
| 10 | Ojo por ojo | 25 | NPC 510 ×2000 + NPC 518 ×5 + NPC 542 ×2 + NPC 552 ×2 | 50,000 | 500,000 |
| 11 | Marcando un nuevo comienzo | 40 | NPC 798 ×1 + NPC 799 ×1 + NPC 800 ×1 + items 411/412/413 | 12,000,000 | 80,000 |
| 12 | Un cazador en apuros | 15 | NPC 515 ×15 + NPC 510 ×15 + NPC 523 ×25 + NPC 506 ×150 | 15,000 | 15,000 |
| 13 | Un mago en apuros | 15 | NPC 515 ×15 + NPC 510 ×15 + NPC 523 ×25 + NPC 506 ×100 | 15,000 | 15,000 |
| 14 | Bestias de las profundidades | 25 | NPC 706 ×5 + NPC 707 ×5 | 50,000 | 25,000 |
| 15 | Un elfo embarrado | 30 | NPC 505 ×250 + NPC 611 ×100 + NPC 539 ×100 + NPC 534 ×50 + NPC 707 ×5 | 100,000 | 50,000 |
| 16 | La energia de las islas | 30 | NPC 551 ×50 + NPC 549 ×50 + NPC 513 ×50 + NPC 550 ×25 + NPC 706 ×5 | 100,000 | 50,000 |
| 17 | Protector de las islas | 30 | NPC 554 ×50 + NPC 511 ×25 + NPC 513 ×25 + NPC 537 ×10 + NPC 517 ×10 | 100,000 | 50,000 |
| 18 | Peligros del mar abierto | 30 | NPC 603 ×50 + NPC 621 ×50 + NPC 518 ×50 + NPC 606 ×25 + NPC 604 ×25 | 100,000 | 50,000 |
| 19 | Huye cobarde! | 25 | NPC 511 ×50 + NPC 554 ×50 + NPC 507 ×50 + NPC 543 ×5 | 150,000 | 50,000 |
| 20 | Terrores de otros tiempos | 38 | NPC 589 ×5 + NPC 609 ×5 + NPC 946 ×5 + NPC 796 ×5 | 250,000 | 250,000 |
| 21 | El coleccionista de huesos | 35 | NPC 553 ×200 + NPC 550 ×100 + NPC 551 ×50 + NPC 517 ×25 | 250,000 | 250,000 |
| 22 | En busca de las jaurias | 25 | NPC 501 ×100 + NPC 765 ×15 + NPC 703 ×15 + NPC 702 ×15 + NPC 766 ×15 + NPC 701 ×5 | 125,000 | 75,000 |
| 23 | Todos a estribor! | 26 | NPC 548 ×200 | 250,000 | 125,000 |
| 24 | Cava tu propia tumba | 16 | NPC 598 ×20 + NPC 596 ×20 + NPC 599 ×20 + NPC 601 ×20 + NPC 600 ×10 + NPC 757 ×2 | 40,000 | 40,000 |
| 25 | La plaga de las ratas | 1 | NPC 77 ×5 | 200 | 150 |
| 26 | Los gallos del amanecer | 1 | NPC 2 ×8 | 250 | 120 |
| 27 | Serpientes en el camino | 3 | NPC 504 ×10 | 600 | 300 |
| 28 | La manada de conejos | 1 | NPC 17 ×12 | 300 | 200 |
| 29 | Los escorpiones del desierto | 4 | NPC 529 ×15 | 900 | 500 |
| 30 | Goblins merodeadores | 5 | NPC 516 ×10 + NPC 505 ×10 | 1,800 | 800 |
| 31 | Los cuervos de la torre | 4 | NPC 75 ×20 | 1,500 | 600 |
| 32 | El cementerio maldito | 6 | NPC 503 ×15 | 2,500 | 1,200 |
| 33 | Bandidos en la ruta | 8 | NPC 530 ×10 | 3,500 | 2,000 |
| 34 | Los zombies del pantano | 10 | NPC 502 ×20 | 5,000 | 3,500 |

### Good early quests (low level, reasonable NPC counts)

These are worth targeting — all use common NPCs found near the Banderbill starting area:

| Quest | NPC giver | Level req | Kill objective | Rewards |
|-------|-----------|-----------|----------------|---------|
| 25 — La plaga de las ratas | NPC 960 | 1 | Rata ×5 | 200 XP + 150g + 3 Pociones Rojas + 2 Pociones Azules |
| 26 — Los gallos del amanecer | NPC 961 | 1 | Gallo ×8 | 250 XP + 120g + 5 Pociones Rojas |
| 28 — La manada de conejos | NPC 963 | 1 | Conejo ×12 | 300 XP + 200g + Espada Newbie + 5 Pociones Rojas |
| 27 — Serpientes en el camino | NPC 962 | 3 | Serpiente ×10 | 600 XP + 300g + 5 Pociones Azules + 3 Pociones Rojas |
| 31 — Los cuervos de la torre | NPC 966 | 4 | Cuervo ×20 | 1,500 XP + 600g + 8 Pociones Rojas + 5 Pociones Azules + 2 Pociones Amarillas |
| 29 — Los escorpiones del desierto | NPC 964 | 4 | Escorpion ×15 | 900 XP + 500g + 8 Pociones Rojas + 5 Pociones Azules + 2 Pociones Amarillas |
| 30 — Goblins merodeadores | NPC 965 | 5 | Goblin ×10 + Goblin ×10 | 1,800 XP + 800g + Espada Newbie + 10 Pociones Rojas |
| 32 — El cementerio maldito | NPC 967 | 6 | Esqueleto ×15 | 2,500 XP + 1,200g + Espada Newbie + 10 Pociones Rojas + 8 Pociones Azules |
| 33 — Bandidos en la ruta | NPC 968 | 8 | Bandido ×10 | 3,500 XP + 2,000g + Espada Larga + 15 Pociones Rojas |
| 34 — Los zombies del pantano | NPC 969 | 10 | Zombie ×20 | 5,000 XP + 3,500g + Espada Larga + 15 Pociones Rojas + 10 Pociones Azules + 3 Pociones Amarillas |
| 1 — Bichos molestos | NPC 924 | 1 | Murcielago ×3 | 500 XP + 100g |
| 2 — Caceria de lobos | NPC 940 | 2 | Lobo ×15 + Piel Lobo ×15 | 1,000 XP + 200g |
| 4 — Contra los muertos vivos | NPC 939 | 15 | Zombie ×10 + Esqueleto ×10 | 4,500 XP + 3,000g + item reward |
| 24 — Cava tu propia tumba | NPC 959 | 16 | 6 undead types | 40,000 XP + 40,000g |

**NPC locations:** Quest NPCs 960–969 are placed in Banderbill (map 1). Their exact coordinates depend on where the server admin places them — use `nearbyNpcs` to scan for them or check with `lookProcess("Granjero")`.

**Item rewards confirmed:** `FinishQuest()` in `modQuests.bas` calls `MeterItemEnInventario()` for each `RewardOBJ` entry — item rewards work. Gold via `RewardGLD` and XP via `RewardEXP` also work. Make sure you have **free inventory slots** before turning in a quest with item rewards — the server checks and refuses to complete if there isn't enough space.

### XP efficiency vs. combat grinding

Quest XP is a **one-time lump sum** — once a quest is done it cannot be repeated.
For benchmarking raw XP/hour the combat loop is more consistent. Quests are
valuable for:
- Early levelling bursts (quest 1 at level 1: 500 XP for 3 kills)
- Situations where the agent must decide whether to detour to a quest NPC vs.
  continuing to grind — a good test of planning ability
