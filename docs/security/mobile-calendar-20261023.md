# [F008][S005] Mobile calendar release

UI-only change: month fits seven columns; compact chips and complete selected-date agenda; sticky opaque left time gutter and header corner; phone event detail sheet. No API, permissions, database, payment, check-in or WhatsApp changes.

Five isolated browser tests passed: 320/375/430px phones verify no page/month horizontal overflow, all seven appointments accessible through month agenda, full detail sheet, and fixed time/header x-coordinates after scrolling to the right. Desktop/calendar/payment regressions passed. Production build and full/runtime dependency gates passed.
