# Proposal: $AOL Token Relaunch — Ethereum

## Background

AO Libre has two existing blockchain tokens, both inactive:

- **$AOL (Ethereum ERC-20):** `0x859C8159bC53022354f39357BD1FDF6091542087` — 100M supply, mintable, pausable, never distributed. Entire supply sits in deployer wallet. Zero transfers ever.
- **$AOLB (BSC BEP-20):** `0xea17e48c988d64e92d64550c787b17281f61828e` — 100B supply, 99.9% in one wallet, no market, never traded. Crowdsale contract broken (empty, all calls revert).

The goal is to relaunch the community token properly using the existing $AOL contract on Ethereum as the base, deprecate $AOLB on BSC, and migrate any AOLB holders to AOL.

## Goal

Launch $AOL as a genuine community token for AO Libre — **pure joy, no financial promises.** The token represents participation in the AO Libre community. No play-to-earn, no staking yield promises, no metaverse. Simple and honest.

## Token Facts (existing contract)

- **Contract:** `0x859C8159bC53022354f39357BD1FDF6091542087` (Ethereum mainnet)
- **Name:** AOLibre
- **Symbol:** AOL
- **Supply:** 100,000,000 (100M), 18 decimals
- **Mintable:** yes (owner can mint more)
- **Pausable:** yes (owner can pause transfers)
- **Owner wallet:** `0x9945B01a9efc1DDf334170450450fb723192d534` (~3 ETH available)
- **Deployer wallet:** `0x334c1314EEbA22Ef4b123708403FC9640d2d69c3` (holds all 100M AOL, 0.009 ETH)

## Approach

### Phase 1 — Distribution setup
Establish a clear, honest token allocation. Initial 100M supply is already minted. Mint additional tokens as needed per the allocation below.

### Phase 2 — BSC AOLB migration
Take a snapshot of AOLB holders on BSC. Any holder (excluding the AO Libre team wallet) gets a proportional airdrop of AOL on Ethereum. Given near-zero real holders, this is largely a formality — but done publicly to be credible.

### Phase 3 — NFT holder airdrop
ARGENTUMS NFT holders (231 minted on Polygon) get a free AOL airdrop as a reward for early belief in the project. Each NFT holder gets a fixed amount per NFT held.

### Phase 4 — Community distribution
Remaining tokens distributed through:
- Discord activity rewards
- In-game participation (future, when server integration exists)
- Open claim page on the website

### Phase 5 — Crowdsale page
Update `aolb-token-crowdsale-v2.html` to become the new AOL page on Ethereum, replacing the BSC crowdsale.

## Token Allocation (proposed, 100M initial + mint as needed)

| Bucket | Amount | % | Purpose |
|---|---|---|---|
| Community treasury | 40M | 40% | Discord rewards, events, ongoing distribution |
| NFT holder airdrop | 2.31M | 2.31% | 10,000 AOL per ARGENTUMS NFT (231 minted × 10,000) |
| AOLB migration airdrop | 1M | 1% | Pro-rata to real BSC holders (excluding team wallet) |
| Team / project reserve | 20M | 20% | AO Libre operations, future development |
| Public claim / crowdsale | 30M | 30% | Anyone can claim/buy via website |
| Buffer for future mint | — | — | Mintable if needed, announced publicly |

## What is out of scope

- Staking rewards — not promised
- Play-to-earn — not promised
- Metaverse — not promised
- Listing on exchanges — not promised
- Financial returns of any kind

The token is a community badge. Hold it because you love AO Libre.

## Wallets needed

| Wallet | Role | Has access? |
|---|---|---|
| `0x9945...` (owner) | Controls contract: pause, mint | To confirm |
| `0x334c...` (deployer) | Holds all 100M AOL currently | To confirm |

Both are required. The deployer needs ETH for gas (currently has 0.009 ETH — needs top-up of ~0.05 ETH from owner wallet before executing transfers).
