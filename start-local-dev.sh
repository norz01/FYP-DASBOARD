#!/bin/bash
# Start TVETMARA local development services
set -e

PROJECT_DIR="/home/genn/Documents/DEVs/FYP/FYP-DASBOARD-main"

echo "Starting TVETMARA local dev services..."

# 1. Backend
if ! curl -s http://127.0.0.1:5000/api/health > /dev/null 2>&1; then
  echo "Starting backend on port 5000..."
  cd "$PROJECT_DIR/backend"
  nohup npm run dev > /tmp/backend.log 2>&1 &
  disown
  sleep 4
else
  echo "Backend already running."
fi

# 2. ML Service
if ! curl -s http://127.0.0.1:8000/ > /dev/null 2>&1; then
  echo "Starting ML service on port 8000..."
  cd "$PROJECT_DIR/ML"
  source venv/bin/activate
  nohup uvicorn ml:app --host 0.0.0.0 --port 8000 > /tmp/ml.log 2>&1 &
  disown
  sleep 5
else
  echo "ML service already running."
fi

# 3. Frontend
if ! curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ > /dev/null 2>&1; then
  echo "Starting frontend on port 3000..."
  cd "$PROJECT_DIR"
  nohup npm run dev > /tmp/frontend.log 2>&1 &
  disown
  sleep 6
else
  echo "Frontend already running."
fi

echo ""
echo "Services:"
echo "  Backend:   http://127.0.0.1:5000"
echo "  ML:        http://127.0.0.1:8000"
echo "  Frontend:  http://127.0.0.1:3000"
echo "  API Docs:  http://127.0.0.1:5000/api/docs"
echo ""
echo "Logs:"
echo "  Backend:   tail -f /tmp/backend.log"
echo "  ML:        tail -f /tmp/ml.log"
echo "  Frontend:  tail -f /tmp/frontend.log"
