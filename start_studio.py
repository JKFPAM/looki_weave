#!/usr/bin/env python3
"""Open the local Weave Creator studio; no extra Python packages required."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import webbrowser


def main():
    parser = argparse.ArgumentParser(description="Open Weave Creator locally")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as error:
        print("Impossible de démarrer :", error)
        print("Fermez l'autre instance ou essayez : python3 start_studio.py --port 8766")
        raise SystemExit(1)
    url = f"http://127.0.0.1:{args.port}/?view=studio"
    print("Éditeur complet :", url, flush=True)
    print("Vue simplifiée :", f"http://127.0.0.1:{args.port}/", flush=True)
    print("Gardez cette fenêtre ouverte. Ctrl+C pour arrêter.", flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
