from pathlib import Path
from PIL import Image
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT = Path(r"C:\Pictures\CAPSTONE 2")
SCREENS = ROOT / "tmp" / "pdfs" / "screens"
OUT = ROOT / "output" / "pdf" / "FullCourt_System_Flow_Guide.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

PAGE = landscape(A4)
W, H = PAGE
M = 42
BLACK = (0, 0, 0)
LIGHT = (0.93, 0.93, 0.93)
MID = (0.35, 0.35, 0.35)


def wrap(c, text, x, y, width, font="Helvetica", size=10, leading=14):
    c.setFont(font, size)
    c.setFillColorRGB(*BLACK)
    words = text.split()
    line = ""
    for word in words:
        trial = f"{line} {word}".strip()
        if c.stringWidth(trial, font, size) <= width:
            line = trial
        else:
            c.drawString(x, y, line)
            y -= leading
            line = word
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def header(c, section, title, subtitle=""):
    c.setFillColorRGB(*BLACK)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(M, H - 31, section.upper())
    c.setFont("Helvetica-Bold", 24)
    c.drawString(M, H - 62, title)
    if subtitle:
        wrap(c, subtitle, M, H - 82, W - 2 * M, size=9, leading=12)
    c.setStrokeColorRGB(*BLACK)
    c.setLineWidth(0.8)
    c.line(M, H - 94, W - M, H - 94)


def footer(c, page_no):
    c.setFillColorRGB(*BLACK)
    c.setFont("Helvetica", 7)
    c.drawString(M, 20, "FullCourt system flow guide · November 7, 2026")
    c.drawRightString(W - M, 20, str(page_no))


def image_fit(c, filename, x, y, w, h, border=True):
    path = SCREENS / filename
    if not path.exists():
        c.rect(x, y, w, h)
        c.drawCentredString(x + w / 2, y + h / 2, f"Missing screenshot: {filename}")
        return
    with Image.open(path) as im:
        iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
    c.drawImage(ImageReader(str(path)), dx, dy, dw, dh, preserveAspectRatio=True, mask="auto")
    if border:
        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.rect(dx, dy, dw, dh, stroke=1, fill=0)


def bullets(c, items, x, y, width, size=10):
    for item in items:
        c.setFont("Helvetica-Bold", size)
        c.setFillColorRGB(*BLACK)
        c.drawString(x, y, "•")
        y = wrap(c, item, x + 14, y, width - 14, size=size, leading=size + 4)
        y -= 5
    return y


def new_page(c, number, section, title, subtitle=""):
    if number > 1:
        c.showPage()
    header(c, section, title, subtitle)
    footer(c, number)


c = canvas.Canvas(str(OUT), pagesize=PAGE)
c.setTitle("FullCourt System Flow Guide")
c.setAuthor("FullCourt")

# 1 Cover
c.setFillColorRGB(*BLACK)
c.setFont("Helvetica-Bold", 12)
c.drawString(M, H - 58, "FULLCOURT")
c.setFont("Helvetica-Bold", 34)
c.drawString(M, H - 118, "System Flow & User Guide")
c.setFont("Helvetica", 15)
c.drawString(M, H - 150, "A visual walkthrough of the complete FullCourt workflow")
c.setStrokeColorRGB(*BLACK)
c.setLineWidth(2)
c.line(M, H - 176, W - M, H - 176)
c.setFont("Helvetica-Bold", 12)
c.drawString(M, H - 214, "COMMUNITY BASKETBALL OPERATIONS")
bullets(c, [
    "Public tournament discovery, schedules, brackets, standings, results, and approved player leaders.",
    "Coach and Assistant Coach team management with protected eligibility documents.",
    "Staff Admin tournament operations, scheduling, scoring access, incidents, and team attendance.",
    "Administrator control of tournaments, access, eligibility decisions, payments, awards, and official results.",
], M, H - 244, W * 0.55)
image_fit(c, "01-public-home.png", W * 0.64, 66, W * 0.31, H * 0.56)
c.setFont("Helvetica", 9)
c.drawString(M, 48, "Review build · November 7, 2026 · All guide text intentionally uses black font for maximum clarity.")
footer(c, 1)

# 2 Roles and flow
new_page(c, 2, "System overview", "Who uses FullCourt?", "A role-based workflow keeps private team operations separate from the public basketball experience.")
cols = [M, W * .28, W * .52, W * .76]
roles = [
    ("PUBLIC", ["No account required", "View tournaments and full schedules", "Follow brackets, standings, scores, and approved leaders"]),
    ("COACH / ASSISTANT", ["One assigned team only", "Manage roster up to the tournament limit", "Upload PSA/birth certificate and parent permit", "Receive schedule and tournament updates"]),
    ("STAFF ADMIN", ["Only assigned tournaments", "Manage operational schedule and venue", "Score directly or issue a secure link", "Record injury or misconduct incidents"]),
    ("ADMINISTRATOR", ["Create and publish competitions", "Assign Staff Admin", "Review eligibility and payments", "Confirm official results and awards"]),
]
for x, (name, items) in zip(cols, roles):
    c.setFillColorRGB(*LIGHT)
    c.roundRect(x, 118, W * .21, 320, 8, fill=1, stroke=0)
    c.setFillColorRGB(*BLACK)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x + 16, 408, name)
    bullets(c, items, x + 16, 378, W * .18, size=9)

# 3 public
new_page(c, 3, "Public experience", "Discover the competition without an account", "The public journey stays simple: choose a tournament, see every official game, then open detailed results.")
image_fit(c, "02-public-tournaments.png", M, 83, W * .43, 420)
image_fit(c, "03-public-schedule.png", W * .51, 83, W * .43, 420)

# 4 Admin
new_page(c, 4, "Administrator", "Set up and govern every competition", "The Administrator owns tournament creation, assignments, approvals, official results, and platform access.")
image_fit(c, "04-admin-dashboard.png", M, 86, W * .43, 410)
image_fit(c, "05-admin-teams.png", W * .51, 86, W * .43, 410)

# 5 Admin safeguarding
new_page(c, 5, "Administrator", "Eligibility, bracket, schedule, and honors", "Protected documents remain restricted. Only approved public statistics are shown outside the operations portal.")
for i, name in enumerate(["06-admin-eligibility.png", "07-admin-bracket.png", "08-admin-schedule.png", "09-admin-awards.png"]):
    x = M + (i % 2) * (W * .46)
    y = 300 if i < 2 else 58
    image_fit(c, name, x, y, W * .42, 205)

# 6 Staff
new_page(c, 6, "Staff Admin", "Run the assigned tournament", "The Staff Admin scores games directly or shares a secure scoring link and PIN with a trusted courtside scorer.")
image_fit(c, "10-staff-scoring-access.png", M, 86, W * .43, 410)
image_fit(c, "11-staff-statistician.png", W * .51, 86, W * .43, 410)

# 7 Coach mobile
new_page(c, 7, "Coach mobile", "Manage one team from a phone", "The Coach and Assistant Coach see only their assigned team, roster, documents, schedule, reports, and QR access.")
image_fit(c, "12-coach-mobile-dashboard.png", W * .18, 70, W * .25, 430)
image_fit(c, "13-coach-mobile-roster.png", W * .57, 70, W * .25, 430)

# 8 Scoring overview
new_page(c, 8, "Live scoring", "One clear courtside scoreboard", "The game clock, period, quarter scores, team totals, status, and connection state stay visible throughout the game.")
image_fit(c, "14-live-scoreboard.png", M, 74, W - 2 * M, 430)

# 9 player picker
new_page(c, 9, "Live scoring", "Two teams. Direct player selection.", "Substitutions and five-player lineup controls were removed for a faster community-tournament workflow.")
image_fit(c, "15-two-team-player-picker.png", M, 74, W - 2 * M, 430)

# 10 stats
new_page(c, 10, "Live scoring", "Complete player statistics remain available", "Select a player, then record made and missed shots, rebounds, assists, defense, turnovers, and fouls.")
image_fit(c, "16-stat-controls.png", M, 74, W - 2 * M, 430)

# 11 safety
new_page(c, 11, "Live scoring", "Final result and player safety", "The scorer reviews the final score before submission. Injury and misconduct reports remain available at the bottom of the console.")
image_fit(c, "17-safety-and-final.png", M, 74, W - 2 * M, 430)

# 12 flow
new_page(c, 12, "End-to-end flow", "From registration to official result", "Each step has a clear owner so coaches, staff, and the public receive consistent information.")
steps = [
    "1. Administrator creates and publishes the tournament, sets roster limit/deadline, venue, format, and assigned Staff Admin.",
    "2. Coach registers the team and players; Assistant Coach joins only after Administrator assignment.",
    "3. Coach uploads protected player documents. Staff Admin or Administrator reviews and records the decision.",
    "4. Administrator or assigned Staff Admin confirms teams, arranges the bracket, and runs the schedule optimizer.",
    "5. Coaches receive schedule changes and prepare the team QR pass for game-day arrival.",
    "6. Staff Admin opens scoring or issues the secure courtside link and PIN.",
    "7. Scorer selects players directly, records score and optional complete statistics, and logs incidents when needed.",
    "8. Final score is submitted for confirmation; brackets, standings, schedules, and public game pages update.",
    "9. Administrator confirms awards and the public sees only approved basketball information.",
]
bullets(c, steps, M, H - 130, W - 2 * M, size=10)

# 13 verification
new_page(c, 13, "Quality assurance", "What was verified in this system build", "The guide uses screenshots captured from the running local system, not static design mockups.")
bullets(c, [
    "Production frontend build completed successfully.",
    "Code quality check completed successfully for the updated scoring console.",
    "Secure scoring-link flow opened a real scheduled game.",
    "Two-team player selector displayed eligible rosters and excluded a rejected player from scoring.",
    "Player injury report saved successfully and appeared in the restricted incident desk.",
    "Fight/misconduct report saved successfully and generated an Administrator notification.",
    "Coach pages were captured at a mobile viewport for phone usability review.",
    "Public, Administrator, Staff Admin, Coach, and courtside screenshots were captured from the same connected local database.",
], M, H - 130, W * .58, size=11)
c.setFillColorRGB(*LIGHT)
c.roundRect(W * .67, 145, W * .26, 285, 8, fill=1, stroke=0)
c.setFillColorRGB(*BLACK)
c.setFont("Helvetica-Bold", 14)
c.drawString(W * .69, 395, "SYSTEM REVIEW CHECKLIST")
bullets(c, ["Confirm final user permissions", "Approve scoring controls", "Review eligibility workflow", "Confirm notification wording", "Approve game-day rehearsal", "Sign off production deployment"], W * .69, 365, W * .21, size=9)

# 14 recommendations
new_page(c, 14, "Recommended next steps", "Before the first official tournament", "These are operational safeguards, not additional complexity for ordinary users.")
bullets(c, [
    "Run one full game-day rehearsal with the actual Administrator, Staff Admin, two coaches, and a courtside device.",
    "Confirm backup procedure: printed score sheet, charged power bank, and a documented reconnect/resume process.",
    "Use a production HTTPS domain, strong application secret, verified email sender, and daily database backups.",
    "Confirm the final tournament rules: roster limit, eligibility deadline, payment decision, game duration, and incident escalation.",
    "Perform a restore test before launch; a backup is only useful when it can be restored successfully.",
    "Keep demo/practice tournaments separate from official standings and public reports.",
    "Complete a final mobile pass on the Coach portal and a tablet pass on the live scoring console.",
], M, H - 130, W - 2 * M, size=11)
c.setFont("Helvetica-Bold", 15)
c.drawString(M, 95, "FullCourt is ready for a guided system walkthrough and a controlled game-day rehearsal.")

c.save()
print(OUT)
