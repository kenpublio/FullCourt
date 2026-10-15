from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "FullCourt_Defense_System_Flow_2026.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

RED = colors.HexColor("#D52B1E")
NAVY = colors.HexColor("#111827")
GOLD = colors.HexColor("#E8B648")
MUTED = colors.HexColor("#64748B")
LIGHT = colors.HexColor("#F4F6F8")
GREEN = colors.HexColor("#16845B")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverKicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=GOLD, alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=31, leading=34, textColor=colors.white, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontSize=11, leading=16, textColor=colors.HexColor("#D7DEE8"), alignment=TA_CENTER))
styles.add(ParagraphStyle(name="SectionKicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=RED, spaceAfter=4))
styles.add(ParagraphStyle(name="SectionTitle", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY, spaceAfter=8))
styles.add(ParagraphStyle(name="BodyFC", parent=styles["BodyText"], fontSize=9.4, leading=14, textColor=colors.HexColor("#334155"), spaceAfter=7))
styles.add(ParagraphStyle(name="StepTitle", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=NAVY, spaceAfter=3))
styles.add(ParagraphStyle(name="SmallFC", parent=styles["BodyText"], fontSize=8.2, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name="WhiteSmall", parent=styles["BodyText"], fontSize=8.5, leading=12, textColor=colors.white, alignment=TA_CENTER))


def header_footer(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFillColor(NAVY)
        canvas.rect(0, A4[1] - 17 * mm, A4[0], 17 * mm, fill=1, stroke=0)
        canvas.setFillColor(RED)
        canvas.circle(17 * mm, A4[1] - 8.5 * mm, 3.3 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 11)
        canvas.drawString(24 * mm, A4[1] - 11 * mm, "FULLCOURT")
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(A4[0] - 16 * mm, 10 * mm, f"Defense system flow  |  Page {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=16 * mm,
    rightMargin=16 * mm,
    topMargin=24 * mm,
    bottomMargin=16 * mm,
    title="FullCourt Defense System Flow 2026",
    author="FullCourt Basketball Management",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="content")
doc.addPageTemplates([PageTemplate(id="flow", frames=[frame], onPage=header_footer)])


def step(number, title, copy, accent=RED):
    badge = Table([[Paragraph(f"<b>{number}</b>", ParagraphStyle(name=f"Badge{number}{title}", parent=styles["BodyFC"], textColor=colors.white, alignment=TA_CENTER))]], colWidths=[9 * mm], rowHeights=[9 * mm])
    badge.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), accent), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOX", (0, 0), (-1, -1), 0, accent)]))
    text = [Paragraph(title, styles["StepTitle"]), Paragraph(copy, styles["BodyFC"])]
    card = Table([[badge, text]], colWidths=[13 * mm, doc.width - 13 * mm], hAlign="LEFT")
    card.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LIGHT), ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9E0E8")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return KeepTogether([card, Spacer(1, 4 * mm)])


story = []
cover = Table([
    [Paragraph("KADAYO STAKEHOLDER-ALIGNED BASKETBALL OPERATIONS", styles["CoverKicker"])],
    [Paragraph("FULLCOURT<br/>COMPLETE SYSTEM FLOW", styles["CoverTitle"])],
    [Paragraph("Administrator  |  Coach  |  Staff Admin  |  Public Game Center", styles["CoverSub"])],
    [Spacer(1, 18 * mm)],
    [Paragraph("Players are roster records managed by Coaches. They do not need individual accounts.", styles["WhiteSmall"])],
], colWidths=[doc.width], rowHeights=[18 * mm, 38 * mm, 16 * mm, 32 * mm, 18 * mm])
cover.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), NAVY), ("BOX", (0, 0), (-1, -1), 0, NAVY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 16 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 16 * mm)]))
story.extend([Spacer(1, 24 * mm), cover, Spacer(1, 10 * mm)])
pill = Table([["3 authenticated roles", "15-player roster cap", "Public scores & schedule"]], colWidths=[doc.width / 3] * 3)
pill.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), RED), ("TEXTCOLOR", (0, 0), (-1, -1), colors.white), ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8), ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
story.append(pill)
story.append(Spacer(1, 30 * mm))
story.append(Paragraph("Prepared for system defense and November game-day operations", styles["CoverKicker"]))

story.extend([PageBreak(), Paragraph("01 / PRE-TOURNAMENT", styles["SectionKicker"]), Paragraph("From setup to a publishable schedule", styles["SectionTitle"]), Paragraph("The Administrator controls competition structure. The Coach owns roster data. FullCourt blocks unsafe schedules before publication.", styles["BodyFC"])])
story.extend([
    step("1", "Administrator creates the tournament", "Set tournament details, divisions, dates, roster deadline, rules, and the playable venue with its Main Court."),
    step("2", "Teams and Coaches are connected", "Administrator manages team oversight. Each team is associated with the Coach who owns its roster actions."),
    step("3", "Coach completes the 15-player roster", "Add player records without creating player accounts. Record birth date, guardian, jersey, and position; then upload PSA/Birth Certificate and Parent Permit.", GREEN),
    step("4", "Administrator reviews eligibility", "Review protected files and the birth-date match. Approve or reject with remarks; roster fields remain Coach-owned."),
    step("5", "Bracket and schedule are generated", "Schedule Optimization checks court overlap, team overlap, venue availability, team rest, and daily game limits."),
    step("6", "Administrator publishes", "Publication makes games visible in Game Center and notifies affected Coaches. Conflicts must be zero before publishing."),
])

story.extend([Paragraph("02 / GAME DAY", styles["SectionKicker"]), Paragraph("From assignment to official result", styles["SectionTitle"]), Paragraph("Staff Admin records the game. Administrator confirms the result. Coaches receive operational changes and the official score.", styles["BodyFC"])])
story.extend([
    step("1", "Staff Admin accepts the assignment", "Only assigned and accepted games open in the protected scoring workspace."),
    step("2", "Lineups are confirmed", "Eligible and present roster players are selected before individual scoring events are recorded."),
    step("3", "Live score and player points are recorded", "Use +1, +2, and +3 actions. Rebounds, assists, steals, blocks, turnovers, and fouls remain optional. Event UUIDs and Undo protect against duplicate or incorrect taps.", GREEN),
    step("4", "Staff Admin submits the final", "The score is reviewed, the clock stops, and scoring locks in awaiting-confirmation state."),
    step("5", "Administrator confirms", "FullCourt rejects ties, wrong winners, and stale score snapshots. A valid confirmation publishes the result, recomputes standings, and advances the bracket."),
    step("6", "Coaches and public views update", "Both Coaches receive the official-result alert. Game Center, bracket, standings, reports, and share cards use the official score."),
])

story.extend([Paragraph("03 / RESPONSIBILITY MATRIX", styles["SectionKicker"]), Paragraph("One owner for every critical action", styles["SectionTitle"])])
matrix = [
    ["AREA", "ADMINISTRATOR", "COACH", "STAFF ADMIN", "PUBLIC / PLAYER"],
    ["Tournament", "Create and manage", "View", "Assigned games", "Published view"],
    ["Team / roster", "Oversight", "Manage up to 15", "Lineup use only", "No account"],
    ["Documents", "Review / decide", "Upload / correct", "No access", "No access"],
    ["Schedule", "Generate / change", "View / acknowledge", "View assignment", "Published view"],
    ["Live scoring", "Monitor / approve", "View", "Record score / stats", "Live view"],
    ["Backup / audit", "Manage / review", "No system backup", "No system backup", "No access"],
]
table = Table(matrix, colWidths=[30 * mm, 38 * mm, 34 * mm, 38 * mm, 38 * mm], repeatRows=1)
table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, 0), 7.2), ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 1), (-1, -1), 7.3), ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#334155")), ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#CBD5E1")), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
story.extend([table, Spacer(1, 8 * mm), Paragraph("Notification checkpoints", styles["StepTitle"]), Paragraph("Schedule publication; time, venue, or court changes; 30-minute reminders; eligibility status; and official final result. Schedule-change notices are tracked for Coach acknowledgment.", styles["BodyFC"]), Paragraph("Privacy boundary", styles["StepTitle"]), Paragraph("PSA/Birth Certificate, Parent Permit, exact birth dates, guardian contacts, receipts, and internal audit details never appear on public pages.", styles["BodyFC"])])

story.extend([Spacer(1, 28 * mm), Paragraph("04 / RECOVERY & READINESS", styles["SectionKicker"]), Paragraph("Game-day safety when technology fails", styles["SectionTitle"])])
story.extend([
    step("1", "Run the readiness checker", "Verify public pages, API health, all three demo roles, a recent verified backup, and critical API routes."),
    step("2", "Keep a signed paper score sheet", "When connectivity fails, stop tapping. Record the last confirmed event, period, clock, and totals on paper."),
    step("3", "Reconnect before resuming", "Reload the assigned game and compare the scoreboard with the paper sheet. Use authorized corrections and retain the audit reason."),
    step("4", "Use the prepared XAMPP fallback", "If the main server fails, start the local fallback and follow the database administrator restore procedure using the latest verified backup."),
    step("5", "Close the day safely", "Export schedules, scores, standings, eligibility, and payments; create a new backup; and copy it to two separate storage locations."),
])
notice = Table([[Paragraph("GAME-DAY RULE", styles["CoverKicker"]), Paragraph("The paper score sheet is the temporary source of truth during an outage. FullCourt becomes authoritative again only after Admin reconciles and confirms the restored record.", styles["WhiteSmall"])]], colWidths=[34 * mm, doc.width - 34 * mm])
notice.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), NAVY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
story.append(notice)

doc.build(story)
print(OUTPUT)
