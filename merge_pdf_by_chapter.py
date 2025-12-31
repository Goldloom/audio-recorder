import os
from pathlib import Path
from PyPDF2 import PdfMerger
from collections import defaultdict
import re

def merge_pdfs_by_chapter(folder_path):
    """
    폴더 내 PDF 파일들을 Chapter별로 그룹화하여 각각 병합합니다.

    Args:
        folder_path: PDF 파일들이 있는 폴더 경로
    """
    # 폴더 경로 설정
    p = Path(folder_path)

    # .pdf 파일 찾기 (Merged.pdf 파일 제외)
    all_pdf_files = list(p.glob("*.pdf"))
    pdf_files = [f for f in all_pdf_files if "Merged.pdf" not in f.name]

    if not pdf_files:
        print("합칠 PDF 파일이 없습니다.")
        return

    print(f"총 {len(pdf_files)}개의 PDF 파일을 찾았습니다. (Merged 파일 제외)\n")

    # Chapter별로 파일 그룹화
    chapters = defaultdict(list)
    chapter_prefixes = {}  # Chapter별 파일명 접두사 저장

    for pdf_file in pdf_files:
        # 파일명에서 Chapter 정보 추출
        # 패턴 1: "번호 - Ch X - ..." 형식 (예: "18 - Ch 6 - 01. 제목")
        match1 = re.match(r'^(\d+)\s*-\s*Ch\s+(\d+)', pdf_file.name)
        if match1:
            lecture_num = match1.group(1)  # "18"
            chapter_num = match1.group(2)  # "6"
            prefix = f"{lecture_num} - Ch {chapter_num}"  # "18 - Ch 6"
            chapters[chapter_num].append(pdf_file)
            # 첫 번째 파일의 접두사를 저장
            if chapter_num not in chapter_prefixes:
                chapter_prefixes[chapter_num] = prefix
            continue

        # 패턴 2: "[ChX-Y. 제목]" 형식 (예: "[Ch6-2. 보조기억장치와 입출력장치] RAID")
        match2 = re.match(r'^\[?Ch\s*(\d+)[-\s]', pdf_file.name)
        if match2:
            chapter_num = match2.group(1)  # "6"
            prefix = f"Ch {chapter_num}"  # "Ch 6"
            chapters[chapter_num].append(pdf_file)
            # 첫 번째 파일의 접두사를 저장
            if chapter_num not in chapter_prefixes:
                chapter_prefixes[chapter_num] = prefix
            continue

        # 패턴 3: "Ch X - ..." 형식 (기존 방식)
        match3 = re.search(r'Ch\s+(\d+)', pdf_file.name)
        if match3:
            chapter_num = match3.group(1)
            chapters[chapter_num].append(pdf_file)
            # 기존 방식용 접두사
            if chapter_num not in chapter_prefixes:
                chapter_prefixes[chapter_num] = f"Ch {chapter_num}"

    if not chapters:
        print("Chapter 정보를 찾을 수 없습니다.")
        return

    # Chapter별로 정렬
    sorted_chapters = sorted(chapters.keys())

    print(f"총 {len(sorted_chapters)}개의 Chapter를 찾았습니다: {', '.join([f'Ch {ch}' for ch in sorted_chapters])}\n")

    # 각 Chapter별로 병합 수행
    for chapter_num in sorted_chapters:
        chapter_files = sorted(chapters[chapter_num])  # 파일명 순으로 정렬

        print(f"\n{'='*60}")
        print(f"Chapter {chapter_num} 처리 중...")
        print(f"{'='*60}")
        print(f"파일 개수: {len(chapter_files)}개")

        for i, pdf_file in enumerate(chapter_files, 1):
            print(f"  {i}. {pdf_file.name}")

        try:
            # PdfMerger 객체 생성
            merger = PdfMerger()

            # 각 PDF 파일을 순서대로 추가
            for pdf_file in chapter_files:
                merger.append(str(pdf_file))

            # 출력 파일명 생성
            # chapter_prefixes에서 해당 챕터의 접두사 가져오기
            prefix = chapter_prefixes.get(chapter_num, f"Ch {chapter_num}")
            output_filename = f"21 - {prefix} - 강의자료.pdf"
            output_path = p / output_filename

            # 병합된 PDF 저장
            with open(output_path, 'wb') as output_file:
                merger.write(output_file)

            merger.close()

            print(f"\n[완료] 병합 완료: {output_filename}")
            print(f"   저장 위치: {output_path}")

        except Exception as e:
            print(f"\n[오류] Chapter {chapter_num} 병합 중 오류 발생: {e}")

    print(f"\n{'='*60}")
    print(f"모든 Chapter 병합 작업이 완료되었습니다!")
    print(f"{'='*60}")

if __name__ == "__main__":
    # 대상 폴더 경로
    target_folder = r"C:\Users\yoo\Downloads\21\Part 5. 데이터베이스"
    merge_pdfs_by_chapter(target_folder)
