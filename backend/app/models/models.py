"""
SQLAlchemy Models for Spritpreis Analytics Database
"""
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean,
    ForeignKey, Text, Enum, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from ..database import Base


# Enums
class FuelType(enum.Enum):
    """Fuel types available"""
    E5 = "e5"
    E10 = "e10"
    DIESEL = "diesel"


class StationStatus(enum.Enum):
    """Gas station operational status"""
    OPEN = "open"
    CLOSED = "closed"
    UNKNOWN = "unknown"


# Models
class GasStation(Base):
    """Gas station information"""
    __tablename__ = "gas_stations"

    id = Column(String(36), primary_key=True)  # UUID from Tankerkönig
    name = Column(String(255), nullable=False)
    brand = Column(String(100), nullable=True)
    street = Column(String(255), nullable=True)
    house_number = Column(String(20), nullable=True)
    post_code = Column(String(10), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)  # Bundesland
    
    # Geographic coordinates
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    fuel_prices = relationship("FuelPrice", back_populates="station")
    
    # Indexes
    __table_args__ = (
        Index('idx_station_location', 'latitude', 'longitude'),
        Index('idx_station_city', 'city'),
        Index('idx_station_post_code', 'post_code'),
    )


class FuelPrice(Base):
    """Fuel price records with timestamps"""
    __tablename__ = "fuel_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String(36), ForeignKey("gas_stations.id"), nullable=False)
    fuel_type = Column(Enum(FuelType), nullable=False)
    price = Column(Float, nullable=False)  # Price in EUR per liter
    status = Column(Enum(StationStatus), default=StationStatus.UNKNOWN)
    
    # Timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    station = relationship("GasStation", back_populates="fuel_prices")
    
    # Indexes for fast time-series queries
    __table_args__ = (
        Index('idx_price_station_time', 'station_id', 'timestamp'),
        Index('idx_price_fuel_time', 'fuel_type', 'timestamp'),
        Index('idx_price_timestamp', 'timestamp'),
    )


class CrudeOilPrice(Base):
    """Crude oil price records (Brent, WTI)"""
    __tablename__ = "crude_oil_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    oil_type = Column(String(20), nullable=False)  # 'brent', 'wti'
    price_usd_per_barrel = Column(Float, nullable=False)
    price_eur_per_barrel = Column(Float, nullable=True)  # Converted
    exchange_rate_usd_eur = Column(Float, nullable=True)
    
    # Timestamp
    date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Indexes
    __table_args__ = (
        Index('idx_oil_type_date', 'oil_type', 'date'),
        UniqueConstraint('oil_type', 'date', name='uq_oil_type_date'),
    )


class PoliticalEvent(Base):
    """Political events affecting fuel prices"""
    __tablename__ = "political_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(100), nullable=True)  # 'tax', 'subsidy', 'war', etc.
    
    # Date range
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Impact (to be calculated)
    estimated_impact_eur = Column(Float, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Index
    __table_args__ = (
        Index('idx_event_dates', 'start_date', 'end_date'),
    )


class Prediction(Base):
    """ML model predictions"""
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_name = Column(String(100), nullable=False)  # 'prophet', 'lstm', 'arima'
    fuel_type = Column(Enum(FuelType), nullable=False)
    
    # Prediction details
    prediction_date = Column(DateTime(timezone=True), nullable=False)  # When prediction was made
    target_date = Column(DateTime(timezone=True), nullable=False)  # What date is predicted
    predicted_price = Column(Float, nullable=False)
    confidence_lower = Column(Float, nullable=True)  # Lower confidence bound
    confidence_upper = Column(Float, nullable=True)  # Upper confidence bound
    
    # Region (optional)
    region = Column(String(100), nullable=True)  # 'Germany', 'Bavaria', etc.
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Indexes
    __table_args__ = (
        Index('idx_prediction_model_date', 'model_name', 'target_date'),
        Index('idx_prediction_fuel_date', 'fuel_type', 'target_date'),
    )


class ModelMetadata(Base):
    """Metadata for trained ML models"""
    __tablename__ = "model_metadata"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_name = Column(String(100), nullable=False)
    model_type = Column(String(50), nullable=False)  # 'prophet', 'lstm', 'arima'
    version = Column(String(50), nullable=False)
    
    # Training details
    trained_at = Column(DateTime(timezone=True), nullable=False)
    training_start_date = Column(DateTime(timezone=True), nullable=False)
    training_end_date = Column(DateTime(timezone=True), nullable=False)
    
    # Performance metrics
    rmse = Column(Float, nullable=True)
    mae = Column(Float, nullable=True)
    mape = Column(Float, nullable=True)
    r2_score = Column(Float, nullable=True)
    
    # Model file path
    model_file_path = Column(String(500), nullable=True)
    
    # Hyperparameters (stored as JSON string)
    hyperparameters = Column(Text, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Index
    __table_args__ = (
        Index('idx_model_name_version', 'model_name', 'version'),
    )
