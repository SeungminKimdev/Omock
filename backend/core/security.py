import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Union

from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext


load_dotenv()

SECRECT_KEY = os.getenv("JWT_KEY")
if not SECRECT_KEY:
    raise ValueError("JWT_KEY environment variable not set.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone(timedelta(hours=9))) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRECT_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_access_token(token: str) -> Union[dict, None]:
    try:
        payload = jwt.decode(token, SECRECT_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None