from fastapi import APIRouter
from routers import boards, records, users, ws_omock

router = APIRouter()
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(boards.router, prefix="/boards", tags=["boards"])
router.include_router(records.router, prefix="/records", tags=["records"])
router.include_router(ws_omock.router, prefix="/ws", tags=["websockets"])