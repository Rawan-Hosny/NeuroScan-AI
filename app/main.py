from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from pydantic import BaseModel, Field, EmailStr, field_validator
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import sqlite3

import jwt
from passlib.context import CryptContext

import app_db as dbm

import model_utils

app = FastAPI(title="NeuroScan AI API")

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
JWT_SECRET = os.environ.get("MED_APP_JWT_SECRET", "dev-jwt-secret-change-in-production")
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = 30


def _hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_access_token(user_id: int, email: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": str(user_id), "email": email, "exp": exp},
        JWT_SECRET,
        algorithm=JWT_ALG,
    )


def _decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


@app.on_event("startup")
def _startup() -> None:
    dbm.init_db()

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOADS_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


@app.get("/")
async def root_index():
    """Entry point: UI lives under /static/ so relative asset paths resolve correctly."""
    return RedirectResponse(url="/static/index.html", status_code=302)


# Mount static directory
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- Security Scheme ---
security = HTTPBearer(auto_error=False)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please log in to access this resource."
        )
    try:
        payload = _decode_token(credentials.credentials)
        uid = int(payload["sub"])
    except (jwt.ExpiredSignatureError, jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")
    user = dbm.get_user_by_id(uid)
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists.")
    return {
        "uid": str(user["id"]),
        "email": user["email"],
        "full_name": user["full_name"],
    }


# --- Auth Routes ---

@app.post("/auth/verify")
async def verify_token(user: dict = Depends(get_current_user)):
    return {
        "status": "authenticated",
        "uid": user.get("uid"),
        "email": user.get("email"),
        "full_name": user.get("full_name"),
    }


class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=256)

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        import re
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        if not re.search(r'[^A-Za-z0-9]', v):
            raise ValueError('Password must contain at least one special character')
        return v


class AuthLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=256)


@app.post("/auth/signup")
def signup_user(req: SignupRequest) -> dict:
    # Check if email is already registered before saving
    if dbm.get_user_by_email(req.email):
        raise HTTPException(
            status_code=400, detail="An account with this email already exists."
        )

    ph = _hash_password(req.password)
    try:
        uid = dbm.create_user(
            email=req.email, password_hash=ph, full_name=req.full_name
        )
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400, detail="An account with this email already exists."
        ) from None
    token = _create_access_token(uid, req.email.strip().lower())
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": uid, "email": req.email.strip().lower(), "full_name": req.full_name},
    }


@app.post("/auth/login")
def login_user(req: AuthLoginRequest) -> dict:
    row = dbm.get_user_by_email(req.email)
    if row is None:
        raise HTTPException(status_code=401, detail="This email is not registered. Please create an account first.")
    if not _verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid password.")
    uid = int(row["id"])
    token = _create_access_token(uid, row["email"])
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": uid,
            "email": row["email"],
            "full_name": row["full_name"],
        },
    }


class AuthResetRequest(BaseModel):
    email: str

@app.post("/auth/reset-password")
async def reset_password(req: AuthResetRequest):
    """
    Check if email exists in database.
    """
    user = dbm.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=404, detail="Email not found.")
    return {"status": "success", "message": "Email exists."}


class FinalResetRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/reset-password-final")
async def reset_password_final(req: FinalResetRequest):
    """
    Update password in database.
    """
    ph = _hash_password(req.password)
    success = dbm.update_user_password(req.email, ph)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update password.")
    return {"status": "success", "message": "Password updated successfully."}


# --- Protected Diagnostic Route ---

@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    name: str = Form("Unknown"),
    age: str = Form("Unknown"),
    gender: str = Form("Unknown"),
    mmse_score: str = Form("Unknown"),
    current_user: dict = Depends(get_current_user)  # << PROTECTED
):
    """
    Protected endpoint: receives MRI image + patient metadata,
    runs the AI model, and returns diagnostic results.
    Requires a valid Bearer token issued by Firebase Auth.
    """
    try:
        image_bytes = await file.read()

        import uuid
        heatmap_filename = f"heatmap_{uuid.uuid4().hex}.png"
        heatmap_path = os.path.join(UPLOADS_DIR, heatmap_filename)

        result = model_utils.process_and_predict(image_bytes, heatmap_path)

        return {
            "prediction": result["diagnosis"],
            "diagnosis": result["diagnosis"],
            "stage": result["stage"],
            "confidence": result["confidence"],
            "heatmap_url": f"/static/uploads/{heatmap_filename}",
            "patient": {
                "name": name,
                "age": age,
                "gender": gender,
                "mmse": mmse_score
            }
        }

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        # Log to a persistent file we can definitely read
        with open("error_debug.log", "a") as f:
            f.write(f"\n--- {datetime.now()} ---\n{tb}\n")
        
        print(tb) # Also print to console
        
        if isinstance(e, model_utils.InvalidMRIImageError):
            return JSONResponse(
                status_code=400,
                content={
                    "detail": e.message,
                },
            )
        return JSONResponse(
            status_code=500,
            content={
                "message": f"Server Error: {str(e)}",
                "traceback": tb
            }
        )


@app.get("/exam")
@app.get("/exam/")
async def exam_entry_redirect():
    """Shortcut URL; assets load from /static/exam.html (registered after mount)."""
    return RedirectResponse(url="/static/exam.html", status_code=302)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
