"""
APScheduler: daily korter.kz scrape at 06:00 Almaty time.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger


def start_scheduler(hour: int = 6, minute: int = 0):
    from .main import run_scrape   # late import to avoid circular

    scheduler = BackgroundScheduler(timezone="Asia/Almaty")
    scheduler.add_job(
        run_scrape,
        trigger=CronTrigger(hour=hour, minute=minute),
        id="daily_korter_scrape",
        name="Daily korter.kz scrape",
        misfire_grace_time=3600,
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started — scraping daily at {hour:02d}:{minute:02d} Almaty time")
    return scheduler
