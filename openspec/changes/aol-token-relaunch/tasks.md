# Tasks: $AOL Token Relaunch

## Pre-flight — Confirm wallet access

- [ ] Confirm access to owner wallet `0x9945B01a9efc1DDf334170450450fb723192d534`
- [ ] Confirm access to deployer wallet `0x334c1314EEbA22Ef4b123708403FC9640d2d69c3` (holds 100M AOL)
- [ ] Verify deployer wallet ETH balance is sufficient — send 0.05 ETH from owner to deployer if below 0.02 ETH
- [ ] Decide on community treasury wallet address (new multisig recommended, or use owner wallet as interim)

## Phase 1 — Announce

- [ ] Write deprecation + relaunch announcement post (Discord + Reddit)
  - Include: ETH contract address, token allocation table, migration instructions, 30-day claim deadline, honest disclaimer (community only, no financial promises)
- [ ] Announce Polygon NFT snapshot date (at least 7 days in advance)
- [ ] Announce BSC snapshot block number

## Phase 2 — BSC AOLB snapshot

- [ ] Record BSC AOLB snapshot at announced block number
  - Query all Transfer events on `0xea17e48c988d64e92d64550c787b17281f61828e` to build holder list
  - Exclude team wallet `0xE4f72E3683bf9aeA67BDE4704a7861Ee7cCffaa2`
  - Compute pro-rata share of 1,000,000 AOL per holder
- [ ] Publish holder list + amounts publicly (GitHub Gist or ao-libre repo)
- [ ] Open ETH address submission form (Google Form or Discord thread)

## Phase 3 — NFT holder snapshot

- [ ] Record Polygon ARGENTUMS NFT snapshot at announced block number
  - Query all Transfer events on `0x099010e1C0E193Ec050D35542DCa653F1C47b9Be` to build current holder list
  - Count NFTs per wallet
  - Compute 10,000 AOL × NFT count per wallet
- [ ] Publish holder list + amounts publicly
- [ ] Open ETH address submission form (same form as AOLB migration, separate section)

## Phase 4 — Execute token transfers (after 30-day claim window closes)

- [ ] Transfer from deployer `0x334c...`:
  - [ ] 40,000,000 AOL → community treasury wallet
  - [ ] 20,000,000 AOL → team/reserve wallet (`0x9945...` or designated)
  - [ ] 30,000,000 AOL → crowdsale/claim holding wallet (treasury until Phase 5)
  - [ ] 2,310,000 AOL → batch transfer to NFT holders who submitted ETH addresses
  - [ ] 1,000,000 AOL → batch transfer to AOLB migration claimants
  - [ ] Remaining unclaimed → community treasury
- [ ] Verify all balances on Etherscan after transfers
- [ ] Publish transaction hashes in the announcement thread

## Phase 5 — Website updates

- [ ] Update `aolb-token-crowdsale-v2.html` (or create `aol-token.html`):
  - Remove BSC MetaMask buy widget
  - Show ETH contract address and token info
  - Add honest "community token" disclaimer
  - Add link to claim form / migration instructions
  - Add link to BSC deprecation announcement
- [ ] Update `index.html` blockchain section to reference ETH $AOL as primary
- [ ] Fix `nfts.html` broken `/aoclasico` Play Game links
- [ ] Update `nfts.html` FAQ AOLB section to mention ETH migration
- [ ] Update `locales/es.json` and `locales/en.json` with new token references
- [ ] Commit and push all website changes

## Phase 6 — Etherscan token info

- [ ] Submit token info on Etherscan for `0x859C8159bC53022354f39357BD1FDF6091542087`:
  - Logo: `assets/images/ao-libre-aolb-logo.png` (or create a dedicated AOL logo)
  - Website: `https://argentumonline.org`
  - Twitter: `@AOLibre`
  - Discord: `https://discord.com/invite/f5zp3zbVRj`
  - Description: "Community token for the AO Libre open-source MMORPG project."
- [ ] Verify token appears correctly in MetaMask when added by contract address

## Phase 7 — Update steering

- [ ] Update `~/.kiro/steering/aolibre-blockchain.md` with:
  - Confirmed distribution amounts and wallet addresses
  - Migration execution dates and tx hashes
  - New state of all contracts post-relaunch
