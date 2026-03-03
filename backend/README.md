# AMAZER Backend - Auth Module

## Stack
- Python 3.11
- FastAPI
- SQLAlchemy 2.0
- PostgreSQL
- JWT access + refresh
- bcrypt (via passlib)

## Structure
```
backend/app/
  main.py
  config.py
  database.py
  models/
  schemas/
  routes/
  services/
  repositories/
  core/
```

## Install
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Configure env
```bash
cp .env.example .env
```
Then edit `.env` with your PostgreSQL credentials.

## Run server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me` (Bearer access token required)
- `GET /api/v1/auth/health`

## Example payloads
`POST /api/v1/auth/register`
```json
{
  "email": "user@example.com",
  "full_name": "Jane Doe",
  "password": "StrongP@ssw0rd!"
}
```

`POST /api/v1/auth/login`
```json
{
  "email": "user@example.com",
  "password": "StrongP@ssw0rd!"
}
```

`POST /api/v1/auth/refresh`
```json
{
  "refresh_token": "<refresh_token>"
}
```
