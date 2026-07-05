import os
import json
import fitz
import asyncio
import aiohttp
import random
import string
import smtplib
import logging
from contextlib import asynccontextmanager
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
import google.generativeai as genai
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from PIL import Image
import hashlib
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
from typing import List, Optional
import json_repair

load_dotenv()

logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 70)
    print("[Startup] NexusPrep backend starting...")
    print(f"[Startup] Gemini fallback order: {' -> '.join(ACTIVE_MODELS)}")
    print("[Startup] Server ready - listening for requests.")
    print("=" * 70)
    yield
    print("=" * 70)
    print("[Shutdown] NexusPrep backend shutting down...")
    print("=" * 70)

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# 📂 EMAIL SENDER UTILITY
# ============================================================================
def send_email(to_email: str, subject: str, message_body: str):
    sender_email = os.getenv("SMTP_EMAIL")
    sender_password = os.getenv("SMTP_APP_PASSWORD")
    if not sender_email or not sender_password:
        print("[Error] SMTP credentials missing. Email not sent.")
        return

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(message_body, 'plain'))
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(sender_email, sender_password)
            server.send_message(msg)
    except Exception as e:
        print(f"[Error] Failed to send email: {e}")

# ============================================================================
# 📂 API KEY CONFIGURATION & BACKOFF LOGIC
# ============================================================================
api_key_1 = os.getenv("GEMINI_API_KEY_1", os.getenv("GEMINI_API_KEY"))
api_key_2 = os.getenv("GEMINI_API_KEY_2", api_key_1) 

if api_key_1:
    genai.configure(api_key=api_key_1)

ACTIVE_MODELS = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash"]

async def call_gemini_with_fallback(contents) -> str:
    for model_name in ACTIVE_MODELS:
        try:
            print(f"[Gemini] Using model: {model_name}")
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(contents)
            return response.text
        except Exception as e:
            print(f"[Gemini] ERROR ({model_name}): {e}. Falling back to next model...")
            continue
            
    raise HTTPException(status_code=500, detail="Gemini API limits exhausted across all fallback models. Please try again later.")

async def fetch_gemini_json(prompt: str, api_key: str, retries=5) -> dict:
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}], 
        "generationConfig": {"responseMimeType": "application/json"}
    }
    
    async with aiohttp.ClientSession() as session:
        for model_name in ACTIVE_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            print(f"[Gemini] Using model: {model_name}")
            for i in range(retries):
                async with session.post(url, headers=headers, json=payload) as resp:
                    if resp.status == 429:
                        wait = (2 ** i) + random.random()
                        print(f"[Gemini] {model_name} rate-limited. Retrying in {wait:.2f}s...")
                        await asyncio.sleep(wait)
                        continue
                    
                    if resp.status == 404:
                        print(f"[Gemini] ERROR: {model_name} not available (404). Falling back to next model...")
                        break 
                        
                    if resp.status != 200:
                        print(f"[Gemini] ERROR: {model_name} returned status {resp.status}. Falling back to next model...")
                        break 
                        
                    data = await resp.json()
                    
                    try:
                        raw_text = data['candidates'][0]['content']['parts'][0]['text']
                        parsed = json_repair.loads(raw_text)
                        if isinstance(parsed, dict):
                            print(f"[Gemini] {model_name} responded successfully.")
                            return parsed
                        else:
                            return {}
                    except Exception as e:
                        print(f"[Gemini] ERROR: failed to parse {model_name} response: {e}")
                        return {}
                        
        raise HTTPException(status_code=500, detail="Gemini API limits exhausted across all fallback models. Please try again later.")

# ============================================================================
# 📂 MONGODB SETUP
# ============================================================================
MONGO_URL = os.getenv("MONGODB_URL")
if MONGO_URL:
    client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where())
    db = client.smart_study 
    users_collection = db.users
    otp_collection = db.otps
    flashcards_collection = db.flashcard_decks
else:
    print("[Startup] WARNING: MONGODB_URL not found in .env. Database features will fail.")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# ============================================================================
# 📂 PYDANTIC SCHEMAS
# ============================================================================
class LoginModel(BaseModel):
    email: str
    password: str

class SendOTPModel(BaseModel):
    email: str

class ResetModel(BaseModel):
    email: str

class RegisterModel(BaseModel):
    email: str
    password: str
    name: str
    age: str
    educationLevel: str = ""
    educationSubOption: str = ""
    otp: str

class ProfileUpdateModel(BaseModel):
    email: str
    name: str
    age: str
    educationLevel: str
    educationSubOption: str
    usePersonalContext: bool
    storeFlashcards: bool = True
    emailReminders: bool = True
    newPassword: str = ""

class StatUpdateModel(BaseModel):
    email: str
    stat: str
    value: int

class ReminderDispatchModel(BaseModel):
    email: str
    message: str
    subject: str = "NexusPrep - Time to Revise!"

class FlashcardModel(BaseModel):
    term: str
    definition: str

class DeckCreateModel(BaseModel):
    email: str
    title: str
    cards: List[FlashcardModel]

class DeckEmailModel(BaseModel):
    email: str

class DeckImportModel(BaseModel):
    email: str
    decks: List[dict]

# ============================================================================
# 📂 AUTH & PROFILE ENDPOINTS
# ============================================================================
@app.post("/api/auth/send-otp")
async def send_otp(data: SendOTPModel):
    existing = await users_collection.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
    
    otp_code = ''.join(random.choices(string.digits, k=6))
    expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    await otp_collection.update_one(
        {"email": data.email},
        {"$set": {"otp": otp_code, "expires_at": expiry}},
        upsert=True
    )
    
    body = f"Welcome to NexusPrep!\n\nYour 6-digit verification code is: {otp_code}\n\nThis code will expire in 10 minutes.\nDo not share this code with anyone."
    send_email(data.email, "NexusPrep - Your Verification Code", body)
    
    return {"status": "success", "message": "OTP sent to your email."}

@app.post("/api/auth/register")
async def register_user(data: RegisterModel):
    existing = await users_collection.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
        
    otp_record = await otp_collection.find_one({"email": data.email})
    
    if not otp_record or otp_record.get("otp") != data.otp:
        raise HTTPException(status_code=400, detail="Invalid Verification Code.")
        
    expires_at = otp_record.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if expires_at and datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Verification Code has expired.")
    
    new_user = {
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "age": data.age,
        "educationLevel": data.educationLevel,
        "educationSubOption": data.educationSubOption,
        "usePersonalContext": True,
        "storeFlashcards": True,
        "emailReminders": True,
        "studyStreak": 1,
        "totalCardsLearned": 0,
        "docsProcessed": 0,
        "pyqsAnalyzed": 0,
        "strategiesGenerated": 0,
        "quizzesTaken": 0
    }
    
    await users_collection.insert_one(new_user)
    await otp_collection.delete_one({"email": data.email}) 
    
    new_user.pop('_id', None)
    new_user.pop('password', None)
    return new_user

@app.post("/api/auth/login")
async def login_user(data: LoginModel):
    user = await users_collection.find_one({"email": data.email})
    if not user or user["password"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    user.pop('_id', None)
    user.pop('password', None)
    return user

@app.post("/api/auth/reset")
async def reset_password(data: ResetModel):
    user = await users_collection.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=404, detail="Email not found.")
        
    new_password_base = (
        random.choice(string.ascii_uppercase) +
        random.choice(string.ascii_lowercase) +
        random.choice(string.digits) +
        random.choice("@$!%*?&") +
        ''.join(random.choices(string.ascii_letters + string.digits + "@$!%*?&", k=4))
    )
    new_pass = ''.join(random.sample(new_password_base, len(new_password_base)))
    
    await users_collection.update_one(
        {"email": data.email},
        {"$set": {"password": hash_password(new_pass)}}
    )
    
    body = f"Hello,\n\nYou requested a password reset for your NexusPrep account.\n\nWe have generated a new secure temporary password for you: {new_pass}\n\nPlease log in using this password and immediately update it in your Profile Settings -> Account Management page."
    send_email(data.email, "NexusPrep - Password Reset Request", body)
    
    return {"status": "success", "message": "A new password has been generated and sent to your email."}

@app.put("/api/profile/update")
async def update_profile(data: ProfileUpdateModel):
    update_fields = {
        "name": data.name,
        "age": data.age,
        "educationLevel": data.educationLevel,
        "educationSubOption": data.educationSubOption,
        "usePersonalContext": data.usePersonalContext,
        "storeFlashcards": data.storeFlashcards,
        "emailReminders": data.emailReminders
    }
    if data.newPassword:
        update_fields["password"] = hash_password(data.newPassword)

    result = await users_collection.update_one(
        {"email": data.email},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"status": "success"}

@app.post("/api/stats/increment")
async def increment_stat(data: StatUpdateModel):
    await users_collection.update_one(
        {"email": data.email},
        {"$inc": {data.stat: data.value}}
    )
    return {"status": "success"}

@app.post("/api/reminders/dispatch")
async def dispatch_reminder(data: ReminderDispatchModel):
    user = await users_collection.find_one({"email": data.email})
    
    if not user or not user.get("emailReminders", True) or not user.get("storeFlashcards", True):
        return {"status": "skipped", "message": "User opted out of reminders or flashcard storage."}
    
    send_email(data.email, data.subject, data.message)
    return {"status": "success", "message": "Reminder dispatched."}

# ============================================================================
# 📂 FLASHCARD DECK ENDPOINTS (Cloud Storage)
# ============================================================================
REVISION_INTERVALS_DAYS = [1, 3, 7, 14, 30]
DAY_MS = 24 * 60 * 60 * 1000

def get_next_revision_interval(revision_count: int) -> int:
    return REVISION_INTERVALS_DAYS[min(revision_count, len(REVISION_INTERVALS_DAYS) - 1)]

def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)

def serialize_deck(deck: dict) -> dict:
    deck.pop("_id", None)
    if "revisionCount" not in deck:
        deck["revisionCount"] = 0
        deck["lastRevised"] = deck.get("timestamp", now_ms())
        deck["nextRevisionDate"] = deck.get("timestamp", now_ms()) + DAY_MS
        deck["stopRevision"] = False
    return deck

@app.get("/api/flashcards/decks")
async def get_decks(email: str):
    cursor = flashcards_collection.find({"email": email}).sort("timestamp", -1)
    decks = await cursor.to_list(length=None)
    return [serialize_deck(d) for d in decks]

@app.post("/api/flashcards/decks")
async def create_deck(data: DeckCreateModel):
    timestamp = now_ms()
    new_deck = {
        "id": uuid.uuid4().hex,
        "email": data.email,
        "title": data.title,
        "cards": [c.dict() for c in data.cards],
        "timestamp": timestamp,
        "revisionCount": 0,
        "lastRevised": timestamp,
        "nextRevisionDate": timestamp + DAY_MS,
        "stopRevision": False
    }
    await flashcards_collection.insert_one(new_deck)
    return serialize_deck(new_deck)

@app.post("/api/flashcards/decks/import")
async def import_decks(data: DeckImportModel):
    imported = 0
    for deck in data.decks:
        deck_id = deck.get("id") or uuid.uuid4().hex
        doc = {**deck, "id": deck_id, "email": data.email}
        doc.pop("_id", None)
        result = await flashcards_collection.update_one(
            {"id": deck_id, "email": data.email},
            {"$setOnInsert": doc},
            upsert=True
        )
        if result.upserted_id is not None:
            imported += 1
    return {"status": "success", "imported": imported}

@app.put("/api/flashcards/decks/{deck_id}/revision")
async def complete_revision(deck_id: str, data: DeckEmailModel):
    deck = await flashcards_collection.find_one({"id": deck_id, "email": data.email})
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found.")

    revision_count = deck.get("revisionCount", 0) + 1
    interval = get_next_revision_interval(revision_count)
    timestamp = now_ms()

    updates = {
        "revisionCount": revision_count,
        "lastRevised": timestamp,
        "nextRevisionDate": timestamp + (interval * DAY_MS),
        "stopRevision": False
    }
    await flashcards_collection.update_one({"id": deck_id, "email": data.email}, {"$set": updates})
    deck.update(updates)
    return serialize_deck(deck)

@app.put("/api/flashcards/decks/{deck_id}/stop")
async def stop_revision(deck_id: str, data: DeckEmailModel):
    result = await flashcards_collection.update_one(
        {"id": deck_id, "email": data.email},
        {"$set": {"stopRevision": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Deck not found.")

    deck = await flashcards_collection.find_one({"id": deck_id, "email": data.email})
    return serialize_deck(deck)

@app.delete("/api/flashcards/decks/{deck_id}")
async def delete_deck(deck_id: str, email: str):
    result = await flashcards_collection.delete_one({"id": deck_id, "email": email})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deck not found.")
    return {"status": "success"}

# ============================================================================
# 📂 AI PDF PROCESSING ENDPOINTS
# ============================================================================
ocr_semaphore = asyncio.Semaphore(3)

async def extract_text_with_fallback(file: UploadFile) -> str:
    pdf_bytes = await file.read()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = "".join([page.get_text() for page in doc])
    
    if len(text.strip()) < 50:
        ocr_text = ""
        for page in doc:
            async with ocr_semaphore:
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                try:
                    ocr_result = await call_gemini_with_fallback(["Extract all the text from this image exactly as it appears.", img])
                    ocr_text += ocr_result + "\n"
                except Exception as e:
                    print(f"[Error] OCR failed on page: {e}")
        text = ocr_text
            
    if not text.strip():
         raise HTTPException(status_code=400, detail=f"Could not extract text from {file.filename}.")
    return text

def construct_personal_context(user_context_str: str) -> str:
    if not user_context_str: return ""
    try:
        ctx = json.loads(user_context_str)
        return f"\n\nCRITICAL CONTEXT: User is {ctx.get('age', 'student')} year old studying {ctx.get('educationLevel', '')}. Tailor vocabulary and complexity accordingly."
    except: return ""

MATH_FORMATTING_RULES = """
CRITICAL FORMATTING RULES FOR JSON AND MATH:
1. Plain text ONLY for descriptions. DO NOT use markdown like **bold** or *italics*.
2. DO NOT use LaTeX structural environments like \\begin{itemize}, \\begin{enumerate}, etc.
3. STRICT LATEX WRAPPING: Every single mathematical formula, equation, variable, and Greek letter MUST be wrapped in $...$ (inline) or $$...$$ (block).
   - CORRECT: Rank $r = n - 1$, Nullity $\\mu = e - n + 1$
   - WRONG (Missing $): Rank $r = n - 1$, Nullity \\mu = e - n + 1
   - WRONG (Spelled out): Nullity mu = e - n + 1
   - Every $ or $$ you open MUST be closed. Never leave a dangling/unmatched $ or $$.
4. GREEK LETTERS: DO NOT spell out Greek letters. Use LaTeX (e.g., write $\\rho$, NEVER "rho"; write $\\mu$, NEVER "mu"). Example: Write $P(W_q > t) = \\rho e^{-(\\mu-\\lambda)t}$.
5. Write LaTeX commands with a single backslash exactly as you would in a normal .tex file, and use single curly braces for grouping (e.g. \\frac{a}{b}, \\mu, \\sum). Do NOT add an extra backslash (e.g. do not write \\\\mu) and do NOT double the curly braces (e.g. do not write \\frac{{a}}{{b}}) — single backslash and single braces are correct LaTeX; you are already returning valid JSON, so escaping for the JSON string itself is handled automatically.
6. In the "equation" field of any formula object, provide ONLY the raw LaTeX (e.g. \\frac{a}{b} = c), with NO $ or $$ delimiters — the app already renders that field as a block equation automatically. Only use $ / $$ delimiters for math that appears inside "explanation", "summary_points", "definition", or other prose text fields.
"""

@app.post("/api/summarize")
async def summarize_document(
    files: List[UploadFile] = File(...),
    userContext: str = Form(None)
):
    print(f"[Request] Received: POST /api/summarize ({len(files)} file(s))")

    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum of 5 files allowed.")

    try:
        print("[Processing] Extracting text from uploaded document(s)...")
        texts = [await extract_text_with_fallback(f) for f in files]
        
        snippets = [f"Document {i+1} snippet: {t[:1000]}" for i, t in enumerate(texts)]
        val_prompt = f"Analyze the following document snippet(s). Are they valid educational materials? CRITICAL INSTRUCTION: Formula sheets, mathematical equations, queuing theory formulas, cheat sheets, and raw math notes ARE completely valid educational materials, even if the OCR text looks messy. Answer ONLY with 'YES' or 'NO'. {' '.join(snippets)}"
        
        print("[Processing] Validating document content...")
        val_response_text = await call_gemini_with_fallback(val_prompt)
        
        if "NO" in val_response_text.strip().upper() and "YES" not in val_response_text.strip().upper():
            raise HTTPException(status_code=400, detail="Document validation failed. Ensure the uploaded files are valid educational materials and belong to the same subject.")

        combined_text = "\n\n--- NEXT DOCUMENT ---\n\n".join(texts)
        personalization = construct_personal_context(userContext)
        
        prompt_main = f"""
        Analyze the following educational text(s). Extract a short 2-4 word title representing the core subject, key takeaways, and formulas. {personalization}
        
        {MATH_FORMATTING_RULES}
        
        Return ONLY valid JSON:
        {{
            "title": "Graph Theory Concepts",
            "summary_points": ["Point 1", "Point 2", "Point 3"],
            "formulas": [{{"name": "Formula", "equation": "\\\\sum_{{i=1}}^{{n}} d(v_i) = 2(n - 1)", "explanation": "Expl"}}]
        }}
        Texts: {combined_text}
        """
        
        prompt_defs = f"""
        Analyze the following educational text(s). {personalization}
        Extract AT LEAST 15 to 20 core definitions and concepts for flashcards. 
        CRITICAL: If the document consists primarily of formulas, extract the names of the formulas/variables as the 'term' and the equation and its explanation as the 'definition'.
        
        {MATH_FORMATTING_RULES}
        
        Return ONLY valid JSON:
        {{
            "definitions": [{{"term": "Term", "definition": "Def"}}]
        }}
        Texts: {combined_text}
        """
        
        print("[Processing] Sending prompts to Gemini for AI generation (summary + definitions)...")
        await asyncio.sleep(0.5)
        task_main = asyncio.create_task(fetch_gemini_json(prompt_main, api_key_1))
        await asyncio.sleep(0.5)
        task_defs = asyncio.create_task(fetch_gemini_json(prompt_defs, api_key_2))
        
        data_main, data_defs = await asyncio.gather(task_main, task_defs)
        
        data_main["definitions"] = data_defs.get("definitions", [])
        print("[Response] AI generation complete. Sending combined JSON to frontend.")
        return data_main
        
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/exam-strategy")
async def generate_exam_strategy(
    notes_files: List[UploadFile] = File(...), 
    pyqs_files: List[UploadFile] = File(...),
    userContext: str = Form(None)
):
    print(f"[Request] Received: POST /api/exam-strategy ({len(notes_files)} notes file(s), {len(pyqs_files)} PYQ file(s))")

    if len(notes_files) > 5 or len(pyqs_files) > 5:
        raise HTTPException(status_code=400, detail="Max 5 files per category.")

    try:
        print("[Processing] Extracting text from Notes and PYQ document(s)...")
        notes_texts = [await extract_text_with_fallback(f) for f in notes_files]
        pyqs_texts = [await extract_text_with_fallback(f) for f in pyqs_files]

        notes_snippets = [f"Notes Doc {i+1}: {t[:1000]}" for i, t in enumerate(notes_texts)]
        pyqs_snippets = [f"PYQs Doc {i+1}: {t[:1000]}" for i, t in enumerate(pyqs_texts)]
        val_prompt = f"Analyze the following document snippets. Are they all valid educational materials? CRITICAL INSTRUCTION: Formula sheets, mathematical equations, queuing theory formulas, cheat sheets, and raw math notes ARE completely valid educational materials, even if the OCR text looks messy. Answer ONLY with 'YES' or 'NO'. {' '.join(notes_snippets)} {' '.join(pyqs_snippets)}"
        
        print("[Processing] Validating Notes and PYQs belong to the same subject...")
        val_response_text = await call_gemini_with_fallback(val_prompt)
        
        if "NO" in val_response_text.strip().upper() and "YES" not in val_response_text.strip().upper():
            raise HTTPException(status_code=400, detail="Document mismatch detected. Ensure all your Notes and PYQs are valid and belong to the same academic subject.")

        combined_notes = "\n\n--- NEXT DOCUMENT ---\n\n".join(notes_texts)
        combined_pyqs = "\n\n--- NEXT DOCUMENT ---\n\n".join(pyqs_texts)
        personalization = construct_personal_context(userContext)
        
        prompt_strategy = f"""
        Act as an expert academic strategist. Analyze these Study Notes and PYQs. {personalization}
        Extract a 2-4 word short title, high yield topics, strategic insights, formulas, and 10+ difficult MCQ questions.
        
        {MATH_FORMATTING_RULES}
        
        Return ONLY valid JSON:
        {{
            "title": "Graph Theory Concepts",
            "highYieldTopics": ["Topic 1", "..."],
            "strategicInsights": ["Insight 1", "..."],
            "formulas": [{{"name": "Formula 1", "equation": "\\\\sum_{{i=1}}^{{n}} d(v_i) = 2(n - 1)", "explanation": "..."}}],
            "difficultQuiz": [{{"question": "Q1", "options": ["A","B","C","D"], "correctIndex": 0}}]
        }}
        Notes: {combined_notes}
        PYQs: {combined_pyqs}
        """

        prompt_qa = f"""
        Act as an expert examiner. Predict 10+ descriptive exam questions (strictly 4-mark and 8-mark only) with high-quality answers. {personalization}
        
        {MATH_FORMATTING_RULES}
        
        Return ONLY valid JSON:
        {{
            "predictedQuestions": [{{"id": 1, "marks": 4, "question": "Q1", "answer": "Detailed answer paragraph 1.\\n\\nParagraph 2."}}]
        }}
        Notes: {combined_notes}
        PYQs: {combined_pyqs}
        """
        
        prompt_defs = f"""
        Analyze these Study Notes and PYQs. {personalization}
        Extract AT LEAST 15 to 20 core definitions and concepts for flashcards.
        CRITICAL: If the document consists primarily of formulas, extract the names of the formulas/variables as the 'term' and the equation and its explanation as the 'definition'.
        
        {MATH_FORMATTING_RULES}
        
        Return ONLY valid JSON:
        {{
            "definitions": [{{"term": "Term", "definition": "Def"}}]
        }}
        Notes: {combined_notes}
        PYQs: {combined_pyqs}
        """

        print("[Processing] Sending prompts to Gemini for AI generation (strategy + questions + definitions)...")
        await asyncio.sleep(0.5)
        task_strategy = asyncio.create_task(fetch_gemini_json(prompt_strategy, api_key_1))
        await asyncio.sleep(0.5)
        task_qa = asyncio.create_task(fetch_gemini_json(prompt_qa, api_key_2))
        await asyncio.sleep(0.5)
        task_defs = asyncio.create_task(fetch_gemini_json(prompt_defs, api_key_1))
        
        data_strategy, data_qa, data_defs = await asyncio.gather(task_strategy, task_qa, task_defs)
        
        data_strategy["predictedQuestions"] = data_qa.get("predictedQuestions", [])
        data_strategy["definitions"] = data_defs.get("definitions", [])
        
        print("[Response] AI generation complete. Sending combined JSON to frontend.")
        return data_strategy

    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))