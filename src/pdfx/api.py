
from __future__ import annotations
import tempfile, os
from pathlib import Path
try:
    from fastapi import FastAPI, UploadFile, File, Form
    from fastapi.responses import JSONResponse, FileResponse
except ImportError as e:
    FastAPI=None
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
            src=Path(td)/(file.filename or "input.pdf"); src.write_bytes(data)
            doc=extract_document(src,engine=engine)
            if format=="json": return JSONResponse(doc)
            if format in WRITERS:
                dest=Path(td)/f"{src.stem}{EXT[format]}"; WRITERS[format](doc,dest)
                # read back for response via FileResponse would expire with td; return bytes
                from fastapi.responses import Response
                return Response(content=dest.read_bytes(),media_type="application/octet-stream",headers={"Content-Disposition":f'attachment; filename="{dest.name}"'})
            return JSONResponse({"error":"unknown format"},status_code=400)
    return app
app=create_app() if FastAPI is not None else None
def main():
    import uvicorn; uvicorn.run(create_app(),host=os.environ.get("PDFX_HOST","127.0.0.1"),port=int(os.environ.get("PDFX_PORT","8765")))
if __name__=="__main__": main()
