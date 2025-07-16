from fastapi import APIRouter
from routers import boards, records, users

router = APIRouter()
router.include_router(users.router, prefix="/users", tags=["users"])