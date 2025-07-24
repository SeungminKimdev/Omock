from database import Base
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = 'user'
    
    user_id = Column(Integer, primary_key=True, index=True)
    id = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    winrate = Column(Float, default=0.0)
    
    records_p1 = relationship('Record', foreign_keys='Record.player1', back_populates='player1_user')
    records_p2 = relationship('Record', foreign_keys='Record.player2', back_populates='player2_user')
    records_winner = relationship('Record', foreign_keys='Record.winner', back_populates='winner_user')
    boards = relationship('Board', back_populates='user')


class Record(Base):
    __tablename__ = 'record'
    
    record_id = Column(Integer, primary_key=True, index=True)
    player1 = Column(Integer, ForeignKey('user.user_id'), nullable=False)
    player2 = Column(Integer, ForeignKey('user.user_id'), nullable=False)
    winner = Column(Integer, ForeignKey('user.user_id'), nullable=True)
    updated_at = Column(DateTime, nullable=False)
    
    player1_user = relationship('User', back_populates='records_p1', foreign_keys=[player1])
    player2_user = relationship('User', back_populates='records_p2', foreign_keys=[player2])
    winner_user = relationship('User', back_populates='records_winner', foreign_keys=[winner])


class Board(Base):
    __tablename__ = 'board'
    
    board_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('user.user_id'), nullable=False)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    
    user = relationship('User', back_populates='boards')