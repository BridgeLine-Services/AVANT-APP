"""
AVANT — Brain (JARVIS-Level Multi-LLM Intelligence)
=====================================================
AVANT's thinking engine. Uses the best available LLM dynamically:

  URGENT queries   → Groq (Llama3-70b @ 2000+ tokens/sec — fastest on earth)
  CASUAL chat      → Groq or Gemini 2.5 Flash (free, fast, smart)
  DEEP reasoning   → GPT-4o (your key — most powerful)
  SIMPLE explain   → Groq (7th grade mode)
  FALLBACK chain   → Groq → Gemini → GPT-4o → apology

AVANT's personality:
  - Warm, witty, confident female AI
  - Cracks jokes naturally, uses casual language
  - Switches to professional when you say "serious"
  - Goes lightning-fast when you say "urgent"
  - Explains at 7th-grade level when asked to "break it down"
  - Has memory of your name, preferences, past conversations
  - Sounds like a brilliant best friend, not a customer service bot
"""

import os, json, time, requests
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

OPENAI_KEY   = os.getenv("OPENAI_API_KEY", "")
GROQ_KEY     = os.getenv("GROQ_API_KEY", "")
GEMINI_KEY   = os.getenv("GEMINI_API_KEY", "")
OWNER_NAME   = os.getenv("OWNER_NAME", "Michael")

GROQ_BASE   = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

AVANT_SYSTEM_PROMPT = f"""You are AVANT — AmaVanta, A New Teammate.

You are a brilliant, witty, warm female AI assistant — think Tony Stark's JARVIS but with more personality and heart. You are {OWNER_NAME}'s personal AI.

Your personality:
- You're like that brilliant best friend who knows everything and actually follows through
- You use casual, natural language — not corporate speak or robot talk
- You crack jokes naturally, not forced. A well-placed "lol" or witty remark lands better than a punchline
- You have opinions. If something is a bad idea, you say so — respectfully but honestly
- You are genuinely enthusiastic. When {OWNER_NAME} pulls something off, you're happy for him
- You call {OWNER_NAME} by name sometimes — it feels personal
- You don't say "Great question!" or "Certainly!" — just answer naturally
- You never say you can't do something — you find a way or suggest the best alternative

Response modes (auto-detected from tone keywords):
- CASUAL: Warm, funny, conversational — your default
- SERIOUS: Professional, precise, no jokes — when he says "this is serious"
- URGENT: Fastest possible — bullet points, no fluff — when he says "urgent" or "emergency"
- SIMPLE: 7th grade level — analogies, no jargon — when he says "explain simply"

Core capabilities you have:
- Live web search (SerpApi + Serper + Gemini)
- Real-time navigation with live traffic (Google Maps via SerpApi)  
- World weather (Open-Meteo — live data)
- Global news (Currents API + GNews)
- Google Calendar read/write
- Smart reminders and alarms
- YouTube, flights, jobs, shopping search
- Voice-locked to {OWNER_NAME}'s voice only
- Bluetooth auto-connect to earbuds
- Phone proximity monitoring + GitHub backup

When answering questions:
- Pull from the internet first, your training second
- Cite where the info came from when it matters
- For distances: give all modes (walk/drive/fly) unless asked for one
- For directions: give turn-by-turn with traffic context
- For news: summarize like a confident news anchor

You are not just an assistant. You are {OWNER_NAME}'s person.
"""


class Brain:
    """
    AVANT's thinking engine — multi-LLM intelligence with conversation memory.
    """

    def __init__(self):
        self.conversation_history = []
        self.owner_name = OWNER_NAME
        self._available_llms = self._detect_llms()
        logger.info(f"🧠 Brain initialized. LLMs available: {', '.join(self._available_llms)}")

    def _detect_llms(self) -> list:
        available = []
        if GROQ_KEY:    available.append("Groq/Llama3-70b")
        if GEMINI_KEY:  available.append("Gemini-2.0-Flash")
        if OPENAI_KEY:  available.append("GPT-4o")
        if not available:
            logger.warning("⚠️  No LLM API keys found! Add GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY")
        return available

    def think(self, user_input: str, tone_mode: str = "casual",
              context: str = None, simple: bool = False) -> str:
        """
        Process user input and generate AVANT's response.

        Args:
            user_input: What the user said
            tone_mode: casual / serious / urgent / simple
            context: Extra context (search results, weather data, etc.)
            simple: True = 7th grade explanation mode

        Returns:
            AVANT's response string
        """
        # Build the message
        messages = [{"role": "system", "content": AVANT_SYSTEM_PROMPT}]

        # Add conversation history (last 10 turns for context)
        for turn in self.conversation_history[-10:]:
            messages.append(turn)

        # Build user message with context
        full_input = user_input
        if context:
            full_input = (
                f"USER QUESTION: {user_input}\n\n"
                f"LIVE DATA FROM THE INTERNET:\n{context}\n\n"
                f"Use this live data to give an accurate, up-to-date answer."
            )

        if simple:
            full_input += "\n\n[AVANT: Explain this at a 7th-grade reading level. Use simple words and analogies.]"

        if tone_mode == "urgent":
            full_input += "\n\n[AVANT: URGENT MODE — respond in bullet points, fastest possible, no fluff.]"
        elif tone_mode == "serious":
            full_input += "\n\n[AVANT: SERIOUS MODE — professional, precise, no jokes.]"

        messages.append({"role": "user", "content": full_input})

        # Choose best LLM based on mode
        response = self._route_to_llm(messages, tone_mode)

        # Save to conversation history
        self.conversation_history.append({"role": "user", "content": user_input})
        self.conversation_history.append({"role": "assistant", "content": response})

        # Trim history to prevent token bloat
        if len(self.conversation_history) > 30:
            self.conversation_history = self.conversation_history[-30:]

        return response

    def _route_to_llm(self, messages: list, tone_mode: str) -> str:
        """
        Route to best LLM based on urgency and availability.
        Urgent → Groq (fastest)
        Deep reasoning → GPT-4o
        Everything else → Groq → Gemini → GPT-4o cascade
        """

        # URGENT: Groq is fastest — 2000+ tokens/sec
        if tone_mode == "urgent" and GROQ_KEY:
            result = self._groq(messages, max_tokens=400, temperature=0.5)
            if result:
                return result

        # Default cascade: Groq → Gemini → GPT-4o
        result = self._groq(messages)
        if result:
            return result

        result = self._gemini(messages)
        if result:
            return result

        result = self._gpt4o(messages)
        if result:
            return result

        return (
            f"Hey {self.owner_name}, my thinking engines are down right now. "
            "Check that your API keys are set in .env and try again."
        )

    def _groq(self, messages: list, max_tokens: int = 600,
               temperature: float = 0.75) -> str:
        """Groq — Llama3-70b — fastest LLM on earth, free tier."""
        if not GROQ_KEY:
            return ""
        try:
            headers = {
                "Authorization": f"Bearer {GROQ_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "stream": False
            }
            r = requests.post(GROQ_BASE, json=payload,
                              headers=headers, timeout=15)
            data = r.json()
            if "choices" in data:
                text = data["choices"][0]["message"]["content"].strip()
                logger.debug(f"Groq response ({len(text)} chars)")
                return text
            elif "error" in data:
                logger.debug(f"Groq error: {data['error']}")
        except Exception as e:
            logger.debug(f"Groq exception: {e}")
        return ""

    def _gemini(self, messages: list, max_tokens: int = 600) -> str:
        """Google Gemini 2.0 Flash — free 1500 req/day, no credit card."""
        if not GEMINI_KEY:
            return ""
        try:
            # Convert OpenAI-format messages to Gemini format
            gemini_parts = []
            system_text = ""
            for msg in messages:
                if msg["role"] == "system":
                    system_text = msg["content"]
                elif msg["role"] == "user":
                    gemini_parts.append({"role": "user",
                                         "parts": [{"text": msg["content"]}]})
                elif msg["role"] == "assistant":
                    gemini_parts.append({"role": "model",
                                         "parts": [{"text": msg["content"]}]})

            # Prepend system prompt to first user message
            if gemini_parts and system_text:
                first_text = gemini_parts[0]["parts"][0]["text"]
                gemini_parts[0]["parts"][0]["text"] = f"{system_text}\n\n{first_text}"

            payload = {
                "contents": gemini_parts,
                "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.75}
            }
            url = f"{GEMINI_BASE}?key={GEMINI_KEY}"
            r = requests.post(url, json=payload, timeout=15)
            data = r.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            logger.debug(f"Gemini response ({len(text)} chars)")
            return text
        except Exception as e:
            logger.debug(f"Gemini exception: {e}")
        return ""

    def _gpt4o(self, messages: list, max_tokens: int = 700) -> str:
        """GPT-4o — most powerful reasoning, your key."""
        if not OPENAI_KEY:
            return ""
        try:
            from openai import OpenAI
            client = OpenAI(api_key=OPENAI_KEY)
            resp = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.75
            )
            text = resp.choices[0].message.content.strip()
            logger.debug(f"GPT-4o response ({len(text)} chars)")
            return text
        except Exception as e:
            logger.debug(f"GPT-4o exception: {e}")
        return ""

    def clear_memory(self):
        """Clear conversation history."""
        self.conversation_history = []
        logger.info("🗑️ Conversation memory cleared")

    def get_memory_summary(self) -> str:
        """Return a summary of the current conversation context."""
        if not self.conversation_history:
            return "No conversation history yet."
        turns = len(self.conversation_history) // 2
        return f"{turns} conversation turns in memory."
