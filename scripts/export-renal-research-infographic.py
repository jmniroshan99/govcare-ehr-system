"""Export the reviewed research illustration as a single 16:9 presentation PDF.

Optional artifact-authoring dependency: reportlab. Not used by application startup.
The diagram is conceptual; this script never reads patient data or runs inference.
"""
from pathlib import Path

from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def export_infographic(root: Path) -> Path:
    source = root / "public/research/ckd-risk-predictive-intelligence-v45.png"
    target = root / "public/research/ckd-risk-predictive-intelligence-v45.pdf"
    image = ImageReader(str(source))
    image_width, image_height = image.getSize()
    page_width, page_height = 960, 540
    scale = min(page_width / image_width, page_height / image_height)
    width, height = image_width * scale, image_height * scale
    document = canvas.Canvas(str(target), pagesize=(page_width, page_height), pageCompression=1)
    document.setTitle("CKD-Related Clinical Risks & Predictive Intelligence")
    document.setSubject("Sri Lankan Longitudinal Renal & Hemodialysis Data - illustrative research concept; clinician review required")
    document.setAuthor("GovCare research project")
    document.setFillColorRGB(7 / 255, 26 / 255, 49 / 255)
    document.rect(0, 0, page_width, page_height, fill=1, stroke=0)
    document.drawImage(image, (page_width - width) / 2, (page_height - height) / 2,
                       width=width, height=height, preserveAspectRatio=True)
    document.showPage()
    document.save()
    return target


if __name__ == "__main__":
    print(export_infographic(Path(__file__).resolve().parents[1]))
