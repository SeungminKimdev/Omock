from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from core.security import verify_password, create_access_token, get_password_hash
from crud import create_user
from schemas import UserCreate
from models import User

router = APIRouter()

# 유저 생성
@router.post("/users", status_code=201)
async def create_user_endpoint(request: Request, db: Session = Depends(get_db)):
    try:
        user_data = await request.json()
        user_data['password'] = get_password_hash(user_data['password'])
        user = UserCreate(**user_data)
    except Exception as e:
        return
    
    try:
        db_user = create_user(db, user)
        return JSONResponse(status_code=201, content={"message": "User created success", "user_id": db_user.user_id})
    except ValueError as e:
        return

# 로그인
@router.post("/users/login")
async def login(request: Request, db: Session = Depends(get_db)):
    try:
        login_data = await request.json()
        login_id = login_data['id']
        login_password = login_data['password']
        user = db.query(User).filter(User.id == login_id).first()
        if not user: # 유저 존재 여부 확인인
            return JSONResponse(status_code=404, content={"errorMessage": "User not found"})
        if not verify_password(login_password, user.password): # 비밀번호 확인
            return JSONResponse(status_code=401, content={"errorMessage": "Invalid credentials"})
    except:
        return JSONResponse(status_code=400, content={"errorMessage": "Invalid request data"})
    
    try:
        access_token = create_access_token(data={"user_id": user.id})
        return JSONResponse(status_code=200, content={"message": "Login success"}, headers={"access_token": access_token})
    except:
        return JSONResponse(status_code=500, content={"errorMessage": "Internal server error"})