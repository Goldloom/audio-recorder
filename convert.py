import os
import subprocess
from pathlib import Path

def convert_webm_to_ogg(folder_path):
    # 1. 폴더 경로 설정 (Path객체를 사용하여 경로 처리 유연성 확보)
    p = Path(folder_path)
    
    # 2. .webm 파일 찾기
    webm_files = list(p.glob("*.webm"))
    
    if not webm_files:
        print("변환할 .webm 파일이 없습니다.")
        return

    print(f"총 {len(webm_files)}개의 파일을 찾았습니다. 변환을 시작합니다...")

    for webm_file in webm_files:
        # 출력 파일 경로 설정 (.webm -> .mp3)
        mp3_file = webm_file.with_suffix(".mp3")
        
        # 이미 파일이 존재하는지 확인
        if mp3_file.exists():
            print(f"이미 존재함: {mp3_file.name} (스킵)")
            continue

        print(f"변환 중: {webm_file.name} -> {mp3_file.name}")
        
        try:
            # ffmpeg 절대 경로 설정 (찾은 경로 사용)
            ffmpeg_path = r"C:\Users\yoo\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe"
            
            # ffmpeg 명령어 실행
            # -c:a libmp3lame: MP3 코덱 사용
            # -q:a 2: 고정 가변 비트레이트 품질 (0~9, 2는 약 190kbps 수준의 고음질)
            command = [
                ffmpeg_path,
                '-i', str(webm_file),
                '-vn',
                '-c:a', 'libmp3lame',
                '-q:a', '2',
                '-y',
                str(mp3_file)
            ]
            
            # encoding='utf-8'을 사용하여 한글 출력 및 에러 메시지 처리
            result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='ignore')
            
            if result.returncode == 0:
                print(f"✅ 변환 완료: {mp3_file.name}")
            else:
                print(f"❌ 변환 실패: {webm_file.name}")
                if result.stderr:
                    print(f"에러 메시지: {result.stderr}")
                
        except Exception as e:
            print(f"오류 발생: {e}")

if __name__ == "__main__":
    # 요청하신 다운로드 폴더 경로
    target_folder = r"C:\Users\yoo\Downloads"
    convert_webm_to_ogg(target_folder)