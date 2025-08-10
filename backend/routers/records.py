from crud import get_user_by_user_id, get_user_by_name
from database import get_db
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from models import Record
from sqlalchemy.orm import Session
from schemas import RecordCreate
from crud import create_record


router = APIRouter()

# 기록 수동 생성
@router.post("/", status_code=201)
async def create_record_directly(request: Request, db: Session = Depends(get_db)):
    try:
        record_data = await request.json()
        record = RecordCreate(**record_data)
        db_record = create_record(db, record)
        return JSONResponse(status_code=201, content={"message": "Record created successfully", "record_id": db_record.record_id})
    except Exception as e:
        return JSONResponse(status_code=400, content={"errorMessage": "Invalid request data", "error": str(e)})

# 단일 기록 불러오기
@router.get("/{record_id}", status_code=200)
async def get_record_endpoint(record_id: int, db: Session = Depends(get_db)):
    db_record = db.query(Record).filter(Record.record_id == record_id).first()
    if not db_record:
        return JSONResponse(status_code=404, content={"errorMessage": "Record not found"})
    
    return JSONResponse(status_code=200, content={
        "player1": get_user_by_user_id(db, db_record.player1).name,
        "player2": get_user_by_user_id(db, db_record.player2).name,
        "record_id": db_record.record_id,
        "winner": get_user_by_user_id(db, db_record.winner).name,
        "updated_at": db_record.updated_at.isoformat(timespec='seconds')
    })

# 다중 최근 기록 불러오기
@router.get("/", status_code=200)
async def get_records_endpoint(limit: int = 10, db: Session = Depends(get_db)):
    db_records = db.query(Record).order_by(Record.updated_at.desc()).limit(limit).all()
    if not db_records:
        return JSONResponse(status_code=404, content={"errorMessage": "No records found"})
    
    records_list = [{
        "player1": get_user_by_user_id(db, record.player1).name,
        "player2": get_user_by_user_id(db, record.player2).name,
        "record_id": record.record_id,
        "winner": get_user_by_user_id(db, record.winner).name,
        "updated_at": record.updated_at.isoformat(timespec='seconds')
    } for record in db_records]
    
    return JSONResponse(status_code=200, content=records_list)

# 특정 유저 기록 불러오기
@router.post("/search", status_code=200)
async def get_records_by_user_endpoint(request: Request, db: Session = Depends(get_db)):
    try:
        user_data = await request.json()
        user_name = user_data['user_name']
        if not user_name:
            return JSONResponse(status_code=400, content={"errorMessage": "User name is required"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"errorMessage": "Invalid request data", "error": str(e)})
    
    user_id = get_user_by_name(db, user_name).user_id
    db_records = db.query(Record).filter(
        (Record.player1 == user_id) | (Record.player2 == user_id)
    ).all()
    
    if not db_records:
        return JSONResponse(status_code=404, content={"errorMessage": "No records found for this user"})
    
    records_list = [{
        "player1": get_user_by_user_id(db, record.player1).name,
        "player2": get_user_by_user_id(db, record.player2).name,
        "record_id": record.record_id,
        "winner": get_user_by_user_id(db, record.winner).name if record.winner else None,
        "updated_at": record.updated_at.isoformat(timespec='seconds')
    } for record in db_records]
    
    return JSONResponse(status_code=200, content=records_list)