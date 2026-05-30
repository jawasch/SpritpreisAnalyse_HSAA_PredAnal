"""
Spritpreis Analytics Dashboard - FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from .api import stations, prices, analytics, predictions, notebooks

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Spritpreis Analytics API",
    description="API für Spritpreis-Analyse und -Vorhersage in Deutschland und Europa",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - API status check"""
    return {
        "status": "online",
        "message": "Spritpreis Analytics API",
        "version": "0.1.0",
        "docs": "/docs",
    }


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database": "not_configured",  # TODO: Add DB check
        "cache": "not_configured",  # TODO: Add cache check
    }


app.include_router(stations.router, prefix="/api/v1/stations", tags=["Stations"])
app.include_router(prices.router, prefix="/api/v1/prices", tags=["Prices"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["Predictions"])
app.include_router(notebooks.router, prefix="/api/v1/notebooks", tags=["Notebooks"])


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
