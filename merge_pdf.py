import os
from pathlib import Path
from PyPDF2 import PdfMerger

def merge_pdfs(folder_path, output_filename="merged.pdf"):
    """
    지정된 폴더의 모든 PDF 파일을 하나로 합칩니다.

    Args:
        folder_path: PDF 파일들이 있는 폴더 경로
        output_filename: 출력 파일명 (기본값: merged.pdf)
    """
    # 폴더 경로 설정
    p = Path(folder_path)

    # .pdf 파일 찾기 (알파벳 순으로 정렬)
    pdf_files = sorted(p.glob("*.pdf"))

    if not pdf_files:
        print("합칠 PDF 파일이 없습니다.")
        return

    print(f"총 {len(pdf_files)}개의 PDF 파일을 찾았습니다.")
    print("\n파일 목록:")
    for i, pdf_file in enumerate(pdf_files, 1):
        print(f"{i}. {pdf_file.name}")

    print(f"\n파일 병합을 시작합니다...")

    try:
        # PdfMerger 객체 생성
        merger = PdfMerger()

        # 각 PDF 파일을 순서대로 추가
        for pdf_file in pdf_files:
            print(f"추가 중: {pdf_file.name}")
            merger.append(str(pdf_file))

        # 출력 파일 경로 설정
        output_path = p / output_filename

        # 병합된 PDF 저장
        with open(output_path, 'wb') as output_file:
            merger.write(output_file)

        merger.close()

        print(f"\n✅ 병합 완료: {output_path}")
        print(f"총 {len(pdf_files)}개의 파일이 병합되었습니다.")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")

def merge_specific_pdfs(pdf_paths, output_path):
    """
    특정 PDF 파일들을 지정된 순서대로 합칩니다.

    Args:
        pdf_paths: PDF 파일 경로 리스트
        output_path: 출력 파일 경로
    """
    try:
        merger = PdfMerger()

        print(f"총 {len(pdf_paths)}개의 PDF 파일을 병합합니다.")

        for pdf_path in pdf_paths:
            pdf_file = Path(pdf_path)
            if not pdf_file.exists():
                print(f"⚠️ 파일을 찾을 수 없습니다: {pdf_path}")
                continue

            print(f"추가 중: {pdf_file.name}")
            merger.append(str(pdf_file))

        with open(output_path, 'wb') as output_file:
            merger.write(output_file)

        merger.close()

        print(f"\n✅ 병합 완료: {output_path}")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    # 사용 예시 1: 폴더 내 모든 PDF 병합
    target_folder = r"C:\Users\yoo\Downloads"
    merge_pdfs(target_folder, "merged_output.pdf")

    # 사용 예시 2: 특정 파일들만 병합
    # specific_files = [
    #     r"C:\Users\yoo\Downloads\file1.pdf",
    #     r"C:\Users\yoo\Downloads\file2.pdf",
    #     r"C:\Users\yoo\Downloads\file3.pdf",
    # ]
    # merge_specific_pdfs(specific_files, r"C:\Users\yoo\Downloads\custom_merged.pdf")
