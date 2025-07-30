from fastapi import APIRouter
from routers import boards, records, users

router = APIRouter()
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(boards.router, prefix="/boards", tags=["boards"])
router.include_router(records.router, prefix="/records", tags=["records"])