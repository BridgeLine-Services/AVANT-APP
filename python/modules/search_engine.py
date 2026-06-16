"""
AVANT — Search Engine (JARVIS-Level Intelligence)
===================================================
Uses a waterfall of free APIs — most powerful to fastest:

Priority order:
  1. SerpApi  — Google Search, Maps, News, YouTube, Flights, Jobs, Shopping
  2. Serper   — 2,500 free Google searches/month (backup)
  3. Gemini   — Google AI search-grounded answers (free)
  4. Groq     — Ultra-fast Llama3 for quick factual answers (free)
  5. GPT-4o   — Deep reasoning fallback (your key)

Every query pulls from multiple sources and synthesizes the best answer.
This is exactly how JARVIS worked — triangulate from all available data.
"""

import os, json, re, time, requests
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

SERPAPI_KEY   = os.getenv("SERPAPI_KEY", "")
SERPER_KEY    = os.getenv("SERPER_API_KEY", "")
GEMINI_KEY    = os.getenv("GEMINI_API_KEY", "")
GROQ_KEY      = os.getenv("GROQ_API_KEY", "")
OPENAI_KEY    = os.getenv("OPENAI_API_KEY", "")
CURRENTS_KEY  = os.getenv("CURRENTS_API_KEY", "")
GNEWS_KEY     = os.getenv("GNEWS_API_KEY", "")

SERPAPI_BASE  = "https://serpapi.com/search"
SERPER_BASE   = "https://google.serper.dev/search"
GEMINI_BASE   = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
GROQ_BASE     = "https://api.groq.com/openai/v1/chat/completions"


class SearchEngine:
    """
    AVANT's internet brain — pulls live information from all corners of the web.
    Like JARVIS scanning every database simultaneously.
    """

    def __init__(self):
        self._check_keys()

    def _check_keys(self):
        available = []
        if SERPAPI_KEY:  available.append("SerpApi ✅")
        if SERPER_KEY:   available.append("Serper ✅")
        if GEMINI_KEY:   available.append("Gemini ✅")
        if GROQ_KEY:     available.append("Groq ✅")
        if OPENAI_KEY:   available.append("GPT-4o ✅")
        if not available:
            available.append("⚠️  No search keys — add SERPAPI_KEY or SERPER_API_KEY to .env")
        logger.info(f"Search engines: {', '.join(available)}")

    # ═══════════════════════════════════════════════════════
    # PRIMARY: General Web Search
    # ═══════════════════════════════════════════════════════

    def search(self, query: str, simple: bool = False) -> str:
        """
        Main search — pulls from all available engines and synthesizes.
        simple=True → 7th grade explanation mode
        """
        results = []

        # Try SerpApi first (most powerful — Google full results)
        serp = self._serpapi_search(query)
        if serp:
            results.append(serp)

        # Also try Serper (different index, often catches different things)
        if SERPER_KEY and len(results) == 0:
            ser = self._serper_search(query)
            if ser:
                results.append(ser)

        # Synthesize with best available LLM
        if results:
            raw = "\n\n".join(results)
            return self._synthesize(query, raw, simple=simple)

        # Fallback: direct LLM knowledge
        return self._llm_direct(query, simple=simple)

    def search_news(self, topic: str, country: str = None) -> str:
        """Live news from around the world on any topic."""
        results = []

        # SerpApi Google News
        if SERPAPI_KEY:
            try:
                params = {
                    "engine": "google_news",
                    "q": topic,
                    "api_key": SERPAPI_KEY,
                    "num": 10
                }
                if country:
                    params["gl"] = country[:2].lower()
                r = requests.get(SERPAPI_BASE, params=params, timeout=10)
                data = r.json()
                articles = data.get("news_results", [])
                if articles:
                    news_text = []
                    for a in articles[:8]:
                        title = a.get("title", "")
                        source = a.get("source", {}).get("name", "")
                        date = a.get("date", "")
                        snippet = a.get("snippet", "")
                        news_text.append(f"• [{source}] {title} ({date})\n  {snippet}")
                    results.append("\n".join(news_text))
                    logger.debug(f"SerpApi news: {len(articles)} articles")
            except Exception as e:
                logger.debug(f"SerpApi news error: {e}")

        # Currents API (120k sources, 70 countries)
        if CURRENTS_KEY and len(results) < 2:
            try:
                params = {"apiKey": CURRENTS_KEY, "keywords": topic, "language": "en"}
                if country:
                    params["country"] = country
                r = requests.get("https://api.currentsapi.services/v1/search",
                                 params=params, timeout=10)
                data = r.json()
                news = data.get("news", [])[:5]
                if news:
                    items = [f"• [{a.get('author','Unknown')}] {a.get('title','')} — {a.get('description','')[:100]}"
                             for a in news]
                    results.append("\n".join(items))
            except Exception as e:
                logger.debug(f"Currents API error: {e}")

        # GNews fallback
        if GNEWS_KEY and len(results) == 0:
            try:
                params = {"q": topic, "token": GNEWS_KEY, "lang": "en", "max": 10}
                if country:
                    params["country"] = country[:2].lower()
                r = requests.get("https://gnews.io/api/v4/search", params=params, timeout=10)
                data = r.json()
                articles = data.get("articles", [])[:8]
                if articles:
                    items = [f"• {a['source']['name']}: {a['title']}" for a in articles]
                    results.append("\n".join(items))
            except Exception as e:
                logger.debug(f"GNews error: {e}")

        if not results:
            return self._llm_direct(f"What is happening in the news about {topic}?")

        raw = "\n\n".join(results)
        prompt = (
            f"You are AVANT, a brilliant AI assistant. Read these live news results about '{topic}' "
            f"and give a sharp, engaging summary like a news anchor — confident, clear, conversational. "
            f"Group by theme if needed. Max 4 bullet points.\n\nNEWS DATA:\n{raw}"
        )
        return self._llm_synthesize(prompt)

    def search_youtube(self, query: str) -> str:
        """Search YouTube for videos on a topic."""
        if not SERPAPI_KEY:
            return f"Search YouTube for '{query}' — I'd love to pull that up but I need a SerpApi key."
        try:
            params = {"engine": "youtube", "search_query": query, "api_key": SERPAPI_KEY}
            r = requests.get(SERPAPI_BASE, params=params, timeout=10)
            data = r.json()
            videos = data.get("video_results", [])[:5]
            if videos:
                items = [f"• {v.get('title','')} by {v.get('channel',{}).get('name','')} — {v.get('link','')}"
                         for v in videos]
                return "Here are the top YouTube results:\n" + "\n".join(items)
        except Exception as e:
            logger.debug(f"YouTube search error: {e}")
        return f"Couldn't pull YouTube results for '{query}' right now."

    def search_jobs(self, query: str, location: str = None) -> str:
        """Search for job listings."""
        if not SERPAPI_KEY:
            return "I need a SerpApi key to search jobs."
        try:
            q = f"{query} jobs"
            if location:
                q += f" in {location}"
            params = {"engine": "google_jobs", "q": q, "api_key": SERPAPI_KEY}
            r = requests.get(SERPAPI_BASE, params=params, timeout=10)
            data = r.json()
            jobs = data.get("jobs_results", [])[:5]
            if jobs:
                items = [f"• {j.get('title','')} at {j.get('company_name','')} — {j.get('location','')}"
                         for j in jobs]
                return "Here are the latest job listings:\n" + "\n".join(items)
        except Exception as e:
            logger.debug(f"Jobs search error: {e}")
        return f"Couldn't find jobs for '{query}' right now."

    def search_flights(self, origin: str, destination: str, date: str = None) -> str:
        """Search for flights between two cities."""
        if not SERPAPI_KEY:
            return "I need a SerpApi key to search flights."
        try:
            params = {
                "engine": "google_flights",
                "departure_id": origin,
                "arrival_id": destination,
                "api_key": SERPAPI_KEY,
                "currency": "USD",
                "hl": "en"
            }
            if date:
                params["outbound_date"] = date
            r = requests.get(SERPAPI_BASE, params=params, timeout=15)
            data = r.json()
            flights = data.get("best_flights", data.get("other_flights", []))[:4]
            if flights:
                items = []
                for f in flights:
                    legs = f.get("flights", [{}])
                    airline = legs[0].get("airline", "Unknown") if legs else "Unknown"
                    price = f.get("price", "N/A")
                    duration = f.get("total_duration", "N/A")
                    items.append(f"• {airline} — ${price} — {duration} min")
                return f"Flights from {origin} to {destination}:\n" + "\n".join(items)
        except Exception as e:
            logger.debug(f"Flights search error: {e}")
        return f"Couldn't find flights from {origin} to {destination} right now."

    def search_shopping(self, query: str) -> str:
        """Search for products and prices."""
        if not SERPAPI_KEY:
            return "I need a SerpApi key to search shopping."
        try:
            params = {"engine": "google_shopping", "q": query, "api_key": SERPAPI_KEY, "num": 6}
            r = requests.get(SERPAPI_BASE, params=params, timeout=10)
            data = r.json()
            items_raw = data.get("shopping_results", [])[:6]
            if items_raw:
                items = [f"• {p.get('title','')} — {p.get('price','N/A')} ({p.get('source','')})"
                         for p in items_raw]
                return f"Here's what I found for '{query}':\n" + "\n".join(items)
        except Exception as e:
            logger.debug(f"Shopping search error: {e}")
        return f"Couldn't pull shopping results for '{query}'."

    def search_knowledge(self, query: str) -> str:
        """Pull structured knowledge panel info (Wikipedia-level facts)."""
        if SERPAPI_KEY:
            try:
                params = {"engine": "google", "q": query, "api_key": SERPAPI_KEY}
                r = requests.get(SERPAPI_BASE, params=params, timeout=10)
                data = r.json()
                kg = data.get("knowledge_graph", {})
                answer_box = data.get("answer_box", {})
                if answer_box.get("answer"):
                    return answer_box["answer"]
                if answer_box.get("snippet"):
                    return answer_box["snippet"]
                if kg.get("description"):
                    return kg["description"]
            except Exception as e:
                logger.debug(f"Knowledge search error: {e}")
        return self._llm_direct(query)

    # ═══════════════════════════════════════════════════════
    # INTERNAL: SerpApi
    # ═══════════════════════════════════════════════════════

    def _serpapi_search(self, query: str) -> str:
        if not SERPAPI_KEY:
            return ""
        try:
            params = {
                "engine": "google",
                "q": query,
                "api_key": SERPAPI_KEY,
                "num": 10,
                "hl": "en"
            }
            r = requests.get(SERPAPI_BASE, params=params, timeout=10)
            data = r.json()

            chunks = []

            # Answer box (instant answer)
            ab = data.get("answer_box", {})
            if ab.get("answer"):
                chunks.append(f"DIRECT ANSWER: {ab['answer']}")
            elif ab.get("snippet"):
                chunks.append(f"DIRECT ANSWER: {ab['snippet']}")

            # Knowledge graph
            kg = data.get("knowledge_graph", {})
            if kg.get("description"):
                chunks.append(f"KNOWLEDGE: {kg['description']}")

            # Organic results
            organic = data.get("organic_results", [])[:6]
            for res in organic:
                title = res.get("title", "")
                snippet = res.get("snippet", "")
                if snippet:
                    chunks.append(f"[{title}]: {snippet}")

            # Related questions
            paas = data.get("related_questions", [])[:3]
            for q in paas:
                if q.get("answer"):
                    chunks.append(f"Q: {q.get('question','')} A: {q.get('answer','')}")

            return "\n".join(chunks) if chunks else ""
        except Exception as e:
            logger.debug(f"SerpApi error: {e}")
            return ""

    def _serper_search(self, query: str) -> str:
        if not SERPER_KEY:
            return ""
        try:
            headers = {"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"}
            payload = {"q": query, "num": 10}
            r = requests.post(SERPER_BASE, json=payload, headers=headers, timeout=10)
            data = r.json()
            chunks = []
            if data.get("answerBox", {}).get("answer"):
                chunks.append(f"DIRECT: {data['answerBox']['answer']}")
            for res in data.get("organic", [])[:6]:
                if res.get("snippet"):
                    chunks.append(f"[{res.get('title','')}]: {res['snippet']}")
            return "\n".join(chunks) if chunks else ""
        except Exception as e:
            logger.debug(f"Serper error: {e}")
            return ""

    # ═══════════════════════════════════════════════════════
    # INTERNAL: LLM Synthesis
    # ═══════════════════════════════════════════════════════

    def _synthesize(self, query: str, raw_data: str, simple: bool = False) -> str:
        grade_note = (
            "Explain at a 7th-grade reading level — clear, simple, no jargon. "
            "Use analogies a 12-year-old would understand. " if simple else ""
        )
        prompt = (
            f"You are AVANT, a brilliant female AI assistant like Tony Stark's JARVIS. "
            f"Based on this live web data, answer the question: '{query}'\n\n"
            f"{grade_note}"
            f"Be conversational, confident, and accurate. Cite sources if helpful. "
            f"Max 3-4 sentences unless more is genuinely needed.\n\n"
            f"LIVE DATA:\n{raw_data[:4000]}"
        )
        return self._llm_synthesize(prompt)

    def _llm_direct(self, query: str, simple: bool = False) -> str:
        grade_note = "Explain at a 7th-grade level. " if simple else ""
        prompt = (
            f"You are AVANT, a brilliant female AI assistant. "
            f"Answer this question accurately and conversationally: {query}\n"
            f"{grade_note}Be concise but complete."
        )
        return self._llm_synthesize(prompt)

    def _llm_synthesize(self, prompt: str) -> str:
        """Try LLMs in order: Groq (fastest) → Gemini → GPT-4o."""

        # 1. Groq — fastest (2000 tokens/sec, free)
        if GROQ_KEY:
            try:
                headers = {"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"}
                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 600,
                    "temperature": 0.7
                }
                r = requests.post(GROQ_BASE, json=payload, headers=headers, timeout=15)
                result = r.json()
                text = result["choices"][0]["message"]["content"].strip()
                if text:
                    logger.debug("Response via Groq (Llama3-70b)")
                    return text
            except Exception as e:
                logger.debug(f"Groq error: {e}")

        # 2. Gemini 2.0 Flash (free, 1500 req/day)
        if GEMINI_KEY:
            try:
                url = f"{GEMINI_BASE}?key={GEMINI_KEY}"
                payload = {"contents": [{"parts": [{"text": prompt}]}]}
                r = requests.post(url, json=payload, timeout=15)
                data = r.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                if text:
                    logger.debug("Response via Gemini 2.0 Flash")
                    return text
            except Exception as e:
                logger.debug(f"Gemini error: {e}")

        # 3. GPT-4o fallback
        if OPENAI_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=OPENAI_KEY)
                resp = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=600
                )
                text = resp.choices[0].message.content.strip()
                logger.debug("Response via GPT-4o")
                return text
            except Exception as e:
                logger.debug(f"GPT-4o error: {e}")

        return "I couldn't get a live answer right now — my search connections seem to be down. Try again in a moment."
