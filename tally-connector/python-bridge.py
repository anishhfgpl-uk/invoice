import json
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "0.0.0.0"
PORT = 9101
TALLY_URL = "http://127.0.0.1:9000"


def tally_request(xml):
    req = urllib.request.Request(
        TALLY_URL,
        data=xml.encode("utf-8"),
        headers={"Content-Type": "text/xml; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=8) as r:
        return r.read().decode("utf-8", errors="replace")


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_json(200, {"ok": True})

    def do_GET(self):
        if self.path == "/health":
            try:
                xml = "<ENVELOPE><HEADER><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>"
                result = tally_request(xml)
                self.send_json(200, {"ok": True, "tally": True, "message": "Tally connected", "response_length": len(result)})
            except Exception as e:
                self.send_json(502, {"ok": False, "tally": False, "error": str(e)})
            return
        self.send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        if self.path != "/tally":
            self.send_json(404, {"ok": False, "error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            xml = self.rfile.read(length).decode("utf-8", errors="replace")
            if not xml.strip():
                self.send_json(400, {"ok": False, "error": "XML is empty"})
                return
            result = tally_request(xml)
            self.send_json(200, {"ok": True, "response": result})
        except urllib.error.URLError as e:
            self.send_json(502, {"ok": False, "tally": False, "error": str(e)})
        except Exception as e:
            self.send_json(500, {"ok": False, "error": str(e)})

    def log_message(self, fmt, *args):
        print(fmt % args)


if __name__ == "__main__":
    print(f"Python Tally Bridge running on http://127.0.0.1:{PORT}")
    print(f"Tally target: {TALLY_URL}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
