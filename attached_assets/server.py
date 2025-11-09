#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
from functools import partial

PORT = 5000

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Serve backup download
        if self.path == '/download/backup':
            try:
                self.send_response(200)
                self.send_header('Content-type', 'application/gzip')
                self.send_header('Content-Disposition', 'attachment; filename="kingdom-connects-backup.tar.gz"')
                self.end_headers()
                
                with open('kingdom-connects-backup.tar.gz', 'rb') as f:
                    self.wfile.write(f.read())
                return
            except FileNotFoundError:
                self.send_response(404)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b'<h1>Backup file not found</h1>')
                return
        
        # Serve Firebase config from environment variable
        if self.path == '/firebase-config.json':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.end_headers()
            
            # Build Firebase config for kingdom-commerce project
            config = {
                "apiKey": "AIzaSyD3Im6F3lWgMbJiA7plsDt_Rp9kCLTr6KU",
                "authDomain": "kingdom-commerce.firebaseapp.com",
                "projectId": "kingdom-commerce",
                "storageBucket": "kingdom-commerce.appspot.com",
                "messagingSenderId": "926457853462",
                "appId": "1:926457853462:web:eba8e9ecb2bb5ff43da737"
            }
            
            self.wfile.write(json.dumps(config).encode())
            return
        
        # Serve regular files
        return super().do_GET()
    
    def end_headers(self):
        if not self.path == '/firebase-config.json':
            # Cache control headers
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            
            # Security headers - prevent XSS, clickjacking, and other attacks
            csp = (
                "default-src 'self'; "
                "script-src 'self' https://www.gstatic.com https://apis.google.com; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self'; "
                "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com; "
                "frame-ancestors 'self' https://*.replit.dev; "
                "base-uri 'self'; "
                "form-action 'self';"
            )
            self.send_header('Content-Security-Policy', csp)
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('X-Frame-Options', 'SAMEORIGIN')
            self.send_header('X-XSS-Protection', '1; mode=block')
            self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        super().end_headers()

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with ReusableTCPServer(("0.0.0.0", PORT), NoCacheHTTPRequestHandler) as httpd:
    print(f"Server running at http://0.0.0.0:{PORT}/")
    print("Press Ctrl+C to stop the server")
    httpd.serve_forever()
