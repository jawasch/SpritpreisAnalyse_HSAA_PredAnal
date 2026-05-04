"""
Pydantic schemas for API request/response validation
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum


# Enums
class FuelTypeEnum(str, Enum):
    """Fuel types"""
    E5 = "e5"
    E10 = "e10"
    DIESEL = "diesel"


class StationStatusEnum(str, Enum):
    """Station status"""
    OPEN = "open"
    CLOSED = "closed"
    UNKNOWN = "unknown"


# Gas Station Schemas
class GasStationBase(BaseModel):
    """Base gas station schema"""
    name: str
    brand: Optional[str] = None
    street: Optional[str] = None
    house_number: Optional[str] = None
    post_code: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    latitude: float
    longitude: float


class GasStationCreate(GasStationBase):
    """Schema for creating a gas station"""
    id: str  # UUID from Tankerkönig


class GasStationResponse(GasStationBase):
    """Schema for gas station response"""
    id: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Fuel Price Schemas
class FuelPriceBase(BaseModel):
    """Base fuel price schema"""
    fuel_type: FuelTypeEnum
    price: float = Field(..., gt=0, description="Price in EUR per liter")
    status: StationStatusEnum = StationStatusEnum.UNKNOWN


class FuelPriceCreate(FuelPriceBase):
    """Schema for creating a fuel price"""
    station_id: str


class FuelPriceResponse(FuelPriceBase):
    """Schema for fuel price response"""
    id: int
    station_id: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class CurrentPricesResponse(BaseModel):
    """Schema for current prices at a station"""
    station_id: str
    station_name: str
    e5: Optional[float] = None
    e10: Optional[float] = None
    diesel: Optional[float] = None
    status: StationStatusEnum
    timestamp: datetime


# Crude Oil Price Schemas
class CrudeOilPriceBase(BaseModel):
    """Base crude oil price schema"""
    oil_type: str = Field(..., pattern="^(brent|wti)$")
    price_usd_per_barrel: float = Field(..., gt=0)
    price_eur_per_barrel: Optional[float] = None
    exchange_rate_usd_eur: Optional[float] = None


class CrudeOilPriceCreate(CrudeOilPriceBase):
    """Schema for creating crude oil price"""
    date: datetime


class CrudeOilPriceResponse(CrudeOilPriceBase):
    """Schema for crude oil price response"""
    id: int
    date: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Political Event Schemas
class PoliticalEventBase(BaseModel):
    """Base political event schema"""
    name: str
    description: Optional[str] = None
    event_type: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    estimated_impact_eur: Optional[float] = None


class PoliticalEventCreate(PoliticalEventBase):
    """Schema for creating political event"""
    pass


class PoliticalEventResponse(PoliticalEventBase):
    """Schema for political event response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Prediction Schemas
class PredictionBase(BaseModel):
    """Base prediction schema"""
    model_name: str
    fuel_type: FuelTypeEnum
    prediction_date: datetime
    target_date: datetime
    predicted_price: float
    confidence_lower: Optional[float] = None
    confidence_upper: Optional[float] = None
    region: Optional[str] = None


class PredictionCreate(PredictionBase):
    """Schema for creating prediction"""
    pass


class PredictionResponse(PredictionBase):
    """Schema for prediction response"""
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Stations Search Schemas
class StationSearchParams(BaseModel):
    """Schema for station search parameters"""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius: float = Field(default=5.0, gt=0, le=25, description="Search radius in km")
    fuel_type: Optional[FuelTypeEnum] = None
    sort_by: Optional[str] = Field(default="distance", pattern="^(distance|price)$")


class NearbyStationResponse(BaseModel):
    """Schema for nearby station with current prices"""
    station: GasStationResponse
    distance: float = Field(..., description="Distance in km")
    current_prices: Optional[CurrentPricesResponse] = None


# Analytics Schemas
class PriceTrendResponse(BaseModel):
    """Schema for price trend analytics"""
    fuel_type: FuelTypeEnum
    start_date: datetime
    end_date: datetime
    average_price: float
    min_price: float
    max_price: float
    price_change: float
    price_change_percent: float


class BestTimeToRefuelResponse(BaseModel):
    """Schema for best time to refuel recommendation"""
    fuel_type: FuelTypeEnum
    best_hour: int = Field(..., ge=0, le=23)
    best_day_of_week: int = Field(..., ge=0, le=6)  # 0=Monday
    average_price_best_time: float
    average_price_overall: float
    potential_savings_eur: float
    potential_savings_percent: float


# Health Check Schema
class HealthCheckResponse(BaseModel):
    """Schema for health check response"""
    status: str
    database: str
    cache: str
    timestamp: datetime
