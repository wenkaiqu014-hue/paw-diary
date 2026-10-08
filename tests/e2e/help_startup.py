"""Dismiss only the startup notice/tour using their real UI, preserving data."""
from playwright.sync_api import expect

def dismiss_startup_help(page):
 notice=page.locator('#whats-new-dialog')
 if notice.count() and notice.is_visible():
  notice.locator('[data-whats-new-confirm]').click()
  tour=page.locator('dialog[data-guided-tour]')
  try:
   expect(tour).to_be_visible(timeout=1800)
  except AssertionError:
   return
  tour.locator('[data-tour-skip]').click()
 elif page.locator('dialog[data-guided-tour]').count() and page.locator('dialog[data-guided-tour]').is_visible():
  page.locator('[data-tour-skip]').click()
