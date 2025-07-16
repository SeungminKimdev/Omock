from datetime import datetime, timedelta, timezone

from sqlalchemy import and_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import models, schemas


# User CRUD
def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    if get_user_by_id(db, user.id):
        raise ValueError(f"User with id {user.id} already exists.")
    db_user = models.User(
        id=user.id,
        name=user.name,
        password=user.password,
        winrate=user.winrate
    )
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
    except SQLAlchemyError as e:
        db.rollback()
        raise e
    return db_user

def get_user_by_id(db: Session, user_id: int) -> models.User:
    return db.query(models.User).filter(models.User.user_id == user_id).first()

def update_user(db:Session, user_id: int, user_update: schemas.UserUpdate) -> models.User:
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        raise ValueError(f"User with id {user_id} does not exist.")
    
    if user_update.name:
        db_user.name = user_update.name
    
    try:
        db.commit()
        db.refresh(db_user)
    except SQLAlchemyError as e:
        db.rollback()
        raise e
    return db_user

def delete_user(db: Session, user_id: int) -> None:
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        raise ValueError(f"User with id {user_id} does not exist.")
    
    db.delete(db_user)
    try:
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        raise e


# Record CRUD
def create_record(db: Session, record: schemas.RecordCreate) -> models.Record:
    db_record = models.Record(
        player1=record.player1,
        player2=record.player2,
        winner=record.winner,
        updated_at=datetime.now(timezone(timedelta(hours=9)))  # KST timezone
    )
    db.add(db_record)
    try:
        db.commit()
        db.refresh(db_record)
    except SQLAlchemyError as e:
        db.rollback()
        raise e

def get_record_by_userId(db: Session, user_id: int) -> list[models.Record]:
    return db.query(models.Record).filter(
        and_(
            models.Record.player1 == user_id,
            models.Record.player2 == user_id
        )
    ).all()

def get_record_recent(db: Session, limit: int = 10) -> list[models.Record]:
    return db.query(models.Record).order_by(models.Record.updated_at.desc()).limit(limit).all()

def delete_record(db: Session, record_id: int) -> None:
    db_record = db.query(models.Record).filter(models.Record.record_id == record_id).first()
    if not db_record:
        raise ValueError(f"Record with id {record_id} does not exist.")
    
    db.delete(db_record)
    try:
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        raise e


# Board CRUD
def create_board(db: Session, board: schemas.BoardCreate) -> models.Board:
    db_board = models.Board(
        user_id=board.user_id,
        title=board.title,
        content=board.content,
        updated_at=datetime.now(timezone(timedelta(hours=9)))  # KST timezone
    )
    db.add(db_board)
    try:
        db.commit()
        db.refresh(db_board)
    except SQLAlchemyError as e:
        db.rollback()
        raise e
    return db_board

def get_board_by_userId(db: Session, user_id: int) -> list[models.Board]:
    return db.query(models.Board).filter(models.Board.user_id == user_id).all()

def get_board_by_title(db: Session, title: str) -> list[models.Board]:
    return db.query(models.Board).filter(models.Board.title.ilike(f"%{title}%")).all()

def update_board(db: Session, board_id: int, board_update: schemas.BoardUpdate) -> models.Board:
    db_board = db.query(models.Board).filter(models.Board.board_id == board_id).first()
    if not db_board:
        raise ValueError(f"Board with id {board_id} does not exist.")
    
    if board_update.title:
        db_board.title = board_update.title
    if board_update.content:
        db_board.content = board_update.content
    
    db_board.updated_at = datetime.now(timezone(timedelta(hours=9)))  # KST timezone
    
    try:
        db.commit()
        db.refresh(db_board)
    except SQLAlchemyError as e:
        db.rollback()
        raise e
    return db_board

def delete_board(db: Session, board_id: int) -> None:
    db_board = db.query(models.Board).filter(models.Board.board_id == board_id).first()
    if not db_board:
        raise ValueError(f"Board with id {board_id} does not exist.")
    
    db.delete(db_board)
    try:
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        raise e