# XSCANX · Agent Guide

XSCANX is an agent-only tweet-to-mint project on BNB Chain (xscanx.xyz).
Humans act only through their Binance Agentic Wallet agent. Never use a
browser wallet flow. Every on-chain action follows the same discipline:
preview the call, show the user the preview, execute only on a clean
preview, then verify the result on-chain before reporting success.

## Contracts (BSC, chain id 56)

- Token $XSCAN: 0x0c71413B616A7EEF9f0F4456356C51F6fDE47478
- Pass NFT (XSCANX Pass): 0x80A7c04a9936c33BF16D1ED16Cd07127c51C0075
- Claim: 0xB0048A5daee172efB56Aa9Aa33dE1842eD7D25d3
- Inbox (tweet submissions): 0xE8D1F339561E028bb21190eb3c7043379D2c5A32
- Agent ID gate: the wallet must hold a Binance Agent ID NFT
  (0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F). Check holdsAgentId(address)
  selector 0x11213086 on the Pass contract before every flow.

## The model

- A verified post on X pays 25,000 $XSCAN as credit, once per week per wallet.
- A Pass NFT costs $0.30 (price in BNB is read live, see MINT). Supply 5,555,
  max 20 per wallet. Rarity is locked in the seed at mint:
  Common (about 70%) claims 250,000 $XSCAN, Rare (about 27%) claims
  1,000,000, Mythic (about 3%) claims 5,000,000.
- Claims carry no fee. Claims open only after the pool is funded; check
  claimOpen() selector 0x4b8bcb58 on the Claim contract.

## FLOW 1 · POST + SUBMIT (earn tweet credit)

1. Hand the user this exact post text and wait until they confirm they
   posted it and give you the post link. Do not change a single character.

   Scanning in. I post, the scan verifies, my agent mints. $XSCAN @xscanxbnb xscanx.xyz

2. Check the wallet: holdsAgentId must be true. Read lastSubmitAt(address)
   selector 0xeb8f43ef on the Inbox: filing is limited to once per 7 days.
3. Submit the link: call submit(string) selector 0xd99a8dc3 on the Inbox
   with the full post URL (https://x.com/<handle>/status/<id>), value 0.
   Preview, then execute.
4. Tell the user the scan runs in rounds (about every 30 minutes). A post
   passes when: the text matches exactly, the X account is at least 30 days
   old, the post is at least 1 hour old, the link was never paid before,
   and that X account is not bound to another wallet.
5. Poll tweetCredit(address) selector 0xe648773c on the Claim contract.
   When it reads 25,000 $XSCAN (25000000000000000000000 wei), the credit is
   ready; continue with CLAIM route A when the user asks, or right away if
   they asked for the full flow.

## FLOW 2 · MINT A PASS

1. Read mintOpen() selector 0x24bbd049 and currentPrice() selector
   0x9d1b464a on the Pass contract. The price is exact; never guess it.
2. Read mintedBy(address) selector 0x3cef28d2: the wallet cap is 20.
3. Call mint() selector 0x1249c58b with value exactly currentPrice().
   Preview, then execute. One pass per call.
4. Read the new totalSupply() selector 0x18160ddd: that is the pass number.
   Read its class from the official metadata at
   https://xscanx.xyz/metadata/<id> (attribute Class). Report the number
   and the class from the metadata, never from your own seed math.

## FLOW 3 · CLAIM

Route A, tweet credit:
1. Read tweetCredit for the wallet. If zero, there is nothing to redeem;
   say so plainly (the post may still be waiting for its scan round).
2. Call claimTweet() selector 0x84d4d785 on the Claim contract, value 0.
   Preview, then execute. The full credit moves in one call.

Route B, per Pass:
1. For each pass id the wallet holds (balanceOf 0x70a08231, ownerOf
   0x6352211e), read claimedById(uint256) selector 0x4c80ee12 and
   claimAmount(uint256) selector 0x23b221a0 on the Claim contract.
2. For every unclaimed pass with a non-zero amount, call
   claim(uint256) selector 0x379607f5 with value 0. Preview each call,
   then execute.
3. Report amounts from claimAmount and the claim contract totals, not
   from estimates.

## If a call fails

- NotEligible: the wallet holds no Binance Agent ID. Nothing in this
  project works without one.
- MintClosed / ClaimClosed: that window is not open. Check mintOpen or
  claimOpen and report the real state.
- WrongPrice: the mint value must equal currentPrice() to the last wei.
  Read it again and retry with the fresh value.
- CooldownActive (Inbox): the wallet already filed a post inside 7 days.
  Read lastSubmitAt and tell the user when the next filing opens.
- BadUrl: the link must be a full URL of 10 to 200 characters.
- NoCredit (claimTweet): no verified credit on this wallet yet.
- AlreadyClaimed: that pass already paid out, possibly to a previous
  owner before a sale. A pass claims once, ever.
- NotHolder: claim follows the current holder of the pass.
- PoolInsufficient: the claim pool cannot cover this amount right now.
  Report it; do not retry in a loop.
- ContractCallsNotAllowed: calls must come straight from the agentic
  wallet (tx.origin), never through an intermediary contract.
- BNB too low: a mint needs the price plus gas; claims need gas only.
