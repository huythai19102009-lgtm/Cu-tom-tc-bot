# CUSTOM TC — Zalo Bot starter

## Important
This is a starter project, not a deployed webhook URL. A real public HTTPS URL is created only after deploying this project to a hosting service. Never share your Bot Token or Secret Token in chat.

## What it currently does
- Receives a Zalo webhook at `/webhook`.
- Checks the `X-Bot-Api-Secret-Token` header.
- Responds to `.id <UID>`.
- Looks up a registered UID in `data/tournament.json`.
- Sends the current overall leaderboard image with TEAM / ELIMS / BYA / PTS.

## Scoring configuration
`tournament.json` contains:
- 12 placeholder teams (rename them).
- `players`: UID-to-team mapping. Replace the example UID with real registered tournament participants.
- 4 games. Add a result for each team in each game using `teamId`, `placement` (1-12), and `kills`.
- `placementPoints`: [12,9,8,7,6,5,4,3,2,1,0,0]
- `pointsPerKill`: 1

The placement table is the scoring choice confirmed in the conversation; verify it against the CUSTOM TC event rules before publishing scores. BYA is counted when placement is 1.

## Run locally
Requires Node.js 20+.
1. Install dependencies: `npm install`
2. Set environment variables:
   - `BOT_TOKEN` = Bot Token (keep private)
   - `WEBHOOK_SECRET` = secret string, 8–256 characters
   - `PUBLIC_BASE_URL` = public HTTPS base URL of this deployed app, without trailing slash
   - `PORT` = optional (hosting usually supplies it)
3. Run: `npm start`

## Hosting and Zalo setup
Deploy this folder to a Node.js host that provides a public HTTPS domain and persistent storage for `data/tournament.json`.
Your webhook URL will then be:
`https://YOUR-HOST-DOMAIN/webhook`

In Bot Creator:
- Webhook URL: the URL above
- Secret Token: the same value as `WEBHOOK_SECRET`
- Save changes

Zalo's Bot API docs specify a publicly reachable HTTPS webhook and send the secret in `X-Bot-Api-Secret-Token`. The bot's sendPhoto API expects a publicly reachable image URL.

## Editing tournament data
Edit `data/tournament.json`:
- Rename TEAM 01 ... TEAM 12.
- Add every player's UID under `players`, mapping UID to a team ID such as `T01`.
- For each game, add results, e.g.
  `{ "teamId": "T01", "placement": 1, "kills": 8 }`

Example:
```
{
  "game": 1,
  "results": [
    { "teamId": "T01", "placement": 1, "kills": 8 },
    { "teamId": "T02", "placement": 2, "kills": 5 }
  ]
}
```

## Known limits
- This version responds to direct webhook messages and assumes the incoming update has a `message.chat.id` and `message.text` shape (with a few common fallbacks). Confirm the exact update payload with your Zalo Bot test event before production.
- It does not automatically retrieve Free Fire match results from a UID. Tournament admins must enter each game's placement and kills and register player UIDs to teams.
- Group chat behavior depends on the Zalo Bot account/API permissions and event payload; test privately first.
- This starter has no admin dashboard. Update JSON data before each round.
