Local AI Assistant

> Локальная AI-система на базе **Any AI + Ollama** с интеграцией в **VS Code**, возможностью работы через API и собственным веб-интерфейсом.

---

# 1. Introduction

Qwen Local AI Assistant — учебный проект по дисциплине, связанной с искусственным интеллектом.  
Основная цель проекта — показать, как современную языковую модель можно развернуть локально на персональном компьютере и использовать для разработки, автоматизации и генерации контента.

В проекте используется модель **Qwen**, запускаемая через **Ollama** на localhost.

Система поддерживает следующие возможности:

- локальный запуск модели без облачных сервисов;
- работа через REST API;
- подключение к VS Code;
- генерация и редактирование файлов;
- создание собственного AI-чата;
- обработка запросов пользователя в реальном времени;
- приватная работа без передачи данных третьим лицам;
- возможность дальнейшего расширения проекта.

---

# 2. How It Works

Архитектура проекта состоит из нескольких компонентов:


    Пользователь

    ↓
   
    VS Code / Web Interface

    ↓
   
    Local Backend API

    ↓
   
    Ollama

    ↓
   
    Qwen Model

Принцип работы:
Пользователь отправляет запрос через VS Code или веб-интерфейс.
Backend-сервер принимает запрос.
Запрос пересылается в Ollama API.
Ollama обрабатывает его через модель Qwen.
Ответ возвращается пользователю.

# 3. Building
Clone Repository
```
git clone https://github.com/yourusername/qwen-local-ai.git
cd qwen-local-ai
Install Ollama
```

Скачать и установить:

https://ollama.com

Проверка:
```
ollama --version
Download Model
ollama pull qwen
```

или версия для программирования:

```
ollama pull qwen2.5-coder
Run Model
ollama run qwen
```

После запуска API доступен:

http://localhost:11434
Install Backend Dependencies
```
pip install -r requirements.txt
```
или

```npm install```

# 4. Usage
API Example
```
curl http://localhost:11434/api/generate -d '{
  "model": "qwen",
  "prompt": "Напиши калькулятор на Python"
}'
Python Example
import requests

response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": "qwen",
        "prompt": "Создай HTML страницу портфолио"
    }
)

print(response.text)
```
VS Code Integration

Можно использовать через:

Continue Extension
CodeGPT
Continue.dev
Собственный Python Script

# 5. Features
Implemented
запуск Qwen локально;
работа через Ollama API;
интеграция с VS Code;
генерация кода;
редактирование файлов;
веб-интерфейс чата.
Planned
доступ во внешнюю сеть;
сохранение истории чатов;
голосовой ввод;
Telegram bot;
Docker deployment;
поддержка нескольких моделей.

# 6. Developing with Project

Проект можно расширять следующими направлениями:

создание собственного VS Code Extension;
добавление файлового менеджера;
запуск нескольких AI агентов;
интеграция с GitHub;
локальный аналог ChatGPT;
AI помощник для программирования.

# 7. Questions and Discussion

Если у вас есть вопросы по проекту:

создайте Issue на GitHub;
предложите Pull Request;
используйте проект в учебных целях.
# 8. Disclaimer

Проект создан исключительно в образовательных целях.

Используется для:

- локального запуска LLM моделей;

- REST API;

- интеграции ИИ в среды разработки;

- создания AI-интерфейсов.

Мы не несём ответственности за неправильное использование проекта.
