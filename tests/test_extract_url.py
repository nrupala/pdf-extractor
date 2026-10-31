"""POST /extract-url: SSRF refusal classes + happy path.

All network is stubbed: socket.getaddrinfo is replaced with a fixed
host -> IPs map and pdfx.api._open_connection with a fake that records
where it would have connected and serves canned responses. No real
network is touched. The defence under test is the real one in
pdfx.api: resolve -> classify EVERY address -> refuse non-public ->
connect pinned to the validated IP -> manual redirects, each hop
re-validated in full.
"""
import io
import socket

import pytest

import pdfx.api as api

PUBLIC_IP = "93.184.216.34"


@pytest.fixture(scope="module")
def pdf_bytes():
    import PyPDF2
    w = PyPDF2.PdfWriter()
    w.add_blank_page(width=612, height=792)
    w.add_blank_page(width=612, height=792)
    w.add_metadata({"/Title": "Sample Title", "/Author": "Jane Author"})
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


class FakeResponse:
    def __init__(self, status, headers=None, body=b""):
        self.status = status
        self._headers = {k.lower(): v for k, v in (headers or {}).items()}
        self._body = body
        self._pos = 0

    def getheader(self, name, default=None):
        return self._headers.get(name.lower(), default)

    def read(self, amt=-1):
        if amt is None or amt < 0:
            amt = len(self._body) - self._pos
        chunk = self._body[self._pos:self._pos + amt]
        self._pos += len(chunk)
        return chunk


class FakeConnection:
    def __init__(self, response):
        self._response = response
        self.method = None
        self.path = None
        self.headers = {}
        self.closed = False

    def putrequest(self, method, path, skip_host=False, skip_accept_encoding=False):
        self.method = method
        self.path = path

    def putheader(self, name, value):
        self.headers[name] = value

    def endheaders(self):
        pass

    def getresponse(self):
        return self._response

    def close(self):
        self.closed = True


@pytest.fixture
def net(monkeypatch):
    """Stub DNS + connection seams. state['dns']: host -> [ips];
    state['routes']: host -> callable returning a fresh FakeResponse."""
    state = {"dns": {}, "routes": {}, "connections": [], "dns_calls": []}

    def fake_getaddrinfo(host, port, *args, **kwargs):
        state["dns_calls"].append(host)
        if host not in state["dns"]:
            raise socket.gaierror(f"stub DNS: no entry for {host}")
        return [
            (socket.AF_INET6 if ":" in ip else socket.AF_INET,
             socket.SOCK_STREAM, 6, "", (ip, port))
            for ip in state["dns"][host]
        ]

    def fake_open(scheme, host, port, ip_str):
        conn = FakeConnection(state["routes"][host]())
        state["connections"].append(
            {"scheme": scheme, "host": host, "port": port, "ip": ip_str, "conn": conn})
        return conn

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    monkeypatch.setattr(api, "_open_connection", fake_open)
    return state


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    return TestClient(api.create_app())


def post(client, url):
    return client.post("/extract-url", json={"url": url})


# --- refusal classes ------------------------------------------------------

def test_private_resolution_refused_before_any_connection(client, net):
    net["dns"]["files.example.com"] = ["192.168.1.5"]
    r = post(client, "http://files.example.com/x.pdf")
    assert r.status_code == 400
    assert "non-public" in r.json()["error"]
    assert net["connections"] == []


def test_loopback_resolution_refused(client, net):
    net["dns"]["sneaky.example.com"] = ["127.0.0.1"]
    r = post(client, "http://sneaky.example.com/x.pdf")
    assert r.status_code == 400
    assert "non-public" in r.json()["error"]
    assert net["connections"] == []


def test_link_local_resolution_refused(client, net):
    net["dns"]["meta.example.com"] = ["169.254.169.254"]
    r = post(client, "http://meta.example.com/x.pdf")
    assert r.status_code == 400
    assert net["connections"] == []


def test_mixed_resolution_refused_fail_closed(client, net):
    # One public + one private answer: ANY non-public address refuses all.
    net["dns"]["mixed.example.com"] = [PUBLIC_IP, "10.0.0.5"]
    r = post(client, "http://mixed.example.com/x.pdf")
    assert r.status_code == 400
    assert "non-public" in r.json()["error"]
    assert net["connections"] == []


def test_ipv4_mapped_ipv6_loopback_refused(client, net):
    net["dns"]["mapped.example.com"] = ["::ffff:127.0.0.1"]
    r = post(client, "http://mapped.example.com/x.pdf")
    assert r.status_code == 400
    assert net["connections"] == []


def test_non_http_scheme_refused_without_resolution(client, net):
    r = post(client, "file:///etc/passwd.pdf")
    assert r.status_code == 400
    assert "http" in r.json()["error"]
    assert net["dns_calls"] == []
    assert net["connections"] == []


def test_embedded_credentials_refused(client, net):
    r = post(client, "http://user:pass@docs.example.com/x.pdf")
    assert r.status_code == 400
    assert "credentials" in r.json()["error"]
    assert net["connections"] == []


def test_unresolvable_host_refused(client, net):
    r = post(client, "http://missing.example.com/x.pdf")
    assert r.status_code == 400
    assert "resolve" in r.json()["error"]
    assert net["connections"] == []


def test_redirect_to_private_refused_at_hop2(client, net):
    net["dns"]["a.example.com"] = [PUBLIC_IP]
    net["dns"]["b.example.com"] = ["10.0.0.5"]
    net["routes"]["a.example.com"] = lambda: FakeResponse(
        302, {"Location": "http://b.example.com/secret.pdf"})
    r = post(client, "http://a.example.com/x.pdf")
    assert r.status_code == 400
    assert "non-public" in r.json()["error"]
    # Exactly one connection was opened (hop 1); hop 2 was refused at
    # resolution, before connecting.
    assert len(net["connections"]) == 1
    assert net["connections"][0]["host"] == "a.example.com"


def test_redirect_loop_stops_after_cap(client, net):
    net["dns"]["loop.example.com"] = [PUBLIC_IP]
    net["routes"]["loop.example.com"] = lambda: FakeResponse(
        302, {"Location": "http://loop.example.com/x.pdf"})
    r = post(client, "http://loop.example.com/x.pdf")
    assert r.status_code == 400
    assert "too many times" in r.json()["error"]
    assert len(net["connections"]) == 4  # initial + 3 followed hops


def test_non_pdf_content_type_refused(client, net):
    net["dns"]["docs.example.com"] = [PUBLIC_IP]
    net["routes"]["docs.example.com"] = lambda: FakeResponse(
        200, {"Content-Type": "text/html"}, b"<html>not a pdf</html>")
    r = post(client, "http://docs.example.com/x.pdf")
    assert r.status_code == 400
    assert "not a PDF" in r.json()["error"]


def test_octet_stream_without_magic_bytes_refused(client, net):
    net["dns"]["docs.example.com"] = [PUBLIC_IP]
    net["routes"]["docs.example.com"] = lambda: FakeResponse(
        200, {"Content-Type": "application/octet-stream"}, b"NOPE not a pdf")
    r = post(client, "http://docs.example.com/x.pdf")
    assert r.status_code == 400
    assert "did not return a PDF" in r.json()["error"]


def test_oversized_content_length_refused(client, net):
    net["dns"]["big.example.com"] = [PUBLIC_IP]
    net["routes"]["big.example.com"] = lambda: FakeResponse(
        200, {"Content-Type": "application/pdf",
              "Content-Length": str(51 * 1024 * 1024)}, b"%PDF-")
    r = post(client, "http://big.example.com/x.pdf")
    assert r.status_code == 400
    assert "50 MB" in r.json()["error"]


def test_http_error_status_refused(client, net):
    net["dns"]["docs.example.com"] = [PUBLIC_IP]
    net["routes"]["docs.example.com"] = lambda: FakeResponse(404, {}, b"")
    r = post(client, "http://docs.example.com/x.pdf")
    assert r.status_code == 400
    assert "404" in r.json()["error"]


# --- happy paths ----------------------------------------------------------

def test_happy_path_public_https_returns_extraction(client, net, pdf_bytes):
    net["dns"]["docs.example.com"] = [PUBLIC_IP]
    net["routes"]["docs.example.com"] = lambda: FakeResponse(
        200, {"Content-Type": "application/pdf",
              "Content-Length": str(len(pdf_bytes))}, pdf_bytes)
    r = post(client, "https://docs.example.com/paper.pdf")
    assert r.status_code == 200
    doc = r.json()
    assert doc["metadata"]["pages"] == 2
    assert "text" in doc
    # Pinning proven: the connection went to the VALIDATED IP, while the
    # Host header (and TLS name, via _open_connection's server_hostname)
    # carried the real hostname.
    assert len(net["connections"]) == 1
    opened = net["connections"][0]
    assert opened["ip"] == PUBLIC_IP
    assert opened["scheme"] == "https" and opened["port"] == 443
    assert opened["conn"].headers["Host"] == "docs.example.com"
    assert opened["conn"].path == "/paper.pdf"


def test_happy_path_octet_stream_with_magic_bytes(client, net, pdf_bytes):
    net["dns"]["cdn.example.com"] = [PUBLIC_IP]
    net["routes"]["cdn.example.com"] = lambda: FakeResponse(
        200, {"Content-Type": "application/octet-stream"}, pdf_bytes)
    r = post(client, "http://cdn.example.com/dl/paper.pdf")
    assert r.status_code == 200
    assert r.json()["metadata"]["pages"] == 2


def test_happy_path_relative_redirect_followed_and_revalidated(client, net, pdf_bytes):
    net["dns"]["docs.example.com"] = [PUBLIC_IP]
    hops = [
        lambda: FakeResponse(302, {"Location": "/files/paper.pdf"}),
        lambda: FakeResponse(200, {"Content-Type": "application/pdf"}, pdf_bytes),
    ]
    net["routes"]["docs.example.com"] = lambda: hops.pop(0)()
    r = post(client, "http://docs.example.com/paper.pdf")
    assert r.status_code == 200
    assert r.json()["metadata"]["pages"] == 2
    assert len(net["connections"]) == 2
    assert net["connections"][1]["conn"].path == "/files/paper.pdf"
