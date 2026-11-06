# SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.
#
# SPDX-License-Identifier: MIT

from __future__ import annotations
import http.client, ipaddress, logging, socket, ssl, tempfile, os
from pathlib import Path
from urllib.parse import urljoin, urlsplit
try:
    from fastapi import FastAPI, UploadFile, File, Form
    from fastapi.responses import JSONResponse, FileResponse
except ImportError as e:
    FastAPI=None
try:
    from pydantic import BaseModel
    class ExtractUrlIn(BaseModel):
        """JSON body for POST /extract-url. Module-level (not inside
        create_app) so FastAPI can resolve the annotation — api.py uses
        `from __future__ import annotations`, which defers evaluation to
        module globals."""
        url: str
        format: str="json"
        engine: str="pdfminer"
except ImportError:
    ExtractUrlIn=None
# --- /extract-url fetch machinery ---------------------------------------
# The helpers below implement the resolve -> classify -> pin -> manual
# redirect defence for POST /extract-url. The full threat model is stated
# in the comment at the endpoint itself (inside create_app).
MAX_URL_PDF_BYTES=50*1024*1024  # the tab feature's long-standing 50 MB cap
MAX_URL_REDIRECTS=3
_URL_UA="pdfx-api/1.0.1 (+https://aimlds.org)"
_URL_TIMEOUT=30

class UrlFetchError(Exception):
    """A /extract-url refusal or failure; str(e) is the client-facing message."""

def _is_blocked_address(ip_str):
    ip=ipaddress.ip_address(ip_str)
    if isinstance(ip,ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip=ip.ipv4_mapped  # classify the embedded IPv4 address, not the wrapper
    return (ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast
            or ip.is_reserved or ip.is_unspecified)

def _resolve_validated_ip(host,port):
    """Resolve host; return the first address ONLY after every resolved
    address has been classified public. If ANY address the resolver
    returns is loopback/private/link-local/multicast/reserved/unspecified,
    the request is refused before any connection is opened (fail closed
    on mixed answers)."""
    try:
        infos=socket.getaddrinfo(host,port,proto=socket.IPPROTO_TCP)
    except OSError:
        raise UrlFetchError(f"Could not resolve the host '{host}'.")
    ips=[]
    for info in infos:
        if info[4][0] not in ips: ips.append(info[4][0])
    if not ips: raise UrlFetchError(f"Could not resolve the host '{host}'.")
    for ip_str in ips:
        try: blocked=_is_blocked_address(ip_str)
        except ValueError: blocked=True
        if blocked:
            raise UrlFetchError("That URL resolves to a non-public address, so it was refused. Only public http(s) PDF URLs can be fetched.")
    return ips[0]

def _open_connection(scheme,host,port,ip_str):
    """Open a connection to the PINNED ip_str — never to a hostname, so
    nothing on the fetch path re-resolves. For HTTPS the socket is wrapped
    with server_hostname=host, so TLS SNI and certificate verification
    still apply to the real hostname."""
    raw=socket.create_connection((ip_str,port),timeout=_URL_TIMEOUT)
    if scheme=="https":
        ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.minimum_version=ssl.TLSVersion.TLSv1_2
        sock=ctx.wrap_socket(raw,server_hostname=host)
        conn=http.client.HTTPSConnection(ip_str,port,timeout=_URL_TIMEOUT)
    else:
        sock=raw
        conn=http.client.HTTPConnection(ip_str,port,timeout=_URL_TIMEOUT)
    conn.sock=sock  # pre-connected: http.client must not connect (or resolve) itself
    return conn

def _host_header(host,port,scheme):
    display=f"[{host}]" if ":" in host and not host.startswith("[") else host
    return display if port==(443 if scheme=="https" else 80) else f"{display}:{port}"

def _validate_url(raw_url):
    if not isinstance(raw_url,str) or not raw_url.strip():
        raise UrlFetchError("No URL was provided.")
    try: parts=urlsplit(raw_url.strip())
    except ValueError: raise UrlFetchError("That URL could not be parsed.")
    if parts.scheme not in ("http","https"):
        raise UrlFetchError("Only http and https URLs can be fetched.")
    if parts.username or parts.password:
        raise UrlFetchError("URLs with embedded credentials are not accepted.")
    if not parts.hostname: raise UrlFetchError("That URL has no host.")
    try: parts.port
    except ValueError: raise UrlFetchError("That URL has an invalid port.")
    return parts

def _fetch_validated_pdf(raw_url):
    """Fetch a public PDF URL under the resolve -> classify -> pin defence.
    Returns (pdf_bytes, final_url); raises UrlFetchError with a plain
    message for every refusal class. Redirects are followed manually
    (max MAX_URL_REDIRECTS hops) and every hop's Location is resolved
    against the current URL and put through the FULL validation again —
    scheme check, resolution, IP classification, pinned connect — before
    it is followed."""
    current=raw_url
    for hop in range(MAX_URL_REDIRECTS+1):
        parts=_validate_url(current)
        scheme=parts.scheme; host=parts.hostname
        port=parts.port or (443 if scheme=="https" else 80)
        ip_str=_resolve_validated_ip(host,port)
        path=parts.path or "/"
        if parts.query: path+="?"+parts.query
        conn=_open_connection(scheme,host,port,ip_str)
        try:
            conn.putrequest("GET",path,skip_host=True)
            conn.putheader("Host",_host_header(host,port,scheme))
            conn.putheader("User-Agent",_URL_UA)
            conn.putheader("Accept","application/pdf, */*")
            conn.endheaders()
            resp=conn.getresponse()
            if resp.status in (301,302,303,307,308):
                location=resp.getheader("Location")
                if not location:
                    raise UrlFetchError(f"That URL redirected (HTTP {resp.status}) without giving a new location.")
                if hop>=MAX_URL_REDIRECTS:
                    raise UrlFetchError("That URL redirected too many times.")
                current=urljoin(current,location)
                continue
            if resp.status!=200:
                raise UrlFetchError(f"Could not download the PDF (HTTP {resp.status}).")
            declared=resp.getheader("Content-Length")
            if declared is not None:
                try: declared_over=int(declared)>MAX_URL_PDF_BYTES
                except ValueError: declared_over=False
                if declared_over: raise UrlFetchError("That PDF is over the 50 MB limit.")
            chunks=[]; total=0
            while True:
                chunk=resp.read(65536)
                if not chunk: break
                total+=len(chunk)
                if total>MAX_URL_PDF_BYTES: raise UrlFetchError("That PDF is over the 50 MB limit.")
                chunks.append(chunk)
            data=b"".join(chunks)
            ct=(resp.getheader("Content-Type") or "").split(";")[0].strip().lower()
            if ct in ("application/octet-stream","binary/octet-stream"):
                if not data.startswith(b"%PDF"): raise UrlFetchError("The URL did not return a PDF file.")
            elif ct!="application/pdf":
                raise UrlFetchError(f'The URL returned "{ct or "an unknown content type"}", not a PDF.')
            return data,current
        finally:
            conn.close()
    raise UrlFetchError("That URL redirected too many times.")

def create_app():
    if FastAPI is None: raise ImportError("Install api extras: pip install 'pdfx-extractor[api]'")
    from .core import extract_document
    from .outputs import WRITERS, EXT
    app=FastAPI(title="PDF Extractor API",version="1.0.0")
    @app.get("/health")
    def health(): return {"status":"ok","service":"pdfx","version":"1.0.0"}
    @app.post("/extract")
    async def extract(file: UploadFile=File(...), format: str=Form("json"), engine: str=Form("pdfminer")):
        data=await file.read()
        with tempfile.TemporaryDirectory() as td:
            raw_name=file.filename or "input.pdf"
            safe_name=raw_name.replace("\\","/").rsplit("/",1)[-1] or "input.pdf"
            src=Path(td)/safe_name; src.write_bytes(data)
            doc=extract_document(src,engine=engine)
            if format=="json": return JSONResponse(doc)
            if format in WRITERS:
                dest=Path(td)/f"{src.stem}{EXT[format]}"; WRITERS[format](doc,dest)
                # read back for response via FileResponse would expire with td; return bytes
                from fastapi.responses import Response
                return Response(content=dest.read_bytes(),media_type="application/octet-stream",headers={"Content-Disposition":f'attachment; filename="{dest.name}"'})
            return JSONResponse({"error":"unknown format"},status_code=400)
    # --- POST /extract-url -------------------------------------------------
    # Threat model: the URL comes from the user's active browser tab, so it
    # is attacker-influenceable — any site can serve the tab, or redirect
    # it. Fetching it from the browser extension could not close SSRF:
    # hostname validation in extension JavaScript inspects the NAME, but
    # DNS resolution happens inside the browser, beyond the extension's
    # control, and a name that validates can still resolve — or be
    # redirected — to a loopback/private address (Gemini pre-store check,
    # deciding generation, 2026-10-30). The fetch therefore happens HERE,
    # where resolution can be inspected and pinned:
    #   1. Validate: http/https scheme only, no embedded credentials.
    #   2. Resolve the host (socket.getaddrinfo) and classify EVERY
    #      returned address with the ipaddress module; if any is
    #      loopback, private, link-local, multicast, reserved, or
    #      unspecified, refuse BEFORE any connection is opened.
    #   3. Pin: connect to the validated IP directly (http.client). The
    #      hostname is sent only as the HTTP Host header and, for HTTPS,
    #      as the TLS server_hostname, so SNI and certificate verification
    #      still apply to the real hostname.
    #   4. Redirects are followed manually (max 3 hops); each Location is
    #      resolved against the current URL and put through steps 1-3 in
    #      full before connecting.
    #   5. The 50 MB cap (Content-Length + streamed byte count) and the
    #      PDF checks (application/pdf content type, or %PDF magic bytes
    #      for generic binary responses) run before the bytes reach the
    #      same extraction path /extract uses. No cookies or credentials
    #      are ever sent.
    # Limit, stated honestly: a hostname that resolves publicly at check
    # time could in theory re-resolve differently for a DIFFERENT client —
    # but this fetch never re-resolves: the connection uses the pinned,
    # already-classified IP, so there is no second resolution for an
    # attacker to race. What remains is trust in the resolver's answer at
    # resolution time itself, which the classification then constrains.
    @app.post("/extract-url")
    def extract_url(payload: ExtractUrlIn):
        try:
            data,final_url=_fetch_validated_pdf(payload.url)
        except UrlFetchError as e:
            return JSONResponse({"error":str(e)},status_code=400)
        with tempfile.TemporaryDirectory() as td:
            stem=Path(urlsplit(final_url).path).stem or "tab"
            stem="".join(c if (c.isalnum() or c in "._-") else "_" for c in stem).strip(".") or "tab"
            src=Path(td)/f"{stem}.pdf"; src.write_bytes(data)
            try: doc=extract_document(src,engine=payload.engine)
            except Exception as e:
                logging.getLogger("pdfx.api").exception("extract-url: extraction failed for %s",final_url)
                return JSONResponse({"error":"Could not extract that PDF."},status_code=400)
            if payload.format=="json": return JSONResponse(doc)
            if payload.format in WRITERS:
                dest=Path(td)/f"{src.stem}{EXT[payload.format]}"; WRITERS[payload.format](doc,dest)
                from fastapi.responses import Response
                return Response(content=dest.read_bytes(),media_type="application/octet-stream",headers={"Content-Disposition":f'attachment; filename="{dest.name}"'})
            return JSONResponse({"error":"unknown format"},status_code=400)
    return app
app=create_app() if FastAPI is not None else None
def main():
    import uvicorn; uvicorn.run(create_app(),host=os.environ.get("PDFX_HOST","127.0.0.1"),port=int(os.environ.get("PDFX_PORT","8765")))
if __name__=="__main__": main()
