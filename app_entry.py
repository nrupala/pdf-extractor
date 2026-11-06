# SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.
#
# SPDX-License-Identifier: MIT

"""PyInstaller entry: runs CLI if args given, else local API on 127.0.0.1:8765."""
import sys
if len(sys.argv) > 1:
    from pdfx.cli import main
    raise SystemExit(main())
from pdfx.api import main as api_main
api_main()
