from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import APP_TITLE, APP_DESCRIPTION, VERSION, CORS_ORIGINS, THUMBNAILS_DIR
from app.core.database import init_db
from app.api.videos import router as videos_router
from app.api.auth import router as auth_router
from app.api.progress import router as progress_router
from app.api.favorites import router as favorites_router
from app.api.system import router as system_router

app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version=VERSION,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    return response

# Initialize Database on Startup
@app.on_event("startup")
def on_startup():
    init_db()

# Serve static thumbnails directly
app.mount("/storage/thumbnails", StaticFiles(directory=str(THUMBNAILS_DIR)), name="thumbnails")

# Mount API routes
app.include_router(videos_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(progress_router, prefix="/api")
app.include_router(favorites_router, prefix="/api")
app.include_router(system_router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": APP_TITLE,
        "version": VERSION
    }

if __name__ == "__main__":
    import uvicorn
    # Local dev server listens strictly on 127.0.0.1
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
