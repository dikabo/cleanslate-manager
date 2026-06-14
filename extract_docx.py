import sys
import zipfile
import xml.etree.ElementTree as ET

def extract_text(docx_path):
    try:
        zf = zipfile.ZipFile(docx_path)
        doc_xml = zf.read('word/document.xml')
        root = ET.fromstring(doc_xml)

        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

        content = []

        # Find paragraphs and tables in order
        body = root.find('.//w:body', ns)
        if body is None:
            return "No body found"

        for child in body:
            if child.tag == f"{{{ns['w']}}}p":
                # Paragraph
                texts = [t.text for t in child.findall('.//w:t', ns) if t.text]
                if texts:
                    content.append(''.join(texts))
            elif child.tag == f"{{{ns['w']}}}tbl":
                # Table
                content.append("\n--- TABLE START ---")
                for row in child.findall('.//w:tr', ns):
                    row_data = []
                    for cell in row.findall('.//w:tc', ns):
                        # Extract all text from cell paragraphs
                        cell_texts = [t.text for t in cell.findall('.//w:t', ns) if t.text]
                        row_data.append(''.join(cell_texts))
                    content.append(" | ".join(row_data))
                content.append("--- TABLE END ---\n")

        return '\n'.join(content)

    except Exception as e:
        return f"Error: {e}"

if __name__ == '__main__':
    if len(sys.argv) > 1:
        # handle encoding issues on windows by forcing stdout to utf-8
        sys.stdout.reconfigure(encoding='utf-8')
        print(extract_text(sys.argv[1]))
    else:
        print("Provide docx path")
