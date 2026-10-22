# Spec: $AOL Token Relaunch

## Contracts

**Requirement: The existing $AOL contract is used as-is**
No new contract is deployed. The token at `0x859C8159bC53022354f39357BD1FDF6091542087` is the canonical AOL token. Its name (`AOLibre`), symbol (`AOL`), and decimals (18) are not changed.

**Requirement: The BSC $AOLB crowdsale contract is not used**
No new transactions are sent to `0xef7729284D0EbadFF2C27B654513426749cC9732`. It is abandoned in place.

**Requirement: The BSC $AOLB token contract is not touched**
The BSC token (`0xea17e48c988d64e92d64550c787b17281f61828e`) remains on-chain but is publicly declared deprecated. No burn or migration is executed on-chain for BSC — it is simply abandoned.

---

## Phase 1 — Distribution setup

**Requirement: Deployer wallet is topped up before any transfers**
The deployer `0x334c...` must receive at least 0.05 ETH from the owner wallet `0x9945...` before any token transfers are executed, to cover gas costs.

**Requirement: Token allocation matches the proposal**
After distribution, the token allocation across wallets must match:

| Bucket | Amount (AOL) | Destination |
|---|---|---|
| Community treasury | 40,000,000 | A new dedicated multisig or AO Libre team wallet |
| NFT holder airdrop | 2,310,000 | Individual NFT holder wallets (231 × 10,000) |
| AOLB migration airdrop | 1,000,000 | Individual BSC holder wallets pro-rata |
| Team / project reserve | 20,000,000 | Owner wallet `0x9945...` or a designated reserve wallet |
| Public claim / crowdsale | 30,000,000 | A new claim contract or held in treasury pending website launch |
| Unallocated remainder | 6,690,000 | Remains in deployer or treasury pending future decisions |

**Requirement: All distribution transactions are publicly announced**
Before executing any transfer, a post is made on Discord and Reddit (`r/argentumonlineoficial`) announcing the wallet addresses and amounts. Transactions are traceable on Etherscan.

---

## Phase 2 — BSC AOLB migration

**Requirement: A BSC snapshot is taken before the migration**
At a publicly announced block number, the AOLB holder list is snapshotted. The AO Libre team wallet (`0xE4f72E3683bf9aeA67BDE4704a7861Ee7cCffaa2`) is excluded from the airdrop.

**Requirement: Migration airdrop is pro-rata**
Each non-team AOLB holder receives: `(their_AOLB_balance / total_non_team_supply) × 1,000,000 AOL`

**Requirement: Migration requires holders to submit an ETH address**
Because BSC and Ethereum addresses may differ in ownership (different private keys), holders must submit their Ethereum wallet address via a form (Discord or website). A deadline of 30 days from announcement applies.

**Requirement: Unclaimed migration tokens go to community treasury**
Any of the 1,000,000 AOL not claimed within 30 days is transferred to the community treasury.

---

## Phase 3 — NFT holder airdrop

**Requirement: 231 ARGENTUMS NFT holders receive 10,000 AOL each**
Each wallet holding at least 1 ARGENTUMS NFT (`0x099010e1C0E193Ec050D35542DCa653F1C47b9Be` on Polygon) at snapshot block receives 10,000 AOL on Ethereum.

**Requirement: Snapshot block is publicly announced 7 days in advance**
The Polygon block number used for the snapshot is announced on Discord and Reddit at least 7 days before it is taken.

**Requirement: NFT airdrop requires an ETH address submission**
Same mechanism as AOLB migration — holders submit their Ethereum address. 30-day claim window. Unclaimed goes to community treasury.

**Requirement: A holder can receive at most 10,000 AOL per NFT they hold**
If a wallet holds 3 NFTs, it receives 30,000 AOL. No cap per wallet, but pro-rated per NFT.

---

## Phase 4 — Website updates

**Requirement: The crowdsale page is updated to reflect ETH AOL**
`aolb-token-crowdsale-v2.html` is updated (or a new page `aol-token.html` is created) to:
- Show the ETH contract address, not BSC
- Explain the token honestly (community only, no financial promises)
- Include a link to the claim/airdrop form
- Include links to the BSC deprecation announcement
- Not include a buy/swap widget until a crowdsale contract is deployed

**Requirement: The main index.html is updated**
The blockchain section on `index.html` references `$AOL` on Ethereum, not `$AOLB` on BSC as the primary token.

**Requirement: The nfts.html page is updated**
The broken `/aoclasico` links for "Play Game" are replaced with working links. The FAQ AOLB section is updated to mention the migration to ETH.

---

## Phase 5 — Public crowdsale (future, separate change)

This phase is out of scope for this change. It requires:
- A new crowdsale/claim contract on Ethereum
- Audit or review of the contract before funding it
- A separate openspec change: `aol-token-crowdsale-eth`

---

## Communication requirements

**Requirement: A deprecation notice is published for $AOLB**
A Reddit post on `r/argentumonlineoficial` and a Discord announcement explicitly states:
- BSC $AOLB is deprecated
- Contract address of the new ETH $AOL
- Migration instructions and deadline
- That $AOL is a community token with no financial promises

**Requirement: Etherscan token info is updated**
After distribution, the owner submits token info to Etherscan (logo, website, social links) so $AOL appears correctly in wallets and explorers.
