import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Headphones, Lightbulb, Music2, Sparkles, Star, Volume2, X } from 'lucide-react';
import './rulebook.css';

const chapters = [
  ['시작하기', '왕국과 첫 모험'], ['조작법', '카드를 놓는 방법'], ['음계와 조표', '일곱 음과 반음'],
  ['화음 쌓기', '한 칸씩 건너뛰기'], ['화음의 품질', '반음 수로 구별하기'], ['로마 숫자', '일곱 화음 읽기'],
  ['화음의 기능', '집으로 향하는 길'], ['상대조와 거울', '같은 음, 다른 중심'], ['탐험 지도', '도감과 연습실'],
  ['별과 복습', '실수해도 괜찮아요'], ['듣기와 저장', '나에게 맞게 설정'],
] as const;

function Illustration({ title, caption, children, label }: { title: string; caption: string; children: ReactNode; label?: string }) {
  return <figure className="rb-figure" aria-label={label || title}>
    <div className="rb-figure-title"><span aria-hidden="true">✦</span>{title}</div>
    <div className="rb-art">{children}</div>
    <figcaption>{caption}</figcaption>
  </figure>;
}
function NoteLane({notes,selected=[]}:{notes:string[];selected?:number[]}) {
  return <div className="rb-note-lane">{notes.map((note,i)=><div className={`rb-note ${selected.includes(i)?'is-selected':''}`} key={`${note}-${i}`}><small>{i+1}</small><b>{note}</b></div>)}</div>;
}
function Chips({items}:{items:{top?:string;main:string;sub?:string;tone?:string}[]}) {
  return <div className="rb-chips">{items.map((item,i)=><div className={`rb-chip ${item.tone||''}`} key={`${item.main}-${i}`}><small>{item.top}</small><strong>{item.main}</strong><span>{item.sub}</span></div>)}</div>;
}
function Path({items}:{items:string[]}) { return <div className="rb-path">{items.map((item,i)=><span className="rb-path-part" key={item}><b>{item}</b>{i<items.length-1&&<i>→</i>}</span>)}</div> }
function SmallText({children}:{children:ReactNode}) { return <p className="rb-text">{children}</p> }
function Callout({children}:{children:ReactNode}) { return <aside className="rb-callout"><Lightbulb size={19}/><span>{children}</span></aside> }
function Tower({notes=['C','E','G'],symbol='C'}:{notes?:string[];symbol?:string}) {return <div className="rb-tower-wrap"><div className="rb-tower">{[...notes].reverse().map((n,i)=><div className={`rb-tower-stone stone-${i}`} key={`${n}-${i}`}><small>{['5음','3음','루트'][i]}</small><strong>{n}</strong></div>)}</div><div className="rb-tower-label"><span>완성된 화음</span><b>{symbol}</b><small>{notes.join(' · ')}</small></div></div>}
function SectionHead({n,title,description}:{n:string;title:string;description:string}) {return <div className="rb-section-heading"><div><span>CHAPTER {n} · TON TERRA</span><h2>{title}</h2><p>{description}</p></div><div className="rb-section-emblem" aria-hidden="true"><Music2 size={26}/></div></div>}

export function Chapter({index}:{index:number}) {
 switch(index) {
 case 0:return <>
  <SectionHead n="01" title="왕국을 복원할 준비가 됐나요?" description="음악이 처음이어도 괜찮아요. 차근차근 직접 쌓으며 원리를 발견해요."/>
  <div className="rb-hero"><div><span>WELCOME, CRAFTER</span><h3>작은 음 세 개가<br/>왕국을 밝혀요.</h3><p>흩어진 음계 조각을 모아 화음 탑을 만들고, 각 지역의 빛을 되찾아 보세요.</p></div><img src={`${import.meta.env.BASE_URL}rulebook/tonterra-guide-cover.webp`} alt="" /></div>
  <Illustration title="한 지역의 모험" caption="장조와 상대단조의 각 여섯 단계를 완료한 뒤, 둘을 비교하면 다음 지역으로 이어져요."><Path items={['☀ 장조 6단계','☾ 단조 6단계','✦ 비교 임무','다음 지역']}/></Illustration>
  <Illustration title="처음에는 무조표의 정원부터" caption="C 장조의 여섯 단계를 차례로 마치면 A 자연단조가 열려요."><Chips items={[{top:'START',main:'C 장조',sub:'태양 도시',tone:'gold'},{top:'다음',main:'A 자연단조',sub:'달 동굴',tone:'lavender'},{top:'마지막',main:'비교 임무',sub:'중심음 비교',tone:'mint'}]}/></Illustration>
  <SmallText>한 스테이지는 여러 과제로 이루어져요. 문제를 풀어 별을 모으고 다음 임무를 열어 보세요. 지도에는 기본 12개 지역, 고급 설정을 켜면 거울 지역 3개가 더 보여요.</SmallText>
 </>;
 case 1:return <>
  <SectionHead n="02" title="카드를 놓고 확인해요" description="탭과 드래그 중 편한 방법을 골라요. 한 번에 하나씩 놓으면 돼요."/>
  <Illustration title="카드를 탭하면 다음 빈칸에 쏙!" caption="음 카드 탭 → 빈 슬롯에 배치 → 완성 확인하기를 눌러요."><div className="rb-touch-demo"><div><span>카드</span><b>C</b></div><div className="rb-touch-arrow">↗<small>탭</small></div><div><span>슬롯 1</span><b>C</b></div><div className="rb-touch-arrow">→</div><div><span>확인</span><b>✓</b></div></div></Illustration>
  <Illustration title="슬롯을 바꾸고 싶다면" caption="바꾸고 싶은 슬롯을 누른 뒤 다른 카드를 선택해요. 카드를 직접 끌어 놓을 수도 있어요."><Chips items={[{top:'1',main:'슬롯 선택',sub:'바꿀 칸을 탭',tone:'mint'},{top:'2',main:'카드 선택',sub:'새 음을 탭',tone:'gold'},{top:'3',main:'확인',sub:'순서와 철자 살피기',tone:'lavender'}]}/></Illustration>
  <Illustration title="문제에서 만나는 도구" caption="듣기는 감점 없이 사용할 수 있어요. 힌트를 누르면 해당 문항에서 15점이 줄어요."><Chips items={[{main:'♫ 듣기',sub:'소리 확인',tone:'mint'},{main:'✦ 힌트',sub:'규칙 살펴보기',tone:'gold'},{main:'✓ 확인',sub:'답 제출',tone:'lavender'}]}/></Illustration>
  <Callout>같은 음을 동시에 들으면 블록 코드, 한 음씩 차례로 들으면 아르페지오예요.</Callout>
 </>;
 case 2:return <>
  <SectionHead n="03" title="음계와 조표의 비밀" description="음계는 음을 순서대로 늘어놓은 재료 상자예요."/>
  <Illustration title="C 장조의 일곱 음" caption="C부터 B까지 글자 순서대로 한 번씩 사용해요. C 장조에는 조표가 없어요."><NoteLane notes={['C','D','E','F','G','A','B']}/></Illustration>
  <Illustration title="장음계의 간격" caption="전음은 2반음, 반음은 1반음이에요. C 장조에서는 E–F와 B–C가 반음이에요."><div className="rb-intervals">{['전','전','반','전','전','전','반'].map((v,i)=><div key={i} className={v==='반'?'half':''}><strong>{v}</strong><small>{v==='반'?'1':'2'}반음</small></div>)}</div><div className="rb-interval-label">C → D → E → F → G → A → B → C</div></Illustration>
  <Illustration title="조표가 바꾸는 음" caption="G 장조의 조표는 F♯ 한 개예요. 이 조성의 F는 F♯로 읽어요."><div className="rb-signature"><span>G 장조</span><b>♯</b><div><strong>F → F♯</strong><small>G · A · B · C · D · E · F♯</small></div></div></Illustration>
  <Callout>같은 소리처럼 들려도 음이름의 철자는 중요해요. G♭ 장조에서는 B가 아니라 C♭으로 적는 음이 있어요.</Callout>
 </>;
 case 3:return <>
  <SectionHead n="04" title="한 칸씩 건너뛰면 화음!" description="음계에서 원하는 도수부터 시작해 1·3·5음을 차곡차곡 쌓아요."/>
  <Illustration title="C 장조 1도에서 출발" caption="C를 고르고 D를 건너 E, F를 건너 G를 고르면 C–E–G가 돼요."><NoteLane notes={['C','D','E','F','G','A','B']} selected={[0,2,4]}/></Illustration>
  <Illustration title="화음 탑의 세 층" caption="루트는 시작 음, 그 위에는 3음과 5음을 놓아요."><Tower/></Illustration>
  <Illustration title="다른 도수에서도 같은 규칙" caption="D에서 시작해 F와 A를 쌓으면 Dm. 끝에 도달하면 음계의 처음으로 돌아와요."><NoteLane notes={['D','E','F','G','A','B','C']} selected={[0,2,4]}/><div className="rb-formula"><b>D</b><span>+</span><b>F</b><span>+</span><b>A</b><i>→</i><strong>Dm</strong></div></Illustration>
  <Callout>카드를 고를 때 바로 옆 음이 아니라 하나를 건너뛰어요. 해당 조성의 일곱 음 안에서 선택하는 것이 중요해요.</Callout>
 </>;
 case 4:return <>
  <SectionHead n="05" title="반음으로 화음 감정하기" description="아래 두 음과 위 두 음 사이의 반음을 각각 세어 화음의 품질을 찾아요."/>
  <Illustration title="네 가지 3화음의 공식" caption="장·단·감·증은 두 3도의 반음 간격으로 구별해요."><div className="rb-quality-grid">{[['장','4','3','major'],['단','3','4','minor'],['감','3','3','dim'],['증','4','4','aug']].map(([q,a,b,c])=><div className={`rb-quality ${c}`} key={q}><b>{q}</b><div><strong>{a} + {b}</strong><small>반음 + 반음</small></div></div>)}</div></Illustration>
  <Illustration title="C 장3화음" caption="C→E는 4반음, E→G는 3반음이므로 C 장3화음이에요."><div className="rb-gapline"><b>C</b><span>4반음</span><b>E</b><span>3반음</span><b>G</b></div></Illustration>
  <Illustration title="A 단3화음" caption="A→C는 3반음, C→E는 4반음이므로 Am 단3화음이에요."><div className="rb-gapline minor"><b>A</b><span>3반음</span><b>C</b><span>4반음</span><b>E</b></div></Illustration>
  <SmallText>자연단조의 3화음에는 장·단·감이 나타나요. 증3화음은 자유 연습의 화성단음계에서 비교할 수 있어요.</SmallText>
 </>;
 case 5:return <>
  <SectionHead n="06" title="로마 숫자는 화음의 주소" description="음계의 몇 번째 음에서 쌓았는지와 화음의 품질을 함께 알려줘요."/>
  <Illustration title="C 장조의 일곱 화음" caption="대문자 I·IV·V는 장, 소문자 ii·iii·vi는 단, vii°는 감화음이에요."><div className="rb-chord-chart">{[['I','C'],['ii','Dm'],['iii','Em'],['IV','F'],['V','G'],['vi','Am'],['vii°','Bdim']].map(([a,b])=><div key={a}><strong>{a}</strong><span>{b}</span></div>)}</div></Illustration>
  <Illustration title="A 자연단조의 일곱 화음" caption="자연단조에서는 i–ii°–III–iv–v–VI–VII 순서예요. v는 Em 단화음이에요."><div className="rb-chord-chart minor">{[['i','Am'],['ii°','Bdim'],['III','C'],['iv','Dm'],['v','Em'],['VI','F'],['VII','G']].map(([a,b])=><div key={a}><strong>{a}</strong><span>{b}</span></div>)}</div></Illustration>
  <Illustration title="도수와 품질을 함께 읽기" caption="IV는 네 번째 음에 쌓은 장화음, ii°는 두 번째 음에 쌓은 감화음이에요."><Chips items={[{top:'대문자',main:'IV',sub:'장화음',tone:'gold'},{top:'소문자',main:'ii',sub:'단화음',tone:'mint'},{top:'작은 원',main:'vii°',sub:'감화음',tone:'lavender'}]}/></Illustration>
 </>;
 case 6:return <>
  <SectionHead n="07" title="화음은 저마다 역할이 있어요" description="입문 단계에서는 화음이 만드는 흐름을 집·길·문으로 기억해요."/>
  <Illustration title="집에서 출발해 다시 집으로" caption="토닉은 편안한 중심, 프리도미넌트는 다음으로 가는 길, 도미넌트는 돌아가고 싶은 긴장감을 만들어요."><div className="rb-function-road"><div><b>⌂</b><strong>토닉</strong><small>집</small></div><i>→</i><div><b>↝</b><strong>프리도미넌트</strong><small>길</small></div><i>→</i><div><b>♜</b><strong>도미넌트</strong><small>문</small></div><i>→</i><div><b>⌂</b><strong>토닉</strong><small>집</small></div></div></Illustration>
  <Illustration title="C 장조에서 연습하기" caption="입문용 분류: I·iii·vi는 토닉, ii·IV는 프리도미넌트, V·vii°는 도미넌트예요."><Chips items={[{top:'토닉',main:'I · iii · vi',sub:'C · Em · Am',tone:'mint'},{top:'프리도미넌트',main:'ii · IV',sub:'Dm · F',tone:'gold'},{top:'도미넌트',main:'V · vii°',sub:'G · Bdim',tone:'lavender'}]}/></Illustration>
  <Illustration title="진행 코어 보스전" caption="C 장조 첫 보스에서는 C–Am–F–G를 쌓고 순서대로 이어 들어요. 이후 조성에서는 다른 진행을 만나요."><Path items={['C · I','Am · vi','F · IV','G · V']}/></Illustration>
  <Callout>자연단조의 v는 단화음이라 장조 V보다 이끄는 힘이 약해요. 문맥에 따라 기능 설명은 달라질 수 있어요.</Callout>
 </>;
 case 7:return <>
  <SectionHead n="08" title="같은 음, 다른 중심" description="상대조는 조표와 음 재료를 공유하지만 으뜸음이 달라요."/>
  <Illustration title="C 장조와 A 자연단조" caption="두 조성은 모두 흰 건반의 일곱 음을 쓰지만, C와 A를 각각 중심으로 느껴요."><div className="rb-relative"><div><span>☀ 태양 도시</span><strong>C 장조</strong><small>C D E F G A B</small></div><div className="rb-relative-link">같은 음<br/>다른 중심</div><div><span>☾ 달 동굴</span><strong>A 자연단조</strong><small>A B C D E F G</small></div></div></Illustration>
  <Illustration title="같은 C 화음의 다른 주소" caption="C–E–G는 C 장조에서는 I, A 자연단조에서는 III예요."><div className="rb-relative"><div><span>C 장조</span><strong>I</strong><small>C · E · G</small></div><div className="rb-relative-link">같은<br/>화음</div><div><span>A 자연단조</span><strong>III</strong><small>C · E · G</small></div></div></Illustration>
  <Illustration title="거울 지역: 소리는 같아도 철자는 달라요" caption="G♭ 장조의 IV는 C♭–E♭–G♭예요. C♭은 건반에서 B와 같은 높이지만 글자 순서가 달라요."><div className="rb-mirror"><div><span>표기</span><strong>C♭</strong></div><div className="rb-mirror-glass">≒</div><div><span>같은 건반</span><strong>B</strong></div></div></Illustration>
  <SmallText>화성단음계는 자연단음계의 일곱 번째 음을 반음 올린 별도 모드예요. 기본 자연단조에 자동으로 섞지 않아요.</SmallText>
 </>;
 case 8:return <>
  <SectionHead n="09" title="나만의 속도로 탐험해요" description="모험 외에도 도감과 연습실, 여섯 가지 도전이 준비되어 있어요."/>
  <Illustration title="다섯 가지 주요 메뉴" caption="화면 아래 또는 옆 메뉴에서 원하는 장소로 이동해요."><Chips items={[{main:'⌂ 홈',sub:'이어하기',tone:'mint'},{main:'◇ 지도',sub:'스테이지',tone:'gold'},{main:'▤ 도감',sub:'일곱 화음',tone:'lavender'},{main:'♫ 연습',sub:'자유 탐색',tone:'mint'},{main:'★ 도전',sub:'여섯 모드',tone:'gold'}]}/></Illustration>
  <Illustration title="도감에서 화음 관찰" caption="조성을 고르면 일곱 화음, 구성음, 로마 숫자와 기능을 보고 소리도 들을 수 있어요."><Tower notes={['C','E','G']} symbol="C · I"/></Illustration>
  <Illustration title="자유 연습실" caption="조성·음계 모드·도수·템포·연주 방식을 바꾸고 반복해서 들을 수 있어요. 점수와 제한 시간은 없어요."><div className="rb-control-board"><span>조성 <b>C 장조 ▾</b></span><span>모드 <b>장음계 ▾</b></span><span>도수 <b>I · ii · iii · IV</b></span><span>방식 <b>블록 / 아르페지오</b></span></div></Illustration>
  <Illustration title="도전의 탑 여섯 가지" caption="C 장조 진행 보스를 마치면 도전이 열려요. 60초 제한은 조표 질주와 로마 숫자 변환에만 적용돼요."><Chips items={['조표 질주','7개 구축','로마 변환','철자 탐지','품질 청음','5도권 릴레이'].map((main,i)=>({main,top:`0${i+1}`,tone:i%2?'gold':'mint'}))}/></Illustration>
 </>;
 case 9:return <>
  <SectionHead n="10" title="실수는 발견의 시작" description="목숨 제한은 없어요. 힌트를 보고 직접 다시 만들며 배워요."/>
  <Illustration title="세 번 틀려도 괜찮아요" caption="첫 오답은 규칙을 안내하고, 두 번째는 관련 음을 강조해요. 세 번째에는 완성 경로를 보여 준 뒤 직접 재현해요."><Path items={['1 규칙 안내','2 관련 음 강조','3 완성 경로','직접 다시 만들기']}/></Illustration>
  <Illustration title="문항 점수" caption="첫 정답 100점, 한 번 틀린 뒤 70점, 두 번 틀린 뒤 40점, 안내 후 재현 20점. 힌트는 한 번당 15점이 줄어요."><Chips items={[{top:'첫 시도',main:'100',sub:'점',tone:'mint'},{top:'두 번째',main:'70',sub:'점',tone:'gold'},{top:'세 번째',main:'40',sub:'점',tone:'lavender'},{top:'안내 후',main:'20',sub:'점',tone:'mint'}]}/></Illustration>
  <Illustration title="별을 모아 보세요" caption="완료하면 별 1개, 평균 75점 이상이면 2개, 평균 90점 이상이고 자동완성 없이 마치면 3개예요."><div className="rb-stars"><span><Star fill="currentColor"/> 완료</span><span><Star fill="currentColor"/><Star fill="currentColor"/> 75점 이상</span><span><Star fill="currentColor"/><Star fill="currentColor"/><Star fill="currentColor"/> 90점 이상 + 자동완성 없음</span></div></Illustration>
  <Illustration title="다시 만나면 좋은 개념" caption="어려웠던 문항은 도전의 탑의 복습 목록에서 다시 풀어요. 목록으로 돌아가 다시 열어, 힌트 없이 첫 시도에 세 차례 맞히면 목록에서 사라져요."><Path items={['어려운 문제','복습 목록','스스로 정답','3회 성공']}/></Illustration>
  <SmallText>재도전해도 기존의 최고 별은 유지돼요. 일부 문항은 같은 종류의 다른 도수로 세션 말미에 다시 연습할 수 있어요.</SmallText>
 </>;
 case 10:return <>
  <SectionHead n="11" title="소리와 기록을 내게 맞게" description="편한 방식으로 듣고, 학습 기록을 안전하게 보관해요."/>
  <Illustration title="소리가 들리지 않나요?" caption="먼저 화면을 한 번 눌러 오디오를 시작하고, 음소거와 기기 음량을 확인해요."><div className="rb-sound"><div><Volume2 size={34}/><span>앱 음량</span></div><div className="rb-sound-wave"><i/><i/><i/><i/><i/><i/><i/></div><div><Headphones size={34}/><span>기기 음량</span></div></div></Illustration>
  <Illustration title="설정에서 조절할 수 있어요" caption="음량·음색·진동, 음이름 표기, 움직임 줄이기, 청음의 시각 대체, 고급 지역 표시를 조절해요."><Chips items={[{main:'♫ 음량',sub:'듣기',tone:'mint'},{main:'A 음이름',sub:'표기 방식',tone:'gold'},{main:'◌ 움직임',sub:'줄이기',tone:'lavender'},{main:'✦ 고급',sub:'거울 지역',tone:'mint'}]}/></Illustration>
  <Illustration title="기록은 이 브라우저에 저장돼요" caption="완료와 설정은 이 기기의 브라우저에 저장돼요. 설정에서 JSON으로 내보내고 다른 기기에서 가져올 수 있어요."><Path items={['현재 브라우저','기록 내보내기','JSON 파일','기록 가져오기']}/></Illustration>
  <Callout>브라우저 데이터를 삭제하거나 기기를 바꾸기 전에는 기록을 내보내 보관해 주세요. 진행 중인 문제는 새로고침 시 해당 스테이지의 처음부터 시작해요.</Callout>
 </>;
 default:return null;
 }
}

export default function Rulebook({ onClose }: { onClose: () => void }) {
 const [chapter,setChapter] = useState(0);
 const panel=useRef<HTMLDivElement>(null);
 const body=useRef<HTMLDivElement>(null);
 const closeRef=useRef(onClose);
 closeRef.current=onClose;
 useEffect(()=>{
   const before=document.activeElement as HTMLElement | null;
   const oldOverflow=document.body.style.overflow;
   document.body.style.overflow='hidden';
   panel.current?.focus();
   const keydown=(e:KeyboardEvent)=>{
     if(e.key==='Escape'){e.preventDefault();closeRef.current();return;}
     if(e.key!=='Tab'||!panel.current)return;
     const targets=Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]'));
     if(!targets.length)return;
     const first=targets[0],last=targets[targets.length-1];
     if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}
     else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   };
   document.addEventListener('keydown',keydown);
   return()=>{document.removeEventListener('keydown',keydown);document.body.style.overflow=oldOverflow;before?.focus();};
 },[]);
 const go=(n:number)=>{setChapter(n);body.current?.scrollTo({top:0,behavior:'auto'});};
 return <div className="rb-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="rb-dialog" role="dialog" aria-modal="true" aria-labelledby="rb-title" ref={panel} tabIndex={-1}>
   <header className="rb-header"><div className="rb-brand-icon"><BookOpen size={22}/></div><div><span>CHORD CRAFTER GUIDE</span><h1 id="rb-title">코드 크래프터 그림 롤북</h1></div><button type="button" className="rb-close" onClick={onClose} aria-label="롤북 닫기"><X size={24}/></button></header>
   <div className="rb-layout"><nav className="rb-nav" aria-label="롤북 목차"><div className="rb-nav-heading"><Compass size={17}/> 모험 안내 목차</div>{chapters.map(([title,sub],i)=><button key={title} type="button" className={chapter===i?'active':''} aria-current={chapter===i?'page':undefined} onClick={()=>go(i)}><span>{String(i+1).padStart(2,'0')}</span><span><b>{title}</b><small>{sub}</small></span>{chapter===i&&<span className="rb-nav-dot"/>}</button>)}<div className="rb-nav-footer"><Sparkles size={18}/> 차근차근, 함께 배워요.</div></nav>
    <div className="rb-main" ref={body}><div className="rb-mobile-select"><label htmlFor="rb-chapter">롤북 목차</label><select id="rb-chapter" value={chapter} onChange={e=>go(Number(e.target.value))}>{chapters.map(([title],i)=><option value={i} key={title}>{String(i+1).padStart(2,'0')} · {title}</option>)}</select></div><article key={chapter} className="rb-chapter"><Chapter index={chapter}/></article><footer className="rb-footer"><button type="button" disabled={chapter===0} onClick={()=>go(chapter-1)}><ArrowLeft size={17}/>이전</button><span>{chapter+1} / {chapters.length}</span>{chapter<chapters.length-1?<button type="button" className="rb-next" onClick={()=>go(chapter+1)}>다음 장<ArrowRight size={17}/></button>:<button type="button" className="rb-next" onClick={onClose}><Check size={17}/>모험으로</button>}</footer></div>
   </div>
  </div>
 </div>
}
