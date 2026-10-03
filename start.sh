#!/usr/bin/env bash
echo "============================================================"
echo "  PS-248 Tactical Telemetry and Decision-Training System"
echo "============================================================"
echo "Starting unified Python Backend + Frontend on http://127.0.0.1:8000..."
echo ""

# Attempt to open browser in background
(sleep 2 && (xdg-open http://127.0.0.1:8000 2>/dev/null || open http://127.0.0.1:8000 2>/dev/null)) &

# Run backend server
python3 backend/run.py || python backend/run.py
