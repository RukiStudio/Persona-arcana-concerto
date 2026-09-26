# -*- coding: utf-8 -*-
"""
Web壳子服务器 - 用浏览器运行游戏，原生支持emoji
"""
from __future__ import annotations
import json
import os
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

from game_state import GameState, PHASE_PROTAGONIST, PHASE_FACTION, PHASE_BATTLE, PHASE_REST, PHASE_VELVET, PHASE_GAME_OVER


GAME = GameState()
HTML_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # 静默日志

    def _send_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self) -> None:
        if os.path.exists(HTML_PATH):
            with open(HTML_PATH, "r", encoding="utf-8") as f:
                body = f.read().encode("utf-8")
        else:
            body = b"<h1>index.html not found</h1>"
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8")
        if not raw:
            return {}
        return json.loads(raw)

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self._send_html()
        elif self.path == "/state":
            self._send_json(GAME.to_dict())
        else:
            self._send_json({"error": "not found"}, 404)

    def do_POST(self):
        global GAME
        try:
            data = self._read_json()
            if self.path == "/select_protagonist":
                result = GAME.select_protagonist(data.get("choice", "A"))
                self._send_json(result)
            elif self.path == "/select_faction":
                result = GAME.select_faction(data.get("faction", "愚者"))
                self._send_json(result)
            elif self.path == "/action":
                result = GAME.execute_action(data.get("cmd", ""))
                self._send_json(result)
            elif self.path == "/rest":
                result = GAME.rest_action(data.get("choice", ""))
                self._send_json(result)
            elif self.path == "/velvet":
                result = GAME.velvet_action(data.get("action", ""), data.get("params", {}))
                self._send_json(result)
            elif self.path == "/reset":
                GAME = GameState()
                self._send_json(GAME.to_dict())
            else:
                self._send_json({"error": "not found"}, 404)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)


def main() -> None:
    global GAME
    # 启动时重置游戏状态，确保每次打开都是新游戏
    GAME = GameState()

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
        print("❌ 无法启动服务器：所有端口均被占用")
        input("按回车退出...")
        return

    url = f"http://127.0.0.1:{port}"
    print("=" * 50)
    print(f"  女神异闻录：阿尔卡那协奏 - Web版")
    print(f"  服务器地址：{url}")
    print(f"  浏览器将自动打开...")
    print(f"  如未自动打开，请手动复制上方地址到浏览器")
    print(f"  关闭此窗口或按 Ctrl+C 停止服务器")
    print("=" * 50)
    # 确保服务器已就绪再打开浏览器
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"  （自动打开浏览器失败：{e}，请手动访问 {url}）")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
