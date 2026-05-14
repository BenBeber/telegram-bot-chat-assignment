import os
from dotenv import load_dotenv

load_dotenv()

API_TOKEN: str = os.environ["TELEGRAM_BOT_TOKEN"]
