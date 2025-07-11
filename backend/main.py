from database import Base, engine
from fastapi import FastAPI


Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.get("/")
def read_root():
    return {"Test": "Success"}