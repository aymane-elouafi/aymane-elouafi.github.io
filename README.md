# aymane-elouafi.github.io

## Live projects

The pages `enterprise-network.html`, `recon-agent.html` and `api-attack-detection.html`
are wired to their GitHub repos (listed in `projects.json`).

- `.github/workflows/live-sync.yml` runs every 15 minutes: `sync-live.mjs` pulls each repo
  (commits, README, roadmap, attack-phase screenshots, fixtures, dataset sample) into
  `live/<id>.json`. If anything changed, it runs `build.mjs` and commits, so Pages republishes.
- In the browser, `live.js` also asks the GitHub API for brand-new commits, so a push shows up
  on the page before the next sync.
- The roadmap is parsed from the repo: a markdown table with a `Status` column, or a list under
  a `## Roadmap` / `## Status` heading. Words like *done/built*, *in progress* and *planned*
  set the status. New screenshots named `A2.7-01-something.png` in
  `part-2-attack-phase/screenshots/` appear in the attack log, and planned machines in the
  network map (DC01, CLIENT02, WAZUH) light up when their lab in `ROADMAP.md` leaves "planned".

Add a project: add a block to `projects.json`, run `node sync-live.mjs && node build.mjs`.

Because the bot commits too, run `git pull --rebase` before building and pushing locally.

### Optional: update instantly on every push

1. Create a fine-grained token (GitHub › Settings › Developer settings) with access to
   `aymane-elouafi.github.io` only, permission **Contents: read and write**.
2. In each project repo, add it as the secret `SITE_DISPATCH_TOKEN`, then add
   `.github/workflows/notify-site.yml`:

```yaml
name: notify-site
on: { push: { branches: [main] } }
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: gh api repos/aymane-elouafi/aymane-elouafi.github.io/dispatches -f event_type=project-updated
        env: { GH_TOKEN: "${{ secrets.SITE_DISPATCH_TOKEN }}" }
```
