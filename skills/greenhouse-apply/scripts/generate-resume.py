#!/usr/bin/env python3
"""
Template-based resume and cover letter .docx generator.
Uses an existing .docx as template, replaces content while preserving formatting.

Usage:
  python3 generate-resume.py --type resume --template <path> --content '<json>' --output <path>
  python3 generate-resume.py --type cover_letter --template <path> --content '<json>' --output <path>
"""

import argparse
import json
import sys
import os
from docx import Document
from docx.shared import Pt, Inches, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn


def generate_resume(template_path, content_json, output_path):
    """Generate a tailored resume from template + JSON content."""
    content = json.loads(content_json) if isinstance(content_json, str) else content_json

    # Create new doc with same page setup as template
    template = Document(template_path)
    doc = Document()

    # Copy page setup from template
    template_section = template.sections[0]
    section = doc.sections[0]
    section.top_margin = template_section.top_margin
    section.bottom_margin = template_section.bottom_margin
    section.left_margin = template_section.left_margin
    section.right_margin = template_section.right_margin
    section.page_width = template_section.page_width
    section.page_height = template_section.page_height

    # Copy styles from template if possible
    try:
        for style in template.styles:
            pass  # Styles are read-only, we'll use matching style names
    except Exception:
        pass

    # --- Build Resume Content ---

    # 1. Name header
    name_para = doc.add_paragraph()
    name_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    name_run = name_para.add_run(content.get('name', 'BARRON ZUO'))
    name_run.bold = True
    name_run.font.size = Pt(16)
    name_run.font.name = 'Calibri'
    name_para.space_after = Pt(2)

    # 2. Contact line
    contact_para = doc.add_paragraph()
    contact_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    contact_run = contact_para.add_run(content.get('contact', 'San Francisco, CA | +1 909-413-2840 | xz429@cornell.edu'))
    contact_run.font.size = Pt(9)
    contact_run.font.name = 'Calibri'
    contact_para.space_after = Pt(6)

    # 3. Executive Summary
    doc.add_heading('EXECUTIVE SUMMARY', level=1)
    summary_para = doc.add_paragraph(content.get('executive_summary', ''))
    summary_para.style.font.size = Pt(10)
    for run in summary_para.runs:
        run.font.size = Pt(10)
        run.font.name = 'Calibri'

    # 4. Core Competencies (table)
    doc.add_heading('CORE COMPETENCIES', level=1)
    competencies = content.get('competencies', [])
    if competencies:
        table = doc.add_table(rows=len(competencies), cols=2)
        table.autofit = True
        for i, row_data in enumerate(competencies):
            for j, cell_text in enumerate(row_data):
                cell = table.cell(i, j)
                cell.text = cell_text
                for para in cell.paragraphs:
                    for run in para.runs:
                        run.font.size = Pt(9.5)
                        run.font.name = 'Calibri'

    # 5. Professional Experience
    doc.add_heading('PROFESSIONAL EXPERIENCE', level=1)
    for exp in content.get('experience', []):
        # Company line
        company_para = doc.add_paragraph()
        company_run = company_para.add_run(exp.get('company', ''))
        company_run.bold = True
        company_run.font.size = Pt(10.5)
        company_run.font.name = 'Calibri'
        company_para.space_after = Pt(0)

        # Role line
        role_para = doc.add_paragraph()
        role_run = role_para.add_run(exp.get('role', ''))
        role_run.italic = True
        role_run.font.size = Pt(10)
        role_run.font.name = 'Calibri'
        role_para.space_after = Pt(2)

        # Bullet points
        for bullet in exp.get('bullets', []):
            bullet_para = doc.add_paragraph(bullet, style='List Bullet')
            for run in bullet_para.runs:
                run.font.size = Pt(9.5)
                run.font.name = 'Calibri'
            bullet_para.space_after = Pt(1)

    # 6. Education
    doc.add_heading('EDUCATION', level=1)
    for edu in content.get('education', []):
        edu_para = doc.add_paragraph(edu, style='List Bullet')
        for run in edu_para.runs:
            run.font.size = Pt(10)
            run.font.name = 'Calibri'

    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)
    print(json.dumps({'success': True, 'output': output_path, 'message': 'Resume generated'}))


def generate_cover_letter(template_path, content_json, output_path):
    """Generate a tailored cover letter from template + JSON content."""
    content = json.loads(content_json) if isinstance(content_json, str) else content_json

    # Create new doc with same page setup as template
    template = Document(template_path)
    doc = Document()

    # Copy page setup
    template_section = template.sections[0]
    section = doc.sections[0]
    section.top_margin = template_section.top_margin
    section.bottom_margin = template_section.bottom_margin
    section.left_margin = template_section.left_margin
    section.right_margin = template_section.right_margin

    # --- Build Cover Letter Content ---

    # 1. Header
    header_para = doc.add_paragraph()
    header_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    header_lines = content.get('header', 'BARRON ZUO\nSan Francisco, CA | +1 909-413-2840 | xz429@cornell.edu').split('\n')
    for i, line in enumerate(header_lines):
        run = header_para.add_run(line)
        if i == 0:
            run.bold = True
            run.font.size = Pt(14)
        else:
            run.font.size = Pt(9)
        run.font.name = 'Calibri'
        if i < len(header_lines) - 1:
            header_para.add_run('\n')

    # 2. Date
    doc.add_paragraph('')
    date_para = doc.add_paragraph(content.get('date', ''))
    for run in date_para.runs:
        run.font.size = Pt(10.5)
        run.font.name = 'Calibri'

    # 3. Recipient
    doc.add_paragraph('')
    recipient_lines = content.get('recipient', '').split('\n')
    for line in recipient_lines:
        p = doc.add_paragraph(line)
        for run in p.runs:
            run.font.size = Pt(10.5)
            run.font.name = 'Calibri'

    # 4. Salutation
    doc.add_paragraph('')
    sal_para = doc.add_paragraph(content.get('salutation', 'Dear Hiring Team,'))
    for run in sal_para.runs:
        run.font.size = Pt(10.5)
        run.font.name = 'Calibri'

    # 5. Body paragraphs
    for para_text in content.get('paragraphs', []):
        p = doc.add_paragraph(para_text)
        for run in p.runs:
            run.font.size = Pt(10.5)
            run.font.name = 'Calibri'
        p.space_after = Pt(6)

    # 6. Sign off
    doc.add_paragraph('')
    sign_off_lines = content.get('sign_off', 'Sincerely,\n\nBarron Zuo').split('\n')
    for line in sign_off_lines:
        p = doc.add_paragraph(line)
        for run in p.runs:
            run.font.size = Pt(10.5)
            run.font.name = 'Calibri'

    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc.save(output_path)
    print(json.dumps({'success': True, 'output': output_path, 'message': 'Cover letter generated'}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate resume/cover letter .docx from template + JSON')
    parser.add_argument('--type', required=True, choices=['resume', 'cover_letter'], help='Document type')
    parser.add_argument('--template', required=True, help='Path to template .docx file')
    parser.add_argument('--content', required=True, help='JSON string with content')
    parser.add_argument('--output', required=True, help='Output .docx file path')
    args = parser.parse_args()

    try:
        if args.type == 'resume':
            generate_resume(args.template, args.content, args.output)
        else:
            generate_cover_letter(args.template, args.content, args.output)
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}), file=sys.stderr)
        sys.exit(1)
