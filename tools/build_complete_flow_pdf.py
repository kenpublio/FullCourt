from pathlib import Path
from PIL import Image
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ROOT = Path(r"C:\Pictures\CAPSTONE 2")
SCREENS = ROOT / "tmp" / "pdfs" / "screens"
OUT = ROOT / "output" / "pdf" / "FullCourt_Complete_System_Flow_Guide.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
W, H = landscape(A4)
M = 38
page_no = 0


def wrap(c, text, x, y, width, size=9, leading=12, bold=False):
    font = "Helvetica-Bold" if bold else "Helvetica"
    c.setFont(font, size); c.setFillColorRGB(0, 0, 0)
    line = ""
    for word in text.split():
        trial = (line + " " + word).strip()
        if c.stringWidth(trial, font, size) <= width:
            line = trial
        else:
            c.drawString(x, y, line); y -= leading; line = word
    if line: c.drawString(x, y, line); y -= leading
    return y


def begin(c, section, title, subtitle=""):
    global page_no
    if page_no: c.showPage()
    page_no += 1
    c.setFillColorRGB(0,0,0); c.setFont("Helvetica-Bold", 8); c.drawString(M, H-28, section.upper())
    c.setFont("Helvetica-Bold", 23); c.drawString(M, H-57, title)
    if subtitle: wrap(c, subtitle, M, H-76, W-2*M, 8, 11)
    c.setStrokeColorRGB(0,0,0); c.line(M, H-88, W-M, H-88)
    c.setFont("Helvetica", 7); c.drawString(M, 18, "FullCourt complete system flow guide - November 8, 2026")
    c.drawRightString(W-M, 18, str(page_no))


def img(c, name, x, y, w, h):
    p = SCREENS / f"{name}.png"
    if not p.exists():
        c.setStrokeColorRGB(.5,.5,.5); c.rect(x,y,w,h); c.drawCentredString(x+w/2,y+h/2,f"Screen unavailable: {name}"); return
    with Image.open(p) as im: iw, ih = im.size
    s=min(w/iw,h/ih); dw,dh=iw*s,ih*s; dx=x+(w-dw)/2; dy=y+(h-dh)/2
    c.drawImage(ImageReader(str(p)),dx,dy,dw,dh,preserveAspectRatio=True,mask="auto")
    c.setStrokeColorRGB(.72,.72,.72); c.rect(dx,dy,dw,dh)


def pair(c, left, right, left_label, right_label):
    gap=22; box=(W-2*M-gap)/2
    c.setFont("Helvetica-Bold",9); c.setFillColorRGB(0,0,0)
    c.drawString(M, H-108, left_label); c.drawString(M+box+gap,H-108,right_label)
    img(c,left,M,55,box,H-176); img(c,right,M+box+gap,55,box,H-176)


def bullets(c, items, x, y, width):
    for text in items:
        c.setFont("Helvetica-Bold",9); c.drawString(x,y,"-")
        y=wrap(c,text,x+14,y,width-14,9,13); y-=4
    return y


c=canvas.Canvas(str(OUT),pagesize=(W,H)); c.setTitle("FullCourt Complete System Flow Guide"); c.setAuthor("FullCourt")

begin(c,"FullCourt","Complete System Flow & User Guide","Public, registration, Coach, Assistant Coach, Staff Admin, Administrator, scheduling, scoring, incidents, and official public results.")
c.setFont("Helvetica-Bold",14); c.drawString(M,H-130,"COMPLETE BASKETBALL WORKFLOW")
bullets(c,[
    "Public visitors follow tournaments, schedules, game results, brackets, standings, and approved player leaders without an account.",
    "Coach and Assistant Coach operate only their assigned team and competition.",
    "Staff Admin operates only the tournament assigned by the Administrator.",
    "Administrator controls tournaments, staff access, eligibility, payments, schedules, official results, and awards.",
    "Courtside scoring connects player statistics and final scores back to the public pages.",
],M,H-158,W*.54)
img(c,"01-public-home",W*.64,70,W*.31,H*.56)

begin(c,"Role map","Who uses the system?","Every role has a focused workspace and protected access boundary.")
roles=[("PUBLIC","No account. View official competition information."),("COACH","Register and manage one team and its player documents."),("ASSISTANT COACH","View and support only the team assigned by Admin."),("STAFF ADMIN","Run the assigned tournament, schedule, scoring, and incidents."),("ADMINISTRATOR","Control competitions, users, approvals, and official results.")]
for i,(name,desc) in enumerate(roles):
    x=M+i*(W-2*M)/5; bw=(W-2*M)/5-10
    c.setFillColorRGB(.94,.94,.94); c.roundRect(x,145,bw,285,7,fill=1,stroke=0)
    c.setFillColorRGB(0,0,0); c.setFont("Helvetica-Bold",11); c.drawString(x+12,400,name)
    wrap(c,desc,x+12,370,bw-24,9,14)

begin(c,"Public flow","Public home and tournament discovery","Visitors can immediately understand FullCourt and choose the competition they want to follow.")
pair(c,"01-public-home","02-public-tournaments","1. Public home","2. Choose a tournament")

begin(c,"Public flow","Official schedule and tournament details","After selecting a tournament, every published game, venue, score, bracket, standing, and team becomes available.")
pair(c,"03-public-schedule","22-public-tournament-details","3. Complete official schedule","4. Tournament overview")

begin(c,"Public flow","Official game overview and box score","Each public game page presents the score by quarter, team comparison, leaders, full roster box score, venue, and official result. Long 15-player rosters scroll inside the table while the header stays visible.")
img(c,"23-public-game-details",M,62,W-2*M,H-165)

begin(c,"Account access","Sign in and recover access","Registered users sign in by role. Forgot Password sends a verification code to the registered email.")
pair(c,"18-login","21-forgot-password","1. Sign in","2. Forgot password")

begin(c,"Registration","Coach and Assistant Coach registration","The user selects the correct account type, enters identity/contact details, verifies email, and creates a secure password.")
pair(c,"19-register-coach","20-register-assistant","Coach registration","Assistant Coach registration")

begin(c,"Coach flow","Coach mobile home and assigned roster","The Coach sees one assigned team, roster progress, tournament alerts, and direct team actions.")
pair(c,"12-coach-mobile-dashboard","13-coach-mobile-roster","1. Coach workspace","2. Team roster")

begin(c,"Coach flow","Eligibility and official schedule","The Coach uploads protected player documents and follows the complete tournament schedule or team-only view.")
pair(c,"38-coach-eligibility","39-coach-schedule","3. Player eligibility documents","4. Schedule and venues")

begin(c,"Coach flow","Standings, reports, and team QR","Only the assigned team data is exposed inside Coach reports and game-day access.")
pair(c,"40-coach-standings","41-coach-reports","5. Tournament standings","6. Team reports")

begin(c,"Coach flow","Game-day pass and notifications","The Coach presents the team QR pass and receives tournament, schedule, and result updates.")
pair(c,"42-coach-qr","43-coach-notifications","7. Team QR access","8. Notifications")

begin(c,"Assistant Coach flow","Assigned-team support workspace","Assistant Coach access is separate from Coach registration but remains limited to the team assigned by Administrator.")
pair(c,"44-assistant-dashboard","45-assistant-schedule","1. Assistant Coach home","2. Assigned schedule")

begin(c,"Assistant Coach flow","Standings, reports, and QR access","The Assistant Coach can support game preparation without receiving tournament administration privileges.")
pair(c,"46-assistant-standings","47-assistant-reports","3. Standings","4. Assigned-team reports")

begin(c,"Assistant Coach flow","Official team pass","The Assistant Coach can access the same assigned-team QR pass for game-day coordination.")
img(c,"48-assistant-qr",W*.36,60,W*.28,H-165)

begin(c,"Account flow","Notifications, profile, and preferences","Every authenticated role has role-scoped notifications, editable profile details, and accessible appearance settings.")
for i,(name,label) in enumerate([("49-admin-notifications","Administrator notifications"),("51-staff-notifications","Staff Admin notifications"),("55-assistant-notifications","Assistant Coach notifications")]):
    x=M+i*(W-2*M)/3; bw=(W-2*M)/3-14
    c.setFont("Helvetica-Bold",8); c.drawString(x,H-108,label); img(c,name,x,70,bw,H-190)

begin(c,"Account flow","Coach and Assistant Coach profiles","Each team account maintains its own identity and contact details while remaining scoped to the assigned team.")
pair(c,"53-coach-profile","56-assistant-profile","Coach profile","Assistant Coach profile")

begin(c,"Account flow","Coach and Assistant Coach settings","Appearance and account preferences remain separate from team, roster, and competition records.")
pair(c,"54-coach-settings","57-assistant-settings","Coach settings","Assistant Coach settings")

begin(c,"Account flow","Administrator and Staff Admin settings","Operational accounts can adjust their own preferences without changing tournament assignments or access boundaries.")
pair(c,"50-admin-settings","52-staff-settings","Administrator settings","Staff Admin settings")

begin(c,"Staff Admin flow","Assigned tournament operations","The Staff Admin dashboard and team list show only the competition delegated by the Administrator.")
pair(c,"30-staff-dashboard","31-staff-teams","1. Staff Admin dashboard","2. Teams and rosters")

begin(c,"Staff Admin flow","Eligibility and bracket operations","Staff Admin reviews protected documents for the assigned tournament and manages the competition path.")
pair(c,"32-staff-eligibility","33-staff-brackets","3. Eligibility review","4. Bracket management")

begin(c,"Staff Admin flow","Schedule and tournament standings","Staff Admin configures playable slots, venue address, start time, daily game limit, and follows finalized rankings.")
pair(c,"34-staff-schedules","35-staff-standings","5. Schedule optimizer","6. Standings")

begin(c,"Staff Admin flow","Secure scoring access","Staff Admin can score directly or create a secure courtside link and PIN for a trusted scorer.")
pair(c,"10-staff-scoring-access","11-staff-statistician","7. Secure scoring access","8. Courtside scoring workspace")

begin(c,"Staff Admin flow","Game-day attendance and incidents","QR attendance confirms team arrival. Injury and misconduct records remain in the restricted incident desk.")
pair(c,"36-staff-qr","37-staff-incidents","9. QR attendance","10. Incident reports")

begin(c,"Administrator flow","Platform command center and accounts","Administrator creates Staff Admin accounts, assigns roles, and monitors unresolved competition work.")
pair(c,"04-admin-dashboard","24-admin-accounts","1. Administrator dashboard","2. Accounts and roles")

begin(c,"Administrator flow","Tournament and roster management","Administrator creates and publishes tournaments, then reviews registered teams and coach-managed rosters.")
pair(c,"25-admin-tournaments","05-admin-teams","3. Tournament setup","4. Teams and players")

begin(c,"Administrator flow","Eligibility and competition path","Administrator selects the tournament and team before reviewing protected player documents, then confirms the bracket.")
pair(c,"06-admin-eligibility","07-admin-bracket","5. Eligibility verification","6. Bracket engine")

begin(c,"Administrator flow","Scheduling and official result review","Administrator oversees the schedule and confirms submitted final scores before they affect public results.")
pair(c,"08-admin-schedule","09-admin-awards","7. Schedule and venues","8. Awards and result data")

begin(c,"Administrator flow","Payments, attendance, and incidents","Coach payment receipts, team QR check-ins, and restricted game incidents are reviewed in dedicated workspaces.")
for i,(name,label) in enumerate([("26-admin-payments","9. Payment review"),("27-admin-qr","10. QR oversight"),("28-admin-incidents","11. Incident desk")]):
    x=M+i*(W-2*M)/3; bw=(W-2*M)/3-14
    c.setFont("Helvetica-Bold",8); c.drawString(x,H-108,label); img(c,name,x,70,bw,H-190)

begin(c,"Administrator flow","Reports and official analytics","Administrator downloads competition reports and checks approved performance data without exposing protected records.")
img(c,"29-admin-reports",M,65,W-2*M,H-170)

begin(c,"Live scoring flow","Scoreboard and direct player selection","The scorer confirms the game, uses the clock and period controls, then selects a player directly from either team.")
pair(c,"14-live-scoreboard","15-two-team-player-picker","1. Live game scoreboard","2. Choose team and player")

begin(c,"Live scoring flow","Complete basketball statistics","Made and missed shots, rebounds, assists, steals, blocks, turnovers, and fouls remain available for the selected player.")
img(c,"16-stat-controls",M,62,W-2*M,H-165)

begin(c,"Live scoring flow","Safety report and final score submission","Injury or fight/misconduct can be reported without leaving scoring. The final score is reviewed before Administrator confirmation.")
img(c,"17-safety-and-final",M,62,W-2*M,H-165)

begin(c,"Connected workflow","How information reaches the public","Each completed operation updates the next responsible user and, after approval, the public competition pages.")
bullets(c,[
    "1. Administrator creates the tournament, roster deadline, venue rules, format, and Staff Admin assignment.",
    "2. Coach registers the team and players; Assistant Coach is assigned to the correct team.",
    "3. Coach uploads player requirements; Staff Admin or Administrator reviews eligibility.",
    "4. Approved teams enter the bracket. Opening matchups can be adjusted before official games begin.",
    "5. Schedule optimizer places ready games using the entered venue address, start time, closing time, and daily limit.",
    "6. Coaches receive schedule information and present the team QR pass on game day.",
    "7. Staff Admin scores directly or shares the secure link and PIN with a trusted scorer.",
    "8. Player stats, incidents, quarter scores, and final result are recorded during the game.",
    "9. Administrator confirms the official result and awards. Public schedule, bracket, standings, game page, and leaders update.",
],M,H-125,W-2*M)

begin(c,"System checks","Verified in the running local system","All screenshots in this guide were captured from the connected application and local database.")
bullets(c,[
    "Public, Coach, Assistant Coach, Staff Admin, and Administrator role sessions opened successfully.",
    "Production frontend build completed successfully.",
    "Secure scoring link and PIN activation completed successfully.",
    "Two-team direct player selection displayed eligible rosters.",
    "Injury and fight/misconduct reports saved successfully.",
    "Restricted incident desk and Administrator notification updated successfully.",
    "Coach and Assistant Coach pages were checked at a mobile phone viewport.",
    "Final deployment still requires HTTPS, production secrets, verified email, backups, and an actual game-day rehearsal.",
],M,H-130,W-2*M)

c.save(); print(OUT)
