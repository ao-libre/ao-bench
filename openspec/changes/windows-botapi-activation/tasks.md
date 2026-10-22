# Tasks

## 1. Pull latest on Windows VM

- [ ] 1.1 On Windows VM (192.168.22.51), open a terminal in the `ao-server` directory, run `git fetch origin && git checkout aobench && git pull origin aobench`; verify `git log --oneline -1` shows commit `611f99ef BotAPI: full coverage + quest NPC assignments`
- [ ] 1.2 In the `ao-bench` directory, run `git pull origin main`; verify `git log --oneline -1` shows commit `f057877 fix: update gateway test WorldState to include new required fields`

## 2. Stop the running server

- [ ] 2.1 Stop the running `server.exe` process on the Windows VM before recompiling; confirm port 4200 is no longer bound (use `netstat -ano | findstr :4200`)

## 3. Recompile the VB6 server

- [ ] 3.1 In the `ao-server` directory, run `ai_build_vb6.cmd`; confirm the script invokes `vb6.exe /make` with the `BOT_SERVER=1` conditional compilation flag
- [ ] 3.2 Open `vb6build.log` after the build completes; verify it contains no compilation errors and ends with a success line; if there are errors, fix the VB6 source and repeat 3.1
- [ ] 3.3 Confirm the compiled `server.exe` file modification timestamp matches the current build time (not the old binary)

## 4. Verify DAT files

- [ ] 4.1 Run `findstr "NumQuests" Dat\Quests.DAT`; verify the output is `NumQuests=24`
- [ ] 4.2 Run `findstr /n "QuestNumber" Dat\NPCs.dat`; verify there are exactly 24 lines and that three of them appear early in the file at NPCs 128, 137, and 143 (not in the 924–959 range for those three quests)
- [ ] 4.3 Run `findstr "QuestNumber=22" Dat\NPCs.dat` and confirm it appears once for NPC 128 (Nelmasil); repeat for `QuestNumber=23` → NPC 137, `QuestNumber=24` → NPC 143
- [ ] 4.4 Run `findstr "QuestNumber" Dat\NPCs.dat` and confirm NPCs 957, 958, 959 do NOT appear in the results (their quest numbers were removed)

## 5. Start the server and confirm BotAPI is live

- [ ] 5.1 Start `server.exe`; watch the console for DAT loading messages; confirm no errors for `Quests.DAT` or `NPCs.dat`
- [ ] 5.2 Confirm port 4200 is open: `netstat -ano | findstr :4200` should show a LISTENING entry
- [ ] 5.3 Log in a test bot character using the existing provisioner or manually; confirm the character appears online in the server console

## 6. Smoke test new getState fields

- [ ] 6.1 Send `{"action":"getState","charname":"<BotName>"}` to port 4200; parse the response JSON; verify all 11 new fields are present: `expNeeded`, `skillPts`, `assignedSkills`, `attributes`, `spells`, `bank`, `bankGold`, `faction`, `reputation`, `party`, `quests`
- [ ] 6.2 Verify `skillPts` is `10` and `assignedSkills` is `0` for a freshly created bot character
- [ ] 6.3 Verify `spells` is an array of 35 elements (some null, some with `spellId`/`name`/`minSkill`/`manaCost`)
- [ ] 6.4 Verify `quests` is `{"active":[],"doneIds":[]}` for a fresh character
- [ ] 6.5 Verify `faction` is `"none"` for a fresh character

## 7. Smoke test new actions

- [ ] 7.1 Send `{"action":"assignSkillPoints","charname":"<BotName>","distribution":{"Armas":5,"Defensa":3,"Tacticas":2}}`; verify response is `{"ok":true,"pointsSpent":10}`; send `getState` again and verify `skillPts` is now `0` and `assignedSkills` is `10`
- [ ] 7.2 Walk the bot to within 5 tiles of NPC 128 (Nelmasil, map 1 approx x=65,y=50); send `{"action":"quest","charname":"<BotName>","x":65,"y":50}`; verify response is `ok:true` and includes offered quest name
- [ ] 7.3 Send `{"action":"questAccept","charname":"<BotName>"}`; send `getState`; verify `quests.active` contains one entry for quest 22 with `npcProgress: [{npcId:501,required:10,killed:0}]`
- [ ] 7.4 Walk the bot to map 8 or 9 (Lobo spawns), kill 10 Lobos; send `getState` and verify `quests.active[0].npcProgress[0].killed` increments with each kill until it reaches 10
- [ ] 7.5 Walk the bot back to NPC 128; send `{"action":"quest","charname":"<BotName>","x":65,"y":50}`; verify response includes `completed:true` and XP grant; verify `exp` increased by 2000 and `gold` increased by 1500
- [ ] 7.6 Send `getState`; verify `quests.active` is empty and `quests.doneIds` contains `[22]`

## 8. Update ao-bench packages on Windows

- [ ] 8.1 In the `ao-bench` directory, run `pnpm install`; verify no errors
- [ ] 8.2 Run `pnpm -r --filter '!@aobench/leaderboard' test --run`; verify all 157 tests pass across 6 packages (sdk: 80, mock-server: 27, gateway: 6, harness: 29, wiki-extractor: 15)

## 9. Restart the gateway

- [ ] 9.1 Stop the running gateway process if active
- [ ] 9.2 Start the gateway from `packages/gateway`; verify it connects to port 4200 and logs a successful BotAPI connection
- [ ] 9.3 Connect a bot via the SDK (`new AOBot(...).connect()`); call `bot.getState()` and verify the returned `WorldState` object includes all new fields (TypeScript types will enforce this at compile time)

## 10. End-to-end quest task via SDK

- [ ] 10.1 Write a short bot script that: checks `getState().assignedSkills < 10`, calls `assignSkillPoints()` if needed, walks to NPC 128, calls `quest()` + `questAccept()`, walks to map 8, kills 10 Lobos in a loop (checking `quests.active[0].npcProgress[0].killed`), walks back and calls `quest()` to hand in; run it with the harness; verify XP is awarded and the quest appears in `doneIds`
- [ ] 10.2 Run the harness with the `magia-xp` task to confirm existing skill-based tasks still work correctly after the server update
