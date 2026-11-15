import express from "express";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const DATA_FILE = path.join(process.cwd(), "tournament.json");

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}
function getChatId(update) {
  return update?.message?.chat?.id ??
    update?.message?.chat_id ??
    update?.chat?.id ??
    update?.chat_id ??
    update?.result?.message?.chat?.id ??
    null;
}
function getText(update) {
  return update?.message?.text ??
    update?.message?.content?.text ??
    update?.text ??
    update?.message_text ??
    "";
}
function getSenderId(update) {
  return update?.message?.from?.id ??
    update?.message?.sender?.id ??
    update?.sender?.id ??
    "";
}
async function zalo(method, body) {
  if (!BOT_TOKEN) throw new Error("Thiếu BOT_TOKEN");
  const response = await fetch(`https://bot-api.zaloplatforms.com/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok || result.ok === false) throw new Error(result.description || `Zalo API ${response.status}`);
  return result;
}
function totals(data) {
  const map = new Map(data.teams.map(t => [t.id, {
    id: t.id, name: t.name, kills: 0, booyahs: 0, points: 0, games: []
  }]));
  for (const game of data.games) {
    for (const r of (game.results || [])) {
      const row = map.get(r.teamId);
      if (!row) continue;
      const kills = Math.max(0, Number(r.kills || 0));
      const place = Math.min(12, Math.max(1, Number(r.placement || 12)));
      const placePoints = Number(data.placementPoints?.[place - 1] ?? 0);
      const booyah = place === 1 ? 1 : 0;
      row.kills += kills;
      row.booyahs += booyah;
      row.points += kills * Number(data.pointsPerKill ?? 1) + placePoints;
      row.games.push({ game: game.game, placement: place, kills, points: kills * Number(data.pointsPerKill ?? 1) + placePoints });
    }
  }
  return [...map.values()].sort((a,b) => b.points-a.points || b.booyahs-a.booyahs || b.kills-a.kills);
}
function esc(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function leaderboardSvg(rows) {
  const W = 1200, H = 980;
  const header = `
    <rect width="1200" height="980" fill="#080d18"/>
    <circle cx="1050" cy="90" r="230" fill="#102b4b" opacity=".42"/>
    <circle cx="80" cy="900" r="250" fill="#12365a" opacity=".22"/>
    <path d="M0 175H1200 M0 260H1200" stroke="#1a6aa5" stroke-width="2" opacity=".7"/>
    <text x="600" y="86" fill="#7dd3fc" font-size="28" font-family="Arial" text-anchor="middle" letter-spacing="8">CUSTOM TOURNAMENT</text>
    <text x="600" y="145" fill="#f3f8ff" font-size="58" font-weight="bold" font-family="Arial" text-anchor="middle">CUSTOM TC</text>
    <text x="600" y="220" fill="#70c8ff" font-size="34" font-weight="bold" font-family="Arial" text-anchor="middle">BẢNG XẾP HẠNG TỔNG</text>
    <rect x="42" y="285" width="1116" height="56" rx="10" fill="#123252"/>
    <text x="85" y="322" fill="#b8e6ff" font-size="25" font-family="Arial" font-weight="bold">#</text>
    <text x="160" y="322" fill="#b8e6ff" font-size="25" font-family="Arial" font-weight="bold">TEAM</text>
    <text x="745" y="322" fill="#b8e6ff" font-size="25" font-family="Arial" font-weight="bold" text-anchor="middle">ELIMS</text>
    <text x="900" y="322" fill="#b8e6ff" font-size="25" font-family="Arial" font-weight="bold" text-anchor="middle">BYA</text>
    <text x="1060" y="322" fill="#b8e6ff" font-size="25" font-family="Arial" font-weight="bold" text-anchor="middle">PTS</text>`;
  let body = "";
  rows.forEach((r,i) => {
    const y = 355 + i*48;
    const fill = i % 2 ? "#101b2b" : "#0c1523";
    body += `<rect x="42" y="${y}" width="1116" height="43" rx="7" fill="${fill}" stroke="#18334d"/>`;
    body += `<text x="85" y="${y+29}" fill="#80d5ff" font-size="23" font-family="Arial" font-weight="bold">${i+1}</text>`;
    body += `<text x="160" y="${y+29}" fill="#f0f6ff" font-size="22" font-family="Arial">${esc(r.name)}</text>`;
    body += `<text x="745" y="${y+29}" fill="#d7e8f7" font-size="22" font-family="Arial" text-anchor="middle">${r.kills}</text>`;
    body += `<text x="900" y="${y+29}" fill="#d7e8f7" font-size="22" font-family="Arial" text-anchor="middle">${r.booyahs}</text>`;
    body += `<text x="1060" y="${y+29}" fill="#67c8ff" font-size="24" font-family="Arial" font-weight="bold" text-anchor="middle">${r.points}</text>`;
  });
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${header}${body}
    <text x="600" y="965" fill="#66839e" font-size="18" font-family="Arial" text-anchor="middle">CUSTOM TC • FFWS-style scoring • ELIMS + placement points</text>
  </svg>`;
}
async function makePng() {
  const rows = totals(loadData());
  return sharp(Buffer.from(leaderboardSvg(rows))).png().toBuffer();
}
app.get("/", (_req,res) => res.type("text").send("CUSTOM TC bot is running."));
app.get("/leaderboard.png", async (_req,res) => {
  try { res.type("png").send(await makePng()); }
  catch (e) { res.status(500).type("text").send(e.message); }
});
app.post("/webhook", async (req,res) => {
  if (!WEBHOOK_SECRET || req.get("X-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    return res.sendStatus(401);
  }
  // Acknowledge quickly; process the update after returning 200.
  res.sendStatus(200);
  try {
    const update = req.body || {};
    const chatId = getChatId(update);
    const text = String(getText(update)).trim();
    if (!chatId || !text) return;
    if (/^\/?(start|help|trogiup)$/i.test(text)) {
      await zalo("sendMessage", { chat_id: String(chatId), text: "CUSTOM TC\\nGửi .id <UID> để xem bảng xếp hạng.\\nVí dụ: .id 123456789" });
      return;
    }
    const match = text.match(/^\.id\s+(\d{5,20})$/i);
    if (!match) return;
    const data = loadData();
    const teamId = data.players[match[1]];
    if (!teamId) {
      await zalo("sendMessage", { chat_id: String(chatId), text: "UID này chưa được đăng ký trong CUSTOM TC. Hãy liên hệ quản trị viên giải đấu để thêm UID vào đội." });
      return;
    }
    const team = data.teams.find(t => t.id === teamId);
    await zalo("sendMessage", { chat_id: String(chatId), text: `UID ${match[1]} đã đăng ký thuộc ${team?.name || teamId}. Đây là bảng xếp hạng tổng CUSTOM TC:` });
    if (!PUBLIC_BASE_URL) throw new Error("Thiếu PUBLIC_BASE_URL");
    await zalo("sendPhoto", {
      chat_id: String(chatId),
      photo: `${PUBLIC_BASE_URL.replace(/\/$/,"")}/leaderboard.png`,
      caption: "CUSTOM TC • Bảng xếp hạng tổng"
    });
  } catch (e) {
    console.error("Webhook processing error:", e.message);
  }
});
app.listen(PORT, () => console.log(`CUSTOM TC listening on ${PORT}`));
