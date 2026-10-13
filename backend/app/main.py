import sys
class MockWmi:
    def exec_query(self, query): return {}
sys.modules['_wmi'] = MockWmi()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager
from app.db.session import engine
from app.models.base import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import domain so Base metadata is populated
    import app.models.domain
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS anthropic_api_key VARCHAR(512);"))
        except Exception as e:
            print(f"Column migration notice: {e}")
    yield

app = FastAPI(
    title="AI Code Agent Platform API",
    description="Multi-portal API for Super Admin, Tenant Admin, and Developer",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.developer import router as developer_router
from app.api.auth import router as auth_router
from app.api.super_admin import router as super_admin_router
from app.api.tenant_admin import router as tenant_admin_router

app.include_router(developer_router, prefix="/api/v1/developer", tags=["Developer"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(super_admin_router, prefix="/api/v1/super-admin", tags=["Super Admin"])
app.include_router(tenant_admin_router, prefix="/api/v1/tenant", tags=["Tenant Admin"])

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Code Agent Platform API"}
    

@app.get("/health")
def health_check():
    return {"status": "healthy"}

from fastapi import WebSocket
@app.websocket("/ws_test")
async def test_ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text("Hello")
    await websocket.close()

from fastapi.responses import JSONResponse
import traceback
import sys

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    with open("500_error.log", "w") as f:
        f.write(traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": f"Internal Server Error: {str(exc)}"})
