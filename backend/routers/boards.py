from core.security import verify_access_token
from crud import create_board, get_user_by_id, get_user_by_user_id
from database import get_db
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from models import Board
from schemas import BoardCreate, BoardUpdate
from sqlalchemy.orm import Session


router = APIRouter()

# 게시글 생성
@router.post("/", status_code=201)
async def create_board_endpoint(request: Request, db: Session = Depends(get_db)):
    try:
        headers = request.headers
        access_token = headers.get("access_token")
        if not access_token and verify_access_token(access_token) is None:
            return JSONResponse(status_code=401, content={"errorMessage": "Access token is required"})
        login_id = verify_access_token(access_token)["user_id"]
        user_id = get_user_by_id(db, login_id).user_id
    except Exception as e:
        return JSONResponse(status_code=400, content={"errorMessage": "Invalid access token", "error": str(e), "login_id":login_id})
    
    try:
        board_data = await request.json()
        board_data['user_id'] = user_id
        board = BoardCreate(**board_data)
    except Exception as e:
        return JSONResponse(status_code=400, content={"errorMessage": "Invalid request data"})
    
    try:
        db_board = create_board(db, board)
        return JSONResponse(status_code=201, content={"message": "Board created successfully", "board_id": db_board.board_id})
    except ValueError as e:
        return JSONResponse(status_code=400, content={"errorMessage": str(e)})

# 단일 게시글 불러오기
@router.get("/{board_id}", status_code=200)
async def get_board_endpoint(board_id: int, db: Session = Depends(get_db)):
    db_board = db.query(Board).filter(Board.board_id == board_id).first()
    if not db_board:
        return JSONResponse(status_code=404, content={"errorMessage": "Board not found"})
    return JSONResponse(status_code=200, content={
        "user_name": get_user_by_user_id(db, db_board.user_id).name,
        "title": db_board.title,
        "content": db_board.content,
        "updated_at": db_board.updated_at.isoformat(timespec='seconds')
    })

# 다중 게시글 불러오기
@router.get("/", status_code=200)
async def get_boards_endpoint(limit: int = 10, db: Session = Depends(get_db)):
    db_boards = db.query(Board).order_by(Board.updated_at.desc()).limit(limit).all()
    if not db_boards:
        return JSONResponse(status_code=404, content={"errorMessage": "No boards found"})
    
    boards_list = [{
        "user_name": get_user_by_user_id(db, board.user_id).name,
        "title": board.title,
        "content": board.content,
        "updated_at": board.updated_at.isoformat(timespec='seconds')
    } for board in db_boards]
    
    return JSONResponse(status_code=200, content={"boards": boards_list})