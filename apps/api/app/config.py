import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Supabase Settings
    SUPABASE_URL: str = "http://localhost:54321"
    SUPABASE_ANON_KEY: str = "demo-anon-key"
    SUPABASE_SERVICE_ROLE_KEY: str = "demo-service-role-key"
    SUPABASE_JWT_SECRET: str = "super-secret-jwt-token-with-at-least-32-bytes-length!"
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_JWT_ALGORITHM: str = "HS256"

    # AI Provider Settings
    AI_PROVIDER: str = "groq"  # "groq", "gemini", or "demo"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "qwen/qwen3.8-27b"


    
    # Rate Limiting & Limits
    RATE_LIMIT_PER_MINUTE: int = 30
    MAX_INPUT_CHARS: int = 15000

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "https://benim-payim.vercel.app",
    ]
    CORS_ORIGIN_REGEX: str = r"^https:\/\/.*\.vercel\.app$"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )



settings = Settings()
