#!/bin/bash
# ============================================================
# AVANT — AmaVanta Setup Script
# Run this once to set up your environment
# ============================================================

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          AVANT — AmaVanta: A New Teammate                ║"
echo "║             Setting up your environment...               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Create required directories
echo "📁 Creating directories..."
mkdir -p data logs voices

# Copy .env template if not already there
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "📋 Created .env from template — FILL IN YOUR API KEYS!"
else
    echo "✅ .env already exists"
fi

# Install Python dependencies
echo ""
echo "📦 Installing Python dependencies..."
echo "  This may take a few minutes..."
pip install -r requirements.txt

# Download spaCy English model
echo ""
echo "🧠 Downloading spaCy language model..."
python -m spacy download en_core_web_sm 2>/dev/null || echo "  spaCy model download skipped"

# Download NLTK data
echo ""
echo "📚 Downloading NLTK data..."
python -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('stopwords', quiet=True)" 2>/dev/null || echo "  NLTK download skipped"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                       ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  NEXT STEPS:                                             ║"
echo "║                                                          ║"
echo "║  1. Edit .env and add your API keys:                     ║"
echo "║     • OPENAI_API_KEY (required — brain + search)         ║"
echo "║     • ELEVENLABS_API_KEY (required — AVANT's voice)      ║"
echo "║     • PICOVOICE_ACCESS_KEY (required — wake word)        ║"
echo "║     • GOOGLE_MAPS_API_KEY (for navigation)               ║"
echo "║     • OPENWEATHER_API_KEY (for weather)                  ║"
echo "║     • NEWSAPI_KEY (for world news)                       ║"
echo "║     • PERPLEXITY_API_KEY (for deep web search)           ║"
echo "║                                                          ║"
echo "║  2. Set your name in .env:                               ║"
echo "║     OWNER_NAME=Michael                                   ║"
echo "║                                                          ║"
echo "║  3. Enroll your voice (one-time):                        ║"
echo "║     python avant.py --enroll                             ║"
echo "║                                                          ║"
echo "║  4. Launch AVANT:                                        ║"
echo "║     python avant.py                                      ║"
echo "║                                                          ║"
echo "║  5. Say AVANT to wake her up!                            ║"
echo "║                                                          ║"
echo "║  TEST WITHOUT MIC:                                       ║"
echo "║     python avant.py --text                               ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
