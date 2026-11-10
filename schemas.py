from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class ReadingCreate(BaseModel):
    """
    Schema for incoming sensor telemetry from the smart shoe (or simulator).
    Validates that the ESP32 sends correct data types.
    """
    device_uid: str = Field(description="Unique ID of the smart shoe", examples=["SOLEPOWER-01"])
    voltage: float = Field(ge=0.0, description="Instantaneous generated voltage in Volts", examples=[3.2])
    current_ma: float = Field(ge=0.0, description="Instantaneous generated current in mA", examples=[12.5])
    battery_voltage: float = Field(ge=0.0, description="Energy storage / capacitor voltage in Volts", examples=[3.8])
    steps: int = Field(default=0, ge=0, description="Cumulative step count", examples=[142])
    voltage_sensor_enabled: bool = Field(default=False, description="True only if voltage sensor is physically connected and verified")

class ReadingResponse(BaseModel):
    """
    Schema for outgoing sensor data when queried by the frontend dashboard.
    """
    id: int
    device_uid: str
    voltage: float
    current_ma: float
    power_mw: float
    battery_voltage: float
    steps: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class AnalyticsSummary(BaseModel):
    """
    Schema for aggregated energy analytics calculated for the dashboard.
    """
    device_uid: str
    total_readings: int
    latest_voltage: float
    latest_current_ma: float
    latest_power_mw: float
    peak_power_mw: float
    avg_power_mw: float
    total_energy_joules: float
    current_battery_voltage: float
    total_steps: int

    model_config = ConfigDict(from_attributes=True)

class DeviceResponse(BaseModel):
    """
    Schema for registered smart shoe device info.
    """
    id: int
    device_uid: str
    name: Optional[str] = "SolePower Shoe"
    status: Optional[str] = "active"
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================
# AUTHENTICATION SCHEMAS
# ============================================================

class LoginRequest(BaseModel):
    email: str = Field(description="User email", examples=["kartik@solepower.iot"])
    password: str = Field(description="User password", examples=["solepower123"])
    remember_me: Optional[bool] = True

class RegisterRequest(BaseModel):
    name: str = Field(description="Full name", examples=["Kartik"])
    email: str = Field(description="Email address", examples=["kartik@solepower.iot"])
    password: str = Field(description="Password", examples=["solepower123"])
    gender: Optional[str] = Field(default="Male", description="Male or Female", examples=["Male"])
    device_uid: Optional[str] = Field(default="SOLEPOWER-01", description="Associated shoe UID", examples=["SOLEPOWER-01"])
    role: Optional[str] = Field(default="Researcher", description="User role", examples=["Researcher"])

class GoogleAuthRequest(BaseModel):
    email: str = Field(description="Google account email", examples=["kartik.developer@gmail.com"])
    name: str = Field(description="User display name", examples=["Kartik"])
    avatar_url: Optional[str] = None
    gender: Optional[str] = "Male"
    google_id: Optional[str] = None
    device_uid: Optional[str] = "SOLEPOWER-01"

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    avatar_url: Optional[str] = None
    auth_provider: Optional[str] = "local"
    device_uid: Optional[str] = "SOLEPOWER-01"
    role: Optional[str] = "Researcher"
    gender: Optional[str] = "Male"
    token: str

    model_config = ConfigDict(from_attributes=True)

