
const input = `72
Part 1. Intro

2/2

Ch01. 강의 소개

CH01-01. 돈만 보고 시작하는 AI_intro
19:49
CH01-02. 돈 버는 구조는 그대로, 돈 버는 속도는 빠르게
3:00`;

function parseCurriculum(text) {
    const lines = text.trim().split('\n');
    const parsed = [];

    // 시간 패턴: MM:SS 또는 H:MM:SS
    const timeOnlyPattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
    const timeInLinePattern = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;

    // 패턴들
    const courseNumberPattern = /^(\d+)\s*$/; // 강의 번호 (숫자만 있는 줄)
    const partPattern = /^(Part\s*\d+[.\s\-]*.*?)$/i;
    const chapterTitlePattern = /^(Ch(?:apter)?\s*\d+)[.\s]+(.+)$/i; // Ch01. 제목 (시간 없는 것)
    const subChapterPattern = /^(CH?\d+[-]\d+)[.\s]*(.*)$/i; // CH01-01. 제목
    const progressPattern = /^\d+\/\d+$/; // 2/3 같은 진행률 패턴
    const quizPattern = /^미제출|퀴즈|과제|제출/; // 퀴즈/과제 패턴

    let courseNumber = '';
    let currentPart = '';
    let currentChapter = '';
    let pendingTitle = null; // 다음 줄 시간을 기다리는 제목

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        console.log(`Processing line: "${line}"`);
        if (!line) continue;

        // 진행률 패턴 무시 (2/3 같은 것)
        if (progressPattern.test(line)) {
            console.log('  Ignored - Progress pattern');
            continue;
        }

        // 퀴즈/과제 패턴 무시
        if (quizPattern.test(line)) {
            console.log('  Ignored - Quiz pattern');
            continue;
        }

        // 시간만 있는 줄 (이전 제목의 시간)
        if (timeOnlyPattern.test(line) && pendingTitle) {
            console.log(`  Matched time only: ${line}, pendingTitle: ${pendingTitle}`);
            const timeMatch = line.match(timeOnlyPattern);
            let minutes, seconds;
            if (timeMatch[3]) {
                minutes = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
                seconds = parseInt(timeMatch[3]);
            } else {
                minutes = parseInt(timeMatch[1]);
                seconds = parseInt(timeMatch[2]);
            }
            const totalSeconds = minutes * 60 + seconds;

            // 전체 파일명 생성
            let fullName = '';
            if (courseNumber) fullName += courseNumber + ' ';
            if (currentPart) fullName += currentPart + ' - ';
            if (currentChapter) fullName += currentChapter + ' - ';
            fullName += pendingTitle;

            parsed.push({
                name: fullName,
                shortName: pendingTitle,
                originalDuration: totalSeconds,
                adjustedDuration: 0
            });

            pendingTitle = null;
            continue;
        } else if (timeOnlyPattern.test(line)) {
            console.log(`  Matched time only but no pendingTitle: ${line}`);
        }

        // 강의 번호 (숫자만)
        if (courseNumberPattern.test(line)) {
            console.log(`  Matched course number: ${line}`);
            courseNumber = line;
            pendingTitle = null;
            continue;
        }

        // Part 인식
        const partMatch = line.match(partPattern);
        if (partMatch && !timeInLinePattern.test(line)) {
            console.log(`  Matched Part: ${line}`);
            currentPart = partMatch[1].replace(/\s+/g, ' ').trim();
            const partNumMatch = currentPart.match(/Part\s*(\d+)/i);
            if (partNumMatch) {
                currentPart = `Part ${partNumMatch[1]}`;
            }
            pendingTitle = null;
            continue;
        }

        // Chapter 제목 인식 (Ch01. 제목 형식, 시간 없는 것)
        const chTitleMatch = line.match(chapterTitlePattern);
        if (chTitleMatch && !timeInLinePattern.test(line)) {
            console.log(`  Matched Chapter Title: ${line}`);
            const chNumMatch = chTitleMatch[1].match(/Ch(?:apter)?\s*(\d+)/i);
            if (chNumMatch) {
                currentChapter = `Ch${chNumMatch[1].padStart(2, '0')}`;
            }
            pendingTitle = null;
            continue;
        }

        // CH01-01. 제목 형식 (소챕터, 시간은 다음 줄에 있을 수 있음)
        const subChMatch = line.match(subChapterPattern);
        if (subChMatch && !timeInLinePattern.test(line)) {
            console.log(`  Matched SubChapter: ${line}`);
            const subChNum = subChMatch[1].toUpperCase(); // CH01-01
            const subChTitle = subChMatch[2] || '';

            // CH01-01에서 Ch01 추출해서 현재 챕터 업데이트
            const chFromSub = subChNum.match(/CH?(\d+)-/i);
            if (chFromSub) {
                currentChapter = `Ch${chFromSub[1].padStart(2, '0')}`;
            }

            pendingTitle = subChNum + (subChTitle ? '. ' + subChTitle : '');
            console.log(`  Set pendingTitle: ${pendingTitle}`);
            continue;
        }

        // 시간이 같은 줄에 있는 경우
        const timeMatch = line.match(timeInLinePattern);
        if (timeMatch) {
            console.log(`  Matched time in line: ${line}`);
            let minutes, seconds;
            if (timeMatch[3]) {
                minutes = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
                seconds = parseInt(timeMatch[3]);
            } else {
                minutes = parseInt(timeMatch[1]);
                seconds = parseInt(timeMatch[2]);
            }
            const totalSeconds = minutes * 60 + seconds;

            let name = line.replace(timeInLinePattern, '').trim();
            name = name.replace(/[\s\-–—:]+$/, '').trim();

            if (name) {
                // CH01-01 형식인지 확인하고 챕터 업데이트
                const subChInLine = name.match(/^(CH?(\d+)-\d+)/i);
                if (subChInLine) {
                    currentChapter = `Ch${subChInLine[2].padStart(2, '0')}`;
                }

                let fullName = '';
                if (courseNumber) fullName += courseNumber + ' ';
                if (currentPart) fullName += currentPart + ' - ';
                if (currentChapter) fullName += currentChapter + ' - ';
                fullName += name;

                parsed.push({
                    name: fullName,
                    shortName: name,
                    originalDuration: totalSeconds,
                    adjustedDuration: 0
                });
            }
            pendingTitle = null;
        } else {
            // 시간이 없는 줄 - 다음 줄에 시간이 올 수 있음
            console.log(`  No time found in line, setting as pendingTitle: ${line}`);
            pendingTitle = line;
        }
    }

    return parsed;
}

const result = parseCurriculum(input);
console.log('Result:', JSON.stringify(result, null, 2));
