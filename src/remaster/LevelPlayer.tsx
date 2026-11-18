import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Hand, HelpCircle, Music2, Pause, Play, RotateCcw, Sparkles, Star, Volume2, X } from 'lucide-react';
import type { LevelDefinition } from '../domain/theory';
import { buildAllDiatonicTriads, buildDiatonicTriad, getTriadIntervals } from '../domain/theory';
import { getKey, LEVELS, WORLDS } from '../data/worlds';
import { adaptiveChoices, calculateAttemptScore, calculateStars } from '../domain/learning';
import type { ReviewItem } from '../domain/learning';
import { resolutionProgression } from '../domain/questions';
import { makeTasks, qualityNames, conceptFor, conceptDescriptions, noteLabels, solfege, type Task } from '../domain/tasks';
import { useGameStore } from '../storage/store';
import { audio } from '../audio/AudioService';
import type { CSSProperties, ReactNode } from 'react';
import './player.css';


export function Acc({ children }: { children: string }) {
 return <>{children.split(/([♯♭♮°+]|##|bb)/g).map((part,i)=><span key={i} className={/^[♯♭♮°+]|^##$|^bb$/.test(part)?'rp-acc':undefined}>{part}</span>)}</>;
}
const tileStyle=(v:string):CSSProperties=>({'--note':({C:'#f5899a',D:'#ffb26b',E:'#f5d565',F:'#91cf9c',G:'#7ccdd1',A:'#99aff3',B:'#c5a1e7'} as Record<string,string>)[v[0]]||'#e4cc8b'} as CSSProperties);
function Mascot({mood='normal'}:{mood?:'normal'|'happy'|'oops'}) {return <img className={`rp-mascot ${mood}`} src={`${import.meta.env.BASE_URL}assets/chord/mascot/ttokttak-${mood}.svg`} alt={mood==='happy'?'기뻐하는 안내자':mood==='oops'?'함께 생각하는 안내자':'안내자'} draggable={false}/>}
function Dialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
 const ref=useRef<HTMLDivElement>(null);const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const before=document.activeElement as HTMLElement|null;ref.current?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')close.current();if(e.key==='Tab'){const all=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,a[href]')||[]);const first=all[0],last=all[all.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);before?.focus()}},[]);
 return <div className="rp-overlay" onClick={e=>{if(e.currentTarget===e.target)onClose()}}><div className="rp-dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}><header><h2>{title}</h2><button aria-label="닫기" onClick={onClose}><X/></button></header>{children}</div></div>
}
export default function LevelPlayer({ level, review, onExit, onNext, onPhaseChange, onRulebook }: { level: LevelDefinition; review?: ReviewItem | null; onExit: () => void; onNext: (level: LevelDefinition) => void; onPhaseChange?: (playing:boolean) => void; onRulebook?: () => void }) {
  const { settings, completeLevel, addReview, markReviewCorrect } = useGameStore();
  const key = getKey(level.keyId);
  const baseTasks = useMemo(() => {
    const all = makeTasks(level);
    if (!review) return all;
    const matched = (review.taskId ? all.find(task => task.id === review.taskId) : undefined) || (!review.taskId ? (all.find(task => task.degree === review.degree) || all.find(task => !task.degree)) : undefined);
    return [matched || all[0]];
  }, [level.id, review?.id]);
  const [reviewTasks, setReviewTasks] = useState<Task[]>([]);
  const tasks = useMemo(() => [...baseTasks, ...reviewTasks], [baseTasks, reviewTasks]);
  const initialReviews = useRef(useGameStore.getState().progress.reviewQueue);
  const scheduledReviewIds = useRef(new Set<string>());
  const [screen, setScreen] = useState<'intro' | 'game' | 'result'>('intro');
  useEffect(() => { onPhaseChange?.(screen === 'game'); return () => onPhaseChange?.(false); }, [screen, onPhaseChange]);
  const [index, setIndex] = useState(0);
  const task = tasks[Math.min(index, tasks.length - 1)];
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [errors, setErrors] = useState(0);
  const [hints, setHints] = useState(0);
  const [assisted, setAssisted] = useState(false);
  const [autoReveal, setAutoReveal] = useState(false);
  const [success, setSuccess] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [assistedEver, setAssistedEver] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showNotes, setShowNotes] = useState(!task.audioOnly || settings.visualAudio);
  const [rhythm, setRhythm] = useState<'block' | 'arpeggio'>('block');
  const [listened, setListened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [lastPlacement, setLastPlacement] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const dragRef = useRef<{ value: string; x: number; y: number; moved: boolean } | null>(null);
  const completedRef = useRef(false);
  const playbackToken = useRef(0);
  const cancelPlayback = () => { playbackToken.current += 1; audio.stop(); setPlaying(false); };
  const alive = useRef(true);
  const signatureNotes = Object.entries(key.keySignature).map(([letter, accidental]) => letter + (accidental === '#' ? '♯' : accidental === 'b' ? '♭' : accidental === '##' ? '##' : accidental === 'bb' ? 'bb' : ''));
  const triads = useMemo(() => buildAllDiatonicTriads(key), [key.id]);
  const taskTriad = task.triad || (task.degree ? triads[task.degree - 1] : undefined);
  const progression = key.progression.map(d => triads[d - 1]);
  const relative = key.relativeKeyId ? getKey(key.relativeKeyId) : undefined;
  const world = WORLDS.find(w => w.id === level.worldId);
  const isSlots = ['scale', 'tower', 'timeline'].includes(task.kind);
  const highlightedNotes = new Set(task.kind === 'halfsteps'
    ? task.correct.flatMap(i => [key.scale[Number(i)].display, key.scale[(Number(i) + 1) % 7].display])
    : task.notes?.map(n => n.display) || task.correct);

  useEffect(() => { alive.current = true; const onHidden = () => { if (document.hidden) cancelPlayback(); }; document.addEventListener('visibilitychange', onHidden); return () => { alive.current = false; playbackToken.current += 1; audio.stop(); document.removeEventListener('visibilitychange', onHidden); }; }, []);
  useEffect(() => {
    playbackToken.current += 1; audio.stop();
    setScreen('intro'); setIndex(0); setScores([]); setCorrectStreak(0); setAssistedEver(false); setLeaveConfirm(false); completedRef.current = false;
    setReviewTasks([]); scheduledReviewIds.current.clear();
    initialReviews.current = useGameStore.getState().progress.reviewQueue;
  }, [level.id]);
  useEffect(() => {
    setAnswers(task.prefill || []); setSelectedSlot(null); setErrors(0); setHints(0); setAssisted(false); setAutoReveal(false); setSuccess(false); setFeedback(''); setShowNotes(!task.audioOnly || settings.visualAudio); setListened(false); setLastPlacement('');
  }, [index, task.id]);
  useEffect(() => {
    if (!leaveConfirm) return;
    const before = document.activeElement as HTMLElement | null;
    const panel = document.querySelector<HTMLElement>('.confirm-modal');
    panel?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setLeaveConfirm(false); }
      if (event.key !== 'Tab' || !panel) return;
      const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); before?.focus(); };
  }, [leaveConfirm]);

  const label = (value: string) => settings.ascii ? value.replaceAll('♯', '#').replaceAll('♭', 'b') : value;
  const answerLabel = (value: string) => task.kind === 'halfsteps' ? `${label(key.scale[Number(value)].display)}–${label(key.scale[(Number(value) + 1) % 7].display)}` : value === 'listened' ? '진행 전체 확인' : label(value);
  const noteSub = (value: string) => settings.noteLabels === 'korean' ? noteLabels[value[0]] || '' : settings.noteLabels === 'solfege' ? (solfege[value[0]] || '') + value.slice(1) : '';
  const place = (value: string, slot?: number) => {
    if (success || autoReveal) return;
    setLastPlacement(value);
    if (task.kind === 'halfsteps') {
      setAnswers(old => old.includes(value) ? old.filter(v => v !== value) : old.length < task.correct.length ? [...old, value] : [...old.slice(1), value]);
      return;
    }
    if (!isSlots) { setAnswers([value]); return; }
    const fixed = task.prefill?.length || 0;
    const target = slot ?? selectedSlot ?? answers.findIndex((a, i) => i >= fixed && !a);
    const effective = target === -1 || target === null ? Math.max(fixed, answers.length) : target;
    if (effective >= task.correct.length || effective < fixed) return;
    setAnswers(old => { const next = [...old]; next[effective] = value; return next; });
    setSelectedSlot(null);
    if (task.kind !== 'timeline') { const n = key.scale.find(n => n.display === value); if (n) void audio.playNotes([n]); }
  };
  const removeSlot = (slot: number) => {
    if (success || autoReveal || slot < (task.prefill?.length || 0)) return;
    setAnswers(old => { const next = [...old]; next[slot] = ''; return next; });
    setSelectedSlot(slot);
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, value: string) => {
    if (event.button !== 0 || !isSlots || autoReveal || success) return;
    dragRef.current = { value, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (d && Math.hypot(event.clientX - d.x, event.clientY - d.y) > 8) { d.moved = true; setDragging(d.value); }
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.moved) {
      const el = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]');
      if (el) place(d.value, Number(el.dataset.slot));
      event.preventDefault();
    }
    setDragging(null);
    // Keep this flag until the synthetic click has been suppressed.
    if (d.moved) window.setTimeout(() => { dragRef.current = null; }, 0); else dragRef.current = null;
  };
  const play = async (mode: 'block' | 'arpeggio' | 'scale' = 'block') => {
    if (playing) return;
    const token = ++playbackToken.current;
    setPlaying(true);
    try {
      await audio.unlock();
      if (task.kind === 'timeline' || task.kind === 'playback') await audio.playProgression(progression, 80, rhythm);
      else if (task.kind === 'resolution') await audio.playProgression(resolutionProgression(triads, progression, level.templateId), 80, rhythm);
      else await audio.playNotes(task.notes || key.scale, mode, 80);
      if (alive.current && token === playbackToken.current) setListened(true);
    } finally { if (alive.current && token === playbackToken.current) setPlaying(false); }
  };
  const correctNow = () => task.kind === 'playback' ? listened : task.kind === 'halfsteps' ? answers.length === task.correct.length && [...answers].sort().join('|') === [...task.correct].sort().join('|') : answers.length === task.correct.length && answers.every((a, i) => a === task.correct[i]);
  const validate = () => {
    if (success || autoReveal) return;
    if (correctNow()) {
      const concept = review?.concept || conceptFor[level.templateId] || 'stackedThirds';
      const degree = review?.degree || task.degree || 1;
      const matchingReview = review || initialReviews.current.find(item => item.keyId === key.id && item.concept === concept && item.degree === degree && (!item.levelId || (item.levelId === level.id && item.taskId === task.id)));
      // Only an independently correct answer without hints counts for the exact earlier item.
      if (!task.reviewOf && errors === 0 && hints === 0 && matchingReview && initialReviews.current.some(item => item.id === matchingReview.id)) {
        markReviewCorrect(matchingReview.id);
        initialReviews.current = initialReviews.current.filter(item => item.id !== matchingReview.id);
      }
      setSuccess(true); setFeedback(task.explanation); audio.success();
      if (settings.vibration && navigator.vibrate) navigator.vibrate(30);
      if (task.kind === 'scale') void play('scale');
      if (task.kind === 'tower' || task.kind === 'resolution') void play();
      return;
    }
    const nextErrors = errors + 1;
    setPulse(v => v + 1);
    if (!playing && settings.sfxVolume > 0 && !settings.muted) {
      const token = ++playbackToken.current; setPlaying(true);
      audio.configure({ volume: settings.volume * settings.sfxVolume });
      void audio.playNotes([key.scale[0], key.scale[1]], 'block').finally(() => { audio.configure(useGameStore.getState().settings); if (alive.current && token === playbackToken.current) setPlaying(false); });
    }
    setErrors(nextErrors);
    const concept = review?.concept || conceptFor[level.templateId] || 'stackedThirds';
    const reviewId = review?.id || `${key.id}:${concept}:${task.degree || 1}:${level.id}:${task.id}`;
    // A retry of this item is immediate; append a different degree for the session's end.
    if (!review && !task.reviewOf && !scheduledReviewIds.current.has(reviewId)) {
      const alternative = baseTasks.find(candidate => candidate.kind === task.kind && candidate.degree && candidate.degree !== task.degree);
      if (alternative) {
        scheduledReviewIds.current.add(reviewId);
        setReviewTasks(old => [...old, { ...alternative, id: `review-${task.id}`, reviewOf: task.id, sourceTaskId: alternative.id, title: `복습 · ${alternative.title}` }]);
      }
    }
    addReview(key.id, concept, review?.degree || task.degree || 1, review ? review.levelId : level.id, review ? review.taskId : (task.sourceTaskId || task.id));
    if (nextErrors >= 3) {
      setAssisted(true); setAssistedEver(true); setAutoReveal(true); setAnswers(task.correct);
      setFeedback('완성 경로를 함께 확인해요. 아래의 ‘직접 다시 만들기’를 눌러 같은 문제를 다시 완성하면 통과할 수 있어요.');
    } else {
      setFeedback(nextErrors === 1 ? task.rule : `${task.rule} 조표와 강조된 음계 위치를 한 번 더 살펴보세요.`);
    }
  };
  const next = () => {
    const score = calculateAttemptScore(errors, hints, assisted);
    const updated = [...scores, score];
    setScores(updated);
    setCorrectStreak(streak => errors === 0 && hints === 0 && !assisted ? streak + 1 : 0);
    if (index < tasks.length - 1) { setIndex(index + 1); return; }
    if (!review && !completedRef.current) { completeLevel(level, updated, assistedEver || assisted); completedRef.current = true; }
    setScreen('result');
  };
  const replay = () => { setAutoReveal(false); setAnswers(task.prefill || []); setSelectedSlot(null); setFeedback('이제 직접 같은 문제를 재현해 주세요. 천천히 해도 괜찮아요.'); };
  const hint = () => { if (success || autoReveal) return; setHints(hints + 1); setFeedback(`${task.rule}${hints > 0 ? ` ${task.explanation}` : ''}`); };
  const exit = () => screen === 'game' && !leaveConfirm ? setLeaveConfirm(true) : onExit();
  const candidateNextLevel = LEVELS[LEVELS.findIndex(l => l.id === level.id) + 1];
  const nextLevel = candidateNextLevel && (!WORLDS.find(w => w.id === candidateNextLevel.worldId)?.advanced || settings.advanced) ? candidateNextLevel : undefined;
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const stars = calculateStars(scores, assistedEver);

  const slot=(i:number)=> <button key={i} type="button" data-testid="note-slot" data-slot={i} className={`rp-slot ${answers[i]?'filled':''} ${selectedSlot===i?'selected':''} ${success||autoReveal?'correct':''}`} style={tileStyle(answers[i]||'')} aria-label={`${task.kind==='tower'?['루트','3음','5음'][i]:`${i+1}번째`} 슬롯${answers[i]?` ${answers[i]}`:' 비어 있음'}`} aria-pressed={selectedSlot===i} disabled={i<(task.prefill?.length||0)} onClick={()=>removeSlot(i)}><small>{task.kind==='tower'?['1음','3음','5음'][i]:task.kind==='timeline'?progression[i]?.romanNumeral:`${i+1}`}</small><strong><Acc>{answers[i]?label(answers[i]):'＋'}</Acc></strong>{answers[i]&&noteSub(answers[i])&&<small>{noteSub(answers[i])}</small>}</button>;
  const revealScale=task.kind!=='scale'||hints>0||errors>=2||success||autoReveal;
  const ring=<div className={`rp-ring ${task.kind==='scale'?'scale-puzzle':''}`} data-testid="scale-ring" aria-label={task.kind==='scale'?'음계 배치 고리':'현재 조성 음계 고리'}>{key.scale.map((n,i)=>{const angle=-Math.PI/2+2*Math.PI*i/7;const pos={'--x':`${50+40*Math.cos(angle)}%`,'--y':`${50+40*Math.sin(angle)}%`,...tileStyle(n.display)} as CSSProperties;const highlight=(hints>0||errors>=2||success||autoReveal)&&highlightedNotes.has(n.display);return task.kind==='scale'?<div className="rp-ring-node" style={pos} key={n.display}>{slot(i)}</div>:<button type="button" className={`rp-ring-node rp-note ${highlight?'highlight':''}`} style={pos} aria-label={`${label(n.display)} ${i+1}도 음 듣기`} key={n.display} disabled={success||autoReveal} onClick={()=>void audio.playNotes([n])}><small>{i+1}도</small><b><Acc>{label(n.display)}</Acc></b></button>})}<div className="rp-ring-centre"><span>{task.kind==='scale'?'일곱 음':task.kind==='tower'?`${task.degree}도`:'음계'}</span>{task.kind==='scale'&&revealScale&&<small><Acc>{key.scale.map(n=>n.display).join(' · ')}</Acc></small>}</div></div>;
  const chordNotes=taskTriad&&<div className="rp-chord-notes">{taskTriad.notes.map((n,i)=><div key={n.display} className="rp-note" style={tileStyle(n.display)}><small>{[1,3,5][i]}음</small><b><Acc>{label(n.display)}</Acc></b></div>)}</div>;
  const badgeStyle=(value:string):CSSProperties=>{const t=triads.find(t=>t.symbol===value||t.romanNumeral===value);return t?({'--note':({tonic:'#f1ce72',predominant:'#8fcfc3',dominant:'#bea4df'} as const)[t.function]} as CSSProperties):tileStyle(value)};
  const card=(value:string,i:number)=> <button key={`${value}-${i}`} type="button" data-testid="note-card" className={`rp-card ${answers.includes(value)?'chosen':''} ${dragging===value?'dragging':''}`} style={isSlots&&task.kind!=='timeline'?tileStyle(value):badgeStyle(value)} aria-label={isSlots?`${label(value)} 카드 배치`:label(value)} aria-pressed={!isSlots?answers.includes(value):undefined} disabled={success||autoReveal} onPointerDown={e=>pointerDown(e,value)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{dragRef.current=null;setDragging(null)}} onClick={()=>{if(!dragRef.current?.moved)place(value)}}><strong className="rp-card-label"><Acc>{label(value)}</Acc></strong>{noteSub(value)&&isSlots&&<small>{noteSub(value)}</small>}</button>;
  const shortRule:Record<string,string>={scale:'조표와 음이름 글자 순서를 확인해요.',tower:'바로 옆 음 대신 한 칸씩 건너뛰어요.',halfsteps:'이웃한 음 사이가 1반음인지 확인해요.',quality:'아래와 위 3도의 반음 수를 따로 세어요.',roman:'도수와 대문자·소문자·°를 함께 읽어요.',function:'각 화음이 집·길·문 중 어디에 속할까요?',resolution:'이 조성의 첫 번째 화음으로 돌아가요.',relative:'같은 음을 써도 으뜸음과 맥락을 함께 봐요.',timeline:'로마 숫자의 순서에 맞는 코드를 놓아요.',playback:'네 화음의 연주가 끝날 때까지 들어요.'};
  const compactPrompt=task.kind==='relative'?(task.id==='relative-notes'?'두 음계의 관계를 골라요.':task.id==='relative-context'?'조성의 중심을 판단할 단서는?':task.prompt):task.kind==='halfsteps'?'음 사이가 1반음인 구간 두 곳을 골라요.':task.kind==='tower'?'루트에서 하나 건너, 또 하나 건너!':task.kind==='playback'?'연주 방식을 고르고 네 화음을 들어요.':task.prompt;
  if(review?.taskId&&task.id!==review.taskId)return <div className="rp-state-card"><h1>복습 문제를 찾지 못했어요</h1><p>다른 문제를 선택해 주세요.</p><button onClick={onExit}>복습 목록</button></div>;
  if(screen==='intro')return <section className="rp-player rp-intro" data-motion={settings.reducedMotion?'reduce':'full'}><header className="rp-top"><button aria-label="지도 돌아가기" onClick={onExit}><ArrowLeft/></button><span><Acc>{key.koreanName}</Acc></span><button aria-label="게임 롤북 열기" onClick={onRulebook}><BookOpen/></button></header><div className="rp-intro-art"><img src={`${import.meta.env.BASE_URL}assets/diatonic/stage-${level.templateId}.svg`} alt={`${level.title} 소개 그림`}/><Mascot/><span className="rp-stage-seal">{level.templateId==='progression'?'보스':level.templateId==='relative'?'비교':'탐험'}</span></div><div className="rp-intro-copy"><p>{world?.name} · {review?'기억을 되살리는 복습':key.mode==='major'?'태양 도시':'달 동굴'}</p><h1>{level.title}</h1><p>{task.kind==='tower'?'음계의 한 칸씩을 건너뛰어 화음 탑을 완성해요.':'직접 만들어 보고, 소리로 원리를 발견해요.'}</p><div className="rp-signature"><Acc>{signatureNotes.length?signatureNotes.join(' · '):'조표 없음 ♮'}</Acc></div>{key.mode==='naturalMinor'&&<div className="rp-minor-note">자연단조의 v는 <Acc>{triads[4].symbol}</Acc> 단화음이에요.</div>}</div><div className="rp-intro-actions"><button className="rp-primary" onClick={()=>{void audio.unlock();setScreen('game')}}><Play/>복원 시작하기</button><span>시간 제한 없음 · 듣기 감점 없음</span></div></section>;
  if(screen==='result')return <section className="rp-player rp-result" data-motion={settings.reducedMotion?'reduce':'full'}><header className="rp-top"><span>복원 완료</span><button aria-label="결과 닫기" onClick={onExit}><X/></button></header><div className="rp-result-art"><img src={`${import.meta.env.BASE_URL}assets/chord/fx/fx-confetti.svg`} alt=""/><Mascot mood="happy"/><div className="rp-earned-stars" aria-label={`별 ${stars}개`}>{[1,2,3].map(n=><span key={n} className={n<=stars?'earned':''}>★</span>)}</div></div><div className="rp-intro-copy"><h1>{review?'복습을 마쳤어요!':'왕국에 빛을 되찾았어요!'}</h1><p><Acc>{key.koreanName}</Acc> · {level.title}</p><div className="rp-result-stats"><div><b>{avg}</b><span>평균 점수</span></div><div><b>{tasks.length}</b><span>완성 과제</span></div><div><b>{assistedEver?'함께':'스스로'}</b><span>이번 복원</span></div></div><p className="rp-save-message">✓ {review?'복습 기록을 저장했어요.':'별과 개념별 숙련도를 저장했어요.'}</p></div><div className="rp-result-actions">{!review&&nextLevel&&<button className="rp-primary" onClick={()=>onNext(nextLevel)}>다음 임무<ArrowRight/></button>}<button className="rp-secondary" onClick={onExit}>{review?'복습 목록으로':'왕국 지도로'}</button></div></section>;
  return <section className={`rp-player rp-game kind-${task.kind} ${success?'is-success':errors>0?'is-error':''}`} data-motion={settings.reducedMotion?'reduce':'full'} data-testid="remaster-task" data-kind={task.kind} data-task-id={task.id} data-degree={task.degree}>
    <header className="rp-top"><button aria-label="스테이지 나가기" onClick={()=>{cancelPlayback();setLeaveConfirm(true)}}><ArrowLeft/></button><div><strong><Acc>{key.koreanName}</Acc></strong><span className="rp-key-signature"><Acc>{signatureNotes.length?signatureNotes.join(' · '):'조표 없음'}</Acc></span></div><span className="rp-count">{index+1}/{tasks.length}</span><button aria-label="게임 롤북 열기" onClick={onRulebook}><BookOpen/></button><button aria-label="일시정지" onClick={()=>{cancelPlayback();setLeaveConfirm(true)}}><Pause/></button></header>
    <div className="rp-question"><div className="rp-progress" role="progressbar" aria-label="스테이지 진행" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={index+(success?1:0)}><i style={{width:`${(index+(success?1:0))/tasks.length*100}%`}}/></div><h1 data-testid="task-title">{task.title}</h1><p><Acc>{compactPrompt}</Acc></p><button className="rp-task-help" onClick={()=>setShowExplanation(true)} aria-label="문제 설명 자세히 보기"><HelpCircle size={18}/></button></div>
    <div className={`rp-board ${errors>0&&!success?'rp-wobble':''}`} key={`${task.id}-${pulse}`}>
      {(task.kind==='scale'||task.kind==='tower')&&<div className="rp-ring-stage">{ring}{task.kind==='tower'&&<div className="rp-tower" aria-label="음 배치 슬롯">{task.correct.map((_,i)=>slot(i))}<span>1음 ↗ 3음 ↗ 5음</span></div>}</div>}
      {task.kind==='halfsteps'&&<div className="rp-half-stage">{ring}<span className="rp-half-count">선택 {answers.length} / 2</span></div>}
      {(task.kind==='quality'||task.kind==='roman'||task.kind==='function'||task.kind==='resolution')&&<div className="rp-analysis-stage">{task.audioOnly&&!showNotes?<div className="rp-ear"><Volume2 size={44}/><button className="rp-secondary" onClick={()=>setShowNotes(true)}>눈으로 보기</button></div>:chordNotes}{task.kind==='quality'&&taskTriad&&<div className="rp-gap-meter">{getTriadIntervals(taskTriad.notes).map((gap,i)=><div key={i}><span>{i===0?'아래':'위'} 3도</span><div>{Array.from({length:gap},(_,n)=><i key={n}/>)}</div><b>{gap}반음</b></div>)}</div>}{task.kind==='function'&&<div className="rp-function-symbol" aria-hidden="true">⌂ → ♧ → ♜</div>}{task.kind==='resolution'&&<div className="rp-resolve-flow"><Acc>{(level.templateId==='function'?triads[4]:progression[3]).symbol}</Acc><span>→</span><b>?</b></div>}</div>}
      {task.kind==='timeline'&&<div className="rp-timeline" aria-label="음 배치 슬롯">{task.correct.map((_,i)=>slot(i))}</div>}
      {task.kind==='playback'&&<div className="rp-playback"><div className="rp-playback-chords">{progression.map((t,i)=><div key={i} style={badgeStyle(t.symbol)}><b><Acc>{t.symbol}</Acc></b><span><Acc>{t.romanNumeral}</Acc></span></div>)}</div><button className="rp-primary" onClick={()=>void play()} disabled={playing}><Volume2/>{playing?'진행 연주 중…':listened?'진행 다시 듣기':'진행 연주하기'}</button></div>}
      {task.kind==='relative'&&relative&&<div className="rp-relative">{[key,relative].map(k=><div key={k.id}><span>{k.mode==='major'?'☀':'☾'}</span><b><Acc>{k.koreanName}</Acc></b><small><Acc>{k.scale.map(n=>n.display).join(' ')}</Acc></small><button aria-label={`${k.koreanName} 진행 비교 듣기`} onClick={async()=>{await audio.unlock();await audio.playProgression(k.progression.map(d=>buildDiatonicTriad(k,d)),80)}}><Volume2 size={18}/>듣기</button></div>)}</div>}
      {lastPlacement&&!success&&<div key={`${lastPlacement}-${answers.join()}`} className="rp-placement" aria-hidden="true"><Acc>{lastPlacement}</Acc></div>}{success&&<div className="rp-celebration" aria-hidden="true">✦ ✧ ✦</div>}
    </div>
    <div className={`rp-deck ${task.kind==='relative'?'rp-long-options':''}`} aria-label={isSlots?'배치할 카드':'정답 선택'}>
      {isSlots&&task.options.map(card)}
      {task.kind==='halfsteps'&&task.options.map(v=><button key={v} className={`rp-card rp-gap ${answers.includes(v)?'chosen':''}`} aria-label={`${label(key.scale[+v].display)}에서 ${label(key.scale[(+v+1)%7].display)} 구간 선택`} aria-pressed={answers.includes(v)} onClick={()=>place(v)} disabled={success||autoReveal}><Acc>{`${key.scale[+v].display}→${key.scale[(+v+1)%7].display}`}</Acc></button>)}
      {!isSlots&&!['halfsteps','playback'].includes(task.kind)&&adaptiveChoices(task.options,task.correct,correctStreak).map(card)}
      {task.kind==='playback'&&<div className="rp-rhythm" aria-label="연주 리듬">{(['block','arpeggio'] as const).map(v=><button key={v} className={`rp-card ${rhythm===v?'chosen':''}`} aria-pressed={rhythm===v} onClick={()=>setRhythm(v)}>{v==='block'?'동시에 · 블록':'차례로 · 분산'}</button>)}</div>}
    </div>
    <div className={`rp-feedback ${success?'happy':errors>0?'oops':''}`} role="status" aria-live="polite" data-testid="feedback"><Mascot mood={success?'happy':errors>0?'oops':'normal'}/><div><b>{success?'원리를 발견했어요!':autoReveal?'함께 확인해요':task.npc||'루미'}</b><p><Acc>{autoReveal?`완성 경로: ${task.correct.map(answerLabel).join(' → ')}`:feedback?(success?task.explanation:shortRule[task.kind]):'카드를 골라 놓고 확인해요. 듣기는 감점이 없어요.'}</Acc></p></div>{feedback&&<button aria-label="피드백 전체 보기" onClick={()=>setShowExplanation(true)}><HelpCircle size={18}/></button>}</div>
    <footer className="rp-actions">{autoReveal?<button className="rp-primary" onClick={replay}><RotateCcw/>직접 다시 만들기</button>:success?<button className="rp-primary" onClick={next}>{index===tasks.length-1?'복원 결과 보기':'다음 발견으로'}<ArrowRight/></button>:<><button className="rp-tool" onClick={()=>void play(task.kind==='scale'||task.kind==='halfsteps'?'scale':'block')} disabled={playing} aria-label="현재 음 듣기"><Volume2/><span>{playing?'재생 중':'듣기'}</span></button>{task.kind==='tower'&&<button className="rp-tool" onClick={()=>void play('arpeggio')} disabled={playing} aria-label="분산음 듣기"><Music2/><span>분산음</span></button>}<button className="rp-tool" onClick={hint} aria-label="힌트 15점 차감"><HelpCircle/><span>힌트 −15</span></button><button className="rp-primary" aria-label="완성 확인하기" onClick={validate} disabled={task.kind==='playback'&&!listened}><Check/>확인</button></>}</footer>
    {leaveConfirm&&<Dialog title="잠깐 쉬어 가요" onClose={()=>setLeaveConfirm(false)}><Mascot/><p>현재 문제는 그대로 있어요. 지도로 돌아가면 이번 스테이지는 다시 시작해요.</p><button className="rp-primary" onClick={()=>setLeaveConfirm(false)}>계속 복원하기</button><button className="rp-secondary" onClick={onExit}>지도로 돌아가기</button></Dialog>}
    {showExplanation&&<Dialog title="문제와 학습 안내" onClose={()=>setShowExplanation(false)}><h3>{task.title}</h3><p><Acc>{task.prompt}</Acc></p><p><Acc>{feedback||task.rule}</Acc></p>{(autoReveal||success||hints>1)&&<p><Acc>{task.explanation}</Acc></p>}<button className="rp-primary" onClick={()=>setShowExplanation(false)}>문제로 돌아가기</button></Dialog>}
  </section>;
}
