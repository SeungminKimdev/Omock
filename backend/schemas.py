from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# User Schemas
class UserBase(BaseModel):
    id: str
    name: str


class UserCreate(UserBase):
    password: str
    winrate: float = 0.0


class UserLogin(BaseModel):
    id: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None


class UserRead(UserBase):
    user_id: int
    winrate: float

    class Config:
        orm_mode = True


# Record Schemas
class RecordBase(BaseModel):
    player1: int
    player2: int
    winner: Optional[int] = None


class RecordCreate(RecordBase):
    pass


class RecordRead(RecordBase):
    record_id: int
    updated_at: datetime

    class Config:
        orm_mode = True


# Board Schemas
class BoardBase(BaseModel):
    title: str
    content: str
    user_id: int


class BoardCreate(BoardBase):
    pass


class BoardUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class BoardRead(BaseModel):
    board_id: int
    user_id: int
    updated_at: datetime
    
    class Config:
        orm_mode = True