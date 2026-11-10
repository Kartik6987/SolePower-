from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Device(Base):
    """
    Represents a registered SOLEPOWER smart shoe.
    """
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_uid = Column(String, unique=True, index=True, nullable=False) # e.g. "SOLEPOWER-R01"
    name = Column(String, default="SolePower Shoe")
    status = Column(String, default="active") # active, standby, offline
    created_at = Column(DateTime, default=datetime.utcnow)

    readings = relationship("SensorReading", back_populates="device")


class SensorReading(Base):
    """
    Stores each telemetry record sent from the ESP32 or simulation script.
    """
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    device_uid = Column(String, ForeignKey("devices.device_uid"), index=True, nullable=False)
    
    voltage = Column(Float, nullable=False)        # Instantaneous generated voltage (V)
    current_ma = Column(Float, nullable=False)     # Instantaneous generated current (mA)
    power_mw = Column(Float, nullable=False)       # Calculated: voltage * current_ma (mW)
    battery_voltage = Column(Float, nullable=False)# Energy storage level (supercapacitor/battery) (V)
    steps = Column(Integer, default=0)             # Cumulative step count
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    device = relationship("Device", back_populates="readings")


class User(Base):
    """
    Stores authenticated user profiles for SOLEPOWER platform.
    Supports both email/password credentials and Google OAuth.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    auth_provider = Column(String, default="local") # "local", "google"
    hashed_password = Column(String, nullable=True) # None for Google OAuth
    device_uid = Column(String, default="SOLEPOWER-01")
    role = Column(String, default="Researcher")     # "Lead Researcher", "Student", "Evaluator"
    gender = Column(String, default="Male", nullable=True) # "Male", "Female"
    created_at = Column(DateTime, default=datetime.utcnow)
