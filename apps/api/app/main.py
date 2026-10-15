from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings

app = FastAPI(
    title="Benim Payım API",
    description="Yapay zekâyla kod öğrenenler için öğrenme takip ve görünürlük API'si",
    version="1.0.0",
)

# CORS Ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    provider = "demo"
    if settings.AI_PROVIDER == "groq" and settings.GROQ_API_KEY:
        provider = f"groq ({settings.GROQ_MODEL})"
    elif settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
        provider = f"gemini ({settings.GEMINI_MODEL})"

    return {
        "status": "healthy",
        "service": "benim-payim-api",
        "environment": settings.ENVIRONMENT,
        "ai_provider": provider,
    }



from app.routers import sessions, help, checks, cards, auth

app.include_router(sessions.router)
app.include_router(help.router)
app.include_router(checks.router)
app.include_router(cards.router)
app.include_router(auth.router)





