"""
Launcher script for PS-248 Tactical Backend
Starts Uvicorn on http://127.0.0.1:8000 with auto-reload
"""
import sys
import uvicorn

if __name__ == "__main__":
    print("=" * 60)
    print("Starting PS-248 Tactical Telemetry Backend (FastAPI + WebSockets)")
    print("Server: http://127.0.0.1:8000")
    print("Interactive Swagger Docs: http://127.0.0.1:8000/docs")
    print("WebSocket Stream: ws://127.0.0.1:8000/ws")
    print("=" * 60)
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
