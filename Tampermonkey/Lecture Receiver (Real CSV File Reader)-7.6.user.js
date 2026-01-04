// ==UserScript==
// @name         Lecture Receiver (Real CSV File Reader)
// @namespace    lecture-sync-namespace
// @version      7.6
// @description  실제 CSV 파일에서 강의 정보 읽기 (File System Access API) - 동영상 재생시간 표시, duration 초 단위 변환, 타이밍 개선
// @match        https://goldloom.github.io/audio-recorder/*
// @match        https://goldloom.github.io/*
// @run-at       document-end
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    console.log('🚀 [B탭] Real CSV Reader 초기화');

    const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    let lastLectureFullText = null;
    let lastReceivedAt = null;
    let lastSplitAt = null;
    let fileHandle = null; // 선택된 파일 핸들
    let lastRecordingState = null; // 이전 녹음 상태 추적

    // =============================
    // UI Panel
    // =============================
    function createStatusPanel() {
        const existing = document.getElementById('btab-lecture-panel');
        if (existing) existing.remove();

        const box = document.createElement('div');
        box.id = 'btab-lecture-panel';
        box.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            padding: 10px 14px;
            border-radius: 10px;
            background: rgba(0,0,0,0.85);
            color: #fff;
            font-size: 12px;
            line-height: 16px;
            z-index: 999999;
            user-select: none;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;

        box.innerHTML = `
            <div style="font-weight:bold;margin-bottom:4px;">🎧 B탭 CSV Reader</div>
            <div id="btabStatus" style="color:#ffd43b;font-size:11px;margin-bottom:4px;">⏸️ CSV 파일 선택 필요</div>
            <div id="btabCurLecture">현재 강의: -</div>
            <div id="btabDuration">동영상 시간: -</div>
            <div id="btabLastRecv">마지막 수신: -</div>
            <div id="btabLastWrite">마지막 기록: -</div>
            <div id="btabFilePath" style="color:#868e96;font-size:10px;margin-top:4px;">파일: 미선택</div>
            <button id="selectFileBtn" style="margin-top:6px;width:100%;padding:6px 8px;border-radius:6px;border:none;background:#5865F2;color:#fff;cursor:pointer;font-size:11px;">
                📁 CSV 파일 선택
            </button>
        `;

        document.body.appendChild(box);

        document.getElementById('selectFileBtn').onclick = selectCsvFile;

        console.log('✅ [B탭] UI Panel 생성 완료');
    }

    function updateStatusPanel() {
        const status = document.getElementById('btabStatus');
        const cur = document.getElementById('btabCurLecture');
        const recv = document.getElementById('btabLastRecv');
        const write = document.getElementById('btabLastWrite');
        const filePath = document.getElementById('btabFilePath');

        if (status) {
            if (fileHandle && lastReceivedAt) {
                status.textContent = '✅ CSV 기록 중';
                status.style.color = '#51cf66';
            } else if (fileHandle) {
                status.textContent = '🟡 CSV 선택됨 / 데이터 대기';
                status.style.color = '#ffd43b';
            } else {
                status.textContent = '⏸️ CSV 파일 선택 필요';
                status.style.color = '#ffd43b';
            }
        }

        if (filePath) {
            if (fileHandle) {
                filePath.textContent = `파일: ${fileHandle.name}`;
            } else {
                filePath.textContent = '파일: 미선택';
            }
        }

        if (cur) {
            cur.textContent = '현재 강의: ' + (lastLectureFullText || '-');
        }

        const durationEl = document.getElementById('btabDuration');
        if (durationEl) {
            durationEl.textContent = '동영상 시간: ' + (w.currentLectureDuration || '-');
        }

        if (recv) {
            const time = lastReceivedAt ? new Date(lastReceivedAt).toLocaleTimeString('ko-KR') : '-';
            recv.textContent = '마지막 수신: ' + time;
        }

        if (write) {
            const time = lastSplitAt ? new Date(lastSplitAt).toLocaleTimeString('ko-KR') : '-';
            write.textContent = '마지막 기록: ' + time;
        }
    }

    // =============================
    // CSV 파일 선택
    // =============================
    async function selectCsvFile() {
        try {
            // unsafeWindow 또는 window 사용
            const win = unsafeWindow || window;

            // File System Access API 사용
            [fileHandle] = await win.showOpenFilePicker.call(win, {
                types: [{
                    description: 'CSV Files',
                    accept: { 'text/csv': ['.csv'] }
                }],
                multiple: false
            });

            console.log('✅ [B탭] CSV 파일 선택:', fileHandle.name);

            // 즉시 한번 읽기
            await readCsvFile();

            updateStatusPanel();
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('❌ [B탭] 파일 선택 실패:', e);
                alert('파일 선택 실패: ' + e.message);
            }
        }
    }

    // =============================
    // CSV 읽기
    // =============================
    async function readCsvFile() {
        if (!fileHandle) {
            console.warn('⚠️ [B탭] CSV 파일 미선택');
            return;
        }

        try {
            const file = await fileHandle.getFile();
            const content = await file.text();

            const lines = content.trim().split('\n');
            if (lines.length < 2) {
                // 헤더만 있거나 빈 파일
                return;
            }

            // 마지막 행 파싱
            const lastLine = lines[lines.length - 1];
            const columns = parseCsvLine(lastLine);

            if (columns.length < 6) {
                console.warn('⚠️ [B탭] CSV 형식 오류 (duration 컬럼 누락)');
                return;
            }

            // duration을 MM:SS에서 초 단위로 변환
            let durationInSeconds = null;
            if (columns[5]) {
                const durationMatch = columns[5].match(/^(\d+):(\d+)$/);
                if (durationMatch) {
                    const minutes = parseInt(durationMatch[1]);
                    const seconds = parseInt(durationMatch[2]);
                    durationInSeconds = minutes * 60 + seconds;
                }
            }

            const lectureInfo = {
                startTime: columns[0],
                donut: columns[1],
                chapter: columns[2],
                lecture: columns[3],
                fullText: columns[4],
                duration: durationInSeconds, // 초 단위로 저장
                durationText: columns[5] || '' // 원본 텍스트도 보관
            };

            // 새 강의인지 확인
            if (lectureInfo.fullText && lectureInfo.fullText !== lastLectureFullText) {
                console.log('📊 [B탭] CSV에서 새 강의 발견:', lectureInfo.fullText);
                splitRecordingByLecture(lectureInfo);
            } else if (lectureInfo.fullText && fileHandle) {
                // 같은 강의가 계속 유지되는 경우 - duration만 업데이트 (로그 생략)
                if (lectureInfo.duration !== null && lectureInfo.duration !== undefined) {
                    w.currentLectureDuration = lectureInfo.duration; // 초 단위
                }
                updateStatusPanel();
            }

        } catch (e) {
            console.error('❌ [B탭] CSV 읽기 실패:', e);
        }
    }

    // CSV 라인 파싱 (간단 버전)
    function parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);

        return result.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"'));
    }

    // =============================
    // 녹음 상태 감지 (개선됨)
    // =============================
    function detectRecordingState() {
        // 방법 1: isRecording 플래그 확인 (HTML 파일에서 실제 사용 중)
        if (w.isRecording === true) {
            if (lastRecordingState !== 'recording') {
                console.log('✅ [B탭] window.isRecording === true 감지!');
                lastRecordingState = 'recording';
            }
            return { isRecording: true, recorder: w.mediaRecorder };
        }

        // 방법 2: mediaRecorder 객체 확인
        if (w.mediaRecorder && w.mediaRecorder.state === 'recording') {
            if (lastRecordingState !== 'recording') {
                console.log('✅ [B탭] mediaRecorder.state === "recording" 감지!');
                lastRecordingState = 'recording';
            }
            return { isRecording: true, recorder: w.mediaRecorder };
        }

        // 방법 3: UI 요소로 확인 (녹음 버튼 텍스트)
        const recordingText = document.body.textContent;
        if (recordingText.includes('녹음 중') || recordingText.includes('Recording')) {
            if (lastRecordingState !== 'recording') {
                console.log('✅ [B탭] UI 텍스트로 녹음 중 감지!');
                lastRecordingState = 'recording';
            }
            return { isRecording: true, recorder: w.mediaRecorder };
        }

        // 방법 4: 모든 MediaRecorder 인스턴스 찾기
        for (const key in w) {
            try {
                if (w[key] instanceof MediaRecorder && w[key].state === 'recording') {
                    if (lastRecordingState !== 'recording') {
                        console.log('✅ [B탭] window.' + key + '로 녹음기 발견!');
                        lastRecordingState = 'recording';
                    }
                    return { isRecording: true, recorder: w[key] };
                }
            } catch (e) {
                // 무시
            }
        }

        // 녹음 중이 아님
        if (lastRecordingState !== 'stopped') {
            console.log('❌ [B탭] 녹음 중 아님');
            lastRecordingState = 'stopped';
        }
        return { isRecording: false, recorder: null };
    }

    // =============================
    // 녹음 분할 로직
    // =============================
    function splitRecordingByLecture(lectureInfo) {
        const fullText = lectureInfo.fullText || '알 수 없는 강의';

        if (fullText === lastLectureFullText) {
            console.log('[B탭] 동일 강의, 분할 생략:', fullText);
            return;
        }

        lastLectureFullText = fullText;
        lastReceivedAt = new Date().toISOString();

        console.log('🎧 [B탭] 새 강의 수신:', fullText);
        console.log('📝 [B탭] CSV에 강의 정보 기록 (A탭에서 자동 감지)');
        console.log('📊 [B탭] 전체 lectureInfo:', lectureInfo);

        // 🔧 duration을 window 객체에 설정 (A탭에서 사용)
        if (lectureInfo.duration !== null && lectureInfo.duration !== undefined) {
            w.currentLectureDuration = lectureInfo.duration; // 초 단위
            console.log('⏱️ [B탭] duration 설정:', lectureInfo.duration, '초');
        }

        const addLog = typeof w.addLog === 'function'
            ? w.addLog
            : (msg) => console.log('[LOG]', msg);

        // 🔧 B탭이 A탭의 CSV 정보를 받아서 index에 전달
        if (typeof w.processNewLectureFromCsv === 'function') {
            console.log('✅ [B탭] index의 processNewLectureFromCsv 함수 호출');
            try {
                w.processNewLectureFromCsv(lectureInfo);
                console.log('📝 [B탭] index에 강의 정보 전달 완료');
                addLog(`📊 [B탭] 강의 정보 전달: "${fullText}"`);
            } catch (error) {
                console.error('❌ [B탭] index 함수 호출 실패:', error);
                // 폴백: 그냥 로그 기록
                addLog(`📊 강의 정보 CSV 기록: "${fullText}"`);
            }
        } else {
            console.warn('⚠️ [B탭] index의 processNewLectureFromCsv 함수를 찾을 수 없음');
            addLog(`📊 강의 정보 CSV 기록: "${fullText}"`);
        }

        lastSplitAt = new Date().toISOString();

        updateStatusPanel();
    }

    // =============================
    // 초기화
    // =============================
    function init() {
        console.log('🎬 [B탭] Real CSV Reader 초기화 시작');

        // File System Access API 지원 확인
        const win = unsafeWindow || window;
        if (!win.showOpenFilePicker) {
            alert('⚠️ 이 브라우저는 File System Access API를 지원하지 않습니다.\nChrome, Edge 최신 버전을 사용해주세요.');
            console.error('❌ File System Access API 미지원');
            return;
        }

        createStatusPanel();

        // 3초마다 CSV 파일 읽기 (조용하게)
        setInterval(() => {
            if (fileHandle) {
                readCsvFile().catch(error => {
                    console.error('❌ [B탭] CSV 읽기 에러:', error);
                });
            }
            updateStatusPanel();
        }, 3000);

        console.log('✅ [B탭] Real CSV Reader 초기화 완료');
        console.log('💡 [B탭] "📁 CSV 파일 선택" 버튼을 눌러 A탭과 같은 CSV 파일을 선택하세요!');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
