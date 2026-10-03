"""
PS-248 Tactical Telemetry & Decision-Training API
FastAPI + WebSocket Server
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json

from app.engine import CommunicationEngine

app = FastAPI(
    title="PS-248 Tactical Telemetry API",
    description="Real-time tactical communication degradation and decision-training backend",
    version="1.0.0"
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = CommunicationEngine()

# Active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

# --- Request / Response Models ---
class RadioUpdateRequest(BaseModel):
    team: str
    status: str  # ONLINE, DEGRADED, CUT

class MessageDispatchRequest(BaseModel):
    sender: str
    receiver: str
    content: str
    priority: Optional[str] = "NORMAL"

class FalseIntelRequest(BaseModel):
    target: str
    report: str
    conflict_probability: Optional[float] = 75.0

class PlayerDecisionRequest(BaseModel):
    team: str
    order_text: str

# --- REST Endpoints ---
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "PS-248 Telemetry Hub", "version": "1.0.0"}

@app.get("/api/overview")
def get_system_overview():
    return engine.get_overview()

@app.post("/api/radios")
async def update_radio_status(req: RadioUpdateRequest):
    try:
        res = engine.set_radio_status(req.team, req.status)
        await manager.broadcast({"type": "radio_updated", "data": res})
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/messages")
async def dispatch_message(req: MessageDispatchRequest):
    msg = engine.dispatch_message(req.sender, req.receiver, req.content, req.priority)
    await manager.broadcast({"type": "message_dispatched", "data": msg})
    return msg

@app.post("/api/inject")
async def inject_false_intel(req: FalseIntelRequest):
    event = engine.inject_false_intel(req.target, req.report, req.conflict_probability)
    await manager.broadcast({"type": "intel_injected", "data": event})
    return event

@app.get("/api/aar")
def get_aar_analysis():
    overview = engine.get_overview()
    return {
        "overview": overview,
        "events": engine.aar_events,
        "recent_messages": engine.messages[:20],
        "bottleneck_diagnosis": "Team Charlie link degradation caused a 4-minute decision delay" if engine.radios.get("CHARLIE") != "ONLINE" else "All links nominal"
    }

# --- WebSocket Streaming ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # Send initial state sync
    await websocket.send_text(json.dumps({
        "type": "init_state",
        "data": engine.get_overview()
    }))
    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            action = data.get("action")

            if action == "set_radio":
                res = engine.set_radio_status(data["team"], data["status"])
                await manager.broadcast({"type": "radio_updated", "data": res})

            elif action == "send_message":
                msg = engine.dispatch_message(
                    data["sender"], data["receiver"], data["content"], data.get("priority", "NORMAL")
                )
                await manager.broadcast({"type": "message_dispatched", "data": msg})

            elif action == "inject_intel":
                ev = engine.inject_false_intel(
                    data["target"], data["report"], data.get("conflict_probability", 75.0)
                )
                await manager.broadcast({"type": "intel_injected", "data": ev})

            elif action == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
