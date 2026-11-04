// XSCANX chain reader + tools. Read-only. RPC race over public BSC endpoints.
const PASS = "0x80A7c04a9936c33BF16D1ED16Cd07127c51C0075";
const CLAIM = "0xB0048A5daee172efB56Aa9Aa33dE1842eD7D25d3";
const INBOX = "0xE8D1F339561E028bb21190eb3c7043379D2c5A32";
const RPCS = ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed-public.bnbchain.org", "https://bsc-mainnet.public.blastapi.io", "https://bsc-rpc.publicnode.com", "https://bsc-dataseed2.binance.org"];
const SEL = {
  totalSupply: "0x18160ddd", mintOpen: "0x24bbd049", mintedBy: "0x3cef28d2", holdsAgentId: "0x11213086",
  balanceOf: "0x70a08231", ownerOf: "0x6352211e", rarityClassOf: "0xcd08c0d6",
  claimOpen: "0x4b8bcb58", totalClaimed: "0xd54ad2a1", poolBalance: "0x96365d44",
  claimAmount: "0x23b221a0", claimedById: "0x4c80ee12", tweetCredit: "0xe648773c",
  totalTweetClaimed: "0xab4d6618", tweetClaimCount: "0xb937e640",
  lastSubmitAt: "0xeb8f43ef", totalSubmissions: "0xa3954016"
};
const TOPICS = {
  submitted: "0xce255437b539273ba658d8f3d35842602c32bfe42220793ce6d7340d5407f8c0",
  minted: "0x25b428dfde728ccfaddad7e29e4ac23c24ed7fd1a6e3e3f91894a9a073f5dfff",
  claimed: "0x987d620f307ff6b94d58743cb7a7509f24071586a77759b77c2d4e29f75a2f9a",
  tweetClaimed: "0x051b89df48f773ddc509ca60b831d0b32d8344729dbf18662ab1e3bcd392e57e"
};
const pad = (a) => a.toLowerCase().replace("0x", "").padStart(64, "0");
const u256 = (id, v) => BigInt("0x" + v.toString(16).padStart(64, "0"));
const fmt = (n) => n.toLocaleString("en-US");
const tok = (wei) => fmt(Number(wei / 10n ** 18n));
async function rpc(method, params) {
  const tries = RPCS.map(async (u) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: ctl.signal });
      const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
    } finally { clearTimeout(t); }
  });
  return Promise.any(tries);
}
async function call(to, data) { const r = await rpc("eth_call", [{ to, data }, "latest"]); return BigInt(r); }
async function callAddr(to, data) { const r = await rpc("eth_call", [{ to, data }, "latest"]); return "0x" + r.slice(-40); }
const $ = (id) => document.getElementById(id);

// demo scan animation
(function demo() {
  const el = $("demoLog"); if (!el) return;
  const lines = [
    '<div>› opening post x.com/···/status/···</div>',
    '<div>› handle <span class="ok">@yourhandle</span> · account age <span class="ok">412 days</span></div>',
    '<div>› content match <span class="ok">$XSCAN ✓</span> · <span class="ok">@xscanxbnb ✓</span> · <span class="ok">xscanx.xyz ✓</span></div>',
    '<div>› wallet gate <span class="ok">Agent ID ✓</span> · double-claim <span class="ok">clear ✓</span></div>',
    '<div class="pay">› VERDICT · PAID 25,000 $XSCAN</div>'
  ];
  let i = 0; el.innerHTML = "";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function step() {
    if (i < lines.length) { el.innerHTML += lines[i]; i++; setTimeout(step, reduced ? 60 : 620); }
    else setTimeout(() => { el.innerHTML = ""; i = 0; step(); }, 4200);
  }
  step();
})();

// copy post
$("copyPost")?.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("postText").textContent.trim()); $("copyPost").textContent = "COPIED"; setTimeout(() => $("copyPost").textContent = "COPY THE POST", 1800); } catch (e) {}
});

// copy mint promo
$("copyPromo")?.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("promoText").textContent.trim()); $("copyPromo").textContent = "COPIED"; setTimeout(() => $("copyPromo").textContent = "COPY THE MINT PROMO", 1800); } catch (e) {}
});

// live ledgers
async function refresh() {
  try {
    const [minted, open, claimed, pool, twCount, twPaid] = await Promise.all([
      call(PASS, SEL.totalSupply), call(PASS, SEL.mintOpen), call(CLAIM, SEL.totalClaimed),
      call(CLAIM, SEL.poolBalance), call(CLAIM, SEL.tweetClaimCount), call(CLAIM, SEL.totalTweetClaimed)
    ]);
    $("hMinted").textContent = fmt(Number(minted)) + " / 5,555";
    $("hTweetPaid").textContent = tok(twPaid) + " $XSCAN";
    $("hClaims").textContent = fmt(Number(claimed));
    $("pMinted").textContent = fmt(Number(minted)) + " / 5,555";
    $("pStatus").textContent = open === 1n ? "OPEN" : "CLOSED";
    const cOpen = await call(CLAIM, SEL.claimOpen);
    $("cStatus").textContent = cOpen === 1n ? "OPEN" : "OPENING SOON";
    $("cPool").textContent = tok(pool);
    $("cTweet").textContent = fmt(Number(twCount));
    $("cPass").textContent = fmt(Number(claimed));
  } catch (e) { /* keep last values */ }
}
refresh(); setInterval(refresh, 30000);

// wallet check
$("checkWallet")?.addEventListener("click", async () => {
  const v = $("walletInput").value.trim(); const out = $("walletResult");
  out.style.display = "block";
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) { out.innerHTML = "That is not a wallet address. Paste a full 0x address."; return; }
  out.innerHTML = "Scanning…";
  try {
    const [agent, passes, credit, last] = await Promise.all([
      call(PASS, SEL.holdsAgentId + pad(v)), call(PASS, SEL.balanceOf + pad(v)),
      call(CLAIM, SEL.tweetCredit + pad(v)), call(INBOX, SEL.lastSubmitAt + pad(v))
    ]);
    let cd = "ready to file a post";
    if (last > 0n) {
      const next = Number(last) + 7 * 24 * 3600; const now = Math.floor(Date.now() / 1000);
      cd = next > now ? "next filing opens in " + Math.ceil((next - now) / 3600) + "h" : "ready to file a post";
    }
    out.innerHTML = "Agent ID: <b>" + (agent === 1n ? "held" : "NOT held") + "</b> · Passes: <b>" + passes.toString() + "</b> · Tweet credit waiting: <b>" + tok(credit) + " $XSCAN</b> · Filing: <b>" + cd + "</b>";
  } catch (e) { out.innerHTML = "Scan failed. Check the address and try again."; }
});

// pass check
$("checkPass")?.addEventListener("click", async () => {
  const v = parseInt($("passInput").value.trim(), 10); const out = $("passResult");
  out.style.display = "block";
  if (!v || v < 1 || v > 5555) { out.innerHTML = "Pass numbers run from 1 to 5,555."; return; }
  out.innerHTML = "Scanning…";
  try {
    const minted = await call(PASS, SEL.totalSupply);
    if (BigInt(v) > minted) { out.innerHTML = "Pass #" + v + " has not been minted yet. " + minted.toString() + " minted so far."; return; }
    const idHex = "0x" + SEL.claimAmount.slice(2) + v.toString(16).padStart(64, "0");
    const [owner, cls, amt, done] = await Promise.all([
      callAddr(PASS, SEL.ownerOf + v.toString(16).padStart(64, "0")),
      call(PASS, SEL.rarityClassOf + v.toString(16).padStart(64, "0")),
      call(CLAIM, idHex), call(CLAIM, SEL.claimedById + v.toString(16).padStart(64, "0"))
    ]);
    const names = ["Common", "Rare", "Mythic"];
    out.innerHTML = "Pass #" + v + " · Class: <b>" + names[Number(cls)] + "</b> · Claim value: <b>" + tok(amt) + " $XSCAN</b> · Status: <b>" + (done === 1n ? "already claimed" : "unclaimed") + "</b> · Holder: <b>" + owner.slice(0, 6) + "…" + owner.slice(-4) + "</b>";
  } catch (e) { out.innerHTML = "Scan failed. Try again in a moment."; }
});

// live posts feed (dari event Inbox: URL ada di data)
function decodeUrl(data) {
  try {
    const hex = data.slice(2);
    const len = Number(BigInt("0x" + hex.slice(64, 128)));
    const bytes = hex.slice(128, 128 + len * 2);
    const arr = new Uint8Array(bytes.match(/.{2}/g).map((b) => parseInt(b, 16)));
    return new TextDecoder().decode(arr);
  } catch (e) { return ""; }
}
async function livePosts() {
  const el = $("livePosts"); if (!el) return;
  try {
    const head = Number(await rpc("eth_blockNumber", []));
    const from = "0x" + Math.max(0, head - 20000).toString(16);
    const ls = await rpc("eth_getLogs", [{ address: INBOX, topics: [TOPICS.submitted], fromBlock: from, toBlock: "latest" }]).catch(() => []);
    const rows = ls.slice(-6).reverse();
    if (!rows.length) { el.innerHTML = '<div class="empty">No posts filed yet. The first scan starts with yours.</div>'; return; }
    el.innerHTML = rows.map((l) => {
      const url = decodeUrl(l.data);
      const m = url.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/status\/(\d+)/i);
      const w = "0x" + l.topics[1].slice(-40);
      const label = m ? "@" + m[1] : "post";
      const href = url.startsWith("http") ? url : "#";
      return '<div class="row"><a href="' + href + '" target="_blank" rel="noopener">' + label + '</a><span class="meta">' + w.slice(0, 6) + "…" + w.slice(-4) + " · block " + fmt(Number(l.blockNumber)) + "</span></div>";
    }).join("");
  } catch (e) { el.innerHTML = '<div class="empty">Live posts unavailable right now.</div>'; }
}
livePosts(); setInterval(livePosts, 60000);

// latest passes (dari event Minted di Pass)
async function latestPasses() {
  const el = $("latestPasses"); if (!el) return;
  try {
    const head = Number(await rpc("eth_blockNumber", []));
    const from = "0x" + Math.max(0, head - 20000).toString(16);
    const ls = await rpc("eth_getLogs", [{ address: PASS, topics: [TOPICS.minted], fromBlock: from, toBlock: "latest" }]).catch(() => []);
    const rows = ls.slice(-8).reverse();
    if (!rows.length) { el.innerHTML = '<span class="empty">No passes minted yet. Mint is open, the first chips land here.</span>'; return; }
    const names = ["COMMON", "RARE", "MYTHIC"]; const cls = ["common", "rare", "mythic"];
    const items = await Promise.all(rows.map(async (l) => {
      const id = Number(BigInt("0x" + l.data.slice(2, 66)));
      let c = 0;
      try { c = Number(await call(PASS, SEL.rarityClassOf + id.toString(16).padStart(64, "0"))); } catch (e) {}
      return { id, c };
    }));
    el.innerHTML = items.map((it) => '<span class="chip ' + cls[it.c] + '">#' + it.id + " <small>" + names[it.c] + "</small></span>").join("");
  } catch (e) { el.innerHTML = '<span class="empty">Mint feed unavailable right now.</span>'; }
}
latestPasses(); setInterval(latestPasses, 60000);

// scan log
async function scanLog() {
  const el = $("scanLog"); if (!el) return;
  try {
    const head = Number(await rpc("eth_blockNumber", []));
    const from = "0x" + Math.max(0, head - 20000).toString(16);
    const jobs = [
      rpc("eth_getLogs", [{ address: INBOX, topics: [TOPICS.submitted], fromBlock: from, toBlock: "latest" }]).then((ls) => ls.map((l) => ({ b: Number(l.blockNumber), k: "POST FILED", w: "0x" + l.topics[1].slice(-40), gold: false }))).catch(() => []),
      rpc("eth_getLogs", [{ address: PASS, topics: [TOPICS.minted], fromBlock: from, toBlock: "latest" }]).then((ls) => ls.map((l) => ({ b: Number(l.blockNumber), k: "PASS MINTED", w: "0x" + l.topics[1].slice(-40), gold: false }))).catch(() => []),
      rpc("eth_getLogs", [{ address: CLAIM, topics: [TOPICS.tweetClaimed], fromBlock: from, toBlock: "latest" }]).then((ls) => ls.map((l) => ({ b: Number(l.blockNumber), k: "TWEET PAID " + tok(BigInt(l.data)) + " $XSCAN", w: "0x" + l.topics[1].slice(-40), gold: true }))).catch(() => []),
      rpc("eth_getLogs", [{ address: CLAIM, topics: [TOPICS.claimed], fromBlock: from, toBlock: "latest" }]).then((ls) => ls.map((l) => ({ b: Number(l.blockNumber), k: "PASS CLAIMED", w: "0x" + l.topics[1].slice(-40), gold: true }))).catch(() => [])
    ];
    const all = (await Promise.all(jobs)).flat().sort((a, b) => b.b - a.b).slice(0, 9);
    if (!all.length) { el.innerHTML = "<div><span>No scans yet. The first post opens the log.</span></div>"; return; }
    el.innerHTML = all.map((e) => '<div><span class="' + (e.gold ? "gold" : "k2") + '">' + e.k + '</span><span>' + e.w.slice(0, 6) + "…" + e.w.slice(-4) + " · block " + fmt(e.b) + "</span></div>").join("");
  } catch (e) { el.innerHTML = "<div><span>Scan log unavailable right now.</span></div>"; }
}
scanLog(); setInterval(scanLog, 60000);
