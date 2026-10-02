from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

NAVY = colors.HexColor("#1F3A5F")


def build_pdf(path: str, d: dict, date: str, room: str, participants: list[str]) -> None:
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], textColor=NAVY, fontSize=18, spaceAfter=6)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=NAVY, fontSize=12, spaceBefore=12)
    body = ParagraphStyle("b", parent=ss["BodyText"], leading=15)

    def p(t, st=body):
        return Paragraph(escape(str(t)), st)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawString(2 * cm, 1.2 * cm, "Compte rendu généré automatiquement – à valider avant diffusion")
        canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Page {doc.page}")
        canvas.restoreState()

    story = [p("COMPTE RENDU DE RÉUNION", h1), p(d["titre"], h2)]
    meta = Table(
        [["Date", date], ["Salle", room], ["Participants", ", ".join(participants) or "Non renseignés"]],
        colWidths=[3.5 * cm, 12.5 * cm],
    )
    meta.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story += [Spacer(1, 6), meta, p("Résumé", h2), p(d["resume"])]

    story.append(p("Points clés", h2))
    story += [p("• " + x) for x in d["points_cles"]] or [p("Aucun")]
    story.append(p("Décisions", h2))
    story += [p("• " + x) for x in d["decisions"]] or [p("Aucune décision enregistrée")]

    story.append(p("Plan d'actions", h2))
    if d["actions"]:
        rows = [["Responsable", "Tâche", "Échéance"]] + [
            [p(a.get("responsable", "")), p(a.get("tache", "")), p(a.get("echeance", "Non précisé"))]
            for a in d["actions"]
        ]
        t = Table(rows, colWidths=[4 * cm, 9 * cm, 3 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(t)
    else:
        story.append(p("Aucune action enregistrée"))

    SimpleDocTemplate(path, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm,
                      topMargin=2 * cm, bottomMargin=2 * cm,
                      title=d["titre"]).build(story, onFirstPage=footer, onLaterPages=footer)
