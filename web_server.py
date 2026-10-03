# -*- coding: utf-8 -*-
"""
Web static file server - serves the browser version of the game
"""
from __future__ import annotations
import os
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # silent log

    def _send_file(self, path: str) -> None:
        # 防目录穿越
        full = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not full.startswith(ROOT) or not os.path.isfile(full):
            self.send_error(404, "not found")
            return
        ext = os.path.splitext(full)[1].lower()
        ctype = CONTENT_TYPES.get(ext, "application/octet-stream")
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self._send_file("index.html")
        else:
            self._send_file(self.path.split("?", 1)[0])


def main() -> None:
    port = 8765
    server = None
    # 端口被占用时自动尝试下一个端口
    for p in range(port, port + 20):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", p), Handler)
            port = p
            break
        except OSError:
            continue
    if server is None:
        print("Failed to start: all ports are in use")
        input("Press Enter to exit...")
        return

    url = f"http://127.0.0.1:{port}"
    print("=" * 50)
    print("  Persona: Arcana Concert - Web")
    print(f"  Server: {url}")
    print("  Browser will open automatically...")
    print("  Close this window or press Ctrl+C to stop")
    print("=" * 50)
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"  (Failed to open browser: {e})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
