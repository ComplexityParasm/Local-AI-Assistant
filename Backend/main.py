from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import uvicorn

from database import SessionLocal, engine, Base
from models import User, Chat, Message
from auth import get_current_user, authenticate_user, create_access_token, get_password_hash
from llm_proxy import send_to_llm

# Создаём таблицы
Base.metadata.create_all(bind=engine)

app = FastAPI(title="LLM Chat API")

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic модели
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class ChatCreate(BaseModel):
    title: Optional[str] = "Новый чат"

class MessageCreate(BaseModel):
    content: str
    chat_id: int

# Эндпоинты
@app.get("/")
def root():
    return {"message": "LLM Backend API is running", "status": "ok"}

@app.get("/api/health")
def health():
    return {"status": "healthy"}

@app.post("/api/register")
def register(user: UserCreate, db: Session = Depends(lambda: SessionLocal())):
    """Регистрация нового пользователя"""
    existing_user = db.query(User).filter(
        (User.username == user.username) | (User.email == user.email)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    access_token = create_access_token(data={"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer", "user_id": db_user.id}

@app.post("/api/login")
def login(user: UserLogin, db: Session = Depends(lambda: SessionLocal())):
    """Вход пользователя"""
    db_user = authenticate_user(db, user.username, user.password)
    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )
    access_token = create_access_token(data={"sub": db_user.username})
    return {"access_token": access_token, "token_type": "bearer", "user_id": db_user.id}

@app.get("/api/chats")
def get_chats(current_user: User = Depends(get_current_user), db: Session = Depends(lambda: SessionLocal())):
    """Получить все чаты текущего пользователя"""
    chats = db.query(Chat).filter(Chat.user_id == current_user.id).order_by(Chat.updated_at.desc()).all()
    return [{"id": chat.id, "title": chat.title, "created_at": chat.created_at, "updated_at": chat.updated_at} for chat in chats]

@app.post("/api/chats")
def create_chat(chat: ChatCreate, current_user: User = Depends(get_current_user), db: Session = Depends(lambda: SessionLocal())):
    """Создать новый чат"""
    db_chat = Chat(
        title=chat.title,
        user_id=current_user.id
    )
    db.add(db_chat)
    db.commit()
    db.refresh(db_chat)
    return {"id": db_chat.id, "title": db_chat.title, "created_at": db_chat.created_at, "updated_at": db_chat.updated_at}

@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(lambda: SessionLocal())):
    """Получить чат с сообщениями"""
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    messages = [{"role": msg.role, "content": msg.content, "created_at": msg.created_at} for msg in chat.messages]
    
    return {
        "id": chat.id,
        "title": chat.title,
        "created_at": chat.created_at,
        "updated_at": chat.updated_at,
        "messages": messages
    }

@app.post("/api/chat/completions")
async def chat_completion(
    message: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(lambda: SessionLocal())
):
    """Отправить сообщение и получить ответ от LLM"""
    
    # Проверяем доступ к чату
    chat = db.query(Chat).filter(Chat.id == message.chat_id, Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Сохраняем сообщение пользователя
    user_msg = Message(
        chat_id=chat.id,
        role="user",
        content=message.content
    )
    db.add(user_msg)
    db.commit()
    
    # Получаем историю чата для контекста
    history = db.query(Message).filter(Message.chat_id == chat.id).order_by(Message.created_at).all()
    messages_for_llm = [{"role": msg.role, "content": msg.content} for msg in history]
    
    async def generate():
        full_response = ""
        async for chunk in send_to_llm(messages_for_llm):
            full_response += chunk
            yield f"data: {chunk}\n\n"
        
        # Сохраняем ответ ассистента
        assistant_msg = Message(
            chat_id=chat.id,
            role="assistant",
            content=full_response
        )
        db.add(assistant_msg)
        
        # Обновляем время последнего изменения чата
        chat.updated_at = datetime.utcnow()
        db.commit()
        
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=4000)