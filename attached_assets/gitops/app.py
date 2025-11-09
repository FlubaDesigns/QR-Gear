#!/usr/bin/env python3
"""
Git-Ops Webhook Server for Kingdom Connects
Author: Ghost | Executed by: Claude | Owner: Dave Percey

Secure POST-only webhooks for dev-first Git workflow:
- Push/Pull dev branch
- Weekly sync dev → main (fast-forward only)

All endpoints require header: X-Webhook-Key
"""

import os
import subprocess
import time
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

# Load secrets from environment
WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET', '')
COOLDOWN_SECONDS = int(os.getenv('WEBHOOK_COOLDOWN_SECONDS', '3'))

# Cooldown tracker
last_request_time = {}

def require_webhook_key(f):
    """Decorator: Verify webhook secret in header"""
    @wraps(f)
    def decorated(*args, **kwargs):
        provided_key = request.headers.get('X-Webhook-Key', '')
        
        if not WEBHOOK_SECRET:
            return jsonify({
                'code': 1,
                'error': 'WEBHOOK_SECRET not configured'
            }), 500
        
        if provided_key != WEBHOOK_SECRET:
            return jsonify({
                'code': 1,
                'error': 'Invalid or missing X-Webhook-Key header'
            }), 401
        
        return f(*args, **kwargs)
    return decorated

def check_cooldown(endpoint):
    """Prevent rapid-fire requests"""
    now = time.time()
    last_time = last_request_time.get(endpoint, 0)
    
    if now - last_time < COOLDOWN_SECONDS:
        remaining = COOLDOWN_SECONDS - (now - last_time)
        return False, remaining
    
    last_request_time[endpoint] = now
    return True, 0

def run_script(script_name):
    """Execute a shell script and return output"""
    try:
        result = subprocess.run(
            [f'./{script_name}'],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        
        output = result.stdout.strip() or result.stderr.strip()
        
        if result.returncode == 0:
            return {
                'code': 0,
                'output': output or f'OK: {script_name} completed'
            }
        else:
            return {
                'code': result.returncode,
                'error': output or 'Script failed'
            }
    except subprocess.TimeoutExpired:
        return {
            'code': 1,
            'error': 'Script timeout (60s)'
        }
    except Exception as e:
        return {
            'code': 1,
            'error': str(e)
        }

@app.route('/', methods=['GET'])
def health():
    """Health check"""
    return 'OK', 200

@app.route('/dashboard', methods=['GET'])
def dashboard():
    """Serve the Git dashboard UI"""
    import os
    dashboard_path = os.path.join(os.path.dirname(__file__), 'dashboard.html')
    with open(dashboard_path, 'r') as f:
        return f.read(), 200, {'Content-Type': 'text/html'}

@app.route('/hook/push/dev', methods=['POST'])
@require_webhook_key
def push_dev():
    """Push to dev branch"""
    allowed, wait = check_cooldown('push_dev')
    if not allowed:
        return jsonify({
            'code': 1,
            'error': f'Cooldown active. Wait {wait:.1f}s'
        }), 429
    
    result = run_script('push_dev.sh')
    return jsonify(result), 200 if result['code'] == 0 else 500

@app.route('/hook/pull/dev', methods=['POST'])
@require_webhook_key
def pull_dev():
    """Pull dev branch (with rebase)"""
    allowed, wait = check_cooldown('pull_dev')
    if not allowed:
        return jsonify({
            'code': 1,
            'error': f'Cooldown active. Wait {wait:.1f}s'
        }), 429
    
    result = run_script('pull_dev.sh')
    return jsonify(result), 200 if result['code'] == 0 else 500

@app.route('/hook/sync/dev-to-main', methods=['POST'])
@require_webhook_key
def sync_dev_to_main():
    """Weekly sync: fast-forward main from dev"""
    allowed, wait = check_cooldown('sync_dev_to_main')
    if not allowed:
        return jsonify({
            'code': 1,
            'error': f'Cooldown active. Wait {wait:.1f}s'
        }), 429
    
    result = run_script('sync_dev_to_main.sh')
    return jsonify(result), 200 if result['code'] == 0 else 500

# Optional endpoints (disabled by policy unless requested)
@app.route('/hook/push/main', methods=['POST'])
@require_webhook_key
def push_main():
    """Push to main branch (use sparingly)"""
    allowed, wait = check_cooldown('push_main')
    if not allowed:
        return jsonify({
            'code': 1,
            'error': f'Cooldown active. Wait {wait:.1f}s'
        }), 429
    
    result = run_script('push_main.sh')
    return jsonify(result), 200 if result['code'] == 0 else 500

@app.route('/hook/pull/main', methods=['POST'])
@require_webhook_key
def pull_main():
    """Pull main branch (with rebase)"""
    allowed, wait = check_cooldown('pull_main')
    if not allowed:
        return jsonify({
            'code': 1,
            'error': f'Cooldown active. Wait {wait:.1f}s'
        }), 429
    
    result = run_script('pull_main.sh')
    return jsonify(result), 200 if result['code'] == 0 else 500

@app.route('/hook/sync/main-to-dev', methods=['POST'])
@require_webhook_key
def sync_main_to_dev():
    """Reverse sync: fast-forward dev from main (rare)"""
    allowed, wait = check_cooldown('sync_main_to_dev')
    if not allowed:
        return jsonify({
            'code': 1,
            'error': f'Cooldown active. Wait {wait:.1f}s'
        }), 429
    
    result = run_script('sync_main_to_dev.sh')
    return jsonify(result), 200 if result['code'] == 0 else 500

if __name__ == '__main__':
    print("🚀 Git-Ops Webhook Server Starting...")
    print(f"   Cooldown: {COOLDOWN_SECONDS}s between requests")
    print(f"   Secret configured: {'Yes' if WEBHOOK_SECRET else 'No'}")
    print("\nEndpoints:")
    print("  POST /hook/push/dev")
    print("  POST /hook/pull/dev")
    print("  POST /hook/sync/dev-to-main")
    print("\nHeader required: X-Webhook-Key: <WEBHOOK_SECRET>")
    
    app.run(host='0.0.0.0', port=8000, debug=False)
