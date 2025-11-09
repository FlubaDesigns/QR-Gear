# Claude: Replit Setup Instructions (Git-Ops Repl)
Author: Ghost | Owner: David “Stone Soup” Percey

1) Create a new PRIVATE Repl in Replit called: kingdom-connects-gitops
   - Language: Python
   - Purpose: Git push/pull/sync automation for dev + main branches.

2) Upload these files from your phone:
   - _GHOST_to_CLAUDE_GitOps_Setup.md
   - _replit_gitops_secure_bundle.zip

3) Extract the ZIP into the Repl root. Confirm files exist:
   - app.py
   - pushlib.sh
   - push_dev.sh, push_main.sh
   - pull_dev.sh, pull_main.sh
   - sync_dev_to_main.sh, sync_main_to_dev.sh
   - requirements.txt
   - .replit

4) Install dependencies and make scripts executable:
   pip install -r requirements.txt
   chmod +x pushlib.sh push_*.sh pull_*.sh sync_*.sh

5) Set Replit Secrets (left sidebar → 🔑):
   - GITHUB_TOKEN = David’s PAT (scope: repo)
   - WEBHOOK_SECRET = long random string
   - WEBHOOK_COOLDOWN_SECONDS = 3

6) Press RUN. Repl should serve on port 8000. Note the URL:
   https://<repl-name>.<user>.repl.co

7) Test endpoints (POST only, header required):
   - /hook/push/dev
   - /hook/pull/dev
   - /hook/sync/dev-to-main
   Header: X-Webhook-Key = WEBHOOK_SECRET

8) Expect JSON like:
   {"code":0,"output":"OK: pushed to dev"}

✅ When verified, tell David: “Git-Ops Repl deployed successfully.”
🛑 If any error occurs, DO NOT edit the public site Repl — debug only here.
