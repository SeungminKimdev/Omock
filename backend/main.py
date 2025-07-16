import models
from database import Base, engine
from fastapi import FastAPI
from routers import router

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(router)

@app.get("/")
def read_root():
    return {"Test": "Success"}