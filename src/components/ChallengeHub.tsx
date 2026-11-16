import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, Ear, Flame, Layers3, LockKeyhole, Play, RotateCcw, ShieldCheck, Sparkles, Trophy, Volume2 } from 'lucide-react';
import type { LevelDefinition } from '../domain/theory';
import { getTriadIntervals } from '../domain/theory';
import { CHALLENGE_MODES, generateChallengeQuestions } from '../domain/challenges';
import type { ChallengeMode, ChallengeQuestion } from '../domain/challenges';
import { getKey, LEVELS, WORLDS } from '../data/worlds';
import { selectReviewQuestions, type ReviewItem } from '../domain/learning';
import { useGameStore } from '../storage/store';
import type { PlayerProgress } from '../storage/store';
import { audio } from '../audio/AudioService';

const CONCEPT_NAMES: Record<string, string> = {
  scaleSpelling: '조표를 지키는 음이름 철자', keySignature: '조표와 음계의 관계', stackedThirds: '1·3·5 화음 쌓기', triadQuality: '화음의 품질 판정',
  romanNumeral: '로마 숫자와 코드 연결', harmonicFunction: '화음의 기능', relativeKey: '상대장조와 자연단조', auralQuality: '화음 품질 청음',
};
const MODE_COUNTS: Record<ChallengeMode, number> = { signature: 30, stack: 7, roman: 20, spelling: 10, aural: 14, fifths: 12 };
const MODE_ICONS = { signature: Flame, stack: Layers3, roman: Trophy, spelling: ShieldCheck, aural: Ear, fifths: RotateCcw };
const SOLFEGE: Record<string, string> = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };
const KOREAN: Record<string, string> = { C: '다', D: '라', E: '마', F: '바', G: '사', A: '가', B: '나' };

function availableLevel(level: LevelDefinition, progress: PlayerProgress, advanced: boolean): boolean {
  const key = getKey(level.keyId);
  const world = WORLDS.find(item => item.id === level.worldId);
  if (!world || (world.advanced && !advanced) || !progress.unlockedKeyIds.includes(level.keyId)) return false;
  const completed = new Set(progress.completedLevelIds);
  if (key.unlockPrerequisite && !completed.has(key.unlockPrerequisite)) return false;
  if (level.templateId === 'relative') return LEVELS.filter(item => item.worldId === level.worldId && item.templateId !== 'relative').every(item => completed.has(item.id));
  const stages = LEVELS.filter(item => item.keyId === level.keyId && item.templateId !== 'relative');
  const at = stages.findIndex(item => item.id === level.id);
  return at >= 0 && stages.slice(0, at).every(item => completed.has(item.id));
}

export default function ChallengeHub({ onStart }: { onStart: (level: LevelDefinition, item?: ReviewItem) => void }) {
  const { progress, settings } = useGameStore();
  const [selectedMode, setSelectedMode] = useState<ChallengeMode>('signature');
  const [screen, setScreen] = useState<'select' | 'active' | 'result'>('select');
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(60);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [records, setRecords] = useState<{ id: string; correct: boolean }[]>([]);
  const [showVisual, setShowVisual] = useState(settings.visualAudio);
  const [playing, setPlaying] = useState(false);
  const deadline = useRef(0);
  const answered = useRef(new Set<string>());
  const nonce = useRef(0);
  const soundRequest = useRef(0);
  const alive = useRef(true);
  const unlocked = progress.completedLevelIds.includes('C-major-progression');
  const mode = CHALLENGE_MODES.find(item => item.id === selectedMode)!;
  const question = questions[index];
  const correctCount = records.filter(record => record.correct).length;
  const review = useMemo(() => selectReviewQuestions(progress.reviewQueue, progress.masteryByConceptAndKey, 6), [progress.reviewQueue, progress.masteryByConceptAndKey]);
  const label = (value: string) => settings.ascii ? value.replaceAll('♯', '#').replaceAll('♭', 'b') : value;
  const subLabel = (value: string) => settings.noteLabels === 'korean' ? KOREAN[value[0]] || '' : settings.noteLabels === 'solfege' ? (SOLFEGE[value[0]] || '') + value.slice(1) : '';
  const stopAudio = () => { soundRequest.current += 1; audio.stop(); setPlaying(false); };

  useEffect(() => { alive.current = true; return () => { alive.current = false; soundRequest.current += 1; audio.stop(); }; }, []);
  useEffect(() => {
    if (screen !== 'active' || !mode.timed) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) { soundRequest.current += 1; audio.stop(); setPlaying(false); setScreen('result'); }
    };
    const interval = window.setInterval(tick, 200);
    tick();
    return () => window.clearInterval(interval);
  }, [screen, mode.timed]);
  useEffect(() => {
    if (!question) return;
    setAnswers(selectedMode === 'stack' ? [question.notes[0].display, '', ''] : []);
    setSelectedSlot(null); setOutcome('idle'); setShowVisual(settings.visualAudio);
  }, [question?.id, selectedMode]);

  const start = () => {
    if (!unlocked) return;
    stopAudio(); void audio.unlock();
    const generated = generateChallengeQuestions(selectedMode, `${Date.now().toString(36)}-${nonce.current++}`, MODE_COUNTS[selectedMode]);
    setQuestions(generated); setIndex(0); setRecords([]); setOutcome('idle'); setAnswers(selectedMode === 'stack' && generated[0] ? [generated[0].notes[0].display, '', ''] : []); setSelectedSlot(null); setShowVisual(settings.visualAudio); answered.current.clear(); setRemaining(60); deadline.current = Date.now() + 60_000; setScreen('active');
  };
  const finish = () => { stopAudio(); setScreen('result'); };
  const play = async () => {
    if (!question || playing) return;
    const request = ++soundRequest.current;
    setPlaying(true);
    try { await audio.unlock(); await audio.playNotes(question.notes, question.notes.length > 3 ? 'scale' : 'block', 80); }
    finally { if (alive.current && soundRequest.current === request) setPlaying(false); }
  };
  const chooseNote = (note: string) => {
    if (outcome !== 'idle') return;
    const target = selectedSlot ?? (answers[1] ? 2 : 1);
    setAnswers(old => { const result = [...old]; result[target] = note; return result; });
    setSelectedSlot(null);
  };
  const submit = () => {
    if (!question || outcome !== 'idle' || (selectedMode === 'stack' ? answers.some(note => !note) : !answers[0])) return;
    const correct = (selectedMode === 'stack' ? answers.join('|') : answers[0]) === question.answer;
    if (!answered.current.has(question.id)) { answered.current.add(question.id); setRecords(old => [...old, { id: question.id, correct }]); }
    setOutcome(correct ? 'correct' : 'incorrect');
    if (correct) audio.success();
  };
  const next = () => {
    stopAudio();
    if (index + 1 === questions.length) { setScreen('result'); return; }
    setIndex(index + 1);
  };
  const replayStack = () => { if (!question) return; setAnswers([question.notes[0].display, '', '']); setSelectedSlot(null); setOutcome('idle'); };
  const firstJourney = LEVELS.find(level => availableLevel(level, progress, settings.advanced) && !progress.completedLevelIds.includes(level.id)) || LEVELS.find(level => availableLevel(level, progress, settings.advanced));

  return <>
    <div className="page-eyebrow">A NEW KIND OF CHALLENGE</div>
    <div className="page-heading"><div><h1>도전의 탑</h1><p>쌓기·표기·청음으로 원리를 다시 발견해 보세요. 시간제한은 선택한 질주 모드에만 있어요.</p></div></div>

    {screen === 'select' && <>
      <div className="choice-grid" style={{ marginBottom: 24 }}>{CHALLENGE_MODES.map(item => {
        const Icon = MODE_ICONS[item.id];
        return <button key={item.id} className={`mode-card choice-card ${selectedMode === item.id ? 'selected' : ''}`} aria-pressed={selectedMode === item.id} onClick={() => { stopAudio(); setSelectedMode(item.id); }} style={{ textAlign: 'left', minHeight: 132, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 9 }}>
          <Icon size={23}/><strong>{item.title}</strong><span style={{ fontSize: 14, lineHeight: 1.6 }}>{item.description}</span><span style={{ fontSize: 13 }}>{item.timed ? '60초 · 선택형 질주' : item.id === 'stack' ? '7개 구축 · 시간제한 없음' : '시간제한 없음'}</span>
        </button>;
      })}</div>
      <section className="challenge-card">
        <span className="challenge-emblem"><Trophy size={42}/></span><span className="micro-tag">{mode.timed ? '60 SECOND CHALLENGE' : 'DISCOVER AT YOUR PACE'}</span>
        <h2>{mode.title}</h2><p>{mode.description}</p>
        {!unlocked ? <><div className="callout"><LockKeyhole size={18}/>C 장조의 진행 코어 보스전을 복원하면 여섯 도전이 열려요.</div>{firstJourney && <button className="primary-button" onClick={() => onStart(firstJourney)}>모험 이어가기<ArrowRight size={18}/></button>}</> : <>
          <p>{mode.timed ? '60초 동안 서로 다른 문제를 풀어요.' : '시계를 보지 않고 원리를 확인해도 괜찮아요.'} 듣기와 시각 대체는 감점이 없어요.</p>
          <button className="primary-button" onClick={start}><Play size={18}/>{mode.title} 시작</button>
          <small style={{ display: 'block', fontSize: 13 }}>이번 세션의 첫 시도 정답 수를 기록해요. 모험의 별과 잠금 상태에는 영향을 주지 않아요.</small>
        </>}
      </section>
    </>}

    {screen === 'active' && question && <section className="challenge-card">
      <div className="challenge-score"><span>{mode.timed ? <><Clock3 size={20}/>{remaining}초</> : <><Layers3 size={20}/>시간제한 없음</>}</span><span>{index + 1} / {questions.length}</span></div>
      <span className="micro-tag">{mode.title}</span><h2>{question.prompt}</h2>
      {!['fifths', 'signature'].includes(selectedMode) && <p>{getKey(question.keyId).koreanName}{question.degree && selectedMode !== 'aural' ? ` · ${question.degree}도` : ''}</p>}
      {selectedMode === 'signature' && question.signature && <div className="signature-panel"><strong>{label(question.signature)}</strong></div>}

      {selectedMode === 'stack' ? <>
        <div className="scale-rail" aria-label="C 장조의 일곱 음">{getKey(question.keyId).scale.map((note, i) => <span key={note.display}><b>{label(note.display)}</b><small>{i + 1}도</small></span>)}</div>
        <div className="chord-tower">{[0, 1, 2].map(slot => <button className={`note-slot ${answers[slot] ? 'filled' : ''} ${selectedSlot === slot ? 'selected' : ''}`} key={slot} aria-label={`${['루트', '3음', '5음'][slot]} 슬롯 ${answers[slot] ? label(answers[slot]) : '비어 있음'}`} disabled={slot === 0 || outcome !== 'idle'} onClick={() => { setAnswers(old => old.map((n, i) => i === slot ? '' : n)); setSelectedSlot(slot); }}><small>{['1음 · Root', '3음 · Third', '5음 · Fifth'][slot]}</small><strong>{answers[slot] ? label(answers[slot]) : '+'}</strong></button>)}</div>
        <div className="note-deck">{question.options.map(note => <button key={note} className="note-card" aria-label={`${label(note)} 카드 배치`} onClick={() => chooseNote(note)} disabled={outcome !== 'idle'}><strong>{label(note)}</strong>{subLabel(note) && <small>{subLabel(note)}</small>}</button>)}</div>
        <p className="input-help">루트에서 하나씩 건너뛰어요. 카드 탭으로 채우고, 슬롯 탭으로 바꿀 수 있어요.</p>
      </> : <>
        {selectedMode === 'aural' && <div className="playback-panel">
          <button className="primary-button" onClick={() => void play()} disabled={playing}><Volume2 size={20}/>{playing ? '화음 재생 중…' : '화음 듣기'}</button>
          <button className="text-button" onClick={() => setShowVisual(value => !value)} aria-pressed={showVisual}>{showVisual ? '시각 단서 접기' : '시각 대체로 간격 보기'}</button>
          {showVisual && <div className="signature-panel"><span>{question.notes.map(note => label(note.display)).join(' – ')}</span><strong>{getTriadIntervals(question.notes).join(' + ')} 반음</strong></div>}
        </div>}
        <div className="choice-grid" role="group" aria-label="도전 정답 선택">{question.options.map(option => <button className={`choice-card ${answers[0] === option ? 'selected' : ''} ${outcome !== 'idle' && option === question.answer ? 'correct' : ''}`} key={option} aria-pressed={answers[0] === option} onClick={() => setAnswers([option])} disabled={outcome !== 'idle'} style={{ minHeight: 64, fontSize: 16, overflowWrap: 'anywhere' }}><strong>{label(option)}</strong></button>)}</div>
      </>}

      {outcome === 'idle' ? <button className="primary-button" onClick={submit} disabled={selectedMode === 'stack' ? answers.length < 3 || answers.some(note => !note) : !answers[0]}><Check size={18}/>정답 확인하기</button> : <>
        <div className={`feedback ${outcome === 'correct' ? 'success' : ''}`} role="status"><div><strong>{outcome === 'correct' ? '원리를 찾았어요!' : '규칙을 다시 확인해요.'}</strong><p style={{ fontSize: 16, lineHeight: 1.8 }}>{label(question.explanation)}</p></div></div>
        {selectedMode === 'stack' && outcome === 'incorrect' ? <button className="primary-button" onClick={replayStack}><RotateCcw size={18}/>직접 다시 쌓기</button> : <button className="primary-button" onClick={next}>{index + 1 === questions.length ? '도전 결과 보기' : '다음 문제'}<ArrowRight size={18}/></button>}
      </>}
      <p className="score-note">첫 시도 정답 {correctCount}개 · 풀이한 문제 {records.length}개</p>
      <button className="text-button" onClick={finish}>도전 마치기</button>
    </section>}

    {screen === 'result' && <section className="challenge-card">
      <span className="challenge-emblem"><Sparkles size={42}/></span><span className="micro-tag">CHALLENGE COMPLETE</span><h2>{mode.title} 결과</h2>
      <div className="result-stats"><div><strong>{correctCount}</strong><span>첫 시도 정답</span></div><div><strong>{records.length}</strong><span>풀이한 문제</span></div><div><strong>{records.length ? Math.round(correctCount / records.length * 100) : 0}%</strong><span>첫 시도 정확도</span></div></div>
      <p>{mode.timed && remaining === 0 ? '60초 도전이 끝났어요.' : '이번 발견을 다음 모험에서도 이어 가세요.'} 틀린 답도 원리를 확인하는 단서가 돼요.</p>
      <div className="practice-buttons"><button className="primary-button" onClick={start}><RotateCcw size={18}/>새 문제로 다시 도전</button><button className="secondary-button" onClick={() => { stopAudio(); setScreen('select'); }}><ArrowLeft size={18}/>도전 선택하기</button></div>
      <p className="score-note">이 결과는 현재 세션에서 확인할 수 있어요.</p>
    </section>}

    {screen !== 'active' && <>
      <div className="section-heading"><h2>다시 만나면 좋은 개념</h2></div>
      {review.length ? <div className="level-list panel">{review.map(item => {
        const candidate = LEVELS.find(level => level.keyId === item.keyId && (item.levelId ? level.id === item.levelId : level.learningObjectives.includes(item.concept)) && availableLevel(level, progress, settings.advanced));
        return <button key={item.id} className="level-row" disabled={!candidate} onClick={() => { if (candidate && availableLevel(candidate, useGameStore.getState().progress, useGameStore.getState().settings.advanced)) onStart(candidate, item); }}><span className="level-number"><RotateCcw size={18}/></span><span><strong>{getKey(item.keyId).koreanName}</strong><small>{CONCEPT_NAMES[item.concept] || '화음 원리 복습'} · {item.degree}도{item.taskId ? '' : ' · 기존 개념 복습'}{candidate ? '' : ' · 해당 조성 모험 후 복습 가능'}</small></span><ChevronRight size={18}/></button>;
      })}</div> : <div className="empty-state"><ShieldCheck size={28}/><h3>지금은 복습할 기록이 없어요.</h3><p>모험 중 어려웠던 개념이 생기면 이곳에 모아 둘게요.</p></div>}
    </>}
  </>;
}
