# SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.
#
# SPDX-License-Identifier: MIT

"""MCP server (stdio, JSON-RPC) - tools: extract_pdf, pdf_metadata, pdf_structure. No extra MCP SDK dependency."""
from __future__ import annotations
import sys, json
from .core import extract_document, get_metadata, parse_structure
TOOLS=[
 {"name":"extract_pdf","description":"Extract full text, metadata, structure and index from a local PDF","inputSchema":{"type":"object","properties":{"path":{"type":"string"},"engine":{"type":"string","enum":["pdfminer","pypdf2"],"default":"pdfminer"}},"required":["path"]}},
 {"name":"pdf_metadata","description":"Decoded metadata incl. page count for a local PDF","inputSchema":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}},
 {"name":"pdf_structure","description":"Book/document structure (chapters/appendices/sections) for a local PDF","inputSchema":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}},
]
def call_tool(name,args):
    if name=="extract_pdf": return extract_document(args["path"],engine=args.get("engine","pdfminer"))
    if name=="pdf_metadata": return get_metadata(args["path"])
    if name=="pdf_structure":
        doc=extract_document(args["path"]); return doc["structure"]
    raise ValueError(f"unknown tool {name}")
def handle(req):
    m=req.get("method"); rid=req.get("id")
    if m=="initialize": return {"jsonrpc":"2.0","id":rid,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"pdfx","version":"1.0.0"}}}
    if m=="notifications/initialized": return None
    if m=="tools/list": return {"jsonrpc":"2.0","id":rid,"result":{"tools":TOOLS}}
    if m=="tools/call":
        p=req.get("params") or {}
        try:
            res=call_tool(p.get("name"),p.get("arguments") or {})
            return {"jsonrpc":"2.0","id":rid,"result":{"content":[{"type":"text","text":json.dumps(res,ensure_ascii=False)}],"isError":False}}
        except Exception as e:
            return {"jsonrpc":"2.0","id":rid,"result":{"content":[{"type":"text","text":str(e)}],"isError":True}}
    if rid is not None: return {"jsonrpc":"2.0","id":rid,"error":{"code":-32601,"message":"method not found"}}
    return None
def main():
    for line in sys.stdin:
        line=line.strip()
        if not line: continue
        try: req=json.loads(line)
        except Exception: continue
        resp=handle(req)
        if resp is not None: print(json.dumps(resp),flush=True)
if __name__=="__main__": main()
