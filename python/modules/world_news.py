"""
AVANT — World News & Events Module
=====================================
Pulls live news from around the world — by region, topic, or category.
Uses NewsAPI + Perplexity for real-time coverage.
AVANT reads news headlines and summaries aloud, like a personal news anchor.
"""

import os
import requests
from datetime import datetime
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

NEWSAPI_KEY = os.getenv("NEWSAPI_KEY")
NEWSAPI_BASE = "https://newsapi.org/v2"

# Map of regions/countries to their codes
COUNTRY_MAP = {
    "us": "us", "usa": "us", "america": "us", "united states": "us",
    "uk": "gb", "britain": "gb", "england": "gb",
    "ghana": "gh", "nigeria": "ng", "kenya": "ke", "south africa": "za",
    "canada": "ca", "australia": "au", "india": "in", "china": "cn",
    "france": "fr", "germany": "de", "brazil": "br", "mexico": "mx",
    "japan": "jp", "russia": "ru", "italy": "it", "spain": "es",
    "dubai": "ae", "uae": "ae", "egypt": "eg", "israel": "il"
}


class WorldNews:
    """
    Live world news fetcher and reader.
    Covers: breaking news, regional news, topic-based news, global events.
    """

    def __init__(self):
        self.api_key = NEWSAPI_KEY
        if self.api_key:
            logger.info("✅ World News service ready (NewsAPI)")
        else:
            logger.warning("⚠️  NEWSAPI_KEY not set — news will use web search")

    def get_top_headlines(self, region: str = "us", count: int = 5) -> str:
        """
        Get top news headlines for a region.
        
        Args:
            region: Country name or code ("Ghana", "US", "UK", etc.)
            count: Number of headlines to return
            
        Returns:
            Natural language news briefing
        """
        country_code = COUNTRY_MAP.get(region.lower(), "us")

        if self.api_key:
            return self._fetch_headlines_api(country_code, region, count)
        else:
            return self._fetch_via_search(f"top news headlines in {region} today")

    def search_news(self, query: str, count: int = 5) -> str:
        """
        Search for news about a specific topic.
        
        Args:
            query: Topic to search (e.g. "AI", "climate change", "Premier League")
            count: Number of articles to return
        """
        if self.api_key:
            return self._search_articles_api(query, count)
        else:
            return self._fetch_via_search(f"latest news about {query} today 2026")

    def get_world_briefing(self) -> str:
        """
        Get a comprehensive world news briefing covering multiple regions.
        Good for morning briefings or "what's happening in the world" queries.
        """
        if self.api_key:
            return self._get_everything(
                query="world news breaking",
                count=6
            )
        else:
            return self._fetch_via_search(
                "major world news today 2026 breaking stories"
            )

    def get_regional_news(self, region: str) -> str:
        """
        Get detailed news from a specific region of the world.
        Handles regions beyond what NewsAPI supports (e.g. West Africa)
        by falling back to search.
        """
        # Check if we have a country code for this region
        country_code = COUNTRY_MAP.get(region.lower())

        if country_code and self.api_key:
            return self._fetch_headlines_api(country_code, region, 5)
        else:
            # Use web search for broader regions or unsupported countries
            return self._fetch_via_search(
                f"latest news from {region} today 2026 current events"
            )

    def _fetch_headlines_api(self, country_code: str, region_name: str, count: int) -> str:
        """Fetch top headlines via NewsAPI."""
        try:
            response = requests.get(
                f"{NEWSAPI_BASE}/top-headlines",
                params={
                    "country": country_code,
                    "pageSize": min(count, 10),
                    "apiKey": self.api_key
                },
                timeout=10
            )
            response.raise_for_status()
            data = response.json()

            articles = data.get("articles", [])
            if not articles:
                return self._fetch_via_search(f"top news {region_name} today")

            return self._format_headlines(region_name, articles, count)

        except Exception as e:
            logger.error(f"NewsAPI headline fetch error: {e}")
            return self._fetch_via_search(f"latest news {region_name} today")

    def _search_articles_api(self, query: str, count: int) -> str:
        """Search news articles via NewsAPI."""
        try:
            response = requests.get(
                f"{NEWSAPI_BASE}/everything",
                params={
                    "q": query,
                    "sortBy": "publishedAt",
                    "pageSize": min(count, 10),
                    "language": "en",
                    "apiKey": self.api_key
                },
                timeout=10
            )
            response.raise_for_status()
            data = response.json()

            articles = data.get("articles", [])
            if not articles:
                return self._fetch_via_search(f"latest news about {query}")

            return self._format_headlines(f"'{query}'", articles, count)

        except Exception as e:
            logger.error(f"NewsAPI search error: {e}")
            return self._fetch_via_search(f"latest news {query}")

    def _get_everything(self, query: str, count: int) -> str:
        """Get general news articles."""
        try:
            response = requests.get(
                f"{NEWSAPI_BASE}/everything",
                params={
                    "q": query,
                    "sortBy": "publishedAt",
                    "pageSize": count,
                    "language": "en",
                    "apiKey": self.api_key
                },
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            articles = data.get("articles", [])
            return self._format_headlines("the world", articles, count)
        except Exception as e:
            logger.error(f"NewsAPI everything error: {e}")
            return self._fetch_via_search("major world news breaking today")

    def _format_headlines(self, region: str, articles: list, count: int) -> str:
        """Format news articles into a natural spoken briefing."""
        if not articles:
            return f"Couldn't pull any news for {region} right now. Try again in a moment."

        now = datetime.now().strftime("%B %d, %Y")
        parts = [f"Here's what's happening in {region} as of {now}:"]

        for i, article in enumerate(articles[:count]):
            title = article.get("title", "")
            description = article.get("description", "")
            source = article.get("source", {}).get("name", "")

            if not title or title == "[Removed]":
                continue

            # Build story summary
            story = title
            if description and len(description) < 200:
                story += f" — {description}"
            if source:
                story += f" (via {source})"

            parts.append(f"Story {i+1}: {story}")

        if len(parts) == 1:
            return f"The news feeds for {region} are quiet right now. Want me to search for something specific?"

        return ". ".join(parts) + "."

    def _fetch_via_search(self, query: str) -> str:
        """Fallback: use Perplexity/OpenAI search for news."""
        try:
            from .search_engine import SearchEngine
            search = SearchEngine()
            return search.search(query, detail_level="normal")
        except Exception as e:
            logger.error(f"News search fallback failed: {e}")
            return "I'm having trouble reaching the news feeds right now. Give me a second and try again."
