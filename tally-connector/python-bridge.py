import json
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import xml.etree.ElementTree as ET

HOST = "0.0.0.0"
PORT = 9101
TALLY_URL = "http://127.0.0.1:9000"


def tally_request(xml):
    req = urllib.request.Request(TALLY_URL, data=xml.encode("utf-8"), headers={"Content-Type": "text/xml; charset=utf-8"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode("utf-8", errors="replace")


def clean_xml(text):
    return text.replace("&", "&amp;")


def export_xml(collection_id, fetches, company=None, from_date=None, to_date=None):
    static = "<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>"
    if company:
        static += f"<SVCURRENTCOMPANY>{clean_xml(company)}</SVCURRENTCOMPANY>"
    if from_date:
        static += f"<SVFROMDATE>{from_date}</SVFROMDATE>"
    if to_date:
        static += f"<SVTODATE>{to_date}</SVTODATE>"
    fetch_xml = "".join(f"<FETCH>{x}</FETCH>" for x in fetches)
    return f"<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>{collection_id}</ID></HEADER><BODY><DESC><STATICVARIABLES>{static}</STATICVARIABLES><FETCHLIST>{fetch_xml}</FETCHLIST></DESC></BODY></ENVELOPE>"


def xml_rows(xml_text):
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []
    rows = []
    for elem in root.iter():
        if elem.tag.upper().endswith("LIST"):
            continue
    # Tally collection records normally appear as repeated LEDGER/GROUP/STOCKITEM/COMPANY nodes.
    for elem in root.iter():
        tag = elem.tag.split("}")[-1].upper()
        if tag in {"LEDGER", "GROUP", "STOCKITEM", "COMPANY", "VOUCHER"}:
            row = {c.tag.split("}")[-1]: (c.text or "").strip() for c in list(elem) if len(list(c)) == 0}
            if row:
                rows.append(row)
    return rows


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
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
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        try:
            if path == "/health":
                xml = "<ENVELOPE><HEADER><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>"
                result = tally_request(xml)
                self.send_json(200, {"ok": True, "tally": True, "message": "Tally connected", "response_length": len(result)})
                return

            if path == "/companies":
                xml = export_xml("List of Companies", ["Name", "GUID"])
                result = tally_request(xml)
                self.send_json(200, {"ok": True, "companies": xml_rows(result), "raw": result})
                return

            if path == "/ledgers":
                company = qs.get("company", [None])[0]
                xml = export_xml("List of Ledgers", ["Name", "Parent", "ClosingBalance", "Address", "PhoneNumber", "GSTIN"], company)
                result = tally_request(xml)
                self.send_json(200, {"ok": True, "ledgers": xml_rows(result), "raw": result})
                return

            if path == "/outstanding":
                company = qs.get("company", [None])[0]
                xml = export_xml("List of Ledgers", ["Name", "Parent", "ClosingBalance", "OpeningBalance", "CreditLimit", "Address", "PhoneNumber", "GSTIN"], company)
                result = tally_request(xml)
                rows = xml_rows(result)
                self.send_json(200, {"ok": True, "outstanding": rows, "raw": result})
                return

            self.send_json(404, {"ok": False, "error": "Not found"})
        except urllib.error.URLError as e:
            self.send_json(502, {"ok": False, "tally": False, "error": str(e)})
        except Exception as e:
            self.send_json(500, {"ok": False, "error": str(e)})

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
