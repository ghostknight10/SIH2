"""Tiny smoke/demo client for the backend.

Usage after the server is running:
    python scripts/simulate_clients.py

It creates a session, starts it, connects two players, sends a message/order and
waits long enough to observe a degraded delivery.
"""
import asyncio
import json
import os

import httpx
import websockets

BASE = os.getenv("SIH_BASE_URL", "http://localhost:8000")
WS = BASE.replace("http://", "ws://").replace("https://", "wss://")
PASSWORD = os.getenv("SIH_SEED_PASSWORD", "demo123")


async def main():
    async with httpx.AsyncClient(base_url=BASE) as client:
        instructor = (await client.post("/login", json={"username": "instructor", "password": PASSWORD})).json()
        p1 = (await client.post("/login", json={"username": "player1", "password": PASSWORD})).json()
        p2 = (await client.post("/login", json={"username": "player2", "password": PASSWORD})).json()
        headers = {"Authorization": f"Bearer {instructor['access_token']}"}
        session = (await client.post("/sessions", headers=headers,
                                     json={"scenario_id": "ambush_north",
                                           "assignments": {"player1": "alpha", "player2": "bravo"},
                                           "seed": 7})).json()
        sid = session["id"]
        await client.post(f"/sessions/{sid}/start", headers=headers)

    async with websockets.connect(f"{WS}/ws/{sid}?token={p1['access_token']}") as a, \
               websockets.connect(f"{WS}/ws/{sid}?token={p2['access_token']}") as b:
        print("P1 snapshot:", json.dumps(await a.recv())[:300])
        print("P2 snapshot:", json.dumps(await b.recv())[:300])
        await a.send(json.dumps({"type": "message", "to": ["bravo"], "text": "Move north"}))
        print("P1 ack:", await a.recv())
        print("P2 eventually receives:", await b.recv())


if __name__ == "__main__":
    asyncio.run(main())
