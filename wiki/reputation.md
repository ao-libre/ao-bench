# Reputation and Criminal System

Sourced from the ao-libre community wiki (v0.13.x).

---

## Overview

Every character has a reputation made up of several point counters. The net
balance determines whether you are a **Ciudadano (Citizen)** or a
**Criminal**, which affects who can attack you and where you can go safely.

Nick colour tells you another player's status at a glance:
- **Blue** — Ciudadano
- **Red** — Criminal
- **Violet** — Atacable (temporarily attackable, see below)
- **Cyan** — Consejo de Banderbill (Royal Army council)
- **Orange** — Concilio de las Sombras (Legion of Shadows)
- **Other colours** — GMs (Dioses, Semidioses, etc.)

You become **Criminal** when your negative points (Ladrón + Asesino + Bandido)
exceed your positive points (Nobleza + Plebe). Guards in towns will attack and
kill Criminal characters on sight until they return to Citizen status.

---

## Reputation point events

### Actions that gain negative (criminal) points

| Action | Points gained |
|--------|--------------|
| Attack a Citizen player | +100 Bandido, -50% Nobleza and Plebe |
| Kill a Citizen player | +2000 Asesino, Nobleza and Plebe → 0 |
| Attack a non-hostile creature | +100 Bandido |
| Kill a non-hostile creature | +1000 Asesino, +100 Bandido |
| Attack an Imperial Guard | +200 Asesino, Nobleza and Plebe → 0 |
| Paralyze/immobilize a Guard | +500 Asesino, Nobleza and Plebe → 0 |
| Kill an Imperial Guard | +1000 Asesino, +100 Bandido |
| Each steal attempt | +25 Ladrón, +100 Bandido, Nobleza and Plebe → 0 |
| Attack a Citizen's pet | +100 Bandido, Nobleza and Plebe → 0 |
| Cast Celeridad/Fuerza/Curar on a Criminal | +10000 Bandido, -50% Nobleza and Plebe |
| Cast Invisibilidad or Resucitar on a Criminal | +100 Bandido, becomes Criminal, Nobleza/Plebe → 0 |

### Actions that gain positive (noble) points

| Action | Points gained |
|--------|--------------|
| Kill a hostile creature | +500 Nobleza |
| Kill a Chaos Guard | +500 Nobleza |
| Resurrect a Citizen player | +500 Nobleza |
| Kill a Criminal's pet | +500 Nobleza |
| Kill your own pet (only if Criminal) | +500 Nobleza |
| Use work tools (Talar, Pesca, etc.) | +2 Plebe per use |

**Note:** You can only gain Nobleza points while your "seguro" (safe lock) is active.

---

## How to become Criminal

Triggering any of these turns you Criminal immediately:
- Attacking an Imperial Guard
- Attacking a Citizen player
- Stealing from a Citizen
- Attacking non-hostile creatures
- Attacking your own pet or a Citizen's pet

---

## How to return to Citizen

You need your positive points (Nobleza + Plebe) to exceed the sum of all negative points (Ladrón + Asesino + Bandido).

Ways to do this:
- Gain Nobleza by killing hostile creatures or doing good deeds
- Gain Plebe by using work skills
- Getting killed by Imperial Guards or Imperial Priests reduces negative points:
  - −100 Bandido or −50 Ladrón per death

**Important:** There is NO way to reduce Asesino points. Every player kill permanently accumulates. If you kill Citizens repeatedly you can never fully recover.

---

## Atacable (violet) status

A separate temporary state triggered by attacking an NPC that belongs to another player (see creature ownership system below). Shown as a **violet nickname**.

- You become atacable when you attack a creature owned by another player
- Lasts 1 minute from the last time you attacked; extends by 1 minute if you keep attacking
- Disappears when you log out
- While violet: the creature's owner can attack you without gaining criminal points
- If the owner attacks you (any damage, immobilize, or spells), you can attack them back for 1 minute
- You cannot steal another owned creature while already violet (except the original one)
- You cannot attack Citizens while violet (except the owner who retaliated)
- The status clears when you log out; the seguro auto-activates when it expires

---

## Creature ownership system

When you attack a hostile NPC, you "own" it for 18 seconds:
- Ownership resets to 18 seconds each time you hit it
- You lose ownership if you die, leave the map, or attack a different NPC
- Attacking another player's owned NPC makes you **violet/atacable**
- Party and clan members can attack each other's owned NPCs freely (still limited to one NPC per person at a time)
- High-level players (6+ levels above) that steal a low-level player's NPC gain Ladrón points

---

## Combat and status rules

**Who can attack who** (with seguro OFF):
- **Ciudadano** can attack: Criminals, Legión Oscura members
- **Ejército Real member** can attack: Criminals, Legión Oscura members
- **Legión Oscura member** can attack: anyone except their own faction
- **Criminal** can attack: everyone

**Safe zones:** Cities are safe zones — no player-vs-player combat regardless of seguro state.

**Map transition grace period:** When entering a new map, hostile creatures ignore you for 5 seconds, unless you speak, move, or attack first.

**Combat damage:** All damage and defense rolls are random ranges (e.g. a weapon with 8/12 damage deals between 8 and 12). Hit chance, dodge, and damage are all influenced by level, class, Agilidad and Fuerza attributes, and skill points.

---

## Practical implications for agents

- **Never attack non-hostile NPCs** (Civilian type in npcs.md) — massive criminal reputation penalty, hard to recover
- **Never attack other players with seguro OFF** unless they are already Criminal or Legionarios
- **Killing hostile creatures** is always safe for reputation and gains +500 Nobleza each
- **Going Criminal in a city** will get you killed by guards immediately — avoid cities while Criminal
- **Newbie status (levels 1–12):** cannot enter Nemahuak city after reaching level 13; newbie items disappear at level 13
