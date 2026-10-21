# Spec Delta

## Purpose

Three developer-facing CLI tools — `create-bot` (scaffolds a ready-to-run bot directory), `cli` (dumps live WorldState as human-readable text for debugging), and `bug-report` (one-command report submission from inside a bot script) — matching rs-sdk's tooling pattern adapted for Argentum Online.

## ADDED Requirements

### Requirement: create-bot scaffolds a bot directory with credentials and script template
`create-bot [username]` SHALL create `bots/<username>/` containing `bot.env` (server address, charname, password) and `script.ts` (starter script importing @aobench/sdk with a working example). If no username is given, a random 9-character alphanumeric name is generated.

#### Scenario: Bot directory created with generated name
- **WHEN** `bun create-bot` is run with no arguments
- **THEN** `bots/<random>/bot.env` and `bots/<random>/script.ts` exist with valid content

#### Scenario: Bot directory created with specified name
- **WHEN** `bun create-bot mybot` is run
- **THEN** `bots/mybot/bot.env` and `bots/mybot/script.ts` exist

#### Scenario: Duplicate name rejected
- **WHEN** `bun create-bot mybot` is run and `bots/mybot/` already exists
- **THEN** the command exits with an error and creates no files

#### Scenario: Name too long rejected
- **WHEN** a username longer than 12 characters is provided
- **THEN** the command exits with an error explaining the ao-libre character name limit

### Requirement: cli dumps WorldState as human-readable text
`bun sdk/cli.ts <charname>` SHALL connect to the gateway as an observer, print the current WorldState as formatted text (matching the rs-sdk CLI output style), and exit.

#### Scenario: State dumped for connected bot
- **WHEN** `bun sdk/cli.ts bot1` is run while bot1 is connected
- **THEN** output shows: `# World State`, position, HP, mana, gold, skills with levels, inventory items, nearby NPCs with health status

#### Scenario: Unknown bot returns error
- **WHEN** `bun sdk/cli.ts unknownbot` is run
- **THEN** the command prints an error and exits with a non-zero code

### Requirement: cli supports --watch mode for live tailing
`bun sdk/cli.ts <charname> --watch` SHALL subscribe to state updates and re-print the WorldState each time it changes, until interrupted with Ctrl-C.

#### Scenario: Watch mode prints updates
- **WHEN** `bun sdk/cli.ts bot1 --watch` is running and the bot moves
- **THEN** the updated state is printed to stdout

### Requirement: bug-report submits a report from a script
`await sdk.bugReport("description of the issue")` SHALL POST a bug report to `aobench.argentumonline.org/api/bugs` including the description, current WorldState, SDK version, and a recent action log.

#### Scenario: Bug report submitted from within a script
- **WHEN** `await bot.bugReport("attack() did not initiate combat when NPC was targeted")` is called
- **THEN** the report is POSTed to the leaderboard API and a confirmation message with the report ID is printed

#### Scenario: Bug report never throws
- **WHEN** `bugReport` is called and the API is unreachable
- **THEN** the call resolves without throwing so the script continues running
